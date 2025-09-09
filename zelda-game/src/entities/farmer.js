import farmerLines from "../content/farmerDialogue.js";
import { dialog } from "../uiComponents/dialog.js";
import { gameState, farmerState } from "../state/stateManagers.js";
import { playAnimIfNotPlaying } from "../utils.js";
import { chickenState } from "../state/stateManagers.js";

export function generateFarmerComponents(k, pos, tag = "farmer") {
    return [
        k.sprite("sprites", { anim: "farmer-idle-down" }),
        k.pos(pos.x, pos.y),
        k.area(),
        k.body({ isStatic: true }),
        k.health(2),
        k.offscreen(),
        tag,
    ];
}

export async function startInteraction(k, farmer, player, farmerIndex = 0) {
    // If player entered from barn-side and any chicken is hurt or dead
    
    if (
        gameState.getPreviousScene() === "barn-side" &&
        (chickenState.isAnyChickenHurt() || chickenState.isAnyChickenDead())
    ) {
        farmer.flipX = true;
        playAnimIfNotPlaying(farmer, "farmer-idle-side");
        let lines;
        if (!chickenState.isAnyChickenAlive()) {
            // All chickens dead
            lines = [["No! My chickens! What have you done? T-they're all dead!"], ["Just leave! You monster!"]];
        } else if (chickenState.isSomeButNotAllDead && typeof chickenState.isSomeButNotAllDead === "function" && chickenState.isSomeButNotAllDead()) {
            // Some but not all dead
            lines = [["You killed Beatrice! That was my favorite chicken!"], ["I can't believe you would do this!"]];
        } else {
            // Hurt but none dead
            lines = [["Hey! What's your problem? Leave my chickens alone!"], ["You think you can just waltz in here and mess with my chickens?"], ["Get lost!"]];
        }

        await dialog(
            k,
            k.vec2(250, 500),
            lines,
        );
        await k.wait(2);
        playAnimIfNotPlaying(farmer, "farmer-idle-down");
        return;
    }

    if (player.direction === "left") {
        farmer.flipX = false;
        playAnimIfNotPlaying(farmer, "farmer-idle-side");
    }
    if (player.direction === "right") {
        farmer.flipX = true;
        playAnimIfNotPlaying(farmer, "farmer-idle-side");
    }
    if (player.direction === "up") {
        playAnimIfNotPlaying(farmer, "farmer-idle-down");
    }
    if (player.direction === "down") {
        playAnimIfNotPlaying(farmer, "farmer-idle-up");
    }

    

    // Default dialogue
    const responses = farmerLines[gameState.getLanguage()];
    let nbTimesTalkedFarmer = farmerState.getNbTimesTalkedFarmer();

    // Clamp to last available set
    if (nbTimesTalkedFarmer >= responses.length) {
        nbTimesTalkedFarmer = responses.length - 1;
        farmerState.setNbTimesTalkedFarmer(nbTimesTalkedFarmer);
    }

    // Show all lines in the current set
    await dialog(
        k,
        k.vec2(250, 500),
        responses[nbTimesTalkedFarmer],
        { speed: 10 }
    );
    farmerState.setNbTimesTalkedFarmer(nbTimesTalkedFarmer + 1);

    
}
