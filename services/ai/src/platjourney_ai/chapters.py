"""The chapters a passage or a question is about, read from the words that name them.

Guide pages put the chapter in their headings ("TEXT GUIDE > Chapter 18", "Episode 3 Walkthrough >
Chapter 1: Windy Nights", "Mission 09"), and a passage's heading is the path of headings above it,
so the chapter is already there. Players name it in the question ("where is the flower in
chapter 3?"). Both are read the same way: a unit (chapter, episode, act, mission) and its number.
"""

import re
from collections.abc import Sequence
from typing import Any, Protocol, cast

# A unit and its number: ('chapter', 3).
Chapter = tuple[str, int]

# The words for each unit, in English, Portuguese and Spanish.
_UNITS = {
    'chapter': ('chapter', 'chap', 'ch', 'capítulo', 'capitulo', 'cap'),
    'episode': ('episode', 'ep', 'episódio', 'episodio'),
    'act': ('act', 'ato', 'acto'),
    'mission': ('mission', 'missão', 'missao', 'misión', 'mision'),
}
_UNIT_OF = {word: unit for unit, words in _UNITS.items() for word in words}

_WORDS = [
    'one',
    'two',
    'three',
    'four',
    'five',
    'six',
    'seven',
    'eight',
    'nine',
    'ten',
    'eleven',
    'twelve',
    'thirteen',
    'fourteen',
    'fifteen',
    'sixteen',
    'seventeen',
    'eighteen',
    'nineteen',
    'twenty',
]
_PT_WORDS = [
    'um',
    'dois',
    'três',
    'quatro',
    'cinco',
    'seis',
    'sete',
    'oito',
    'nove',
    'dez',
    'onze',
    'doze',
    'treze',
    'catorze',
    'quinze',
    'dezesseis',
    'dezessete',
    'dezoito',
    'dezenove',
    'vinte',
]
_NUMBER_WORDS = (
    {w: n for n, w in enumerate(_WORDS, 1)}
    | {w: n for n, w in enumerate(_PT_WORDS, 1)}
    | {'uma': 1, 'duas': 2, 'quatorze': 14}
)
_ROMAN = {'i': 1, 'v': 5, 'x': 10}

# Short forms ("ch", "ep", "cap") only before a digit: "ch" alone is too common a fragment.
_SHORT = frozenset(['ch', 'chap', 'ep', 'cap'])

_FIND = re.compile(
    r'\b(?P<unit>' + '|'.join(sorted(_UNIT_OF, key=len, reverse=True)) + r')\.?\s*'
    r'(?P<n>\d{1,3}|[ivx]{1,5}|' + '|'.join(_NUMBER_WORDS) + r')\b'
    # "Chapter 1-6", "Chapters 3 & 4": a range is about several chapters, not one.
    r'(?!\s*(?:[-\u2013\u2014/&]|to\b|a\b|e\b|and\b)\s*\d)',
    re.IGNORECASE,
)

# A chapter named after one of these is where something leads, not what the passage is about:
# "Chapter Select to Chapter 9", "up to chapter 5", "after Chapter 3".
_POINTING = frozenset(
    [
        'to',
        'until',
        'after',
        'before',
        'from',
        'till',
        'até',
        'após',
        'antes',
        'depois',
        'desde',
        'partir',
    ]
)
# Small words that can sit between those and the chapter: "after the", the Portuguese "do".
_LINKS = frozenset(['the', 'of', 'o', 'a', 'do', 'da', 'de', 'no', 'na'])


def _number(text: str, unit_word: str) -> int | None:
    text = text.lower()
    if text.isdigit():
        return int(text) or None
    if unit_word in _SHORT:
        return None
    if text in _NUMBER_WORDS:
        return _NUMBER_WORDS[text]
    values = [_ROMAN[c] for c in text]
    later = [*values[1:], 0]
    total = sum(-v if v < after else v for v, after in zip(values, later, strict=True))
    return total or None


def named(text: str) -> frozenset[Chapter]:
    """Every chapter the text names: ('chapter', 3) from "Chapter III", "chapter 3", "ch. 3"."""
    found: set[Chapter] = set()
    for m in _FIND.finditer(text):
        before = [w.lower() for w in text[: m.start()].split()]
        while before and before[-1] in _LINKS:
            before.pop()
        if before and before[-1] in _POINTING:
            continue
        word = m.group('unit').lower()
        n = _number(m.group('n'), word)
        if n:
            found.add((_UNIT_OF[word], n))
    return frozenset(found)


def in_terms_of(asked: frozenset[Chapter], game: set[str]) -> frozenset[Chapter]:
    """The question's chapters in the units the game's guide uses. A player who says "chapter 3"
    of a game whose guides count missions means mission 3, when missions are all the guide has."""
    if not asked or {unit for unit, _ in asked} <= game or len(game) != 1:
        return asked
    [unit] = game
    return frozenset((unit, n) for _, n in asked)


def elsewhere(passage: frozenset[Chapter], asked: frozenset[Chapter]) -> bool:
    """True when the passage is about another chapter of a unit the question names: chapter 13
    when the question asks about chapter 3. A passage that names no chapter is not elsewhere."""
    units = {unit for unit, _ in asked}
    mine = {c for c in passage if c[0] in units}
    return bool(mine) and not mine & asked


# What a trophy says when it is earned at the end of a chapter: "Complete chapter 3".
_FINISHED = re.compile(
    r'\b(complete[ds]?|finish(?:ed)?|beat|clear(?:ed)?|survive[ds]?|conclu[aií]\w*|termin\w*|'
    r'venç\w*|vença)\b',
    re.IGNORECASE,
)


class _Trophy(Protocol):
    name: str
    name_en: str
    detail: str
    detail_en: str
    earned: bool


def _dicts(value: object) -> list[dict[str, Any]]:
    """The objects in a list read from a stored guide, which the type checker cannot see into."""
    items = cast(list[object], value) if isinstance(value, list) else []
    return [cast(dict[str, Any], x) for x in items if isinstance(x, dict)]


def where_player_is(
    guide: dict[str, Any] | None, trophies: Sequence[_Trophy]
) -> frozenset[Chapter]:
    """The chapter the player is probably in, from the guide's milestones and their trophies. The
    milestone they are in is the last one whose opening trophy they have; its checklist may name
    the chapter ("Chapter 2, Train station"), and otherwise its opening trophy usually ends the
    one before ("Complete chapter 3": they are in chapter 4). Empty when nothing says."""
    milestones = _dicts((guide or {}).get('milestones'))
    earned = {t.name.lower() for t in trophies if t.earned}
    reached = [m for m in milestones if not m.get('after') or str(m['after']).lower() in earned]
    if not reached:
        return frozenset()
    current = reached[-1]
    for tip in _dicts(current.get('tips')):
        found = named(str(tip.get('where') or ''))
        if found:
            return found
    opening = next(
        (t for t in trophies if t.name.lower() == str(current.get('after')).lower()), None
    )
    if opening is None:
        return frozenset()
    said = f'{opening.name_en}\n{opening.detail_en}\n{opening.detail}'
    found = named(said)
    if len(found) != 1:
        return frozenset()
    [(unit, n)] = found
    return frozenset({(unit, n + 1)}) if _FINISHED.search(said) else found
