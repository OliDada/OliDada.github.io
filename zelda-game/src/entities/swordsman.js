import { gameState, playerState, swordsmanState } from "../state/stateManagers.js";
import { dialog } from "../uiComponents/dialog.js";
import swordsmanLines from "../content/swordsmanDialogue.js";
import { playAnimIfNotPlaying } from "../utils.js";
import { healthBar } from "../uiComponents/healthbar.js";

export function generateSwordsmanComponents(k, pos) {
    return [
        k.sprite("Everything", { anim: "swordsman-idle-down" }),
        k.pos(pos.x, pos.y),
        k.area({ shape: new k.Rect(k.vec2(2, 6), 12, 25) }),
        k.body({ isStatic: true }),
        "swordsman"
    ];
}

export async function startInteraction(k, swordsman, player, swordsmanIndex = 0) {
    if (player.direction === "left") {
            swordsman.flipX = false;
            playAnimIfNotPlaying(swordsman, "swordsman-idle-side");
        }
        if (player.direction === "right") {
            swordsman.flipX = true;
            playAnimIfNotPlaying(swordsman, "swordsman-idle-side");
        }
        if (player.direction === "up") {
            playAnimIfNotPlaying(swordsman, "swordsman-idle-down");
        }
        if (player.direction === "down") {
            playAnimIfNotPlaying(swordsman, "swordsman-idle-up");
        }

    const responses = swordsmanLines[gameState.getLanguage()][swordsmanIndex];
    let nbTimesTalkedSwordsman = swordsmanState.getNbTimesTalkedSwordsman();

     // Only for the first interaction, play sound and show potion after potion line
    let dialogOptions = {};
    if (nbTimesTalkedSwordsman === 0) {
        // Give a potion to the player, matching shopkeeper logic
        playerState.addPotion(1);
        dialogOptions.onLine = (idx) => {
            if (idx === 1 && k.play) { // 0-based index, second line
                playerState.setHasHadPotion(true);
                k.play("item");
                k.destroyAll("heartsContainer");
                healthBar(k);
            }
        };
    }

    // Use the last available line if index is out of bounds
    if (nbTimesTalkedSwordsman >= responses.length) {
        nbTimesTalkedSwordsman = responses.length - 1;
        swordsmanState.setNbTimesTalkedSwordsman(nbTimesTalkedSwordsman);
    }

    let lineToSay = nbTimesTalkedSwordsman;

    if (responses[lineToSay]) {
        await dialog(
            k,
            k.vec2(250, 500),
            responses,
            { speed: 10, ...dialogOptions }
        );
        swordsmanState.setNbTimesTalkedSwordsman(nbTimesTalkedSwordsman + 1);
    }
}
