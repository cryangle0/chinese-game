import { buildRankRows, RANK_NAME_POOL } from '../assets/scripts/shared/config/RankNamePool';

describe('RankNamePool reading feedback 0720', () => {
  it('has 100+ names', () => {
    expect(RANK_NAME_POOL.length).toBeGreaterThanOrEqual(100);
  });

  it.each([
    [0, [100, 20, 0], 3],
    [20, [100, 20, 0], 2],
    [40, [100, 40, 20], 2],
    [60, [100, 60, 40], 2],
    [80, [100, 80, 60], 2],
    [100, [100, 80, 60], 1],
  ])('builds the legal score ladder for player score %i', (playerScore, scores, rank) => {
    const rows = buildRankRows(playerScore);
    expect(rows.map((row) => row.score)).toEqual(scores);
    expect(rows.map((row) => row.rank)).toEqual([1, 2, 3]);
    expect(rows.find((row) => row.isPlayer)).toMatchObject({
      rank, name: '我', score: playerScore,
    });
  });
});
