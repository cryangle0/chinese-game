import { Node } from 'cc';
import { resolveMotionTransform } from '../../core/media/DomMotionTransform';
import { AppConfig } from '../../shared/config/AppConfig';
import { createReviewModal, installReviewStyle } from './DomResultReviewModal';
export { resultReviewText } from './ResultReviewText';

export interface DomReviewBox {
  readonly width: number;
  readonly height: number;
  readonly position: { readonly x: number; readonly y: number };
}

export interface DomReviewRow {
  readonly box: DomReviewBox;
  readonly color: string;
  readonly text: string;
  readonly index: number;
  readonly question: string;
  readonly selectedAnswer: string;
  readonly correctAnswer: string;
  readonly correct: boolean;
}

export function mountDomResultReview(
  host: Node,
  contentRoot: Node,
  rows: readonly DomReviewRow[],
  fontSize: number,
): void {
  if (typeof document === 'undefined' || rows.length === 0) return;
  installReviewStyle();
  let modal: HTMLDivElement | null = null;
  const closeModal = (): void => {
    modal?.remove();
    modal = null;
    document.removeEventListener('keydown', handleEscape);
  };
  const handleEscape = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') closeModal();
  };
  const openModal = (row: DomReviewRow): void => {
    closeModal();
    modal = createReviewModal(row, closeModal);
    document.body.appendChild(modal);
    document.addEventListener('keydown', handleEscape);
    modal.querySelector<HTMLButtonElement>('.dom-result-review-close')?.focus();
  };
  const elements = rows.map((row) => createRow(row, openModal));

  const layout = (): void => {
    if (!host.isValid) return;
    const canvas = document.getElementById('GameCanvas');
    if (!(canvas instanceof HTMLCanvasElement)) return;
    const bounds = canvas.getBoundingClientRect();
    const scale = Math.min(
      bounds.width / AppConfig.designWidth,
      bounds.height / AppConfig.designHeight,
    );
    const left = bounds.left + (bounds.width - AppConfig.designWidth * scale) / 2;
    const top = bounds.top + (bounds.height - AppConfig.designHeight * scale) / 2;
    const transform = host === contentRoot
      ? { x: 0, y: 0, scaleX: 1, scaleY: 1 }
      : resolveMotionTransform(host, { contentRoot });
    const positionScaleX = Number(document.body.dataset.resultPositionScaleX) || 1;
    elements.forEach(({ element, row }) => {
      const x = transform.x + row.box.position.x * transform.scaleX * positionScaleX;
      const y = transform.y + row.box.position.y * transform.scaleY;
      const width = row.box.width * Math.abs(transform.scaleX) * scale;
      const height = row.box.height * Math.abs(transform.scaleY) * scale;
      element.style.left = `${left + (AppConfig.designWidth / 2 + x) * scale - width / 2}px`;
      element.style.top = `${top + (AppConfig.designHeight / 2 - y) * scale - height / 2}px`;
      element.style.width = `${width}px`;
      element.style.height = `${height}px`;
      element.style.fontSize = `${Math.max(11, fontSize * scale)}px`;
      element.style.lineHeight = `${Math.max(0, height - 4)}px`;
    });
  };

  layout();
  window.addEventListener('resize', layout);
  host.once(Node.EventType.NODE_DESTROYED, () => {
    window.removeEventListener('resize', layout);
    closeModal();
    elements.forEach(({ element }) => element.remove());
  });
}

function createRow(
  row: DomReviewRow,
  openModal: (row: DomReviewRow) => void,
): { element: HTMLDivElement; row: DomReviewRow } {
  const element = document.createElement('div');
  element.className = 'dom-result-review-row';
  element.dataset.resultReviewDom = '1';
  element.textContent = `题目：${row.question}`;
  element.title = row.text;
  element.setAttribute('aria-label', row.text);
  element.setAttribute('role', 'button');
  element.tabIndex = 0;
  element.addEventListener('click', () => openModal(row));
  element.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openModal(row);
  });
  Object.assign(element.style, {
    color: row.color,
    fontFamily: 'system-ui, "PingFang SC", "Microsoft YaHei", sans-serif',
    fontWeight: '700',
  } as CSSStyleDeclaration);
  document.body.appendChild(element);
  return { element, row };
}
