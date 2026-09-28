#!/bin/sh
set -e

# Run migrations (compiled data-source, no tsx — production mode).
# Look up the typeorm CLI in both the root node_modules (hoist) and backend/node_modules.
CLI="/app/node_modules/typeorm/cli.js"
[ -f "$CLI" ] || CLI="/app/backend/node_modules/typeorm/cli.js"

if [ -f dist/config/data-source.js ]; then
  echo "→ Running migrations..."
  node "$CLI" migration:run -d dist/config/data-source.js
else
  echo "→ data-source not found, migrations skipped."
fi

echo "→ Starting application..."
exec "$@"
