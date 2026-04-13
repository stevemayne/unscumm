import { useEffect, useMemo, useState } from "react";
import type { GameData, GamesManifest, Room } from "./types";
import { RoomList } from "./components/RoomList";
import { RoomDetails } from "./components/RoomDetails";
import { ItemList } from "./components/ItemList";
import { ItemDetails } from "./components/ItemDetails";
import { useLocation } from "./useLocation";
import { buildItemIndex } from "./itemIndex";
import { buildRoomLabels } from "./roomLabels";
import "./App.css";

const BASE = import.meta.env.BASE_URL;

type View = "rooms" | "items";

interface Route {
  gameId: string | null;
  view: View;
  selectedId: number | null; // roomId or itemId depending on view
}

const ROOM_RE = /^\/games\/([^/]+)\/rooms\/(\d+)\/?$/;
const ROOMS_RE = /^\/games\/([^/]+)\/rooms\/?$/;
const ITEM_RE = /^\/games\/([^/]+)\/items\/(\d+)\/?$/;
const ITEMS_RE = /^\/games\/([^/]+)\/items\/?$/;
const GAME_RE = /^\/games\/([^/]+)\/?$/;

function parseRoute(path: string): Route {
  let m;
  if ((m = ROOM_RE.exec(path))) {
    return { gameId: m[1], view: "rooms", selectedId: Number(m[2]) };
  }
  if ((m = ROOMS_RE.exec(path))) {
    return { gameId: m[1], view: "rooms", selectedId: null };
  }
  if ((m = ITEM_RE.exec(path))) {
    return { gameId: m[1], view: "items", selectedId: Number(m[2]) };
  }
  if ((m = ITEMS_RE.exec(path))) {
    return { gameId: m[1], view: "items", selectedId: null };
  }
  if ((m = GAME_RE.exec(path))) {
    return { gameId: m[1], view: "rooms", selectedId: null };
  }
  return { gameId: null, view: "rooms", selectedId: null };
}

function buildRoute(
  gameId: string,
  view: View,
  selectedId: number | null,
): string {
  const segment = view === "items" ? "items" : "rooms";
  return selectedId != null
    ? `/games/${gameId}/${segment}/${selectedId}`
    : `/games/${gameId}/${segment}`;
}

export default function App() {
  const { path, navigate } = useLocation();
  const route = parseRoute(path);

  const [manifest, setManifest] = useState<GamesManifest | null>(null);
  const [game, setGame] = useState<GameData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${BASE}games.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`games.json HTTP ${r.status}`);
        return r.json();
      })
      .then(setManifest)
      .catch((e) => setError(String(e)));
  }, []);

  const effectiveGameId = useMemo<string | null>(() => {
    if (!manifest) return null;
    if (route.gameId && manifest.games.some((g) => g.id === route.gameId)) {
      return route.gameId;
    }
    return manifest.games[0]?.id ?? null;
  }, [manifest, route.gameId]);

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

  const itemIndex = useMemo(
    () => (game ? buildItemIndex(game) : null),
    [game],
  );
  const roomLabels = useMemo(
    () => (game ? buildRoomLabels(game) : {}),
    [game],
  );

  // Resolve effective selection based on the view.
  const effectiveSelectedId = useMemo<number | null>(() => {
    if (!game) return null;
    if (route.view === "rooms") {
      if (route.selectedId != null && game.rooms[String(route.selectedId)]) {
        return route.selectedId;
      }
      const sorted = Object.keys(game.rooms).sort(
        (a, b) => Number(a) - Number(b),
      );
      return sorted[0] != null ? Number(sorted[0]) : null;
    }
    // items
    if (!itemIndex) return null;
    if (
      route.selectedId != null &&
      itemIndex.items[route.selectedId] != null
    ) {
      return route.selectedId;
    }
    return itemIndex.ordered[0] ?? null;
  }, [game, itemIndex, route.view, route.selectedId]);

  // Canonicalize the URL when defaults kick in.
  useEffect(() => {
    if (!effectiveGameId || effectiveSelectedId == null) return;
    const target = buildRoute(effectiveGameId, route.view, effectiveSelectedId);
    if (target !== path) {
      navigate(target, { replace: true });
    }
  }, [effectiveGameId, route.view, effectiveSelectedId, path, navigate]);

  // Document title
  useEffect(() => {
    if (!manifest || !effectiveGameId) {
      document.title = "unSCUMM Viewer";
      return;
    }
    const g = manifest.games.find((x) => x.id === effectiveGameId);
    const base = g ? `${g.title} · unSCUMM` : "unSCUMM Viewer";
    if (route.view === "items" && effectiveSelectedId != null && itemIndex) {
      const item = itemIndex.items[effectiveSelectedId];
      const label = item?.name ?? `Item ${effectiveSelectedId}`;
      document.title = `${label} · ${base}`;
    } else if (route.view === "rooms" && effectiveSelectedId != null) {
      document.title = `Room ${effectiveSelectedId} · ${base}`;
    } else {
      document.title = base;
    }
  }, [
    manifest,
    effectiveGameId,
    effectiveSelectedId,
    route.view,
    itemIndex,
  ]);

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
  const onPickRoom = (roomId: number) => {
    if (effectiveGameId)
      navigate(buildRoute(effectiveGameId, "rooms", roomId));
  };
  const onPickItem = (itemId: number) => {
    if (effectiveGameId)
      navigate(buildRoute(effectiveGameId, "items", itemId));
  };
  const onPickGame = (gameId: string) => {
    navigate(buildRoute(gameId, route.view, null));
  };
  const onSwitchView = (view: View) => {
    if (effectiveGameId) navigate(buildRoute(effectiveGameId, view, null));
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
        <div className="view-toggle">
          <button
            className={route.view === "rooms" ? "active" : ""}
            onClick={() => onSwitchView("rooms")}
          >
            Rooms
          </button>
          <button
            className={route.view === "items" ? "active" : ""}
            onClick={() => onSwitchView("items")}
          >
            Items{itemIndex ? ` (${itemIndex.ordered.length})` : ""}
          </button>
        </div>
        {selectedGame ? (
          <span className="stat">
            SCUMM v{selectedGame.scumm_version} · {selectedGame.rooms} rooms ·{" "}
            {selectedGame.objects} objects
          </span>
        ) : null}
      </header>

      {!game ? (
        <div className="loading">Loading {selectedGame?.title}…</div>
      ) : route.view === "items" && itemIndex ? (
        <div className="layout">
          <ItemList
            items={itemIndex}
            selectedItemId={effectiveSelectedId}
            onSelect={onPickItem}
          />
          {effectiveSelectedId != null &&
          itemIndex.items[effectiveSelectedId] ? (
            <ItemDetails
              gameId={effectiveGameId!}
              item={itemIndex.items[effectiveSelectedId]}
              roomLabels={roomLabels}
              onNavigateRoom={onPickRoom}
              onNavigateItem={onPickItem}
            />
          ) : (
            <div className="empty">No items extracted from this game.</div>
          )}
        </div>
      ) : (
        <div className="layout">
          <RoomList
            rooms={rooms}
            selectedRoomId={effectiveSelectedId}
            roomLabels={roomLabels}
            onSelect={onPickRoom}
          />
          {effectiveSelectedId != null &&
          game.rooms[String(effectiveSelectedId)] &&
          effectiveGameId ? (
            <RoomDetails
              gameId={effectiveGameId}
              room={game.rooms[String(effectiveSelectedId)]}
              roomLabels={roomLabels}
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
