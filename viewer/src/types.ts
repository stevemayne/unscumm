// TypeScript types mirroring scumm_deconstruct.model.GameData.dict() output.

export interface VerbEntry {
  verb_id: number;
  offset: number;
  dialogue: string[];
  effects: Effect[];
  preconditions: Precondition[];
  transitions: number[];
}

export type Effect =
  | { type: "loadRoom"; room: number }
  | { type: "loadRoomWithEgo"; room: number }
  | { type: "pickupObject"; object: number }
  | { type: "setState"; object: number; value: number }
  | { type: "setOwner"; object: number; owner?: number }
  | { type: "startScript"; script: number }
  | { type: "startObject"; object: number };

export type Precondition =
  | { type: "owns"; object: number }
  | { type: "state"; object: number; equals?: number }
  | { type: "class"; object: number; classes: number[] };

export interface ScummObject {
  object_id: number;
  name: string | null;
  room_id: number | null;
  x: number;
  y: number;
  width: number;
  height: number;
  verbs: VerbEntry[];
}

export interface ScriptMeta {
  script_type: "entry" | "exit" | "local" | "global" | "verb";
  index: number | null;
  size: number;
}

export interface Walkbox {
  index: number;
  corners: [number, number][]; // 4 (x, y) pairs: UL, UR, LR, LL
  mask: number;
  flags: number;
  scale: number;
}

export interface Room {
  room_id: number;
  name: string | null;
  width: number;
  height: number;
  num_objects: number;
  objects: ScummObject[];
  scripts: ScriptMeta[];
  walkboxes: Walkbox[];
  transitions: number[];
}

export interface GlobalObjectInfo {
  object_id: number;
  name: string | null;
  room_id: number | null;
  owner: number | null;
  state: number | null;
  class_data: number;
}

export interface GameData {
  source: string;
  chunks: { tag: string; size: number; offset: number }[];
  rooms: Record<string, Room>;
  objects: Record<string, GlobalObjectInfo>;
  /** Verb id (as string for JSON) → human-readable name from verbOps. */
  verb_names: Record<string, string>;
}

export interface GameManifestEntry {
  id: string;
  title: string;
  scumm_version: number;
  rooms: number;
  objects: number;
}

export interface GamesManifest {
  games: GameManifestEntry[];
}
