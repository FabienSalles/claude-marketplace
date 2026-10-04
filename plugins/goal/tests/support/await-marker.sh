#!/bin/sh
# usage: await-marker.sh <marker> <deadline-ms>
marker=$1
polls=$(($2 / 50))

while [ ! -e "$marker" ]; do
  if [ "$polls" -le 0 ]; then
    echo "await-marker: $marker never appeared" >&2
    exit 1
  fi
  polls=$((polls - 1))
  sleep 0.05
done
