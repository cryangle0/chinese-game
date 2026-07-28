import { Node } from 'cc';
import { ResponsiveRoot } from '../ui/ResponsiveRoot';

export interface PageLifecycleCallbacks {
  onExit(persisted: boolean): void;
  onVisibilityChange(paused: boolean): void;
}

export class PageLifecycle {
  private readonly resize = () => this.responsive.apply();
  private readonly pagehide = (event: Event) => {
    this.callbacks.onExit(Boolean((event as Event & { persisted?: boolean }).persisted));
  };
  private readonly pageshow = () => {
    this.resize();
    this.callbacks.onVisibilityChange(false);
  };
  private readonly visibility = () => {
    this.callbacks.onVisibilityChange(
      typeof document !== 'undefined' && document.hidden,
    );
  };
  private readonly responsive: ResponsiveRoot;

  constructor(
    root: Node,
    private readonly callbacks: PageLifecycleCallbacks,
  ) {
    this.responsive = new ResponsiveRoot(root);
    this.resize();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.resize);
      window.addEventListener('pagehide', this.pagehide);
      window.addEventListener('pageshow', this.pageshow);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.visibility);
    }
  }

  dispose(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.resize);
      window.removeEventListener('pagehide', this.pagehide);
      window.removeEventListener('pageshow', this.pageshow);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibility);
    }
  }
}
