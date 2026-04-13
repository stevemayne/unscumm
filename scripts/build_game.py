#!/usr/bin/env python3
"""Build viewer artifacts for a single SCUMM game.

Given a game id and its raw files, this orchestrator:
  1. Parses the index + data files into `data/<id>/parsed.json`
  2. Extracts room backgrounds into `viewer/public/games/<id>/rooms/`
  3. Symlinks the parsed JSON into `viewer/public/games/<id>/parsed.json`
  4. Upserts the game entry in `viewer/public/games.json`

Example:
    python scripts/build_game.py \\
        --id day_of_the_tentacle \\
        --title "Day of the Tentacle" \\
        --scumm-version 6 \\
        --index games/day_of_the_tentacle/TENTACLE.000 \\
        --data  games/day_of_the_tentacle/TENTACLE.001
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "src"))

from scumm_deconstruct.parser import ScummParser  # noqa: E402

from extract_backgrounds import extract as extract_backgrounds  # noqa: E402


def build(
    game_id: str,
    title: str,
    scumm_version: int,
    index_path: Path,
    data_path: Path,
    skip_backgrounds: bool = False,
) -> None:
    # 1. Parse
    parsed_dir = REPO_ROOT / "data" / game_id
    parsed_dir.mkdir(parents=True, exist_ok=True)
    parsed_path = parsed_dir / "parsed.json"

    print(f"[{game_id}] Parsing {index_path.name} + {data_path.name}…")
    parser = ScummParser()
    game_data = parser.parse_game(str(index_path), str(data_path))
    parser.save_json(game_data, str(parsed_path))
    print(f"[{game_id}] Wrote {parsed_path}")

    # 2. Extract backgrounds
    viewer_game_dir = REPO_ROOT / "viewer" / "public" / "games" / game_id
    viewer_game_dir.mkdir(parents=True, exist_ok=True)
    rooms_dir = viewer_game_dir / "rooms"

    if skip_backgrounds:
        print(f"[{game_id}] Skipping background extraction")
    else:
        print(f"[{game_id}] Extracting backgrounds…")
        count = extract_backgrounds(index_path, rooms_dir)
        print(f"[{game_id}] Wrote {count} backgrounds to {rooms_dir}")

    # 3. Symlink parsed.json into the viewer's public tree
    viewer_parsed = viewer_game_dir / "parsed.json"
    if viewer_parsed.is_symlink() or viewer_parsed.exists():
        viewer_parsed.unlink()
    # relative symlink so it survives moves of the repo root
    rel = os.path.relpath(parsed_path, viewer_game_dir)
    viewer_parsed.symlink_to(rel)
    print(f"[{game_id}] Symlinked {viewer_parsed} -> {rel}")

    # 4. Upsert into games.json manifest
    manifest_path = REPO_ROOT / "viewer" / "public" / "games.json"
    manifest = {"games": []}
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text())

    entry = {
        "id": game_id,
        "title": title,
        "scumm_version": scumm_version,
        "rooms": len(game_data.rooms),
        "objects": len(game_data.objects),
    }
    games = [g for g in manifest.get("games", []) if g["id"] != game_id]
    games.append(entry)
    games.sort(key=lambda g: g["title"])
    manifest["games"] = games

    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"[{game_id}] Updated manifest {manifest_path}")


def main():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--id", required=True, help="Short game id used in paths.")
    parser.add_argument("--title", required=True, help="Human-readable game title.")
    parser.add_argument(
        "--scumm-version", type=int, required=True, help="SCUMM version (5, 6, 7…)."
    )
    parser.add_argument(
        "--index", type=Path, required=True, help="Path to .000 index file."
    )
    parser.add_argument(
        "--data", type=Path, required=True, help="Path to .001 data file."
    )
    parser.add_argument(
        "--skip-backgrounds",
        action="store_true",
        help="Skip slow background extraction (useful when iterating on the parser).",
    )
    args = parser.parse_args()

    build(
        game_id=args.id,
        title=args.title,
        scumm_version=args.scumm_version,
        index_path=args.index,
        data_path=args.data,
        skip_backgrounds=args.skip_backgrounds,
    )


if __name__ == "__main__":
    main()
