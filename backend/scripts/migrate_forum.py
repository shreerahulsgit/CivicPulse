import sys; sys.path.insert(0, ".")
from app.database.connection import engine
from sqlalchemy import text

sql = """
CREATE TABLE IF NOT EXISTS zone_forum_messages (
  id             VARCHAR(36)   NOT NULL PRIMARY KEY,
  zone_id        INT           NOT NULL,
  user_id        VARCHAR(36)   NOT NULL,
  content        TEXT          NOT NULL,
  complaint_ref  VARCHAR(36)   NULL DEFAULT NULL,
  is_pinned      TINYINT(1)    NOT NULL DEFAULT 0,
  is_deleted     TINYINT(1)    NOT NULL DEFAULT 0,
  created_at     DATETIME(6)   NOT NULL DEFAULT NOW(6),
  INDEX idx_zone_created (zone_id, created_at DESC),
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
"""

with engine.begin() as conn:
    conn.execute(text(sql))
    print("zone_forum_messages table created OK")
