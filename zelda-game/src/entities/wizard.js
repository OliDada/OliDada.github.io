import { playAnimIfNotPlaying } from "../utils.js";
import { dialog } from "../uiComponents/dialog.js";
import wizardLines from "../content/wizardDialogue.js";
import { gameState, wizardState, playerState } from "../state/stateManagers.js";

export function generateWizardComponents(k, pos) {
    return [
        k.sprite('sprites', {
            anim: 'wizard-idle-down',
        }),
        k.area({ shape: new k.Rect(k.vec2(2, 6), 12, 18) }),
        k.body({ isStatic: true }),
        k.pos(pos),
        k.offscreen(),
        'wizard',
    ];
}

export async function startInteraction(k, wizard, player, options = {}) {
    if (options.overrideDialogue && Array.isArray(options.overrideDialogue)) {
        // Always face left for special dialogue
        wizard.flipX = true;
        playAnimIfNotPlaying(wizard, "wizard-idle-side");
        // After dialogue, face down after 0.5s
        await dialog(k, k.vec2(250, 500), options.overrideDialogue);
        setTimeout(() => {
            playAnimIfNotPlaying(wizard, "wizard-idle-down");
        }, 7000);
        return;
    } else {
        if (player.direction === "left") {
            wizard.flipX = false;
            playAnimIfNotPlaying(wizard, "wizard-idle-side");
        }
        if (player.direction === "right") {
            wizard.flipX = true;
            playAnimIfNotPlaying(wizard, "wizard-idle-side");
        }
        if (player.direction === "up") {
            playAnimIfNotPlaying(wizard, "wizard-idle-up");
        }
        if (player.direction === "down") {
            playAnimIfNotPlaying(wizard, "wizard-idle-down");
        }
    }

    const responses = wizardLines[gameState.getLanguage()];

    // Get the number of times the player has talked to the old man
    let nbOfTimesTalkedWizard = wizardState.getNbOfTimesTalkedWizard();
    if (nbOfTimesTalkedWizard > responses.length - 1) {
        wizardState.setNbOfTimesTalkedWizard(1);
        nbOfTimesTalkedWizard = wizardState.getNbOfTimesTalkedWizard();
    }

    // Check if there is a response for the current number of times talked
    if (responses[nbOfTimesTalkedWizard]) {
        await dialog(k, k.vec2(250, 500), responses[nbOfTimesTalkedWizard]);
        wizardState.setNbOfTimesTalkedWizard(nbOfTimesTalkedWizard + 1);
    }
}
