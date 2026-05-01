#!/usr/bin/env python3
"""
Import hospitals_geocoded.csv into the PostgreSQL/PostGIS database.

Usage:
    uv run python scripts/import_to_db.py [--csv PATH]

Requires the facilities table to already exist (run Alembic migrations first).
"""

import argparse
import csv
import os
import sys
import uuid
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
DEFAULT_CSV = DATA_DIR / "hospitals_geocoded.csv"

# ── Classification helpers ────────────────────────────────────────────────────

SPECIALTY_MAP = {
    "Cancer":      ["cancer", "oncol"],
    "Cardiac":     ["heart", "cardio", "cardiac", "vascular"],
    "Dialysis":    ["dialysis"],
    "Kidney":      ["kidney", "renal", "nephro"],
    "Orthopedic":  ["orthopedic", "ortho"],
    "Maternity":   ["maternity", "women"],
    "Pediatric":   ["children", "pediatric", "kanti"],
    "Neurology":   ["neuro", "brain"],
    "Trauma":      ["trauma"],
    "Transplant":  ["transplant"],
    "Spinal":      ["spinal"],
    "Eye":         ["eye", "ophthalm"],
}


def get_specialties(name: str) -> str:
    n = name.lower()
    found = [s for s, kws in SPECIALTY_MAP.items() if any(kw in n for kw in kws)]
    return ",".join(found) if found else "General"


def classify_type(name: str) -> str:
    n = name.lower()
    if any(x in n for x in [
        "medical college", "teaching hospital", "academy of health",
        "institute of health sciences", "institute of medical",
    ]):
        return "Teaching"
    if any(x in n for x in [
        "zonal hospital", "district hospital", "regional hospital",
        "sub regional", "provincial hospital", "army hospital",
        "police hospital", "national trauma", "national kidney",
        "national academy", "bir hospital", "koshi hospital",
        "mechi hospital", "narayani", "shahid gangalal",
        "shahid dharma", "paropakar", "kanti children",
        "manmohan cardiothoracic", "spinal injury",
    ]):
        return "Government"
    if any(x in n for x in ["community", "cooperative"]):
        return "Community"
    if any(x in n for x in [
        "cancer hospital", "cancer center", "dialysis center",
        "kidney center", "heart center", "spinal injury",
        "trauma center", "eye hospital",
    ]):
        return "Specialty"
    return "Private"


# ── Main ─────────────────────────────────────────────────────────────────────

def get_db_url() -> str:
    return os.getenv("DATABASE_URL", "postgresql://samsara:samsara@localhost:5432/samsara")


def main():
    parser = argparse.ArgumentParser(description="Import hospitals into PostgreSQL")
    parser.add_argument("--csv", type=Path, default=DEFAULT_CSV, help="Path to geocoded CSV")
    args = parser.parse_args()

    if not args.csv.exists():
        print(f"ERROR: CSV file not found: {args.csv}")
        sys.exit(1)

    try:
        import psycopg2
    except ImportError:
        print("ERROR: psycopg2 not installed. Run: uv sync")
        sys.exit(1)

    db_url = get_db_url()
    print(f"Connecting to: {db_url}")

    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    rows = list(csv.DictReader(args.csv.open(encoding="utf-8")))
    print(f"Importing {len(rows)} hospitals …")

    inserted = skipped = 0

    for row in rows:
        name = row["name"].strip()
        province = row["province"].strip()
        country = row.get("country", "Nepal").strip()
        try:
            lat = float(row["latitude"])
            lon = float(row["longitude"])
        except ValueError:
            print(f"  SKIP (bad coords): {name}")
            skipped += 1
            continue

        verification_status = row.get("verification_status", "unverified").strip()
        coordinate_source = row.get("coordinate_source", "OSM").strip()
        hospital_type = classify_type(name)
        specialties = get_specialties(name)
        facility_id = str(uuid.uuid4())

        cur.execute(
            """
            INSERT INTO facilities
                (id, name, province, country, location,
                 verification_status, coordinate_source,
                 hospital_type, specialties)
            VALUES (
                %s, %s, %s, %s,
                ST_SetSRID(ST_MakePoint(%s, %s), 4326),
                %s, %s, %s, %s
            )
            ON CONFLICT DO NOTHING
            """,
            (
                facility_id, name, province, country, lon, lat,
                verification_status, coordinate_source,
                hospital_type, specialties,
            ),
        )
        inserted += 1

    conn.commit()
    cur.close()
    conn.close()

    print(f"\nDone. {inserted} inserted, {skipped} skipped.")


if __name__ == "__main__":
    main()
