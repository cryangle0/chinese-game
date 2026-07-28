import { DomMotionOpaqueLayout } from '../assets/scripts/core/media/DomMotionOpaqueLayout';

const WIDTH = 190;
const HEIGHT = 320;
const OPAQUE_TOP = 108;
const OPAQUE_BOTTOM = 217;

function framePixels(): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  for (let y = OPAQUE_TOP; y <= OPAQUE_BOTTOM; y += 1) {
    for (let x = 65; x < 125; x += 1) {
      const offset = (y * WIDTH + x) * 4;
      pixels[offset] = y === OPAQUE_BOTTOM ? 100 : 200;
      pixels[offset + 1] = y === OPAQUE_BOTTOM ? 50 : 200;
      pixels[offset + 2] = y === OPAQUE_BOTTOM ? 20 : 200;
      pixels[offset + 3] = 255;
    }
  }
  return pixels;
}

describe('DomMotionOpaqueLayout', () => {
  const originalDocument = global.document;

  afterEach(() => {
    Object.defineProperty(global, 'document', {
      configurable: true,
      value: originalDocument,
    });
  });

  it('sizes the visible moving deer from its measured opaque height', () => {
    const context = {
      clearRect: jest.fn(),
      drawImage: jest.fn(),
      getImageData: () => ({ data: framePixels() }),
    };
    Object.defineProperty(global, 'document', {
      configurable: true,
      value: {
        body: { dataset: {} },
        createElement: () => ({
          getContext: () => context,
          width: 0,
          height: 0,
        }),
      },
    });
    const style: Record<string, string> = {};
    const image = {
      naturalWidth: WIDTH, naturalHeight: HEIGHT, style,
    } as unknown as HTMLImageElement;
    const layout = new DomMotionOpaqueLayout();

    expect(layout.apply({
      image,
      source: '/media/mario/run-right.webp',
      width: 136,
      height: 236,
      canvasScale: 1,
      contentLeft: 0,
      contentTop: 0,
      transform: { x: 0, y: -226, scaleX: 1, scaleY: 1 },
      fillOpaque: true,
      angle: 0,
      nodeScaleX: 1,
      nodeScaleY: 1,
    })).toBe(true);

    const renderedHeight = Number.parseFloat(style.height);
    const visibleHeight = renderedHeight * ((OPAQUE_BOTTOM - OPAQUE_TOP + 1) / HEIGHT);
    expect(visibleHeight).toBeGreaterThanOrEqual(232);
    expect(visibleHeight).toBeLessThanOrEqual(236);
  });
});
