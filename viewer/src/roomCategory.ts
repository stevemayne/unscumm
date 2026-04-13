import type { GameData } from "./types";

/**
 * Categorise rooms by their position in the transition graph.
 *
 *  - hub      : ≥ 5 outgoing transitions   (well-connected, central)
 *  - terminal : 0 outgoing AND ≥ 2 incoming  (likely meaningful endings)
 *  - dead-end : 0 outgoing AND exactly 1 incoming (intro/cutscene rooms)
 *  - orphan   : 0 outgoing AND 0 incoming    (unreachable via static analysis)
 *  - normal   : everything else (regular gameplay rooms)
 *
 * These are heuristic — SCUMM doesn't store an explicit "end node" — but
 * they're enough to surface the most interesting scene-graph features.
 */
export type RoomCategory = "hub" | "terminal" | "dead-end" | "orphan" | "normal";

export interface RoomDegree {
  in: number;
  out: number;
  category: RoomCategory;
}

const HUB_OUT_MIN = 5;

export function buildRoomDegrees(game: GameData): Record<number, RoomDegree> {
  const inCount: Record<number, number> = {};
  for (const room of Object.values(game.rooms)) {
    for (const t of room.transitions) {
      inCount[t] = (inCount[t] ?? 0) + 1;
    }
  }
  const out: Record<number, RoomDegree> = {};
  for (const room of Object.values(game.rooms)) {
    const o = room.transitions.length;
    const i = inCount[room.room_id] ?? 0;
    let category: RoomCategory;
    if (o >= HUB_OUT_MIN) category = "hub";
    else if (o === 0 && i === 0) category = "orphan";
    else if (o === 0 && i === 1) category = "dead-end";
    else if (o === 0 && i >= 2) category = "terminal";
    else category = "normal";
    out[room.room_id] = { in: i, out: o, category };
  }
  return out;
}

export function categoryLabel(c: RoomCategory): string {
  switch (c) {
    case "hub":
      return "Hub";
    case "terminal":
      return "Terminal candidate";
    case "dead-end":
      return "Dead-end (1 incoming)";
    case "orphan":
      return "Orphan (no traced links)";
    default:
      return "Normal";
  }
}

export function categoryDescription(c: RoomCategory): string {
  switch (c) {
    case "hub":
      return "5+ outgoing transitions — a central, well-connected room.";
    case "terminal":
      return "Multiple incoming transitions, no outgoing — likely a meaningful endpoint.";
    case "dead-end":
      return "Single incoming transition, no outgoing — typical intro/cutscene room.";
    case "orphan":
      return "Not reached by any traced transition (static analysis can't follow variable room numbers).";
    default:
      return "Regular gameplay room.";
  }
}
