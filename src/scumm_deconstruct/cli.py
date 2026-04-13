import argparse

from .parser import ScummParser
from .graph import SceneGraphBuilder


def build_cli():
    parser = argparse.ArgumentParser(
        description="SCUMM deconstruction pipeline for scene graphs and puzzle flow analysis."
    )
    parser.add_argument(
        "--index",
        help="Path to the SCUMM index file (.000).",
    )
    parser.add_argument(
        "--data",
        help="Path to the SCUMM data file (.001).",
    )
    parser.add_argument("--output", help="Path to write parsed JSON data.")
    parser.add_argument(
        "--show-graph",
        action="store_true",
        help="Build and print a simple scene graph summary.",
    )
    parser.add_argument(
        "--summary",
        action="store_true",
        help="Print a summary of extracted rooms and objects.",
    )
    return parser


def main():
    parser = build_cli()
    args = parser.parse_args()

    if not args.index or not args.data:
        parser.print_help()
        return

    scumm_parser = ScummParser()
    game_data = scumm_parser.parse_game(args.index, args.data)

    if args.summary:
        print(f"Rooms: {len(game_data.rooms)}")
        print(f"Objects: {len(game_data.objects)}")
        for room_id in sorted(game_data.rooms):
            room = game_data.rooms[room_id]
            obj_names = [o.name for o in room.objects if o.name]
            scripts = len(room.scripts)
            print(
                f"  Room {room_id:3d}: {room.width}x{room.height}"
                f"  objects={len(room.objects):2d}"
                f"  scripts={scripts:2d}"
                f"  {', '.join(obj_names[:5])}"
                f"{'...' if len(obj_names) > 5 else ''}"
            )

    if args.output:
        scumm_parser.save_json(game_data, args.output)
        print(f"Saved parsed game data to {args.output}")

    if args.show_graph:
        graph_builder = SceneGraphBuilder()
        graph = graph_builder.build_scene_graph(game_data)
        print(graph_builder.summary(graph))


if __name__ == "__main__":
    main()
