import { useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  type Edge as RFEdge,
  type Node as RFNode,
} from "reactflow";
import "reactflow/dist/style.css";

import type { GameData } from "../types";
import { forceLayout } from "../forceLayout";

interface Props {
  game: GameData;
  roomLabels: Record<number, string | null>;
  selectedRoomId: number | null;
  onSelectRoom: (id: number) => void;
}

export function SceneGraph({
  game,
  roomLabels,
  selectedRoomId,
  onSelectRoom,
}: Props) {
  // Compute layout once per game (re-runs only if rooms change).
  const positions = useMemo(() => {
    const ids = Object.values(game.rooms).map((r) => r.room_id);
    const edges: { source: number; target: number }[] = [];
    for (const room of Object.values(game.rooms)) {
      for (const t of room.transitions) {
        edges.push({ source: room.room_id, target: t });
      }
    }
    // Treat the most-connected rooms as hubs so they pull toward the centre.
    const degree = new Map<number, number>();
    for (const e of edges) {
      degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
      degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
    }
    const sorted = [...degree.entries()].sort((a, b) => b[1] - a[1]);
    const hubs = new Set(sorted.slice(0, 3).map(([id]) => id));
    return forceLayout(ids, edges, { hubs });
  }, [game]);

  const nodes: RFNode[] = useMemo(() => {
    return Object.values(game.rooms).map((room) => {
      const pos = positions[room.room_id] ?? { x: 0, y: 0 };
      const label = roomLabels[room.room_id];
      const isSelected = room.room_id === selectedRoomId;
      const isolated = room.transitions.length === 0;
      return {
        id: String(room.room_id),
        position: pos,
        data: {
          label: (
            <div className="graph-node-content">
              <div className="graph-node-id">{room.room_id}</div>
              {label ? (
                <div className="graph-node-label">{label}</div>
              ) : null}
            </div>
          ),
        },
        style: {
          background: isSelected
            ? "var(--accent-dim)"
            : isolated
              ? "rgba(60, 62, 70, 0.7)"
              : "var(--panel-hi)",
          color: isSelected ? "var(--text-hi)" : "var(--text)",
          border: `1px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
          borderRadius: 4,
          padding: 4,
          fontSize: 11,
          width: 110,
        },
      };
    });
  }, [game, positions, roomLabels, selectedRoomId]);

  const edges: RFEdge[] = useMemo(() => {
    const out: RFEdge[] = [];
    for (const room of Object.values(game.rooms)) {
      for (const target of room.transitions) {
        if (!game.rooms[String(target)]) continue;
        out.push({
          id: `${room.room_id}-${target}`,
          source: String(room.room_id),
          target: String(target),
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: "var(--accent-dim)",
          },
          style: { stroke: "var(--accent-dim)", strokeWidth: 1 },
        });
      }
    }
    return out;
  }, [game]);

  return (
    <div className="scene-graph">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, node) => onSelectRoom(Number(node.id))}
      >
        <Background color="var(--border)" gap={32} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
