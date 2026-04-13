"""SCUMM v6 bytecode analyzer.

Steps through v6 stack-based bytecode, extracting:
  - room transitions (loadRoom, loadRoomWithEgo)
  - dialogue / narration strings (print/talk opcodes)
  - simple effects (pickupObject, setState, setOwner, startScript)
  - simple preconditions (owns, state, class)

The stack model is symbolic: each entry is either a Const, a Var ref,
a Call result, or Unknown.  That's enough to recognise the common SCUMM
idioms without implementing a full interpreter.
"""

from __future__ import annotations

import struct
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple, Union


# ─── Opcode metadata ─────────────────────────────────────────────────────────

_INLINE_SIZES: Dict[int, int] = {
    # Push / read
    0x00: 1, 0x01: 2, 0x02: 1, 0x03: 2,
    0x06: 1, 0x07: 2, 0x0A: 1, 0x0B: 2,
    # Stack / arithmetic / comparison
    0x0C: 0, 0x0D: 0, 0x0E: 0, 0x0F: 0,
    0x10: 0, 0x11: 0, 0x12: 0, 0x13: 0,
    0x14: 0, 0x15: 0, 0x16: 0, 0x17: 0,
    0x18: 0, 0x19: 0, 0x1A: 0,
    # Variable write
    0x42: 1, 0x43: 2, 0x46: 1, 0x47: 2,
    0x4A: 1, 0x4B: 2,
    # Increment / decrement
    0x4E: 1, 0x4F: 2, 0x52: 1, 0x53: 2,
    0x56: 1, 0x57: 2, 0x5A: 1, 0x5B: 2,
    # Jumps
    0x5C: 2, 0x5D: 2, 0x73: 2,
    # Script / object / game control
    0x5E: 0, 0x5F: 0, 0x60: 0, 0x61: 0, 0x62: 0, 0x63: 0, 0x64: 0,
    0x65: 0, 0x66: 0, 0x67: 0, 0x68: 0, 0x69: 0, 0x6A: 0,
    0x6C: 0, 0x6D: 0, 0x6E: 0, 0x6F: 0,
    0x70: 0, 0x71: 0, 0x72: 0,
    0x74: 0, 0x75: 0, 0x76: 0, 0x77: 0,
    0x78: 0, 0x79: 0, 0x7A: 0, 0x7B: 0,
    0x7C: 0, 0x7D: 0, 0x7E: 0, 0x7F: 0,
    0x80: 0, 0x81: 0, 0x82: 0, 0x83: 0, 0x84: 0,
    0x85: 0,
    0x87: 0, 0x88: 0,
    0x8A: 0, 0x8B: 0, 0x8C: 0, 0x8D: 0, 0x8E: 0, 0x8F: 0,
    0x90: 0, 0x91: 0, 0x92: 0, 0x93: 0, 0x94: 0,
    0x95: 0, 0x96: 0,
    0x98: 0, 0x99: 0, 0x9A: 0,
    0x9F: 0, 0xA0: 0, 0xA1: 0, 0xA2: 0, 0xA3: 0,
    0xA6: 0, 0xA7: 0, 0xA8: 0,
    0xAA: 0, 0xAB: 0, 0xAC: 0, 0xAD: 0, 0xAF: 0,
    0xB0: 0, 0xB1: 0, 0xB2: 0, 0xB3: 0,
    0xBC: 3, 0xBD: 0, 0xBE: 0, 0xBF: 0,
    0xC0: 3,
    0xC4: 0, 0xC5: 0, 0xC6: 0, 0xC7: 0,
    0xC8: 0, 0xC9: 0, 0xCA: 0, 0xCB: 0, 0xCC: 0, 0xCD: 0,
    0xD0: 0, 0xD1: 0, 0xD2: 0,
    0xD4: 0, 0xD5: 0, 0xD6: 0, 0xD7: 0, 0xD8: 0,
    0xDD: 0, 0xE1: 0, 0xE3: 0, 0xE4: 0, 0xEC: 0, 0xED: 0,
}

