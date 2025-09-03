import guardLines from "../content/guardsDialogue.js";
import { dialog } from "../uiComponents/dialog.js";
import { gameState, guardState } from "../state/stateManagers.js";

export function generateKingComponents(k, pos, anim = "king-idle-down", tag = "king") {
    return [
        k.sprite("sprites", { anim: anim }),
        k.pos(pos.x, pos.y),
        k.area(),
        k.body({ isStatic: true }),
        k.health(5),
        k.offscreen(),
        tag,
    ];
}

export async function startInteraction(k, king, player) {
    const responses = guardLines[gameState.getLanguage()][guardIndex];
    let nbTimesTalkedGuard = guardState.getNbTimesTalkedGuard();

    // Use the last available line if index is out of bounds
    if (nbTimesTalkedGuard >= responses.length) {
        nbTimesTalkedGuard = responses.length - 1;
        guardState.setNbTimesTalkedGuard(nbTimesTalkedGuard);
    }

    let lineToSay = nbTimesTalkedGuard;

    if (responses[lineToSay]) {
        await dialog(
            k,
            k.vec2(250, 500),
            responses,
            { speed: 10 }
        );
        guardState.setNbTimesTalkedGuard(nbTimesTalkedGuard + 1);
    }
}
