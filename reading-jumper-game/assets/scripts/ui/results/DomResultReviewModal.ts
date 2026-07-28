import { normalizeChineseTypography } from '../../shared/config/ChineseTextWrap';

/** Fields a review row must supply to open the detail popup. */
export interface ReviewModalRow {
  readonly index: number;
  readonly question: string;
  readonly selectedAnswer: string;
  readonly correctAnswer: string;
  readonly correct: boolean;
}

const STYLE_ID = 'dom-result-review-style-v2';

export function createReviewModal(row: ReviewModalRow, close: () => void): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.className = 'dom-result-review-modal';
  overlay.dataset.resultReviewModal = String(row.index);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });

  const panel = document.createElement('section');
  panel.className = 'dom-result-review-dialog';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', `第${row.index}题答题详情`);

  const header = document.createElement('header');
  header.className = 'dom-result-review-header';

  const title = document.createElement('h2');
  title.textContent = `第${row.index}题 · ${row.correct ? '回答正确' : '回答错误'}`;
  title.className = row.correct ? 'is-correct' : 'is-wrong';

  const closeButton = document.createElement('button');
  closeButton.className = 'dom-result-review-close';
  closeButton.type = 'button';
  closeButton.textContent = '×';
  closeButton.setAttribute('aria-label', '关闭');
  closeButton.addEventListener('click', close);

  header.append(title, closeButton);

  const content = document.createElement('div');
  content.className = 'dom-result-review-content';
  appendReviewField(content, '题目', normalizeChineseTypography(row.question));
  appendReviewField(
    content, '我的答案', normalizeChineseTypography(row.selectedAnswer || '未作答'),
  );
  appendReviewField(content, '正确答案', normalizeChineseTypography(row.correctAnswer));

  panel.append(header, content);
  overlay.appendChild(panel);
  return overlay;
}

function appendReviewField(parent: HTMLElement, label: string, value: string): void {
  const field = document.createElement('div');
  field.className = 'dom-result-review-field';
  const heading = document.createElement('strong');
  heading.textContent = `${label}：`;
  const text = document.createElement('span');
  text.textContent = value;
  field.append(heading, text);
  parent.appendChild(field);
}

export function installReviewStyle(): void {
  const stale = document.getElementById('dom-result-review-style');
  if (stale) stale.remove();
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.dom-result-review-row{
  position:fixed;z-index:24;box-sizing:border-box;overflow-x:auto;overflow-y:hidden;
  padding:0 20px;white-space:nowrap;letter-spacing:0;pointer-events:auto;touch-action:manipulation;
  user-select:text;-webkit-user-select:text;-webkit-overflow-scrolling:touch;scrollbar-width:none;
  cursor:pointer;border:0;background:transparent;text-overflow:ellipsis;
}
.dom-result-review-row:focus-visible{outline:3px solid #ffc84c;outline-offset:2px}
.dom-result-review-row::-webkit-scrollbar{display:none}
.dom-result-review-modal{
  position:fixed;inset:0;z-index:120;display:flex;align-items:center;justify-content:center;
  padding:max(12px,2vh) 16px;box-sizing:border-box;background:rgba(25,15,8,.72);
  font-family:system-ui,"PingFang SC","Microsoft YaHei",sans-serif;
}
.dom-result-review-dialog{
  position:relative;display:flex;flex-direction:column;width:min(680px,92vw);
  max-height:min(82vh,720px);box-sizing:border-box;overflow:hidden;
  padding:14px 20px 18px;border:6px solid #8f4c19;border-radius:28px;
  background:linear-gradient(180deg,#fff8d9 0%,#ffe4a3 100%);
  box-shadow:0 12px 0 #5f2d10,0 24px 48px rgba(0,0,0,.38);color:#5d3218;
}
.dom-result-review-header{
  position:relative;display:flex;align-items:center;justify-content:center;
  flex:0 0 auto;min-height:42px;margin:0 0 12px;padding:0 48px;
}
.dom-result-review-header h2{
  margin:0;max-width:100%;text-align:center;font-size:26px;line-height:1.2;
  font-weight:800;color:#b9371d;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
.dom-result-review-header h2.is-correct{color:#25833d}
.dom-result-review-content{
  flex:1 1 auto;min-height:0;overflow-x:hidden;overflow-y:auto;-webkit-overflow-scrolling:touch;
  padding:2px 4px 4px;font-size:20px;line-height:1.55;
}
.dom-result-review-field{
  display:flex;gap:6px;align-items:flex-start;margin:0 0 12px;padding:12px 14px;
  border:2px solid #e9b85e;border-radius:14px;background:rgba(255,255,255,.62);
}
.dom-result-review-field:last-child{margin-bottom:0}
.dom-result-review-field strong{flex:0 0 auto;color:#9a4c16}
.dom-result-review-field span{min-width:0;white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere}
.dom-result-review-close{
  position:absolute;right:0;top:50%;transform:translateY(-50%);
  width:42px;height:42px;border:3px solid #8f4c19;border-radius:50%;
  background:#ffbd3f;color:#6a2f0b;font-size:30px;font-weight:900;line-height:1;
  display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;
}
.dom-result-review-close:focus-visible{outline:3px solid #fff;outline-offset:2px}
@media(max-width:600px),(max-height:480px){
  .dom-result-review-modal{padding:8px 10px}
  .dom-result-review-dialog{
    width:min(680px,96vw);max-height:90vh;padding:10px 12px 12px;border-width:4px;border-radius:20px;
  }
  .dom-result-review-header{min-height:36px;margin-bottom:8px;padding:0 40px}
  .dom-result-review-header h2{font-size:20px}
  .dom-result-review-close{width:36px;height:36px;font-size:26px;border-width:2px}
  .dom-result-review-content{font-size:16px;line-height:1.45}
  .dom-result-review-field{margin-bottom:8px;padding:10px 12px;border-radius:12px}
}
`;
  document.head.appendChild(style);
}
