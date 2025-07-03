#!/bin/bash
set -e

# home was created by root, so the ownership must be changed
chown "$GID:$UID" /home/host/

groupadd --force -g "$GID" host
useradd host -u "$UID" -g "$GID" -s /bin/bash --home /home/host/ || true

# install the playwright browser for the current user
sudo -u host playwright install --with-deps chromium-headless-shell

cd /home/host/holo-spotify-stats && sudo -u host python cron.py
