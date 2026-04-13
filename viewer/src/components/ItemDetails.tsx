import type { ItemRecord, ItemReference } from "../itemIndex";

interface Props {
  item: ItemRecord;
  roomLabels: Record<number, string | null>;
  onNavigateRoom: (roomId: number) => void;
  onNavigateItem: (itemId: number) => void;
}

const VERB_NAMES: Record<number, string> = {
  1: "Give",
  2: "Pick up",
  3: "Use",
  4: "Open",
  5: "Look at",
  6: "Push",
  7: "Close",
  8: "Look at",
  9: "Talk to",
  10: "Pull",
  11: "Turn on",
  12: "Turn off",
  13: "What is",
  23: "Use",
  26: "Walk to",
};

function verbLabel(id: number): string {
  return VERB_NAMES[id] ? `${VERB_NAMES[id]} (${id})` : `verb ${id}`;
}

function ReferenceList({
  refs,
  roomLabels,
  emptyText,
  onNavigateRoom,
  showValue = false,
  valueLabel = "value",
}: {
  refs: ItemReference[];
  roomLabels: Record<number, string | null>;
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
                via {verbLabel(ref.verbId)} on{" "}
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
  item,
  roomLabels,
  onNavigateRoom,
}: Props) {
  return (
    <main className="room-details">
      <header>
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
      </header>

      <section>
        <h3>Acquired in</h3>
        <ReferenceList
          refs={item.acquiredAt}
          roomLabels={roomLabels}
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
