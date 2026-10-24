"""Keyword search over a game's deep guide passages (BM25), and the fusion of ranked lists.

A game has a few hundred passages at most, so the scores are computed here over all of them, the
same way the vector search scans them all. Keywords find what embeddings miss: an exact name
("Virginia vinyl", "Arrowhead"), once the question is in the passages' language."""

import math
import re
from collections import Counter

from .guidestore import Passage

# BM25's usual constants: how fast a repeated word stops adding, and how much a long passage is
# discounted.
K1 = 1.2
B = 0.75

# Words that say nothing about where a thing is, in the questions players ask (Portuguese and
# English): left out of the query, not of the passages.
STOPWORDS = frozenset(
    [
        'a',
        'o',
        'as',
        'os',
        'de',
        'da',
        'do',
        'das',
        'dos',
        'e',
        'em',
        'no',
        'na',
        'nos',
        'nas',
        'um',
        'uma',
        'uns',
        'umas',
        'que',
        'como',
        'onde',
        'fica',
        'ficam',
        'eu',
        'meu',
        'minha',
        'tem',
        'ter',
        'pra',
        'para',
        'por',
        'com',
        'sem',
        'se',
        'é',
        'ser',
        'qual',
        'quais',
        'quando',
        'pego',
        'pegar',
        'acho',
        'achar',
        'encontro',
        'encontrar',
        'consigo',
        'cadê',
        'the',
        'of',
        'to',
        'in',
        'and',
        'on',
        'at',
        'is',
        'it',
        'for',
        'where',
        'do',
        'how',
        'can',
        'get',
        'find',
        'what',
        'which',
        'my',
        'i',
        'you',
        'an',
        'this',
        'that',
        'are',
        'there',
    ]
)

_WORD = re.compile(r'\w+')


def words(text: str) -> list[str]:
    return [w for w in _WORD.findall(text.lower()) if w not in STOPWORDS and len(w) > 1]


def rank(passages: list[Passage], query: str) -> list[int]:
    """The positions of the passages that share a word with the query, best BM25 score first."""
    asked = words(query)
    if not asked or not passages:
        return []
    docs = [words(f'{p.heading}\n{p.content}') for p in passages]
    total = len(docs)
    average = sum(map(len, docs)) / total or 1
    seen = Counter(w for doc in docs for w in set(doc))
    scored: list[tuple[int, float]] = []
    for p, doc in zip(passages, docs, strict=True):
        counts = Counter(doc)
        score = 0.0
        for w in asked:
            if w not in counts:
                continue
            idf = math.log(1 + (total - seen[w] + 0.5) / (seen[w] + 0.5))
            tf = counts[w]
            score += idf * tf * (K1 + 1) / (tf + K1 * (1 - B + B * len(doc) / average))
        if score > 0:
            scored.append((p.position, score))
    return [position for position, _ in sorted(scored, key=lambda s: -s[1])]


# Words that tell a Portuguese passage from an English or a Spanish one: common in guides of each
# language, none shared.
_PORTUGUESE = frozenset(
    [
        'você',
        'não',
        'troféu',
        'com',
        'uma',
        'são',
        'também',
        'pelo',
        'pela',
        'isso',
        'depois',
        'quando',
    ]
)
_ENGLISH = frozenset(
    [
        'you',
        'the',
        'and',
        'with',
        'trophy',
        'chapter',
        'this',
        'that',
        'are',
        'after',
        'when',
        'from',
        'your',
        'will',
    ]
)
_SPANISH = frozenset(
    ['el', 'los', 'del', 'con', 'una', 'pero', 'muy', 'hay', 'cuando', 'puedes', 'tienes', 'trofeo']
)


def portuguese(passage: Passage) -> bool:
    found = _WORD.findall(f'{passage.heading}\n{passage.content}'.lower())
    pt = sum(w in _PORTUGUESE for w in found)
    return pt > sum(w in _ENGLISH for w in found) and pt > sum(w in _SPANISH for w in found)


def portuguese_share(passages: list[Passage]) -> float:
    """How much of a game's deep guide is written in Portuguese, from 0 to 1."""
    return sum(map(portuguese, passages)) / len(passages) if passages else 0.0


def fuse(lists: list[list[int]], weights: list[float], depth: int = 30, k: int = 60) -> list[int]:
    """Reciprocal rank fusion: each list adds weight / (k + rank) to the positions it ranks, so a
    passage near the top of several lists wins without comparing their scores."""
    total: dict[int, float] = {}
    for ranked, weight in zip(lists, weights, strict=True):
        for i, position in enumerate(ranked[:depth]):
            total[position] = total.get(position, 0) + weight / (k + i + 1)
    return sorted(total, key=lambda position: -total[position])
