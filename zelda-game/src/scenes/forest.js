import {
    setPlayerMovement,
    generatePlayerComponents,
} from '../entities/player.js';
import {
    generateChestComponents,
    startChestInteraction,
} from '../entities/chest.js';
import { generateBatComponents, setBatAI } from '../entities/bat.js';
import {
    colorizeBackground,
    registerHealthPotionHandler,
    registerMuteHandler,
    fetchMapData,
    drawTiles,
    drawBoundaries,
    onAttacked,
    isPartiallyOnScreen,
    onCollideWithPlayer,
    lastPlayerPosManager,
    openWorldMap,
} from '../utils.js';
import { healthBar } from '../uiComponents/healthbar.js';
import { generateSlimeComponents, setSlimeAI } from '../entities/slime.js';
import { gameState, batState, slimeState } from '../state/stateManagers.js';
import { setupInventoryUI } from "../uiComponents/inventory.js";

export default async function forest(k) {
    const previousScene = gameState.getPreviousScene();

    console.log('previousScene:', previousScene);

    registerHealthPotionHandler(k);
    registerMuteHandler(k);
    colorizeBackground(k, 8, 148, 236);

    const mapData = await fetchMapData('./assets/maps/forest.json');
    const map = k.add([k.pos(100, 100)]);

    const entities = {
        player: null,
        chests: [],
        bats: [],
        slimes: [],
    };

    const layers = mapData.layers;

    // Handle object layers and entity spawning
    for (const layer of layers) {
        if (layer.name === 'Boundaries') {
            drawBoundaries(k, map, layer);
            continue;
        }

        if (layer.name === 'SpawnPoints') {
            for (const object of layer.objects) {
                if (object.name === 'bat') {
                    // Use Math.floor for both spawn and death
                    const batKey = `${Math.floor(object.x)},${Math.floor(
                        object.y
                    )}`;

                    const bat = map.add(
                        generateBatComponents(k, k.vec2(object.x, object.y))
                    );
                    bat._spawnKey = batKey;

                    entities.bats.push(bat);

                    continue;
                }

                if (object.name === 'slime') {
                    // Use Math.floor for both spawn and death
                    const slimeKey = `${Math.floor(object.x)},${Math.floor(
                        object.y
                    )}`;

                    const slime = map.add(
                        generateSlimeComponents(k, k.vec2(object.x, object.y))
                    );
                    slime._spawnKey = slimeKey;
                    // Assign index to first two slimes for tracking

                    entities.slimes.push(slime);

                    continue;
                }

                if (
                    object.name === 'player' &&
                    !entities.player &&
                    previousScene !== 'witch-house' &&
                    previousScene !== 'wolf-house' &&
                    previousScene !== 'mountain'
                ) {
                    entities.player = map.add(
                        generatePlayerComponents(k, k.vec2(object.x, object.y))
                    );
                    continue;
                }

                if (
                    object.name === 'player-wolf-house' &&
                    !entities.player &&
                    previousScene === 'wolf-house'
                ) {
                    entities.player = map.add(
                        generatePlayerComponents(k, k.vec2(object.x, object.y))
                    );
                    continue;
                }

                if (
                    object.name === 'player-witch-house' &&
                    !entities.player &&
                    previousScene === 'witch-house'
                ) {
                    entities.player = map.add(
                        generatePlayerComponents(k, k.vec2(object.x, object.y))
                    );
                }

                if ( object.name === 'player-mountain' && !entities.player && previousScene === 'mountain' ) {
                    entities.player = map.add( generatePlayerComponents(k, k.vec2(object.x, object.y)) ); continue; }

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

    entities.player.onCollide('wolf-house-entrance', () => {
        gameState.setPreviousScene('forest');
        k.go('wolf-house');
    });

    entities.player.onCollide('forest-exit', () => {
        gameState.setPreviousScene('forest');
        k.go('castle');
    });

    entities.player.onCollide('witch-house-entrance', () => {
        gameState.setPreviousScene('forest');
        k.go('witch-house');
    });

    entities.player.onCollide('mountain-entrance', () => {
        gameState.setPreviousScene('forest');
        k.go('mountain');
    });

    entities.player.onCollide('chest', (chest) => {
        startChestInteraction(k, chest, entities.player);
    });

    // After all entities are created and entities.player exists:
    for (const bat of entities.bats) {
        setBatAI(k, bat, entities.player);
        bat.enterState('idle'); // Start bat AI now that player exists
        onAttacked(k, bat, () => entities.player);
        onCollideWithPlayer(k, bat, entities.player);
        // Listen for bat death and persist dead state
        if (bat.onDeath) {
            bat.onDeath(() => {
                const pos = bat.pos;
                const key = `${Math.floor(pos.x)},${Math.floor(pos.y)}`;
                if (gameState.addDeadBat) {
                    gameState.addDeadBat(key);
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

    // Set camera to follow player
    k.setCamScale(4);
    if (entities.player && typeof entities.player.worldPos === 'function') {
        k.setCamPos(entities.player.worldPos());
    }

    k.onUpdate(() => {
        if (entities.player && typeof entities.player.worldPos === 'function') {
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
            gameState.setPreviousScene('forest');
            return lastPlayerPosManager.get();
        });
    }
}
