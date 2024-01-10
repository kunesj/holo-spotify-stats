#!/usr/bin/env python3

import argparse
import os
import logging
import subprocess
import sys
import notify2
import datetime
import time

_logger = logging.getLogger(__name__)
DIR_PATH = os.path.abspath(os.path.dirname(__file__))


def notify_log(level: int, message: str, exc_info: bool = False) -> None:
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

    _logger.log(level, "Notify: %s", message, exc_info=exc_info)

    notif = notify2.Notification("Hololive Spotify Stats", message)
    notif.set_urgency(urgency)
    notif.set_timeout(timeout)
    notif.show()


def has_changes() -> bool:
    """
    Returns True if repo has any uncommitted changes
    """
    raw_status = subprocess.check_output(
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
        notify_log(logging.ERROR, "Git repository contains uncommitted changes. Fetch stopped.")
        return

    subprocess.check_call(["git", "pull", "--ff-only"], cwd=DIR_PATH)

    # fetch stats

    _logger.info("Fetching stats...")

    max_try = 5
    for i in range(max_try):
        try:
            subprocess.check_call(["./fetch_spotify_stats.py"], cwd=DIR_PATH)
            break
        except KeyboardInterrupt:
            _logger.warning("Fetch interrupted")
            raise
        except Exception:
            notify_log(logging.WARNING, f"Spotify fetch failed {i+1}/{max_try}", exc_info=True)
    else:
        notify_log(logging.ERROR, "All Spotify stats could not be fetched")
        return

    # commit changes

    _logger.info("Committing stats...")

    if not has_changes():
        notify_log(logging.INFO, "No stats changed")
        return

    try:
        subprocess.check_call(
            ["git", "commit", "-a", "-m", f"DATA:{datetime.date.today().isoformat()}"], cwd=DIR_PATH
        )
    except KeyboardInterrupt:
        _logger.warning("Commit interrupted")
        raise
    except Exception:
        notify_log(logging.ERROR, "Stats could not be committed", exc_info=True)
        return

    # push changes

    _logger.info("Pushing stats...")

    try:
        subprocess.check_call(["git", "push"], cwd=DIR_PATH)
    except KeyboardInterrupt:
        _logger.warning("Push interrupted")
        raise
    except Exception:
        notify_log(logging.ERROR, "Stats could not be pushed", exc_info=True)
        return

    notify_log(logging.INFO, "Stats updated")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--interval", default=3, type=int, help="Fetch will be run every N days")
    parser.add_argument("--time", default="22:00:00", type=lambda x: datetime.time.fromisoformat(x))
    args = parser.parse_args()

    logging.basicConfig()
    _logger.setLevel(logging.INFO)
    notify2.init("holo-spotify-stats")

    _logger.info("Stats will be updated every %s days after %s", args.interval, args.time.isoformat())
    while True:
        now = datetime.datetime.now()
        run_today = (now.timetuple().tm_yday - 1) % args.interval == 0
        today_runtime = now.replace(hour=args.time.hour, minute=args.time.minute, second=args.time.second)

        if run_today and now >= today_runtime:
            try:
                update_spotify_stats()
            except KeyboardInterrupt:
                _logger.warning("Interrupt detected")
                break
            except Exception:
                _logger.exception("Unexpected exception when fetching stats")

            # wake up 1 second after next run time
            sleep_time = (args.interval * 24 * 60 * 60) - (now - today_runtime).seconds + 1

        elif run_today:
            # wake up 1 second after next run time
            sleep_time = (today_runtime - now).seconds + 1

        else:
            # skip by one hour until we get to correct day
            sleep_time = 1 * 60 * 60

        _logger.info("Sleeping for %s seconds", sleep_time)
        time.sleep(sleep_time)

    notify2.uninit()


if __name__ == "__main__":
    main()
