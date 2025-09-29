import { playAnimIfNotPlaying, followPlayer } from "../utils.js";
import { dialog } from "../uiComponents/dialog.js";
import { gameState, playerState, drunkardState } from "../state/stateManagers.js";
import drunkardLines from "../content/drunkardDialogue.js";

export function generateDrunkardComponents(k, pos) {
    return [
        k.sprite('Everything', {
            anim: 'drunkard-idle-down',
        }),
        k.area({ shape: new k.Rect(k.vec2(2, 6), 12, 50) }),
        k.body({ isStatic: true }),
        k.pos(pos),
        k.offscreen(),
        'drunkard',
        {
            name: 'drunkard',
            hp() { return 1; },
            hurt() {},
        },
    ];
}

export async function startInteraction(k, drunkard, player) {
    if (player.direction === "left") {
        drunkard.flipX = true;
        playAnimIfNotPlaying(drunkard, "drunkard-idle-side");
    }
    if (player.direction === "right") {
        drunkard.flipX = false;
        playAnimIfNotPlaying(drunkard, "drunkard-idle-side");
    }
    if (player.direction === "up") {
        playAnimIfNotPlaying(drunkard, "drunkard-idle-down");
    }
    if (player.direction === "down") {
        playAnimIfNotPlaying(drunkard, "drunkard-idle-up");
    }

    const responses = drunkardLines[gameState.getLanguage()];
    let nbTimesTalkedDrunkard = drunkardState.getNbTimesTalkedDrunkard();
    if (nbTimesTalkedDrunkard > responses.length - 1) {
        drunkardState.setNbTimesTalkedDrunkard(1);
        nbTimesTalkedDrunkard = drunkardState.getNbTimesTalkedDrunkard();
    }
    if (responses[nbTimesTalkedDrunkard]) {
        await dialog(k, k.vec2(250, 500), responses[nbTimesTalkedDrunkard]);
        drunkardState.setNbTimesTalkedDrunkard(nbTimesTalkedDrunkard + 1);
    }
}
