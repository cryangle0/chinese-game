export type CameraOverlayState =
  | 'idle'
  | 'requesting'
  | 'loading'
  | 'positioning'
  | 'ready'
  | 'lost'
  | 'fallback';

const STYLE_ID = 'reading-pose-overlay-style';
const STATE_TEXT: Readonly<Record<CameraOverlayState, string>> = {
  idle: '', requesting: '请求摄像头', loading: '体感初始化',
  positioning: '请站到手机约1米处', ready: '体感已连接',
  lost: '等待人体入镜', fallback: '触屏模式',
};

export class CameraOverlay {
  readonly video: HTMLVideoElement;
  private readonly root: HTMLDivElement;
  private readonly status: HTMLSpanElement;
  private readonly retry: HTMLButtonElement;
  private readonly fallbackMessage: HTMLDivElement;

  constructor(onRetry: () => void) {
    this.installStyle();
    this.root = document.createElement('div');
    this.root.id = 'reading-pose-overlay';
    this.root.dataset.poseState = 'requesting';
    const header = document.createElement('div');
    header.className = 'pose-camera__header';
    const title = document.createElement('strong');
    title.textContent = '体感摄像头';
    this.status = document.createElement('span');
    this.status.className = 'pose-camera__status';
    header.append(title, this.status);
    const viewport = document.createElement('div');
    viewport.className = 'pose-camera__viewport';
    this.video = document.createElement('video');
    this.video.autoplay = true;
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.setAttribute('webkit-playsinline', 'true');
    const guide = document.createElement('div');
    guide.className = 'pose-camera__guide';
    viewport.append(this.video, guide, header);
    this.retry = document.createElement('button');
    this.retry.type = 'button';
    this.retry.className = 'pose-camera__retry';
    this.retry.textContent = '重试';
    this.retry.title = '重新连接体感摄像头';
    this.retry.setAttribute('aria-label', '重新连接体感摄像头');
    this.retry.addEventListener('click', (event) => {
      event.stopPropagation();
      onRetry();
    });
    this.fallbackMessage = document.createElement('div');
    this.fallbackMessage.className = 'pose-camera__fallback';
    this.root.append(viewport, this.fallbackMessage, this.retry);
    document.body.appendChild(this.root);
    this.setState('idle');
  }

  setState(state: CameraOverlayState, statusOverride?: string): void {
    this.root.dataset.poseState = state;
    this.status.textContent = statusOverride ?? STATE_TEXT[state];
    this.retry.hidden = state !== 'fallback';
    if (state === 'fallback') {
      const reason = statusOverride ?? STATE_TEXT.fallback;
      this.fallbackMessage.textContent = reason;
      this.retry.textContent = '重试';
      this.retry.title = `${reason}，点击重新连接`;
      this.retry.setAttribute('aria-label', `${reason}，点击重新连接`);
      this.root.dataset.fallbackReason = reason;
    } else {
      this.fallbackMessage.textContent = '';
      delete this.root.dataset.fallbackReason;
      this.retry.textContent = '重试';
      this.retry.title = '重新连接体感摄像头';
      this.retry.setAttribute('aria-label', '重新连接体感摄像头');
    }
    document.body.dataset.poseState = state;
  }

  setStream(stream: MediaStream): void {
    this.video.srcObject = stream;
    this.video.classList.add('is-live');
  }

  clearStream(): void {
    this.video.pause();
    this.video.srcObject = null;
    this.video.classList.remove('is-live');
  }

  setPaused(paused: boolean): void {
    this.root.classList.toggle('is-paused', paused);
  }

  setDiagnostics(
    bodyScale: number | null,
    interactionReady: boolean,
    interactionStatus: string,
  ): void {
    const scale = bodyScale === null ? '' : bodyScale.toFixed(4);
    this.root.dataset.poseBodyScale = scale;
    this.root.dataset.poseInteractionReady = String(interactionReady);
    this.root.dataset.poseInteractionStatus = interactionStatus;
    document.body.dataset.poseBodyScale = scale;
    document.body.dataset.poseInteractionReady = String(interactionReady);
    document.body.dataset.poseInteractionStatus = interactionStatus;
  }

  destroy(): void {
    this.clearStream();
    this.root.remove();
    if (document.body.dataset.poseState) delete document.body.dataset.poseState;
    delete document.body.dataset.poseBodyScale;
    delete document.body.dataset.poseInteractionReady;
    delete document.body.dataset.poseInteractionStatus;
  }

  private installStyle(): void {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
#reading-pose-overlay{position:fixed;top:max(12px,env(safe-area-inset-top));right:max(6px,env(safe-area-inset-right));z-index:40;width:clamp(232px,22.8vw,328px);color:#fff;font:600 12px/1.2 system-ui,sans-serif;filter:drop-shadow(0 3px 8px #0006);pointer-events:none}
.pose-camera__header{position:absolute;left:7px;right:7px;top:7px;z-index:2;min-height:22px;padding:0 7px;display:flex;align-items:center;justify-content:space-between;background:#18212bcc;border-radius:7px}
.pose-camera__header strong{font-size:12px}.pose-camera__status{color:#ffe082;font-size:10px}
.pose-camera__viewport{position:relative;overflow:hidden;aspect-ratio:16/9;background:#303740;border:4px solid #fff;border-radius:9px}
.pose-camera__viewport video{width:100%;height:100%;display:block;object-fit:cover;opacity:0;transform:scaleX(-1);transition:opacity .2s}
.pose-camera__viewport video.is-live{opacity:1}.pose-camera__guide{display:none}
.pose-camera__retry{position:absolute;right:0;top:0;height:32px;padding:0 13px;border:2px solid #fff;border-radius:8px;color:#fff;background:#1677ff;font:600 12px system-ui;pointer-events:auto}
.pose-camera__fallback{display:none}
#reading-pose-overlay[data-pose-state="ready"] .pose-camera__header{display:none}
#reading-pose-overlay[data-pose-state="idle"] .pose-camera__header{display:none}
#reading-pose-overlay[data-pose-state="ready"] .pose-camera__status{color:#69f0ae}
#reading-pose-overlay[data-pose-state="positioning"] .pose-camera__status{color:#ffe082}
#reading-pose-overlay[data-pose-state="fallback"] .pose-camera__viewport video{opacity:.35}
#reading-pose-overlay[data-pose-state="fallback"]{width:clamp(260px,31vw,390px);filter:none;padding:10px 78px 10px 12px;box-sizing:border-box;border:2px solid #fff;border-radius:9px;background:#18212be8;pointer-events:auto}
#reading-pose-overlay[data-pose-state="fallback"] .pose-camera__viewport{display:none}
#reading-pose-overlay[data-pose-state="fallback"] .pose-camera__fallback{display:block;font:500 12px/1.45 system-ui,"PingFang SC","Microsoft YaHei",sans-serif;color:#fff}
#reading-pose-overlay[data-pose-state="fallback"] .pose-camera__retry{right:8px;top:50%;transform:translateY(-50%)}
#reading-pose-overlay.is-paused{opacity:.55}
body[data-game-view="stage-result"] #reading-pose-overlay,body[data-game-view="result"] #reading-pose-overlay{display:none}
@media (max-height:430px){#reading-pose-overlay{top:6px;right:6px;width:clamp(168px,22.5vw,196px)}#reading-pose-overlay[data-pose-state="fallback"]{width:clamp(250px,38vw,360px)}.pose-camera__viewport{border-width:3px;border-radius:7px}.pose-camera__header{min-height:20px}.pose-camera__header strong{font-size:10px}.pose-camera__status{font-size:8px}}
`;
    document.head.appendChild(style);
  }
}
