import type { Room } from "../types";

interface Props {
  rooms: Room[];
  selectedRoomId: number | null;
  roomLabels: Record<number, string | null>;
  onSelect: (id: number) => void;
}

export function RoomList({
  rooms,
  selectedRoomId,
  roomLabels,
  onSelect,
}: Props) {
  return (
    <aside className="room-list">
      <h2>Rooms</h2>
      <ul>
        {rooms.map((room) => {
          const label = roomLabels[room.room_id];
          return (
            <li key={room.room_id}>
              <button
                className={
                  room.room_id === selectedRoomId ? "selected" : undefined
                }
                onClick={() => onSelect(room.room_id)}
                title={
                  label
                    ? `Room ${room.room_id} — labelled by most distinctive object "${label}"`
                    : `Room ${room.room_id}`
                }
              >
                <span className="room-id">{room.room_id}</span>
                <span className="room-label">
                  {label ?? <em className="muted">(no named objects)</em>}
                </span>
                <span className="room-badge">
                  {room.objects.length}/{room.transitions.length}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
