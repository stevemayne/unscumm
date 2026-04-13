import type { GameData } from "./types";

/** A single dialogue line in context. */
export interface DialogueEntry {
  roomId: number;
  objectId: number;
  objectName: string | null;
  verbId: number;
  line: string;
  /** Lower-cased copy for case-insensitive search. */
  lc: string;
}

export interface DialogueIndex {
  /** Every non-empty dialogue line with its origin. */
  entries: DialogueEntry[];
}

export function buildDialogueIndex(game: GameData): DialogueIndex {
  const entries: DialogueEntry[] = [];
  for (const room of Object.values(game.rooms)) {
    for (const obj of room.objects) {
      for (const v of obj.verbs) {
        for (const line of v.dialogue) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          entries.push({
            roomId: room.room_id,
            objectId: obj.object_id,
            objectName: obj.name,
            verbId: v.verb_id,
            line: trimmed,
            lc: trimmed.toLowerCase(),
          });
        }
      }
    }
  }
  return { entries };
}

/** Substring search; returns at most `limit` matches. */
export function searchDialogue(
  index: DialogueIndex,
  query: string,
  limit = 200,
): DialogueEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: DialogueEntry[] = [];
  for (const e of index.entries) {
    if (e.lc.includes(q)) {
      out.push(e);
      if (out.length >= limit) break;
    }
  }
  return out;
}
