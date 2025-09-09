import hatguyLines from "../content/hatguyDialogue.js";
import { dialog } from "../uiComponents/dialog.js";
import { healthBar } from "../uiComponents/healthbar.js";
import { playAnimIfNotPlaying } from "../utils.js";
import { gameState, hatguyState, cowState, playerState } from "../state/stateManagers.js";

export function generateHatguyComponents(k, pos) {
    return [
        k.sprite("Everything", { anim: "hatguy-idle-down" }),
        k.pos(pos.x, pos.y),
        k.area(),
        k.body({ isStatic: true }),
        k.health(3),
        k.offscreen(),
        "hatguy",
    ];
}

export async function startInteraction(k, hatguy, player, hatguyIndex = 0) {

    if (player.direction === "left") {
        hatguy.flipX = false;
        playAnimIfNotPlaying(hatguy, "hatguy-idle-side");
    }
    if (player.direction === "right") {
        hatguy.flipX = true;
        playAnimIfNotPlaying(hatguy, "hatguy-idle-side");
    }
    if (player.direction === "up") {
        playAnimIfNotPlaying(hatguy, "hatguy-idle-down");
    }
    if (player.direction === "down") {
        playAnimIfNotPlaying(hatguy, "hatguy-idle-up");
    }

    let nbTimesTalkedHatguy = hatguyState.getNbTimesTalkedHatguy();
    const allResponses = hatguyLines[gameState.getLanguage()];
    let responses = allResponses[nbTimesTalkedHatguy] || allResponses[allResponses.length - 1];

    if (cowState.getIsFollowingPlayer() === true && cowState.getCowQuestComplete() === false) {
        await dialog(
            k,
            k.vec2(250, 500),
            ["You found her! Hooray! Thank you so much for bringing her back.", "Here is a reward for your kindness. I don't have much, but please take this.", "It's beans, they taste pretty bad but you might find them useful.", "Oh and could I maybe... Get that carrot back?"],
            { speed: 10 }
        );
        playerState.setHasCarrot(false);
        playerState.setHasMagicalBeans(true);
        k.destroyAll("heartsContainer");
        healthBar(k);
        k.play("item");
        cowState.setCowQuestComplete(true);
        return;
    }
    if (cowState.getCowQuestComplete() === true) {
        await dialog(
            k,
            k.vec2(250, 500),
            ["Thank you again for bringing her back! You are a true hero."],
            { speed: 10 }
        );

        return;
    }

    // Give carrot only when a certain line in dialog is reached
    let dialogOptions = {};
    if (nbTimesTalkedHatguy === 0) {
        dialogOptions.onLine = (idx) => {
            if (idx === 4) { // 0-based index, fifth line
                playerState.setHasCarrot(true);
                k.destroyAll("heartsContainer");
                healthBar(k);
                if (k.play) {
                    k.play("item");
                }
            }
        };
    }

    if (responses) {
        await dialog(
            k,
            k.vec2(250, 500),
            responses,
            { speed: 10, ...dialogOptions }
        );
        hatguyState.setNbTimesTalkedHatguy(nbTimesTalkedHatguy + 1);
    }
}
