import {
  Button, Label, Node, tween, Vec3,
} from 'cc';
import {
  createLabel, createUiNode, drawCuteBookChip, drawCuteBookIcon, drawCuteCaretBadge,
} from '../core/ui/UiFactory';
import { BOOK_OPTIONS, resolveBookOption } from '../shared/config/BookCatalog';
import {
  BookDropdownHandle, BookDropdownStyle, createBookDropdown, markBookDropdownDataset,
} from './BookDropdown';

export interface IntroBookPickerStyle {
  readonly y: number;
  readonly chip: { readonly rim: string; readonly fill: string };
  readonly icon: { readonly cover: string; readonly pages: string };
  readonly caret: { readonly fill: string; readonly rim: string };
  readonly text: string;
  readonly outline: string;
  readonly dropdown: BookDropdownStyle;
}

export class IntroBookPicker {
  readonly root: Node;
  private readonly label: Label;
  private readonly caret: Node;
  private readonly dismiss: Node;
  private readonly dropdown: BookDropdownHandle;
  private index: number;
  private open = false;

  constructor(parent: Node, initialBook: string | undefined, style: IntroBookPickerStyle) {
    this.index = Math.max(0, BOOK_OPTIONS.indexOf(resolveBookOption(initialBook)));
    this.dismiss = createUiNode(parent, 'BookDismiss', 1440, 810);
    this.dismiss.active = false;
    const dismissButton = this.dismiss.addComponent(Button);
    dismissButton.transition = Button.Transition.NONE;
    this.dismiss.on(Button.EventType.CLICK, () => this.setOpen(false));

    this.root = createUiNode(parent, 'BookSelect', 460, 70, new Vec3(0, style.y));
    drawCuteBookChip(this.root, { ...style.chip, gloss: 0 });
    const icon = createUiNode(this.root, 'BookIcon', 40, 40, new Vec3(-178, 1));
    drawCuteBookIcon(icon, style.icon.cover, style.icon.pages);
    this.label = createLabel(this.root, BOOK_OPTIONS[this.index], {
      size: 30, color: style.text, width: 280, height: 50, bold: true,
      outlineColor: style.outline, outlineWidth: 4,
    });
    this.label.node.setPosition(0, 1);
    this.caret = createUiNode(this.root, 'BookCaret', 40, 40, new Vec3(186, 0));
    drawCuteCaretBadge(this.caret, style.caret.fill, style.caret.rim);
    const button = this.root.addComponent(Button);
    button.transition = Button.Transition.SCALE;
    button.zoomScale = 0.96;
    this.root.on(Button.EventType.CLICK, () => this.toggle());

    this.dropdown = createBookDropdown(
      parent, BOOK_OPTIONS, this.index, style.y, style.dropdown,
      (index) => this.select(index),
    );
    this.root.setSiblingIndex(parent.children.length - 1);
    this.dropdown.root.setSiblingIndex(parent.children.length - 1);
    this.updateDataset();
    tween(this.root)
      .repeatForever(
        tween().by(0.9, { position: new Vec3(0, 5) }).by(0.9, { position: new Vec3(0, -5) }),
      )
      .start();
  }

  selectedBook(): string {
    return BOOK_OPTIONS[this.index] ?? BOOK_OPTIONS[0];
  }

  close(): void {
    this.setOpen(false);
  }

  private toggle(): void {
    this.setOpen(!this.open);
    tween(this.root)
      .to(0.08, { scale: new Vec3(1.06, 1.06, 1) })
      .to(0.12, { scale: Vec3.ONE }, { easing: 'backOut' })
      .start();
  }

  private select(index: number): void {
    this.index = index;
    this.label.string = this.selectedBook();
    this.dropdown.setHighlight(index);
    if (typeof document !== 'undefined') document.body.dataset.bookSelect = this.label.string;
    this.setOpen(false);
  }

  private setOpen(open: boolean): void {
    this.open = open;
    this.dropdown.root.active = open;
    this.dismiss.active = open;
    this.caret.angle = open ? 180 : 0;
    markBookDropdownDataset(open, BOOK_OPTIONS.length);
    if (!open) return;
    this.dropdown.setHighlight(this.index);
    this.dropdown.root.setScale(1, 0.85, 1);
    tween(this.dropdown.root).to(0.14, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
  }

  private updateDataset(): void {
    if (typeof document === 'undefined') return;
    document.body.dataset.bookSelect = this.selectedBook();
    document.body.dataset.hasBookSelect = '1';
    markBookDropdownDataset(false, BOOK_OPTIONS.length);
  }
}
