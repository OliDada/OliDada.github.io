import { setPlayerMovement, generatePlayerComponents } from "../entities/player.js";
import { generatePrisonerComponents, startInteraction } from "../entities/prisoner.js";
import { generateChickenComponents, setChickenAI } from "../entities/chicken.js";
import { colorizeBackground, registerHealthPotionHandler, registerMuteHandler, fetchMapData, drawTiles, drawBoundaries, onAttacked, isPartiallyOnScreen, playAnimIfNotPlaying, openWorldMap, lastPlayerPosManager } from "../utils.js";
import { healthBar } from "../uiComponents/healthbar.js";
import { gameState, chickenState } from "../state/stateManagers.js";
import { generateChestComponents, startChestInteraction } from "../entities/chest.js";
import { setupInventoryUI } from "../uiComponents/inventory.js";

export default async function castle(k) {
    const currentSong = gameState.getCurrentSong();
    if (!currentSong || !currentSong.name || currentSong.name !== "castle-soundtrack") {
        gameState.pauseCurrentSong();
        const newSong = k.play("castle-soundtrack", { loop: true });
        newSong.name = "castle-soundtrack"; // Attach a name property for tracking
        gameState.setCurrentSong(newSong);
    }
    // Pause previous soundtrack if playing (using global state)
    
    const previousScene = gameState.getPreviousScene();

    console.log("previousScene:", previousScene);

    registerHealthPotionHandler(k);
    registerMuteHandler(k);
    colorizeBackground(k, 8, 148, 236);

    const mapData = await fetchMapData("./assets/maps/castle.json");
    const map = k.add([k.pos(100, 100)]);

    const entities = {
        player: null,
        chicken: [],
        chests: [],
        prisoner: null,
    };

    const layers = mapData.layers;


    // Handle object layers and entity spawning
    for (const layer of layers) {
        if (layer.name === "Boundaries") {
            drawBoundaries(k, map, layer);
            continue;
        }

        if (layer.name === "SpawnPoints") {
            // Collect all chicken spawn objects first, but only spawn up to 3
            const chickenSpawnObjects = layer.objects.filter(obj => obj.name === "chicken").slice(0, 3);
            // Only initialize chicken health if not initialized AND health array is empty
            if (!chickenState.isInitialized() && chickenState.getChickenHealth().length === 0) {
                chickenState.initIfNeeded(chickenSpawnObjects.length);
            }
            const healthArr = chickenState.getChickenHealth();
            for (let i = 0; i < chickenSpawnObjects.length; i++) {
                if (i >= healthArr.length) break;
                const health = healthArr[i];
                if (health === 0) {
                    entities.chicken.push(null); // Maintain index mapping
                    continue; // Dead, don't respawn
                }
                const object = chickenSpawnObjects[i];
                const chickenEntity = map.add(
                    generateChickenComponents(
                        k,
                        k.vec2(object.x, object.y),
                        health
                    )
                );
                entities.chicken.push(chickenEntity);
            }

            for (const object of layer.objects) {
                // Prisoner spawn logic
                if (object.name === "prisoner" && !entities.prisoner && gameState.getPrisonDoorOpened() && !gameState.getPrisonerFreed()) {
                    entities.prisoner = map.add(
                        generatePrisonerComponents(k, k.vec2(object.x, object.y))
                    );
                    continue;
                }
            // Prisoner follow logic in castle
            if (entities.prisoner && entities.player && gameState.getPrisonDoorOpened()) {
                // Immediately start following player in castle if freed
                entities.prisoner.unuse('body');
                k.wait(0.1, () => {
                    // Use a small delay to ensure entity is spawned
                    import("../utils.js").then(({ followPlayer }) => {
                        followPlayer(k, entities.player, entities.prisoner);
                    });
                });
            }

                if (object.name === "player-barn" && !entities.player && previousScene === "barn") {
                    entities.player = map.add(generatePlayerComponents(k, k.vec2(object.x, object.y)));
                    continue;
                }

                if (object.name === "player-barn-side" && !entities.player && previousScene === "barn-side") {
                    entities.player = map.add(generatePlayerComponents(k, k.vec2(object.x, object.y)));
                    continue;
                }

                if (object.name === "player-tavern" && !entities.player && previousScene === "tavern") {
                    entities.player = map.add(generatePlayerComponents(k, k.vec2(object.x, object.y)));
                    continue;
                }

                if (object.name === "player-forest" && !entities.player && previousScene === "forest") {
                    entities.player = map.add(generatePlayerComponents(k, k.vec2(object.x, object.y)));
                    continue;
                }

                if (object.name === "player-castle-main" && !entities.player && previousScene === "castle-main") {
                    entities.player = map.add(generatePlayerComponents(k, k.vec2(object.x, object.y)));
                    continue;
                }

                if (object.name === "player-forest-east" && !entities.player && previousScene === "forest-east") {
                    entities.player = map.add(generatePlayerComponents(k, k.vec2(object.x, object.y)));
                    continue;
                }

                if (object.name === "player" && !entities.player && previousScene !== "barn" && previousScene !== "barn-side" && previousScene !== "tavern" && previousScene !== "forest" && previousScene !== "castle-main" && previousScene !== "forest-east") {
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
        }

         // Only draw tile layers
        if (layer.type === 'tilelayer') {
            drawTiles(
                k,
                map,
                layer,
                mapData.tileheight,
                mapData.tilewidth,
                mapData.tilesets
            );
        }
    }

    for (let i = 0; i < entities.chicken.length; i++) {
        if (entities.chicken[i]) {
            setChickenAI(k, entities.chicken[i], i);
            onAttacked(k, entities.chicken[i], () => entities.player);
        }
    }

    entities.player.onCollide("barn-entrance", () => {
        k.play("door-open");
        k.go("barn");
    });

    entities.player.onCollide("barn-side-entrance", () => {
        k.play("door-open");
        k.go("barn");
    });

    entities.player.onCollide("castle-main-entrance", () => {
        k.go('castle-main');
    });

  
    entities.player.onCollide("tavern-entrance", () => {
        k.play("door-open");
        k.go("tavern");
    });

    entities.player.onCollide("forest-entrance", () => {
        k.go("forest");
    });

    entities.player.onCollide("forest-east-entrance", () => {
        k.go("forest-east");
    });

    entities.player.onCollide("chest", (chest) => {
        startChestInteraction(k, chest, entities.player);
    });

   // Set camera to follow player
    k.setCamScale(4);
    k.setCamPos(entities.player.worldPos());
    k.onUpdate(() => {
        if (entities.player.pos.dist(k.getCamPos()) > 6) {
            k.tween(
                k.getCamPos(),
                entities.player.worldPos(),
                0.15,
                (newPos) => {
                    k.setCamPos(newPos);
                },
                k.easings.linear
            );
        }
    });

    setPlayerMovement(k, entities.player);
    healthBar(k);

    // Reset chicken health array if it's empty

    // Add FPS counter as a UI object
    k.add([
        k.text(`FPS: ${(1 / k.dt()).toFixed(1)}`, {
            size: 16,
            font: 'gameboy',
        }),
        k.pos(12, 12),
        k.fixed(),
        { layer: 'ui' },
        {
            update() {
                this.text = `FPS: ${(1 / k.dt()).toFixed(1)}`;
            },
        },
    ]);


    console.log("Prisoner Freed:", gameState.getPrisonerFreed());
    // Trigger prisoner dialogue and disappearance at a specific point
    if (gameState.getPrisonerFreed() === false) {
        const triggerPos = k.vec2(436, 614);
        let hasTalked = false;
        let originalFreeze = gameState.getFreezePlayer();
        k.onUpdate(() => {
            if (previousScene !== "basement") return;
            if (!entities.prisoner.exists() || !entities.player.exists() || hasTalked) return;
            if (entities.player.pos.dist(triggerPos) < 32) { // Within 64 pixels of player and 32 pixels of prisoner
                hasTalked = true;
                (async () => {
                    const { dialog } = await import("../uiComponents/dialog.js");
                    const lines = [["Thank you! You saved my life. I'm forever in your debt."], ["I'll make sure you get rewarded for your help. I will see you later."]];
                    await dialog(k, k.vec2(250, 500), lines);
                    // Play smoke animation on top of prisoner and wait for it to finish
                    const prisonerPos = entities.prisoner.pos;
                    const smokeOffset = k.vec2(prisonerPos.x + entities.prisoner.width + 75, prisonerPos.y + entities.prisoner.height + 70);
                    const smoke = k.add([
                        k.sprite("smoke", { anim: "smoke" }),
                        k.pos(smokeOffset.x, smokeOffset.y),
                        k.z(100),
                    ]);
                    await new Promise(resolve => k.wait(0.2, resolve));
                    entities.prisoner.destroy();
                    await new Promise(resolve => k.wait(0.5, resolve));
                    smoke.destroy();
                    // Restore original freeze state
                    gameState.setFreezePlayer(originalFreeze);
                    gameState.setPrisonerFreed(true);
                })();
            }
        });
    }

    // After spawning the player:
    const lastPos = lastPlayerPosManager.get();
    if (lastPos) {
        entities.player.pos = lastPos;
        lastPlayerPosManager.clear();
        k.setCamPos(entities.player.worldPos()); // Instantly lock camera to player
    }

    // Register map key after player exists
    if (entities.player) {
        openWorldMap(k, () => {
            lastPlayerPosManager.set(entities.player.pos);
            gameState.setPreviousScene('castle');
            return lastPlayerPosManager.get();
        });
    }
}