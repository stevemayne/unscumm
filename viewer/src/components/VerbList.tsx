import type { VerbIndex } from "../verbIndex";

interface Props {
  verbs: VerbIndex;
  selectedVerbId: number | null;
  onSelect: (id: number) => void;
}

export function VerbList({ verbs, selectedVerbId, onSelect }: Props) {
  return (
    <aside className="room-list">
      <h2>Verbs</h2>
      <ul>
        {verbs.ordered.map((id) => {
          const v = verbs.verbs[id];
          return (
            <li key={id}>
              <button
                className={id === selectedVerbId ? "selected" : undefined}
                onClick={() => onSelect(id)}
              >
                <span className="room-id">{id}</span>
                <span className="room-label">
                  {v.name ?? <em className="muted">(verb {id})</em>}
                </span>
                <span className="room-badge">{v.implementations.length}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
