import type { Effect, Precondition, Room, ScummObject } from "../types";
import { ObjectSprite } from "./ObjectSprite";

interface Props {
  gameId: string;
  room: Room;
  object: ScummObject;
  verbNames: Record<string, string>;
  onNavigate: (roomId: number) => void;
}

function verbLabel(id: number, verbNames: Record<string, string>): string {
  const name = verbNames[String(id)];
  return name ? `${name} (${id})` : `Verb ${id}`;
}

function objectName(room: Room, id: number): string | null {
  return room.objects.find((o) => o.object_id === id)?.name ?? null;
}

function PreconditionPill({
  pre,
  room,
}: {
  pre: Precondition;
  room: Room;
}) {
  if (pre.type === "owns") {
    const name = objectName(room, pre.object);
    return (
      <span className="pre pre-owns">
        have {name ?? `obj #${pre.object}`}
      </span>
    );
  }
  if (pre.type === "state") {
    const name = objectName(room, pre.object);
    const target = name ?? `obj #${pre.object}`;
    return (
      <span className="pre pre-state">
        {target} state
        {pre.equals != null ? <> = {pre.equals}</> : null}
      </span>
    );
  }
  if (pre.type === "class") {
    const name = objectName(room, pre.object);
    return (
      <span className="pre pre-class">
        {name ?? `obj #${pre.object}`} in classes [{pre.classes.join(", ")}]
      </span>
    );
  }
  return null;
}

function EffectPill({
  eff,
  room,
  onNavigate,
}: {
  eff: Effect;
  room: Room;
  onNavigate: (id: number) => void;
}) {
  if (eff.type === "loadRoom" || eff.type === "loadRoomWithEgo") {
    return (
      <button
        className="eff eff-go"
        onClick={() => onNavigate(eff.room)}
        title="Jump to room"
      >
        → Room {eff.room}
      </button>
    );
  }
  if (eff.type === "pickupObject") {
    const name = objectName(room, eff.object);
    return (
      <span className="eff eff-pickup">
        pick up {name ?? `obj #${eff.object}`}
      </span>
    );
  }
  if (eff.type === "setState") {
    const name = objectName(room, eff.object);
    return (
      <span className="eff eff-state">
        set {name ?? `obj #${eff.object}`} state → {eff.value}
      </span>
    );
  }
  if (eff.type === "setOwner") {
    const name = objectName(room, eff.object);
    return (
      <span className="eff eff-owner">
        give {name ?? `obj #${eff.object}`}
        {eff.owner != null ? <> to actor {eff.owner}</> : null}
      </span>
    );
  }
  if (eff.type === "startScript") {
    return <span className="eff eff-script">run script {eff.script}</span>;
  }
  if (eff.type === "startObject") {
    const name = objectName(room, eff.object);
    return (
      <span className="eff eff-script">
        start {name ?? `obj #${eff.object}`}
      </span>
    );
  }
  return null;
}

export function InteractionsPanel({
  gameId,
  room,
  object,
  verbNames,
  onNavigate,
}: Props) {
  if (object.verbs.length === 0) {
    return <p className="muted">This object has no verb scripts.</p>;
  }
  const spriteUrl = `${import.meta.env.BASE_URL}games/${gameId}/objects/obj_${object.object_id}_1.png`;
  return (
    <div className="interactions">
      <header className="interactions-head">
        <ObjectSprite url={spriteUrl} />
        <h4>
          {object.name ?? `#${object.object_id}`}{" "}
          <span className="obj-badge">#{object.object_id}</span>
        </h4>
      </header>
      {object.verbs.map((v, i) => {
        const anything =
          v.dialogue.length || v.effects.length || v.preconditions.length;
        return (
          <div className="verb-block" key={i}>
            <div className="verb-head">{verbLabel(v.verb_id, verbNames)}</div>
            {!anything ? (
              <div className="muted">(no recognised actions)</div>
            ) : null}
            {v.preconditions.length > 0 ? (
              <div className="row">
                <span className="row-label">needs</span>
                <div className="pills">
                  {v.preconditions.map((p, j) => (
                    <PreconditionPill key={j} pre={p} room={room} />
                  ))}
                </div>
              </div>
            ) : null}
            {v.dialogue.length > 0 ? (
              <ul className="dialogue">
                {v.dialogue.map((s, j) => (
                  <li key={j}>{s}</li>
                ))}
              </ul>
            ) : null}
            {v.effects.length > 0 ? (
              <div className="row">
                <span className="row-label">does</span>
                <div className="pills">
                  {v.effects.map((e, j) => (
                    <EffectPill
                      key={j}
                      eff={e}
                      room={room}
                      onNavigate={onNavigate}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
