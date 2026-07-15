# CivicPulse

**AI-Powered Smart Civic Issue Reporting, Prioritization, and Resolution Platform**

Final Year Project and Research Work

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React.js |
| Backend | FastAPI, Python 3.12 |
| Database | MySQL 8, SQLAlchemy 2.0, Alembic |
| AI/ML | BERT, Sentence-BERT, YOLOv8 |
| Maps | Leaflet / OpenStreetMap |
| Auth | JWT (python-jose), bcrypt |
| Validation | Pydantic v2, email-validator |
| Infra | Docker |

---

## Project Structure

```
backend/
├── .env                                # Environment config (DB, JWT)
├── requirements.txt                    # Frozen pip dependencies
│
└── app/
    ├── main.py                         # FastAPI app entry point
    │
    ├── database/
    │   ├── connection.py               # SQLAlchemy engine + pooling
    │   ├── session.py                  # SessionLocal + get_db() dependency
    │   └── base.py                     # DeclarativeBase for all models
    │
    ├── models/
    │   ├── __init__.py                 # Central model registry
    │   ├── user.py                     # User model
    │   ├── category.py                 # Complaint category lookup
    │   ├── location.py                 # GPS coordinates + address
    │   ├── complaint.py                # Core complaint model
    │   ├── complaint_image.py          # Image attachments
    │   ├── complaint_status_history.py # Status change audit trail
    │   ├── department.py               # Municipal department
    │   ├── jurisdiction.py             # Corporation / Municipality
    │   ├── ward.py                     # Ward within jurisdiction
    │   └── officer_assignment.py       # Officer → department + ward mapping
    │
    ├── schemas/
    │   ├── user.py                     # User Pydantic schemas
    │   ├── complaint.py               # Complaint Pydantic schemas
    │   ├── administration.py          # Dept, Jurisdiction, Ward, Officer schemas
    │   ├── upload.py                  # Cloudinary upload/delete response schemas
    │   ├── officer.py                 # Progress, ResolutionImage, Timeline schemas
    │   └── analytics.py               # Dashboard, Department, Officer, Ward, Trend schemas
    │
    ├── services/
    │   ├── auth_service.py             # Password hashing, JWT, user queries
    │   ├── complaint_service.py        # Complaint CRUD + status state machine + routing
    │   ├── administration_service.py   # Dept, Ward, Officer CRUD
    │   ├── cloudinary_service.py       # Cloudinary upload, delete, validation
    │   ├── geospatial_service.py       # Ward polygon detection (Shapely + Haversine)
    │   ├── routing_service.py          # Category→dept mapping + officer assignment
    │   ├── officer_service.py          # Accept/resolve, progress, images, timeline
    │   └── analytics_service.py        # Aggregated SQL analytics queries
    │
    ├── models/
    │   ├── ... (existing)
    │   ├── complaint_progress_update.py    # Officer text progress updates
    │   └── complaint_resolution_image.py   # Before/after Cloudinary images
    │
    ├── api/
    │   ├── deps.py                     # get_current_user, require_admin, require_officer
    │   ├── auth.py                     # /auth/* routes
    │   ├── complaints.py              # /complaints/* routes
    │   ├── uploads.py                 # /uploads/* routes (Cloudinary)
    │   ├── officer.py                 # /officer/complaints/* + /complaints/{id}/timeline
    │   ├── administration.py          # /departments, /jurisdictions, /wards, /officers
    │   └── analytics.py               # /analytics/* (admin only)
    │
    ├── tests/
    │   └── test_routing.py            # 14 unit tests for geospatial + routing engine
    │
    └── utils/                          # (reserved for future utilities)

frontend/                               # (React.js — not yet built)
ai_models/                              # (BERT, SBERT, YOLOv8 — not yet built)
```

---

## Modules Completed

### 1. Database Layer

- SQLAlchemy 2.0 engine with production-grade connection pooling
- `pool_pre_ping=True` — auto-reconnects stale MySQL connections
- `pool_recycle=1800` — prevents MySQL from closing idle connections
- `get_db()` dependency with commit / rollback / close lifecycle

### 2. User & Authentication Module

**User Table:**

| Column | Type | Notes |
|--------|------|-------|
| id | CHAR(36) | UUID primary key |
| full_name | VARCHAR(100) | Required |
| email | VARCHAR(255) | Unique, indexed |
| phone | VARCHAR(20) | Optional |
| password_hash | VARCHAR(255) | bcrypt hash |
| role | ENUM | citizen / admin / super_admin |
| is_active | BOOLEAN | Soft-delete flag |
| created_at | DATETIME | Auto-set |
| updated_at | DATETIME | Auto-updated |

