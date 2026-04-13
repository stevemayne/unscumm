import type { ItemIndex } from "../itemIndex";

interface Props {
  items: ItemIndex;
  selectedItemId: number | null;
  onSelect: (id: number) => void;
}

export function ItemList({ items, selectedItemId, onSelect }: Props) {
  return (
    <aside className="room-list">
      <h2>Items</h2>
      <ul>
        {items.ordered.map((id) => {
          const it = items.items[id];
          const acquired = it.acquiredAt.length;
          const required = it.requiredAt.length;
          return (
            <li key={id}>
              <button
                className={id === selectedItemId ? "selected" : undefined}
                onClick={() => onSelect(id)}
              >
                <span className="room-id">{id}</span>
                <span className="room-label">
                  {it.name ?? <em className="muted">(unnamed)</em>}
                </span>
                <span className="room-badge">
                  {acquired}/{required}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
