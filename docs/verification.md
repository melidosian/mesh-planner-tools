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
- [ ] Add a repeater with custom TX power/antenna gain/cable loss/RX
      sensitivity; confirm the list shows a summary line matching what was
      entered. Click "Edit" on an existing repeater, change a value, save,
      and confirm the summary updates.
- [ ] Run an analysis and confirm the results panel shows an "Estimated
      link budget" section with both directions' received power and margin
      — margins should turn red when negative, green when positive.
- [ ] With 3+ repeaters, click "Compute all links" in the Network overview
      panel; confirm a row appears per unique pair with distance/status/
      worst margin, and that clicking a row re-selects that pair and
      redraws the map/chart/results for it.
- [ ] Edit or add/remove a repeater after computing the matrix; confirm the
      matrix reverts to its "Compute all links" (not-yet-computed) state
      rather than silently showing stale results.

## Relay site search

- [ ] Add repeaters at Elkhorn, WI (42.6728, -88.5403) and East Troy, WI
      (42.80, -88.40), analyze — expect **Obstructed** (this reproduces a
      known real-world blocked link). Click "Find repeater site nearby".
- [ ] Confirm it finds a candidate near Alpine Valley Resort
      (~42.736, -88.428) with both legs **Clear**, and that the map shows
      the original obstructed path plus a dashed two-leg path through a
      purple relay marker.
- [ ] Confirm "Find repeater site nearby" only appears when the direct link
      is obstructed, not when it's clear.
- [ ] Try it on a pair with no clear site nearby (e.g. two points separated
      by a wide lake or valley with nothing tall around) — confirm it
      reports "best nearby candidate, still not fully clear" rather than
      falsely claiming success, and doesn't hang or error.
- [ ] Try it with a repeater near the edge of DEM coverage — confirm
      candidates whose path would clip outside coverage are skipped rather
      than crashing the whole search.

## Network resilience (a transient DEM fetch failure shouldn't be permanent)

- [ ] In DevTools, add a request-blocking rule for one `dem/tiles/*.tif`
      request (or use Playwright/CDP route interception), then run an
      analysis so it hits the blocked tile — confirm the shown error
      includes real detail (e.g. "Failed to analyze link: ..."), not just
      "See console for details."
- [ ] Remove the block and re-run the same analysis (or "Find repeater site
      nearby") without changing anything else — confirm it now succeeds.
      Before the fix, a single failed tile fetch permanently broke that
      tile for the rest of the page session (the cached fetch promise was
      never evicted on rejection), so this specifically checks that a
      transient mobile network blip is recoverable by simply retrying.

## Mobile / narrow-viewport checks

- [ ] At a phone-width viewport (e.g. 375px), confirm the map takes the full
      width by default and the repeater panel is hidden, not squeezed in
      alongside it.
- [ ] Tap the "☰ Repeaters" button — the panel should slide in as an
      overlay with a dimmed backdrop; tapping the backdrop or "✕ Close"
      should slide it back out.
- [ ] Tap the map to add a repeater — the panel should auto-open showing
      the new-repeater form (it's otherwise hidden, so this is required for
      the flow to make sense on mobile).
- [ ] Compute the all-pairs matrix, then tap a row — the panel should
      auto-open showing that pair's result.
- [ ] Confirm no horizontal scrolling anywhere on the page, including with
      the link budget table and the network overview table (they should
      scroll horizontally within their own container if needed, not widen
      the page).

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
