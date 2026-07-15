import sys; sys.path.insert(0,'.')
from app.database.connection import engine
from sqlalchemy import text
with engine.begin() as conn:
    try:
        conn.execute(text("ALTER TABLE complaint_escalations ADD COLUMN trigger_type VARCHAR(10) NOT NULL DEFAULT 'auto'"))
        print("Added trigger_type column OK")
    except Exception as e:
        print("Error:", str(e)[:200])
