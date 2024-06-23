#!/usr/bin/env python3

import argparse
import datetime
import json
import logging
import os
import time
import uuid

import requests
from bs4 import BeautifulSoup

_logger = logging.getLogger(__name__)
DIR_PATH = os.path.abspath(os.path.dirname(__file__))
STATS_DIR_REL_PATH = "./spotify_stats"
STATS_DIR_PATH = os.path.abspath(os.path.join(DIR_PATH, STATS_DIR_REL_PATH))
INDEX_PATH = os.path.abspath(os.path.join(DIR_PATH, "./index.json"))
AUTH_TOKEN: str | None = None
AUTH_TOKEN_EXPIRY: float = 0


class NoIndent(object):
    def __init__(self, value):
        self.value = value


class NoIndentEncoder(json.JSONEncoder):
    def __init__(self, *args, **kwargs):
        super(NoIndentEncoder, self).__init__(*args, **kwargs)
        self.kwargs = dict(kwargs)
        del self.kwargs["indent"]
        self._replacement_map = {}

    def default(self, o):
        if isinstance(o, NoIndent):
            key = uuid.uuid4().hex
            self._replacement_map[key] = json.dumps(o.value, **self.kwargs)
            return "@@%s@@" % (key,)
        else:
            return super(NoIndentEncoder, self).default(o)

    def encode(self, o):
        result = super(NoIndentEncoder, self).encode(o)
        for k, v in iter(self._replacement_map.items()):
            result = result.replace('"@@%s@@"' % (k,), v)
        return result


def request_retry(*args, retry_max_count: int = 3, retry_delay: int = 10, **kwargs):
    retry_count = 0

    while True:
        retry_count += 1
        try:
            response = requests.request(*args, **kwargs)
            response.raise_for_status()
            break
        except KeyboardInterrupt:
            raise
        except Exception:
            _logger.exception("Request failed %s/%s", retry_count, retry_max_count)

            if retry_count > retry_max_count:
                raise

            _logger.info("Retry in % seconds...", retry_delay)
            time.sleep(retry_delay)

    return response


def get_auth_token() -> str:
    global AUTH_TOKEN, AUTH_TOKEN_EXPIRY

    if not AUTH_TOKEN or AUTH_TOKEN_EXPIRY > time.time():
        response = request_retry(
            method="GET",
            url="https://open.spotify.com",
        )

        soup = BeautifulSoup(response.content, features="lxml")
        session_tag = soup.find("script", id="session")

        data = json.loads(session_tag.get_text())
        AUTH_TOKEN = data["accessToken"]
        AUTH_TOKEN_EXPIRY = data["accessTokenExpirationTimestampMs"] / 1000

        _logger.debug("Auth token: %s", AUTH_TOKEN)

    return AUTH_TOKEN


def fetch_stats(*, artist_id: str) -> dict:
    auth_token = get_auth_token()
    response = request_retry(
        method="GET",
        url="https://api-partner.spotify.com/pathfinder/v1/query",
        params={
            "operationName": "queryArtistOverview",
            "variables": json.dumps({"uri": f"spotify:artist:{artist_id}", "locale": "", "includePrerelease": True}),
            "extensions": json.dumps(
                {
                    "persistedQuery": {
                        "version": 1,
                        "sha256Hash": "da986392124383827dc03cbb3d66c1de81225244b6e20f8d78f9f802cc43df6e",
                    }
                }
            ),
        },
        headers={
            "accept": "application/json",
            "accept-language": "en",
            # "app-platform": "WebPlayer",
            "authorization": f"Bearer {auth_token}",
            # "client-token": client_token,
            # "content-type": "application/json;charset=UTF-8",
            # "sec-ch-ua": "\"Not_A Brand\";v=\"8\", \"Chromium\";v=\"120\", \"Google Chrome\";v=\"120\"",
            # "sec-ch-ua-mobile": "?0",
            # "sec-ch-ua-platform": "\"Linux\"",
            # "sec-fetch-dest": "empty",
            # "sec-fetch-mode": "cors",
            # "sec-fetch-site": "same-site",
            # "spotify-app-version": "1.2.29.347.ga8104e6e"
        },
    )

    try:
        data = response.json()["data"]["artistUnion"]
        stats = data["stats"].copy()

        if stats.get("monthlyListeners") is None:
            raise ValueError("monthlyListeners not returned!")
        elif stats.get("followers") is None:
            raise ValueError("followers not returned!")

        top_tracks = data["discography"]["topTracks"]["items"]
        stats["top_tracks_playcount"] = [int(x["track"]["playcount"]) for x in top_tracks]

        return stats
    except Exception:
        _logger.error("Bad API response:\n%s", response.content)
        raise


def update_stats_file(*, file_path: str, force: bool = False) -> None:
    date_key = datetime.date.today().isoformat()

    # read old data

    with open(file_path, "r") as f:
        data = json.loads(f.read())

    # check if stats should be fetched

    if not data["id"]:
        _logger.info("%s (%s): Not found", data["name"], data["id"])
        return

    elif date_key in data["stats"] and not force:
        _logger.debug("%s (%s): Already fetched", data["name"], data["id"])
        return

    # fetch new data

    _logger.info("%s (%s): Fetching", data["name"], data["id"])
    data["stats"][date_key] = fetch_stats(artist_id=data["id"])

    # write new data

    data_str = json.dumps(
        {**data, "stats": {k: NoIndent(v) for k, v in data["stats"].items()}},
        indent=2,
        sort_keys=True,
        cls=NoIndentEncoder,
    )

    with open(file_path, "w") as f:
        f.write(data_str)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    logging.basicConfig()
    _logger.setLevel(logging.INFO)

    stats_files = []
    for file_name in os.listdir(STATS_DIR_PATH):
        if not file_name.endswith(".json"):
            continue

        update_stats_file(
            file_path=os.path.join(STATS_DIR_PATH, file_name),
            force=args.force,
        )
        stats_files.append(os.path.join(STATS_DIR_REL_PATH, file_name))

    with open(INDEX_PATH, "w") as f:
        f.write(json.dumps(sorted(stats_files), indent=2))

    _logger.info("Done")


if __name__ == "__main__":
    main()
