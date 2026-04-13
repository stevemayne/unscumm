from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class ChunkInfo:
    tag: str
    size: int
    offset: int


@dataclass
class VerbEntry:
    verb_id: int
    offset: int
    dialogue: List[str] = field(default_factory=list)
    effects: List[Dict] = field(default_factory=list)
    preconditions: List[Dict] = field(default_factory=list)
    transitions: List[int] = field(default_factory=list)


@dataclass
class ScriptData:
    """Metadata for a script block (entry, exit, local, or global)."""

    script_type: str  # "entry", "exit", "local", "global"
    index: Optional[int] = None
    offset: int = 0
    size: int = 0
    raw: bytes = field(default=b"", repr=False)


@dataclass
class ScummObject:
    object_id: int
    name: Optional[str] = None
    room_id: Optional[int] = None
    x: int = 0
    y: int = 0
    width: int = 0
    height: int = 0
    parent: int = 0
    parent_state: int = 0
    actor_dir: int = 0
    verbs: List[VerbEntry] = field(default_factory=list)
    owner: Optional[int] = None
    state: Optional[int] = None
    class_data: int = 0


@dataclass
class Room:
    room_id: int
    name: Optional[str] = None
    width: int = 0
    height: int = 0
    num_objects: int = 0
    objects: List[ScummObject] = field(default_factory=list)
    transitions: List[int] = field(default_factory=list)
    scripts: List[ScriptData] = field(default_factory=list)


@dataclass
class GameData:
    source: str
    chunks: List[ChunkInfo] = field(default_factory=list)
    rooms: Dict[int, Room] = field(default_factory=dict)
    objects: Dict[int, ScummObject] = field(default_factory=dict)

    def add_chunk(self, tag: str, size: int, offset: int):
        self.chunks.append(ChunkInfo(tag=tag, size=size, offset=offset))

    def dict(self) -> Dict:
        return {
            "source": self.source,
            "chunks": [chunk.__dict__ for chunk in self.chunks],
            "rooms": {
                room_id: {
                    "room_id": room.room_id,
                    "name": room.name,
                    "width": room.width,
                    "height": room.height,
                    "num_objects": room.num_objects,
                    "objects": [
                        {
                            "object_id": obj.object_id,
                            "name": obj.name,
                            "room_id": obj.room_id,
                            "x": obj.x,
                            "y": obj.y,
                            "width": obj.width,
                            "height": obj.height,
                            "verbs": [
                                {
                                    "verb_id": v.verb_id,
                                    "offset": v.offset,
                                    "dialogue": list(v.dialogue),
                                    "effects": list(v.effects),
                                    "preconditions": list(v.preconditions),
                                    "transitions": list(v.transitions),
                                }
                                for v in obj.verbs
                            ],
                        }
                        for obj in room.objects
                    ],
                    "scripts": [
                        {
                            "script_type": s.script_type,
                            "index": s.index,
                            "size": s.size,
                        }
                        for s in room.scripts
                    ],
                    "transitions": room.transitions,
                }
                for room_id, room in self.rooms.items()
            },
            "objects": {
                obj_id: {
                    "object_id": obj.object_id,
                    "name": obj.name,
                    "room_id": obj.room_id,
                    "owner": obj.owner,
                    "state": obj.state,
                    "class_data": obj.class_data,
                }
                for obj_id, obj in self.objects.items()
            },
        }
