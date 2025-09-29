import { playAnimIfNotPlaying } from "../utils.js";
import { dialog } from "../uiComponents/dialog.js";
import oldmanLines from "../content/oldmanDialogue.js";
import { gameState, oldmanState, playerState } from "../state/stateManagers.js";
import { healthBar } from "../uiComponents/healthbar.js";

export function generateOldManComponents(k, pos) {
    return [
        k.sprite('sprites', {
            anim: 'oldman-idle-down',
        }),
        k.area({ shape: new k.Rect(k.vec2(2, 6), 12, 23) }),
        k.body({ isStatic: true }),
        k.pos(pos),
        k.offscreen(),
        'oldman',
    ];
}

export async function startInteraction(k, oldman, player) {
    if (player.direction === "left") {
        oldman.flipX = true;
        playAnimIfNotPlaying(oldman, "oldman-idle-side");
    }
    if (player.direction === "right") {
        oldman.flipX = false;
        playAnimIfNotPlaying(oldman, "oldman-idle-side");
    }
    if (player.direction === "up") {
        playAnimIfNotPlaying(oldman, "oldman-idle-down");
    }
    if (player.direction === "down") {
        playAnimIfNotPlaying(oldman, "oldman-idle-up");
    }

    const responses = oldmanLines[gameState.getLanguage()];

    // Get the number of times the player has talked to the old man
    let nbTimesTalkedOldMan = oldmanState.getNbTimesTalkedOldman();
    if (nbTimesTalkedOldMan > responses.length - 1) {
        oldmanState.setNbTimesTalkedOldman(1);
        nbTimesTalkedOldMan = oldmanState.getNbTimesTalkedOldman();
    }

    // Check if there is a response for the current number of times talked
    if (responses[nbTimesTalkedOldMan]) {
        // Only for the first interaction, play sound and equip sword after sword line
        let dialogOptions = {};
        if (nbTimesTalkedOldMan === 0) {
            dialogOptions.onLine = (idx) => {
                if (idx === 2 && k.play) {
                    k.play("item");
                    playerState.setIsSwordEquipped(true);
                    k.destroyAll("heartsContainer");
                    healthBar(k);
                }
            };
        }
        // Merge portrait into dialogOptions
        //dialogOptions.portrait = "oldman-portrait";

        await dialog(
            k,
            k.vec2(250, 500),
            responses[nbTimesTalkedOldMan],
            dialogOptions
        );
        oldmanState.setNbTimesTalkedOldman(nbTimesTalkedOldMan + 1);
    }
}
