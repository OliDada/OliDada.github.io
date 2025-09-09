import { bartenderState } from "../state/stateManagers.js";
import bartenderLines from "../content/bartenderDialogue.js";

export function generateBartenderComponents(k, pos) {
    return [
        k.sprite("sprites", { anim: "bartender-idle-down" }),
        k.pos(pos.x, pos.y),
        k.area(),
        k.body(),
        "bartender"
    ];
}

export async function startInteraction(k, bartender, player) {
    
    const responses = bartenderLines[gameState.getLanguage()];

    // Get the number of times the player has talked to the old man
    let nbTimesTalkedBartender = bartenderState.getNbTimesTalkedBartender();
    if (nbTimesTalkedBartender > responses.length - 1) {
        bartenderState.setNbTimesTalkedBartender(1);
        nbTimesTalkedBartender = bartenderState.getNbTimesTalkedBartender();
    }

    // Check if there is a response for the current number of times talked
    if (responses[nbTimesTalkedBartender]) {
        await dialog(
            k,
            k.vec2(250, 500),
            responses[nbTimesTalkedBartender],
            dialogOptions
        );
        bartenderState.setNbTimesTalkedBartender(nbTimesTalkedBartender + 1);
    }
}
