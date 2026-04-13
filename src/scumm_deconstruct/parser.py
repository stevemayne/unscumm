import json
import struct
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from .model import GameData, Room, ScriptData, ScummObject, VerbEntry
from .script import analyze_script


class ScummParser:
    """SCUMM v6 resource parser for .000 (index) and .001 (data) files."""

    xor_key = 0x69

    # --- low-level helpers ---------------------------------------------------

    def decrypt(self, data: bytes, key: int = None) -> bytes:
        key = self.xor_key if key is None else key
        return bytes(b ^ key for b in data)

    def read_chunks(
        self, data: bytes, offset: int = 0, end: int = None
    ) -> List[Tuple[str, int, bytes, int]]:
        """Yield (tag, size, chunk_data, offset) for consecutive chunks."""
        if end is None:
            end = len(data)
        chunks = []
        while offset + 8 <= end:
            tag = data[offset : offset + 4].decode("ascii", errors="replace")
            size = struct.unpack_from(">I", data, offset + 4)[0]
            if size < 8 or offset + size > end:
                break
            chunk_data = data[offset + 8 : offset + size]
            chunks.append((tag, size, chunk_data, offset))
            offset += size
        return chunks

    # --- index file (.000) ---------------------------------------------------

    def parse_index(self, path: str) -> Dict:
        """Parse the index file and return directory information."""
        raw = Path(path).read_bytes()
        data = self.decrypt(raw)

        index = {"dobj": {}, "droo": {}}
        for tag, _size, chunk_data, _offset in self.read_chunks(data):
            if tag == "DOBJ":
                index["dobj"] = self._parse_dobj(chunk_data)
            elif tag == "DROO":
                index["droo"] = self._parse_droo(chunk_data)
        return index

    def _parse_dobj(self, data: bytes) -> Dict[int, Dict]:
        """Parse object directory: owner/state byte + 4 bytes class_data per object."""
        num_items = struct.unpack_from("<H", data, 0)[0]
        objects = {}
        for i in range(num_items):
            entry_offset = 2 + i * 5
            if entry_offset + 5 > len(data):
                break
            owner_state = data[entry_offset]
            owner = (owner_state >> 4) & 0x0F
            state = owner_state & 0x0F
            class_data = struct.unpack_from("<I", data, entry_offset + 1)[0]
            objects[i] = {"owner": owner, "state": state, "class_data": class_data}
        return objects

    def _parse_droo(self, data: bytes) -> Dict[int, int]:
        """Parse room directory: maps room index to file number."""
        num_items = struct.unpack_from("<H", data, 0)[0]
        rooms = {}
        for i in range(num_items):
            if 2 + i < len(data):
                rooms[i] = data[2 + i]
        return rooms

    # --- data file (.001) ----------------------------------------------------

    def parse_data(self, path: str, index: Optional[Dict] = None) -> GameData:
        """Parse the data file and return populated GameData."""
        raw = Path(path).read_bytes()
        data = self.decrypt(raw)

        game_data = GameData(source=str(path))

        # Top level: LECF container
        top_chunks = self.read_chunks(data)
        if not top_chunks or top_chunks[0][0] != "LECF":
            raise ValueError("Expected LECF as top-level chunk in data file")

        lecf_data = top_chunks[0][2]
        lecf_offset = top_chunks[0][3] + 8  # absolute offset of LECF contents

        # Parse LECF children: LOFF + LFLF blocks
        children = self.read_chunks(data, lecf_offset, lecf_offset + len(lecf_data))

        room_offsets: Dict[int, int] = {}
        for tag, _size, chunk_data, abs_offset in children:
            if tag == "LOFF":
                room_offsets = self._parse_loff(chunk_data)

        # Invert: offset -> room_id
        offset_to_room = {offset: rid for rid, offset in room_offsets.items()}

        for tag, size, chunk_data, abs_offset in children:
            if tag != "LFLF":
                continue
            # The LFLF offset + 8 should match a ROOM offset in the LOFF table
            room_content_offset = abs_offset + 8
            room_id = offset_to_room.get(room_content_offset)
            if room_id is None:
                # Fallback: match by proximity
                room_id = offset_to_room.get(abs_offset)
            if room_id is None:
                continue

            room = self._parse_lflf(data, abs_offset, abs_offset + size, room_id)
            game_data.rooms[room_id] = room

            # Register objects in the global object dict
            for obj in room.objects:
                game_data.objects[obj.object_id] = obj

        # Merge index data into objects if available
        if index and "dobj" in index:
            for obj_id, info in index["dobj"].items():
                if obj_id in game_data.objects:
                    game_data.objects[obj_id].owner = info["owner"]
                    game_data.objects[obj_id].state = info["state"]
                    game_data.objects[obj_id].class_data = info["class_data"]

        # Aggregate room-level transitions from (a) non-verb scripts and
        # (b) per-verb analyses on each object.  Also pluck verb-name
        # bindings out of any script that calls verbOps SO_VERB_INIT/NAME.
        max_room = max(game_data.rooms.keys()) if game_data.rooms else 0
        for room in game_data.rooms.values():
            targets: set = set()
            for script in room.scripts:
                raw = script.raw
                # LSCR scripts have a 1-byte script number prefix
                if script.script_type == "local" and raw:
                    raw = raw[1:]
                analysis = analyze_script(raw, max_room=max_room)
                targets.update(analysis.transitions)
                for vid, name in analysis.verb_names.items():
                    game_data.verb_names.setdefault(vid, name)
            for obj in room.objects:
                for v in obj.verbs:
                    targets.update(v.transitions)
            targets.discard(room.room_id)
            room.transitions = sorted(targets)

        return game_data

    def _parse_loff(self, data: bytes) -> Dict[int, int]:
        """Parse LOFF chunk: room_id -> absolute offset mapping."""
        num_rooms = data[0]
        rooms = {}
        for i in range(num_rooms):
            room_id = data[1 + i * 5]
            offset = struct.unpack_from("<I", data, 2 + i * 5)[0]
            rooms[room_id] = offset
        return rooms

    def _parse_lflf(
        self, data: bytes, start: int, end: int, room_id: int
    ) -> Room:
        """Parse a single LFLF block and its children."""
        room = Room(room_id=room_id)

        for tag, size, chunk_data, abs_offset in self.read_chunks(data, start + 8, end):
            if tag == "ROOM":
                self._parse_room_chunk(data, abs_offset, abs_offset + size, room)
            elif tag == "SCRP":
                room.scripts.append(
                    ScriptData(
                        script_type="global",
                        offset=abs_offset,
                        size=size,
                        raw=chunk_data,
                    )
                )

        return room

    def _parse_room_chunk(
        self, data: bytes, start: int, end: int, room: Room
    ) -> None:
        """Parse ROOM sub-chunks: RMHD, OBCD, EXCD, ENCD, LSCR, etc."""
        local_script_idx = 0

        for tag, size, chunk_data, abs_offset in self.read_chunks(
            data, start + 8, end
        ):
            if tag == "RMHD":
                room.width, room.height, room.num_objects = struct.unpack_from(
                    "<HHH", chunk_data, 0
                )
            elif tag == "OBCD":
                obj = self._parse_obcd(chunk_data, room.room_id)
                if obj:
                    room.objects.append(obj)
            elif tag == "EXCD":
                room.scripts.append(
                    ScriptData(
                        script_type="exit",
                        offset=abs_offset,
                        size=size,
                        raw=chunk_data,
                    )
                )
            elif tag == "ENCD":
                room.scripts.append(
                    ScriptData(
                        script_type="entry",
                        offset=abs_offset,
                        size=size,
                        raw=chunk_data,
                    )
                )
            elif tag == "LSCR":
                room.scripts.append(
                    ScriptData(
                        script_type="local",
                        index=local_script_idx,
                        offset=abs_offset,
                        size=size,
                        raw=chunk_data,
                    )
                )
                local_script_idx += 1

    def _parse_obcd(self, data: bytes, room_id: int) -> Optional[ScummObject]:
        """Parse an OBCD block into a ScummObject."""
        obj = ScummObject(object_id=0, room_id=room_id)
        verb_raw: Optional[bytes] = None

        offset = 0
        while offset + 8 <= len(data):
            tag = data[offset : offset + 4].decode("ascii", errors="replace")
            size = struct.unpack_from(">I", data, offset + 4)[0]
            if size < 8 or offset + size > len(data):
                break
            inner = data[offset + 8 : offset + size]

            if tag == "CDHD":
                self._parse_cdhd(inner, obj)
            elif tag == "OBNA":
                name = inner.split(b"\x00")[0].decode("ascii", errors="replace")
                obj.name = name if name else None
            elif tag == "VERB":
                obj.verbs = self._parse_verb_table(inner)
                verb_raw = inner

            offset += size

        if obj.object_id == 0:
            return None
        if verb_raw is not None and obj.verbs:
            self._analyze_verbs(obj, verb_raw)
        return obj

    def _analyze_verbs(self, obj: ScummObject, verb_raw: bytes) -> None:
        """Split the verb bytecode per verb offset and analyze each segment.

        Each verb_id points at a script offset within the VERB chunk data.
        A verb's script runs from its offset to the next distinct offset
        (or the end of the chunk).  Multiple verb_ids sharing an offset
        get the same analysis.
        """
        offsets = sorted({v.offset for v in obj.verbs})
        if not offsets:
            return
        boundaries = offsets + [len(verb_raw)]
        analyses = {}
        for start, end in zip(boundaries[:-1], boundaries[1:]):
            if start >= end:
                continue
            analyses[start] = analyze_script(verb_raw[start:end])
        for v in obj.verbs:
            a = analyses.get(v.offset)
            if a is None:
                continue
            v.dialogue = list(a.dialogue)
            v.effects = list(a.effects)
            v.preconditions = list(a.preconditions)
            v.transitions = sorted(a.transitions)

    def _parse_cdhd(self, data: bytes, obj: ScummObject) -> None:
        """Parse CDHD (object code header): id, position, flags."""
        if len(data) < 13:
            return
        obj.object_id = struct.unpack_from("<H", data, 0)[0]
        obj.x, obj.y = struct.unpack_from("<HH", data, 2)
        obj.width, obj.height = struct.unpack_from("<HH", data, 6)
        obj.parent_state = data[10]
        obj.parent = data[11]
        if len(data) >= 17:
            obj.actor_dir = data[16]

    def _parse_verb_table(self, data: bytes) -> List[VerbEntry]:
        """Parse verb entries into offsets within the VERB chunk data.

        Each entry is (uint8 verb_id, uint16 LE offset) terminated by 0.
        Per ScummVM's findVerbEntrypoint, the stored offset is relative to
        the start of the VERB chunk *header* (tag + size).  Since we
        operate on the chunk data (already past the 8-byte header), we
        subtract 8 to get a data-relative offset.
        """
        verbs = []
        entry_offset = 0
        while entry_offset + 3 <= len(data):
            verb_id = data[entry_offset]
            if verb_id == 0:
                break
            hdr_offset = struct.unpack_from("<H", data, entry_offset + 1)[0]
            data_offset = hdr_offset - 8  # _resourceHeaderSize = 8 in v6
            verbs.append(VerbEntry(verb_id=verb_id, offset=data_offset))
            entry_offset += 3
        return verbs

    # --- high-level API ------------------------------------------------------

    def parse_game(self, index_path: str, data_path: str) -> GameData:
        """Parse both index and data files into a complete GameData."""
        index = self.parse_index(index_path)
        game_data = self.parse_data(data_path, index)
        game_data.source = str(Path(data_path).parent)
        return game_data

    # --- output --------------------------------------------------------------

    def save_json(self, game_data: GameData, output_path: str):
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(game_data.dict(), indent=2))
