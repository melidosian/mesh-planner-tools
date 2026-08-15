# DEM preprocessing pipeline

One-time, developer-run scripts that turn USGS 3DEP 1 arc-second (~30m)
elevation data into small Cloud-Optimized GeoTIFF (COG) tiles for
`public/dem/tiles/`, which the app reads directly in the browser via HTTP
range requests. This is **not** part of the deployed app — it's run once
(and re-run only if you want to change coverage/resolution), and its output
is committed to the repo.

Source data comes from The National Map's public `prd-tnm` S3 bucket —
static bulk files, not a live API, no API key required.

## Setup

```sh
cd scripts/dem_pipeline
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

## Run

```sh
python3 01_download_3dep.py   # downloads ~42 raw tiles into raw/ (~1-2GB, gitignored)
python3 02_build_cog.py       # converts each to a COG in public/dem/tiles/ (~6-15MB each)
python3 03_build_manifest.py  # writes public/dem/manifest.json
python3 04_verify.py          # size/COG/landmark sanity checks
```

`wi_tile_ids.py` can be run standalone to print the tile IDs intersecting
Wisconsin's bounding box (42.4-47.1N, 92.9-86.2W); `01_download_3dep.py`
uses it directly and skips any tile the S3 bucket doesn't have (e.g. tiles
entirely over open water).

Re-running any step skips work that's already done (existing raw downloads
or COG outputs aren't rebuilt), so it's safe to re-run after a partial
failure.

## Adjusting coverage or resolution later

- To extend coverage beyond Wisconsin, edit the bbox constants in
  `wi_tile_ids.py` and re-run the pipeline (only the newly-in-range tiles
  will download).
- To switch to a different USGS 3DEP product (e.g. 1/3 arc-second ~10m),
  change `BASE_URL`/`NODATA_VALUE` handling in `01_download_3dep.py` and
  note that per-tile COG size will grow roughly 9x — you'll likely need
  Git LFS at that resolution (see the project plan for tradeoffs).
