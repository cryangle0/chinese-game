export interface CampaignStage {
  readonly id: string;
  readonly name: string;
}

export class CampaignProgress<Stage extends CampaignStage> {
  private indexValue = 0;
  private readonly stages: readonly Stage[];

  constructor(
    stages: readonly Stage[],
    initialStageId = '',
  ) {
    const initial = stages.findIndex((stage) => stage.id === initialStageId);
    this.stages = initial > 0
      ? [...stages.slice(initial), ...stages.slice(0, initial)]
      : stages;
  }

  current(): Stage {
    const stage = this.stages[this.indexValue];
    if (!stage) throw new Error('campaign has no stages');
    return stage;
  }

  peek(offset = 1): Stage | undefined {
    return this.stages[this.indexValue + offset];
  }

  index(): number {
    return this.indexValue;
  }

  total(): number {
    return this.stages.length;
  }

  isFinal(): boolean {
    return this.indexValue >= this.stages.length - 1;
  }

  advance(): boolean {
    if (this.isFinal()) return false;
    this.indexValue += 1;
    return true;
  }
}
