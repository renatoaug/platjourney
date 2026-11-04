/** What every MCP Apps view shares: the sandboxed page and the bridge to its host. A view has no
 * network access; it reaches PlatJourney only through the host, which calls the tools with the
 * player's own connection. A breaking change to a view needs a new ui:// address. */
import type { Tool } from '../mcp-tools/shared.ts'

export interface McpAppResource {
  uri: string
  name: string
  mimeType: 'text/html;profile=mcp-app'
  text: string
  _meta: {
    ui: { prefersBorder: boolean; csp: { connectDomains: string[]; resourceDomains: string[] } }
  }
}

export interface McpApp {
  name: string
  resources: McpAppResource[]
  tools: Tool[]
}

const PROTOCOL = '2026-01-26'
const FONT_CSS = 'https://fonts.googleapis.com'
const FONT_FILES = 'https://fonts.gstatic.com'
// Where PSN serves trophy images, and where the catalog's art comes from.
export const IMAGE_HOSTS = [
  'https://image.api.playstation.com',
  'https://psnobj.prod.dl.playstation.net',
  'https://psn-rsc.prod.dl.playstation.net',
  'https://images.igdb.com',
]

// A console's home screen: the game's art, large type and a white pill as the main action. Numbers
// sit on a rule, not in boxes.
const STYLE = `:root { color-scheme: dark; --bg: #06080d; --line: #2a2f3b; --fg: #ffffff; --soft: #d9dde6; --muted: #aab0bd; --field: #171b24; --accent: #c8f26b; --danger: #f2a093; --tier: var(--accent); font-family: Manrope, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
[data-tier="platinum"] { --tier: #bcd6ff; } [data-tier="gold"] { --tier: #f2c14e; } [data-tier="silver"] { --tier: #cfd5dd; } [data-tier="bronze"] { --tier: #d8935f; }
* { box-sizing: border-box; }
body { margin: 0; color: var(--fg); background: var(--bg); font-size: 15px; line-height: 1.5; }
h1, h2, h3, p { margin: 0; }
.pad { padding: 24px; display: grid; gap: 20px; }
.lead { font-size: 14px; font-weight: 600; }
h1 { font-size: 44px; font-weight: 800; line-height: 1.02; letter-spacing: -.03em; text-wrap: balance; }
h2 { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; }
h2 svg { flex: none; width: 18px; height: 18px; fill: none; stroke: var(--tier); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
h3 { font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); }
.muted { color: var(--muted); font-size: 14px; }
.stack { display: grid; gap: 10px; min-width: 0; }
.stack p { color: var(--soft); white-space: pre-wrap; }
.stack strong { color: var(--fg); }
.row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
button { font: inherit; font-weight: 700; min-height: 48px; padding: 8px 22px; color: var(--fg); background: rgba(255,255,255,.16); border: 0; border-radius: 999px; cursor: pointer; }
button:hover:not(:disabled) { background: rgba(255,255,255,.26); }
button:disabled { opacity: .6; cursor: default; }
button.primary { color: var(--bg); background: var(--fg); padding-inline: 34px; }
button.primary:hover:not(:disabled) { background: var(--soft); }
button svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; vertical-align: -4px; margin-inline-end: 6px; }
button.done { color: var(--accent); background: rgba(200,242,107,.14); padding-inline: 22px; opacity: 1; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
input[type=text] { font: inherit; flex: 1 1 160px; min-width: 0; min-height: 48px; padding: 8px 16px; color: var(--fg); background: var(--field); border: 0; border-radius: 12px; }
label { display: flex; gap: 10px; align-items: center; min-height: 44px; font-size: 14px; cursor: pointer; }
label input { width: 18px; height: 18px; accent-color: var(--accent); }
.chip { display: inline-flex; align-items: center; gap: 2px; padding: 3px 4px 3px 14px; background: var(--field); border-radius: 999px; font-size: 14px; font-weight: 600; }
.chip button { min-height: 30px; width: 30px; padding: 0; color: var(--muted); background: none; }
.rule { height: 1px; background: var(--line); border: 0; margin: 0; }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px 20px; padding-block: 14px; border-top: 2px solid var(--tier); border-bottom: 1px solid var(--line); }
.stat { display: grid; grid-template-columns: auto minmax(0, 1fr); column-gap: 12px; row-gap: 6px; align-items: center; min-width: 0; }
.stat-icon { grid-row: span 2; display: grid; place-items: center; width: 44px; height: 44px; color: var(--tier); background: color-mix(in srgb, var(--tier) 14%, transparent); border-radius: 12px; }
.stat-icon svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
.stat b { font-size: 28px; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.stat small { font-size: 15px; font-weight: 600; color: var(--muted); }
.hero { position: relative; display: flex; flex-direction: column; justify-content: flex-end; gap: 14px; min-height: 320px; padding: 24px; overflow: hidden; }
.hero.bare { min-height: 0; }
.hero > img.backdrop { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.hero::after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, rgba(6,8,13,.8), rgba(6,8,13,.15) 65%), linear-gradient(transparent 50%, var(--bg)); }
.hero > :not(.backdrop) { position: relative; z-index: 1; }
.why { display: flex; gap: 16px; align-items: flex-start; }
.cover { flex: none; width: 92px; aspect-ratio: 3 / 4; object-fit: cover; background: var(--field); border-radius: 10px; }
.medal { display: grid; place-items: center; width: 96px; height: 96px; padding: 4px; border: 2px solid var(--tier); border-radius: 50%; background: var(--bg); box-shadow: 0 0 26px color-mix(in srgb, var(--tier) 50%, transparent); }
.medal img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
.medal svg { width: 50px; height: 50px; fill: var(--tier); }
.error { color: var(--danger); font-size: 14px; }
@media (max-width: 460px) { .stats { grid-template-columns: minmax(0, 1fr); } }
[hidden] { display: none !important; }`

