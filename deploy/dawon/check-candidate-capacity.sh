#!/bin/sh
# Dedicated Dawon demo host, before starting another candidate API.
set -eu
names=$(docker ps --format '{{.Names}}')
count=$(printf '%s\n' "$names" | awk '/^review-api-r[0-9]+$/ { n++ } END { print n+0 }')
available=$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)
if [ "$count" -gt 2 ] || [ "${available:-0}" -lt 1310720 ]; then
    echo "Dawon candidate needs 1280 MiB available and at most two running versioned APIs before staging." >&2
    printf '%s\n' "$names" | awk '/^review-api-r[0-9]+$/' >&2
    exit 1
fi
