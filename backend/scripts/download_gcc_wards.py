"""
scripts/download_gcc_wards.py — Download GCC 200-ward boundary GeoJSON

Source: DataMeet Municipal_Spatial_Data GitHub repository
URL: https://raw.githubusercontent.com/datameet/Municipal_Spatial_Data/master/Chennai/Wards.geojson

Run:
    cd backend
    python scripts/download_gcc_wards.py
"""

import json
import os
import sys
import urllib.request
import urllib.error

# ── Config ────────────────────────────────────────────────────────────────────

GEOJSON_URL = (
    "https://raw.githubusercontent.com/datameet/Municipal_Spatial_Data/"
    "master/Chennai/Wards.geojson"
)
OUTPUT_DIR  = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "gcc_wards.geojson")


def download() -> None:
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    if os.path.exists(OUTPUT_FILE):
        print(f"[SKIP] File already exists: {OUTPUT_FILE}")
        print("       Delete it manually and re-run to force re-download.")
        return

    print(f"[INFO] Downloading GCC ward boundaries from DataMeet GitHub...")
    print(f"       URL: {GEOJSON_URL}")

    try:
        req = urllib.request.Request(GEOJSON_URL, headers={"User-Agent": "CivicPulse/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read()
    except urllib.error.URLError as exc:
        print(f"[ERROR] Download failed: {exc}")
        sys.exit(1)

    # ── Validate JSON structure ──────────────────────────────────────────────
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        print(f"[ERROR] Downloaded file is not valid JSON: {exc}")
        sys.exit(1)

    if data.get("type") != "FeatureCollection":
        print(f"[ERROR] Expected FeatureCollection, got: {data.get('type')}")
        sys.exit(1)

    features = data.get("features", [])
    print(f"[INFO] Downloaded {len(features)} ward features")

    if len(features) < 190:
        print(f"[WARN] Expected ~200 wards, got only {len(features)}. Data may be incomplete.")

    # ── Check for ward_no property ───────────────────────────────────────────
    sample = features[0] if features else {}
    props = sample.get("properties", {})
    # DataMeet files may use different property names
    ward_key = None
    for candidate in ["ward_no", "Ward_No", "WARD_NO", "ward_number", "Ward_Number", "FID", "OBJECTID"]:
        if candidate in props:
            ward_key = candidate
            break

    if ward_key:
        print(f"[INFO] Ward number property found: '{ward_key}'")
        # Show a few samples
        samples = [f.get("properties", {}).get(ward_key) for f in features[:5]]
        print(f"       Sample values: {samples}")
    else:
        print(f"[WARN] No obvious ward_no property found. Available properties: {list(props.keys())}")
        print("       The ingest script will need to detect the correct property name.")

    # ── Save ─────────────────────────────────────────────────────────────────
    with open(OUTPUT_FILE, "wb") as f:
        f.write(raw)

    size_mb = len(raw) / (1024 * 1024)
    print(f"[OK] Saved to: {OUTPUT_FILE} ({size_mb:.1f} MB)")


if __name__ == "__main__":
    download()
