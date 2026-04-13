# unSCUMM

A SCUMM reverse-engineering project for extracting scene topology, inventory provenance, and puzzle logic.

## Goal

Build a reproducible analysis pipeline that converts SCUMM game files into:

- scene/room connectivity graphs
- inventory item locations and ownership flows
- verb-object interaction matrices
- puzzle unlock conditions and dependency trees
- narrative arcs, decision branches, and outcomes

## Repository Structure

- `src/scumm_deconstruct/` — library code for parsing SCUMM data and building analysis graphs
- `scripts/` — orchestration scripts (asset extraction, per-game builds)
- `games/<id>/` — raw game files (one directory per game)
- `data/<id>/` — derived analysis artifacts per game (e.g. `parsed.json`)
- `viewer/` — React + Vite web app for visualising the analysis
- `docs/` — analysis notes, game deconstructions, and project planning

## Quick Start

### 1. Install dependencies

Python:

```bash
python -m pip install -r requirements.txt
# nutcracker has a Cython 3 build issue; pin first if installing from scratch:
pip install 'cython<3'
pip install nutcracker
```

Viewer:

```bash
cd viewer
npm install
```

### 2. Place a game under `games/<id>/`

Each game lives in its own subdirectory, containing the raw SCUMM files. For example:

```
games/day_of_the_tentacle/
  TENTACLE.000
  TENTACLE.001
```

### 3. Build the analysis artifacts for a game

`scripts/build_game.py` is the one-stop orchestrator. It parses the game, extracts room backgrounds, and registers the game in the viewer's manifest.

```bash
python scripts/build_game.py \
    --id day_of_the_tentacle \
    --title "Day of the Tentacle" \
    --scumm-version 6 \
    --index games/day_of_the_tentacle/TENTACLE.000 \
    --data  games/day_of_the_tentacle/TENTACLE.001
```

This produces:

- `data/<id>/parsed.json` — parsed rooms, objects, scripts, transitions
- `viewer/public/games/<id>/rooms/room_N.png` — extracted room backgrounds
- `viewer/public/games/<id>/parsed.json` — symlink into the viewer's public tree
- `viewer/public/games.json` — upserted manifest entry

Pass `--skip-backgrounds` when iterating on the parser to avoid the slow nutcracker extraction step.

Re-running the same command overwrites cleanly; adding a new game just means another invocation with a different `--id`.

### 4. Run the viewer

```bash
cd viewer
npm run dev
```

The viewer loads `games.json`, presents a game selector when more than one game is registered, and shows each room's background with object hit zones overlaid and clickable exit transitions.

## CLI (parser only)

If you just want the parsed JSON without the viewer artifacts:

```bash
python -m scumm_deconstruct \
    --index games/day_of_the_tentacle/TENTACLE.000 \
    --data  games/day_of_the_tentacle/TENTACLE.001 \
    --output data/day_of_the_tentacle/parsed.json \
    --summary --show-graph
```

## Current status

- ✅ SCUMM v6 chunk parsing (rooms, objects, verb tables, scripts)
- ✅ v6 bytecode scanner for room-transition opcodes (`loadRoom`, `loadRoomWithEgo`)
- ✅ Per-room background extraction via nutcracker
- ✅ React viewer with room list, scene map, clickable exits
- ⬜ Puzzle/narrative extraction (item dependencies, verb-object matrix)
- ⬜ Scene-graph visualisation (Mermaid/Graphviz/force-directed)

Tested against **Day of the Tentacle** (SCUMM v6): 89 rooms, 744 objects, 151 transitions recovered by static analysis.
