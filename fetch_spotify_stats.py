#!/usr/bin/env python3

import argparse
import requests
import json
import datetime
import os
import logging
from bs4 import BeautifulSoup
import time

_logger = logging.getLogger(__name__)
DIR_PATH = os.path.abspath(os.path.dirname(__file__))
STATS_DIR_REL_PATH = "./spotify_stats"
STATS_DIR_PATH = os.path.abspath(os.path.join(DIR_PATH, STATS_DIR_REL_PATH))
INDEX_PATH = os.path.abspath(os.path.join(DIR_PATH, "./index.json"))
AUTH_TOKEN: str | None = None
AUTH_TOKEN_EXPIRY: float = 0


def get_auth_token() -> str:
    global AUTH_TOKEN, AUTH_TOKEN_EXPIRY

    if not AUTH_TOKEN or AUTH_TOKEN_EXPIRY > time.time():
        response = requests.request(
            method="GET",
            url="https://open.spotify.com",
        )
        response.raise_for_status()

        soup = BeautifulSoup(response.content, features="lxml")
        session_tag = soup.find("script", id="session")

        data = json.loads(session_tag.get_text())
        AUTH_TOKEN = data["accessToken"]
        AUTH_TOKEN_EXPIRY = data["accessTokenExpirationTimestampMs"] / 1000

        _logger.debug("Auth token: %s", AUTH_TOKEN)

    return AUTH_TOKEN


def fetch_stats(*, artist_id: str) -> dict:
    auth_token = get_auth_token()
    response = requests.request(
        method="GET",
        url="https://api-partner.spotify.com/pathfinder/v1/query",
        params={
            "operationName": "queryArtistOverview",
            "variables": json.dumps({"uri": f"spotify:artist:{artist_id}", "locale": "", "includePrerelease": True}),
            "extensions": json.dumps({"persistedQuery": {"version": 1, "sha256Hash": "6a533f1185ff9c36e60f11c05827dc22d5d28e913e9161782cd9696584e80712"}}),
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
        }
    )
    response.raise_for_status()

    try:
        return response.json()["data"]["artistUnion"]["stats"]
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

    with open(file_path, "w") as f:
        f.write(json.dumps(data, indent=2, sort_keys=True))


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
