from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


FRAME_COUNT = 72
CANVAS_SIZE = (1440, 810)
PERSON_SIZE = (420, 420)
PERSON_TOP = 25
GROUND_Y = 420
CHOICE_COLUMNS = (-355, -1, 342)
FRAME_DURATIONS = [duration for _ in range(24) for duration in (42, 42, 41)]


def position_between(start: float, end: float, progress: float) -> int:
    return round(start + (end - start) * max(0.0, min(1.0, progress)))


def build_variant(
    selected_index: int,
    person_frames: list[Image.Image],
    dinosaur_frames: list[Image.Image],
    output_root: Path,
) -> None:
    column = CHOICE_COLUMNS[selected_index]
    person_start_left = 720 + column - PERSON_SIZE[0] / 2
    frames: list[Image.Image] = []

    for frame_index in range(FRAME_COUNT):
        canvas = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))

        dinosaur_source = dinosaur_frames[frame_index % len(dinosaur_frames)]
        dinosaur = dinosaur_source.resize(
            (
                round(dinosaur_source.width * 0.75),
                round(dinosaur_source.height * 0.75),
            ),
            Image.Resampling.LANCZOS,
        )
        dinosaur_left = position_between(-250, 1220, frame_index / (FRAME_COUNT - 1))
        canvas.alpha_composite(dinosaur, (dinosaur_left, GROUND_Y - dinosaur.height))

        person = person_frames[frame_index].resize(
            PERSON_SIZE,
            Image.Resampling.LANCZOS,
        )
        run_progress = (frame_index - 20) / 40
        person_left = position_between(person_start_left, 1470, run_progress)
        canvas.alpha_composite(person, (person_left, PERSON_TOP))
        frames.append(canvas)

    output = output_root / f"wrong-{selected_index + 1}.webp"
    frames[0].save(
        output,
        format="WEBP",
        save_all=True,
        append_images=frames[1:],
        duration=FRAME_DURATIONS,
        loop=1,
        lossless=False,
        quality=82,
        method=5,
        minimize_size=True,
    )
    print(f"Built {output}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--material-root", type=Path, required=True)
    parser.add_argument("--dinosaur-root", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    args = parser.parse_args()

    person_root = args.material_root / "负反馈"
    person_frames = [
        Image.open(person_root / f"负反馈_{index:05d}.png").convert("RGBA")
        for index in range(FRAME_COUNT)
    ]
    dinosaur_frames = [
        Image.open(args.dinosaur_root / f"frame_{index:02d}.png").convert("RGBA")
        for index in range(1, 13)
    ]
    args.output_root.mkdir(parents=True, exist_ok=True)

    for selected_index in range(len(CHOICE_COLUMNS)):
        build_variant(selected_index, person_frames, dinosaur_frames, args.output_root)


if __name__ == "__main__":
    main()
