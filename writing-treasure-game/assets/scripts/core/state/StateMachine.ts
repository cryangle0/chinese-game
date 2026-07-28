export class StateMachine<State extends string> {
  constructor(
    private currentState: State,
    private readonly transitions: Readonly<Record<State, readonly State[]>>,
  ) {}

  current(): State {
    return this.currentState;
  }

  canEnter(next: State): boolean {
    return this.transitions[this.currentState]?.includes(next) ?? false;
  }

  enter(next: State): void {
    if (!this.canEnter(next)) {
      throw new Error(`invalid state transition: ${this.currentState} -> ${next}`);
    }
    this.currentState = next;
  }

  force(next: State): void {
    this.currentState = next;
  }
}