_SUBOP_OPCODES = {0x6B, 0x9B, 0x9C, 0x9D, 0x9E, 0xA4, 0xA5, 0xA9, 0xAE}
# Sub-op IDs verified against ScummVM scumm_v6.h::SubOpType.
_STRING_SUBOPS = {0x9D: {0x58}, 0x9E: {0x7D}}
_PRINT_OPCODES = {0xB4, 0xB5, 0xB6, 0xB7, 0xB8, 0xB9}
# talkActor / talkEgo read a direct null-terminated string (not a print block).
_TALK_OPCODES = {0xBA, 0xBB}
_INLINE_STRING_OPCODES = {0x97}

# Opcodes that consume N+... stack args, where N is the last pushed value.
# (startScript variants and ifClassOfIs use getStackList.)
_STACK_LIST_OPCODES = {
    0x5E: ("startScript", 2),      # flags, script, args, N
    0x5F: ("startScriptQuick", 1), # script, args, N
    0x60: ("startObject", 3),      # flags, script, entry, args, N
    0x6D: ("ifClassOfIs", 1),      # obj, classes, N → pushes bool
    0x6E: ("setClass", 1),         # obj, classes, N
    0xAD: ("isAnyOf", 1),          # val, list, N → pushes bool
    0xBE: ("startObjectQuick", 2), # script, entry, args, N
    0xBF: ("startScriptQuick2", 1),# script, args, N
    0xCB: ("pickOneOf", 1),        # idx, list, N → pushes val
    0xCC: ("pickOneOfDefault", 1), # idx, list, N, default → pushes val
    0xD5: ("jumpToScript", 2),     # flags, script, args, N
}


# ─── Symbolic stack values ───────────────────────────────────────────────────

@dataclass
class Const:
    value: int


@dataclass
class Var:
    var_id: int


@dataclass
class Call:
    fn: str
    args: Tuple[Any, ...]


class Unknown:
    __slots__ = ()

    def __repr__(self) -> str:  # pragma: no cover
        return "Unknown"


_UNKNOWN = Unknown()

StackVal = Union[Const, Var, Call, Unknown]


# ─── Analysis result ─────────────────────────────────────────────────────────

@dataclass
class ScriptAnalysis:
    transitions: Set[int] = field(default_factory=set)
    dialogue: List[str] = field(default_factory=list)
    effects: List[Dict[str, Any]] = field(default_factory=list)
    preconditions: List[Dict[str, Any]] = field(default_factory=list)
    verb_names: Dict[int, str] = field(default_factory=dict)


# ─── String decoding ─────────────────────────────────────────────────────────

def decode_string(data: bytes, offset: int) -> Tuple[str, int]:
    """Decode a null-terminated SCUMM string, handling 0xFF/0xFE escapes.

    Escape-byte sizing follows ScummVM's `resStrLen`: codes 1/2/3/8 have
    no arguments; all other codes consume 2 data bytes.  Embedded variable
    and name references are rendered as `{var:N}` / `{name:N}` etc.
    """
    chars: List[str] = []
    length = len(data)
    while offset < length:
        b = data[offset]
        offset += 1
        if b == 0x00:
            return "".join(chars), offset
        if b in (0xFF, 0xFE):
            if offset >= length:
                break
            code = data[offset]
            offset += 1
            if code == 0x01:
                chars.append("\n")
            elif code == 0x02:
                pass  # keep-text marker
            elif code == 0x03:
                pass  # wait/pause — consume, no visible output
            elif code == 0x08:
                pass  # continue-line marker
            elif offset + 1 < length:
                # All other codes have a 2-byte payload.
                val = struct.unpack_from("<H", data, offset)[0]
                offset += 2
                kind = {
                    0x04: "var", 0x05: "verb",
                    0x06: "name", 0x07: "str",
                }.get(code)
                if kind:
                    chars.append(f"{{{kind}:{val}}}")
                # Anim / sound / wait codes: skip silently.
        elif 0x20 <= b < 0x80:
            chars.append(chr(b))
        elif b in (0x09, 0x0A, 0x0D):
            chars.append(chr(b))
        else:
            # Extended characters (accents, curly quotes) — decode as Latin-1.
            chars.append(bytes([b]).decode("latin-1", errors="replace"))
    return "".join(chars), offset


