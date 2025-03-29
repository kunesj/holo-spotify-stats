#!/bin/bash
set -e

DOCKER_SRC="/opt/holo-spotify-stats"

cd "$DOCKER_SRC" && python cron.py
