import { useState } from "react";
import type { Room } from "../types";

interface Props {
  gameId: string;
  room: Room;
}

/**
 * Renders the room as an SVG at its native aspect ratio, drawing each
 * object as a rectangle at its (x, y, width, height) position.  Named
 * objects get a subtle fill; unnamed ones (background hotspots) are
 * outlined only.  Hover to see the object's name.
 */
export function RoomMap({ gameId, room }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);

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
          return (
            <g key={o.object_id}>
              <rect
                x={o.x}
                y={o.y}
                width={Math.max(o.width, 2)}
                height={Math.max(o.height, 2)}
                className={
                  "obj" +
                  (o.name ? " named" : "") +
                  (isHovered ? " hovered" : "")
                }
                onMouseEnter={() => setHovered(o.object_id)}
                onMouseLeave={() => setHovered(null)}
              >
                <title>
                  #{o.object_id} {o.name ?? "(unnamed)"}
                </title>
              </rect>
            </g>
          );
        })}
      </svg>
      {hovered != null ? (
        <div className="hover-label">
          {(() => {
            const o = room.objects.find((x) => x.object_id === hovered);
            if (!o) return null;
            return (
              <>
                <strong>#{o.object_id}</strong>{" "}
                {o.name ?? <em>(unnamed)</em>} — ({o.x},{o.y}) {o.width}×{o.height}
              </>
            );
          })()}
        </div>
      ) : (
        <div className="hover-label muted">hover over objects for details</div>
      )}
    </div>
  );
}