**Auth Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /auth/login | Public | OAuth2 form-data login (Swagger compatible) |
| POST | /auth/login/json | Public | JSON body login (React / mobile) |
| POST | /auth/register | Public | Create citizen account + return JWT |
| GET | /auth/me | Bearer | Return current user's profile |

### 3. Complaint Management Module

**Database Tables:** categories, locations, complaints, complaint_images, complaint_status_history

**Complaint Table:**

| Column | Type | Notes |
|--------|------|-------|
| id | CHAR(36) | UUID primary key |
| user_id | FK → users | CASCADE delete |
| category_id | FK → categories | RESTRICT delete |
| location_id | FK → locations | CASCADE delete |
| title | VARCHAR(200) | Required |
| description | TEXT | Required |
| status | ENUM | submitted / under_review / in_progress / resolved / rejected |
| severity_score | FLOAT | Nullable — AI populated |
| ai_category | VARCHAR(100) | Nullable — BERT classifier |
| duplicate_group_id | CHAR(36) | Nullable — Sentence-BERT clustering |
| created_at | DATETIME | Auto-set |
| updated_at | DATETIME | Auto-updated |

**Status Lifecycle:**
```
submitted → under_review → in_progress → resolved
    ↓            ↓              ↓
 rejected     rejected       rejected
```

**Complaint Endpoints:**

| Method | Path | Auth | Access |
|--------|------|------|--------|
| POST | /complaints | JWT | Any authenticated user |
| GET | /complaints | Public | Filterable by status & category, paginated |
| GET | /complaints/my | JWT | Current user's complaints |
| GET | /complaints/{id} | JWT | Owner or admin only |
| PATCH | /complaints/{id}/status | JWT | Admin only (enforced state machine) |

**Seeded Categories:** Pothole, Water Supply, Electricity, Sanitation, Public Safety, Noise, Other

---

### 4. Municipal Administration Module

**Database Tables:**

#### `departments`

| Column | Type | Notes |
|--------|------|-------|
| id | INT | Auto-increment PK |
| name | VARCHAR(150) | Unique, indexed |
| description | VARCHAR(500) | Optional |

#### `jurisdictions`

| Column | Type | Notes |
|--------|------|-------|
| id | INT | Auto-increment PK |
| name | VARCHAR(200) | Unique, indexed |
| type | ENUM | corporation / municipality |

#### `wards`

| Column | Type | Notes |
|--------|------|-------|
| id | INT | Auto-increment PK |
| jurisdiction_id | FK → jurisdictions | CASCADE delete |
| ward_number | VARCHAR(20) | e.g. "W-14" |
| zone_number | VARCHAR(20) | Optional, e.g. "Z-3" |
| ward_name | VARCHAR(200) | Human-readable name |
| polygon_geojson | TEXT | Nullable — GeoJSON boundary for maps |

#### `officer_assignments`

| Column | Type | Notes |
|--------|------|-------|
| id | CHAR(36) | UUID PK |
| user_id | FK → users | CASCADE delete |
| department_id | FK → departments | CASCADE delete |
| ward_id | FK → wards | CASCADE delete |
| assigned_at | DATETIME | Auto-set |

**Administration Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /departments | Admin | Create a department |
| GET | /departments | Public | List all departments |
| POST | /jurisdictions | Admin | Create a jurisdiction |
| GET | /jurisdictions | Public | List all jurisdictions |
| POST | /wards | Admin | Create a ward |
| GET | /wards | Public | List wards (filterable by jurisdiction) |
| POST | /officers/assign | Admin | Assign officer to dept + ward |
| GET | /officers | Public | List officer assignments |

---

### 5. Cloudinary Media Management Module

**Environment Variables:**

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

**Features:**

- Upload single/multiple images to Cloudinary
- Delete images by public_id
- MIME type validation (JPG, JPEG, PNG, WEBP only)
- Max file size: 10 MB
- Auto-generated unique filenames
- Auto-resize cap at 1920×1920
- Quality optimization (auto:good)
- `attach_images_to_complaint()` helper persists `secure_url` + `public_id` to `complaint_images` table

**Updated `complaint_images` table:**

