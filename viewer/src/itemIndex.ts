import type { GameData, Room, ScummObject } from "./types";

/** Where in the game an item is referenced (acquired, required, or mutated). */
export interface ItemReference {
  roomId: number;
  sourceObjectId: number;
  sourceObjectName: string | null;
  verbId: number;
  /** Optional state value (for setState references). */
  value?: number;
}

/** Aggregated cross-references for a single item across the whole game. */
export interface ItemRecord {
  objectId: number;
  name: string | null;
  /** Rooms where the item physically lives (object's home room). */
  homeRoomId: number | null;
  acquiredAt: ItemReference[];
  requiredAt: ItemReference[];
  stateChangedAt: ItemReference[];
}

export interface ItemIndex {
  items: Record<number, ItemRecord>;
  /** Sorted list of item IDs that have any cross-reference. */
  ordered: number[];
}

function nameForObject(game: GameData, objectId: number): string | null {
  // Prefer the global object directory (covers items that live in inventory
  // and aren't placed in any specific room).
  const global = game.objects[String(objectId)];
  if (global?.name) return global.name;
  for (const room of Object.values(game.rooms)) {
    const o = room.objects.find((x) => x.object_id === objectId);
    if (o?.name) return o.name;
  }
  return null;
}

function homeRoom(game: GameData, objectId: number): number | null {
  for (const room of Object.values(game.rooms)) {
    if (room.objects.some((o) => o.object_id === objectId)) {
      return room.room_id;
    }
  }
  return null;
}

function ensureRecord(
  index: Record<number, ItemRecord>,
  game: GameData,
  objectId: number,
): ItemRecord {
  if (!index[objectId]) {
    index[objectId] = {
      objectId,
      name: nameForObject(game, objectId),
      homeRoomId: homeRoom(game, objectId),
      acquiredAt: [],
      requiredAt: [],
      stateChangedAt: [],
    };
  }
  return index[objectId];
}

function makeRef(
  room: Room,
  source: ScummObject,
  verbId: number,
  value?: number,
): ItemReference {
  return {
    roomId: room.room_id,
    sourceObjectId: source.object_id,
    sourceObjectName: source.name,
    verbId,
    value,
  };
}

/** Build a cross-reference index of every item mentioned by the scripts. */
export function buildItemIndex(game: GameData): ItemIndex {
  const items: Record<number, ItemRecord> = {};

  for (const room of Object.values(game.rooms)) {
    for (const source of room.objects) {
      for (const verb of source.verbs) {
        for (const eff of verb.effects) {
          if (eff.type === "pickupObject") {
            ensureRecord(items, game, eff.object).acquiredAt.push(
              makeRef(room, source, verb.verb_id),
            );
          } else if (eff.type === "setOwner") {
            ensureRecord(items, game, eff.object).acquiredAt.push(
              makeRef(room, source, verb.verb_id, eff.owner),
            );
          } else if (eff.type === "setState") {
            ensureRecord(items, game, eff.object).stateChangedAt.push(
              makeRef(room, source, verb.verb_id, eff.value),
            );
          }
        }
        for (const pre of verb.preconditions) {
          if (pre.type === "owns") {
            ensureRecord(items, game, pre.object).requiredAt.push(
              makeRef(room, source, verb.verb_id),
            );
          } else if (pre.type === "state") {
            ensureRecord(items, game, pre.object).requiredAt.push(
              makeRef(room, source, verb.verb_id, pre.equals),
            );
          }
        }
      }
    }
  }

  const ordered = Object.keys(items)
    .map(Number)
    .sort((a, b) => {
      // Sort items with names first, then by ID.
      const an = items[a].name ? 0 : 1;
      const bn = items[b].name ? 0 : 1;
      if (an !== bn) return an - bn;
      const ra = items[a].acquiredAt.length + items[a].requiredAt.length;
      const rb = items[b].acquiredAt.length + items[b].requiredAt.length;
      if (ra !== rb) return rb - ra;
      return a - b;
    });

  return { items, ordered };
}
