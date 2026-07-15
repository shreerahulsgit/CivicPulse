"""
Fetch GCC (Greater Chennai Corporation) boundary from Overpass API
and save as a GeoJSON file in the frontend/public folder.
"""
import json, urllib.request, os

QUERY = """
[out:json][timeout:60];
relation["name"="Chennai Corporation"]["boundary"="administrative"];
out geom;
"""

URL = "https://overpass-api.de/api/interpreter"

req = urllib.request.Request(
    URL,
    data=QUERY.encode(),
    headers={"User-Agent": "CivicPulse/1.0", "Content-Type": "application/x-www-form-urlencoded"},
    method="POST",
)

print("Fetching GCC boundary from Overpass API...")
with urllib.request.urlopen(req, timeout=60) as r:
    data = json.loads(r.read())

elements = data.get("elements", [])
print(f"Got {len(elements)} elements")

# Find the relation element
relation = next((e for e in elements if e.get("type") == "relation"), None)
if not relation:
    raise ValueError("No relation found")

print("Relation ID:", relation.get("id"))

# Extract outer way geometries and stitch them together
outer_ways = [m for m in relation.get("members", []) if m.get("role") == "outer" and m.get("type") == "way"]
print(f"Outer ways: {len(outer_ways)}")

# Build coordinate ring by stitching ways
def stitch_ways(ways):
    """Stitch disconnected ways into a single ring."""
    # Convert each way's geometry to list of [lon, lat] 
    segments = []
    for w in ways:
        geom = w.get("geometry", [])
        pts = [[g["lon"], g["lat"]] for g in geom]
        if pts:
            segments.append(pts)
    
    if not segments:
        return []
    
    # Greedy stitch
    ring = segments.pop(0)
    max_iters = len(segments) * 10
    iters = 0
    while segments and iters < max_iters:
        iters += 1
        last = ring[-1]
        best_idx = None
        best_reversed = False
        for i, seg in enumerate(segments):
            if abs(seg[0][0] - last[0]) < 0.0002 and abs(seg[0][1] - last[1]) < 0.0002:
                best_idx = i; best_reversed = False; break
            if abs(seg[-1][0] - last[0]) < 0.0002 and abs(seg[-1][1] - last[1]) < 0.0002:
                best_idx = i; best_reversed = True; break
        if best_idx is not None:
            seg = segments.pop(best_idx)
            if best_reversed:
                seg = list(reversed(seg))
            ring.extend(seg[1:])
        else:
            # Can't stitch further — append remaining as-is
            for s in segments:
                ring.extend(s)
            break
    
    # Close ring
    if ring[0] != ring[-1]:
        ring.append(ring[0])
    return ring

ring = stitch_ways(outer_ways)
print(f"Ring points: {len(ring)}")

geojson = {
    "type": "Feature",
    "properties": {
        "name": "Greater Chennai Corporation",
        "osm_id": relation.get("id"),
        "admin_level": relation.get("tags", {}).get("admin_level"),
    },
    "geometry": {
        "type": "Polygon",
        "coordinates": [ring]
    }
}

out_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "gcc_boundary.geojson")
out_path = os.path.normpath(out_path)

with open(out_path, "w", encoding="utf-8") as f:
    json.dump(geojson, f, separators=(",", ":"))

print(f"Saved to: {out_path}")
print(f"File size: {os.path.getsize(out_path):,} bytes")
