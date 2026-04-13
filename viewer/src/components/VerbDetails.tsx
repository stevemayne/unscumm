import { useMemo, useState } from "react";
import type { VerbRecord } from "../verbIndex";

interface Props {
  verb: VerbRecord;
  roomLabels: Record<number, string | null>;
  onNavigateRoom: (roomId: number) => void;
}

const EFFECT_LABELS: Record<string, string> = {
  pickupObject: "pickupObject",
  setOwner: "setOwner",
  setState: "setState",
  startScript: "startScript",
  startObject: "startObject",
  loadRoom: "loadRoom",
  loadRoomWithEgo: "loadRoomWithEgo",
};

export function VerbDetails({ verb, roomLabels, onNavigateRoom }: Props) {
  const [filter, setFilter] = useState("");

  const effectRows = useMemo(
    () =>
      Object.entries(verb.effectTypeCounts).sort((a, b) => b[1] - a[1]),
    [verb],
  );

  const filtered = useMemo(() => {
    if (!filter.trim()) return verb.implementations;
    const f = filter.toLowerCase();
    return verb.implementations.filter((impl) => {
      if (impl.objectName?.toLowerCase().includes(f)) return true;
      if (impl.dialogue.some((s) => s.toLowerCase().includes(f))) return true;
      return false;
    });
  }, [verb, filter]);

  // Pick a few representative dialogue samples (first one per object that has any).
  const dialogueSamples = useMemo(() => {
    const out: { object: string; line: string; roomId: number }[] = [];
    const seenObjects = new Set<string>();
    for (const impl of verb.implementations) {
      const objKey = impl.objectName ?? `#${impl.objectId}`;
      if (seenObjects.has(objKey)) continue;
      const line = impl.dialogue.find((s) => s.trim().length > 0);
      if (!line) continue;
      seenObjects.add(objKey);
      out.push({ object: objKey, line, roomId: impl.roomId });
      if (out.length >= 8) break;
    }
    return out;
  }, [verb]);

  return (
    <main className="room-details">
      <header>
        <h2>
          {verb.name ?? <em>(unnamed verb)</em>}
          <span className="dims">
            #{verb.verbId} ·{" "}
            {verb.implementations.length} implementations across{" "}
            {verb.roomCount} rooms
          </span>
        </h2>
        <div className="summary">
          {verb.totalDialogueLines} dialogue lines · {effectRows.length} effect type
          {effectRows.length === 1 ? "" : "s"}
        </div>
      </header>

      {effectRows.length > 0 ? (
        <section>
          <h3>Effect breakdown</h3>
          <table className="objects">
            <thead>
              <tr>
                <th>Effect</th>
                <th>Count</th>
                <th>Share</th>
              </tr>
            </thead>
            <tbody>
              {effectRows.map(([type, count]) => {
                const total = effectRows.reduce((s, [, c]) => s + c, 0);
                const pct = ((count / total) * 100).toFixed(1);
                return (
                  <tr key={type}>
                    <td>{EFFECT_LABELS[type] ?? type}</td>
                    <td>{count}</td>
                    <td>
                      <div className="bar-cell">
                        <div className="bar" style={{ width: `${pct}%` }} />
                        <span>{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ) : null}

      {dialogueSamples.length > 0 ? (
        <section>
          <h3>Sample dialogue</h3>
          <ul className="verb-samples">
            {dialogueSamples.map((s, i) => (
              <li key={i}>
                <button
                  className="verb-sample"
                  onClick={() => onNavigateRoom(s.roomId)}
                  title={`Room ${s.roomId}`}
                >
                  <span className="verb-sample-obj">{s.object}</span>
                  <span className="verb-sample-line">{s.line}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h3>Implementations ({verb.implementations.length})</h3>
        <div className="verb-filter">
          <input
            type="text"
            placeholder="Filter by object or dialogue…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          {filter ? (
            <span className="muted">
              showing {filtered.length} of {verb.implementations.length}
            </span>
          ) : null}
        </div>
        <ul className="ref-list">
          {filtered.slice(0, 200).map((impl, i) => {
            const roomLabel =
              roomLabels[impl.roomId] ?? `Room ${impl.roomId}`;
            return (
              <li key={i}>
                <button
                  className="ref"
                  onClick={() => onNavigateRoom(impl.roomId)}
                >
                  <span className="ref-room">Room {impl.roomId}</span>
                  <span className="ref-room-name">{roomLabel}</span>
                  <span className="ref-source">
                    on{" "}
                    <strong>
                      {impl.objectName ?? `#${impl.objectId}`}
                    </strong>
                    {impl.dialogue.length > 0 ? (
                      <> — {impl.dialogue.length} line(s)</>
                    ) : null}
                    {impl.effects.length > 0 ? (
                      <> · {impl.effects.length} effect(s)</>
                    ) : null}
                    {impl.preconditions.length > 0 ? (
                      <> · {impl.preconditions.length} pre</>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
          {filtered.length > 200 ? (
            <li className="muted">
              showing first 200 of {filtered.length}
            </li>
          ) : null}
        </ul>
      </section>
    </main>
  );
}
