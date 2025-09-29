import { setPlayerMovement, generatePlayerComponents } from "../entities/player.js";
import { generateChestComponents, startChestInteraction } from "../entities/chest.js";
import { generateSlimeComponents } from "../entities/slime.js";
import { colorizeBackground, registerHealthPotionHandler, registerMuteHandler, fetchMapData, drawTiles, drawBoundaries, onAttacked, isPartiallyOnScreen, onCollideWithPlayer } from "../utils.js";
import { healthBar } from "../uiComponents/healthbar.js";
import { gameState } from "../state/stateManagers.js";
import { setSlimeAI } from "../entities/slime.js";
import { setupInventoryUI } from "../uiComponents/inventory.js";


export default async function castleMainUnderground(k) {

    const previousScene = gameState.getPreviousScene();

    console.log("previousScene:", previousScene);

    registerHealthPotionHandler(k);
    registerMuteHandler(k);
    colorizeBackground(k, 27, 29, 52);

    const mapData = await fetchMapData("./assets/maps/castle-main-underground.json");
    const map = k.add([k.pos(100, 100)]);

    const entities = {
        player: null,
        chests: [],
        slimes: [],
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

                if (object.name === "player" && previousScene !== "castle-main-well") {
                    entities.player = map.add(generatePlayerComponents(k, k.vec2(object.x, object.y)));
                    continue;
                }

                if (object.name === "player-castle-well" && !entities.player && previousScene === "castle-main-well") {
                    entities.player = map.add(generatePlayerComponents(k, k.vec2(object.x, object.y)));
                    continue;
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

    entities.player.onCollide("castle-main-underground-exit", () => {
        gameState.setPreviousScene("castle-main-underground");
        k.go("castle-main");
    });

    entities.player.onCollide("castle-well-entrance", () => {
        gameState.setPreviousScene("castle-main-well");
        k.go("castle-main");
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
    setupInventoryUI(k);

}