def _read_print_block(data: bytes, offset: int) -> Tuple[List[str], int]:
    """Read a print/talk sub-opcode block, collecting any inline strings."""
    strings: List[str] = []
    length = len(data)
    while offset < length:
        sub = data[offset]
        offset += 1
        if sub == 0xFF:
            return strings, offset
        if sub == 0x4B:
            text, offset = decode_string(data, offset)
            text = text.strip()
            if text:
                strings.append(text)
    return strings, offset


# ─── Analyzer ────────────────────────────────────────────────────────────────

def _is_const(v: StackVal) -> bool:
    return isinstance(v, Const)


def _pop_const(stack: List[StackVal]) -> Optional[int]:
    """Pop a stack entry; return its int value if const, else None."""
    if not stack:
        return None
    v = stack.pop()
    return v.value if isinstance(v, Const) else None


def _pop(stack: List[StackVal]) -> StackVal:
    return stack.pop() if stack else _UNKNOWN


def _extract_precondition(cond: StackVal) -> Optional[Dict[str, Any]]:
    """Match common SCUMM precondition idioms."""
    # owns(N)  →  eq(getOwner(N), <var>)
    if isinstance(cond, Call) and cond.fn in ("eq", "neq") and len(cond.args) == 2:
        a, b = cond.args
        call = None
        other = None
        if isinstance(a, Call):
            call, other = a, b
        elif isinstance(b, Call):
            call, other = b, a
        if call and call.fn == "getOwner" and len(call.args) == 1:
            obj_arg = call.args[0]
            if isinstance(obj_arg, Const):
                return {"type": "owns", "object": obj_arg.value}
        if call and call.fn == "getState" and len(call.args) == 1:
            obj_arg = call.args[0]
            if isinstance(obj_arg, Const):
                pre: Dict[str, Any] = {"type": "state", "object": obj_arg.value}
                if isinstance(other, Const):
                    pre["equals"] = other.value
                return pre
    # classOfIs with constants
    if isinstance(cond, Call) and cond.fn == "ifClassOfIs":
        consts = [a.value for a in cond.args if isinstance(a, Const)]
        if len(consts) >= 2:
            return {"type": "class", "object": consts[0], "classes": consts[1:]}
    return None


