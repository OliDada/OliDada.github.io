import { setPlayerMovement, generatePlayerComponents } from "../entities/player.js";
import { generateGuardComponents } from "../entities/guard.js";
import { colorizeBackground, registerHealthPotionHandler, registerMuteHandler, fetchMapData, drawTiles, drawBoundaries, onAttacked, isPartiallyOnScreen } from "../utils.js";
import { startInteraction } from "../entities/guard.js";
import { generateChestComponents, startChestInteraction } from "../entities/chest.js";
import { healthBar } from "../uiComponents/healthbar.js";
import { gameState } from "../state/stateManagers.js";


export default async function castle(k) {
    
    const previousScene = gameState.getPreviousScene();

    console.log("previousScene:", previousScene);

    registerHealthPotionHandler(k);
    registerMuteHandler(k);
    colorizeBackground(k, 8, 148, 236);

    const mapData = await fetchMapData("./assets/maps/castle-main.json");
    const map = k.add([k.pos(100, 100)]);

    const entities = {
        player: null,
        chests: [],
        guards: [],
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


                if (object.name === "player" && !entities.player && previousScene !== "throne-room" && previousScene !== "castle-main-underground" && previousScene !== "castle-main-well") {
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

                if (object.name === "player-throne-room" && !entities.player && previousScene === "throne-room") {
                    entities.player = map.add(generatePlayerComponents(k, k.vec2(object.x, object.y)));
                    continue;
                }

                if (object.name === "player-castle-main-underground" && !entities.player && previousScene === "castle-main-underground") {
                    entities.player = map.add(generatePlayerComponents(k, k.vec2(object.x, object.y)));
                    continue;
                }

                if (object.name === "player-castle-well" && !entities.player && previousScene === "castle-main-well") {
                    entities.player = map.add(generatePlayerComponents(k, k.vec2(object.x, object.y)));
                    continue;
                }

                if (object.name === "guard-1") {
                    entities.guards.push(
                        map.add(
                            generateGuardComponents(
                                k,
                                k.vec2(object.x, object.y),
                                "guard-1-idle-down"
                            )
                        )
                    );
                    continue;
                }

                if (object.name === "guard-2") {
                    entities.guards.push(
                        map.add(
                            generateGuardComponents(
                                k,
                                k.vec2(object.x, object.y),
                                "guard-2-idle-down"
                            )
                        )
                    );
                    continue;
                }

                if (object.name === "guard-3") {
                    const guard3 = map.add(
                        generateGuardComponents(
                            k,
                            k.vec2(object.x, object.y),
                            "guard-3-down",
                            "guard-3"
                        )
                    );
                    entities.guards.push(guard3);

                    const startY = object.y;
                    const endY = startY - 300;
                    let direction = -1;
                    let currentAnim = "guard-3-down";
                    
                    k.loop(0.3, () => {
                        k.wait(Math.random(0.5, 1.5));
                        if (!isPartiallyOnScreen(k, guard3)) return;
                        if (guard3.pos.y <= endY) {
                            direction = 1;
                            if (currentAnim !== "guard-3-down") {
                                guard3.play("guard-3-down");
                                currentAnim = "guard-3-down";
                            }
                        }
                        if (guard3.pos.y >= startY) {
                            direction = -1;
                            if (currentAnim !== "guard-3-up") {
                                guard3.play("guard-3-up");
                                currentAnim = "guard-3-up";
                            }
                        }
                        guard3.move(0, 40 * direction);
                    });
                }
            }
            continue;
        }
        // Only draw tile layers
        if (layer.type === "tilelayer") {
            drawTiles(k, map, layer, mapData.tileheight, mapData.tilewidth, mapData.tilesets);
        }
    }


    if (entities.player) {
        entities.player.onCollide("guard-1", (guard) => {
            startInteraction(k, guard, entities.player, 0); // 0 for guard-1
        });

        entities.player.onCollide("guard-2", (guard) => {
            startInteraction(k, guard, entities.player, 1); // 1 for guard-2
        });

        entities.player.onCollide("guard-3", (guard) => {
            startInteraction(k, guard, entities.player, 2); // 2 for guard-3
        });

        entities.player.onCollide("castle-main-exit", () => {
            gameState.setPreviousScene("castle-main");
            k.go('castle');
        });

        entities.player.onCollide("throne-room-entrance", () => {
            k.go('throne-room');
        });

        entities.player.onCollide("castle-main-underground-entrance", () => {
            gameState.setPreviousScene("castle-main");
            k.go('castle-main-underground');
        });

        entities.player.onCollide("castle-well-exit", () => {
            gameState.setPreviousScene("castle-main-well");
            k.go("castle-main-underground");
        });

    }

    // Set camera to follow player
    k.setCamScale(3);
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

    // Add FPS counter as a UI object
    k.add([
        k.text(`FPS: ${Math.round(1 / k.dt())}`, {
            size: 16,
            font: 'gameboy',
        }),
        k.pos(12, 12),
        k.fixed(),
        { layer: 'ui' },
        {
            update() {
                this.text = `FPS: ${Math.round(1 / k.dt())}`;
            },
        },
    ]);
}