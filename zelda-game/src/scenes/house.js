import { colorizeBackground, playAnimIfNotPlaying, drawBoundaries, drawTiles, fetchMapData, registerMuteHandler, registerHealthPotionHandler } from "../utils.js"
import { generatePlayerComponents, setPlayerMovement } from "../entities/player.js";
import { generateOldManComponents, startInteraction } from "../entities/oldman.js";
import { healthBar } from "../uiComponents/healthbar.js";
import { gameState } from "../state/stateManagers.js";
import { setupInventoryUI } from "../uiComponents/inventory.js";

export default async function house(k) {

    registerHealthPotionHandler(k);
    registerMuteHandler(k);
    colorizeBackground(k, 27, 29, 52);

    const mapData = await fetchMapData("./assets/maps/house.json");

    const map = k.add([k.pos(100, 200)]);

    const entities = {
        player: null,
        oldman: [],
    };

    const layers = mapData.layers;
    for (const layer of layers) {
        if (layer.name === "Boundaries") {
            drawBoundaries(k, map, layer);
            continue;
        }
        if (layer.name === "SpawnPoints") {
            for (const object of layer.objects) {
                if (object.name === "player") {
                    entities.player = map.add(generatePlayerComponents(k, k.vec2(object.x, object.y)));
                    continue;
                } else if (object.name === "oldman") {
                    entities.oldman = map.add(generateOldManComponents(k, k.vec2(object.x, object.y)));
                    continue;
                }

                if (object.name === "door-entrance") {
                    map.add(
                       generateColliderBoxComponents(
                            k,
                            object.width,
                            object.height,
                            k.vec2(object.x, object.y),
                           "door-entrance"
                        )
                    );
                    continue;
                }
            }
        }

        // Only draw tile layers
        if (layer.type === "tilelayer") {
            drawTiles(k, map, layer, mapData.tileheight, mapData.tilewidth, mapData.tilesets);
        }
        
    }

    k.setCamScale(4);

    setPlayerMovement(k, entities.player);

    entities.player.onCollide("door-exit", () => {
        gameState.setPreviousScene("house");
        k.play("door-open");
        k.go("world");
    });

    entities.player.onCollide("oldman", () => {
        startInteraction(k, entities.oldman, entities.player);
    });

    entities.player.onCollideEnd("oldman", async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
        playAnimIfNotPlaying(entities.oldman, "oldman-idle-down");
    });

    healthBar(k);
    setupInventoryUI(k);

}

