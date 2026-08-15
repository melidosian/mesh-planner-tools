"""Converts raw USGS 3DEP GeoTIFFs into small Cloud-Optimized GeoTIFFs.

Each output tile is Int16 elevation (meters), DEFLATE-compressed with a
horizontal predictor, tiled internally (512x512 blocks) with overviews, and
left in its native geographic CRS (EPSG:4326/NAD83) so the browser can do a
direct affine lon/lat -> pixel transform with no reprojection. This keeps
every tile comfortably under GitHub's 100MB per-file limit, so the DEM
ships as plain git files (no Git LFS) and reads efficiently via HTTP range
requests once hosted on GitHub Pages.
"""

import sys
from pathlib import Path

from rio_cogeo.cogeo import cog_translate
from rio_cogeo.profiles import cog_profiles

RAW_DIR = Path(__file__).parent / "raw"
OUT_DIR = Path(__file__).parent.parent.parent / "public" / "dem" / "tiles"

NODATA_VALUE = -9999


def build_cog(src_path: Path, dest_path: Path) -> None:
    dst_profile = cog_profiles.get("deflate")
    dst_profile.update(
        {
            "predictor": 2,
            "blockxsize": 512,
            "blockysize": 512,
        }
    )
    cog_translate(
        str(src_path),
        str(dest_path),
        dst_profile,
        dtype="int16",
        nodata=NODATA_VALUE,
        overview_resampling="bilinear",
        web_optimized=False,
        quiet=True,
    )


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    raw_tiles = sorted(RAW_DIR.glob("USGS_1_*.tif"))
    if not raw_tiles:
        print(f"No raw tiles found in {RAW_DIR}. Run 01_download_3dep.py first.", file=sys.stderr)
        sys.exit(1)

    print(f"Building {len(raw_tiles)} COG tiles into {OUT_DIR}")
    for src in raw_tiles:
        tile_id = src.stem.replace("USGS_1_", "")
        dest = OUT_DIR / f"{tile_id}.tif"
        if dest.exists():
            print(f"  {tile_id}: COG already exists, skipping")
            continue
        build_cog(src, dest)
        size_mb = dest.stat().st_size / 1e6
        print(f"  {tile_id}: {size_mb:.1f} MB")


if __name__ == "__main__":
    main()
