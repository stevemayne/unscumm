import type { Effect, GameData, Precondition } from "./types";

/** A single object/verb implementation: where this verb is bound to a script. */
export interface VerbImplementation {
  roomId: number;
  objectId: number;
  objectName: string | null;
  dialogue: string[];
  effects: Effect[];
  preconditions: Precondition[];
}

export interface VerbRecord {
  verbId: number;
  /** Name from `game.verb_names` if present, else null. */
  name: string | null;
  implementations: VerbImplementation[];
  effectTypeCounts: Record<string, number>;
  totalDialogueLines: number;
  roomCount: number;
}

export interface VerbIndex {
  verbs: Record<number, VerbRecord>;
  /** Verb IDs ordered for display: named first, then by usage. */
  ordered: number[];
}

export function buildVerbIndex(game: GameData): VerbIndex {
  const verbs: Record<number, VerbRecord> = {};
  const verbNames = game.verb_names ?? {};

  for (const room of Object.values(game.rooms)) {
    for (const obj of room.objects) {
      for (const v of obj.verbs) {
        const rec =
          verbs[v.verb_id] ??
          (verbs[v.verb_id] = {
            verbId: v.verb_id,
            name: verbNames[String(v.verb_id)] ?? null,
            implementations: [],
            effectTypeCounts: {},
            totalDialogueLines: 0,
            roomCount: 0,
          });
        rec.implementations.push({
          roomId: room.room_id,
          objectId: obj.object_id,
          objectName: obj.name,
          dialogue: v.dialogue,
          effects: v.effects,
          preconditions: v.preconditions,
        });
        rec.totalDialogueLines += v.dialogue.length;
        for (const eff of v.effects) {
          rec.effectTypeCounts[eff.type] =
            (rec.effectTypeCounts[eff.type] ?? 0) + 1;
        }
      }
    }
  }

  // Compute distinct room counts per verb.
  for (const rec of Object.values(verbs)) {
    rec.roomCount = new Set(rec.implementations.map((i) => i.roomId)).size;
  }

  // Order: named verbs first (sorted by ID), then unnamed verbs by usage count.
  const named = Object.values(verbs)
    .filter((r) => r.name)
    .sort((a, b) => a.verbId - b.verbId)
    .map((r) => r.verbId);
  const unnamed = Object.values(verbs)
    .filter((r) => !r.name)
    .sort((a, b) => b.implementations.length - a.implementations.length)
    .map((r) => r.verbId);

  return { verbs, ordered: [...named, ...unnamed] };
}
