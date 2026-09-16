import { MapRoom } from "./mapRoom.js";
import { PlayerState } from "./playerState.js";
import { KNOWN_MAPS } from "./maps.js";

export { MapRoom, PlayerState };

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
};

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (request.method === "OPTIONS") {
            return new Response(null, { headers: CORS_HEADERS });
        }

        if (url.pathname === "/ws") {
            return handleWebSocket(url, env);
        }

        if (url.pathname === "/api/npcs" && request.method === "GET") {
            return handleListNpcs(url, env);
        }

        const interactMatch = url.pathname.match(/^\/api\/npcs\/([^/]+)\/interact$/);
        if (interactMatch && request.method === "POST") {
            return handleInteract(request, interactMatch[1], env);
        }

        return new Response("Not found", { status: 404 });
    }
};

function handleWebSocket(url, env) {
    const mapName = url.searchParams.get("map");
    if (!mapName || !KNOWN_MAPS.includes(mapName)) {
        return new Response("Unknown map", { status: 400 });
    }

    const id = env.MAP_ROOM.idFromName(mapName);
    const stub = env.MAP_ROOM.get(id);

    const forwardUrl = new URL("https://map-room/ws");
    forwardUrl.search = url.search;

    return stub.fetch(new Request(forwardUrl, { headers: { Upgrade: "websocket" } }));
}

async function handleListNpcs(url, env) {
    const playerId = String(url.searchParams.get("playerId") || "guest");
    const map = url.searchParams.get("map") || "";

    const stub = playerStateStub(playerId, env);
    const doUrl = new URL("https://player-state/npcs");
    if (map) {
        doUrl.searchParams.set("map", map);
    }

    const response = await stub.fetch(doUrl);
    return withCors(response);
}

async function handleInteract(request, npcId, env) {
    const payload = await request.json().catch(() => ({}));
    const playerId = String(payload.playerId || "guest");
    const choiceId = String(payload.choiceId || "TALK");

    const stub = playerStateStub(playerId, env);
    const doUrl = new URL(`https://player-state/npcs/${encodeURIComponent(npcId)}/interact`);

    const response = await stub.fetch(doUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choiceId })
    });

    return withCors(response);
}

function playerStateStub(playerId, env) {
    const id = env.PLAYER_STATE.idFromName(playerId);
    return env.PLAYER_STATE.get(id);
}

async function withCors(response) {
    const body = await response.text();
    return new Response(body, {
        status: response.status,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
    });
}
