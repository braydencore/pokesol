const STORAGE_KEY = "pokesol.playerId";

export function getPersistentPlayerId() {
    if (typeof window === "undefined" || !window.localStorage) {
        return "guest";
    }

    try {
        let id = window.localStorage.getItem(STORAGE_KEY);
        if (!id) {
            id = crypto.randomUUID();
            window.localStorage.setItem(STORAGE_KEY, id);
        }
        return id;
    } catch (error) {
        return "guest";
    }
}