| Column | Type | Notes |
|--------|------|-------|
| id | CHAR(36) | UUID PK |
| complaint_id | FK → complaints | CASCADE delete |
| image_url | VARCHAR(500) | Cloudinary secure_url |
| public_id | VARCHAR(255) | Cloudinary public_id (for deletion) |
| created_at | DATETIME | Auto-set |

**Upload Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /uploads/image | JWT | Upload single image |
| POST | /uploads/images | JWT | Upload up to 10 images |
| DELETE | /uploads/{public_id} | Admin | Delete image from Cloudinary |

---

### 6. Geo-Spatial Routing Engine

**Dependencies:** `shapely==2.1.2`

**How it works:**

When a complaint is created, the routing engine runs automatically in the background (never blocks complaint creation):

```
GPS (lat, lng)
    │
    ├── geospatial_service.find_ward()
    │     ├── Shapely point-in-polygon against ward boundaries (GeoJSON)
    │     └── Haversine nearest-centroid fallback if no polygon matches
    │
    ├── routing_service.get_department_for_category()
    │     └── Category name → CATEGORY_DEPARTMENT_MAP → DB department
    │
    └── routing_service.assign_officer()
          ├── Exact: officer assigned to same dept + ward
          └── Overflow: officer in same dept, any ward
```

**Category → Department Mapping:**

| Category | Department |
|----------|------------|
| Pothole | Roads & Infrastructure |
| Water Supply | Water Supply |
| Electricity | Electricity & Street Lights |
| Sanitation | Sanitation & Waste Management |
| Public Safety | Public Safety |
| Noise | Noise & Pollution Control |
| Other | General Administration |

**Auto-populated Complaint fields:**

| Field | Type | Description |
|-------|------|-------------|
| ward_id | FK → wards | Auto-detected from GPS |
| jurisdiction_id | FK → jurisdictions | Derived from ward |
| department_id | FK → departments | Mapped from category |
| assigned_officer_id | FK → users | Best-fit officer |

**Test Suite:** `tests/test_routing.py` — **14/14 passing**

| Test | Coverage |
|------|----------|
| Point inside polygon | Shapely containment |
| Point outside all polygons | Falls back to nearest centroid |
| Multiple wards — correct match | Polygon discrimination |
| Haversine same point | Distance = 0 |
| Haversine known distance | Mumbai→Pune ~120 km |
| Category map completeness | All 7 categories present |
| Known category mapping | Pothole → Roads |
| Unknown category fallback | Returns default dept |
| Missing category | Returns None |
| Officer exact match | dept + ward |
| Officer overflow | dept only |
| Officer none available | Returns None |
| Full pipeline integration | All steps wired |
| Pipeline never raises | Exception-safe |

---

### 7. Officer Operations Module

**New Tables:**

#### `complaint_progress_updates`

| Column | Type | Notes |
|--------|------|-------|
| id | CHAR(36) | UUID PK |
| complaint_id | FK → complaints | CASCADE delete |
| officer_id | FK → users | CASCADE delete |
| message | TEXT | Required, min 5 chars |
| created_at | DATETIME | Auto-set |

#### `complaint_resolution_images`

| Column | Type | Notes |
|--------|------|-------|
| id | CHAR(36) | UUID PK |
| complaint_id | FK → complaints | CASCADE delete |
| uploaded_by | FK → users | SET NULL on delete |
| public_id | VARCHAR(255) | Cloudinary public_id |
| secure_url | VARCHAR(500) | Cloudinary secure_url |
| image_type | ENUM | before \| after |
| uploaded_at | DATETIME | Auto-set |

**Officer Workflow:**

```
Complaint arrives (assigned_officer_id set by routing engine)
    │
    ├─ Officer sees it in GET /officer/complaints/pending
    ├─ PATCH /officer/complaints/{id}/accept    → status: in_progress
    ├─ POST  /officer/complaints/{id}/progress   → text updates (e.g. "On site")
    ├─ POST  /officer/complaints/{id}/resolution-images  → BEFORE photos
    ├─ (do the work)
    ├─ POST  /officer/complaints/{id}/resolution-images  → AFTER photos
    └─ PATCH /officer/complaints/{id}/resolve     → status: resolved
```

