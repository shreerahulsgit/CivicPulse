"""Migration: add routing columns to complaints table."""
import app.models
from app.database.connection import engine
from sqlalchemy import text

COLUMNS = [
    ("ward_id",             "INT NULL, ADD INDEX ix_complaints_ward_id (ward_id)"),
    ("jurisdiction_id",     "INT NULL, ADD INDEX ix_complaints_jurisdiction_id (jurisdiction_id)"),
    ("department_id",       "INT NULL, ADD INDEX ix_complaints_department_id (department_id)"),
    ("assigned_officer_id", "VARCHAR(36) NULL, ADD INDEX ix_complaints_officer_id (assigned_officer_id)"),
]

with engine.connect() as conn:
    for col_name, col_def in COLUMNS:
        result = conn.execute(text(
            "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS "
            f"WHERE TABLE_SCHEMA='civicpulse' AND TABLE_NAME='complaints' AND COLUMN_NAME='{col_name}'"
        ))
        if result.fetchone():
            print(f"  {col_name}: already exists")
        else:
            conn.execute(text(f"ALTER TABLE complaints ADD COLUMN {col_name} {col_def}"))
            conn.commit()
            print(f"  {col_name}: added")

# Also add FK constraints (advisory only — won't break if depts/wards don't exist)
try:
    with engine.connect() as conn:
        fks = [
            ("fk_complaints_ward",         "ward_id",             "wards(id) ON DELETE SET NULL"),
            ("fk_complaints_jurisdiction",  "jurisdiction_id",     "jurisdictions(id) ON DELETE SET NULL"),
            ("fk_complaints_department",    "department_id",       "departments(id) ON DELETE SET NULL"),
            ("fk_complaints_officer",       "assigned_officer_id", "users(id) ON DELETE SET NULL"),
        ]
        for fk_name, col, ref in fks:
            # check if FK already exists
            result = conn.execute(text(
                "SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS "
                f"WHERE TABLE_SCHEMA='civicpulse' AND TABLE_NAME='complaints' AND CONSTRAINT_NAME='{fk_name}'"
            ))
            if not result.fetchone():
                conn.execute(text(
                    f"ALTER TABLE complaints ADD CONSTRAINT {fk_name} FOREIGN KEY ({col}) REFERENCES {ref}"
                ))
                conn.commit()
                print(f"  FK {fk_name}: added")
            else:
                print(f"  FK {fk_name}: already exists")
except Exception as e:
    print(f"  FK warning (non-fatal): {e}")

print("\nMigration complete.")
