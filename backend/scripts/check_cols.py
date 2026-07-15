import sys; sys.path.insert(0, ".")
from app.database.connection import engine
from sqlalchemy import text

with engine.connect() as conn:
    for pattern in ["%resolution%", "%verdict%", "%auto_close%"]:
        result = conn.execute(text(f"SHOW COLUMNS FROM complaints LIKE '{pattern}'"))
        for c in result.fetchall():
            print(c[0], "-", c[1])
print("Done")
