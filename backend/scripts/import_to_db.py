#!/usr/bin/env python3
"""
Import hospitals_geocoded.csv into the PostgreSQL/PostGIS database.

Usage:
    uv run python scripts/import_to_db.py [--csv PATH]

Requires the facilities table to already exist (run Alembic migrations first).
"""

import argparse
import csv
import hashlib
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


# ── Simulated operational data ────────────────────────────────────────────────

def _h(seed: str, lo: int, hi: int) -> int:
    n = int(hashlib.md5(seed.encode()).hexdigest(), 16)
    return lo + (n % (hi - lo + 1))


def simulate_hospital_data(name: str, hospital_type: str) -> dict:
    bed_range   = {"Teaching": (200, 800), "Government": (100, 400), "Specialty": (50, 200), "Community": (20, 100), "Private": (30, 250)}
    doc_range   = {"Teaching": (50, 300),  "Government": (20, 120),  "Specialty": (10, 80),  "Community": (3, 30),   "Private": (5, 80)}
    emerg_prob  = {"Teaching": 90, "Government": 85, "Specialty": 60, "Community": 40, "Private": 50}

    lo_b, hi_b  = bed_range.get(hospital_type, (30, 250))
    total_beds  = _h(f"{name}:beds", lo_b, hi_b)
    avail_beds  = _h(f"{name}:avail", max(1, total_beds // 10), max(2, total_beds * 4 // 10))

    lo_d, hi_d  = doc_range.get(hospital_type, (5, 80))
    total_docs  = _h(f"{name}:docs", lo_d, hi_d)

    emergency   = _h(f"{name}:emerg", 0, 99) < emerg_prob.get(hospital_type, 50)

    area        = _h(f"{name}:area", 1, 99)
    number      = _h(f"{name}:num", 1000000, 9999999)
    phone       = f"0{area:02d}-{number}"

    year        = _h(f"{name}:year", 1950, 2015)

    accreds     = ["None", "None", "None", "ISO 9001", "NABH", "NAMS", "JCI"]
    accreditation = accreds[_h(f"{name}:accred", 0, len(accreds) - 1)]

    return {
        "total_beds": total_beds,
        "available_beds": avail_beds,
        "total_doctors": total_docs,
        "emergency_services": emergency,
        "phone": phone,
        "established_year": year,
        "accreditation": accreditation,
    }


ALL_SERVICES = [
    "ICU", "Laboratory", "X-ray", "Blood Bank",
    "Ambulance", "Surgery", "Pharmacy", "Maternity Ward",
    "Dialysis", "CT Scan", "MRI", "Physiotherapy",
]

# Which services each type is likely to have (probability 0-100)
_SERVICE_PROB: dict[str, dict[str, int]] = {
    "ICU":            {"Teaching": 95, "Government": 85, "Specialty": 70, "Community": 20, "Private": 60},
    "Laboratory":     {"Teaching": 99, "Government": 95, "Specialty": 80, "Community": 70, "Private": 80},
    "X-ray":          {"Teaching": 99, "Government": 95, "Specialty": 75, "Community": 60, "Private": 75},
    "Blood Bank":     {"Teaching": 90, "Government": 80, "Specialty": 50, "Community": 20, "Private": 50},
    "Ambulance":      {"Teaching": 95, "Government": 90, "Specialty": 60, "Community": 70, "Private": 65},
    "Surgery":        {"Teaching": 99, "Government": 90, "Specialty": 80, "Community": 30, "Private": 70},
    "Pharmacy":       {"Teaching": 99, "Government": 95, "Specialty": 85, "Community": 80, "Private": 90},
    "Maternity Ward": {"Teaching": 85, "Government": 75, "Specialty": 30, "Community": 50, "Private": 55},
    "Dialysis":       {"Teaching": 70, "Government": 50, "Specialty": 60, "Community": 10, "Private": 30},
    "CT Scan":        {"Teaching": 85, "Government": 60, "Specialty": 50, "Community": 5,  "Private": 45},
    "MRI":            {"Teaching": 75, "Government": 45, "Specialty": 40, "Community": 2,  "Private": 35},
    "Physiotherapy":  {"Teaching": 80, "Government": 65, "Specialty": 55, "Community": 25, "Private": 50},
}


def simulate_services(name: str, hospital_type: str) -> str:
    present = [
        svc for svc in ALL_SERVICES
        if _h(f"{name}:{svc}", 0, 99) < _SERVICE_PROB[svc].get(hospital_type, 40)
    ]
    return ",".join(present)


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
        sim = simulate_hospital_data(name, hospital_type)
        services = simulate_services(name, hospital_type)
        facility_id = str(uuid.uuid4())

        cur.execute(
            """
            INSERT INTO facilities
                (id, name, province, country, location,
                 verification_status, coordinate_source,
                 hospital_type, specialties, facility_category,
                 total_beds, available_beds, total_doctors,
                 emergency_services, phone, established_year, accreditation,
                 services)
            VALUES (
                %s, %s, %s, %s,
                ST_SetSRID(ST_MakePoint(%s, %s), 4326),
                %s, %s, %s, %s, 'Hospital',
                %s, %s, %s, %s, %s, %s, %s,
                %s
            )
            ON CONFLICT DO NOTHING
            """,
            (
                facility_id, name, province, country, lon, lat,
                verification_status, coordinate_source,
                hospital_type, specialties,
                sim["total_beds"], sim["available_beds"], sim["total_doctors"],
                sim["emergency_services"], sim["phone"],
                sim["established_year"], sim["accreditation"],
                services,
            ),
        )
        inserted += 1

    conn.commit()
    cur.close()
    conn.close()

    print(f"\nDone. {inserted} inserted, {skipped} skipped.")


if __name__ == "__main__":
    main()
