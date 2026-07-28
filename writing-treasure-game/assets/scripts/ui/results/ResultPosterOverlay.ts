import { ResultPosterModel } from './ResultPosterModel';

export class ResultPosterOverlay {
  private overlay: HTMLDivElement | null = null;

  show(dataUrl: string | null, model: ResultPosterModel): void {
    this.dispose();
    const overlay = document.createElement('div');
    overlay.dataset.resultPosterOverlay = '1';
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', zIndex: '9999', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '16px',
      background: 'rgba(18, 24, 32, 0.86)',
      fontFamily: 'system-ui, "PingFang SC", "Microsoft YaHei", sans-serif',
    } as unknown as CSSStyleDeclaration);
    const panel = document.createElement('div');
    Object.assign(panel.style, {
      width: 'min(92vw, 440px)', maxHeight: '94vh', display: 'flex',
      flexDirection: 'column', gap: '10px', alignItems: 'stretch', padding: '12px',
      borderRadius: '8px', background: '#FFFFFF', boxSizing: 'border-box',
    } as unknown as CSSStyleDeclaration);
    if (dataUrl) panel.appendChild(createPosterImage(dataUrl, model));
    panel.appendChild(createTip(Boolean(dataUrl)));
    panel.appendChild(createActions(dataUrl, model.fileName, () => this.dispose()));
    overlay.appendChild(panel);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) this.dispose();
    });
    document.body.appendChild(overlay);
    this.overlay = overlay;
  }

  dispose(): void {
    this.overlay?.remove();
    this.overlay = null;
  }
}

function createPosterImage(dataUrl: string, model: ResultPosterModel): HTMLImageElement {
  const image = document.createElement('img');
  image.src = dataUrl;
  image.alt = `${model.gameTitle} ${model.scoreText}`;
  Object.assign(image.style, {
    width: '100%', maxHeight: '72vh', objectFit: 'contain', borderRadius: '6px',
    userSelect: 'auto', WebkitUserSelect: 'auto', touchAction: 'auto',
    WebkitTouchCallout: 'default',
  } as unknown as CSSStyleDeclaration);
  return image;
}

function createTip(success: boolean): HTMLDivElement {
  const tip = document.createElement('div');
  tip.textContent = success
    ? '长按图片保存，或点击“保存图片”；保存后可发送给好友。'
    : '分享图生成失败，请关闭后重试；若持续失败，请清理浏览器缓存或重启小程序。';
  Object.assign(tip.style, {
    color: success ? '#263238' : '#B42318',
    fontSize: success ? '14px' : '16px',
    lineHeight: '1.5',
    textAlign: 'center',
  } as unknown as CSSStyleDeclaration);
  return tip;
}

function createActions(
  dataUrl: string | null,
  fileName: string,
  closeOverlay: () => void,
): HTMLDivElement {
  const actions = document.createElement('div');
  Object.assign(actions.style, {
    display: 'grid', gridTemplateColumns: dataUrl ? '1fr 1fr' : '1fr', gap: '8px',
  } as unknown as CSSStyleDeclaration);
  if (dataUrl) {
    const save = document.createElement('a');
    save.href = dataUrl;
    save.download = fileName;
    save.textContent = '保存图片';
    styleAction(save, '#1677FF');
    actions.appendChild(save);
  }
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '关闭';
  styleAction(close, '#52616B');
  close.addEventListener('click', closeOverlay);
  actions.appendChild(close);
  return actions;
}

function styleAction(element: HTMLElement, background: string): void {
  Object.assign(element.style, {
    minHeight: '44px', display: 'flex', alignItems: 'center',
    justifyContent: 'center', border: '0', borderRadius: '6px', color: '#FFFFFF',
    background, fontSize: '16px', fontWeight: '700', textDecoration: 'none',
    cursor: 'pointer',
  } as unknown as CSSStyleDeclaration);
}
