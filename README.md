# mesh-planner-tools

A personal-use, fully client-side web app for planning line-of-sight (LOS)
mesh radio repeater links across Wisconsin. Add repeaters on a map, check
whether two of them have LOS to each other, and if not, find the highest
terrain point between them as a candidate relay site.

No backend, no runtime elevation API — terrain data is a locally-hosted
USGS 3DEP 1 arc-second (~30m) DEM covering Wisconsin, preprocessed once
into small Cloud-Optimized GeoTIFF tiles and read directly in the browser
via HTTP range requests. See `scripts/dem_pipeline/README.md` for how that
data was built.

## Features

- Click the map to place repeaters (name + antenna height AGL).
- Select two repeaters to check line-of-sight, with first Fresnel zone
  clearance (60% rule of thumb) and 4/3-earth-radius curvature/refraction
  correction, at a selectable frequency (900MHz/2.4GHz/3.6GHz/5.8GHz or
  custom).
- If obstructed, reports both the worst Fresnel-clearance violation and the
  highest terrain point along the path.
- Elevation profile chart (terrain, LOS line, Fresnel clearance floor).
- Repeater list persists to `localStorage`; JSON export/import for backup.

## Development

```sh
npm install
npm run dev      # local dev server at http://localhost:5173
npm test         # unit tests (vitest)
npm run build    # production build to dist/
```

Deploys to GitHub Pages automatically on push to `main` via
`.github/workflows/deploy.yml`.

See `docs/verification.md` for a manual end-to-end verification checklist.
