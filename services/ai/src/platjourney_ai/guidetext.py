"""Guide pages as plain text, split into passages that follow the page's headings."""

import json
import re
from dataclasses import dataclass
from typing import Any, cast

CHUNK_CHARS = 900

ENTITIES = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&#039;': "'",
    '&nbsp;': ' ',
    '&#8217;': '\u2019',
    '&#8211;': '\u2013',
    '&#8220;': '\u201c',
    '&#8221;': '\u201d',
}

_ARTICLE = re.compile(r'<article[\s\S]*?</article>', re.I)
# Forums built on Flarum draw the page with JavaScript and ship the posts for readers without it
# in the <noscript> after their loading notice, which the noise rule below would drop with every
# other <noscript>.
_FLARUM = re.compile(r'<div id="flarum-loading"[\s\S]*?<noscript>([\s\S]*?)</noscript>', re.I)
# Wikis built with Next.js (IGN's, for one) draw the article in the browser from the page's data;
# the HTML itself carries only the menu. The article is the list of HTML blocks in that data.
_NEXT_DATA = re.compile(r'<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)</script>', re.I)
_NOISE = re.compile(
    r'<(script|style|noscript|nav|header|footer|aside|form|iframe|svg)[\s\S]*?</\1>', re.I
)
_COMMENT = re.compile(r'<!--[\s\S]*?-->')
_HEADING = re.compile(r'<h([1-6])[^>]*>([\s\S]*?)</h[1-6]>', re.I)
# A paragraph that is only bold text works as a heading on many guide sites
# ("<p><strong>Chapter 10:</strong></p>"), one level below the page's last heading.
_BOLD_LINE = re.compile(r'<p[^>]*>\s*<(strong|b)>([^<]{2,80})</\1>\s*</p>', re.I)
_ITEM = re.compile(r'<li[^>]*>', re.I)
_BLOCK = re.compile(r'<(p|div|tr|br|ul|ol|table|section)[^>]*>', re.I)
_TAG = re.compile(r'<[^>]+>')
_ENTITY = re.compile(r'&[a-z0-9#]+;', re.I)


def _html_blocks(data: Any) -> list[str]:
    """Every `htmlEntities[*].values.html` in a page's data, in order."""
    if isinstance(data, list):
        return [b for item in cast(list[Any], data) for b in _html_blocks(item)]
    if not isinstance(data, dict):
        return []
    node = cast(dict[str, Any], data)
    entities = node.get('htmlEntities')
    if isinstance(entities, list):
        blocks: list[str] = []
        for entity in cast(list[Any], entities):
            values = (
                cast(dict[str, Any], entity).get('values') if isinstance(entity, dict) else None
            )
            html = cast(dict[str, Any], values).get('html') if isinstance(values, dict) else None
            if isinstance(html, str):
                blocks.append(html)
        return blocks
    return [b for value in node.values() for b in _html_blocks(value)]


def _next_article(html: str) -> str | None:
    found = _NEXT_DATA.search(html)
    if not found:
        return None
    try:
        blocks = _html_blocks(json.loads(found.group(1)))
    except ValueError:
        return None
    return '\n'.join(blocks) if blocks else None


def html_to_text(html: str) -> str:
    """HTML to plain text that keeps headings ("## ", with one "#" per level) and list items
    ("- "). A paragraph of bold text alone becomes the deepest heading level."""
    found = _FLARUM.search(html) or _ARTICLE.search(html)
    text = _next_article(html) or (found.group(found.lastindex or 0) if found else html)
    text = _NOISE.sub(' ', text)
    text = _COMMENT.sub(' ', text)
    text = _BOLD_LINE.sub(lambda m: f'\n\n####### {m.group(2).strip().rstrip(":")}\n\n', text)
    text = _HEADING.sub(lambda m: f'\n\n{"#" * int(m.group(1))} {m.group(2)}\n\n', text)
    text = _ITEM.sub('\n- ', text)
    text = _BLOCK.sub('\n', text)
    text = _TAG.sub('', text)
    text = _ENTITY.sub(lambda m: ENTITIES.get(m.group(0).lower(), ' '), text)
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n\s*\n\s*\n+', '\n\n', text)
    return text.strip()


# Where pages say when they were written or last updated, newest kind first.
_DATES = [
    re.compile(p, re.I)
    for p in (
        r'"dateModified"\s*:\s*"(\d{4}-\d{2}-\d{2})',
        r'property=["\']article:modified_time["\'][^>]*content=["\'](\d{4}-\d{2}-\d{2})',
        r'content=["\'](\d{4}-\d{2}-\d{2})[^"\']*["\'][^>]*property=["\']article:modified_time',
        r'"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})',
        r'property=["\']article:published_time["\'][^>]*content=["\'](\d{4}-\d{2}-\d{2})',
        r'content=["\'](\d{4}-\d{2}-\d{2})[^"\']*["\'][^>]*property=["\']article:published_time',
        r'<time[^>]*datetime=["\'](\d{4}-\d{2}-\d{2})',
    )
]


def page_date(html: str) -> str | None:
    """When the page was last updated, or published, as YYYY-MM-DD; None when it does not say."""
    for pattern in _DATES:
        found = pattern.search(html)
        if found:
            return found.group(1)
    return None


@dataclass(frozen=True)
class Part:
    heading: str
    content: str


def chunk_text(text: str, max_chars: int = CHUNK_CHARS) -> list[Part]:
    """Sections follow the page headings; long sections are cut at paragraph boundaries. A
    passage's heading is the path of headings above it ("TEXT GUIDE > Chapter 10"), so a
    question about a chapter finds every passage under it."""
    out: list[Part] = []
    path: list[tuple[int, str]] = []
    heading = ''
    buffer = ''

    def flush() -> None:
        content = buffer.strip()
        if len(content) >= 60:
            out.append(Part(heading, content))

    for block in re.split(r'\n\n+', text):
        h = re.fullmatch(r'(#{1,7}) (.+)', block.strip())
        if h:
            flush()
            buffer = ''
            level = len(h.group(1))
            path = [(lv, name) for lv, name in path if lv < level] + [(level, h.group(2).strip())]
            heading = ' > '.join(name for _, name in path)
            continue
        if len(buffer) + len(block) > max_chars and buffer:
            flush()
            buffer = ''
        buffer += f'{block.strip()}\n'
        while len(buffer) > max_chars * 1.5:
            cut = buffer.rfind('\n', 0, max_chars + 1)
            at = cut if cut > max_chars / 2 else max_chars
            rest = buffer[at:]
            buffer = buffer[:at]
            flush()
            buffer = rest
    flush()
    return out
