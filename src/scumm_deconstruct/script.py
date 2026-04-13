"""SCUMM v6 bytecode scanner for extracting room transitions.

Steps through v6 stack-based bytecode, tracking pushed constants and
identifying loadRoom / loadRoomWithEgo opcodes.
"""

from __future__ import annotations

import struct
from dataclasses import dataclass
from typing import List, Optional, Set


# Inline argument byte counts for fixed-size v6 opcodes.
# Opcodes not listed here are either unknown or need special handling.
_INLINE_SIZES = {
    # Push / read
    0x00: 1,   # pushByte
    0x01: 2,   # pushWord
    0x02: 1,   # pushByteVar
    0x03: 2,   # pushWordVar
    0x06: 1,   # byteArrayRead
    0x07: 2,   # wordArrayRead
    0x0A: 1,   # byteArrayIndexedRead
    0x0B: 2,   # wordArrayIndexedRead
    # Stack / arithmetic / comparison (no inline args)
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
    0x5C: 2,  # if (jumpTrue)
    0x5D: 2,  # ifNot (jumpFalse)
    0x73: 2,  # jump
    # Script / object / game control  (all stack-only)
    0x5E: 0, 0x5F: 0, 0x60: 0, 0x61: 0, 0x62: 0, 0x63: 0, 0x64: 0,
    0x65: 0, 0x66: 0, 0x67: 0, 0x68: 0, 0x69: 0, 0x6A: 0,
    0x6C: 0, 0x6D: 0, 0x6E: 0, 0x6F: 0,
    0x70: 0, 0x71: 0, 0x72: 0,
    0x74: 0, 0x75: 0, 0x76: 0, 0x77: 0,
    0x78: 0, 0x79: 0, 0x7A: 0,
    0x7B: 0,  # loadRoom
    0x7C: 0, 0x7D: 0, 0x7E: 0, 0x7F: 0,
    0x80: 0, 0x81: 0, 0x82: 0, 0x83: 0, 0x84: 0,
    0x85: 0,  # loadRoomWithEgo
    0x87: 0, 0x88: 0,
    0x8A: 0, 0x8B: 0, 0x8C: 0, 0x8D: 0, 0x8E: 0, 0x8F: 0,
    0x90: 0, 0x91: 0, 0x92: 0, 0x93: 0, 0x94: 0,
    0x95: 0, 0x96: 0,
    0x98: 0, 0x99: 0, 0x9A: 0,
    0x9F: 0, 0xA0: 0, 0xA1: 0, 0xA2: 0, 0xA3: 0,
    0xA6: 0, 0xA7: 0, 0xA8: 0,
    0xAA: 0, 0xAB: 0, 0xAC: 0, 0xAD: 0, 0xAF: 0,
    0xB0: 0, 0xB1: 0, 0xB2: 0, 0xB3: 0,
    # dim / dim2dim arrays
    0xBC: 3,  # dimArray: type(1) + array#(2)
    0xBD: 0,  # dummy
    0xBE: 0, 0xBF: 0,
    0xC0: 3,  # dim2dimArray
    0xC4: 0, 0xC5: 0, 0xC6: 0, 0xC7: 0,
    0xC8: 0, 0xC9: 0, 0xCA: 0, 0xCB: 0, 0xCC: 0, 0xCD: 0,
    0xD0: 0, 0xD1: 0, 0xD2: 0,
    0xD4: 0, 0xD5: 0, 0xD6: 0, 0xD7: 0, 0xD8: 0,
    0xDD: 0, 0xE1: 0, 0xE3: 0, 0xE4: 0, 0xEC: 0, 0xED: 0,
}

# Opcodes that use a sub-opcode byte (read 1 extra byte, then possibly
# inline strings depending on the sub-opcode value).
_SUBOP_OPCODES = {
    0x6B,  # cursorCommand
    0x9B,  # resourceRoutines
    0x9C,  # roomOps
    0x9D,  # actorOps
    0x9E,  # verbOps
    0xA4,  # arrayOps
    0xA5,  # saveRestoreVerbs
    0xA9,  # wait
    0xAE,  # systemOps
}

# Sub-opcodes that read an inline null-terminated string.
_STRING_SUBOPS = {
    0x9D: {0x4F},        # actorOps → SO_ACTOR_NAME
    0x9E: {0x7C},        # verbOps  → SO_VERB_NAME
}

# Print / talk opcodes — these use decodeParseString (sub-opcode loop with
# inline strings).  0xBA (talkActor) and 0xBB (talkEgo) also use it.
_PRINT_OPCODES = {0xB4, 0xB5, 0xB6, 0xB7, 0xB8, 0xB9, 0xBA, 0xBB}

# 0x97 (setObjectName) reads an inline string directly (no sub-opcode).
_INLINE_STRING_OPCODES = {0x97}


def _skip_string(data: bytes, offset: int) -> int:
    """Advance past a null-terminated SCUMM string (handles 0xFF escapes)."""
    while offset < len(data):
        b = data[offset]
        offset += 1
        if b == 0x00:
            return offset
        if b == 0xFF or b == 0xFE:
            if offset >= len(data):
                return offset
            code = data[offset]
            offset += 1
            if code in (4, 5, 6, 7):
                offset += 2  # 16-bit value
            elif code in (9, 10, 12, 13, 14):
                offset += 3
    return offset


def _skip_print_block(data: bytes, offset: int) -> int:
    """Advance past a print/talk sub-opcode block (loop until 0xFF end)."""
    while offset < len(data):
        sub = data[offset]
        offset += 1
        if sub == 0xFF:
            return offset  # end of print block
        if sub == 0x4B:
            # inline string
            offset = _skip_string(data, offset)
        # Other print sub-ops (0x41, 0x42, 0x43, 0x45, 0x47, 0x48,
        # 0x4A, 0x4C) only consume stack values — no inline data.
    return offset


