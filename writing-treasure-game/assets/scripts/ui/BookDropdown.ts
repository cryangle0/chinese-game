import { EventMouse, EventTouch, Node, Vec3 } from 'cc';
import { createUiNode, drawFramedPanel, drawPanel } from '../core/ui/UiFactory';
import {
  BookDropdownRowSlot, createBookDropdownRows,
} from './BookDropdownRows';
import { BookDropdownScrollbar } from './BookDropdownScrollbar';
import {
  BOOK_PANEL_PADDING, BOOK_ROW_H, BOOK_VISIBLE_ROWS,
} from './BookDropdownConfig';

export { BOOK_ROW_H, BOOK_VISIBLE_ROWS } from './BookDropdownConfig';
const SCROLL_STEP_PX = 12;
export interface BookDropdownStyle {
  readonly fill: string;
  readonly rim: string;
  readonly rowActive: string;
  readonly rowIdle: string;
  readonly labelColor: string;
}

export interface BookDropdownHandle {
  readonly root: Node;
  setHighlight(index: number): void;
  resetScroll(): void;
}

export function createBookDropdown(
  parent: Node,
  books: readonly string[],
  selectedIndex: number,
  chipY: number,
  style: BookDropdownStyle,
  onSelect: (index: number) => void,
): BookDropdownHandle {
  const panelH = bookDropdownPanelHeight();
  const root = createUiNode(
    parent, 'BookDropdown', 460, panelH,
    new Vec3(0, chipY - 35 - panelH / 2 - 8),
  );
  drawFramedPanel(root, style.fill, style.rim, 18);
  root.active = false;

  let windowStart = 0;
  let highlight = selectedIndex;
  let listDragging = false;
  let thumbDragging = false;
  let moved = false;
  let dragAcc = 0;
  const maxStart = Math.max(0, books.length - BOOK_VISIBLE_ROWS);
  let slots: BookDropdownRowSlot[] = [];

  const paintRows = (): void => {
    windowStart = Math.max(0, Math.min(maxStart, windowStart));
    slots.forEach((slot, index) => paintRow(
      slot, books, windowStart + index, highlight, style,
    ));
    if (typeof document !== 'undefined') {
      document.body.dataset.bookWindow = String(windowStart);
    }
  };
  const scrollbar = new BookDropdownScrollbar(root, books.length, panelH, {
    getWindowStart: () => windowStart,
    setWindowStart: (next) => {
      windowStart = Math.max(0, Math.min(maxStart, Math.round(next)));
      paintRows();
    },
    setDragging: (dragging) => {
      thumbDragging = dragging;
      if (dragging) {
        listDragging = false;
        moved = true;
      }
    },
  });
  const paint = (): void => {
    paintRows();
    scrollbar.paint();
  };
  const scrollByRows = (deltaRows: number): void => {
    if (deltaRows === 0 || maxStart === 0) return;
    windowStart += deltaRows;
    paint();
  };
  const applyListDrag = (dy: number): void => {
    dragAcc += dy;
    if (Math.abs(dragAcc) < 4) return;
    moved = true;
    let steps = 0;
    while (dragAcc >= SCROLL_STEP_PX) { steps += 1; dragAcc -= SCROLL_STEP_PX; }
    while (dragAcc <= -SCROLL_STEP_PX) { steps -= 1; dragAcc += SCROLL_STEP_PX; }
    if (steps !== 0) scrollByRows(steps);
  };
  const onListTouchStart = (): void => {
    if (thumbDragging) return;
    listDragging = true;
    moved = false;
    dragAcc = 0;
  };
  const onListTouchMove = (event: EventTouch): void => {
    if (listDragging && !thumbDragging) applyListDrag(event.getUIDelta().y);
  };
  const onListTouchEnd = (): void => {
    listDragging = false;
  };

  slots = createBookDropdownRows(root, panelH, style.labelColor, {
    onTouchStart: onListTouchStart,
    onTouchMove: onListTouchMove,
    onTouchEnd: (slot) => {
      const wasMoved = moved;
      onListTouchEnd();
      if (!wasMoved && !thumbDragging && slot.bookIndex >= 0 && slot.bookIndex < books.length) {
        onSelect(slot.bookIndex);
      }
    },
    onTouchCancel: onListTouchEnd,
  });
  bindListGestures(root, onListTouchStart, onListTouchMove, onListTouchEnd);
  root.on(Node.EventType.MOUSE_WHEEL, (event: EventMouse) => {
    const scrollY = event.getScrollY();
    if (scrollY === 0) return;
    const rows = Math.min(3, Math.max(1, Math.round(Math.abs(scrollY) / 80)));
    scrollByRows(scrollY < 0 ? rows : -rows);
    event.propagationStopped = true;
  });

  const scrollToIndex = (index: number): void => {
    if (index < windowStart) windowStart = index;
    else if (index >= windowStart + BOOK_VISIBLE_ROWS) {
      windowStart = index - BOOK_VISIBLE_ROWS + 1;
    }
    paint();
  };
  scrollToIndex(selectedIndex);
  return {
    root,
    setHighlight(index: number) { highlight = index; scrollToIndex(index); },
    resetScroll() { windowStart = 0; paint(); },
  };
}

function paintRow(
  slot: BookDropdownRowSlot,
  books: readonly string[],
  bookIndex: number,
  highlight: number,
  style: BookDropdownStyle,
): void {
  slot.bookIndex = bookIndex;
  slot.root.active = bookIndex < books.length;
  if (!slot.root.active) return;
  const name = books[bookIndex] ?? '';
  slot.label.string = name;
  slot.label.fontSize = name.length > 10 ? 24 : 28;
  drawPanel(slot.root, bookIndex === highlight ? style.rowActive : style.rowIdle, 14);
}

function bindListGestures(
  root: Node,
  start: () => void,
  move: (event: EventTouch) => void,
  end: () => void,
): void {
  root.on(Node.EventType.TOUCH_START, start);
  root.on(Node.EventType.TOUCH_MOVE, move);
  root.on(Node.EventType.TOUCH_END, end);
  root.on(Node.EventType.TOUCH_CANCEL, end);
}

export function bookDropdownPanelHeight(): number {
  return BOOK_VISIBLE_ROWS * BOOK_ROW_H + BOOK_PANEL_PADDING;
}

export function markBookDropdownDataset(open: boolean, bookCount: number): void {
  if (typeof document === 'undefined') return;
  document.body.dataset.bookCount = String(bookCount);
  document.body.dataset.bookDropdownOpen = open ? '1' : '0';
  document.body.dataset.bookDropdownH = String(bookDropdownPanelHeight());
}
