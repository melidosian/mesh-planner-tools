"""Verifies the built DEM dataset: file sizes, COG structure, and known-
elevation landmark spot-checks (catches CRS/units/nodata bugs end-to-end).
"""

import json
import sys
from pathlib import Path

import numpy as np
import rasterio
from rio_cogeo.cogeo import cog_validate

TILES_DIR = Path(__file__).parent.parent.parent / "public" / "dem" / "tiles"
MANIFEST_PATH = TILES_DIR.parent / "manifest.json"
MAX_FILE_SIZE_MB = 90

# (name, lat, lon, published elevation in meters, tolerance in meters, mode)
# Coordinates verified against web search (Wikipedia/PeakVisor), not hand-
# recalled. mode="peak" takes the max within the search window (for summits,
# which can be a narrow feature a bit off from a named point's coordinates);
# mode="flat" takes the window's median (for a body of water, where "max"
# would just pick up the nearest shoreline pixel instead of confirming the
# water surface itself carries a real elevation, not a nodata sentinel).
LANDMARKS = [
    ("Timms Hill (WI high point)", 45.4509, -90.1954, 594.8, 20, "peak"),
    ("Rib Mountain", 44.9208, -89.6952, 592, 20, "peak"),
    ("Lake Michigan (offshore of Milwaukee)", 43.05, -87.83, 176, 20, "flat"),
]
LANDMARK_SEARCH_RADIUS_PX = 17  # ~510m at 30m resolution


def check_sizes(tile_files: list[Path]) -> bool:
    ok = True
    for path in tile_files:
        size_mb = path.stat().st_size / 1e6
        if size_mb > MAX_FILE_SIZE_MB:
            print(f"  FAIL: {path.name} is {size_mb:.1f} MB (over {MAX_FILE_SIZE_MB} MB budget)")
            ok = False
    if ok:
        total_mb = sum(p.stat().st_size for p in tile_files) / 1e6
        print(f"  OK: all {len(tile_files)} tiles under {MAX_FILE_SIZE_MB} MB (total {total_mb:.0f} MB)")
    return ok


def check_cog_structure(tile_files: list[Path]) -> bool:
    ok = True
    for path in tile_files:
        is_valid, errors, warnings = cog_validate(str(path))
        if not is_valid:
            print(f"  FAIL: {path.name} is not a valid COG: {errors}")
            ok = False
        elif warnings:
            print(f"  WARN: {path.name}: {warnings}")
    if ok:
        print(f"  OK: all {len(tile_files)} tiles are valid COGs")
    return ok


def find_tile_for_point(manifest: dict, lat: float, lon: float) -> dict | None:
    for tile in manifest["tiles"]:
        min_lon, min_lat, max_lon, max_lat = tile["bbox"]
        if min_lon <= lon <= max_lon and min_lat <= lat <= max_lat:
            return tile
    return None


def check_landmarks(manifest: dict) -> bool:
    ok = True
    for name, lat, lon, expected_m, tolerance_m, mode in LANDMARKS:
        tile = find_tile_for_point(manifest, lat, lon)
        if tile is None:
            print(f"  FAIL: {name}: no tile covers {lat},{lon}")
            ok = False
            continue

        with rasterio.open(TILES_DIR / tile["file"]) as ds:
            row, col = ds.index(lon, lat)
            r = LANDMARK_SEARCH_RADIUS_PX
            window = ((max(row - r, 0), row + r + 1), (max(col - r, 0), col + r + 1))
            block = ds.read(1, window=window)
            nodata = ds.nodata
            valid = block[block != nodata] if nodata is not None else block
            if valid.size == 0:
                print(f"  FAIL: {name}: no valid pixels near {lat},{lon}")
                ok = False
                continue
            actual_m = float(np.max(valid)) if mode == "peak" else float(np.median(valid))

        diff = abs(actual_m - expected_m)
        status = "OK" if diff <= tolerance_m else "FAIL"
        if status == "FAIL":
            ok = False
        print(f"  {status}: {name}: DEM={actual_m:.1f}m, published={expected_m}m, diff={diff:.1f}m")
    return ok


def check_global_max(manifest: dict) -> None:
    best = (-1e9, None, None, None)
    for tile in manifest["tiles"]:
        path = TILES_DIR / tile["file"]
        with rasterio.open(path) as ds:
            data = ds.read(1)
            nodata = ds.nodata
            masked = np.where(data == nodata, -1e9, data) if nodata is not None else data
            idx = np.unravel_index(np.argmax(masked), masked.shape)
            value = float(masked[idx])
            if value > best[0]:
                lon, lat = ds.xy(idx[0], idx[1])
                best = (value, lat, lon, tile["id"])

    value, lat, lon, tile_id = best
    print(f"  Global max elevation in dataset: {value:.1f}m at {lat:.4f},{lon:.4f} (tile {tile_id})")
    print("  Expect this near Timms Hill (45.4509, -90.1954, ~594.8m) -- WI's highest point.")


def main() -> None:
    tile_files = sorted(TILES_DIR.glob("*.tif"))
    if not tile_files:
        print(f"No COG tiles found in {TILES_DIR}.", file=sys.stderr)
        sys.exit(1)
    if not MANIFEST_PATH.exists():
        print(f"No manifest found at {MANIFEST_PATH}. Run 03_build_manifest.py first.", file=sys.stderr)
        sys.exit(1)

    manifest = json.loads(MANIFEST_PATH.read_text())

    print("1. File size budget")
    sizes_ok = check_sizes(tile_files)

    print("2. COG structure validation")
    cog_ok = check_cog_structure(tile_files)

    print("3. Landmark elevation spot-checks")
    landmarks_ok = check_landmarks(manifest)

    print("4. Dataset-wide global max (sanity check)")
    check_global_max(manifest)

    if sizes_ok and cog_ok and landmarks_ok:
        print("\nAll checks passed.")
    else:
        print("\nSome checks FAILED -- see above.", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
