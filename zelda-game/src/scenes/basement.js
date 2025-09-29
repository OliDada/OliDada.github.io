import {
    colorizeBackground,
    drawBoundaries,
    drawTiles,
    fetchMapData,
    registerMuteHandler,
    openWorldMap,
    registerHealthPotionHandler,
    slideCamY,
    onAttacked,
    onCollideWithPlayer,
    animatedTileSprites,
    loadTilesets
} from '../utils.js';
import {
    generatePlayerComponents,
    setPlayerMovement,
    
} from '../entities/player.js';
import { generatePrisonerComponents } from '../entities/prisoner.js';
import { healthBar } from '../uiComponents/healthbar.js';
import {
    prisonerState,
    playerState,
} from '../state/stateManagers.js';
import { startInteraction } from '../entities/prisoner.js';
import { generateChestComponents, startChestInteraction } from '../entities/chest.js';
import { generatePrisonDoorComponents, openPrisonDoor } from '../entities/prisonDoor.js';
import { generateShiftingWallComponents } from '../entities/shiftingWalls.js';
import { generateSecretPassageComponents } from "../entities/secretPassage.js";
import { generateTransitionComponents } from "../entities/transition.js";
import { generatePressurePlateComponents } from '../entities/pressurePlate.js';
import { dialog } from '../uiComponents/dialog.js';
import { generateDungeonDoorComponents } from "../entities/dungeonDoor.js";
import globalStateManager from "../state/globalState.js";
import { generateGhostComponents, onGhostDestroyed, setGhostAI } from '../entities/ghost.js';
import { addBossHealthBar } from "../uiComponents/bossHealth.js";
import { setupInventoryUI } from "../uiComponents/inventory.js";

const gameState = globalStateManager().getInstance();


