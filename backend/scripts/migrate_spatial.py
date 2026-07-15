"""
scripts/migrate_spatial.py — Create spatial tables + seed GCC zones

Creates:
  - zones table
  - zone_departments table
  - ward_geometries table (with GEOMETRY column + SPATIAL INDEX)
  - Adds zone_id column to wards and complaints

Seeds:
  - 15 GCC zones with ward ranges
  - zone_departments matrix (7 departments × 15 zones)
  - GCC jurisdiction if not exists

Run:
    cd backend
    python scripts/migrate_spatial.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database.session import SessionLocal

db = SessionLocal()

# ══════════════════════════════════════════════════════════════════════════════
# DDL — Create tables and add columns
# ══════════════════════════════════════════════════════════════════════════════

DDL_STATEMENTS = [
    # ── zones table ──────────────────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS zones (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        jurisdiction_id INT NOT NULL,
        zone_number     INT NOT NULL,
        zone_name       VARCHAR(100) NOT NULL,
        CONSTRAINT fk_zones_jurisdiction FOREIGN KEY (jurisdiction_id)
            REFERENCES jurisdictions(id) ON DELETE CASCADE,
        UNIQUE KEY uq_zone_jurisdiction (jurisdiction_id, zone_number),
        INDEX idx_zones_jurisdiction (jurisdiction_id),
        INDEX idx_zones_number (zone_number)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,

    # ── zone_departments table ───────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS zone_departments (
        id                 INT AUTO_INCREMENT PRIMARY KEY,
        zone_id            INT NOT NULL,
        department_id      INT NOT NULL,
        contact_identifier VARCHAR(300) DEFAULT NULL
            COMMENT 'Email / phone / inbox ID for this zone+department',
        contact_name       VARCHAR(200) DEFAULT NULL
            COMMENT 'Responsible person name for this zone+department',
        CONSTRAINT fk_zd_zone FOREIGN KEY (zone_id)
            REFERENCES zones(id) ON DELETE CASCADE,
        CONSTRAINT fk_zd_department FOREIGN KEY (department_id)
            REFERENCES departments(id) ON DELETE CASCADE,
        UNIQUE KEY uq_zone_department (zone_id, department_id),
        INDEX idx_zd_zone (zone_id),
        INDEX idx_zd_department (department_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,

    # ── ward_geometries table (MySQL Spatial) ────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS ward_geometries (
        ward_id      INT PRIMARY KEY,
        boundary     GEOMETRY NOT NULL /*!80003 SRID 4326 */,
        centroid_lat DOUBLE DEFAULT NULL
            COMMENT 'Precomputed centroid latitude',
        centroid_lng DOUBLE DEFAULT NULL
            COMMENT 'Precomputed centroid longitude',
        CONSTRAINT fk_wg_ward FOREIGN KEY (ward_id)
            REFERENCES wards(id) ON DELETE CASCADE,
        SPATIAL INDEX idx_wg_boundary (boundary)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,
]

# Columns to add (ALTER TABLE — safe to re-run, uses IF NOT EXISTS pattern)
ALTER_STATEMENTS = [
    # Add zone_id to wards
    (
        "wards", "zone_id",
        "ALTER TABLE wards ADD COLUMN zone_id INT DEFAULT NULL "
        "COMMENT 'FK to zones table', "
        "ADD INDEX idx_wards_zone_id (zone_id), "
        "ADD CONSTRAINT fk_wards_zone FOREIGN KEY (zone_id) "
        "REFERENCES zones(id) ON DELETE SET NULL"
    ),
    # Add zone_id to complaints
    (
        "complaints", "zone_id",
        "ALTER TABLE complaints ADD COLUMN zone_id INT DEFAULT NULL "
        "COMMENT 'Zone resolved from ward', "
        "ADD INDEX idx_complaints_zone_id (zone_id), "
        "ADD CONSTRAINT fk_complaints_zone FOREIGN KEY (zone_id) "
        "REFERENCES zones(id) ON DELETE SET NULL"
    ),
]


def column_exists(table: str, column: str) -> bool:
    """Check if a column already exists in a table."""
    result = db.execute(text(
        "SELECT COUNT(*) FROM information_schema.columns "
        "WHERE table_schema = DATABASE() "
        "AND table_name = :table AND column_name = :column"
    ), {"table": table, "column": column})
    return result.scalar() > 0


def run_ddl():
    """Create tables."""
    for stmt in DDL_STATEMENTS:
        try:
            db.execute(text(stmt))
            db.commit()
            # Extract table name from CREATE TABLE statement
            name = stmt.strip().split("(")[0].split()[-1]
            print(f"[OK] Table: {name}")
        except Exception as e:
            db.rollback()
            if "already exists" in str(e).lower():
                print(f"[SKIP] Table already exists")
            else:
                print(f"[ERROR] {e}")

    for table, column, stmt in ALTER_STATEMENTS:
        if column_exists(table, column):
            print(f"[SKIP] {table}.{column} already exists")
            continue
        try:
            db.execute(text(stmt))
            db.commit()
            print(f"[OK] Added {table}.{column}")
        except Exception as e:
            db.rollback()
            print(f"[ERROR] ALTER {table}: {e}")


# ══════════════════════════════════════════════════════════════════════════════
# Seed — GCC jurisdiction, 15 zones, zone_departments matrix
# ══════════════════════════════════════════════════════════════════════════════

GCC_ZONES = [
    (1,  "Thiruvottiyur"),
    (2,  "Manali"),
    (3,  "Madhavaram"),
    (4,  "Tondiarpet"),
    (5,  "Royapuram"),
    (6,  "Thiru-Vi-Ka Nagar"),
    (7,  "Ambattur"),
    (8,  "Anna Nagar"),
    (9,  "Teynampet"),
    (10, "Kodambakkam"),
    (11, "Valasaravakkam"),
    (12, "Alandur"),
    (13, "Adyar"),
    (14, "Perungudi"),
    (15, "Sholinganallur"),
]

# Ward → Zone mapping (ward_no → zone_no)
WARD_ZONE_MAP: dict[int, int] = {}
_zone_ward_ranges = {
    1:  range(1, 15),       # 1–14
    2:  range(15, 22),      # 15–21
    3:  range(22, 34),      # 22–33
    4:  range(34, 49),      # 34–48
    5:  range(49, 64),      # 49–63
    6:  range(64, 79),      # 64–78
    7:  range(79, 94),      # 79–93
    8:  range(94, 109),     # 94–108
    9:  range(109, 127),    # 109–126
    10: range(127, 143),    # 127–142
    11: range(143, 156),    # 143–155
    12: range(156, 168),    # 156–167
    13: range(170, 183),    # 170–182
    14: list(range(168, 170)) + list(range(183, 192)),  # 168,169,183–191
    15: range(192, 201),    # 192–200
}
for zone_no, wards in _zone_ward_ranges.items():
    for w in wards:
        WARD_ZONE_MAP[w] = zone_no

# Departments that should exist for GCC routing
DEPARTMENTS = [
    "Roads & Infrastructure",
    "Water Supply",
    "Electricity & Street Lights",
    "Sanitation & Waste Management",
    "Public Safety",
    "Noise & Pollution Control",
    "General Administration",
]


def seed_gcc():
    """Seed GCC jurisdiction, zones, and zone_departments."""

    # ── Ensure GCC jurisdiction exists ────────────────────────────────────────
    result = db.execute(text(
        "SELECT id FROM jurisdictions WHERE name = 'Greater Chennai Corporation'"
    ))
    row = result.first()
    if row:
        gcc_id = row[0]
        print(f"[OK] GCC jurisdiction exists: id={gcc_id}")
    else:
        db.execute(text(
            "INSERT INTO jurisdictions (name, type) "
            "VALUES ('Greater Chennai Corporation', 'corporation')"
        ))
        db.commit()
        result = db.execute(text(
            "SELECT id FROM jurisdictions WHERE name = 'Greater Chennai Corporation'"
        ))
        gcc_id = result.scalar()
        print(f"[OK] Created GCC jurisdiction: id={gcc_id}")

    # ── Seed 15 zones ────────────────────────────────────────────────────────
    for zone_no, zone_name in GCC_ZONES:
        result = db.execute(text(
            "SELECT id FROM zones "
            "WHERE jurisdiction_id = :jid AND zone_number = :zn"
        ), {"jid": gcc_id, "zn": zone_no})
        if result.first():
            continue
        db.execute(text(
            "INSERT INTO zones (jurisdiction_id, zone_number, zone_name) "
            "VALUES (:jid, :zn, :zname)"
        ), {"jid": gcc_id, "zn": zone_no, "zname": zone_name})
    db.commit()
    print(f"[OK] Seeded {len(GCC_ZONES)} GCC zones")

    # ── Ensure departments exist ─────────────────────────────────────────────
    for dept_name in DEPARTMENTS:
        result = db.execute(text(
            "SELECT id FROM departments WHERE name = :name"
        ), {"name": dept_name})
        if not result.first():
            db.execute(text(
                "INSERT INTO departments (name) VALUES (:name)"
            ), {"name": dept_name})
    db.commit()
    print(f"[OK] Ensured {len(DEPARTMENTS)} departments exist")

    # ── Seed zone_departments matrix ─────────────────────────────────────────
    zones = db.execute(text(
        "SELECT id, zone_number, zone_name FROM zones WHERE jurisdiction_id = :jid"
    ), {"jid": gcc_id}).fetchall()
    depts = db.execute(text("SELECT id, name FROM departments")).fetchall()

    inserted = 0
    for zone_row in zones:
        zone_id, zone_no, zone_name = zone_row
        for dept_row in depts:
            dept_id, dept_name = dept_row
            # Check if already exists
            exists = db.execute(text(
                "SELECT 1 FROM zone_departments "
                "WHERE zone_id = :zid AND department_id = :did"
            ), {"zid": zone_id, "did": dept_id}).first()
            if exists:
                continue
            # Generate placeholder contact
            zone_slug = zone_name.lower().replace(" ", "-").replace(".", "")
            dept_slug = dept_name.lower().replace(" & ", "-").replace(" ", "-")
            contact = f"zone{zone_no}-{dept_slug}@gcc.gov.in"
            db.execute(text(
                "INSERT INTO zone_departments (zone_id, department_id, contact_identifier) "
                "VALUES (:zid, :did, :contact)"
            ), {"zid": zone_id, "did": dept_id, "contact": contact})
            inserted += 1
    db.commit()
    print(f"[OK] Seeded {inserted} zone_department entries ({len(zones)} zones × {len(depts)} departments)")


# ══════════════════════════════════════════════════════════════════════════════
# Main
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("=" * 60)
    print("CivicPulse — Spatial Schema Migration")
    print("=" * 60)

    print("\n-- Step 1: Create tables + columns --")
    run_ddl()

    print("\n-- Step 2: Seed GCC zones + departments --")
    seed_gcc()

    db.close()
    print("\n[DONE] Migration complete!")
