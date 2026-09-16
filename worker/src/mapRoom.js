export class MapRoom {
    constructor(ctx, env) {
        this.ctx = ctx;
        this.env = env;
    }

    async fetch(request) {
        if (request.headers.get("Upgrade") !== "websocket") {
            return new Response("Expected websocket", { status: 426 });
        }

        const url = new URL(request.url);
        const mapName = url.searchParams.get("map");
        const x = Number(url.searchParams.get("x"));
        const y = Number(url.searchParams.get("y"));

        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair);

        const sessionId = crypto.randomUUID();
        const playerRecord = {
            sessionId,
            map: mapName,
            x: Number.isFinite(x) ? x : 0,
            y: Number.isFinite(y) ? y : 0
        };

        // Hibernatable WebSockets don't keep plain instance state alive between
        // events, so each connection's player record travels as a serialized
        // attachment on the socket itself rather than living in a JS Map here.
        this.ctx.acceptWebSocket(server, [sessionId]);
        server.serializeAttachment(playerRecord);

        server.send(JSON.stringify({
            type: "CURRENT_PLAYERS",
            data: { sessionId, players: this.snapshotPlayers() }
        }));

        this.broadcast({ type: "PLAYER_JOINED", data: playerRecord }, sessionId);

        return new Response(null, { status: 101, webSocket: client });
    }

    webSocketMessage(ws, message) {
        const record = ws.deserializeAttachment();
        if (!record) {
            return;
        }

        let parsed;
        try {
            parsed = JSON.parse(message);
        } catch (error) {
            return;
        }

        const { type, data } = parsed || {};
        if (!type || !data) {
            return;
        }

        if (type === "PLAYER_MOVED") {
            record.x = data.x;
            record.y = data.y;
            ws.serializeAttachment(record);

            this.broadcast({
                type: "PLAYER_MOVED",
                data: { ...record, position: data.position }
            }, record.sessionId);
            return;
        }

        if (type === "PLAYER_MOVEMENT_ENDED") {
            this.broadcast({
                type: "PLAYER_MOVEMENT_ENDED",
                data: { sessionId: record.sessionId, map: record.map, position: data.position }
            }, record.sessionId);
        }
    }

    webSocketClose(ws) {
        this.handleDisconnect(ws);
    }

    webSocketError(ws) {
        this.handleDisconnect(ws);
    }

    handleDisconnect(ws) {
        const record = ws.deserializeAttachment();
        if (!record) {
            return;
        }

        this.broadcast({ type: "PLAYER_LEFT", data: { sessionId: record.sessionId, map: record.map } }, record.sessionId);
    }

    snapshotPlayers() {
        const players = {};
        for (const ws of this.ctx.getWebSockets()) {
            const record = ws.deserializeAttachment();
            if (record) {
                players[record.sessionId] = record;
            }
        }
        return players;
    }

    broadcast(message, exceptSessionId) {
        const payload = JSON.stringify(message);
        for (const ws of this.ctx.getWebSockets()) {
            const record = ws.deserializeAttachment();
            if (record?.sessionId === exceptSessionId) {
                continue;
            }
            ws.send(payload);
        }
    }
}
