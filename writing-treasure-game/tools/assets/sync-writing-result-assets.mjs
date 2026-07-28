import fs from 'node:fs';
import path from 'node:path';

const project = path.resolve(import.meta.dirname, '../..');
const sourceRoot = process.env.WRITING_CLIENT_ASSETS
  ?? path.resolve(project, '../客户提供素材/写作宝藏-完整切图文件');
const outputRoot = path.join(project, 'assets/theme-bundles');
const sharedOutputRoot = path.join(project, 'assets/theme-bundles/shared');

const themes = {
  treasure: {
    directory: '写作宝藏-基础版-切图/结算',
    files: {
      resultRank: '排行榜.png',
      resultRankBase: '排行榜标签下底色.png',
      resultRankLabel1: '排行榜标签1.png',
      resultRankLabel2: '排行榜标签2.png',
      resultRankLabel3: '排行榜标签3.png',
      resultReview: '答题回顾.png',
      resultDecoration: '官封弼马温.png',
      resultCorrect: '正确.png',
      resultWrong: '错误.png',
      'resultStars-1': '星星1.png',
      'resultStars-2': '星星2.png',
      'resultStars-3': '星星3.png',
      'resultStars-4': '星星4.png',
      'resultStars-5': '星星5.png',
    },
  },
  desert: {
    directory: '写作宝藏-沙漠探险-切图/结算',
    files: {
      resultRank: '排行榜.png',
      resultRankBase: '排行底板.png',
      resultRankLabel1: '排行榜标签1.png',
      resultRankLabel2: '排行榜标签2.png',
      resultRankLabel3: '排行榜标签3.png',
      resultReview: '答题回顾.png',
      resultReviewPanel: '答题回顾条.png',
      resultDecoration: '弼马温.png',
      resultCorrect: '正确.png',
      resultWrong: '错误.png',
      resultStars: '星星.png',
    },
  },
  dinosaur: {
    directory: '写作宝藏-恐龙世界-切图/结算',
    files: {
      resultRank: '排行榜.png',
      resultRankBase: '恐龙排行榜内容底板.png',
      resultRankLabel1: '排行榜标签1.png',
      resultRankLabel2: '排行榜标签2.png',
      resultRankLabel3: '排行榜标签3.png',
      resultReview: '答题回顾.png',
      resultReviewPanel: '答题回顾框.png',
      resultDecoration: '弼马温.png',
      resultCorrect: '正确.png',
      resultWrong: '错误.png',
      resultStars: '星星.png',
    },
  },
  dunhuang: {
    directory: '写作宝藏-敦煌壁画-切图/结算',
    files: {
      resultRank: '排行榜.png',
      resultRankBase: '排行榜底板.png',
      resultRankLabel1: '排行榜标签1.png',
      resultRankLabel2: '排行榜标签2.png',
      resultRankLabel3: '排行榜标签3.png',
      resultReview: '答题回顾.png',
      resultReviewPanel: '答题回顾条.png',
      resultDecoration: '官封弼马温.png',
      resultCorrect: '正确.png',
      resultWrong: '错误.png',
      resultStars: '星星.png',
    },
  },
  magic: {
    directory: '写作宝藏-魔法学院-切图/结算',
    files: {
      resultRank: '排行榜.png',
      resultRankBase: '排行榜标签下底色.png',
      resultRankLabel1: '排行榜标签1.png',
      resultRankLabel2: '排行榜标签2.png',
      resultRankLabel3: '排行榜标签3.png',
      resultReview: '答题回顾.png',
      resultReviewPanel: '答题回顾条.png',
      resultDecoration: '官封弼马温.png',
      resultCorrect: '正确.png',
      resultWrong: '错误.png',
      'resultStars-1': '星星.png',
    },
  },
};

if (!fs.existsSync(sourceRoot)) {
  throw new Error(`writing client asset directory is missing: ${sourceRoot}`);
}

let copied = 0;
for (const [theme, mapping] of Object.entries(themes)) {
  const output = path.join(outputRoot, theme);
  fs.mkdirSync(output, { recursive: true });
  for (const [targetName, sourceName] of Object.entries(mapping.files)) {
    const sharedRankLabel = targetName.startsWith('resultRankLabel') && theme !== 'dinosaur';
    if (sharedRankLabel && theme !== 'treasure') continue;
    const source = path.join(sourceRoot, mapping.directory, sourceName);
    if (!fs.existsSync(source)) throw new Error(`required client asset is missing: ${source}`);
    const targetDirectory = sharedRankLabel ? sharedOutputRoot : output;
    fs.mkdirSync(targetDirectory, { recursive: true });
    const target = path.join(targetDirectory, `${targetName}.png`);
    fs.copyFileSync(source, target);
    copied += 1;
  }
}

console.log(`Synchronized ${copied} customer settlement assets from ${sourceRoot}`);
