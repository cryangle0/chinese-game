/** Default hotspot boxes from WritingSettlementLayout + action buttons. */
window.WRITING_SETTLEMENT_HOTSPOT_DEFAULTS = (() => {
  const colors = {
    title: '#f0c14b',
    character: '#7ad0ff',
    score: '#62d28a',
    stars: '#ffd166',
    rankTitle: '#6ea8ff',
    rankBase: '#9bb7ff',
    rankRow: '#8fd3ff',
    reviewTitle: '#7dffb2',
    reviewRow: '#66e0a3',
    btnReplay: '#4ad68a',
    btnShare: '#ffc04a',
    btnNext: '#5aa8f0',
  };

  function box(id, label, left, top, width, height, color) {
    return { id, label, left, top, width, height, color };
  }

  function buttons(nextLabel) {
    // CustomerResultActions: centerX=198, y=-318, w=220, step=248, 3 slots.
    const height = 56;
    const width = 220;
    const top = 695;
    const lefts = [560, 808, 1056];
    return [
      box('btnReplay', '再玩一次', lefts[0], top, width, height, colors.btnReplay),
      box('btnShare', '分享成绩', lefts[1], top, width, height, colors.btnShare),
      box('btnNext', nextLabel, lefts[2], top, width, height, colors.btnNext),
    ];
  }

  function scene(layout, nextLabel) {
    const {
      title, character, score, stars, rankTitle, rankBase, rankRows,
      reviewTitle, reviewRows,
    } = layout;
    return [
      box('title', '挖宝结束', ...title, colors.title),
      box('character', '角色区', ...character, colors.character),
      box('score', '总分', ...score, colors.score),
      box('stars', '星星组', ...stars, colors.stars),
      box('rankTitle', '积分排行榜标题', ...rankTitle, colors.rankTitle),
      box('rankBase', '排行榜底板', ...rankBase, colors.rankBase),
      ...rankRows.map((row, index) => box(
        `rankRow${index + 1}`, `排行榜第${index + 1}行`, ...row, colors.rankRow,
      )),
      box('reviewTitle', '答题回顾标题', ...reviewTitle, colors.reviewTitle),
      ...reviewRows.map((row, index) => box(
        `reviewRow${index + 1}`, `答题回顾第${index + 1}行`, ...row, colors.reviewRow,
      )),
      ...buttons(nextLabel),
    ];
  }

  // HTML left, top, width, height from WritingSettlementLayout.fromHtml(...)
  return {
    treasure: scene({
      title: [24, 18, 210, 58],
      character: [-80.52, -1, 494.88, 665],
      score: [111, 656.25, 236.25, 54.75],
      stars: [79.5, 712.5, 270, 46.5],
      rankTitle: [525, 138.25, 262.5, 78],
      rankBase: [478, 237.75, 337.5, 335.25],
      rankRows: [
        [490.25, 258.25, 314.25, 99.75],
        [490.25, 381.5, 314.25, 80.25],
        [489.25, 487, 314.25, 78],
      ],
      reviewTitle: [966.25, 142.25, 297, 72.75],
      reviewRows: [
        [860, 247.75, 502.5, 59.25],
        [859, 326.5, 502.5, 59.25],
        [858, 404.25, 502.5, 59.25],
        [858, 482, 502.5, 59.25],
        [858, 561.75, 502.5, 59.25],
      ],
    }, '进入下一关'),
    desert: scene({
      title: [24, 18, 210, 58],
      character: [-85.97, 4, 580.47, 653],
      score: [264, 658.5, 78, 51],
      stars: [118.5, 712.5, 275.25, 45],
      rankTitle: [546, 204, 285.75, 73.5],
      rankBase: [516, 297, 351.75, 354.75],
      rankRows: [
        [528, 322.5, 314.25, 99.75],
        [527, 427, 312.75, 80.25],
        [528, 513, 309, 78],
      ],
      reviewTitle: [954, 204, 381.75, 75],
      reviewRows: [
        [912.5, 298.5, 458.25, 60],
        [912.5, 370, 458.25, 60],
        [913.5, 443.5, 458.25, 60],
        [913.5, 513, 458.25, 60],
        [914.5, 580.5, 458.25, 60],
      ],
    }, '进入下一关'),
    dinosaur: scene({
      title: [24, 18, 210, 58],
      character: [-55.03, 40, 461.4, 620],
      score: [180, 670.5, 220, 51],
      stars: [81, 726, 300, 48],
      rankTitle: [544.5, 213, 245.25, 70.5],
      rankBase: [493.5, 295.5, 345.75, 372],
      rankRows: [
        [505.5, 310.5, 324.75, 114],
        [514.5, 414, 316.5, 87.75],
        [514.5, 496.5, 317.25, 85.5],
      ],
      reviewTitle: [967.5, 211.5, 285, 72],
      reviewRows: [0, 1, 2, 3, 4].map((index) => [
        870, 333 + index * 66, 480.75, 64.5,
      ]),
    }, '进入下一关'),
    dunhuang: scene({
      title: [24, 18, 210, 58],
      character: [-20.2, 10, 497.3, 620],
      score: [170, 655.5, 210, 51],
      stars: [121.5, 712.5, 260, 42],
      rankTitle: [508.5, 177, 291.75, 75],
      rankBase: [483, 253.5, 357.75, 339.75],
      rankRows: [
        [501, 294, 314.25, 99.75],
        [502.5, 394.5, 312.75, 80.25],
        [507, 477, 309, 78],
      ],
      reviewTitle: [948, 172.5, 314.25, 90.75],
      reviewRows: [0, 1, 2, 3, 4].map((index) => [
        853.5, 334.5 + index * 67.5, 458.25, 60,
      ]),
    }, '进入下一关'),
    magic: scene({
      title: [24, 18, 210, 58],
      character: [-60.78, 0, 512.37, 598],
      score: [138.75, 613.5, 168.75, 51],
      stars: [91.5, 674.25, 260, 44.25],
      rankTitle: [531.75, 173.25, 262.5, 78],
      rankBase: [468, 259.5, 375.75, 357],
      rankRows: [
        [482.25, 267, 314.25, 99.75],
        [484.5, 362.25, 312.75, 80.25],
        [487.5, 442.5, 309, 78],
      ],
      reviewTitle: [968.25, 177.75, 297, 72.75],
      reviewRows: [0, 1, 2, 3, 4].map((index) => [
        879, 293.25 + index * 64.5, 458.25, 60,
      ]),
    }, '查看总成绩'),
  };
})();
