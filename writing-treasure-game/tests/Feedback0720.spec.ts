import { matchSpokenOption } from '../assets/scripts/services/SpeechOptionMatcher';
import { buildRankRows, RANK_NAME_POOL } from '../assets/scripts/shared/config/RankNamePool';

describe('SpeechOptionMatcher feedback 0720', () => {
  const opts = ['神态', '语言', '心理'];

  it.each([
    ['A', 0],
    ['选B', 1],
    ['C选项', 2],
    ['神态', 0],
    ['语言', 1],
    ['A神态', 0],
    ['B语言', 1],
    ['答案是C心理', 2],
  ])('matches %s → %i', (transcript, index) => {
    expect(matchSpokenOption(transcript, opts)).toBe(index);
  });
});

describe('RankNamePool feedback 0720', () => {
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

  it('varies NPC names across runs', () => {
    const signatures = new Set(
      Array.from({ length: 30 }, () => buildRankRows(60).map((r) => r.name).join('|')),
    );
    expect(signatures.size).toBeGreaterThan(3);
  });

  it.each([
    [0, [500, 100, 0], 3],
    [20, [500, 20, 0], 2],
    [455, [500, 455, 435], 2],
    [460, [500, 460, 440], 2],
    [500, [500, 400, 300], 1],
  ])('builds the 500-point campaign ladder for player score %i', (
    playerScore,
    scores,
    rank,
  ) => {
    const rows = buildRankRows(playerScore, 500);
    expect(rows.map((row) => row.score)).toEqual(scores);
    expect(rows.find((row) => row.isPlayer)).toMatchObject({
      rank, name: '我', score: playerScore,
    });
  });
});
