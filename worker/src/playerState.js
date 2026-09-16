import { CHOICES, NEUTRAL_EMOTION, RESOLVED_NPC_DEFINITIONS } from "./npcDefinitions.js";

const NPC_BY_ID = new Map(RESOLVED_NPC_DEFINITIONS.map((npc) => [npc.id, npc]));

export class PlayerState {
    constructor(ctx, env) {
        this.ctx = ctx;
        this.env = env;
        this.state = null;
    }

    async fetch(request) {
        try {
            await this.ensureState();

            const url = new URL(request.url);

            if (url.pathname === "/npcs" && request.method === "GET") {
                const mapName = url.searchParams.get("map") || undefined;
                return Response.json(this.listNpcs(mapName));
            }

            const interactMatch = url.pathname.match(/^\/npcs\/([^/]+)\/interact$/);
            if (interactMatch && request.method === "POST") {
                const npcId = interactMatch[1];
                const body = await request.json().catch(() => ({}));
                const choiceId = String(body.choiceId || "TALK");
                const result = this.interact(npcId, choiceId);
                await this.persist();
                return Response.json(result);
            }

            return new Response("Not found", { status: 404 });
        } catch (error) {
            return Response.json({ error: "NPC_REQUEST_FAILED", message: error.message }, { status: 500 });
        }
    }

    async ensureState() {
        if (this.state) {
            return this.state;
        }

        const stored = await this.ctx.storage.get("state");
        this.state = stored || {
            trust: {},
            clues: [],
            histories: {},
            emotions: {},
            flags: { finaleUnlocked: false, storyComplete: false }
        };

        for (const npc of RESOLVED_NPC_DEFINITIONS) {
            if (typeof this.state.trust[npc.id] !== "number") {
                this.state.trust[npc.id] = 0;
            }
            if (!this.state.emotions[npc.id]) {
                this.state.emotions[npc.id] = { ...NEUTRAL_EMOTION };
            }
        }

        return this.state;
    }

    async persist() {
        await this.ctx.storage.put("state", this.state);
    }

    listNpcs(mapName) {
        return {
            npcs: RESOLVED_NPC_DEFINITIONS
                .filter((npc) => !mapName || npc.map === mapName)
                .map((npc) => this.serializeNpc(npc.id)),
            story: this.serializeStory()
        };
    }

    interact(npcId, choiceId) {
        const npc = NPC_BY_ID.get(npcId);
        if (!npc) {
            throw new Error(`Unknown NPC: ${npcId}`);
        }

        const resolvedChoice = CHOICES[choiceId] ? choiceId : "TALK";
        const outcome = this.resolveStoryBeat(npc, resolvedChoice);
        const response = this.generateResponse(npc, outcome);

        return {
            npc: this.serializeNpc(npc.id),
            response,
            story: this.serializeStory()
        };
    }

    serializeNpc(npcId) {
        const npc = NPC_BY_ID.get(npcId);
        return {
            id: npc.id,
            name: npc.name,
            title: npc.title,
            map: npc.map,
            x: npc.x,
            y: npc.y,
            spriteKey: npc.spriteKey,
            spriteFrame: npc.spriteFrame,
            emotion: this.state.emotions[npc.id] || NEUTRAL_EMOTION,
            trust: this.state.trust[npc.id] || 0,
            availableChoices: this.getChoicesForNpc(npc)
        };
    }

    serializeStory() {
        return {
            clueCount: this.state.clues.length,
            clues: this.state.clues.map((clueId) => {
                const owner = RESOLVED_NPC_DEFINITIONS.find((npc) => npc.clueId === clueId);
                return {
                    id: clueId,
                    title: owner?.clueTitle || clueId,
                    text: owner?.clueText || clueId
                };
            }),
            finaleUnlocked: this.state.flags.finaleUnlocked,
            storyComplete: this.state.flags.storyComplete
        };
    }

    getChoicesForNpc(npc) {
        const choices = [CHOICES.TALK, CHOICES.LISTEN, CHOICES.ASK];

        if (this.state.clues.length > 0) {
            choices.push(CHOICES.SHARE);
        }

        choices.push(CHOICES.PRESS);

        if (npc.id === "orin" && this.state.flags.finaleUnlocked && !this.state.flags.storyComplete) {
            choices.push(CHOICES.REUNITE);
        }

        choices.push(CHOICES.GOODBYE);
        return choices;
    }

