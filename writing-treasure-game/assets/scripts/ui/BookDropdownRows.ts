import {
  EventTouch, Label, Node, Vec3,
} from 'cc';
import { createLabel, createUiNode, drawPanel } from '../core/ui/UiFactory';
import { BOOK_ROW_H, BOOK_VISIBLE_ROWS } from './BookDropdownConfig';

export interface BookDropdownRowSlot {
  readonly root: Node;
  readonly label: Label;
  bookIndex: number;
}

interface RowEvents {
  onTouchStart(): void;
  onTouchMove(event: EventTouch): void;
  onTouchEnd(slot: BookDropdownRowSlot): void;
  onTouchCancel(): void;
}

export function createBookDropdownRows(
  root: Node,
  panelHeight: number,
  labelColor: string,
  events: RowEvents,
): BookDropdownRowSlot[] {
  return Array.from({ length: BOOK_VISIBLE_ROWS }, (_, index) => {
    const y = panelHeight / 2 - 12 - BOOK_ROW_H / 2 - index * BOOK_ROW_H;
    const row = createUiNode(
      root, `BookOption${index}`, 392, BOOK_ROW_H - 8, new Vec3(-18, y),
    );
    drawPanel(row, '#FFFFFF', 14);
    const label = createLabel(row, '', {
      size: 28, color: labelColor, width: 350, height: 44, bold: true,
    });
    const slot: BookDropdownRowSlot = { root: row, label, bookIndex: index };
    row.on(Node.EventType.TOUCH_START, events.onTouchStart);
    row.on(Node.EventType.TOUCH_MOVE, events.onTouchMove);
    row.on(Node.EventType.TOUCH_END, () => events.onTouchEnd(slot));
    row.on(Node.EventType.TOUCH_CANCEL, events.onTouchCancel);
    return slot;
  });
}
