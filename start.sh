#!/usr/bin/env bash
# Sniper Journal launcher for macOS and Linux
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Get the LTS version from https://nodejs.org, then run this again."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "First run: installing components. This takes a few minutes."
  npm install
fi

if [ ! -f .next/BUILD_ID ]; then
  echo "Preparing the app..."
  npm run build
fi

echo "Starting at http://localhost:3000 — your journal is saved in the data folder next to this file."
(sleep 3 && (command -v open >/dev/null && open http://localhost:3000 || xdg-open http://localhost:3000 >/dev/null 2>&1)) &
npm run start
