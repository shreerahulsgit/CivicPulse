"""
scripts/migrate_resolution_feedback.py

Adds resolution + citizen feedback columns/tables to support:
  - Officer marks complaint as pending_verification (with photo + note)
  - Citizen accepts or rejects the resolution
  - Citizen leaves a star rating (1-5) after acceptance
  - Auto-close after 5 days if citizen doesn't respond
"""
import sys; sys.path.insert(0, ".")
from app.database.connection import engine
from sqlalchemy import text

steps = [
    # 1. Add pending_verification to the status enum
    (
        "Add pending_verification to complaint status enum",
        """
        ALTER TABLE complaints
        MODIFY COLUMN status ENUM(
            'submitted',
            'under_review',
            'in_progress',
            'pending_verification',
            'resolved',
            'rejected'
        ) NOT NULL DEFAULT 'submitted';
        """,
    ),

    # 2. Add resolution + verdict columns to complaints
    (
        "Add resolution + verdict columns to complaints",
        """
        ALTER TABLE complaints
        ADD COLUMN resolution_note      TEXT          NULL            AFTER sla_deadline,
        ADD COLUMN resolution_photo_url VARCHAR(500)  NULL            AFTER resolution_note,
        ADD COLUMN resolution_photo_id  VARCHAR(255)  NULL            AFTER resolution_photo_url,
        ADD COLUMN auto_close_at        DATETIME      NULL            AFTER resolution_photo_id,
        ADD COLUMN citizen_verdict      VARCHAR(20)   NULL            AFTER auto_close_at,
        ADD COLUMN citizen_verdict_at   DATETIME      NULL            AFTER citizen_verdict;
        """,
    ),

    # 3. Create complaint_feedback table
    (
        "Create complaint_feedback table",
        """
        CREATE TABLE IF NOT EXISTS complaint_feedback (
          id            VARCHAR(36)  NOT NULL PRIMARY KEY,
          complaint_id  VARCHAR(36)  NOT NULL,
          user_id       VARCHAR(36)  NOT NULL,
          rating        TINYINT      NOT NULL COMMENT '1-5 stars',
          comment       TEXT         NULL,
          created_at    DATETIME(6)  NOT NULL DEFAULT NOW(6),
          UNIQUE KEY uq_complaint (complaint_id),
          INDEX idx_user (user_id),
          CONSTRAINT fk_feedback_complaint
            FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
          CONSTRAINT fk_feedback_user
            FOREIGN KEY (user_id)      REFERENCES users(id)      ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """,
    ),
]

with engine.begin() as conn:
    for label, sql in steps:
        print(f"Running: {label}...", end=" ")
        conn.execute(text(sql))
        print("OK")

print("\n✅ Migration complete.")
