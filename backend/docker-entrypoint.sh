#!/bin/sh
set -e

# Прогон миграций (компилированный data-source, без tsx — прод-режим).
# typeorm CLI ищем и в корневом node_modules (hoist), и в backend/node_modules.
CLI="/app/node_modules/typeorm/cli.js"
[ -f "$CLI" ] || CLI="/app/backend/node_modules/typeorm/cli.js"

if [ -f dist/config/data-source.js ]; then
  echo "→ Применяю миграции..."
  node "$CLI" migration:run -d dist/config/data-source.js
else
  echo "→ data-source не найден, миграции пропущены."
fi

echo "→ Старт приложения..."
exec "$@"
