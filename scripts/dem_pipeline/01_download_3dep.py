"""Downloads raw USGS 3DEP 1-arc-second GeoTIFF tiles for the Wisconsin bbox.

Source: The National Map's public "prd-tnm" S3 bucket (static file
distribution, unauthenticated, no API key -- not a live elevation API).
Downloads are skipped for tiles that don't exist (e.g. tiles entirely over
open water with no coverage) or that are already present.
"""

import sys
from pathlib import Path

import requests

from wi_tile_ids import wi_tile_ids

RAW_DIR = Path(__file__).parent / "raw"
BASE_URL = "https://prd-tnm.s3.amazonaws.com/StagedProducts/Elevation/1/TIFF/current"


def tile_url(tile_id: str) -> str:
    return f"{BASE_URL}/{tile_id}/USGS_1_{tile_id}.tif"


def download_tile(tile_id: str) -> bool:
    dest = RAW_DIR / f"USGS_1_{tile_id}.tif"
    if dest.exists() and dest.stat().st_size > 0:
        print(f"  {tile_id}: already downloaded, skipping")
        return True

    url = tile_url(tile_id)
    resp = requests.get(url, stream=True, timeout=60)
    if resp.status_code == 404:
        print(f"  {tile_id}: no coverage (404), skipping")
        return False
    resp.raise_for_status()

    tmp = dest.with_suffix(".tif.part")
    total = int(resp.headers.get("content-length", 0))
    written = 0
    with open(tmp, "wb") as f:
        for chunk in resp.iter_content(chunk_size=1024 * 1024):
            f.write(chunk)
            written += len(chunk)
    tmp.rename(dest)
    print(f"  {tile_id}: downloaded {written / 1e6:.1f} MB" + (f" of {total / 1e6:.1f} MB" if total else ""))
    return True


def main() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    tiles = wi_tile_ids()
    print(f"Downloading {len(tiles)} candidate tiles into {RAW_DIR}")
    ok = 0
    for tile_id in tiles:
        try:
            if download_tile(tile_id):
                ok += 1
        except requests.RequestException as exc:
            print(f"  {tile_id}: FAILED ({exc})", file=sys.stderr)
    print(f"Done. {ok}/{len(tiles)} tiles available.")


if __name__ == "__main__":
    main()
