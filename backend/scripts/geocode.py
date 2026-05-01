#!/usr/bin/env python3
"""
Geocode hospitals from raw_hospitals.csv using the Nominatim API.

Usage:
    uv run python scripts/geocode.py

Output: ../../data/hospitals_geocoded.csv
Cache:  ../../data/geocode_cache.json
"""

import csv
import json
import time
from pathlib import Path

import httpx

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
RAW_CSV = DATA_DIR / "raw_hospitals.csv"
OUT_CSV = DATA_DIR / "hospitals_geocoded.csv"
CACHE_FILE = DATA_DIR / "geocode_cache.json"

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
HEADERS = {"User-Agent": "Samsara/0.5 (sauhardameher@gmail.com)"}
RATE_LIMIT_SECONDS = 1.1  # slightly above 1 req/s to respect Nominatim ToS


def load_cache() -> dict:
    if CACHE_FILE.exists():
        return json.loads(CACHE_FILE.read_text())
    return {}


def save_cache(cache: dict) -> None:
    CACHE_FILE.write_text(json.dumps(cache, indent=2, ensure_ascii=False))


def geocode_hospital(name: str, province: str, cache: dict) -> dict | None:
    cache_key = f"{name}|{province}|Nepal"

    if cache_key in cache:
        print(f"  [cache] {name}")
        return cache[cache_key]

    query = f"{name}, {province}, Nepal"
    print(f"  [API]   {query}")

    try:
        resp = httpx.get(
            NOMINATIM_URL,
            params={"q": query, "format": "json", "limit": 1, "countrycodes": "np"},
            headers=HEADERS,
            timeout=10,
        )
        resp.raise_for_status()
        results = resp.json()
    except Exception as exc:
        print(f"    ERROR: {exc}")
        return None
    finally:
        time.sleep(RATE_LIMIT_SECONDS)

    if not results:
        # Retry with a broader query (just province + Nepal)
        try:
            resp = httpx.get(
                NOMINATIM_URL,
                params={"q": f"{province}, Nepal", "format": "json", "limit": 1, "countrycodes": "np"},
                headers=HEADERS,
                timeout=10,
            )
            resp.raise_for_status()
            results = resp.json()
        except Exception:
            pass
        finally:
            time.sleep(RATE_LIMIT_SECONDS)

    if not results:
        print(f"    WARNING: no results for '{query}'")
        return None

    hit = results[0]
    entry = {
        "latitude": float(hit["lat"]),
        "longitude": float(hit["lon"]),
        "verification_status": "unverified",
        "coordinate_source": "OSM",
    }
    cache[cache_key] = entry
    return entry


def main():
    cache = load_cache()
    rows = list(csv.DictReader(RAW_CSV.open()))
    print(f"Geocoding {len(rows)} hospitals …\n")

    results = []
    for row in rows:
        name = row["name"].strip()
        province = row["province"].strip()
        geo = geocode_hospital(name, province, cache)
        if geo:
            results.append(
                {
                    "name": name,
                    "province": province,
                    "country": "Nepal",
                    "latitude": geo["latitude"],
                    "longitude": geo["longitude"],
                    "verification_status": geo["verification_status"],
                    "coordinate_source": geo["coordinate_source"],
                }
            )
        else:
            print(f"  SKIPPED: {name} (no coordinates found)")

        save_cache(cache)

    with OUT_CSV.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["name", "province", "country", "latitude", "longitude",
                        "verification_status", "coordinate_source"],
        )
        writer.writeheader()
        writer.writerows(results)

    print(f"\nDone. {len(results)}/{len(rows)} hospitals written to {OUT_CSV}")
    print("NOTE: All coordinates are marked 'unverified' — please review manually.")


if __name__ == "__main__":
    main()
