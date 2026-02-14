#!/bin/sh
set -e

# Wait for Postgres to be ready
echo "Waiting for Postgres..."
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
  if python -c "import os, psycopg2; psycopg2.connect(os.environ.get('DATABASE_URL', 'postgresql://nightshade:nightshade@db:5432/nightshade'))" 2>/dev/null; then
    echo "Postgres is ready."
    break
  fi
  if [ "$i" = "20" ]; then
    echo "Postgres did not become ready in time."
    exit 1
  fi
  sleep 1
done

# Run migrations (single process, before any worker)
echo "Running migrations..."
python -m flask db upgrade

# Start Gunicorn (replace shell so it gets PID 1)
# Use /tmp for pid to avoid control server error when /app is a mounted volume
echo "Starting Gunicorn..."
exec gunicorn -b 0.0.0.0:5000 -w 2 --pid /tmp/gunicorn.pid run:app
