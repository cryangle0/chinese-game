import {
  EventTouch, Node, UITransform, Vec3,
} from 'cc';
import { createUiNode, drawPanel } from '../core/ui/UiFactory';
import { BOOK_VISIBLE_ROWS } from './BookDropdownConfig';

const TRACK_W = 18;
const THUMB_MIN_H = 64;

interface ScrollbarCallbacks {
  getWindowStart(): number;
  setWindowStart(next: number): void;
  setDragging(dragging: boolean): void;
}

export class BookDropdownScrollbar {
  private readonly maxStart: number;
  private readonly trackHeight: number;
  private readonly track: Node;
  private readonly thumb: Node;
  private readonly thumbCore: Node;
  private readonly thumbGloss: Node;
  private dragging = false;

  constructor(
    root: Node,
    private readonly itemCount: number,
    panelHeight: number,
    private readonly callbacks: ScrollbarCallbacks,
  ) {
    this.maxStart = Math.max(0, itemCount - BOOK_VISIBLE_ROWS);
    this.trackHeight = panelHeight - 32;
    this.track = createUiNode(
      root, 'ScrollTrack', TRACK_W + 6, this.trackHeight, new Vec3(200, 0),
    );
    drawPanel(this.track, '#C44E14', (TRACK_W + 6) / 2);
    const groove = createUiNode(
      this.track, 'ScrollGroove', TRACK_W, this.trackHeight - 6,
    );
    drawPanel(groove, '#F3DEB0', TRACK_W / 2);
    this.thumb = createUiNode(this.track, 'ScrollThumb', TRACK_W + 2, THUMB_MIN_H);
    this.thumbCore = createUiNode(this.thumb, 'ThumbCore', TRACK_W - 4, THUMB_MIN_H - 10);
    this.thumbGloss = createUiNode(this.thumb, 'ThumbGloss', TRACK_W - 8, 9);
    this.bind();
  }

  paint(): void {
    this.track.active = this.itemCount > BOOK_VISIBLE_ROWS;
    if (!this.track.active) return;
    const thumbHeight = this.thumbHeight();
    this.paintThumb(thumbHeight);
    const travel = Math.max(0, this.trackHeight - thumbHeight);
    const ratio = this.maxStart === 0 ? 0 : this.callbacks.getWindowStart() / this.maxStart;
    this.thumb.setPosition(0, this.trackHeight / 2 - thumbHeight / 2 - ratio * travel);
  }

  private bind(): void {
    this.thumb.on(Node.EventType.TOUCH_START, (event: EventTouch) => {
      this.dragging = true;
      this.callbacks.setDragging(true);
      event.propagationStopped = true;
    });
    this.thumb.on(Node.EventType.TOUCH_MOVE, (event: EventTouch) => this.moveThumb(event));
    const end = (event?: EventTouch): void => {
      this.dragging = false;
      this.callbacks.setDragging(false);
      this.paint();
      if (event) event.propagationStopped = true;
    };
    this.thumb.on(Node.EventType.TOUCH_END, end);
    this.thumb.on(Node.EventType.TOUCH_CANCEL, end);
    this.track.on(Node.EventType.TOUCH_END, (event: EventTouch) => this.pageTrack(event));
  }

  private moveThumb(event: EventTouch): void {
    if (!this.dragging || this.maxStart === 0) return;
    const thumbHeight = this.thumbHeight();
    const travel = Math.max(0, this.trackHeight - thumbHeight);
    if (travel <= 0) return;
    const top = this.trackHeight / 2 - thumbHeight / 2;
    const bottom = -top;
    const nextY = Math.max(bottom, Math.min(top, this.thumb.position.y + event.getUIDelta().y));
    this.thumb.setPosition(0, nextY);
    this.callbacks.setWindowStart(((top - nextY) / travel) * this.maxStart);
    event.propagationStopped = true;
  }

  private pageTrack(event: EventTouch): void {
    if (this.dragging || this.maxStart === 0) return;
    const transform = this.track.getComponent(UITransform);
    if (!transform) return;
    const location = event.getUILocation();
    const local = transform.convertToNodeSpaceAR(new Vec3(location.x, location.y, 0));
    const thumbHeight = this.thumbHeight();
    const edge = thumbHeight / 2;
    if (local.y > this.thumb.position.y + edge) {
      this.callbacks.setWindowStart(this.callbacks.getWindowStart() - BOOK_VISIBLE_ROWS);
    } else if (local.y < this.thumb.position.y - edge) {
      this.callbacks.setWindowStart(this.callbacks.getWindowStart() + BOOK_VISIBLE_ROWS);
    }
    this.paint();
    event.propagationStopped = true;
  }

  private thumbHeight(): number {
    if (this.itemCount <= BOOK_VISIBLE_ROWS) return this.trackHeight - 8;
    return Math.max(
      THUMB_MIN_H,
      Math.min(this.trackHeight - 8, this.trackHeight * (BOOK_VISIBLE_ROWS / this.itemCount)),
    );
  }

  private paintThumb(height: number): void {
    this.thumb.getComponent(UITransform)?.setContentSize(TRACK_W + 2, height);
    drawPanel(this.thumb, '#B84410', (TRACK_W + 2) / 2);
    this.thumbCore.getComponent(UITransform)?.setContentSize(TRACK_W - 4, Math.max(28, height - 10));
    drawPanel(this.thumbCore, '#FF9A45', (TRACK_W - 4) / 2);
    this.thumbGloss.setPosition(0, height / 2 - 14);
    drawPanel(this.thumbGloss, '#FFE6B0', 4);
  }
}
