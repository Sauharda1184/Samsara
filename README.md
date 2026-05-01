# Samsara v0.5 — Geospatial Healthcare Discovery

Interactive map of hospitals across Nepal, built with FastAPI + PostGIS + React + MapLibre GL JS.

> **Disclaimer:** Coordinates are generated via public geocoding (OpenStreetMap/Nominatim) and must be manually verified before any clinical or operational use.

---

## Architecture

```
Samsara/
├── backend/      FastAPI + SQLAlchemy + GeoAlchemy2 + PostgreSQL/PostGIS
├── frontend/     React + Vite + TypeScript + MapLibre GL + Tailwind CSS
├── data/
│   ├── raw_hospitals.csv         — source list
│   ├── hospitals_geocoded.csv    — lat/lon coordinates (pre-geocoded)
│   └── geocode_cache.json        — Nominatim response cache
└── README.md
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.12+ |
| [uv](https://docs.astral.sh/uv/) | latest |
| Node.js | 18+ |
| PostgreSQL | 14+ with PostGIS |

---

## 1 — Database Setup

```bash
# Connect as the postgres superuser
psql -U postgres

# Inside psql:
CREATE USER samsara WITH PASSWORD 'samsara';
CREATE DATABASE samsara OWNER samsara;
GRANT ALL PRIVILEGES ON DATABASE samsara TO samsara;
\q
```

---

## 2 — Backend

```bash
cd backend

# Install Python dependencies
uv sync

# Copy environment config
cp .env.example .env
# Edit .env if your DB credentials differ from defaults

# Run database migrations (creates facilities table + PostGIS extension)
uv run alembic upgrade head

# Import pre-geocoded hospital data
uv run python scripts/import_to_db.py

# Start the API server (port 8000)
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs → http://localhost:8000/docs

---

## 3 — Frontend

```bash
cd frontend

# Install Node dependencies
npm install

# Start the dev server (port 5173)
npm run dev
```

App → http://localhost:5173

---

## 4 — Geocoding Script (optional)

Re-geocode hospitals from scratch using Nominatim:

```bash
cd backend
uv run python scripts/geocode.py
```

- Reads `data/raw_hospitals.csv`
- Respects Nominatim rate limit (1 req/s)
- Caches results in `data/geocode_cache.json`
- Writes `data/hospitals_geocoded.csv`

After re-geocoding, re-import:

```bash
uv run python scripts/import_to_db.py
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/facilities` | All hospitals |
| GET | `/facilities/{id}` | Single hospital |
| GET | `/facilities/search?q=` | Search by name |
| GET | `/facilities/nearby?lat=&lon=&radius_km=` | Spatial proximity (PostGIS) |
| GET | `/facilities/province?name=` | Filter by province |
| GET | `/health` | Health check |

---

## Features

- **Interactive map** — MapLibre GL JS over free OpenStreetMap tiles
- **117 hospitals** plotted with real coordinates across 7 provinces
- **Search** by hospital name
- **Province filter** — narrows both sidebar list and map
- **Nearby search** — browser geolocation or manual lat/lon, adjustable radius slider
- **Distance sorted** — PostGIS `ST_Distance` via geography cast for metric accuracy
- **Verification badges** — green (verified) / yellow (unverified)
- **Linked selection** — clicking sidebar card or map marker highlights both

---

## Tech Stack

**Backend:** FastAPI · SQLAlchemy 2 · GeoAlchemy2 · PostgreSQL/PostGIS · Alembic · uv

**Frontend:** React 18 · Vite · TypeScript · MapLibre GL JS · Tailwind CSS · TanStack Query v5

---

## Data Provenance

Hospital names sourced from Nepal Ministry of Health & Population registry. Coordinates obtained via Nominatim (OpenStreetMap). All coordinates are `unverified` — cross-reference with Google Maps or MoHP GIS data before operational use.
