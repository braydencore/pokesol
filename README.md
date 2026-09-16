# Simple realtime platform game build with Phaser.io
**Simple realtime Pokemon game build with Phaser 3, running on Cloudflare Pages + Workers.**

![PokeMMO](https://github.com/aaron5670/PokeMMO-Online-Realtime-Multiplayer-Game/blob/master/docs/images/PokeMMO.gif?raw=true)

### Features & ToDo
- [x] Multiple players can join the game
- [x] Maps are can be created/edited with [Tiled Map Editor](https://www.mapeditor.org/)
- [x] Multiple levels/maps
- [ ] Pokémons added
- [ ] Can going inside building (In progress)

### Architecture
- `client/` — Phaser 3 game, built with Webpack, deployed as a static site
  to **Cloudflare Pages**.
- `worker/` — Cloudflare **Worker** with two Durable Object classes:
  `MapRoom` (one instance per map, relays player position over
  WebSocket) and `PlayerState` (one instance per player, owns NPC
  trust/clue progress). Serves both `/ws` and the `/api/npcs*` REST
  routes. See `worker/README.md` for deploy details.
- `server/` — the original Node/Express/Colyseus server. Superseded by
  `worker/` and no longer wired to the client; kept around for reference
  until the Cloudflare port is verified in production, then safe to
  delete.

### How to run locally
```
// Clone this repository
$ git clone https://github.com/aaron5670/PokeMMO-Online-Realtime-Multiplayer-Game.git

// Install and start the worker (backend)
$ cd worker && npm install && npm run dev
// listens on http://localhost:8787

// In a new terminal, install and start the client
$ cd client && npm install && npm start
```
After successfully install go to [http://localhost:8080](http://localhost:8080/)

### Deploying
1. Deploy the worker: `cd worker && npm run deploy` (see `worker/README.md`
   — no Cloudflare domain or paid plan required, it deploys to a free
   `*.workers.dev` URL and uses SQLite-backed Durable Objects).
2. Build the client against that URL:
   `WORKER_URL=https://pokesol-worker.<your-subdomain>.workers.dev npm run build`
   (from `client/`), then deploy the `client/dist` folder to Cloudflare
   Pages.
