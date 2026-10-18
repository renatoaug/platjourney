# Retrieval (the deep guide)

## What RAG is

A model only knows what it learned in training, which is general, old and often wrong about a game's details. Retrieval-augmented generation (RAG) fixes that by looking things up first: the question is used to find the most relevant pieces of text in a store we control, and those pieces go into the prompt with it. The model then answers from that text instead of from memory, and can say where it came from.

```mermaid
flowchart LR
    q[Question] --> find["Find the most relevant<br/>passages"]
    store[("Indexed guides")] --> find
    find --> prompt["Question + passages"]
    prompt --> model[Model] --> answer["Answer based on<br/>the passages, with the source"]
```

Here, the store is the deep guide, and the rest of this page is how it is filled and searched.

## In PlatJourney

Nexo answers from three things:

1. **PSN facts:** the player's progress, earned and missing trophies.
2. **The guide:** one structured guide per game ([features](02-features.md)).
3. **The deep guide:** passages from full written trophy guides, cut into pieces and searched by meaning. This page is about this one.

It all lives in the AI service (`services/ai`) and in SurrealDB ([database](04-database.md)).

## Indexing

Once per game, refreshed every 30 days or when the PSN trophy list changes size (a DLC or an update).

```mermaid
flowchart TB
    subgraph read [" "]
        direction LR
        find["Find the game's guide pages<br/>(model with web search)"] --> robots{"robots.txt<br/>allows it?"}
        robots -- no --> skip[skip the page]
        robots -- yes --> text["Keep the article text<br/>(guidetext.py)"]
    end
    subgraph keep [" "]
        direction LR
        cut["Cut by headings<br/>~900 characters each"] --> embed["Embed<br/>game — heading path + text"] --> store[("guide_chunk rows")]
    end
    read -- "each page read" --> keep
```

| Step | Detail |
|---|---|
| Pages | The main guide and roadmap, collectible guides, pages about one hard trophy: up to 10 when the model searches for them, all of them when they are chosen by hand |
| Permission | Only pages the site's `robots.txt` allows (`allowed` in `deepguide.py`), read with a user agent that links to this repository |
| Text | The page's `<article>` (or a forum's posts), without scripts, menus, headers and footers; headings and lists kept; the page's date kept |
| Passages | Cut at headings, long sections at paragraph breaks. Each passage's heading is the path above it (`TEXT GUIDE > Chapter 10`) |
| Vectors | `EMBEDDING_PROVIDER` and its model; every call recorded in `llm_call` |

While a refresh runs, the old passages keep answering. A game with no readable guide is remembered as tried.

## Answering

```mermaid
flowchart LR
    q[Player's question] --> names["Trophy names it mentions,<br/>in the guide's language"]
    names --> literal["Passages that name them<br/>(up to 3)"]
    q --> semantic["Nearest passages by meaning<br/>(cosine ≥ 0.25)"]
    literal --> pick["Up to 6 passages,<br/>literal first"]
    semantic --> pick
    pick --> prompt["Passages + PSN facts + guide"]
    prompt --> answer[Nexo answers]
    pick -. "none found" .-> gap[("guide_request:<br/>what the guides miss")]
```

- **Trophy names first.** Guides are mostly in English and players often ask in Portuguese, so the trophies a question names are matched literally, in English.
- **Newest wins.** Each passage goes with its site, heading path and date; when passages disagree, Nexo trusts the most recent one (games change with patches).
- **Nothing found.** Nexo still answers from the PSN facts and the guide, and the question is stored in `guide_request`, so whoever runs the instance sees what the guides miss.

## Choices

| Choice | Why |
|---|---|
| Exact scan, no vector index | A game has a few hundred passages at most; scanning is fast, exact and works with any vector size |
| One embedding model at a time | Vectors from different models do not compare; rows of another size are skipped, and `bun run embed --all` re-embeds after a switch |
| Literal before semantic | The passage that names trophy X is the right one, even when the question is worded far from the guide |
| Written guides only | Never search results, forum threads or videos, and only where the site allows it |

## Recommendations use the same vectors

```mermaid
flowchart LR
    lib["Player's library"] --> taste["Taste vector:<br/>platinums weigh most (recent a bit more),<br/>games dropped early pull away"]
    taste --> near["Nearest catalog games<br/>(game.embedding)"]
    near --> rank["The model ranks and explains them"]
```