// Hosts may wrap a tool's refusal in their own error text, as ChatGPT does: only the tool's message
// goes on screen.
export const READABLE = String.raw`const readable = (raw) => {
  let text = String(raw ?? '');
  try { text = JSON.parse(text).detail ?? text; } catch {}
  const wrapped = text.match(/text=(['"])([\s\S]*?)\1, annotations=/);
  return (wrapped ? wrapped[2] : text).replace(/\\(['"\\])/g, '$1');
};`

const BRIDGE = `
${READABLE}
let nextId = 0;
const pending = new Map();
const post = (message) => parent.postMessage({ jsonrpc: '2.0', ...message }, '*');
const request = (method, params) => new Promise((resolve, reject) => {
  const id = ++nextId;
  pending.set(id, { resolve, reject });
  post({ id, method, params });
});
addEventListener('message', (event) => {
  const message = event.data;
  if (event.source !== parent || !message || message.jsonrpc !== '2.0') return;
  if ('id' in message && !message.method) {
    const call = pending.get(message.id);
    if (!call) return;
    pending.delete(message.id);
    if (message.error) call.reject(new Error(readable(message.error.message)));
    else call.resolve(message.result);
    return;
  }
  if (message.method === 'ui/notifications/tool-result') window.onResult?.({ structuredContent: message.params?._meta?.view ?? window.openai?.toolResponseMetadata?.view ?? message.params?.structuredContent });
});
const callTool = async (name, args) => {
  const result = await request('tools/call', { name, arguments: args });
  if (result?.isError) throw new Error(readable(result.content?.[0]?.text));
  return result?.structuredContent ?? {};
};
const say = (template, values = {}) =>
  template.replace(/\\{(\\w+)\\}/g, (_, key) => String(values[key] ?? ''));
const $ = (id) => document.getElementById(id);
// ChatGPT also has its own call for this; a host that takes neither leaves the page as it is.
const openLink = (url) => request('ui/open-link', { url }).catch(() => window.openai?.openExternal?.({ href: url }));
// Text from the model, with its bold and no other markup: nothing it writes becomes HTML.
const rich = (el, text) => el.replaceChildren(...String(text).split('**').map((part, i) => {
  if (i % 2 === 0) return document.createTextNode(part);
  const strong = document.createElement('strong'); strong.textContent = part; return strong;
}));
request('ui/initialize', {
  protocolVersion: '${PROTOCOL}',
  appInfo: { name: 'PlatJourney', version: '1' },
  appCapabilities: {},
}).then(() => post({ method: 'ui/notifications/initialized' }));
`

const page = (title: string, body: string, script: string, messages: unknown) => {
  const csp = `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' ${FONT_CSS}; font-src ${FONT_FILES}; connect-src 'none'; img-src ${IMAGE_HOSTS.join(' ')} data:`
  // A text inside a message must not close the script it is written into.
  const texts = JSON.stringify(messages).replaceAll('<', '\\u003c')
  const code = `const MESSAGES = ${texts};
const browser = (navigator.language || '').toLowerCase().startsWith('pt') ? 'pt-BR' : 'en';
let T = MESSAGES[browser];
const language = (locale) => { if (MESSAGES[locale]) T = MESSAGES[locale]; document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = T[el.dataset.t]; }); document.querySelectorAll('[data-p]').forEach((el) => { el.placeholder = T[el.dataset.p]; }); };
${BRIDGE}
${script}
language();`
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${csp}"><title>${title}</title><link rel="stylesheet" href="${FONT_CSS}/css2?family=Manrope:wght@400;600;700;800&display=swap"><style>${STYLE}</style></head><body>${body}<script type="module">${code.replaceAll('</script', '<\\/script')}</script></body></html>`
}

export function view(
  uri: string,
  name: string,
  parts: { body: string; script: string; messages: unknown; images?: boolean },
): McpAppResource {
  return {
    uri,
    name,
    mimeType: 'text/html;profile=mcp-app',
    text: page(name, parts.body, parts.script, parts.messages),
    _meta: {
      ui: {
        prefersBorder: false,
        csp: {
          connectDomains: [],
          resourceDomains: [FONT_CSS, FONT_FILES, ...(parts.images ? IMAGE_HOSTS : [])],
        },
      },
    },
  }
}
