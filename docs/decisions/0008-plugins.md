# 0008. Plugins add to an instance without changing the app

- **Status:** Accepted
- **Date:** 2026-10-04

## Context

Instances differ in what they need around the app. One run for a group of friends wants nothing more; another wants its own integrations, rules on who can spend the model, or a page of its own. Putting every such need in the app makes it heavier for everyone who does not use it, and forking the app to add them means losing every later fix.

## Decision

An instance can load **plugins**: a folder with up to two TypeScript modules, one for the server and one for the web app, named in two settings. How to write one, with diagrams and a complete example, is in [docs/plugins.md](../plugins.md).

```
 plugins/<name>/server.ts ──PLUGINS────▶ loaded into the Bun server at start
                                          ├── routes under /api/ext/<path>
                                          ├── beforeModel / modelFailed around every model call
                                          └── events (user:deleted)

 plugins/<name>/web.tsx ───PLUGINS_WEB─▶ bundled with the web app at build time
                                          ├── components shown in <PluginSlot> places
                                          │   (top-bar, profile)
                                          ├── pages: a route and an item in the menu
                                          └── the action next to a refusal's message
```

- **Same process, same bundle.** A plugin is not a separate app or service: its routes run in the app's server and its components render inside the app's screens, with the app's pieces (`@platjourney/web/...`) and tokens.
- **A small, versioned contract.** `PLUGIN_API` in `apps/server/src/plugins.ts` lists what a plugin can do: answer routes under `/api/ext/` (public ones skip sign-in), stop model work by throwing `Refused` or undo something when it failed, and hear events; on the web, fill slots, add pages and offer an action when the server refuses.
- **Nothing changes without plugins.** Every hook is a no-op and every slot is empty; the default web module (`apps/web/src/plugins/none.ts`) exports no components.

## Consequences

- An instance adds what it needs without forking, and keeps receiving the app's fixes.
- A plugin follows the app by pinning the version it was built with; the contract stays small, and `PLUGIN_API` changes when a hook or slot changes.
- New hooks and slots are added when a plugin needs one, not in advance.
- A plugin runs with the server's permissions and the app's access in the browser: only load code you trust.
