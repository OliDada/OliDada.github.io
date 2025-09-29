import { playAnimIfNotPlaying, followPlayer } from "../utils.js";
import { dialog } from "../uiComponents/dialog.js";
import { gameState, prisonerState, playerState } from "../state/stateManagers.js";

export function generateRedRidingHoodComponents(k, pos) {
    return [
        k.sprite('Everything', {
            anim: 'red-riding-hood-idle-down',
        }),
        k.area({ shape: new k.Rect(k.vec2(2, 6), 12, 50) }),
        k.body({ isStatic: true }),
        k.pos(pos),
        k.offscreen(),
        'red-riding-hood',
        {   
            name: 'red-riding-hood',
            hp() { return 1; },
            hurt() {},
        },
    ];
}

export async function startInteraction(k, redRidingHood, player) {
    if (player.direction === "left") {
        redRidingHood.flipX = true;
        playAnimIfNotPlaying(redRidingHood, "red-riding-hood-idle-side");
    }
    if (player.direction === "right") {
        redRidingHood.flipX = false;
        playAnimIfNotPlaying(redRidingHood, "red-riding-hood-idle-side");
    }
    if (player.direction === "up") {
        playAnimIfNotPlaying(redRidingHood, "red-riding-hood-idle-down");
    }
    if (player.direction === "down") {
        playAnimIfNotPlaying(redRidingHood, "red-riding-hood-idle-up");
    }

    const responses = redRidingHoodLines[gameState.getLanguage()];
    let nbTimesTalkedRedRidingHood = redRidingHoodState.getNbTimesTalkedRedRidingHood();
    if (nbTimesTalkedRedRidingHood > responses.length - 1) {
        redRidingHoodState.setNbTimesTalkedRedRidingHood(1);
        nbTimesTalkedRedRidingHood = redRidingHoodState.getNbTimesTalkedRedRidingHood();
    }
    if (responses[nbTimesTalkedRedRidingHood]) {
        await dialog(k, k.vec2(250, 500), responses[nbTimesTalkedRedRidingHood]);
        redRidingHoodState.setNbTimesTalkedRedRidingHood(nbTimesTalkedRedRidingHood + 1);
    }
}
