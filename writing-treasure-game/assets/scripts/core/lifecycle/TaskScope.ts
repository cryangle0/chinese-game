export class TaskScope {
  private active = true;
  private generation = 0;

  /** Wrap a callback so it no-ops after cancel/close — arguments are forwarded. */
  guard<Args extends unknown[]>(
    task: (...args: Args) => void,
  ): (...args: Args) => void {
    const generation = this.generation;
    return (...args: Args) => {
      if (this.active && generation === this.generation) task(...args);
    };
  }

  cancelPending(): void {
    this.generation += 1;
  }

  close(): void {
    this.active = false;
    this.cancelPending();
  }

  isActive(): boolean {
    return this.active;
  }
}
