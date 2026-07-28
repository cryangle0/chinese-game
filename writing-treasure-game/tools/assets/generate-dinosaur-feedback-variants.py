from __future__ import annotations

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
DINOSAUR = ROOT / "customer-media" / "static-feedback" / "dinosaur"
TARGET_HUES = {"blue": 135, "purple": 200, "orange": 10}
TARGET_SATURATIONS = {"blue": 95, "purple": 75, "orange": 175}


def recolor_correct(source: Image.Image, target_hue: int) -> Image.Image:
    rgba = source.convert("RGBA")
    hsv = rgba.convert("RGB").convert("HSV")
    result = hsv.copy()
    for y in range(rgba.height):
        for x in range(rgba.width):
            hue, saturation, value = hsv.getpixel((x, y))
            alpha = rgba.getpixel((x, y))[3]
            is_shell = (
                alpha > 32
                and x >= 150
                and y >= 60
                and hue >= 180
                and saturation >= 20
            )
            if is_shell:
                color = next(name for name, hue in TARGET_HUES.items() if hue == target_hue)
                minimum_saturation = TARGET_SATURATIONS[color]
                result.putpixel(
                    (x, y), (target_hue, max(saturation, minimum_saturation), value)
                )
    recolored = result.convert("RGB").convert("RGBA")
    recolored.putalpha(rgba.getchannel("A"))
    return recolored


def recolor_wrong(source: Image.Image, target_hue: int) -> Image.Image:
    rgba = source.convert("RGBA")
    hsv = rgba.convert("RGB").convert("HSV")
    result = hsv.copy()
    for y in range(rgba.height):
        for x in range(rgba.width):
            hue, saturation, value = hsv.getpixel((x, y))
            alpha = rgba.getpixel((x, y))[3]
            is_shell = (
                alpha > 32
                and y < 130
                and (hue <= 30 or hue >= 245)
                and saturation >= 55
                and value >= 105
            )
            if is_shell:
                result.putpixel((x, y), (target_hue, max(saturation, 90), value))
    recolored = result.convert("RGB").convert("RGBA")
    recolored.putalpha(rgba.getchannel("A"))
    return recolored


def save_variants(
    source_name: str,
    output_prefix: str,
    original_color: str,
    recolor,
) -> None:
    source = Image.open(DINOSAUR / source_name).convert("RGBA")
    for color, hue in TARGET_HUES.items():
        output = DINOSAUR / f"{output_prefix}-{color}.png"
        image = source.copy() if color == original_color else recolor(source, hue)
        image.save(output, optimize=True)
        if image.size != source.size or image.getchannel("A").getextrema() != source.getchannel(
            "A"
        ).getextrema():
            raise RuntimeError(f"invalid generated asset: {output}")
        print(output.relative_to(ROOT))


def main() -> None:
    save_variants(
        "correct-layer-1.png",
        "correct-layer-1",
        "purple",
        recolor_correct,
    )
    save_variants(
        "wrong-layer-2.png",
        "wrong-layer-2",
        "orange",
        recolor_wrong,
    )


if __name__ == "__main__":
    main()
