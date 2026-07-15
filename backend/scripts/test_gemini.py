"""
Test classify_complaint with gemini-flash-lite-latest.
Run from backend/ directory.
"""
import sys, os
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

os.environ["GEMINI_API_KEY"] = "AQ.Ab8RN6IjnQ66Ve02nAARoL6D0hRenboi0ISYv_nAbaR9-RTxJw"
os.environ["GEMINI_ENABLED"] = "true"
os.environ["GEMINI_MODEL"]   = "gemini-flash-lite-latest"

from app.services.gemini_service import classify_complaint

categories = [
    {"id": 1, "name": "Roads & Bridges"},
    {"id": 2, "name": "Water Supply"},
    {"id": 3, "name": "Sewage & Drainage"},
    {"id": 4, "name": "Garbage & Sanitation"},
    {"id": 5, "name": "Street Lighting"},
    {"id": 6, "name": "Parks & Recreation"},
    {"id": 7, "name": "Stray Animals"},
    {"id": 8, "name": "Noise Pollution"},
]

test_cases = [
    ("Open manhole danger", "There is an open manhole on main road with no cover. Multiple people have nearly fallen in.", 9),
    ("Streetlight not working", "The streetlight on 3rd Main Road has been off for 2 weeks.", 6),
    ("Pothole on road", "Small pothole near the school junction causing minor bumps.", 4),
    ("Garbage not collected", "Garbage has not been collected for 3 days, it is overflowing.", 5),
    ("Sewage overflow", "Sewage is overflowing onto the road, very bad smell and health risk.", 8),
]

print(f"{'Complaint':<45} {'Expected':>8} {'Got':>5} {'Category':<25} {'Conf':>5}")
print("-" * 100)
for title, desc, expected in test_cases:
    r = classify_complaint(title, desc, categories)
    match = "OK " if abs(r["priority"] - expected) <= 2 else "BAD"
    print(f"{title:<45} {expected:>8} {r['priority']:>5}  {match}  {str(r['category_name']):<25} {r['confidence']:>5.2f}")
    print(f"  Summary: {r['ai_summary']}")
    print()