export default async function basement(k) {
    // Debug: print total frames for 'Everything' sprite
    const everythingSprite = k.assets && k.assets.sprites && k.assets.sprites["Everything"];
    if (everythingSprite && everythingSprite.frames) {
        console.log("[DEBUG] Everything sprite total frames:", everythingSprite.frames.length);
    }
    animatedTileSprites.length = 0; // Clear previous animated tiles

    const currentSong = gameState.getCurrentSong();
    if (!currentSong || !currentSong.name || currentSong.name !== "basement-soundtrack") {
        gameState.pauseCurrentSong();
        const newSong = k.play("basement-soundtrack", { loop: true });
        newSong.name = "basement-soundtrack"; // Attach a name property for tracking
        gameState.setCurrentSong(newSong);
    }

    registerHealthPotionHandler(k);
    registerMuteHandler(k);
    const previousScene = gameState.getPreviousScene();

    colorizeBackground(k, 27, 29, 52);

    const mapData = await fetchMapData('./assets/maps/basement.json');
    const tilesets = await loadTilesets(mapData.tilesets, "./assets/"); // Use loader for consistency
    const map = k.add([k.pos(-385, -690)]);

    const entities = {
        player: null,
        chests: [],
        prisonDoor: null,
        secretPassage: null,
        pressurePlates: [],
        prisoner: null,
        dungeonDoor: null,
        shiftingWalls: null,
        ghost: null,
        pullables: [],
        spikes: [], // Add spikes array
        spikeBoundaries: [], // Add spike boundaries array
    };

    for (const layer of mapData.layers) {
        if (layer.type === 'tilelayer') {
            const zIndex = (layer.name === 'Prison-Top' || layer.name === 'Wall-Top') ? 10 : undefined;
            drawTiles(
                k,
                map,
                layer,
                mapData.tileheight,
                mapData.tilewidth,
                tilesets,
                zIndex
            );
        }
        if (layer.name === 'Boundaries') {
            drawBoundaries(k, map, layer);
        }
        // Add support for spike boundaries from Tiled
        if (layer.name === 'SpikeBoundaries') {
            for (const object of layer.objects) {
                // Expect spikeId property to match spike id/type
                let spikeId = null;
                if (object.spikeId) {
                    spikeId = object.spikeId;
                } else if (object.properties) {
                    const idProp = object.properties.find(p => p.name === 'spikeId');
                    if (idProp) spikeId = idProp.value;
                }
                if (!spikeId) continue;
                // Create a solid collider for the boundary
                const boundary = map.add([
                    k.rect(object.width, object.height),
                    k.pos(object.x, object.y),
                    k.area(),
                    k.body({ isStatic: true }),
                    k.opacity(0),
                    'spike-boundary',
                    { spikeId }
                ]);
                boundary.spikeId = spikeId;
                entities.spikeBoundaries.push(boundary);
            }
        }
        if (layer.name === 'SpawnPointsChest') {
            for (const object of layer.objects) {
                if (object.name === 'chest') {
                    const contents =
                        object.contents ||
                        object.properties?.find((p) => p.name === 'contents')?.value ||
                        'health-potion';
                    const key = `${Math.round(object.x)},${Math.round(object.y)}`;
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
        if (layer.name === 'SpawnPoints') {
            for (const object of layer.objects) {
                if (!object || typeof object.x !== 'number' || typeof object.y !== 'number') continue;
                if (object.name === 'player') {
                    entities.player = map.add([
                        ...generatePlayerComponents(k, k.vec2(object.x, object.y)),
                        k.z(5)
                    ]);
                    continue;
                }
                if (object.name === 'prisoner') {
                    entities.prisoner = map.add([
                        ...generatePrisonerComponents(k, k.vec2(object.x, object.y)),
                        k.z(5)
                    ]);
                    continue;
                }
                if (object.name === 'prison-door') {
                    entities.prisonDoor = map.add(
                        generatePrisonDoorComponents(k, k.vec2(object.x, object.y))
                    );
                    continue;
                }
                if (object.name === "secret-passage") {
                    // Add secret passage ONLY to map container for visibility
                    // Start with isFreed = false, so not pullable
                    const secretPassage = generateSecretPassageComponents(k, k.vec2(object.x, object.y), false);
                    entities.secretPassage = map.add(secretPassage);
                    // Remove 'pullable' tag if present (should not be pullable until freed)
                    secretPassage.unuse && secretPassage.unuse('pullable');
                    continue;
                }
                if (object.name === 'transition') {
                    map.add(generateTransitionComponents(k, k.vec2(object.x, object.y)));
                    continue;
                }
                if (object.name === 'pressure-plate') {
                    const plate = map.add(generatePressurePlateComponents(k, k.vec2(object.x, object.y)));
                    // Parse controls property: if string, convert to array
                    let controls = [];
                    if (object.controls) {
                        if (Array.isArray(object.controls)) {
                            controls = object.controls;
                        } else if (typeof object.controls === 'string') {
                            // Split comma/space separated string, trim whitespace
                            controls = object.controls.split(/[, ]+/).map(s => s.trim()).filter(Boolean);
                        }
                    } else if (object.properties) {
                        const controlsProp = object.properties.find(p => p.name === 'controls');
                        if (controlsProp) {
                            if (Array.isArray(controlsProp.value)) {
                                controls = controlsProp.value;
                            } else if (typeof controlsProp.value === 'string') {
                                controls = controlsProp.value.split(/[, ]+/).map(s => s.trim()).filter(Boolean);
                            }
                        }
                    }
                    plate.controls = controls;
                    entities.pressurePlates.push(plate);
                    continue;
                }
                if (object.name === 'spikes') {
                    // Force spike to use frame 10660 for spikes-up
                    const spikeSprite = k.sprite('Everything', { frame: 10660 });
                    // Assign id from object.id, object.name, or object.properties (for Tiled custom type)
                    let spikeId = object.id || object.name;
                    if (object.properties) {
                        const typeProp = object.properties.find(p => p.name === 'type');
                        if (typeProp && typeProp.value) {
                            spikeId = typeProp.value;
                        }
                    }
                    console.log('[DEBUG] Creating spike:', {
                        animation: 'spikes-up',
                        frame: 10660,
                        sprite: spikeSprite,
                        pos: { x: object.x, y: object.y },
                        id: spikeId
                    });
                    const spike = map.add([
                        spikeSprite,
                        k.pos(object.x, object.y),
                        k.z(0), // Ensure spikes are below player above ground but above floor
                        'spikes',
                        { id: spikeId }
                    ]);
                    spike.id = spikeId; // Ensure id is set directly for lookup
                    entities.spikes.push(spike);
                    continue;
                }
                if (object.name === "dungeon-door") {
                    entities.dungeonDoor = map.add(
                        generateDungeonDoorComponents(k, k.vec2(object.x, object.y))
                    );
                    continue;
                }
                if (object.name === "shifting-walls") {
                    entities.shiftingWalls = map.add(
                        generateShiftingWallComponents(k, k.vec2(object.x, object.y))
                    );
                    continue;
                }
                if (object.name === "ghost") {
                    entities.ghost = map.add(
                        generateGhostComponents(k, k.vec2(object.x, object.y))
                    );
                    continue;
                }
                if (object.name === "player-dungeon") {
                    entities.player.onCollide("dungeon", () => {
                        entities.player.pos.x = object.x;
                        entities.player.pos.y = object.y;
                    });
                }
                if (object.name === "player-dungeon-2") {
                    entities.player.onCollide("dungeon-2", () => {
                        entities.player.pos.x = object.x;
                        entities.player.pos.y = object.y;
                         // Show boss health bar for ghost after door is opened
                        if (entities.ghost && !ghostHealthBar) {
                            ghostHealthBar = addBossHealthBar(k, entities.ghost);
                        }
                    });
                }
            }
        }
    }

    // Only spawn pullable after player collides with dungeon
    let pullableSpawned = false;
    let playerSpawn = null;
    for (const layer of mapData.layers) {
        if (layer.name === 'SpawnPoints') {
            for (const object of layer.objects) {
                if (object.name === 'player') {
                    playerSpawn = { x: object.x, y: object.y };
                    break;
                }
            }
        }
        if (playerSpawn) break;
    }

    if (entities.player) {
        entities.player.onCollide("dungeon", () => {
            if (pullableSpawned) return;
            pullableSpawned = true;
            const spriteName = 'Everything';
            const frameId = 10665;
            const playerWorldPos = entities.player.worldPos();
            const offsets = [
                { x: 48, y: -32 },
                { x: -16, y: -48 },
                { x: -72, y: -48 }
            ];

            offsets.forEach(offset => {
                const pullable = k.add([
                    k.sprite(spriteName, { frame: frameId }),
                    k.area({ shape: new k.Rect(k.vec2(0, 4), 16, 16) }),
                    k.pos(playerWorldPos.x + offset.x, playerWorldPos.y + offset.y),
                    k.body({ isStatic: false }),
                    { areaWidth: 16, areaHeight: 16 },
                    'pullable',
                    'solid',
                ]);
                entities.pullables.push(pullable);
                // Add pressure plate collision handler for pullable
                pullable.onCollide("pressure-plate", (plate) => {
                    if (plate._colliderCount === undefined) plate._colliderCount = 0;
                    plate._colliderCount++;
                    if (!plate.isDown) {
                        plate.isDown = true;
                        plate.play("pressure-plate-down");
                        setSpikesState(plate, true);
                    }
                });
                pullable.onCollideEnd("pressure-plate", (plate) => {
                    if (plate._colliderCount === undefined) plate._colliderCount = 0;
                    plate._colliderCount = Math.max(0, plate._colliderCount - 1);
                    if (plate._colliderCount === 0 && plate.isDown) {
                        plate.isDown = false;
                        plate.play("pressure-plate-up");
                        setSpikesState(plate, false);
                    }
                });
                console.log('[DEBUG] Added pullable object:', {
                    pos: pullable.pos,
                    sprite: spriteName,
                    frame: frameId
                });
            });
            // Debug: print all pullable objects after scene setup
            const pullables = k.get("pullable");
            console.log("[DEBUG] Pullables in basement:", pullables.map(obj => ({
                name: obj.name || obj.tags || obj._tags,
                pos: obj.pos,
                areaWidth: obj.areaWidth,
                areaHeight: obj.areaHeight,
                isStatic: obj.isStatic,
                body: obj.body,
                tags: obj.tags || obj._tags
            })));
        });
    }

    // Helper to check if all plates are down
    function areTwoPlatesDown() {
        return entities.pressurePlates.length > 0 && entities.pressurePlates.filter(p => p.isDown).length === 2;
    }

    // Pressure plate collision logic
    function setSpikesState(plate, down) {
        if (!plate.controls || plate.controls.length === 0) {
            console.log('[DEBUG] setSpikesState: plate.controls is empty', plate.controls);
            return;
        }
        console.log('[DEBUG] setSpikesState: plate.controls', plate.controls, 'entities.spikes ids:', entities.spikes.map(s => s.id));
        plate.controls.forEach(spikeId => {
            const matchingSpikes = entities.spikes.filter(s => s.id === spikeId);
            if (matchingSpikes.length === 0) {
                console.log('[DEBUG] setSpikesState: spike not found for id', spikeId);
            } else {
                matchingSpikes.forEach(spike => {
                    console.log('[DEBUG] setSpikesState: found spike for id', spikeId, 'setting frame', down ? 10661 : 10660);
                    const frame = down ? 10661 : 10660;
                    // Only update the frame if sprite is an object
                    if (spike.sprite && typeof spike.sprite === 'object') {
                        spike.sprite.frame = frame;
                    } else if (spike.use && typeof spike.use === 'function') {
                        // Fallback: update frame via use if sprite is missing or not an object
                        spike.use(k.sprite('Everything', { frame }));
                    }
                });
            }
            // Toggle spike boundary collider (destroy only, do not re-add repeatedly)
            const matchingBoundaries = entities.spikeBoundaries.filter(b => b.spikeId === spikeId);
            matchingBoundaries.forEach(boundary => {
                if (down && boundary.exists()) {
                    boundary.destroy();
                }
                // Do not re-add boundary here; boundaries are only created once at scene setup
            });
        });
    }

    entities.player.onCollide("pressure-plate", (plate) => {
        if (plate._colliderCount === undefined) plate._colliderCount = 0;
        plate._colliderCount++
        console.log('[DEBUG] Player collided with pressure plate:', {
            controls: plate.controls,
            isDown: plate.isDown,
            colliderCount: plate._colliderCount
        });
        if (!plate.isDown) {
            plate.isDown = true;
            plate.play("pressure-plate-down");
            setSpikesState(plate, true);
            if (areTwoPlatesDown()) {
                openDungeonDoor();
            }
        }
    });

    

    if (entities.secretPassage) {
        entities.secretPassage.onCollide("pressure-plate", (plate) => {
            if (plate._colliderCount === undefined) plate._colliderCount = 0;
            plate._colliderCount++;
            if (!plate.isDown) {
                plate.isDown = true;
                plate.play("pressure-plate-down");
                if (areTwoPlatesDown()) {
                    openDungeonDoor();
                }
            }
        });
    }

    // Chest interaction
    entities.player.onCollide("chest", (chest) => {
        startChestInteraction(k, chest, entities.player);
    });

    // Prisoner interaction
    if (entities.prisoner) {
        entities.player.onCollide('prisoner', () => {
            if (!entities.prisoner.isFollowing) {
                startInteraction(k, entities.prisoner, entities.player);
            }
        });
    }

    // Prison door logic
    entities.player.onCollide('prison-door', () => {
        if (playerState.getHasPrisonKey() && entities.prisonDoor && !entities.prisonDoor.isOpen) {
            entities.prisonDoor.isOpen = true;
            k.play('door-open');
            entities.prisonDoor.play('prison-door-opened');
            entities.prisonDoor.unuse('body');
            openPrisonDoor(entities.prisonDoor);
            entities.prisoner.unuse('area');
            entities.prisoner.use(
                k.area({ shape: new k.Rect(k.vec2(2, 6), 15, 12) })
            );
            // Remove prison key from player inventory
            playerState.setHasPrisonKey(false);
            // Remove prison key from keys array if present
            if (playerState.getKeys && playerState.setKeys) {
                const keys = playerState.getKeys();
                const idx = keys.indexOf('prison-key');
                if (idx !== -1) {
                    keys.splice(idx, 1);
                    playerState.setKeys(keys);
                }
            }
            // Force health bar UI to refresh
            const oldBar = k.get('heartsContainer');
            oldBar.forEach(bar => bar.destroy());
            healthBar(k);
            // Remove prison key from keys array if present
            if (playerState.getKeys && playerState.setKeys) {
                const keys = playerState.getKeys();
                const idx = keys.indexOf('prison-key');
                if (idx !== -1) {
                    keys.splice(idx, 1);
                    playerState.setKeys(keys);
                }
            }
            // Make secret passage pullable and pushable now
            if (entities.secretPassage) {
                entities.secretPassage.unuse('body');
                entities.secretPassage.use(k.body({ isStatic: false }));
                entities.secretPassage.use('pullable');
                entities.secretPassage.isFreed = true;
                // Workaround: add a dummy proxy object to root scene for tag queries
                k.add([
                    {
                        get pos() { return entities.secretPassage.pos; },
                        get areaWidth() { return entities.secretPassage.areaWidth; },
                        get areaHeight() { return entities.secretPassage.areaHeight; },
                        get isStatic() { return entities.secretPassage.isStatic; },
                        get body() { return entities.secretPassage.body; },
                        get name() { return "secret-passage"; },
                        get isFreed() { return entities.secretPassage.isFreed; },
                        move: (...args) => entities.secretPassage.move && entities.secretPassage.move(...args),
                    },
                    "pullable",
                    "secret-passage"
                ]);
            }
        }
    });

    // Transition logic
    let hasTransitioned = false;
    entities.player.onCollide('transition', async () => {
        if (hasTransitioned) return;
        gameState.setFreezePlayer(true);

        // Animate the player walking up
        const startY = entities.player.pos.y;
        const endY = startY - 100;
        const duration = 1;

        entities.player.play("player-up");

        await k.tween(
            startY,
            endY,
            duration,
            (newY) => {
                entities.player.pos.y = newY;
            },
            k.easings.linear
        );

        entities.player.play("player-idle-up");

        // Smoothly move the camera to the player's new position
        await k.tween(
            k.getCamPos(),
            entities.player.worldPos(),
            0.5,
            (newPos) => {
                k.setCamPos(newPos);
            },
            k.easings.easeInOutSine
        );

        await k.wait(0.3);

        hasTransitioned = true;
        gameState.setFreezePlayer(false);
    });

    // Exit logic
    entities.player.onCollide('basement-exit', () => {
        if (entities.prisoner && entities.prisoner.isFollowing) {
            dialog(k, k.vec2(250, 500), [
                "Wait! It's too dangerous.",
                "That old woman is very powerful.",
                "Do you see that cracked wall next to the chest?",
                "We might be able to break through."
            ]);
        } else {
            gameState.setPreviousScene('basement');
            k.go('shop');
        }
    });

    entities.player.onCollide('castle', () => {
        gameState.setPreviousScene('basement');
        k.go('castle');
    })

    
 
    k.setCamScale(4);

    // Camera follow after transition
    k.onUpdate(() => {
        if (hasTransitioned) {
            const camPos = k.getCamPos();
            const playerPos = entities.player.worldPos();
            const newPos = camPos.lerp(playerPos, 0.1);
            k.setCamPos(newPos);
        }
    });

    setPlayerMovement(k, entities.player);
    healthBar(k);
    setupInventoryUI(k); // Initialize inventory UI

    

    // Player leaves pressure plate
    entities.player.onCollideEnd("pressure-plate", (plate) => {
        if (plate._colliderCount === undefined) plate._colliderCount = 0;
        plate._colliderCount = Math.max(0, plate._colliderCount - 1);
        if (plate._colliderCount === 0 && plate.isDown) {
            plate.isDown = false;
            plate.play("pressure-plate-up");
            setSpikesState(plate, false);
        }
    });

    // Secret passage leaves pressure plate
    if (entities.secretPassage) {
        entities.secretPassage.onCollideEnd("pressure-plate", (plate) => {
            if (plate._colliderCount === undefined) plate._colliderCount = 0;
            plate._colliderCount = Math.max(0, plate._colliderCount - 1);
            if (plate._colliderCount === 0 && plate.isDown) {
                plate.isDown = false;
                plate.play("pressure-plate-up");
            }
        });
    }

    async function openDungeonDoor() {
        if (!entities.dungeonDoor) return;
        // Play each frame with a delay for animation
        await entities.dungeonDoor.play("dungeon-door-2");
        await k.wait(0.5);
        await entities.dungeonDoor.play("dungeon-door-3");
        await k.wait(0.5);
        await entities.dungeonDoor.play("dungeon-door-4");
        // Remove collider so player can walk through
        entities.dungeonDoor.unuse("body");

       
    }

    async function shiftWalls() {
        if (!entities.shiftingWalls) return;
        await entities.shiftingWalls.play("wall-2");
        await k.wait(0.5);
        await entities.shiftingWalls.play("wall-3");
        await k.wait(0.5);
        await entities.shiftingWalls.play("wall-4");
        await k.wait(0.5);
        await entities.shiftingWalls.play("wall-5");
        await k.wait(0.5);
        await entities.shiftingWalls.play("wall-6");
        await k.wait(0.5);
        await entities.shiftingWalls.play("wall-7");
        await k.wait(0.5);
        // Remove collider so player can walk through
        entities.shiftingWalls.unuse("body");
    }

    let ghostHealthBar = null;

    if (entities.ghost) {
        setGhostAI(k, entities.ghost, entities.player);
        onAttacked(k, entities.ghost, () => entities.player);
        onCollideWithPlayer(k, entities.ghost, entities.player);

        // Emit healthChange on hurt/heal
        entities.ghost.on("hurt", () => {
            entities.ghost.trigger("healthChange", entities.ghost.hp());
        });
        entities.ghost.on("heal", () => {
            entities.ghost.trigger("healthChange", entities.ghost.hp());
        });

        // Listen for ghost death and trigger wall shift
        entities.ghost.onDestroy(() => {
            onGhostDestroyed(k);
            if (ghostHealthBar) ghostHealthBar.destroy();
            if (gameState.getHasDefeatedGhost() === true && entities.shiftingWalls) {
                shiftWalls();
            }
        });
    }

    // --- Synchronized animated tiles ---
    // Only register one update handler for animated tiles per scene load
    if (!k._hasAnimatedTileUpdate) {
        k._hasAnimatedTileUpdate = true;
        const tileW = mapData.tilewidth;
        const tileH = mapData.tileheight;
        const animGroups = new Map();
        function getAnimKey(sprite) {
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
                const sprite = animatedTileSprites.find(s => getAnimKey(s) === key);
                if (!sprite) continue;
                group.time += k.dt() * 1000;
                let duration = sprite.animDurations[group.index];
                while (group.time >= duration) {
                    group.time -= duration;
                    group.index = (group.index + 1) % sprite.animFrames.length;
                    duration = sprite.animDurations[group.index];
                }
            }
            for (const sprite of animatedTileSprites) {
                // Always update animated tile frames, regardless of visibility
                const key = getAnimKey(sprite);
                const group = animGroups.get(key);
                if (group) {
                    sprite.frame = sprite.animFrames[group.index];
                }
            }
        });
    }

}
