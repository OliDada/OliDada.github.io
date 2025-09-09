import { setPlayerMovement, generatePlayerComponents } from "../entities/player.js";
import { generateFarmerComponents } from "../entities/farmer.js";
import { colorizeBackground, registerHealthPotionHandler, registerMuteHandler, fetchMapData, drawTiles, drawBoundaries } from "../utils.js";
import { healthBar } from "../uiComponents/healthbar.js";
import { gameState, chickenState } from "../state/stateManagers.js";
import { startInteraction } from "../entities/farmer.js";
import { generateChickenComponents } from "../entities/chicken.js";
import { dialog } from "../uiComponents/dialog.js";

export default async function barn(k) {
    registerHealthPotionHandler(k);
    registerMuteHandler(k);
    colorizeBackground(k, 27, 29, 52);

    const mapData = await fetchMapData("./assets/maps/barn.json");
    const map = k.add([k.pos(-70, -160)]);
    let previousScene = gameState.getPreviousScene();

    const entities = {
        player: null,
        farmer: null,
        chickens: [],
    };

    const layers = mapData.layers;

    // Handle object layers and entity spawning
    for (const layer of layers) {
        if (layer.name === "Boundaries") {
            drawBoundaries(k, map, layer);
            continue;
        }

        

        if (layer.name === "SpawnPoints") {
            for (const object of layer.objects) {
                if (object.name === "player" && !entities.player && previousScene !== "barn-side") {
                    entities.player = map.add(generatePlayerComponents(k, k.vec2(object.x, object.y)));
                    continue;
                }

                if (object.name === "farmer") {
                    entities.farmer = map.add(generateFarmerComponents(k, k.vec2(object.x, object.y)));
                    continue;
                }

                if (object.name === "player-barn" && !entities.player && previousScene === "barn-side") {
                    entities.player = map.add(generatePlayerComponents(k, k.vec2(object.x, object.y)));
                    continue;
                }
            }
            continue;
        }
        // Only draw tile layers
        if (layer.type === "tilelayer") {
            drawTiles(k, map, layer, mapData.tileheight, mapData.tilewidth, mapData.tilesets);
        }
    }

    entities.player.onCollide("farmer", () => {
        if (chickenState.isAnyChickenAlive() && !chickenState.isAnyChickenHurt()) {

            startInteraction(k, entities.farmer, entities.player);
        } else {
            dialog(
                k,
                k.vec2(250, 500),
                [["I don't want to talk to you!"]],
                { speed: 10 }
            );
        }
    });

    entities.player.onCollide("barn-exit", () => {
        gameState.setPreviousScene("barn");
        k.go("castle");
    });

    entities.player.onCollide("barn-side-exit", () => {
        gameState.setPreviousScene("barn-side");
        k.go("castle");
    });


    if (
        previousScene === "barn-side" &&
        entities.farmer &&
        entities.player &&
        (chickenState.isAnyChickenHurt() || chickenState.isAnyChickenDead())
    ) {
        // Trigger dead interaction if ALL chickens are dead
        if (
            !chickenState.isAnyChickenAlive() &&
            !chickenState.hasTriggeredDeadInteraction()
        ) {
            chickenState.setTriggeredDeadInteraction(true);
            startInteraction(k, entities.farmer, entities.player);
        }

        // Trigger one dead interaction if ANY chicken is dead (but not all dead)
        else if (
            chickenState.isSomeButNotAllDead() &&
            !chickenState.hasTriggeredOneDeadInteraction()
        ) {
            chickenState.setTriggeredOneDeadInteraction(true);
            startInteraction(k, entities.farmer, entities.player);
        }
        // Trigger hurt interaction if ANY chicken is hurt (but not all dead)
        else if (
            chickenState.isAnyChickenHurt() &&
            chickenState.isAnyChickenAlive() &&
            !chickenState.hasTriggeredHurtInteraction()
        ) {
            chickenState.setTriggeredHurtInteraction(true);
            startInteraction(k, entities.farmer, entities.player);
        }
    }

    k.setCamScale(4); 

    setPlayerMovement(k, entities.player);
    healthBar(k);

}