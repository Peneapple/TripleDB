#!/bin/bash
set -e
cd "$(dirname "$0")"
PORT="${1:-8000}"
URL="http://localhost:${PORT}"

echo "TripleDB search-enabled local server"
echo "Site directory: $(pwd)"
echo "URL: ${URL}"
echo ""
echo "Before testing, place the three JSON files in data/ and the three CSV files in downloads/."
echo "Run 'python3 verify_release_files.py' in another Terminal window to validate them."
echo "Press Control+C here to stop the server."

(sleep 1; open "${URL}") &
python3 -m http.server "${PORT}" --bind 127.0.0.1
