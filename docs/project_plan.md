# SCUMM Deconstruction Project Plan

## Objectives

1. Extract scene topology from SCUMM game files.
2. Identify which inventory items are available in each room.
3. Recover the logic conditions that unlock transitions and progress.
4. Represent narrative arcs, major decision branches, and outcomes.

## Phase 1 — Repository Scaffold

- Create a Python package for SCUMM parsing and graph analysis.
- Add a CLI runner to parse raw SCUMM resources.
- Establish `docs/` and `data/` conventions.

## Phase 2 — Data Extraction

- Choose a target game and SCUMM version.
- Current test game: `Day of the Tentacle` under `games/day_of_the_tentacle`.
- Obtain raw game files and store them under `data/raw/`.
- Use `nutcracker` or custom parsing to extract chunks and scripts.

## Phase 3 — Structural Modeling

- Map room IDs to named scenes.
- Extract object definitions and inventory pickup/drop points.
- Build a room transition graph from room-change opcodes.
- Capture verb-object interactions per room.

## Phase 4 — Puzzle & Narrative Extraction

- Identify key item dependencies and locked conditions.
- Translate imperative bytecode into a dependency graph.
- Extract narrative branches from alternate room sequences and puzzle outcomes.
- Document story arcs and major decision points.

## Phase 5 — Output & Visualization

- Export structured JSON and graph data.
- Generate Mermaid or Graphviz diagrams.
- Publish per-game analysis notes in `docs/`.

## Next Task

- Implement actual SCUMM version-specific parsing in `src/scumm_deconstruct/parser.py`.
- Add a concrete extraction example for one target game.
- Create a `data/raw` folder and populate it with sample SCUMM files.
