import { setPlayerMovement, generatePlayerComponents } from "../entities/player.js";
import { generateChestComponents, startChestInteraction } from "../entities/chest.js";
import { colorizeBackground, registerHealthPotionHandler, registerMuteHandler, fetchMapData, drawTiles, drawBoundaries, onAttacked, isPartiallyOnScreen } from "../utils.js";
import { healthBar } from "../uiComponents/healthbar.js";
import { gameState } from "../state/stateManagers.js";


export default async function forest(k) {
    
    const previousScene = gameState.getPreviousScene();

    console.log("previousScene:", previousScene);

    registerHealthPotionHandler(k);
    registerMuteHandler(k);
    colorizeBackground(k, 8, 148, 236);

    const mapData = await fetchMapData("./assets/maps/forest.json");
    const map = k.add([k.pos(100, 100)]);

    const entities = {
        player: null,
        chests: [],
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
                if (object.name === "player" && !entities.player && previousScene !== "witch-house") {
                    entities.player = map.add(generatePlayerComponents(k, k.vec2(object.x, object.y)));
                    continue;
                }

                if (object.name === "player-witch-house" && !entities.player && previousScene === "witch-house") {
                    entities.player = map.add(generatePlayerComponents(k, k.vec2(object.x, object.y)));
                }

                if (object.name === 'chest') {
                    // Try to get contents from object property, fallback to "health-potion"
                    const contents =
                        object.contents ||
                        object.properties?.find((p) => p.name === 'contents')
                            ?.value ||
                        'health-potion';
                    const key = `${Math.round(object.x)},${Math.round(
                        object.y
                    )}`;
                    const isOpen = gameState.getChestOpened(key);
                    const chest = map.add(
                        generateChestComponents(
                            k,
                            k.vec2(object.x, object.y),
                            contents,
                            isOpen
                        )
                    );
                    entities.chests.push(chest);
                }
            }
            continue;
        }

        // Only draw tile layers
        if (layer.type === "tilelayer") {
            drawTiles(k, map, layer, mapData.tileheight, mapData.tilewidth, mapData.tilesets);
        }
    }
    
    entities.player.onCollide("forest-exit", () => {
        gameState.setPreviousScene("forest");
        k.go("castle");
    });

    entities.player.onCollide("witch-house-entrance", () => {
        gameState.setPreviousScene("forest");
        k.go("witch-house");
    });

    entities.player.onCollide('chest', (chest) => {
        startChestInteraction(k, chest, entities.player);
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


}