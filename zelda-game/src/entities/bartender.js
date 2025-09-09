import { bartenderState, gameState, playerState } from "../state/stateManagers.js";
import bartenderLines from "../content/bartenderDialogue.js";
import { dialog } from "../uiComponents/dialog.js";
import { healthBar } from "../uiComponents/healthbar.js";

export function generateBartenderComponents(k, pos) {
    return [
        k.sprite("sprites", { anim: "bartender-idle-down" }),
        k.pos(pos.x, pos.y),
        k.area({ shape: new k.Rect(k.vec2(2, 6), 12, 25) }),
        k.body({ isStatic: true }),
        "bartender"
    ];
}

export async function startInteraction(k, bartender, player, bartenderIndex = 0) {
    const responses = bartenderLines[gameState.getLanguage()][bartenderIndex];
    let nbTimesTalkedBartender = bartenderState.getNbTimesTalkedBartender();

     // Only for the first interaction, play sound and show potion after potion line
    let dialogOptions = {};
    if (nbTimesTalkedBartender === 0) {
        // Give a potion to the player, matching shopkeeper logic
        playerState.addPotion(1);
        dialogOptions.onLine = (idx) => {
            if (idx === 1 && k.play) { // 0-based index, second line
                playerState.setHasHadPotion(true);
                k.destroyAll("heartsContainer");
                healthBar(k);
            }
        };
    }

    // Use the last available line if index is out of bounds
    if (nbTimesTalkedBartender >= responses.length) {
        nbTimesTalkedBartender = responses.length - 1;
        bartenderState.setNbTimesTalkedBartender(nbTimesTalkedBartender);
    }

    let lineToSay = nbTimesTalkedBartender;

    if (responses[lineToSay]) {
        await dialog(
            k,
            k.vec2(250, 500),
            responses,
            { speed: 10 }
        );
        bartenderState.setNbTimesTalkedBartender(nbTimesTalkedBartender + 1);
    }
}