**Officer Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /officer/complaints | Officer | All assigned complaints |
| GET | /officer/complaints/pending | Officer | Submitted/under_review |
| GET | /officer/complaints/in-progress | Officer | In-progress only |
| PATCH | /officer/complaints/{id}/accept | Officer | Accept → in_progress |
| PATCH | /officer/complaints/{id}/resolve | Officer | Resolve (AFTER image required) |
| POST | /officer/complaints/{id}/progress | Officer | Post text progress update |
| POST | /officer/complaints/{id}/resolution-images | Officer | Upload before/after photos |

**Citizen Endpoint:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /complaints/{id}/timeline | JWT | Full chronological event timeline |

**Business Rules:**
- Officers can only access complaints where `assigned_officer_id == their user ID`
- Accept transitions: `submitted → under_review → in_progress` (both recorded in audit trail)
- Resolve requires at least **1 AFTER image** — raises `400` otherwise
- Progress updates only allowed on `in_progress` complaints
- Timeline merges: status changes + progress updates + resolution images, sorted by time

---

### 8. Analytics Module

**Access:** Admin / Super Admin only (all endpoints protected by `require_admin`)

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | /analytics/dashboard | Platform-wide KPI snapshot |
| GET | /analytics/departments | Per-department stats |
| GET | /analytics/officers | Per-officer stats (paginated) |
| GET | /analytics/wards | Per-ward complaint counts |
| GET | /analytics/trends | Time-series data (daily/weekly/monthly) |

**Dashboard Metrics (`GET /analytics/dashboard`):**

| Metric | Description |
|--------|-------------|
| total_complaints | All complaints ever submitted |
| open_complaints | Submitted + under_review + in_progress |
| resolved_complaints | Status = resolved |
| rejected_complaints | Status = rejected |
| avg_resolution_hours | TIMESTAMPDIFF from submitted → resolved |
| active_officers | Officers with ≥1 in-progress complaint |
| total_departments | Total departments in DB |
| total_wards | Total wards in DB |
| complaints_today | Created today |
| complaints_this_week | Created in last 7 days |
| complaints_this_month | Created in last 30 days |

**Trend Analytics (`GET /analytics/trends`):**

```
?granularity=daily&days_back=30    → 30 daily data points
?granularity=weekly&days_back=90   → ~13 weekly buckets
?granularity=monthly&days_back=365 → 12 monthly buckets
```

Each data point:
```json
{ "period": "2025-06-11", "total_complaints": 12, "resolved_complaints": 8, "open_complaints": 4 }
```

**Implementation Notes:**
- All analytics queries use SQLAlchemy `func.count`, `func.sum(case(...))`, `func.avg` — no Python-level loops
- Resolution time uses MySQL `TIMESTAMPDIFF(HOUR, created_at, resolved_at)` — single SQL expression
- Trend bucketing via MySQL `DATE_FORMAT` (`%Y-%m-%d` / `%x-W%v` / `%Y-%m`)
- Department and Ward queries use `OUTER JOIN` to include rows with 0 complaints

---

### 9. AI Classification Foundation

**Status:** Architecture complete — model training pending

**New directory:**
```
ai_models/
+-- __init__.py
+-- classification/
    +-- __init__.py
    +-- labels.py          # Category registry, id2label, CONFIDENCE_THRESHOLD
    +-- model_loader.py    # Singleton HuggingFace model loader
    +-- classifier.py      # ComplaintClassifier (predict / predict_batch)
```

**New service:**
- `backend/app/services/ai_classification_service.py` — `AIClassificationService`

**Architecture:**
```
Complaint text (title + description)
    |
    v
ComplaintClassifier.predict(text)
    |
    +-- AutoTokenizer  (distilbert-base-uncased)
    +-- DistilBERT encoder
    +-- Classification head  [6 output neurons]
    +-- Softmax
    |
    v
ClassificationResult
  .label        = "Pothole"
  .confidence   = 0.934
  .is_confident = True  (>= 0.60 threshold)
    |
    v
AIClassificationService.classify_complaint()
    |
    +-- Confidence gate  (< 0.60 → keep manual category)
    +-- DB lookup  (AI label → Category.name → Category.id)
    +-- Fallback guard  (DB category not found → keep manual)
    |
    v
complaint.category_id    = AI or manual
complaint.ai_category    = raw AI label (always stored for audit)
```

**Supported Categories:**

| Index | AI Label | DB Category |
|-------|----------|-------------|
| 0 | Pothole | Pothole |
| 1 | Garbage Overflow | Sanitation |
| 2 | Water Leakage | Water Supply |
| 3 | Drainage Blockage | Sanitation |
| 4 | Streetlight Failure | Electricity |
| 5 | Road Damage | Pothole |

