#!/usr/bin/env python3
"""Extract room background PNGs for the viewer.

Runs `nutcracker sputm room decode` against the game's index file,
then copies the per-room background images to viewer/public/rooms/
with the filename pattern `room_{id}.png` so the viewer can find them
by room_id directly.

Usage:
    python scripts/extract_backgrounds.py \
        --index data/raw/TENTACLE.000 \
        --out viewer/public/rooms/
"""
from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


BG_FILENAME_RE = re.compile(
    r"LECF_\d+_LFLF_(\d+)_ROOM_RMIM_IM00\.png$"
)


def extract(index_path: Path, out_dir: Path) -> int:
    out_dir.mkdir(parents=True, exist_ok=True)

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

        # Find the backgrounds directory (game name is taken from index filename)
        bg_dirs = list(tmp_path.glob("*/IMAGES/backgrounds"))
        if not bg_dirs:
            raise SystemExit("No backgrounds directory produced by nutcracker.")
        bg_dir = bg_dirs[0]

        copied = 0
        for src in sorted(bg_dir.iterdir()):
            m = BG_FILENAME_RE.search(src.name)
            if not m:
                continue
            room_id = int(m.group(1))
            dst = out_dir / f"room_{room_id}.png"
            shutil.copyfile(src, dst)
            copied += 1

        return copied


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
        help="Destination directory for room_{id}.png files.",
    )
    args = parser.parse_args()

    count = extract(args.index, args.out)
    print(f"Wrote {count} room backgrounds to {args.out}")


if __name__ == "__main__":
    main()
