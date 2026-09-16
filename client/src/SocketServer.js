/*================================================
| Array with current online players
*/
export const onlinePlayers = {};

const WS_BASE_URL = WORKER_URL.replace(/^http/, "ws");

let activeSocket = null;

/*================================================
| Opens a WebSocket to the Durable Object for `mapName`, closing any
| previous connection first (map changes mean a new DO, not a message on
| the old one). `room` is a live-bound export: importers read whatever
| the most recent connectToMap() call resolved.
*/
export let room = null;

export function connectToMap(mapName, position = {}) {
    if (activeSocket) {
        activeSocket.close();
        activeSocket = null;
    }

    const params = new URLSearchParams({
        map: mapName,
        x: String(Math.round(position.x ?? 0)),
        y: String(Math.round(position.y ?? 0))
    });

    room = new Promise((resolve, reject) => {
        const ws = new WebSocket(`${WS_BASE_URL}/ws?${params.toString()}`);
        const listeners = new Map();

        const currentRoom = {
            sessionId: null,
            send(type, data) {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type, data }));
                }
            },
            onMessage(type, handler) {
                if (!listeners.has(type)) {
                    listeners.set(type, []);
                }
                listeners.get(type).push(handler);

                return () => {
                    const handlers = listeners.get(type) || [];
                    const index = handlers.indexOf(handler);
                    if (index !== -1) {
                        handlers.splice(index, 1);
                    }
                };
            },
            close() {
                ws.close();
            }
        };

        ws.addEventListener("message", (event) => {
            let message;
            try {
                message = JSON.parse(event.data);
            } catch (error) {
                return;
            }

            if (message.type === "CURRENT_PLAYERS" && message.data?.sessionId) {
                currentRoom.sessionId = message.data.sessionId;
            }

            const specificHandlers = listeners.get(message.type) || [];
            const wildcardHandlers = listeners.get("*") || [];
            [...specificHandlers, ...wildcardHandlers].forEach((handler) => handler(message.type, message.data));
        });

        ws.addEventListener("open", () => {
            activeSocket = currentRoom;
            resolve(currentRoom);
        });

        ws.addEventListener("error", (event) => reject(event));
    }).catch((e) => {
        console.log("JOIN ERROR", e);
    });

    return room;
}
