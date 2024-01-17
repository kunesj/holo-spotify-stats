#!/bin/bash

# cd to script directory
cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")"

# run cron
./cron.py "$@" >> ./holo-spotify-stats.log 2>&1