@dataclass
class _StackEntry:
    """A value on the analysis stack — either a known constant or unknown."""

    value: Optional[int] = None

    @property
    def is_const(self) -> bool:
        return self.value is not None


_UNKNOWN = _StackEntry()


def scan_transitions(bytecode: bytes, max_room: int = 255) -> Set[int]:
    """Scan v6 bytecode for room transitions, returning target room IDs.

    Tracks pushed constants through a simplified stack model and records
    the room argument when loadRoom (0x7B) or loadRoomWithEgo (0x85) is
    executed with a constant room number.
    """
    targets: Set[int] = set()
    stack: List[_StackEntry] = []
    offset = 0
    length = len(bytecode)

    def _push(val: Optional[int] = None):
        stack.append(_StackEntry(val))

    def _pop() -> _StackEntry:
        return stack.pop() if stack else _UNKNOWN

    while offset < length:
        op = bytecode[offset]
        offset += 1

        # --- push constant ---------------------------------------------------
        if op == 0x00:  # pushByte
            if offset < length:
                _push(bytecode[offset])
                offset += 1
            continue
        if op == 0x01:  # pushWord
            if offset + 1 < length:
                val = struct.unpack_from("<H", bytecode, offset)[0]
                # sign-extend
                if val >= 0x8000:
                    val -= 0x10000
                _push(val)
                offset += 2
            continue

        # --- push variable (unknown value) ------------------------------------
        if op in (0x02, 0x06, 0x0A, 0x4E, 0x52, 0x56, 0x5A, 0x42, 0x46, 0x4A):
            offset += 1  # 1-byte inline arg
            if op in (0x02, 0x06, 0x0A):
                _push()  # pushes unknown
            continue
        if op in (0x03, 0x07, 0x0B, 0x4F, 0x53, 0x57, 0x5B, 0x43, 0x47, 0x4B):
            offset += 2  # 2-byte inline arg
            if op in (0x03, 0x07, 0x0B):
                _push()  # pushes unknown
            continue

        # --- jumps ------------------------------------------------------------
        if op in (0x5C, 0x5D, 0x73):
            offset += 2
            _pop()  # conditional jumps pop a value (0x73 doesn't but harmless)
            continue

        # --- loadRoom (0x7B) — THE KEY OPCODE --------------------------------
        if op == 0x7B:
            entry = _pop()
            if entry.is_const and 1 <= entry.value <= max_room:
                targets.add(entry.value)
            continue

        # --- loadRoomWithEgo (0x85) -------------------------------------------
        if op == 0x85:
            y = _pop()
            x = _pop()
            room = _pop()  # v6: room is popped separately
            obj = _pop()
            if room.is_const and 1 <= room.value <= max_room:
                targets.add(room.value)
            continue

        # --- print / talk opcodes (sub-opcode loop with inline strings) -------
        if op in _PRINT_OPCODES:
            if op in (0xB8, 0xBA):
                _pop()  # printActor / talkActor pop actor id
            offset = _skip_print_block(bytecode, offset)
            stack.clear()  # conservative: we don't track through prints
            continue

        # --- inline string (setObjectName 0x97) -------------------------------
        if op in _INLINE_STRING_OPCODES:
            offset = _skip_string(bytecode, offset)
            continue

        # --- sub-opcode based opcodes -----------------------------------------
        if op in _SUBOP_OPCODES:
            if offset < length:
                sub = bytecode[offset]
                offset += 1
                # Check if this sub-op reads an inline string
                if op in _STRING_SUBOPS and sub in _STRING_SUBOPS[op]:
                    offset = _skip_string(bytecode, offset)
                # wait sub-op 0xE8 (SO_WAIT_FOR_MESSAGE) has a jump offset
                if op == 0xA9 and sub in (0xE8, 0xE9, 0xEA, 0xEB, 0xEC):
                    offset += 2  # jump offset
                # arrayOps sub-ops with inline data
                if op == 0xA4:
                    if sub in (0xCC, 0xCD):
                        offset += 2  # array pointer
                    elif sub in (0xD0, 0xD4):
                        offset += 2  # array pointer
                        offset = _skip_string(bytecode, offset)
            continue

        # --- dim / dim2dim arrays ---------------------------------------------
        if op in (0xBC, 0xC0):
            offset += 3
            continue

        # --- everything else: look up in the fixed table ----------------------
        inline = _INLINE_SIZES.get(op)
        if inline is not None:
            offset += inline
            # For opcodes that push a result, push unknown
            if op in (
                0x0C,  # dup
                0x0D,  # not
                0x0E, 0x0F, 0x10, 0x11, 0x12, 0x13,  # comparisons
                0x6F,  # getState
                0x72,  # getOwner
                0x87, 0x88,  # getRandom*
                0x8A, 0x8B, 0x8C, 0x8D, 0x8E, 0x8F,  # getActor*/getObject*
                0x90, 0x91, 0x92, 0x93, 0x94,  # getActor*/findInventory
                0x98, 0x9F, 0xA0, 0xA2, 0xA3,  # misc getters
                0xA8, 0xAA, 0xAB, 0xAD, 0xAF,
                0xC4, 0xC5, 0xC6, 0xC7,  # abs, dist*
                0xCB, 0xCC,  # pickOneOf*
                0xD2, 0xD8, 0xDD, 0xE1, 0xE3, 0xEC, 0xED,
            ):
                _push()
            continue

        # Unknown opcode — we can't reliably decode further. Clear the stack
        # and try to continue (the next byte might be a valid opcode).
        stack.clear()

    return targets
