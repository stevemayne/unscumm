import type { GameData, Room } from "./types";

/**
 * DOTT (and most SCUMM v6 games) don't store human-readable room names in
 * the game files — `RNAM` in the index is either empty or holds only a
 * fixed-size 9-byte slot that DOTT leaves blank.  The viewer synthesises a
 * label from the room's objects instead, picking the most distinctive
 * named object (the one that appears in the fewest rooms elsewhere).
 *
 * Typical result:
 *   Room 13 used to be labelled "door" (appears in 39 rooms) → now
 *   "suggestion box" (appears only in room 13).
 */
export function buildRoomLabels(game: GameData): Record<number, string | null> {
  // Count how many rooms each name appears in.
  const nameRoomCount: Record<string, number> = {};
  for (const room of Object.values(game.rooms)) {
    const seen = new Set<string>();
    for (const obj of room.objects) {
      if (obj.name) seen.add(obj.name);
    }
    for (const name of seen) {
      nameRoomCount[name] = (nameRoomCount[name] ?? 0) + 1;
    }
  }

  // Pick, for each room, the named object whose name appears in the fewest
  // other rooms.  Break ties by the order the object appears in the chunk
  // (stable across rebuilds).
  const labels: Record<number, string | null> = {};
  for (const room of Object.values(game.rooms)) {
    const candidates = room.objects
      .map((o, idx) => ({ name: o.name, idx }))
      .filter((c): c is { name: string; idx: number } => c.name != null);
    if (candidates.length === 0) {
      labels[room.room_id] = null;
      continue;
    }
    candidates.sort((a, b) => {
      const ra = nameRoomCount[a.name] ?? 999;
      const rb = nameRoomCount[b.name] ?? 999;
      if (ra !== rb) return ra - rb;
      return a.idx - b.idx;
    });
    labels[room.room_id] = candidates[0].name;
  }
  return labels;
}

/** Convenience accessor for a single room given a precomputed label map. */
export function labelForRoom(
  room: Room,
  labels: Record<number, string | null>,
): string | null {
  return labels[room.room_id] ?? null;
}
