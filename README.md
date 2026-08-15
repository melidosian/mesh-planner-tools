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

- Click the map to place any number of repeaters, each with its own RF
  config: antenna height (AGL), TX power, antenna gain, cable loss, and
  receiver sensitivity. Edit any repeater's config later from the list.
- Select two repeaters to check line-of-sight, with first Fresnel zone
  clearance (60% rule of thumb) and 4/3-earth-radius curvature/refraction
  correction, at a selectable frequency (900MHz/2.4GHz/3.6GHz/5.8GHz or
  custom).
- If obstructed, reports both the worst Fresnel-clearance violation and the
  highest terrain point along the path.
- "Find repeater site nearby" searches a corridor around the direct path
  for a high point that would give clear LOS to both ends — a candidate
  relay site, not just the highest point on the direct line.
- Estimated link budget (free-space path loss) using each repeater's own
  power/gain/cable-loss/sensitivity, computed independently in each
  direction since the two ends' equipment can differ.
- Network overview: an all-pairs table of LOS status and worst-direction
  margin across every repeater in the list, click a row to drill into its
  full map/chart detail.
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
