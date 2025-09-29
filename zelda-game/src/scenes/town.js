import {
    colorizeBackground,
    fetchMapData,
    drawTiles,
    playAnimIfNotPlaying,
    onAttacked,
    onCollideWithPlayer,
    drawBoundaries,
    registerMuteHandler,
    registerHealthPotionHandler,
    lastPlayerPosManager,
    openWorldMap,
} from '../utils.js';
import {
    generatePlayerComponents,
    setPlayerMovement,
} from '../entities/player.js';
import { generateSlimeComponents, setSlimeAI } from '../entities/slime.js';
import { generateFrogComponents, startInteraction } from '../entities/frog.js';
import { generateCowComponents, enableCowFollowOnPlayerCollision, startInteraction as startCowInteraction } from '../entities/cow.js';
import { generateHatguyComponents, startInteraction as startHatguyInteraction } from '../entities/hatguy.js';
import {
    generateChestComponents,
    startChestInteraction,
} from '../entities/chest.js';
import { healthBar } from '../uiComponents/healthbar.js';
import { gameState, slimeState, cowState, playerState } from '../state/stateManagers.js';
import { setupInventoryUI } from "../uiComponents/inventory.js";



export default async function world(k) {

    registerMuteHandler(k);
    registerHealthPotionHandler(k);
    const previousScene = gameState.getPreviousScene();

    colorizeBackground(k, 8, 148, 236);

    const mapData = await fetchMapData('./assets/maps/town.json');

    const map = k.add([k.pos(0, 0)]);

    const entities = {
        player: null,
        slimes: [],
        chests: [],
        cow: null, 
        frog: null,
        hatguy: null,
        fenceDoor: null,
    };
    // Track dead slimes by position (rounded for consistency)
    const deadSlimes = gameState.getDeadSlimes ? gameState.getDeadSlimes() : [];

    // --- Slime tracking for lumberjack interaction ---
    // Only track the first two slimes at the start of the world
    let startingSlimeCount = 0;
    const startingSlimeIndices = [];

    // Only reset slime health if not initialized (once per scene load)
        // Only reset slime health if not initialized and health array is empty
        if (!slimeState.isInitialized() && (!slimeState.getSlimeHealth() || slimeState.getSlimeHealth().length === 0)) {
            slimeState.resetSlimeHealth(2); // 2 starting slimes
        }

    const layers = mapData.layers;

    // Now handle object layers and entity spawning
    for (const layer of layers) {
        if (layer.name === 'Boundaries') {
            drawBoundaries(k, map, layer);
            continue;
        }


        if (layer.name === 'SpawnPoints') {
            for (const object of layer.objects) {
                if (object.name === 'player' && !entities.player && previousScene !== 'village' && previousScene !== 'world-upper') {
                    entities.player = map.add(generatePlayerComponents(k, k.vec2(object.x, object.y)));
                    continue;
                }
                if (object.name === 'player-town-upper' && !entities.player && previousScene === 'world-upper') {
                    entities.player = map.add(generatePlayerComponents(k, k.vec2(object.x, object.y)));
                    continue;
                }
                if (object.name === 'player-village' && !entities.player && previousScene === 'village') {
                    entities.player = map.add(generatePlayerComponents(k, k.vec2(object.x, object.y)));
                    continue;
                }
                if (object.name === 'frog') {
                    entities.frog = map.add(
                        generateFrogComponents(k, k.vec2(object.x, object.y))
                    );
                    continue;
                }
                if (object.name === 'cow' && !entities.cow) {
                    entities.cow = map.add(
                        generateCowComponents(k, k.vec2(object.x, object.y))
                    );
                    continue;
                }
                if (object.name === 'hatguy') {
                    entities.hatguy = map.add(
                        generateHatguyComponents(k, k.vec2(object.x, object.y))
                    );
                    continue;
                }
                if (object.name === 'fence-door') {
                    const isDoorOpened = gameState.getIsFenceDoorOpened();
                    const doorAnim = isDoorOpened ? "fence-door-opened" : "fence-door-closed";
                    const fenceDoor = map.add([
                        k.sprite("fence-door", { anim: doorAnim }),
                        k.pos(object.x, object.y),
                        k.area(),
                        k.body({ isStatic: true }),
                        k.offscreen(),
                        "fence-door",
                    ]);
                    entities.fenceDoor = fenceDoor;
                    continue;
                }

                if (object.name === 'slime') {
                    // Use Math.floor for both spawn and death
                    const slimeKey = `${Math.floor(object.x)},${Math.floor(object.y)}`;
                    if (window && window.console) {
                        console.log('Spawning slime at', slimeKey, 'deadSlimes:', deadSlimes);
                    }
                    if (!deadSlimes.includes(slimeKey)) {
                        const slime = map.add(
                            generateSlimeComponents(
                                k,
                                k.vec2(object.x, object.y)
                            )
                        );
                        slime._spawnKey = slimeKey;
                        // Assign index to first two slimes for tracking
                        if (startingSlimeCount < 2) {
                            slime._slimeIndex = startingSlimeCount;
                            if (window && window.console) {
                                console.log('Assigned _slimeIndex', startingSlimeCount, 'to slime at', slimeKey);
                            }
                            startingSlimeIndices.push(startingSlimeCount);
                            startingSlimeCount++;
                        }
                        entities.slimes.push(slime);
                    }
                    continue;
                }

            
            }
            continue;
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

    // Set up player collision handlers only after player is created
    if (entities.player) {
        entities.player.onCollide("town-exit", () => {
            gameState.setPreviousScene("town");
            k.go("world");
        });

        entities.player.onCollide("town-upper-exit", () => {
            gameState.setPreviousScene("town-upper");
            k.go("world");
        });

        entities.player.onCollide("village-entrance", () => {
            gameState.setPreviousScene("town");
            k.go("village");
        });

        entities.player.onCollide("frog", () => {
            startInteraction(k, entities.frog, entities.player);
        });

        entities.player.onCollide('cow', () => {
            if (cowState.getCowQuestComplete() === false && playerState.getHasCarrot() === true) {
                enableCowFollowOnPlayerCollision(k, entities.cow, entities.player);
            }
            else if (cowState.getCowQuestComplete() === true || playerState.getHasCarrot() === false) {
                startCowInteraction(k, entities.cow, entities.player);
            }
        });

        entities.player.onCollide('hatguy', () => {
            startHatguyInteraction(k, entities.hatguy, entities.player);
        });

        // Fence-door collision
        if (entities.fenceDoor) {
            entities.player.onCollide("fence-door", () => {
                if (!gameState.getIsFenceDoorOpened()) {
                    gameState.setIsFenceDoorOpened(true);
                    entities.fenceDoor.play("fence-door-opened");
                    k.play("door-open");
                    entities.fenceDoor.unuse('body'); // Disable collision to allow passage
                    // Close the door again after 2 seconds
                    k.wait(0.5, () => {
                        entities.fenceDoor.play("fence-door-closed");
                        entities.fenceDoor.use('body'); // Re-enable collision
                        gameState.setIsFenceDoorOpened(false);
                    });
                }
            });
        }
    }

    for (const slime of entities.slimes) {
        setSlimeAI(k, slime);
        onAttacked(k, slime, () => entities.player);
        onCollideWithPlayer(k, slime, entities.player);
        // Listen for slime death and persist dead state
        if (slime.onDeath) {
            slime.onDeath(() => {
                const pos = slime.pos;
                const key = `${Math.floor(pos.x)},${Math.floor(pos.y)}`;
                if (gameState.addDeadSlime) {
                    gameState.addDeadSlime(key);
                }
            });
        }
    }
    k.setCamScale(5);
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

         // --- Falling Leaves State ---
    const leaves = [];
    const maxLeaves = 10;

    let leafSpawnTimer = 0;
    let nextLeafSpawn = 0.2 + Math.random() * 1.0;

    function spawnLeaf() {
        const cam = k.getCamPos();
        const scaleObj = (typeof k.getCamScale === "function" && k.getCamScale()) || { x: 1, y: 1 };
        const scale = scaleObj.x || 1;
        const screenW = k.width() / scale;
        const screenH = k.height() / scale;

        // Spawn in the center 60% of the screen width (wider area)
        const x = cam.x - screenW * 0.3 + Math.random() * (screenW * 2);
        const y = cam.y - screenH / 2 - 16;

        const speedY = 200 + Math.random() * 100;
        const drift = (Math.random() - 0.5) * 30;
        const swayAmplitude = 8 + Math.random() * 16;
        const swaySpeed = 1 + Math.random() * 1.5;
        const scaleLeaf = 0.5 + Math.random() * 0.8;

        // 50% chance to flip horizontally
        const flipX = Math.random() < 0.5;

        const scaleComp = flipX
            ? k.scale(-scaleLeaf, scaleLeaf)
            : k.scale(scaleLeaf, scaleLeaf);

        const leaf = map.add([
            k.sprite("leaf"),
            k.pos(x, y),
            scaleComp,
            { 
                speedY, 
                drift, 
                swayAmplitude, 
                swaySpeed, 
                swayTime: Math.random() * Math.PI * 2,
                baseX: x 
            },
            { z: 100 }
        ]);
        leaves.push(leaf);
    }

    // In your leaves update loop:
    k.onUpdate(() => {
        leafSpawnTimer += k.dt();
        if (leaves.length < maxLeaves && leafSpawnTimer > nextLeafSpawn) {
            spawnLeaf();
            leafSpawnTimer = 0;
            nextLeafSpawn = 0.2 + Math.random() * 1.0; // new random interval
        }
        const cam = k.getCamPos();
        const scaleObj = (typeof k.getCamScale === "function" && k.getCamScale()) || { x: 1, y: 1 };
        const scale = scaleObj.x || 1;
        const screenH = k.height() / scale;
        for (let i = leaves.length - 1; i >= 0; i--) {
            const leaf = leaves[i];
            leaf.move(leaf.drift * k.dt(), leaf.speedY * k.dt());
            // Sway using sine wave
            leaf.swayTime += leaf.swaySpeed * k.dt();
            leaf.pos.x = leaf.baseX + Math.sin(leaf.swayTime) * leaf.swayAmplitude;
            if (leaf.pos.y > cam.y + screenH / 2 + 8) {
                leaf.destroy();
                leaves.splice(i, 1);
            }
        }
    });

    setupInventoryUI(k); // Initialize inventory UI

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
            gameState.setPreviousScene('town');
            return lastPlayerPosManager.get();
        });
    }
}
