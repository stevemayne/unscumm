import { useEffect, useMemo, useState } from "react";
import type { GameData, GamesManifest, Room } from "./types";
import { RoomList } from "./components/RoomList";
import { RoomDetails } from "./components/RoomDetails";
import { useLocation } from "./useLocation";
import "./App.css";

const BASE = import.meta.env.BASE_URL;

interface Route {
  gameId: string | null;
  roomId: number | null;
}

const ROUTE_RE = /^\/games\/([^/]+)(?:\/rooms\/(\d+))?\/?$/;

function parseRoute(path: string): Route {
  const m = ROUTE_RE.exec(path);
  if (!m) return { gameId: null, roomId: null };
  return { gameId: m[1], roomId: m[2] != null ? Number(m[2]) : null };
}

function buildRoute(gameId: string, roomId: number | null): string {
  return roomId != null
    ? `/games/${gameId}/rooms/${roomId}`
    : `/games/${gameId}`;
}

export default function App() {
  const { path, navigate } = useLocation();
  const { gameId: urlGameId, roomId: urlRoomId } = parseRoute(path);

  const [manifest, setManifest] = useState<GamesManifest | null>(null);
  const [game, setGame] = useState<GameData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 1. Load the games manifest once at startup.
  useEffect(() => {
    fetch(`${BASE}games.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`games.json HTTP ${r.status}`);
        return r.json();
      })
      .then(setManifest)
      .catch((e) => setError(String(e)));
  }, []);

  // Resolve URL gameId → effective gameId (fall back to first in manifest).
  const effectiveGameId = useMemo<string | null>(() => {
    if (!manifest) return null;
    if (urlGameId && manifest.games.some((g) => g.id === urlGameId)) {
      return urlGameId;
    }
    return manifest.games[0]?.id ?? null;
  }, [manifest, urlGameId]);

  // 2. When the effective game changes, load its parsed.json.
  useEffect(() => {
    if (!effectiveGameId) return;
    setGame(null);
    fetch(`${BASE}games/${effectiveGameId}/parsed.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`parsed.json HTTP ${r.status}`);
        return r.json();
      })
      .then(setGame)
      .catch((e) => setError(String(e)));
  }, [effectiveGameId]);

  // Resolve URL roomId → effective roomId (must exist in loaded game).
  const effectiveRoomId = useMemo<number | null>(() => {
    if (!game) return null;
    if (urlRoomId != null && game.rooms[String(urlRoomId)]) {
      return urlRoomId;
    }
    const sorted = Object.keys(game.rooms).sort(
      (a, b) => Number(a) - Number(b),
    );
    return sorted[0] != null ? Number(sorted[0]) : null;
  }, [game, urlRoomId]);

  // Canonicalize the URL whenever it doesn't match the resolved state.
  // Uses replaceState so we don't pollute history with fallback defaults.
  useEffect(() => {
    if (!effectiveGameId || effectiveRoomId == null) return;
    const target = buildRoute(effectiveGameId, effectiveRoomId);
    if (target !== path) {
      navigate(target, { replace: true });
    }
  }, [effectiveGameId, effectiveRoomId, path, navigate]);

  // Update the document title so browser tabs/history show something useful.
  useEffect(() => {
    if (!manifest || !effectiveGameId) {
      document.title = "unSCUMM Viewer";
      return;
    }
    const gameEntry = manifest.games.find((g) => g.id === effectiveGameId);
    const base = gameEntry ? `${gameEntry.title} · unSCUMM` : "unSCUMM Viewer";
    document.title =
      effectiveRoomId != null ? `Room ${effectiveRoomId} · ${base}` : base;
  }, [manifest, effectiveGameId, effectiveRoomId]);

  const rooms: Room[] = useMemo(() => {
    if (!game) return [];
    return Object.values(game.rooms).sort((a, b) => a.room_id - b.room_id);
  }, [game]);

  if (error) return <div className="error">Failed to load: {error}</div>;
  if (!manifest) return <div className="loading">Loading game list…</div>;
  if (manifest.games.length === 0) {
    return (
      <div className="empty">
        No games found. Run{" "}
        <code>python scripts/build_game.py …</code> to build one.
      </div>
    );
  }

  const selectedGame = manifest.games.find((g) => g.id === effectiveGameId);
  const selectedRoom =
    game && effectiveRoomId != null
      ? game.rooms[String(effectiveRoomId)]
      : null;

  const onPickRoom = (roomId: number) => {
    if (!effectiveGameId) return;
    navigate(buildRoute(effectiveGameId, roomId));
  };

  const onPickGame = (gameId: string) => {
    // Clear the room so the new game's first room is picked by defaulting.
    navigate(buildRoute(gameId, null));
  };

  return (
    <div className="app">
      <header>
        <h1>unSCUMM Viewer</h1>
        {manifest.games.length === 1 ? (
          <span className="source">{selectedGame?.title}</span>
        ) : (
          <select
            value={effectiveGameId ?? ""}
            onChange={(e) => onPickGame(e.target.value)}
          >
            {manifest.games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        )}
        {selectedGame ? (
          <span className="stat">
            SCUMM v{selectedGame.scumm_version} · {selectedGame.rooms} rooms ·{" "}
            {selectedGame.objects} objects
          </span>
        ) : null}
      </header>

      {!game ? (
        <div className="loading">Loading {selectedGame?.title}…</div>
      ) : (
        <div className="layout">
          <RoomList
            rooms={rooms}
            selectedRoomId={effectiveRoomId}
            onSelect={onPickRoom}
          />
          {selectedRoom && effectiveGameId ? (
            <RoomDetails
              gameId={effectiveGameId}
              room={selectedRoom}
              allRooms={game.rooms}
              onNavigate={onPickRoom}
            />
          ) : (
            <div className="empty">Select a room.</div>
          )}
        </div>
      )}
    </div>
  );
}
