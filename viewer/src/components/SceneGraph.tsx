import { useMemo, type CSSProperties } from "react";
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
import {
  buildRoomDegrees,
  categoryDescription,
  categoryLabel,
  type RoomCategory,
} from "../roomCategory";

interface Props {
  game: GameData;
  roomLabels: Record<number, string | null>;
  selectedRoomId: number | null;
  onSelectRoom: (id: number) => void;
}

interface CategoryStyle {
  bg: string;
  border: string;
  color: string;
  opacity?: number;
}

const CATEGORY_STYLE: Record<RoomCategory, CategoryStyle> = {
  hub: {
    bg: "rgba(78, 201, 176, 0.18)",
    border: "var(--named)",
    color: "var(--text-hi)",
  },
  terminal: {
    bg: "rgba(212, 162, 86, 0.22)",
    border: "#e6b96a",
    color: "var(--text-hi)",
  },
  "dead-end": {
    bg: "rgba(40, 42, 50, 0.6)",
    border: "rgba(110, 113, 125, 0.5)",
    color: "rgba(180, 183, 195, 0.7)",
    opacity: 0.55,
  },
  orphan: {
    bg: "rgba(28, 30, 38, 0.5)",
    border: "rgba(80, 83, 95, 0.4)",
    color: "rgba(140, 143, 155, 0.5)",
    opacity: 0.35,
  },
  normal: {
    bg: "var(--panel-hi)",
    border: "var(--border)",
    color: "var(--text)",
  },
};

const SELECTED_STYLE: CategoryStyle = {
  bg: "var(--accent-dim)",
  border: "var(--accent)",
  color: "var(--text-hi)",
};

export function SceneGraph({
  game,
  roomLabels,
  selectedRoomId,
  onSelectRoom,
}: Props) {
  const degrees = useMemo(() => buildRoomDegrees(game), [game]);

  const positions = useMemo(() => {
    const ids = Object.values(game.rooms).map((r) => r.room_id);
    const edges: { source: number; target: number }[] = [];
    for (const room of Object.values(game.rooms)) {
      for (const t of room.transitions) {
        edges.push({ source: room.room_id, target: t });
      }
    }
    const hubs = new Set(
      Object.values(game.rooms)
        .filter((r) => degrees[r.room_id]?.category === "hub")
        .map((r) => r.room_id),
    );
    return forceLayout(ids, edges, { hubs });
  }, [game, degrees]);

  const nodes: RFNode[] = useMemo(() => {
    return Object.values(game.rooms).map((room) => {
      const pos = positions[room.room_id] ?? { x: 0, y: 0 };
      const label = roomLabels[room.room_id];
      const deg = degrees[room.room_id];
      const isSelected = room.room_id === selectedRoomId;
      const style = isSelected ? SELECTED_STYLE : CATEGORY_STYLE[deg.category];
      const opacity = !isSelected && style.opacity != null ? style.opacity : 1;
      const nodeStyle: CSSProperties = {
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
        borderRadius: 4,
        padding: 4,
        fontSize: 11,
        width: 110,
        opacity,
      };
      return {
        id: String(room.room_id),
        position: pos,
        data: {
          label: (
            <div className="graph-node-content">
              <div className="graph-node-id">{room.room_id}</div>
              {label ? <div className="graph-node-label">{label}</div> : null}
            </div>
          ),
        },
        style: nodeStyle,
        title: `${categoryLabel(deg.category)} — ${deg.in} in / ${deg.out} out\n${categoryDescription(deg.category)}`,
      };
    });
  }, [game, positions, roomLabels, selectedRoomId, degrees]);

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

  // Tally each category for the legend.
  const tallies = useMemo(() => {
    const t: Record<RoomCategory, number> = {
      hub: 0,
      terminal: 0,
      "dead-end": 0,
      orphan: 0,
      normal: 0,
    };
    for (const d of Object.values(degrees)) t[d.category] += 1;
    return t;
  }, [degrees]);

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
      <div className="graph-legend">
        <h4>Node categories</h4>
        {(["hub", "terminal", "dead-end", "orphan", "normal"] as const).map(
          (c) => (
            <div className="graph-legend-row" key={c} title={categoryDescription(c)}>
              <span
                className="graph-legend-swatch"
                style={{
                  background: CATEGORY_STYLE[c].bg,
                  borderColor: CATEGORY_STYLE[c].border,
                  opacity: CATEGORY_STYLE[c].opacity ?? 1,
                }}
              />
              <span className="graph-legend-label">{categoryLabel(c)}</span>
              <span className="graph-legend-count">{tallies[c]}</span>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
