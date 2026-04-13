import { useEffect, useMemo, useRef, useState } from "react";
import {
  searchDialogue,
  type DialogueEntry,
  type DialogueIndex,
} from "../dialogueIndex";

interface Props {
  index: DialogueIndex;
  initialQuery: string;
  roomLabels: Record<number, string | null>;
  verbNames: Record<string, string>;
  onQueryChange: (q: string) => void;
  onNavigateRoom: (id: number) => void;
}

const RESULT_LIMIT = 250;

function highlight(text: string, q: string): React.ReactNode {
  if (!q) return text;
  const lc = text.toLowerCase();
  const lq = q.toLowerCase();
  const out: React.ReactNode[] = [];
  let pos = 0;
  while (pos < text.length) {
    const i = lc.indexOf(lq, pos);
    if (i < 0) {
      out.push(text.slice(pos));
      break;
    }
    if (i > pos) out.push(text.slice(pos, i));
    out.push(
      <mark key={i}>{text.slice(i, i + lq.length)}</mark>,
    );
    pos = i + lq.length;
  }
  return out;
}

export function SearchView({
  index,
  initialQuery,
  roomLabels,
  verbNames,
  onQueryChange,
  onNavigateRoom,
}: Props) {
  const [draft, setDraft] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external URL changes back into the input.
  useEffect(() => {
    setDraft(initialQuery);
  }, [initialQuery]);

  // Auto-focus on mount.
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const results: DialogueEntry[] = useMemo(
    () => searchDialogue(index, initialQuery, RESULT_LIMIT),
    [index, initialQuery],
  );

  const totalMatches = useMemo(() => {
    if (!initialQuery.trim()) return 0;
    const q = initialQuery.trim().toLowerCase();
    return index.entries.reduce((n, e) => n + (e.lc.includes(q) ? 1 : 0), 0);
  }, [index, initialQuery]);

  return (
    <main className="search-view">
      <header className="search-header">
        <input
          ref={inputRef}
          type="search"
          placeholder="Search dialogue across the game…"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            onQueryChange(e.target.value);
          }}
          spellCheck={false}
          autoComplete="off"
        />
        <div className="search-stats">
          {!initialQuery.trim() ? (
            <span className="muted">
              {index.entries.length.toLocaleString()} dialogue lines indexed
            </span>
          ) : totalMatches === 0 ? (
            <span className="muted">no matches</span>
          ) : (
            <>
              {totalMatches.toLocaleString()} match
              {totalMatches === 1 ? "" : "es"}
              {totalMatches > RESULT_LIMIT ? (
                <span className="muted"> (showing first {RESULT_LIMIT})</span>
              ) : null}
            </>
          )}
        </div>
      </header>

      <div className="search-results">
        {results.map((r, i) => {
          const verbName = verbNames[String(r.verbId)] ?? `verb ${r.verbId}`;
          const roomName = roomLabels[r.roomId];
          return (
            <button
              key={i}
              className="search-result"
              onClick={() => onNavigateRoom(r.roomId)}
            >
              <div className="search-result-meta">
                <span className="search-result-room">Room {r.roomId}</span>
                {roomName ? (
                  <span className="search-result-roomname">{roomName}</span>
                ) : null}
                <span className="search-result-sep">·</span>
                <span className="search-result-obj">
                  {r.objectName ?? `#${r.objectId}`}
                </span>
                <span className="search-result-sep">·</span>
                <span className="search-result-verb">{verbName}</span>
              </div>
              <div className="search-result-line">
                {highlight(r.line, initialQuery)}
              </div>
            </button>
          );
        })}
      </div>
    </main>
  );
}
