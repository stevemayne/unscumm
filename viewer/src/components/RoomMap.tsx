import { useState } from "react";
import type { Room, Walkbox } from "../types";

interface Props {
  gameId: string;
  room: Room;
  selectedObjectId: number | null;
  onSelectObject: (objectId: number | null) => void;
}

/** Walkbox 0 in many SCUMM games is a sentinel with corners at (-32000,…). */
function isRealBox(w: Walkbox): boolean {
  return w.corners.every(([x, y]) => x > -1000 && y > -1000 && x < 4000 && y < 4000);
}

/**
 * Room background + clickable object hit zones.  Named objects get a
 * teal outline; unnamed hotspots a dashed purple outline.  Hovering
 * shows details; clicking selects an object so its verbs render in the
 * interactions panel.  Toggle "Walkboxes" to overlay the actor-walkable
 * polygons defined in the room's BOXD chunk.
 */
export function RoomMap({ gameId, room, selectedObjectId, onSelectObject }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [showWalkboxes, setShowWalkboxes] = useState(false);
  const [showObjects, setShowObjects] = useState(true);
  const displayId = hovered ?? selectedObjectId;

  const realBoxes = room.walkboxes.filter(isRealBox);

  return (
    <div className="room-map">
      <div className="room-map-toggles">
        <label>
          <input
            type="checkbox"
            checked={showObjects}
            onChange={(e) => setShowObjects(e.target.checked)}
          />
          Object hit zones ({room.objects.length})
        </label>
        <label>
          <input
            type="checkbox"
            checked={showWalkboxes}
            onChange={(e) => setShowWalkboxes(e.target.checked)}
            disabled={realBoxes.length === 0}
          />
          Walkboxes ({realBoxes.length})
        </label>
      </div>
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
        {showWalkboxes
          ? realBoxes.map((w) => (
              <polygon
                key={w.index}
                className="walkbox"
                points={w.corners.map(([x, y]) => `${x},${y}`).join(" ")}
              >
                <title>
                  walkbox {w.index} · mask=0x{w.mask.toString(16)} · scale={w.scale}
                </title>
              </polygon>
            ))
          : null}
        {showObjects
          ? room.objects.map((o) => {
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
            })
          : null}
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
