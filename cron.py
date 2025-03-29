#!/usr/bin/env python3

import dataclasses
import datetime
import functools
import json
import logging
import os
import subprocess
import sys
import time
import traceback
import zoneinfo
from typing import Literal

import notify2

_logger = logging.getLogger(__name__)
DIR_PATH = os.path.abspath(os.path.dirname(__file__))
DEFAULT_CONFIG_PATH = os.path.join(DIR_PATH, "config.default.json")
CONFIG_PATH = os.path.join(DIR_PATH, "config.json")

with open(DEFAULT_CONFIG_PATH, "r") as f1, open(CONFIG_PATH, "r") as f2:
    RAW_CONFIG = json.loads(f1.read()) | json.loads(f2.read())


@dataclasses.dataclass
class Config:
    notify_types: set[Literal["desktop", "email"]]
    notify_email: str | None
    fetch_interval: int  # Fetch will be run every N days
    fetch_time: datetime.time
    fetch_tzname: str
    debug: bool

    @functools.cached_property
    def fetch_tz(self) -> datetime.timezone | None:
        return zoneinfo.ZoneInfo(CONFIG.fetch_tzname) if CONFIG.fetch_tzname else None


CONFIG = Config(
    notify_types=set(RAW_CONFIG["notify_types"]),
    notify_email=RAW_CONFIG["notify_email"],
    fetch_interval=RAW_CONFIG["fetch_interval"],
    fetch_time=datetime.time.fromisoformat(RAW_CONFIG["fetch_time"]),
    fetch_tzname=RAW_CONFIG["fetch_tzname"],
    debug=RAW_CONFIG["debug"],
)


def _notify_user__log(level: int, message: str, exc_info: bool = False) -> None:
    _logger.log(level, "Notify: %s", message, exc_info=exc_info)


def _notify_user__desktop(level: int, message: str) -> None:
    try:
        match level:
            case logging.CRITICAL | logging.ERROR:
                # critical notifications are always sticky even with timeout
                urgency = notify2.URGENCY_CRITICAL
                timeout = notify2.EXPIRES_NEVER
            case logging.WARNING | logging.INFO:
                urgency = notify2.URGENCY_NORMAL
                timeout = 2 * 1000
            case logging.DEBUG | logging.NOTSET:
                urgency = notify2.URGENCY_LOW
                timeout = 2 * 1000
            case _:
                raise ValueError(level)

        notif = notify2.Notification("Hololive Spotify Stats", message)
        notif.set_urgency(urgency)
        notif.set_timeout(timeout)
        notif.show()

    except Exception:
        _logger.exception("Error when displaying desktop notification!\nlevel=%r\nmessage=%r", level, message)


def _notify_user__email(level: int, message: str, exc_info: bool = False) -> None:
    try:
        level_name = logging.getLevelName(level)
        subject = f"Hololive Spotify Stats: {level_name}"
        body = message
        if exc_info:
            body += f"\n\nTraceback:\n\n{traceback.format_exc()}"

        subprocess.run(
            ["mail", "-s", subject, CONFIG.notify_email], text=True, input=body, check=True
        )  # nosec B607, B603

    except Exception:
        _logger.exception("Error when sending email notification!\nlevel=%r\nmessage=%r", level, message)


def notify_user(level: int, message: str, exc_info: bool = False) -> None:
    _notify_user__log(level=level, message=message, exc_info=exc_info)

    if "desktop" in CONFIG.notify_types:
        _notify_user__desktop(level=level, message=message)

    if (
        "email" in CONFIG.notify_types
        and CONFIG.notify_email
        and (level in (logging.CRITICAL, logging.ERROR) or CONFIG.debug)
    ):
        _notify_user__email(level=level, message=message, exc_info=exc_info)


def has_changes() -> bool:
    """
    Returns True if repo has any uncommitted changes
    """
    raw_status = subprocess.check_output(  # nosec B607, B603
        ["git", "status", "--porcelain"], cwd=DIR_PATH, encoding=sys.stdout.encoding
    ).strip()
    return len([x for x in raw_status.splitlines() if x.strip()]) > 0


