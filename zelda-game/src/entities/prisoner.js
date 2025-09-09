import { playAnimIfNotPlaying, followPlayer } from "../utils.js";
import { dialog } from "../uiComponents/dialog.js";
import prisonerLines, { prisonerFreedLines } from "../content/prisonerDialogue.js";
import { gameState, prisonerState, playerState } from "../state/stateManagers.js";

export function generatePrisonerComponents(k, pos) {
    return [
        k.sprite('sprites', {
            anim: 'prisoner-idle-down',
        }),
        k.area({ shape: new k.Rect(k.vec2(2, 6), 12, 50) }),
        k.body({ isStatic: true }),
        k.pos(pos),
        k.offscreen(),
        'prisoner',
    ];
}

export async function startInteraction(k, prisoner, player) {
    if (player.direction === "left") {
        prisoner.flipX = false;
        playAnimIfNotPlaying(prisoner, "prisoner-idle-side");
    }
    if (player.direction === "right") {
        prisoner.flipX = true;
        playAnimIfNotPlaying(prisoner, "prisoner-idle-side");
    }
    if (player.direction === "up") {
        playAnimIfNotPlaying(prisoner, "prisoner-idle-down");
    }
    if (player.direction === "down") {
        playAnimIfNotPlaying(prisoner, "prisoner-idle-up");
    }

    if (gameState.getPrisonDoorOpened()) {
        const freedResponses = prisonerFreedLines[gameState.getLanguage()][0];
        await dialog(k, k.vec2(250, 500), freedResponses);
        prisoner.unuse('body');
        followPlayer(k, player, prisoner);
        return;
    }

    const responses = prisonerLines[gameState.getLanguage()];
    let nbTimesTalkedPrisoner = prisonerState.getNbTimesTalkedPrisoner();
    if (nbTimesTalkedPrisoner > responses.length - 1) {
        prisonerState.setNbTimesTalkedPrisoner(1);
        nbTimesTalkedPrisoner = prisonerState.getNbTimesTalkedPrisoner();
    }
    if (responses[nbTimesTalkedPrisoner]) {
        await dialog(k, k.vec2(250, 500), responses[nbTimesTalkedPrisoner]);
        prisonerState.setNbTimesTalkedPrisoner(nbTimesTalkedPrisoner + 1);
    }
}
