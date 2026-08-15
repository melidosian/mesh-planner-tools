# Manual verification checklist

Automated coverage (`npm test`) checks the LOS/Fresnel/curvature math and
the elevation-sampling math in isolation. This checklist covers everything
that needs a running app and real DEM data.

## Local dev server

```sh
npm install
npm run dev
```

Vite's dev server serves `public/` with HTTP range support, which matches
how GitHub Pages behaves once deployed — this is the right place to test
DEM reads before deploying.

## Functional checks

- [ ] Click the map to add a repeater; fill in name + antenna height; confirm
      it appears as a marker and in the repeater list.
- [ ] Add a second repeater a few km away over visibly flat terrain. Select
      both (click markers or list entries) and run "Analyze line-of-sight" —
      expect **Clear**.
- [ ] Add two repeaters straddling a known hill (e.g. either side of Rib
      Mountain, ~44.92°N -89.70°W) with modest antenna heights (a few
      meters) — expect **Obstructed**, with the reported "highest point"
      landing near the hill's actual summit.
- [ ] Confirm the elevation chart shows terrain, the LOS line, and the 60%
      Fresnel clearance floor, and that they visually match the
      clear/obstructed verdict.
- [ ] Drag a repeater marker to a new location and re-run analysis — result
      should update.
- [ ] Place a repeater outside Wisconsin (e.g. Chicago) — marker should
      render in the "no DEM coverage" style and analysis should show a clear
      coverage error, not crash.
- [ ] Export repeaters to JSON, reload the page (confirms localStorage
      persistence), then import the exported file into a fresh browser
      profile/incognito window and confirm the repeater list matches.

## Network behavior (validates the "no full-tile downloads" design goal)

- [ ] Open DevTools → Network tab, filter to `.tif`. Run one LOS analysis.
      Confirm requests show status **206 Partial Content** with small
      transfer sizes (KBs, not the multi-MB full tile), and that at most a
      few requests fire (one per DEM tile the path crosses).

## After first GitHub Pages deploy

- [ ] `curl -r 0-1023 https://<user>.github.io/mesh-planner-tools/dem/tiles/<id>.tif -o /dev/null -D -`
      and confirm a `206` status with a `Content-Range` header, proving
      range requests work against the live host, not just local dev.
- [ ] Repeat the functional checks above against the deployed URL.

## Ground-truth sanity check (user follow-up)

The DEM pipeline's own landmark spot-checks (`scripts/dem_pipeline/04_verify.py`)
confirm the elevation data itself is correct against known WI high points.
That doesn't guarantee real-world RF link outcomes match — antenna
patterns, foliage, buildings, and non-bare-earth obstructions aren't
modeled. If you have 2-3 mesh links you know work and 1-2 you know are
terrain-blocked, plug them in and compare against this tool's verdict as
the final real-world check.
