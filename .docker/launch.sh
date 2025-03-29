#!/bin/bash
set -e

DOCKER_SRC="/opt/holo-spotify-stats"

groupadd -g "$GID" holo-spotify-stats \
&& useradd holo-spotify-stats -u "$UID" -g "$GID" -m -s /bin/bash \
&& cd "$DOCKER_SRC" \
&& sudo -u holo-spotify-stats python cron.py
