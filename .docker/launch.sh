#!/bin/bash
set -e

# home was created by root, so the ownership must be changed
chown "$GID:$UID" /home/host/

groupadd --force -g "$GID" host
useradd host -u "$UID" -g "$GID" -s /bin/bash --home /home/host/ || true

cd /home/host/holo-spotify-stats && sudo -u host python cron.py



