import { useState } from "react";
import type { Room } from "../types";

interface Props {
  gameId: string;
  room: Room;
  selectedObjectId: number | null;
  onSelectObject: (objectId: number | null) => void;
}

/**
 * Room background + clickable object hit zones.  Named objects get a
 * teal outline; unnamed hotspots a dashed purple outline.  Hovering
 * shows details; clicking selects an object so its verbs render in the
 * interactions panel.
 */
export function RoomMap({ gameId, room, selectedObjectId, onSelectObject }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);
  const displayId = hovered ?? selectedObjectId;

  return (
    <div className="room-map">
      <svg
        viewBox={`0 0 ${room.width} ${room.height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <image
          href={`${import.meta.env.BASE_URL}games/${gameId}/rooms/room_${room.room_id}.png`}
          x={0}
          y={0}
          width={room.width}
          height={room.height}
          preserveAspectRatio="none"
          style={{ imageRendering: "pixelated" }}
        />
        {room.objects.map((o) => {
          const isHovered = hovered === o.object_id;
          const isSelected = selectedObjectId === o.object_id;
          return (
            <rect
              key={o.object_id}
              x={o.x}
              y={o.y}
              width={Math.max(o.width, 2)}
              height={Math.max(o.height, 2)}
              className={
                "obj" +
                (o.name ? " named" : "") +
                (isHovered ? " hovered" : "") +
                (isSelected ? " selected" : "")
              }
              onMouseEnter={() => setHovered(o.object_id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() =>
                onSelectObject(isSelected ? null : o.object_id)
              }
            >
              <title>
                #{o.object_id} {o.name ?? "(unnamed)"}
              </title>
            </rect>
          );
        })}
      </svg>
      {displayId != null ? (
        <div className="hover-label">
          {(() => {
            const o = room.objects.find((x) => x.object_id === displayId);
            if (!o) return null;
            return (
              <>
                <strong>#{o.object_id}</strong>{" "}
                {o.name ?? <em>(unnamed)</em>} — ({o.x},{o.y}) {o.width}×
                {o.height}
                {o.verbs.length > 0 ? (
                  <> · {o.verbs.length} verb(s)</>
                ) : null}
              </>
            );
          })()}
        </div>
      ) : (
        <div className="hover-label muted">
          click an object to see its verbs
        </div>
      )}
    </div>
  );
}
