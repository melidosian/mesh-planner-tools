"""Builds public/dem/manifest.json from the bounds of each built COG tile.

The browser app loads this manifest once at startup to know which tile
file covers a given lat/lon, without having to probe every GeoTIFF.
"""

import json
from pathlib import Path

import rasterio

TILES_DIR = Path(__file__).parent.parent.parent / "public" / "dem" / "tiles"
MANIFEST_PATH = TILES_DIR.parent / "manifest.json"


def main() -> None:
    tile_files = sorted(TILES_DIR.glob("*.tif"))
    if not tile_files:
        raise SystemExit(f"No COG tiles found in {TILES_DIR}. Run 02_build_cog.py first.")

    tiles = []
    for path in tile_files:
        with rasterio.open(path) as ds:
            bounds = ds.bounds
            tiles.append(
                {
                    "id": path.stem,
                    "file": path.name,
                    "bbox": [bounds.left, bounds.bottom, bounds.right, bounds.top],
                }
            )

    manifest = {"tiles": tiles}
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2))
    print(f"Wrote {len(tiles)} tiles to {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
