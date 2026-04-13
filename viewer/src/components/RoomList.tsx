import type { Room } from "../types";

interface Props {
  rooms: Room[];
  selectedRoomId: number | null;
  onSelect: (id: number) => void;
}

export function RoomList({ rooms, selectedRoomId, onSelect }: Props) {
  return (
    <aside className="room-list">
      <h2>Rooms</h2>
      <ul>
        {rooms.map((room) => {
          const label =
            room.objects.find((o) => o.name)?.name ?? "(unnamed)";
          return (
            <li key={room.room_id}>
              <button
                className={
                  room.room_id === selectedRoomId ? "selected" : undefined
                }
                onClick={() => onSelect(room.room_id)}
              >
                <span className="room-id">{room.room_id}</span>
                <span className="room-label">{label}</span>
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