    resolveStoryBeat(npc, choiceId) {
        const trustBefore = this.state.trust[npc.id] || 0;
        let trustDelta = 0;
        let unlockedClue = null;
        let specialHint = "";
        let actionName = "greet";
        let tone = "neutral";

        if (this.state.flags.storyComplete) {
            return {
                choiceId,
                actionName: "greet",
                tone: "calm",
                trustDelta: 0,
                unlockedClue: null,
                specialHint: npc.completion,
                isGuarded: false
            };
        }

        switch (choiceId) {
        case "TALK":
            trustDelta = trustBefore === 0 ? 1 : 0;
            specialHint = npc.opening;
            actionName = "greet";
            tone = "warm";
            break;
        case "LISTEN":
            trustDelta = 2;
            specialHint = npc.support;
            actionName = "comfort";
            tone = "comfort";
            break;
        case "ASK":
            trustDelta = 1;
            actionName = "ask_for_help";
            if (trustBefore + trustDelta >= npc.revealThreshold) {
                unlockedClue = this.unlockClue(npc.clueId);
                specialHint = unlockedClue ? npc.clueText : `"You've heard the important part already," ${npc.name} says.`;
                tone = unlockedClue ? "reveal" : "repeat";
            } else {
                specialHint = npc.guarded;
                tone = "guarded";
            }
            break;
        case "SHARE":
            trustDelta = 2;
            actionName = "share_clue";
            if (this.state.clues.length >= npc.shareNeed) {
                unlockedClue = this.unlockClue(npc.clueId);
                specialHint = unlockedClue ? npc.clueText : `${npc.name} nods. "That fits the rest of the pattern."`;
                tone = unlockedClue ? "reveal" : "share";
            } else {
                specialHint = "\"Bring me something sharper than a hunch,\" the NPC says.";
                tone = "guarded";
            }
            break;
        case "PRESS":
            trustDelta = -1;
            actionName = "accuse";
            if (trustBefore >= npc.pressThreshold || this.state.clues.length >= Math.max(1, npc.shareNeed)) {
                unlockedClue = this.unlockClue(npc.clueId);
                specialHint = unlockedClue ? npc.clueText : npc.pressure;
                tone = unlockedClue ? "shaken_reveal" : "tense";
            } else {
                specialHint = npc.pressure;
                tone = "tense";
            }
            break;
        case "REUNITE":
            trustDelta = 1;
            actionName = "reunite_town";
            if (npc.id === "orin" && this.state.flags.finaleUnlocked) {
                this.state.flags.storyComplete = true;
                specialHint = "Orin finally smiles. \"Bring the town together at the square. Calm voices will turn the Lantern from whispers into song.\"";
                tone = "resolution";
            } else {
                specialHint = "\"Not yet,\" Orin says. \"The town still needs more truth than hope.\"";
                tone = "guarded";
            }
            break;
        case "GOODBYE":
            actionName = "greet";
            specialHint = `"Until later," ${npc.name} says.`;
            tone = "farewell";
            break;
        default:
            specialHint = npc.opening;
        }

        this.state.trust[npc.id] = clamp(trustBefore + trustDelta, 0, 7);
        this.state.flags.finaleUnlocked = this.isFinaleUnlocked();

        return {
            choiceId,
            actionName,
            tone,
            trustDelta,
            unlockedClue,
            specialHint,
            isGuarded: tone === "guarded"
        };
    }

    unlockClue(clueId) {
        if (this.state.clues.includes(clueId)) {
            return null;
        }

        this.state.clues.push(clueId);
        return clueId;
    }

    isFinaleUnlocked() {
        return this.state.clues.includes("crate_confession") && this.state.clues.length >= 4;
    }

    generateResponse(npc, outcome) {
        const emotion = this.createLocalEmotion(npc, outcome);
        this.state.emotions[npc.id] = emotion;

        const text = this.buildFallbackText(npc, outcome, emotion);

        return {
            choiceId: outcome.choiceId,
            text,
            lines: wrapDialogue(text, 38, 4),
            emotion,
            unlockedClue: outcome.unlockedClue ? this.serializeStory().clues.find((clue) => clue.id === outcome.unlockedClue) : null,
            availableChoices: this.getChoicesForNpc(npc)
        };
    }

    buildFallbackText(npc, outcome, emotion) {
        const moodPrefix = getMoodPrefix(emotion.label);
        const clueLine = outcome.unlockedClue
            ? `New clue: ${npc.clueText}`
            : "";
        const finaleLine = this.state.flags.storyComplete
            ? "The square should feel different now."
            : this.state.flags.finaleUnlocked && npc.id === "orin"
                ? "You have enough pieces. Ask Orin to unite the town."
                : "";

        return [
            moodPrefix ? `${npc.name} ${moodPrefix}` : `${npc.name} answers carefully.`,
            outcome.specialHint,
            clueLine,
            finaleLine
        ].filter(Boolean).join(" ");
    }

    createLocalEmotion(npc, outcome) {
        const labelByTone = {
            warm: "trust",
            comfort: "relief",
            reveal: "curiosity",
            shaken_reveal: "fear",
            resolution: "joy",
            tense: "anger",
            guarded: "neutral",
            farewell: "neutral",
            calm: "joy",
            repeat: "neutral",
            share: "curiosity"
        };

        const label = labelByTone[outcome.tone] || "neutral";
        return {
            label,
            intensity: 0.35,
            vad: {
                V: label === "anger" ? -0.2 : 0.35,
                A: label === "fear" || label === "anger" ? 0.55 : 0.18,
                D: npc.id === "sable" ? 0.2 : -0.1
            }
        };
    }
}

function getMoodPrefix(label) {
    const lowered = (label || "").toLowerCase();
    if (lowered.includes("joy") || lowered.includes("trust")) {
        return "looks lighter than before.";
    }

    if (lowered.includes("fear") || lowered.includes("anx")) {
        return "glances over a shoulder before speaking.";
    }

    if (lowered.includes("anger")) {
        return "tightens their jaw.";
    }

    if (lowered.includes("sad") || lowered.includes("grief")) {
        return "lets the silence hang for a second.";
    }

    if (lowered.includes("curi")) {
        return "leans in, suddenly attentive.";
    }

    if (lowered.includes("relief")) {
        return "breathes out slowly.";
    }

    return "";
}

function wrapDialogue(text, lineLength, maxLines) {
    const words = (text || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let currentLine = "";

    for (const word of words) {
        const nextLine = currentLine ? `${currentLine} ${word}` : word;
        if (nextLine.length > lineLength) {
            if (currentLine) {
                lines.push(currentLine);
            }
            currentLine = word;
        } else {
            currentLine = nextLine;
        }
    }

    if (currentLine) {
        lines.push(currentLine);
    }

    return lines.slice(0, maxLines);
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
