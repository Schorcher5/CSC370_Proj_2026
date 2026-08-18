#!/bin/bash
set -euo pipefail

# Runs every folder under mysql/ in the order the actual FK/object
# dependencies require -- proven by hand against a real database while
# building demography_api: schemas (tables) -> views (need the tables)
# -> triggers (attach to the tables) -> auth (grants need the views to
# exist first) -> transactions (the stored procedures call things the
# triggers and grants both touch).
#
# load_mock_data.sql is deliberately NOT run here -- it requires CSVs
# to already be present in the container and isn't something you want
# firing unconditionally on every fresh init.
for dir in schemas views triggers auth transactions; do
  for f in /mysql-src/"$dir"/*.sql; do
    [ -e "$f" ] || continue
    echo "[init] running $f"
    mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" < "$f"
  done
done

