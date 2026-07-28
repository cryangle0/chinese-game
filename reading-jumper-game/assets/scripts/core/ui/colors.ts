import { Color } from 'cc';

export function color(hex: string, alpha = 255): Color {
  const parsed = Color.fromHEX(new Color(), hex);
  parsed.a = alpha;
  return parsed;
}

