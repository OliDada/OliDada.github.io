import { playAnimIfNotPlaying } from "../utils.js";
import { dialog } from "../uiComponents/dialog.js";
import lumberjackLines from "../content/lumberjackDialogue.js";
import { gameState, lumberjackState, playerState, slimeState } from "../state/stateManagers.js";

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
    let hasMentionedSlimesDefeated = lumberjackState.getHasMentionedSlimesDefeated();
    let nbTimesTalkedLumberjack = lumberjackState.getNbTimesTalkedLumberjack();

    // Show first regular line
    let showSpecialAfter = false;
    if (typeof slimeState !== "undefined" && slimeState.areBothSlimesDead && slimeState.areBothSlimesDead() === true && !hasMentionedSlimesDefeated) {
        showSpecialAfter = true;
        hasMentionedSlimesDefeated = true;
        lumberjackState.setHasMentionedSlimesDefeated(true);
    }

    // If player has had potion and hasn't heard the gift line yet
    if (playerState.getHasHadPotion() && !lumberjackState.getHasMentionedGift()) {
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
        let lines = responses[lineToSay];
        if (showSpecialAfter) {
            lines = [
                ...lines,
                "Oh and by the way... You really cleaned up those slimes! You're a real natural.",
                "Let me teach you a trick. You can perform a charge attack by pressing 'shift'."
            ];
        }
        await dialog(
            k,
            k.vec2(250, 500),
            lines,
            { speed: 10 }
        );
        lumberjackState.setNbTimesTalkedLumberjack(nbTimesTalkedLumberjack + 1);
    }
}
