import sys
sys.path.insert(0, '.')
from app.database.session import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    # Drop old varchar column if it was added before
    result = db.execute(text("SHOW COLUMNS FROM users LIKE 'zone_id'")).fetchone()
    if result:
        col_type = result[1]
        if 'varchar' in col_type.lower():
            print(f'Dropping wrong-type zone_id ({col_type})...')
            db.execute(text("ALTER TABLE users DROP COLUMN zone_id"))
            db.commit()
        else:
            print(f'zone_id already exists with type {col_type} - skipping')
            db.close()
            exit(0)

    # Add correct INT column with FK
    db.execute(text("ALTER TABLE users ADD COLUMN zone_id INT NULL COMMENT 'Zonal officer scope'"))
    db.execute(text("ALTER TABLE users ADD INDEX idx_users_zone_id (zone_id)"))
    db.execute(text("ALTER TABLE users ADD CONSTRAINT fk_users_zone_id FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE SET NULL"))
    db.commit()
    print('OK: zone_id INT column added with FK to zones.id')
except Exception as e:
    db.rollback()
    print('ERROR:', e)
finally:
    db.close()
