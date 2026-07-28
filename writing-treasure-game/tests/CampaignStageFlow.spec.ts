import { writingThemes } from '../assets/scripts/games/writing-treasure/config/WritingTheme';
import { CampaignProgress } from '../assets/scripts/services/CampaignProgress';
import { GameSession } from '../assets/scripts/services/GameSession';
import { stageOutcome } from '../assets/scripts/services/StageFlow';
import { sampleQuestions } from '../assets/scripts/shared/config/SampleQuestions';

describe('writing campaign stage flow', () => {
  it('plays five scenes with per-scene settlement and score reset', () => {
    const campaign = new CampaignProgress(writingThemes);
    const session = new GameSession('writing-treasure');
    const question = sampleQuestions[0];
    const stageScores: number[] = [];

    expect(campaign.total()).toBe(5);
    expect(writingThemes.map((theme) => theme.name)).toEqual([
      '经典挖宝', '沙漠探险', '恐龙世界', '敦煌壁画', '魔法学院',
    ]);

    for (let stage = 0; stage < campaign.total(); stage += 1) {
      expect(campaign.current().id).toBe(writingThemes[stage].id);
      expect(session.score()).toBe(0);
      expect(session.answered()).toBe(0);

      for (let index = 0; index < 5; index += 1) {
        expect(stageOutcome(session.answered())).toBe('next-question');
        session.beginQuestion(index * 100);
        session.answer(question, question.correctIndex, index * 100 + 40);
      }

      expect(stageOutcome(session.answered())).toBe('stage-result');
      const stageResult = session.stageResult();
      expect(stageResult.answered).toBe(5);
      expect(stageResult.score).toBeGreaterThan(0);
      stageScores.push(stageResult.score);

      if (campaign.isFinal()) break;
      expect(campaign.advance()).toBe(true);
      session.resetStage();
      expect(session.score()).toBe(0);
      expect(session.answered()).toBe(0);
    }

    expect(stageScores).toHaveLength(5);
    expect(session.result().answered).toBe(25);
    expect(stageScores).toEqual([100, 100, 100, 100, 100]);
    expect(session.result().score).toBe(500);
  });
});
