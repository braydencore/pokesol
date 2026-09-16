# PokeSol Worker

Cloudflare Worker that replaces the old Colyseus server. Two Durable Object
classes:

- **`MapRoom`** — one instance per map (`idFromName(mapName)`), relays
  player position over WebSocket (`/ws?map=<name>&x=<x>&y=<y>`) to everyone
  else currently on that same map. Uses the WebSocket Hibernation API, so
  idle maps don't hold the Worker warm.
- **`PlayerState`** — one instance per player (`idFromName(playerId)`,
  keyed by a UUID the client generates and keeps in `localStorage`), owns
  that player's NPC trust/clue/story progress. Backs the `/api/npcs*`
  routes.

## Local development

```
npm install
npm run dev
```

This starts `wrangler dev`, listening on `http://localhost:8787` by
default — matching the client's default `WORKER_URL`.

## Deploying

```
npx wrangler login   # first time only
npm run deploy
```

Wrangler prints the Worker's `*.workers.dev` URL. Set that as `WORKER_URL`
when building the client (see `client/README` build step), e.g.:

```
WORKER_URL=https://pokesol-worker.<your-subdomain>.workers.dev npm run build
```

Durable Objects here use the SQLite storage backend (`new_sqlite_classes`
in `wrangler.toml`), which is available on the Workers **free** plan — no
paid plan required to deploy this as-is.

CORS on `/api/*` is currently wide open (`Access-Control-Allow-Origin: *`)
since there's no known Pages domain yet. Once you have one, lock
`CORS_HEADERS` in `src/index.js` down to that origin.
