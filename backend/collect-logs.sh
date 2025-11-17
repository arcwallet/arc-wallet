#!/bin/bash

LOG_FILE="magic-link-log.txt"

if [ -z "$RENDER_SERVICE_ID" ]; then
  echo "RENDER_SERVICE_ID environment variable is not set."
  exit 1
fi

echo "Fetching logs for service: $RENDER_SERVICE_ID"
curl -H "Accept: text/plain" "https://api.render.com/v1/logs/$RENDER_SERVICE_ID?limit=200" > "$LOG_FILE"

if [ $? -eq 0 ]; then
  echo "Logs saved to $LOG_FILE"
else
  echo "Failed to fetch logs"
fi