def update_spotify_stats() -> None:
    """
    Fetches new stats, commits them, and pushes them to remote repo.
    IMPORTANT: this expects that current git branch is correct (`master`)
    """
    # ensure that git is clean and up to date

    _logger.info("Preparing git repo...")

    if has_changes():
        notify_user(logging.ERROR, "Git repository contains uncommitted changes. Fetch stopped.")
        return

    subprocess.check_call(["git", "pull", "--ff-only"], cwd=DIR_PATH)  # nosec B607, B603

    # fetch stats

    _logger.info("Fetching stats...")

    max_try = 5
    for i in range(max_try):
        try:
            subprocess.check_call(["./fetch_spotify_stats.py"], cwd=DIR_PATH)  # nosec B607, B603
            break
        except KeyboardInterrupt:
            _logger.warning("Fetch interrupted")
            raise
        except Exception:
            notify_user(logging.WARNING, f"Spotify fetch failed {i+1}/{max_try}", exc_info=True)
    else:
        notify_user(logging.ERROR, "All Spotify stats could not be fetched")
        return

    # commit changes

    _logger.info("Committing stats...")

    if not has_changes():
        notify_user(logging.INFO, "No stats changed")
        return

    try:
        today = datetime.datetime.now(tz=CONFIG.fetch_tz).date()
        subprocess.check_call(
            ["git", "commit", "-a", "-m", f"DATA:{today.isoformat()}"], cwd=DIR_PATH
        )  # nosec B607, B603
    except KeyboardInterrupt:
        _logger.warning("Commit interrupted")
        raise
    except Exception:
        notify_user(logging.ERROR, "Stats could not be committed", exc_info=True)
        return

    # push changes

    _logger.info("Pushing stats...")

    try:
        subprocess.check_call(["git", "push"], cwd=DIR_PATH)  # nosec B607, B603
    except KeyboardInterrupt:
        _logger.warning("Push interrupted")
        raise
    except Exception:
        notify_user(logging.ERROR, "Stats could not be pushed", exc_info=True)
        return

    notify_user(logging.INFO, "Stats updated")


def main() -> None:
    """
    To redirect both logging and stdout to file use: ./cron.py >> file.txt 2>&1
    """
    # configure logging

    logging.basicConfig(
        level=logging.INFO,
        format="[%(asctime)s] %(levelname)s %(name)s: %(message)s",
        handlers=[logging.StreamHandler()],
    )

    # cron loop

    _logger.info(
        "Stats will be updated every %s days after %s tz=%s",
        CONFIG.fetch_interval,
        CONFIG.fetch_time.isoformat(),
        CONFIG.fetch_tzname,
    )
    while True:
        now = datetime.datetime.now(tz=CONFIG.fetch_tz)
        today_runtime = now.replace(
            hour=CONFIG.fetch_time.hour, minute=CONFIG.fetch_time.minute, second=CONFIG.fetch_time.second
        )

        day_index = now.timetuple().tm_yday - 1
        run_today = day_index % CONFIG.fetch_interval == 0

        if run_today and now >= today_runtime:
            _logger.info("Updating")

            try:
                if "desktop" in CONFIG.notify_types:
                    notify2.init("holo-spotify-stats")
                update_spotify_stats()
            except KeyboardInterrupt:
                _logger.warning("Interrupt detected")
                break
            except Exception:
                _logger.exception("Unexpected exception when fetching stats")
            finally:
                if "desktop" in CONFIG.notify_types:
                    notify2.uninit()

            # wake up 1 second after next run time
            sleep_time = (CONFIG.fetch_interval * 24 * 60 * 60) - (now - today_runtime).seconds + 1

        elif run_today:
            # wake up 1 second after next run time
            _logger.info("Update later today")
            sleep_time = (today_runtime - now).seconds + 1

        else:
            # skip by one hour until we get to correct day
            _logger.info("Update not today: day_index=%s, interval=%s", day_index, CONFIG.fetch_interval)
            sleep_time = 1 * 60 * 60

        sleep_until = now + datetime.timedelta(seconds=sleep_time)
        _logger.info("Sleeping until %s", sleep_until)

        while sleep_until > datetime.datetime.now(tz=CONFIG.fetch_tz):
            # wake up every N seconds to help prevent process from freezing
            time.sleep(60)


if __name__ == "__main__":
    main()
