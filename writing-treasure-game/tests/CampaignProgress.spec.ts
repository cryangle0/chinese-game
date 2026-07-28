import { CampaignProgress } from '../assets/scripts/services/CampaignProgress';

describe('CampaignProgress', () => {
  const stages = [
    { id: 'one', name: 'One' },
    { id: 'two', name: 'Two' },
    { id: 'three', name: 'Three' },
  ] as const;

  it('advances through stages without overflowing', () => {
    const campaign = new CampaignProgress(stages);
    expect(campaign.current().id).toBe('one');
    expect(campaign.advance()).toBe(true);
    expect(campaign.current().id).toBe('two');
    expect(campaign.advance()).toBe(true);
    expect(campaign.advance()).toBe(false);
    expect(campaign.current().id).toBe('three');
  });

  it('starts from a requested stage', () => {
    const campaign = new CampaignProgress(stages, 'two');
    expect(campaign.index()).toBe(0);
    expect(campaign.total()).toBe(3);
    expect(campaign.current().id).toBe('two');
    expect(campaign.peek()?.id).toBe('three');
    campaign.advance();
    expect(campaign.current().id).toBe('three');
    campaign.advance();
    expect(campaign.current().id).toBe('one');
  });
});
