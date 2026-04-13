from typing import Any

import networkx as nx

from .model import GameData


class SceneGraphBuilder:
    """Builds scene graphs and dependency summaries."""

    def build_scene_graph(self, game_data: GameData) -> nx.DiGraph:
        graph = nx.DiGraph()

        for room_id, room in game_data.rooms.items():
            graph.add_node(room_id, name=room.name)
            for target in room.transitions:
                graph.add_edge(room_id, target)

        return graph

    def summary(self, graph: nx.DiGraph) -> str:
        node_count = graph.number_of_nodes()
        edge_count = graph.number_of_edges()
        line = [f"Scene graph contains {node_count} rooms and {edge_count} transitions."]

        if node_count > 0:
            degrees = sorted(graph.degree(), key=lambda item: item[1], reverse=True)
            top = ", ".join(str(node) for node, _ in degrees[:5])
            line.append(f"Top connected rooms: {top}")

        return "\n".join(line)