**Fallback Hierarchy (never breaks complaint creation):**

| Condition | Outcome |
|-----------|---------|
| `AI_MODEL_ENABLED=false` | Use manual category, `ai_category=None` |
| `transformers` not installed | Use manual category |
| Model load fails | Use manual category |
| Confidence < 0.60 | Use manual, store `ai_category` for audit |
| AI DB category not found | Use manual, log warning |
| AI confident + DB category found | Use AI category |

**Environment Variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_MODEL_ENABLED` | `false` | Enable/disable AI classification |
| `AI_MODEL_PATH` | `distilbert-base-uncased` | HuggingFace Hub ID or local path |
| `AI_DEVICE` | `cpu` | `cpu` \| `cuda` \| `mps` |

**To enable AI (after fine-tuning):**
```bash
# In .env
AI_MODEL_ENABLED=true
AI_MODEL_PATH=./ai_models/trained/complaint-classifier-v1
AI_DEVICE=cuda   # if GPU available

# Install ML dependencies
pip install transformers torch
```

---

### 10. Hybrid Duplicate Complaint Detection

**Model:** `all-MiniLM-L6-v2` (SentenceTransformers) — pretrained, 384 dims

**New files:**
```
ai_models/duplicate_detection/
├── __init__.py
├── embedding_service.py   # SBERT load, embed_text, embed_batch, JSON serialise
├── similarity_service.py  # Haversine distance, cosine similarity (vectorised)
└── duplicate_detector.py  # DuplicateDetector — 3-stage pipeline

backend/app/
├── models/complaint_embedding.py              # DB model: complaint_embeddings
└── services/duplicate_detection_service.py   # DuplicateDetectionService
```

**New DB table:**
```sql
complaint_embeddings (
  id           VARCHAR(36)  PK,
  complaint_id VARCHAR(36)  FK → complaints (CASCADE),
  embedding    TEXT         JSON-serialised float[384],
  created_at   DATETIME
)
```

**New complaint columns:**
| Column | Type | Purpose |
|--------|------|---------|
| `matched_complaint_id` | VARCHAR(36) | ID of original duplicate |
| `similarity_score` | FLOAT | Cosine similarity of best match |
| `duplicate_group_id` | VARCHAR(36) | Cluster UUID (already existed) |

**Three-Stage Pipeline:**
```
New complaint created
       |
       v
[Stage 1 — SQL Filter]
  • same ward_id
  • same category_id
  • created_at >= NOW() - 90 days
  • status NOT IN (resolved, rejected)
  • has embedding stored
  → max 200 candidates
       |
       v
[Stage 2 — Haversine Filter]
  • distance(new, candidate) <= 100 metres
  → typically < 10 candidates
       |
       v
[Stage 3 — Cosine Similarity (batch NumPy)]
  • cosine_similarity(new_vec, candidate_vec) >= 0.85
  → best match selected
       |
       v
  is_duplicate = True
  complaint.duplicate_group_id   = matched.duplicate_group_id OR new UUID
  complaint.matched_complaint_id = matched.id
  complaint.similarity_score     = 0.85–1.0
