import { useEffect, useState } from "react";
import type { Room } from "../types";
import { RoomMap } from "./RoomMap";
import { InteractionsPanel } from "./InteractionsPanel";

interface Props {
  gameId: string;
  room: Room;
  roomLabels: Record<number, string | null>;
  verbNames: Record<string, string>;
  onNavigate: (id: number) => void;
}

export function RoomDetails({
  gameId,
  room,
  roomLabels,
  verbNames,
  onNavigate,
}: Props) {
  const [selectedObjectId, setSelectedObjectId] = useState<number | null>(
    null,
  );

  // Clear the selected object when the room changes.
  useEffect(() => {
    setSelectedObjectId(null);
  }, [room.room_id]);

  const selectedObject =
    selectedObjectId != null
      ? room.objects.find((o) => o.object_id === selectedObjectId) ?? null
      : null;

  const namedObjects = room.objects.filter((o) => o.name);
  const unnamedCount = room.objects.length - namedObjects.length;

  return (
    <main className="room-details">
      <header>
        <h2>
          Room {room.room_id}
          {roomLabels[room.room_id] ? (
            <span
              className="room-hint"
              title="Synthesised label: most distinctive named object in the room (SCUMM v6 doesn't store human-readable room names)"
            >
              · {roomLabels[room.room_id]}
            </span>
          ) : null}
          <span className="dims">
            {room.width} × {room.height}
          </span>
        </h2>
        <div className="summary">
          {room.objects.length} objects · {room.scripts.length} scripts ·{" "}
          {room.transitions.length} transitions
        </div>
      </header>

      <section>
        <h3>Scene map</h3>
        <RoomMap
          gameId={gameId}
          room={room}
          selectedObjectId={selectedObjectId}
          onSelectObject={setSelectedObjectId}
        />
      </section>

      {selectedObject ? (
        <section>
          <h3>Interactions</h3>
          <InteractionsPanel
            gameId={gameId}
            room={room}
            object={selectedObject}
            verbNames={verbNames}
            onNavigate={onNavigate}
          />
        </section>
      ) : null}

      <section>
        <h3>Exits → {room.transitions.length}</h3>
        {room.transitions.length === 0 ? (
          <p className="muted">
            No outgoing transitions discovered by static analysis.
          </p>
        ) : (
          <ul className="transitions">
            {room.transitions.map((target) => {
              const name = roomLabels[target];
              return (
                <li key={target}>
                  <button onClick={() => onNavigate(target)}>
                    → Room {target}
                    {name ? <span className="target-name">{name}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h3>Objects ({room.objects.length})</h3>
        {namedObjects.length === 0 ? (
          <p className="muted">No named objects in this room.</p>
        ) : (
          <table className="objects">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Position</th>
                <th>Size</th>
                <th>Verbs</th>
              </tr>
            </thead>
            <tbody>
              {namedObjects.map((o) => {
                const isSelected = o.object_id === selectedObjectId;
                return (
                  <tr
                    key={o.object_id}
                    className={isSelected ? "selected" : undefined}
                    onClick={() =>
                      setSelectedObjectId(isSelected ? null : o.object_id)
                    }
                  >
                    <td>{o.object_id}</td>
                    <td>{o.name}</td>
                    <td>
                      ({o.x}, {o.y})
                    </td>
                    <td>
                      {o.width} × {o.height}
                    </td>
                    <td className="verbs">
                      {o.verbs.map((v) => v.verb_id).join(", ") || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {unnamedCount > 0 ? (
          <p className="muted">…and {unnamedCount} unnamed object(s).</p>
        ) : null}
      </section>

      <section>
        <h3>Scripts ({room.scripts.length})</h3>
        <table className="scripts">
          <thead>
            <tr>
              <th>Type</th>
              <th>Index / Obj</th>
              <th>Size (bytes)</th>
            </tr>
          </thead>
          <tbody>
            {room.scripts.map((s, i) => (
              <tr key={i}>
                <td>{s.script_type}</td>
                <td>{s.index ?? "—"}</td>
                <td>{s.size}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
