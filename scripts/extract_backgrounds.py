#!/usr/bin/env python3
"""Extract room backgrounds and object sprites for the viewer.

Runs `nutcracker sputm room decode` against the game's index file once,
then copies:
  - per-room backgrounds  → <out>/rooms/room_{id}.png
  - per-object sprites    → <out>/objects/obj_{id}_{state}.png

Filename conventions:
  - `room_{id}.png` keyed by the LFLF index (= our parser's room_id)
  - `obj_{id}_{state}.png` keyed by the OBIM number (= object_id) and IMNN
    state variant (1 = default, others for setState alternatives)

Usage:
    python scripts/extract_backgrounds.py \
        --index games/day_of_the_tentacle/TENTACLE.000 \
        --out viewer/public/games/day_of_the_tentacle/
"""
from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Tuple


BG_FILENAME_RE = re.compile(
    r"LECF_\d+_LFLF_(\d+)_ROOM_RMIM_IM00\.png$"
)
OBJ_FILENAME_RE = re.compile(
    r"LECF_\d+_LFLF_\d+_ROOM_OBIM_(\d+)_IM(\d+)\.png$"
)


def _accept_out_dir(out_dir: Path) -> Tuple[Path, Path]:
    """Return (rooms_dir, objects_dir) for the given output root.

    Backwards compatibility: if `out_dir` looks like an old-style
    `…/rooms/` directory, treat it as the rooms dir directly and put
    objects beside it.
    """
    if out_dir.name == "rooms":
        return out_dir, out_dir.parent / "objects"
    return out_dir / "rooms", out_dir / "objects"


def extract(index_path: Path, out_dir: Path) -> Tuple[int, int]:
    """Extract backgrounds and object sprites.  Returns (rooms, objects)."""
    rooms_dir, objects_dir = _accept_out_dir(out_dir)
    rooms_dir.mkdir(parents=True, exist_ok=True)
    objects_dir.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="nutcracker_") as tmp:
        tmp_path = Path(tmp)
        print(f"Running nutcracker in {tmp_path}…", file=sys.stderr)
        result = subprocess.run(
            ["nutcracker", "sputm", "room", "decode", str(index_path.resolve())],
            cwd=tmp_path,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            print(result.stdout[-500:], file=sys.stderr)
            print(result.stderr[-500:], file=sys.stderr)
            raise SystemExit(f"nutcracker exited with {result.returncode}")

        # backgrounds
        bg_dirs = list(tmp_path.glob("*/IMAGES/backgrounds"))
        if not bg_dirs:
            raise SystemExit("No backgrounds directory produced by nutcracker.")
        bg_count = 0
        for src in sorted(bg_dirs[0].iterdir()):
            m = BG_FILENAME_RE.search(src.name)
            if not m:
                continue
            room_id = int(m.group(1))
            shutil.copyfile(src, rooms_dir / f"room_{room_id}.png")
            bg_count += 1

        # objects (cropped sprites — `objects/`, not `objects_layers/`)
        obj_dirs = list(tmp_path.glob("*/IMAGES/objects"))
        obj_count = 0
        if obj_dirs:
            for src in sorted(obj_dirs[0].iterdir()):
                m = OBJ_FILENAME_RE.search(src.name)
                if not m:
                    continue
                obj_id = int(m.group(1))
                state = int(m.group(2))
                shutil.copyfile(src, objects_dir / f"obj_{obj_id}_{state}.png")
                obj_count += 1

        return bg_count, obj_count


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--index",
        required=True,
        type=Path,
        help="Path to the SCUMM index file (e.g. TENTACLE.000).",
    )
    parser.add_argument(
        "--out",
        required=True,
        type=Path,
        help="Destination root.  Creates rooms/ and objects/ subdirectories.",
    )
    args = parser.parse_args()

    bg, obj = extract(args.index, args.out)
    print(f"Wrote {bg} room backgrounds and {obj} object sprites under {args.out}")


if __name__ == "__main__":
    main()