```

**Thresholds:**

| Parameter | Value |
|-----------|-------|
| Max distance | 100 metres (Haversine) |
| Min cosine similarity | 0.85 |
| Lookback window | 90 days |
| Max SQL candidates | 200 |

**Fallback (never breaks complaint creation):**

| Condition | Behaviour |
|-----------|-----------|
| `AI_MODEL_ENABLED=false` | Skip, `skipped=True` |
| `sentence-transformers` not installed | Skip |
| SBERT model load fails | Skip |
| Embedding generation fails | Skip, complaint saved without embedding |
| DB query error | Skip, log error |
| No candidates found | `is_duplicate=False` |

**To enable:**
```bash
pip install sentence-transformers
# In .env:
AI_MODEL_ENABLED=true
SBERT_MODEL_NAME=all-MiniLM-L6-v2
SBERT_DEVICE=cpu   # or cuda
```

---

### 11. Notification Engine

**New Tables:** `notifications`, `notification_preferences`

**Notification Types:**

| Type | Trigger |
|------|---------|
| `complaint_created` | Citizen submits complaint |
| `complaint_assigned` | Officer assigned (notifies citizen + officer) |
| `status_changed` | Status transitions (accept, resolve) |
| `progress_update` | Officer posts update |
| `complaint_resolved` | Complaint marked resolved |
| `duplicate_detected` | Complaint flagged as duplicate |

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | /notifications | Paginated list (newest first) |
| GET | /notifications/unread-count | Badge count |
| PATCH | /notifications/read-all | Mark all read |
| PATCH | /notifications/{id}/read | Mark single read |
| GET | /notification-preferences | Get preferences |
| PATCH | /notification-preferences | Update preferences (partial) |

**Integration Points (auto-triggered):**

| Service | Trigger | Event |
|---------|---------|-------|
| `complaint_service.create_complaint` | Always | `complaint_created` |
| `complaint_service.create_complaint` | If auto-routed officer | `complaint_assigned` |
| `complaint_service.create_complaint` | If duplicate found | `duplicate_detected` |
| `officer_service.accept_complaint` | Always | `status_changed` |
| `officer_service.resolve_complaint` | Always | `status_changed` + `complaint_resolved` |
| `officer_service.add_progress_update` | Always | `progress_update` |

**Preference behaviour:**
- Default: `email_enabled=true`, `in_app_enabled=true`
- If `in_app_enabled=false` notifications are silently skipped
- Preference row lazily created on first PATCH (not at registration)

---

### 12. Admin Control Center

**New Table:** `complaint_escalations`

**New Column:** `complaint_status_history.note` — admin audit note (VARCHAR 1000)

**Endpoints (admin-only):**

| Method | Path | Description |
|--------|------|-------------|
| PATCH | /admin/complaints/{id}/reassign | Reassign to different officer |
| PATCH | /admin/complaints/{id}/department | Override routing-engine department |
| PATCH | /admin/complaints/{id}/officer | Force-assign specific officer |
| POST | /admin/complaints/{id}/escalate | Record escalation + notify |
| GET | /admin/complaints/{id}/audit | Full chronological audit trail |
| GET | /admin/workloads/officers | Per-officer complaint load |
| GET | /admin/workloads/departments | Per-department complaint load |

**Audit Trail sources:**

| Source | Event Type |
|--------|-----------|
| `complaint_status_history` | `status_change` (includes admin notes) |
| `complaint_progress_updates` | `progress_update` |
| `complaint_escalations` | `escalation` |

**Automatic Notifications:**

| Action | Recipients |
|--------|-----------|
| Reassign | Citizen + new officer |
| Officer override | Citizen + new officer |
| Escalation | Citizen + assigned officer |

**Workload queries** use raw SQL with `TIMESTAMPDIFF(HOUR, created_at, resolved_at)` for avg resolution time and `DATE(updated_at) = CURDATE()` for resolved-today count.

---

## Bugs Fixed

| Issue | Cause | Fix |
|-------|-------|-----|
| 500 on register/login | passlib 1.7.x incompatible with bcrypt 4.x | Replaced passlib with direct bcrypt calls |
| 422 on Swagger Authorize | Swagger sends form-data but login expected JSON | /auth/login now accepts OAuth2PasswordRequestForm |
| Relationship string resolution failure | models/__init__.py didn't import all models | Created central model registry importing all models |

---


| Issue | Cause | Fix |
|-------|-------|-----|
| 500 on register/login | passlib 1.7.x incompatible with bcrypt 4.x | Replaced passlib with direct bcrypt calls |
| 422 on Swagger Authorize | Swagger sends form-data but login expected JSON | /auth/login now accepts OAuth2PasswordRequestForm |
| Relationship string resolution failure | models/__init__.py didn't import all models | Created central model registry importing all models |

---

## How to Run

```bash
# 1. Setup MySQL
mysql -u root -p
CREATE DATABASE civicpulse CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 2. Configure environment
cd backend
# Edit .env with your DATABASE_URL, SECRET_KEY, CLOUDINARY_* credentials

# 3. Install dependencies
pip install -r requirements.txt

# 4. Create tables
python -c "import app.models; from app.database.connection import engine; from app.database.base import Base; Base.metadata.create_all(engine)"

# 5. Run server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 6. Open docs
# http://localhost:8000/docs

# 7. Run tests
python -m pytest tests/ -v
```

---

## What's Left

- [ ] Alembic migrations
- [ ] React.js frontend
- [ ] AI Pipeline (BERT categorization, Sentence-BERT dedup, YOLOv8 image analysis)
- [ ] Leaflet/OpenStreetMap heatmaps
- [ ] Notifications (email/push for status changes)
- [ ] Docker containerization