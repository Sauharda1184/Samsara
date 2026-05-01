# Samsara Backend

FastAPI + PostgreSQL/PostGIS backend for the Samsara geospatial healthcare discovery app.

## Prerequisites

- Python 3.12+
- [uv](https://docs.astral.sh/uv/)
- PostgreSQL 14+ with PostGIS extension

## Setup

```bash
cd backend

# Install dependencies
uv sync

# Copy and edit environment variables
cp .env.example .env
```

## Database Setup

```bash
# Create the database and user (run as postgres superuser)
psql -U postgres -c "CREATE USER samsara WITH PASSWORD 'samsara';"
psql -U postgres -c "CREATE DATABASE samsara OWNER samsara;"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE samsara TO samsara;"

# Run migrations (creates the facilities table + PostGIS extension)
uv run alembic upgrade head
```

## Import Hospital Data

```bash
# Import the pre-geocoded CSV into PostgreSQL
uv run python scripts/import_to_db.py
```

## Run the API Server

```bash
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs available at: http://localhost:8000/docs

## Geocoding Script (optional)

Re-geocode hospitals from scratch using Nominatim:

```bash
uv run python scripts/geocode.py
```

This overwrites `data/hospitals_geocoded.csv` and updates the cache.
Rate-limited to 1 request/second to comply with Nominatim ToS.

> **Note:** Coordinates are generated via public geocoding and must be manually verified.
