export class RoundTimer {
  private remainingSeconds = 0;
  private running = false;
  private paused = false;

  start(seconds: number): void {
    this.remainingSeconds = Math.max(0, seconds);
    this.running = true;
    this.paused = false;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  tick(deltaSeconds: number): boolean {
    if (!this.running || this.paused) return false;
    this.remainingSeconds = Math.max(0, this.remainingSeconds - Math.max(0, deltaSeconds));
    if (this.remainingSeconds === 0) {
      this.running = false;
      return true;
    }
    return false;
  }

  remaining(): number {
    return this.remainingSeconds;
  }

  stop(): void {
    this.running = false;
    this.paused = false;
  }
}
