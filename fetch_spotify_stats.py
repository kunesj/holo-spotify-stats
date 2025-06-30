#!/usr/bin/env python3

import argparse
import base64
import datetime
import glob
import hashlib
import json
import logging
import os
import re
import time
import uuid

import pyotp
import requests

_logger = logging.getLogger(__name__)
DIR_PATH = os.path.abspath(os.path.dirname(__file__))
STATS_DIR_REL_PATH = "./spotify_stats"
STATS_DIR_PATH = os.path.abspath(os.path.join(DIR_PATH, STATS_DIR_REL_PATH))
AUTH_TOKEN: str | None = None
AUTH_TOKEN_EXPIRY: float = 0
SECRETS: list[dict] | None = None
SECRETS_EXPIRY: float = 0


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
            # print(response.content)
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


def spotify_decode_secret(raw_secret: list[int]) -> str:
    """
    Raw secret can be found in assets.
    {
      "validUntil":"2025-07-02T12:00:00.000Z",
      "secrets":[
        {"secret":[37,84,32,76,87,90,87,47,13,75,48,54,44,28,19,21,22],"version":8},
        {"secret":[59,91,66,74,30,66,74,38,46,50,72,61,44,71,86,39,89],"version":7},
        {"secret":[21,24,85,46,48,35,33,8,11,63,76,12,55,77,14,7,54],"version":6}
      ]
    }

    Example input:
        [37,84,32,76,87,90,87,47,13,75,48,54,44,28,19,21,22]
    Example output:
        GQ2DSNBUGM3DIOJQHA2DQOBWGMZDQOBZGM2TGNBVG4YTANBRGMYTK
    """
    k = [(e ^ t % 33 + 9) for t, e in enumerate(raw_secret)]
    uint8_secret = [int(x) for x in "".join([str(x) for x in k]).encode("utf-8")]
    bytes_secret = bytes(uint8_secret)
    return base64.b32encode(bytes_secret).decode("ascii")


def spotify_totp(decoded_secret: str, timestamp: float) -> str:
    """
    Returns totp value used by spotify
    :param decoded_secret: output of spotify_decode_secret
    :param timestamp: current time in seconds
    """
    period = 30
    return pyotp.hotp.HOTP(
        s=decoded_secret,
        digits=6,
        digest=hashlib.sha1,
    ).at(int(timestamp / period))


def get_spotify_secrets() -> list[dict]:
    global SECRETS, SECRETS_EXPIRY

    if not SECRETS or SECRETS_EXPIRY > time.time():
        # get url of assets

        response = request_retry(
            method="GET",
            url="https://open.spotify.com",
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"
                ),
            },
        )
        response.raise_for_status()

        match = re.search(r"\"([\w/:\-\.]*/web-player\.\w*\.js)\"", response.content.decode("utf-8"))
        if not match:
            raise ValueError("Url of assets could not be found")
        assets_url = match.group(1)

        # download assets and parse the json with secrets

        response = request_retry(method="GET", url=assets_url)
        response.raise_for_status()

        match = re.search(r"\'({\"validUntil\":[^']*)\'", response.content.decode("utf-8"))
        if not match:
            raise ValueError("Could not find secrets in assets")

        data = json.loads(match.group(1))
        SECRETS = data["secrets"]
        SECRETS_EXPIRY = datetime.datetime.fromisoformat(data["validUntil"].split(".")[0]).timestamp()

    return SECRETS


def get_auth_token() -> str:
    global AUTH_TOKEN, AUTH_TOKEN_EXPIRY

    if not AUTH_TOKEN or AUTH_TOKEN_EXPIRY > time.time():
        secrets = get_spotify_secrets()
        decoded_secret = spotify_decode_secret(secrets[0]["secret"])
        version = secrets[0]["version"]

        c_time = int(time.time() * 1000)
        # s_time = c_time // 1000
        totp = totp_server = spotify_totp(decoded_secret, c_time / 1000)

        response = request_retry(
            method="GET",
            url="https://open.spotify.com/api/token",
            params={
                "reason": "init",
                "productType": "web-player",
                "totp": totp,
                "totpServer": totp_server,
                "totpVer": version,
            },
            headers={
                "accept": "*/*",
                "accept-language": "en-US,en;q=0.9",
                "dnt": "1",
                "priority": "u=1, i",
                "referer": "https://open.spotify.com/",
                # 'sec-ch-ua': '"Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134"',
                # 'sec-ch-ua-mobile': '?0',
                # 'sec-ch-ua-platform': '"Linux"',
                # 'sec-fetch-dest': 'empty',
                # 'sec-fetch-mode': 'cors',
                # 'sec-fetch-site': 'same-origin',
                # 'sentry-trace': ,
                # 'user-agent': ('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 '
                # '(KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'),
            },
        )

        data = response.json()
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

        stats.pop("worldRank", None)
        stats.pop("topCities", None)

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
        {
            **data,
            "generations": [NoIndent(v) for v in data["generations"]],
            "stats": {k: NoIndent(v) for k, v in data["stats"].items()},
        },
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

    for file_path in glob.glob(os.path.join(STATS_DIR_PATH, "**/*.json"), recursive=True):
        update_stats_file(file_path=file_path, force=args.force)

    _logger.info("Done")


if __name__ == "__main__":
    main()
