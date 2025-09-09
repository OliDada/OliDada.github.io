import { playAnimIfNotPlaying } from "../utils.js";
import { dialog } from "../uiComponents/dialog.js";
import lumberjackLines from "../content/lumberjackDialogue.js";
import { gameState, lumberjackState, playerState } from "../state/stateManagers.js";

export function generateLumberjackComponents(k, pos) {
    return [
        k.sprite('sprites', {
            anim: 'lumberjack-idle-down',
        }),
        k.area({ shape: new k.Rect(k.vec2(2, 6), 12, 13) }),
        k.body({ isStatic: true}),
        k.pos(pos),
        k.offscreen(),
        k.opacity(),
        {
            speed: 30,
        },
        'lumberjack',
    ];
}

export async function startInteraction(k, lumberjack, player) {
    if (player.direction === "left") {
        lumberjack.flipX = false;
        playAnimIfNotPlaying(lumberjack, "lumberjack-idle-side");
    }
    if (player.direction === "right") {
        lumberjack.flipX = true;
        playAnimIfNotPlaying(lumberjack, "lumberjack-idle-side");
    }
    if (player.direction === "up") {
        playAnimIfNotPlaying(lumberjack, "lumberjack-idle-down");
    }
    if (player.direction === "down") {
        playAnimIfNotPlaying(lumberjack, "lumberjack-idle-up");
    }

    const responses = lumberjackLines[gameState.getLanguage()];
    let nbTimesTalkedLumberjack = lumberjackState.getNbTimesTalkedLumberjack();

    // If player has had potion and hasn't heard the gift line yet
    if (playerState.getHasHadPotion() && !lumberjackState.getHasMentionedGift() && playerState.getPotions() > 0) {
        await dialog(k, k.vec2(250, 500), responses[5], { speed: 10 });
        lumberjackState.setHasMentionedGift(true);
        return;
    }

    // Only cycle through the first 5 lines
    if (nbTimesTalkedLumberjack > 4) {
        lumberjackState.setNbTimesTalkedLumberjack(1);
        nbTimesTalkedLumberjack = lumberjackState.getNbTimesTalkedLumberjack();
    }

    // Skip lines 1 and 2 ("Did you get that gift from my wife?") if gift has been mentioned
    let lineToSay = nbTimesTalkedLumberjack;
    if (lumberjackState.getHasMentionedGift() && (nbTimesTalkedLumberjack === 2 || nbTimesTalkedLumberjack === 0)) {
        lineToSay = 4;
        lumberjackState.setNbTimesTalkedLumberjack(4); // Keep cycling from here
    }

    if (responses[lineToSay]) {
        await dialog(
            k,
            k.vec2(250, 500),
            responses[lineToSay],
            { speed: 10 }
        );
        lumberjackState.setNbTimesTalkedLumberjack(nbTimesTalkedLumberjack + 1);
    }
}
