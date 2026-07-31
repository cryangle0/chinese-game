import {
  Button, Graphics, Label, Node,
} from 'cc';
import { spriteLoader } from '../core/assets/SpriteLoader';
import { createLabel, createUiNode } from '../core/ui/UiFactory';
import { WritingPlayLayout as L } from '../shared/config/WritingPlayLayout';
import { SpeechState } from '../services/SpeechSelectionService';
import { ThemeAssets } from '../shared/types/Theme';
import { installCanvasPressFallback } from './CanvasPressFallback';

const labels: Record<SpeechState, string> = {
  idle: '按住说话，完整说完后松开',
  preparing: '麦克风准备中...',
  listening: '正在输入...',
  processing: '正在识别...',
  'not-ready': '请听到提示音后再说',
  unsupported: '当前环境不支持录音，请直接点击选项作答',
  'no-match': '未识别到明确选项',
  error: '语音服务不可用，请检查麦克风权限和网络，或点击选项',
  disabled: '本题已作答，请完成当前操作',
};

const SHORT_PRESS_TIP = '请按住说话，松开后再识别';
const MIN_HOLD_MS = 120;
const DEFAULT_VOICE_IDLE = 'themes/writing/intro/voiceIdle';
const DEFAULT_VOICE_LISTENING = 'themes/writing/intro/voiceListening';

export class VoiceAnswerView {
  readonly root: Node;
  private readonly plate: Node;
  private readonly label: Label;
  private readonly button: Button;
  private assets?: ThemeAssets;
  private supported = true;
  private enabled = true;
  private state: SpeechState = 'idle';
  private pressed = false;
  private touchArmed = false;
  private pressStartedAt = 0;

  constructor(
    parent: Node,
    onDown: () => void,
    onUp: () => void,
    assets?: ThemeAssets,
    private readonly onCancel: () => void = () => undefined,
  ) {
    this.assets = assets;
    this.root = createUiNode(
      parent, 'VoiceAnswer', L.voice.size[0], L.voice.size[1], L.voice.position,
    );
    this.plate = createUiNode(this.root, 'VoicePlate', L.voice.size[0], L.voice.size[1]);
    this.label = createLabel(this.root, labels.idle, {
      size: L.voiceLabel.fontSize,
      color: '#5A3210',
      width: L.voiceLabel.width,
      height: L.voiceLabel.height,
      bold: true,
    });
    // voiceIdle.png yellow capsule sits above the full-plate center (leaves/frame
    // hang lower); nudge so「按住说话」reads vertically centered in the yellow bar.
    this.label.node.setPosition(0, L.voiceLabel.offsetY);
    this.button = this.root.addComponent(Button);
    this.button.transition = Button.Transition.SCALE;
    this.button.zoomScale = 0.98;
    this.applyPlate();
    this.bindPress(onDown, onUp);
    this.root.setSiblingIndex(parent.children.length - 1);
  }

  setSupported(supported: boolean): void {
    this.supported = supported;
    this.render(supported ? 'idle' : 'unsupported');
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.render(enabled ? (this.supported ? 'idle' : 'unsupported') : 'disabled');
  }

  render(state: SpeechState): void {
    this.state = state;
    if (typeof document !== 'undefined') document.body.dataset.speechState = state;
    this.button.interactable = this.supported && this.enabled;
    const listeningPlate = state === 'listening'
      && Boolean(this.assets?.voiceListening)
      && this.supported && this.enabled;
    // voiceListening.png already bakes「正在输入...」— Label would double-stack.
    this.label.string = listeningPlate ? '' : labels[state];
    if (typeof document !== 'undefined') {
      document.body.dataset.voiceLabel = this.label.string;
    }
    this.applyPlate();
  }

  setTheme(assets: ThemeAssets): void {
    this.assets = assets;
    this.render(this.state);
  }

  private applyPlate(): void {
    if (!this.assets) return;
    const listening = this.state === 'listening';
    // Always use voice PNG plates — never paint #FFD34D / #A8A8A8 fallbacks.
    const asset = listening
      ? (this.assets.voiceListening || DEFAULT_VOICE_LISTENING)
      : (this.assets.voiceIdle || DEFAULT_VOICE_IDLE);
    this.plate.getComponent(Graphics)?.clear();
    spriteLoader.apply(this.plate, asset, 'stretch');
  }

  private showShortPressTip(): void {
    this.state = 'no-match';
    if (typeof document !== 'undefined') {
      document.body.dataset.speechState = 'no-match';
      document.body.dataset.voiceShortPress = 'true';
    }
    this.button.interactable = this.supported && this.enabled;
    this.label.string = SHORT_PRESS_TIP;
    this.applyPlate();
  }

  private bindPress(onDown: () => void, onUp: () => void): void {
    const halfW = L.voice.size[0] / 2;
    const halfH = L.voice.size[1] / 2;
    const cx = L.voice.position.x;
    const cy = L.voice.position.y;
    const start = () => {
      if (!this.canPress() || this.pressed) return;
      this.pressed = true;
      this.touchArmed = true;
      this.pressStartedAt = Date.now();
      if (typeof document !== 'undefined') {
        document.body.dataset.voicePress = 'down';
        delete document.body.dataset.voiceShortPress;
      }
      onDown();
    };
    const end = () => {
      if (!this.pressed) return;
      this.pressed = false;
      const heldMs = Date.now() - this.pressStartedAt;
      if (typeof document !== 'undefined') document.body.dataset.voicePress = 'up';
      if (heldMs < MIN_HOLD_MS) {
        this.onCancel();
        this.showShortPressTip();
        return;
      }
      onUp();
    };
    this.root.on(Node.EventType.TOUCH_START, () => { this.touchArmed = true; start(); });
    this.root.on(Node.EventType.TOUCH_END, end);
    this.root.on(Node.EventType.TOUCH_CANCEL, end);
    this.root.on(Button.EventType.CLICK, () => {
      if (this.touchArmed) { this.touchArmed = false; return; }
      start();
      end();
    });
    installCanvasPressFallback(
      this.root,
      (x, y) => this.canPress() && Math.abs(x - cx) <= halfW && Math.abs(y - cy) <= halfH,
      start,
      end,
    );
  }

  private canPress(): boolean {
    return this.supported && this.enabled
      && this.state !== 'preparing'
      && this.state !== 'listening'
      && this.state !== 'processing';
  }
}
