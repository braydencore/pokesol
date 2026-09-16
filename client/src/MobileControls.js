import Phaser from "phaser";

/*================================================
| Drives the on-screen touch D-pad/buttons defined in index.html by
| calling onDown()/onUp() directly on Phaser's own Key objects - the same
| objects every other file gets back from addKey()/createCursorKeys() for
| a given key code. That makes a touch press behave exactly like a real
| keydown/keyup (including JustDown/JustUp), so movement, menus, dialogue
| and battle all pick it up with no changes of their own.
*/
const BUTTON_KEY_CODES = {
    "touch-up": Phaser.Input.Keyboard.KeyCodes.UP,
    "touch-down": Phaser.Input.Keyboard.KeyCodes.DOWN,
    "touch-left": Phaser.Input.Keyboard.KeyCodes.LEFT,
    "touch-right": Phaser.Input.Keyboard.KeyCodes.RIGHT,
    "touch-confirm": Phaser.Input.Keyboard.KeyCodes.Z,
    "touch-cancel": Phaser.Input.Keyboard.KeyCodes.X
};

export default class MobileControls {
    constructor(scene) {
        this.scene = scene;
        this.bindings = [];

        Object.entries(BUTTON_KEY_CODES).forEach(([elementId, keyCode]) => {
            const element = document.getElementById(elementId);
            if (!element) {
                return;
            }

            const key = scene.input.keyboard.addKey(keyCode);

            const press = (event) => {
                event.preventDefault();
                key.onDown({ timeStamp: performance.now() });
            };
            const release = (event) => {
                event.preventDefault();
                key.onUp({ timeStamp: performance.now() });
            };

            element.addEventListener("pointerdown", press);
            element.addEventListener("pointerup", release);
            element.addEventListener("pointercancel", release);
            element.addEventListener("pointerleave", release);

            this.bindings.push({ element, press, release });
        });
    }

    destroy() {
        this.bindings.forEach(({ element, press, release }) => {
            element.removeEventListener("pointerdown", press);
            element.removeEventListener("pointerup", release);
            element.removeEventListener("pointercancel", release);
            element.removeEventListener("pointerleave", release);
        });
        this.bindings = [];
    }
}
