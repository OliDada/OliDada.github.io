import { setPlayerMovement, generatePlayerComponents } from "../entities/player.js";
import { generateBeanStalkComponents } from "../entities/beanStalk.js";
import { colorizeBackground, registerHealthPotionHandler, registerMuteHandler, fetchMapData, drawTiles, drawBoundaries, onAttacked, isPartiallyOnScreen, onCollideWithPlayer } from "../utils.js";
import { healthBar } from "../uiComponents/healthbar.js";
import { gameState, beanStalkState } from "../state/stateManagers.js";
import { dialog } from "../uiComponents/dialog.js";
import { setupInventoryUI } from "../uiComponents/inventory.js";


export default async function clouds(k) {


    const previousScene = gameState.getPreviousScene();

    console.log("previousScene:", previousScene);

    registerHealthPotionHandler(k);
    registerMuteHandler(k);
    colorizeBackground(k, 8, 148, 236);

    const mapData = await fetchMapData("./assets/maps/clouds.json");
    const map = k.add([k.pos(100, 100)]);

    const entities = {
        player: null,
        gardener: null,
        
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


                if (object.name === "player" && !entities.player && previousScene !== "troll-dinner") {
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

    entities.player.onCollide("clouds-exit", () => {
        gameState.setPreviousScene("clouds");
        k.go("bean-stalk");
    });

    entities.player.onCollide("bean-stalk-exit", () => {
        gameState.setPreviousScene("bean-stalk");
        k.go("forest-east");
    });

    // Set camera to follow player
    k.setCamScale(4);
    if (entities.player && typeof entities.player.worldPos === "function") {
        k.setCamPos(entities.player.worldPos());
    }

    k.onUpdate(() => {
        if (entities.player && typeof entities.player.worldPos === "function") {
            const playerPos = entities.player.worldPos();
            const camPos = k.getCamPos();
            if (playerPos && camPos && playerPos.dist(camPos) > 1) {
                k.tween(
                    camPos,
                    playerPos,
                    0.15,
                    (newPos) => {
                        k.setCamPos(newPos);
                    },
                    k.easings.linear
                );
            }
        }
    });



    setPlayerMovement(k, entities.player);
    healthBar(k);
    setupInventoryUI(k);

}