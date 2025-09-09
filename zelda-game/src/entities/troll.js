import { playAnimIfNotPlaying } from "../utils.js";
import { dialog } from "../uiComponents/dialog.js";
import trollLines from "../content/oldmanDialogue.js";
import { gameState, playerState } from "../state/stateManagers.js";
import { healthBar } from "../uiComponents/healthbar.js";

export function generateTrollComponents(k, pos) {
    return [
        k.sprite('Everything', {
            anim: 'troll-idle-down',
        }),
        k.body({ isStatic: true }),
        k.pos(pos),
        k.offscreen(),
        'troll',
    ];
}

export async function startInteraction(k, troll, player) {
    if (player.direction === "left") {
        troll.flipX = true;
        playAnimIfNotPlaying(troll, "troll-idle-side");
    }
    if (player.direction === "right") {
        troll.flipX = false;
        playAnimIfNotPlaying(troll, "troll-idle-side");
    }
    if (player.direction === "up") {
        playAnimIfNotPlaying(troll, "troll-idle-down");
    }
    if (player.direction === "down") {
        playAnimIfNotPlaying(troll, "troll-idle-up");
    }

    const responses = trollLines[gameState.getLanguage()];

    // Get the number of times the player has talked to the troll
    let nbTimesTalkedTroll = trollState.getNbTimesTalkedTroll();
    if (nbTimesTalkedTroll > responses.length - 1) {
        trollState.setNbTimesTalkedTroll(1);
        nbTimesTalkedTroll = trollState.getNbTimesTalkedTroll();
    }

    // Check if there is a response for the current number of times talked
    if (responses[nbTimesTalkedTroll]) {
        let dialogOptions = {};
        await dialog(
            k,
            k.vec2(250, 500),
            responses[nbTimesTalkedTroll],
            dialogOptions
        );
        trollState.setNbTimesTalkedTroll(nbTimesTalkedTroll + 1);
    }
}
