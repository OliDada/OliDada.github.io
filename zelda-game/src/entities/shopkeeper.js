import { playAnimIfNotPlaying } from "../utils.js";
import { dialog } from "../uiComponents/dialog.js";
import shopkeeperLines from "../content/shopkeeperDialogue.js";
import { gameState, shopkeeperState, playerState } from "../state/stateManagers.js";
import { healthBar } from "../uiComponents/healthbar.js";

export function generateShopkeeperComponents(k, pos) {
    return [
        k.sprite('sprites', {
            anim: 'shopkeeper-idle-down',
        }),
        k.area({ shape: new k.Rect(k.vec2(2, 6), 12, 18) }),
        k.body({ isStatic: true }),
        k.pos(pos),
        k.offscreen(),
        'shopkeeper',
    ];
}

export async function startInteraction(k, shopkeeper, player, options = {}) {
    if (options.overrideDialogue && Array.isArray(options.overrideDialogue)) {
        // Always face left for special dialogue
        shopkeeper.flipX = true;
        playAnimIfNotPlaying(shopkeeper, "shopkeeper-idle-side");
        // After dialogue, face down after 0.5s
        await dialog(k, k.vec2(250, 500), options.overrideDialogue);
        setTimeout(() => {
            playAnimIfNotPlaying(shopkeeper, "shopkeeper-idle-down");
        }, 7000);
        return;
    } else {
        if (player.direction === "left") {
            shopkeeper.flipX = false;
            playAnimIfNotPlaying(shopkeeper, "shopkeeper-idle-side");
        }
        if (player.direction === "right") {
            shopkeeper.flipX = true;
            playAnimIfNotPlaying(shopkeeper, "shopkeeper-idle-side");
        }
        if (player.direction === "up") {
            playAnimIfNotPlaying(shopkeeper, "shopkeeper-idle-down");
        }
        if (player.direction === "down") {
            playAnimIfNotPlaying(shopkeeper, "shopkeeper-idle-up");
        }
    }

    const responses = shopkeeperLines[gameState.getLanguage()];

    let nbOfTimesTalkedShopkeeper = shopkeeperState.getNbOfTimesTalkedShopkeeper();

    // Only for the first interaction, play sound and show potion after potion line
    let dialogOptions = {};
    if (nbOfTimesTalkedShopkeeper === 0) {
        dialogOptions.onLine = (idx) => {
            if (idx === 1 && k.play) { // 0-based index, second line
                playerState.setHasHadPotion(true);
                k.destroyAll("heartsContainer");
                healthBar(k);
            }
        };
    }

    if (nbOfTimesTalkedShopkeeper > responses.length - 1) {
        shopkeeperState.setNbOfTimesTalkedShopkeeper(1);
        nbOfTimesTalkedShopkeeper = shopkeeperState.getNbOfTimesTalkedShopkeeper();
    }

    // Give a potion on first interaction
    let gavePotion = false;
    if (nbOfTimesTalkedShopkeeper === 0) {
        playerState.addPotion(1);
        gavePotion = true;
    }

    // Check if there is a response for the current number of times talked
    if (responses[nbOfTimesTalkedShopkeeper]) {
        await dialog(
            k,
            k.vec2(250, 500),
            responses[nbOfTimesTalkedShopkeeper],
            dialogOptions
        );
        shopkeeperState.setNbOfTimesTalkedShopkeeper(nbOfTimesTalkedShopkeeper + 1);

        // Show potion UI after dialogue if potion was given
        if (gavePotion) {
            k.destroyAll("heartsContainer");
            healthBar(k);
            k.play && k.play("item");
        }
    }
}
