import type { ItemRecord, ItemReference } from "../itemIndex";
import { ObjectSprite } from "./ObjectSprite";

interface Props {
  gameId: string;
  item: ItemRecord;
  roomLabels: Record<number, string | null>;
  verbNames: Record<string, string>;
  onNavigateRoom: (roomId: number) => void;
  onNavigateItem: (itemId: number) => void;
}

function verbLabel(id: number, verbNames: Record<string, string>): string {
  const name = verbNames[String(id)];
  return name ? `${name} (${id})` : `verb ${id}`;
}

function ReferenceList({
  refs,
  roomLabels,
  verbNames,
  emptyText,
  onNavigateRoom,
  showValue = false,
  valueLabel = "value",
}: {
  refs: ItemReference[];
  roomLabels: Record<number, string | null>;
  verbNames: Record<string, string>;
  emptyText: string;
  onNavigateRoom: (roomId: number) => void;
  showValue?: boolean;
  valueLabel?: string;
}) {
  if (refs.length === 0) {
    return <p className="muted">{emptyText}</p>;
  }
  return (
    <ul className="ref-list">
      {refs.map((ref, i) => {
        const roomLabel = roomLabels[ref.roomId] ?? `Room ${ref.roomId}`;
        return (
          <li key={i}>
            <button
              className="ref"
              onClick={() => onNavigateRoom(ref.roomId)}
              title={`Go to room ${ref.roomId}`}
            >
              <span className="ref-room">Room {ref.roomId}</span>
              <span className="ref-room-name">{roomLabel}</span>
              <span className="ref-source">
                via {verbLabel(ref.verbId, verbNames)} on{" "}
                <strong>
                  {ref.sourceObjectName ?? `#${ref.sourceObjectId}`}
                </strong>
              </span>
              {showValue && ref.value != null ? (
                <span className="ref-value">
                  {valueLabel}={ref.value}
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function ItemDetails({
  gameId,
  item,
  roomLabels,
  verbNames,
  onNavigateRoom,
}: Props) {
  const spriteUrl = `${import.meta.env.BASE_URL}games/${gameId}/objects/obj_${item.objectId}_1.png`;
  return (
    <main className="room-details">
      <header className="item-head">
        <ObjectSprite url={spriteUrl} />
        <div>
          <h2>
            {item.name ?? <em>(unnamed item)</em>}
            <span className="dims">
              #{item.objectId}
              {item.homeRoomId != null ? <> · home: Room {item.homeRoomId}</> : null}
            </span>
          </h2>
          <div className="summary">
            {item.acquiredAt.length} acquisition site
            {item.acquiredAt.length === 1 ? "" : "s"} ·{" "}
            {item.requiredAt.length} requirement check
            {item.requiredAt.length === 1 ? "" : "s"} ·{" "}
            {item.stateChangedAt.length} state change
            {item.stateChangedAt.length === 1 ? "" : "s"}
          </div>
        </div>
      </header>

      <section>
        <h3>Acquired in</h3>
        <ReferenceList
          refs={item.acquiredAt}
          roomLabels={roomLabels}
          verbNames={verbNames}
          emptyText="No script picks up or grants ownership of this item."
          onNavigateRoom={onNavigateRoom}
          showValue
          valueLabel="actor"
        />
      </section>

      <section>
        <h3>Required by</h3>
        <ReferenceList
          refs={item.requiredAt}
          roomLabels={roomLabels}
          verbNames={verbNames}
          emptyText="No script checks ownership or state of this item."
          onNavigateRoom={onNavigateRoom}
          showValue
          valueLabel="state"
        />
      </section>

      {item.stateChangedAt.length > 0 ? (
        <section>
          <h3>State changes</h3>
          <ReferenceList
            refs={item.stateChangedAt}
            roomLabels={roomLabels}
            verbNames={verbNames}
            emptyText=""
            onNavigateRoom={onNavigateRoom}
            showValue
            valueLabel="→"
          />
        </section>
      ) : null}
    </main>
  );
}
