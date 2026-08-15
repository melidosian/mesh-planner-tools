"""Enumerates USGS 3DEP 1-arc-second tile IDs intersecting the Wisconsin bbox.

USGS 1x1-degree tiles are named by their NW (upper-left) corner, e.g.
`n43w089` covers latitude [42, 43] and longitude [-89, -88]. This does a
simple bbox filter (no precise state-boundary clip) per the project plan --
that's a reasonable simplification since a personal LOS planning tool
doesn't need to shave off the handful of edge tiles that only marginally
overlap Wisconsin.
"""

import math

# Wisconsin's approximate bounding box.
WI_MIN_LAT = 42.4
WI_MAX_LAT = 47.1
WI_MIN_LON = -92.9
WI_MAX_LON = -86.2


def tile_ids_for_bbox(min_lat: float, max_lat: float, min_lon: float, max_lon: float) -> list[str]:
    # Tile n{lat_deg}w{lon_deg} covers [lat_deg-1, lat_deg] x [-lon_deg, -lon_deg+1].
    lat_start = math.floor(min_lat) + 1
    lat_end = math.ceil(max_lat)
    lon_start = math.ceil(-max_lon)
    lon_end = math.floor(-min_lon) + 1

    ids = []
    for lat_deg in range(lat_start, lat_end + 1):
        for lon_deg in range(lon_start, lon_end + 1):
            ids.append(f"n{lat_deg:02d}w{lon_deg:03d}")
    return ids


def wi_tile_ids() -> list[str]:
    return tile_ids_for_bbox(WI_MIN_LAT, WI_MAX_LAT, WI_MIN_LON, WI_MAX_LON)


if __name__ == "__main__":
    ids = wi_tile_ids()
    print(f"{len(ids)} tiles intersect the Wisconsin bbox:")
    for tile_id in ids:
        print(tile_id)
