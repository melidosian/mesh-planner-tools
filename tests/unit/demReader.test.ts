import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('geotiff', () => ({
  fromUrl: vi.fn(),
}));

vi.mock('../../src/elevation/demIndex', () => ({
  findTile: vi.fn(),
  findTilesForBbox: vi.fn(),
}));

import { fromUrl } from 'geotiff';
import { findTilesForBbox } from '../../src/elevation/demIndex';
import { sampleElevationGrid } from '../../src/elevation/demReader';

function makeFakeGeotiff() {
  const band = new Float64Array(100 * 100).fill(10);
  return {
    getImage: vi.fn().mockResolvedValue({
      getWidth: () => 100,
      getHeight: () => 100,
      getGDALNoData: () => -9999,
      readRasters: vi.fn().mockResolvedValue([band]),
    }),
  };
}

describe('openTile caching (via sampleElevationGrid)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not permanently poison a tile after one failed fetch', async () => {
    const tile = { id: 'poison-test-tile', file: 'poison-test-tile.tif', bbox: [-89, 44, -88, 45] as const };
    (findTilesForBbox as Mock).mockResolvedValue([tile]);
    (fromUrl as Mock).mockRejectedValueOnce(new Error('network fail'));

    await expect(sampleElevationGrid([...tile.bbox], 5000)).rejects.toThrow('network fail');
    expect(fromUrl).toHaveBeenCalledTimes(1);

    // Network recovers -- a retry should get a fresh attempt, not the same
    // dead promise. This is the regression check for the cache-poisoning bug.
    (fromUrl as Mock).mockResolvedValueOnce(makeFakeGeotiff());

    await expect(sampleElevationGrid([...tile.bbox], 5000)).resolves.toBeDefined();
    expect(fromUrl).toHaveBeenCalledTimes(2);
  });

  it('still caches a successful open and does not re-fetch (no regression to the happy path)', async () => {
    const tile = { id: 'happy-path-tile', file: 'happy-path-tile.tif', bbox: [-89, 44, -88, 45] as const };
    (findTilesForBbox as Mock).mockResolvedValue([tile]);
    (fromUrl as Mock).mockResolvedValueOnce(makeFakeGeotiff());

    await sampleElevationGrid([...tile.bbox], 5000);
    expect(fromUrl).toHaveBeenCalledTimes(1);

    await sampleElevationGrid([...tile.bbox], 5000);
    expect(fromUrl).toHaveBeenCalledTimes(1);
  });
});