def analyze_script(bytecode: bytes, max_room: int = 255) -> ScriptAnalysis:
    """Full static analysis of a v6 script."""
    result = ScriptAnalysis()
    stack: List[StackVal] = []
    cur_verb: Optional[int] = None  # tracks verbOps SO_VERB_INIT context
    offset = 0
    length = len(bytecode)

    while offset < length:
        op = bytecode[offset]
        offset += 1

        # ─── Push constants ────────────────────────────────────────────
        if op == 0x00:  # pushByte
            if offset < length:
                stack.append(Const(bytecode[offset]))
                offset += 1
            continue
        if op == 0x01:  # pushWord
            if offset + 1 < length:
                val = struct.unpack_from("<H", bytecode, offset)[0]
                if val >= 0x8000:
                    val -= 0x10000
                stack.append(Const(val))
                offset += 2
            continue

        # ─── Push variables ────────────────────────────────────────────
        if op == 0x02:  # pushByteVar
            if offset < length:
                stack.append(Var(bytecode[offset]))
                offset += 1
            continue
        if op == 0x03:  # pushWordVar
            if offset + 1 < length:
                var_id = struct.unpack_from("<H", bytecode, offset)[0]
                stack.append(Var(var_id))
                offset += 2
            continue

        # ─── Array reads — unknown result ──────────────────────────────
        if op in (0x06, 0x0A):
            offset += 1
            stack.append(_UNKNOWN)
            continue
        if op in (0x07, 0x0B):
            offset += 2
            stack.append(_UNKNOWN)
            continue

        # ─── Variable write (consumes 1 from stack) ────────────────────
        if op in (0x42, 0x46, 0x4A, 0x4E, 0x52, 0x56, 0x5A):
            offset += 1
            _pop(stack)
            continue
        if op in (0x43, 0x47, 0x4B, 0x4F, 0x53, 0x57, 0x5B):
            offset += 2
            _pop(stack)
            continue

        # ─── Comparisons / arithmetic: pop 2, push call-style result ───
        if op in (0x0E, 0x0F, 0x10, 0x11, 0x12, 0x13):
            b = _pop(stack)
            a = _pop(stack)
            name = {0x0E: "eq", 0x0F: "neq", 0x10: "gt",
                    0x11: "lt", 0x12: "le", 0x13: "ge"}[op]
            stack.append(Call(name, (a, b)))
            continue
        if op in (0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0xD6, 0xD7):
            _pop(stack)
            _pop(stack)
            stack.append(_UNKNOWN)
            continue
        if op == 0x0C:  # dup
            if stack:
                stack.append(stack[-1])
            else:
                stack.append(_UNKNOWN)
            continue
        if op == 0x0D:  # not
            v = _pop(stack)
            if isinstance(v, Call) and v.fn == "eq":
                stack.append(Call("neq", v.args))
            elif isinstance(v, Call) and v.fn == "neq":
                stack.append(Call("eq", v.args))
            else:
                stack.append(_UNKNOWN)
            continue
        if op in (0x1A, 0xA7):  # pop
            _pop(stack)
            continue

        # ─── Jumps ─────────────────────────────────────────────────────
        if op == 0x73:  # jump (unconditional, no pop)
            offset += 2
            continue
        if op in (0x5C, 0x5D):  # if / ifNot
            offset += 2
            cond = _pop(stack)
            pre = _extract_precondition(cond)
            if pre is not None:
                # Deduplicate exact repeats.
                if pre not in result.preconditions:
                    result.preconditions.append(pre)
            continue

        # ─── Room transitions ──────────────────────────────────────────
        if op == 0x7B:  # loadRoom
            room = _pop_const(stack)
            if room is not None and 1 <= room <= max_room:
                result.transitions.add(room)
                result.effects.append({"type": "loadRoom", "room": room})
            continue
        if op == 0x85:  # loadRoomWithEgo
            _pop(stack)             # y
            _pop(stack)             # x
            room = _pop_const(stack)
            _pop(stack)             # obj
            if room is not None and 1 <= room <= max_room:
                result.transitions.add(room)
                result.effects.append({"type": "loadRoomWithEgo", "room": room})
            continue

        # ─── State / ownership / inventory effects ─────────────────────
        if op == 0x84:  # pickupObject
            obj = _pop_const(stack)
            if obj is not None:
                result.effects.append({"type": "pickupObject", "object": obj})
            continue
        if op == 0x70:  # setState(obj, state)
            state = _pop_const(stack)
            obj = _pop_const(stack)
            if obj is not None and state is not None:
                result.effects.append(
                    {"type": "setState", "object": obj, "value": state}
                )
            continue
        if op == 0x71:  # setOwner(obj, owner)
            owner = _pop_const(stack)
            obj = _pop_const(stack)
            if obj is not None:
                eff: Dict[str, Any] = {"type": "setOwner", "object": obj}
                if owner is not None:
                    eff["owner"] = owner
                result.effects.append(eff)
            continue
        if op == 0x6F:  # getState(obj)
            obj = _pop(stack)
            stack.append(Call("getState", (obj,)))
            continue
        if op == 0x72:  # getOwner(obj)
            obj = _pop(stack)
            stack.append(Call("getOwner", (obj,)))
            continue

        # ─── Stack-list opcodes (variable-arity) ───────────────────────
        if op in _STACK_LIST_OPCODES:
            name, extra = _STACK_LIST_OPCODES[op]
            n = _pop_const(stack)
            if n is None:
                # arg count unknown; clear stack conservatively
                stack.clear()
            else:
                args = [_pop(stack) for _ in range(n)]
                args.reverse()
                extras = [_pop(stack) for _ in range(extra)]
                extras.reverse()
                if name in ("startScript", "startScriptQuick", "startScriptQuick2",
                            "jumpToScript"):
                    script_entry = extras[-1] if extras else _UNKNOWN
                    if isinstance(script_entry, Const):
                        result.effects.append(
                            {"type": "startScript", "script": script_entry.value}
                        )
                elif name in ("startObject", "startObjectQuick"):
                    # Find the object number; it's extras[-2] (before entrypoint)
                    obj_entry = extras[-2] if len(extras) >= 2 else _UNKNOWN
                    if isinstance(obj_entry, Const):
                        result.effects.append(
                            {"type": "startObject", "object": obj_entry.value}
                        )
                elif name == "ifClassOfIs":
                    obj_entry = extras[-1] if extras else _UNKNOWN
                    stack.append(Call("ifClassOfIs", (obj_entry, *args)))
                    continue
                elif name in ("isAnyOf", "pickOneOf", "pickOneOfDefault"):
                    stack.append(_UNKNOWN)
                    continue
                # setClass and non-pushing ops fall through with no stack push
            continue

        # ─── Print opcodes (sub-opcode block) ──────────────────────────
        if op in _PRINT_OPCODES:
            if op == 0xB8:
                _pop(stack)  # printActor pops actor id
            strings, offset = _read_print_block(bytecode, offset)
            for s in strings:
                result.dialogue.append(s)
            stack.clear()
            continue

        # ─── Talk opcodes (direct inline string) ───────────────────────
        if op in _TALK_OPCODES:
            if op == 0xBA:
                _pop(stack)  # talkActor pops actor id
            text, offset = decode_string(bytecode, offset)
            text = text.strip()
            if text:
                result.dialogue.append(text)
            continue

        # ─── Inline string (setObjectName) ─────────────────────────────
        if op in _INLINE_STRING_OPCODES:
            _text, offset = decode_string(bytecode, offset)
            _pop(stack)  # obj number
            continue

        # ─── Sub-opcode opcodes ────────────────────────────────────────
        if op in _SUBOP_OPCODES:
            if offset < length:
                sub = bytecode[offset]
                offset += 1
                # verbOps SO_VERB_INIT (0xC4) — pops verb id, sets _curVerb
                if op == 0x9E and sub == 0xC4:
                    v = _pop_const(stack)
                    if v is not None:
                        cur_verb = v
                # verbOps SO_VERB_NAME (0x7D) — inline string
                if op == 0x9E and sub == 0x7D:
                    text, offset = decode_string(bytecode, offset)
                    text = text.strip()
                    if text and cur_verb is not None:
                        # First name wins (verb may be redefined elsewhere).
                        result.verb_names.setdefault(cur_verb, text)
                elif op in _STRING_SUBOPS and sub in _STRING_SUBOPS[op]:
                    _text, offset = decode_string(bytecode, offset)
                if op == 0xA9 and sub in (0xE8, 0xE9, 0xEA, 0xEB, 0xEC):
                    offset += 2
                if op == 0xA4:
                    if sub in (0xCC, 0xCD):
                        offset += 2
                    elif sub in (0xD0, 0xD4):
                        offset += 2
                        _text, offset = decode_string(bytecode, offset)
            # sub-opcode handlers mostly pop from the stack; be conservative
            stack.clear()
            continue

        # ─── dim / dim2dim arrays ──────────────────────────────────────
        if op in (0xBC, 0xC0):
            offset += 3
            continue

        # ─── Fixed-size fallback ───────────────────────────────────────
        inline = _INLINE_SIZES.get(op)
        if inline is not None:
            offset += inline
            # Opcodes that push a single unknown result
            if op in (
                0x87, 0x88,                        # getRandom*
                0x8A, 0x8B, 0x8C, 0x8D, 0x8E, 0x8F,
                0x90, 0x91, 0x92, 0x93, 0x94,
                0x98, 0x9F, 0xA0, 0xA2, 0xA3,
                0xA8, 0xAA, 0xAB, 0xAF,
                0xC4, 0xC5, 0xC6, 0xC7,
                0xD2, 0xD8, 0xDD, 0xE1, 0xE3, 0xEC, 0xED,
            ):
                stack.append(_UNKNOWN)
            continue

        # Unknown opcode — reset and keep walking.
        stack.clear()

    return result


def scan_transitions(bytecode: bytes, max_room: int = 255) -> Set[int]:
    """Thin wrapper kept for callers that only need the transitions set."""
    return analyze_script(bytecode, max_room).transitions
