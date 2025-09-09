import { frogState, gameState, playerState } from "../state/stateManagers.js";
import frogLines from "../content/frogDialogue.js";
import { dialog } from "../uiComponents/dialog.js";
import { healthBar } from "../uiComponents/healthbar.js";

export function generateFrogComponents(k, pos) {
    return [
        k.sprite("sprites", { anim: "frog-idle-down" }),
        k.pos(pos.x, pos.y),
        k.area({ shape: new k.Rect(k.vec2(2, 6), 12, 12) }),
        k.body({ isStatic: true }),
        "frog"
    ];
}

export async function startInteraction(k, frog, player, frogIndex = 0) {
    const lines = frogLines[gameState.getLanguage()]; // Always use first frog's lines
    let nbTimesTalkedFrog = frogState.getNbTimesTalkedFrog();
    let lineToSay = nbTimesTalkedFrog;

    if (lines[lineToSay]) {
        await dialog(
            k,
            k.vec2(250, 500),
            [lines[lineToSay]],
            { speed: 10 }
        );
    }
    frogState.setNbTimesTalkedFrog(nbTimesTalkedFrog + 1);
}
