import Phaser from "phaser";
import { Scene1 } from "./Scene1";
import { Scene2 } from "./Scene2";

// On touch devices the game screen sits in a portrait Game Boy-style shell
// (see index.html), so it gets a taller, narrower resolution than the
// original 800x450 landscape one - every UI panel (FireRedMenuUI,
// FireRedBattleUI, PokemonCenterManager) reads its layout from
// scene.scale.width/height rather than hardcoding 800/450, so this is safe.
const isTouchDevice = typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(pointer: coarse)").matches;

const GAME_WIDTH = isTouchDevice ? 480 : 800;
const GAME_HEIGHT = isTouchDevice ? 600 : 450;

const Config = {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent: "game-container",
    pixelArt: true,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: "arcade",
        arcade: {
            gravity: {y: 0}
        }
    },
    scene: [Scene1, Scene2],
};

export default new Phaser.Game(Config);
