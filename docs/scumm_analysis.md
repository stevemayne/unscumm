# SCUMM Game File Analysis — Extracting Game Flow with Python

## Overview

SCUMM (Script Creation Utility for Maniac Mansion) game files contain fully
structured, extractable game data: inventory items, scene connections, verb
interactions, puzzle dependencies, and more. This document covers what's
available, how to extract it, and what you can build from it.

## What's in the Files

SCUMM games are fundamentally a **verb-object** system. The data files encode:

### Inventory & Objects

- Every room has a list of **objects** with metadata (name, position, state)
- Objects have associated **verb scripts** — literal code blocks for what happens
  when you `Pick up`, `Look at`, `Use`, `Give`, `Open`, etc.
- Inventory is tracked as objects owned by an actor — there's a dedicated
  `pickupObject` opcode (0x25 in v5)

### Room / Scene Graph

- Each room is a self-contained unit (backgrounds, walkboxes, objects,
  entry/exit scripts)
- **Room transitions** are encoded as opcodes (`o5_roomOps`) — scripts
  explicitly say "go to room N"
- Walk areas defined by **walkboxes** (polygonal regions the player can traverse)
- Exit hotspots are just objects whose verb scripts trigger room changes

### Game Logic / Puzzle Flow

- All puzzle logic lives in **SCUMM bytecode scripts** — "if player has item X
  and uses it on object Y, then..."
- Conditional checks, variable state, cutscene triggers — all decompilable
- 101 opcodes covering actor movement, dialogue, inventory manipulation, room
  transitions, animation, sound

## File Format

### Structure

- **Index file** (e.g. `monkey.000`) — resource directory
- **Data file(s)** (e.g. `monkey.001`) — actual resources
- Older games (v1–v4) use `.lfl` files (one per room)
- All chunks: **4-byte tag** + **32-bit big-endian length** + data
- Files are **XOR-encrypted** with a game-specific byte (e.g. `0x69` for
  Monkey Island)
- Contains: graphics, sprites, costumes, palettes, walk boxes, sounds, scripts

### SCUMM Versions

| Version | Games | File Format |
|---------|-------|-------------|
| v1–v2 | Maniac Mansion, Zak McKracken | `.lfl` (one per room) |
| v3–v4 | Loom, Indiana Jones Last Crusade | `.lfl` |
| v5 | Monkey Island 2, Indiana Jones Fate of Atlantis | `.000` + `.001` |
| v6 | Day of the Tentacle, Sam & Max | `.000` + `.001` |
| v7–v8 | Full Throttle, The Dig, Curse of Monkey Island | `.la0` + `.la1` |
| HE | Humongous Entertainment (Putt-Putt, Freddi Fish) | `.he0` + `.he1` |

## Extraction Pipeline

### 1. Extract Resource Blocks

Use **nutcracker** (Python, pip-installable) or **ScummPacker** to unpack the
index/data files into individual room, script, and object resources.

```bash
pip install nutcracker
```

```bash
# Extract all texts
nutcracker sputm strings_extract --textfile strings.txt PATH/TO/GAME.000

# Extract room backgrounds and object images as PNGs
nutcracker sputm build --ref PATH/TO/GAME.000 GAME
```

### 2. Decompile Scripts

Use **descumm** (C++, part of scummvm-tools) to turn bytecode into readable
pseudocode:

```
[0050] (29) unless (getOwner(351) == 0) goto 006A
[005A] (25) pickupObject(351)
[005F] (D8) printEgo("I'll hold on to this.")
```

### 3. Extract Verb/Object Metadata

`verb_helper.py` (ships with Scummbler) pulls out the verb-to-script mappings
per object.

### 4. Reference Decompiled Sources

The SCUMM Decompilation Archive already has fully decompiled scripts for many
LucasArts games (Fate of Atlantis, Monkey Island, etc.).

## Raw Parsing in Python

The chunk format is simple enough to parse directly:

```python
import struct

XOR_KEY = 0x69  # game-specific

def decrypt(data: bytes, key: int) -> bytes:
    return bytes(b ^ key for b in data)

def read_chunks(data: bytes, offset: int = 0):
    while offset < len(data):
        tag = data[offset:offset+4].decode('ascii')
        size = struct.unpack_from('>I', data, offset + 4)[0]
        chunk_data = data[offset+8:offset+size]
        yield tag, size, chunk_data, offset
        offset += size
```

## What You Can Build

With Python parsing of the extracted data, you can programmatically construct:

- **Item dependency graph** — item X is obtained in room Y, used in room Z on
  object W
- **Room connectivity map** — which rooms connect to which, through what exits
- **Puzzle dependency tree** — which items/states gate which transitions
- **Verb interaction matrix** — every object x every verb -> what script runs

## Complexity & Caveats

Puzzle logic is **imperative bytecode**, not declarative tables. Two approaches:

1. **Static analysis** — pattern-match on `pickupObject`, `startScript`,
   room-change opcodes in decompiled output. Gets ~80% of the way for most
   classic LucasArts games.
2. **Symbolic execution** — trace item/state dependencies through the script
   VM. More complete but significantly more complex.

## Key Tools & Libraries

| Tool | Language | Purpose |
|------|----------|---------|
| [nutcracker](https://github.com/BLooperZ/nutcracker) | Python | Extract/edit SCUMM resources (v5–v8, HE) |
| [descumm](https://github.com/scummvm/scummvm-tools) | C++ | Decompile SCUMM bytecode to pseudocode |
| [ScummPacker](http://www.jestarjokin.net/sw/doc/scummpacker_manual.html) | Python | Pack/unpack SCUMM data files |
| [Scummbler](http://www.jestarjokin.net/sw/doc/scummbler_manual.html) | Python | Compile SCUMM bytecode (v3–v5), includes verb_helper.py |
| [ScummKit](https://github.com/scummkit) | — | Clean-room SCUMM toolkit |

## Key References

- [SCUMM V5 Opcodes](https://wiki.scummvm.org/index.php?title=SCUMM/V5_opcodes)
- [SCUMM 6 Data Format](https://github.com/AlbanBedel/scummc/wiki/Scumm-6-data-format)
- [SCUMM 6 Resource Files (ScummVM Wiki)](https://wiki.scummvm.org/index.php?title=SCUMM/Technical_Reference/SCUMM_6_resource_files)
- [Deep Dive into SCUMM Bytecode](https://tonick.net/p/2021/03/a-deep-dive-into-the-scumm-bytecode/)
- [SCUMM Decompilation Archive](https://github.com/EricOakford/SCUMM-Decompilation-Archive)
- [The inComplete SCUMM Reference Guide](https://www.scummvm.org/old/docs/specs/index.php)
- [SCUMM Archeology (Mojo)](https://mixnmojo.com/features/sitefeatures/LucasArts-First-Words/2)
