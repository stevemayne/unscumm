import type { Room } from "../types";

interface Props {
  gameId: string;
  room: Room;
  roomLabels: Record<number, string | null>;
  onSelectRoom: (id: number) => void;
  onOpenInRooms: (id: number) => void;
  onClose: () => void;
}

/**
 * Side panel for the scene graph view: shows the selected room's
 * background thumbnail, key metadata, and a clickable list of exits.
 * Includes a button to jump into the full Rooms view.
 */
export function GraphRoomPanel({
  gameId,
  room,
  roomLabels,
  onSelectRoom,
  onOpenInRooms,
  onClose,
}: Props) {
  const label = roomLabels[room.room_id];
  const namedObjects = room.objects.filter((o) => o.name);
  const bgUrl = `${import.meta.env.BASE_URL}games/${gameId}/rooms/room_${room.room_id}.png`;

  return (
    <aside className="graph-panel">
      <header className="graph-panel-head">
        <div>
          <h3>
            Room {room.room_id}
            {label ? <span className="graph-panel-label">· {label}</span> : null}
          </h3>
          <div className="graph-panel-dims">
            {room.width} × {room.height}
          </div>
        </div>
        <button
          className="graph-panel-close"
          onClick={onClose}
          aria-label="Close panel"
        >
          ×
        </button>
      </header>

      <div className="graph-panel-thumb">
        <img src={bgUrl} alt={`Room ${room.room_id} background`} />
      </div>

      <div className="graph-panel-stats">
        <div>
          <span className="num">{room.objects.length}</span>{" "}
          <span className="key">objects</span>
        </div>
        <div>
          <span className="num">{room.scripts.length}</span>{" "}
          <span className="key">scripts</span>
        </div>
        <div>
          <span className="num">{room.transitions.length}</span>{" "}
          <span className="key">exits</span>
        </div>
      </div>

      <button
        className="graph-panel-open"
        onClick={() => onOpenInRooms(room.room_id)}
      >
        Open in Rooms view →
      </button>

      {namedObjects.length > 0 ? (
        <section>
          <h4>Named objects</h4>
          <ul className="graph-panel-objs">
            {namedObjects.slice(0, 10).map((o) => (
              <li key={o.object_id}>
                <span className="oid">#{o.object_id}</span> {o.name}
              </li>
            ))}
            {namedObjects.length > 10 ? (
              <li className="muted">
                …and {namedObjects.length - 10} more
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}

      {room.transitions.length > 0 ? (
        <section>
          <h4>Exits</h4>
          <ul className="graph-panel-exits">
            {room.transitions.map((target) => {
              const tlabel = roomLabels[target];
              return (
                <li key={target}>
                  <button onClick={() => onSelectRoom(target)}>
                    → Room {target}
                    {tlabel ? (
                      <span className="target-name">{tlabel}</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </aside>
  );
}
