import {
    colorizeBackground,
    fetchMapData,
    loadTilesets,
    drawTiles,
    playAnimIfNotPlaying,
    onAttacked,
    onCollideWithPlayer,
    drawBoundaries,
    registerMuteHandler,
    registerHealthPotionHandler,
    animatedTileSprites,
    lastPlayerPosManager,
    openWorldMap,
} from '../utils.js';
import {
    generatePlayerComponents,
    setPlayerMovement,
} from '../entities/player.js';
import { generateSlimeComponents, setSlimeAI } from '../entities/slime.js';
import { generateLumberjackComponents } from '../entities/lumberjack.js';
import {
    generateChestComponents,
    startChestInteraction,
} from '../entities/chest.js';
import { startInteraction } from '../entities/lumberjack.js';
import { healthBar } from '../uiComponents/healthbar.js';
import { gameState, slimeState } from '../state/stateManagers.js';
import { setupInventoryUI } from "../uiComponents/inventory.js";



export default async function world(k) {
    animatedTileSprites.length = 0; // Clear previous animated tiles
    
    registerMuteHandler(k);
    registerHealthPotionHandler(k);
    const previousScene = gameState.getPreviousScene();
    console.log(previousScene);

    colorizeBackground(k, 8, 148, 236);

    const mapData = await fetchMapData('./assets/maps/world.json');
    const tilesets = await loadTilesets(mapData.tilesets, "./assets/");

    const map = k.add([k.pos(0, 0)]);

    const entities = {
        player: null,
        slimes: [],
        chests: [],
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
                if (object.name === 'chest') {
                    // ...existing code...
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
                
                if (object.name === 'player-town-upper' && !entities.player && previousScene === 'town-upper') {
                    entities.player = map.add(generatePlayerComponents(k, k.vec2(object.x, object.y)));
                    continue;
                }
                if (object.name === 'player-town' && !entities.player && previousScene === 'town') {
                    entities.player = map.add(
                        generatePlayerComponents(k, k.vec2(object.x, object.y))
                    );
                    continue;
                }
                if (object.name === 'player-house' && !entities.player && previousScene === 'house') {
                    entities.player = map.add(generatePlayerComponents(k, k.vec2(object.x, object.y)));
                    continue;
                }
                if (object.name === 'player-shop' && !entities.player && previousScene === 'shop') {
                    entities.player = map.add(generatePlayerComponents(k, k.vec2(object.x, object.y)));
                    continue;
                }
                if (object.name === 'player-tower' && !entities.player && previousScene === 'tower') {
                    entities.player = map.add(generatePlayerComponents(k, k.vec2(object.x, object.y)));
                    continue;
                }
                // Fallback: generic player spawn if not coming from any special scene
                if (object.name === 'player' && !entities.player && !['town', 'town-upper', 'house', 'shop', 'tower'].includes(previousScene)) {
                    entities.player = map.add(
                        generatePlayerComponents(k, k.vec2(object.x, object.y))
                    );
                    continue;
                }
                if (object.name === 'slime') {
                    // Use Math.floor for both spawn and death
                    const slimeKey = `${Math.floor(object.x)},${Math.floor(object.y)}`;
                
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
                            startingSlimeIndices.push(startingSlimeCount);
                            startingSlimeCount++;
                        }
                        entities.slimes.push(slime);
                    }
                    continue;
                }
                if (object.name === 'lumberjack') {
                    entities.lumberjack = map.add(
                        generateLumberjackComponents(
                            k,
                            k.vec2(object.x, object.y)
                        )
                    );
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
                tilesets
            );
        }
    }

    // Remove previous event handlers before adding new ones to avoid stacking
    entities.player.onCollide('door-entrance', null);
    entities.player.onCollide('shop-entrance', null);
    entities.player.onCollide('tower-entrance', null);
    entities.player.onCollide('chest', null);
    entities.player.onCollide('lumberjack', null);
    entities.player.onCollideEnd('lumberjack', null);

    entities.player.onCollide('door-entrance', () => {
        k.play('door-open');
        k.go('house');
    });
    entities.player.onCollide('shop-entrance', () => {
        k.play('door-open');
        k.go('shop');
    });
    entities.player.onCollide('tower-entrance', () => {
        k.play('door-open');
        k.go('tower');
    });
    entities.player.onCollide('town-entrance', () => {
        gameState.setPreviousScene('world');
        k.go('town');
    });
    entities.player.onCollide('town-upper-entrance', () => {
        gameState.setPreviousScene('world-upper');
        k.go('town');
    });
    entities.player.onCollide('chest', (chest) => {
        startChestInteraction(k, chest, entities.player);
    });
    entities.player.onCollide('lumberjack', () => {
        startInteraction(k, entities.lumberjack, entities.player);
    });

    entities.player.onCollideEnd('lumberjack', async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        playAnimIfNotPlaying(entities.lumberjack, 'lumberjack-idle-down');
    });

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

    setPlayerMovement(k, entities.player);

    healthBar(k);

    // FPS counter: update every 0.25s instead of every frame
    // let fpsText = k.add([
    //     k.text(`FPS: 0`, {
    //         size: 16,
    //         font: 'gameboy',
    //     }),
    //     k.pos(12, 12),
    //     k.fixed(),
    //     { layer: 'ui' },
    // ]);
    // let fpsTimer = 0;
    // let fpsSum = 0;
    // let fpsCount = 0;
    // k.onUpdate(() => {
    //     fpsTimer += k.dt();
    //     fpsSum += 1 / k.dt();
    //     fpsCount++;
    //     if (fpsTimer > 0.25) {
    //         const avgFps = Math.round(fpsSum / fpsCount);
    //         fpsText.text = `FPS: ${avgFps}`;
    //         fpsTimer = 0;
    //         fpsSum = 0;
    //         fpsCount = 0;
    //     }
    // });

    // Camera: only tween if player moved > 2px from cam
    k.onUpdate(() => {
        const camPos = k.getCamPos();
        const playerPos = entities.player.worldPos();
        if (entities.player.pos.dist(camPos) > 2) {
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
    });

    setupInventoryUI(k, (itemKey) => {});


    // --- Big Tree Animation State ---
    let bigTreeAnimFrame = 0;
    const bigTreeAnimFrameCount = 4;
    const bigTreeAnimFrameDelay = 7; // Adjust for speed
    let bigTreeAnimFrameTimer = 0;

    // Find big-tree objects in the map
    let bigTreePositions = [];
    for (const layer of layers) {
        if (layer.type === "objectgroup") {
            for (const object of layer.objects) {
                if (object.name === "big-tree" || object.type === "big-tree") {
                    bigTreePositions.push({ x: object.x, y: object.y });
                }
            }
        }
    }

    // Add big-tree sprites to the map
    const bigTreeSprites = bigTreePositions.map(pos =>
        map.add([
            k.sprite("big-tree", { frame: 0 }),
            k.pos(pos.x, pos.y),
            "animated-big-tree"
        ])
    );

    // --- Animate big trees in the update loop ---
    k.onUpdate(() => {
        bigTreeAnimFrameTimer++;
        if (bigTreeAnimFrameTimer >= bigTreeAnimFrameDelay) {
            bigTreeAnimFrame = (bigTreeAnimFrame + 1) % bigTreeAnimFrameCount;
            bigTreeAnimFrameTimer = 0;
            bigTreeSprites.forEach(tree => {
                tree.frame = bigTreeAnimFrame;
            });
        }
    });

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

    // --- Synchronized animated tiles ---
    // Group animated tiles by their animation signature (frames/durations)
    const tileW = mapData.tilewidth;
    const tileH = mapData.tileheight;
    // Map: key = JSON.stringify({frames, durations}), value = { time, index }
    const animGroups = new Map();
    function getAnimKey(sprite) {
        // Use frames and durations as the key
        return JSON.stringify({
            frames: sprite.animFrames,
            durations: sprite.animDurations
        });
    }
    k.onUpdate(() => {
        const cam = k.getCamPos();
        const scaleObj = (typeof k.getCamScale === "function" && k.getCamScale()) || { x: 1, y: 1 };
        const scale = scaleObj.x || 1;
        const screenW = k.width() / scale;
        const screenH = k.height() / scale;
        const left = cam.x - screenW / 2;
        const right = cam.x + screenW / 2;
        const top = cam.y - screenH / 2;
        const bottom = cam.y + screenH / 2;
        // 1. Update all animation groups
        for (const sprite of animatedTileSprites) {
            const key = getAnimKey(sprite);
            if (!animGroups.has(key)) {
                animGroups.set(key, {
                    time: 0,
                    index: 0
                });
            }
        }
        for (const [key, group] of animGroups.entries()) {
            // Find a representative sprite for this group
            const sprite = animatedTileSprites.find(s => getAnimKey(s) === key);
            if (!sprite) continue;
            group.time += k.dt() * 1000;
            // Use the durations array for this animation
            let duration = sprite.animDurations[group.index];
            while (group.time >= duration) {
                group.time -= duration;
                group.index = (group.index + 1) % sprite.animFrames.length;
                duration = sprite.animDurations[group.index];
            }
        }
        // 2. Animate only visible tiles, using the group index
        for (const sprite of animatedTileSprites) {
            const x = sprite.pos.x;
            const y = sprite.pos.y;
            const objLeft = x;
            const objRight = x + tileW;
            const objTop = y;
            const objBottom = y + tileH;
            const isVisible = objLeft < right && objRight > left && objTop < bottom && objBottom > top;
            if (isVisible) {
                const key = getAnimKey(sprite);
                const group = animGroups.get(key);
                if (group) {
                    sprite.frame = sprite.animFrames[group.index];
                    // Uncomment for debug:
                    // console.log("Animated tile at", sprite.pos.x, sprite.pos.y, "frame", group.index);
                }
            }
        }
    });

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
            gameState.setPreviousScene('world');
            return lastPlayerPosManager.get();
        });
    }
}
