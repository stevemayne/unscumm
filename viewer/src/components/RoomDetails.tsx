import type { Room } from "../types";
import { RoomMap } from "./RoomMap";

interface Props {
  gameId: string;
  room: Room;
  allRooms: Record<string, Room>;
  onNavigate: (id: number) => void;
}

export function RoomDetails({ gameId, room, allRooms, onNavigate }: Props) {
  const namedObjects = room.objects.filter((o) => o.name);
  const unnamedCount = room.objects.length - namedObjects.length;

  return (
    <main className="room-details">
      <header>
        <h2>
          Room {room.room_id}
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
        <RoomMap gameId={gameId} room={room} />
      </section>

      <section>
        <h3>Exits → {room.transitions.length}</h3>
        {room.transitions.length === 0 ? (
          <p className="muted">No outgoing transitions discovered by static analysis.</p>
        ) : (
          <ul className="transitions">
            {room.transitions.map((target) => {
              const targetRoom = allRooms[String(target)];
              const name = targetRoom?.objects.find((o) => o.name)?.name;
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
              {namedObjects.map((o) => (
                <tr key={o.object_id}>
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
              ))}
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
