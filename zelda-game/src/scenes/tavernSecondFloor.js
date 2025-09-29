import { setPlayerMovement, generatePlayerComponents } from "../entities/player.js";
import { generateBartenderComponents } from "../entities/bartender.js";
import { colorizeBackground, registerHealthPotionHandler, registerMuteHandler, fetchMapData, drawTiles, drawBoundaries } from "../utils.js";
import { healthBar } from "../uiComponents/healthbar.js";
import { generateSwordsmanComponents, startInteraction as startSwordsmanInteraction } from "../entities/swordsman.js";
import { generateDrunkardComponents, startInteraction as startDrunkardInteraction } from "../entities/drunkard.js";
import { gameState } from "../state/stateManagers.js";
import { startInteraction } from "../entities/bartender.js";
import { setupInventoryUI } from "../uiComponents/inventory.js";


export default async function tavernSecondFloor(k) {
    registerHealthPotionHandler(k);
    registerMuteHandler(k);
    colorizeBackground(k, 27, 29, 52);

    const mapData = await fetchMapData("./assets/maps/tavern-second-floor.json");
    const map = k.add([k.pos(-70, -160)]);
    let previousScene = gameState.getPreviousScene();

    const entities = {
        player: null,        
    };

    const layers = mapData.layers;


    console.log("Map layers:", layers);


    // Handle object layers and entity spawning
    for (const layer of layers) {
        if (layer.name === "Boundaries") {
            drawBoundaries(k, map, layer);
            continue;
        }

        

        if (layer.name === "SpawnPoints") {
            for (const object of layer.objects) {
                if (object.name === "player" && !entities.player) {
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

    entities.player.onCollide("tavern-second-floor-exit", () => {
        gameState.setPreviousScene("tavern-second-floor");
        k.go("tavern");
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