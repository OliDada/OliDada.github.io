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
import { gameState } from '../state/stateManagers.js';



export default async function world(k) {

    registerMuteHandler(k);
    registerHealthPotionHandler(k);
    const previousScene = gameState.getPreviousScene();

    colorizeBackground(k, 8, 148, 236);

    const mapData = await fetchMapData('./assets/maps/world.json');

    const map = k.add([k.pos(0, 0)]);

    const entities = {
        player: null,
        slimes: [],
        chests: [],
    };

    const layers = mapData.layers;

    // Now handle object layers and entity spawning
    for (const layer of layers) {
        if (layer.name === 'Boundaries') {
            drawBoundaries(k, map, layer);
            continue;
        }

        if (layer.name === 'SpawnPointsShop') {
            for (const object of layer.objects) {
                if (
                    object.name === 'player-shop' &&
                    previousScene === 'shop' &&
                    !entities.player
                ) {
                    entities.player = map.add(
                        generatePlayerComponents(k, k.vec2(object.x, object.y))
                    );
                    continue;
                }
            }
        }

        if (layer.name === 'SpawnPointsTower') {
            for (const object of layer.objects) {
                if (
                    object.name === 'player-tower' &&
                    previousScene === 'tower' &&
                    !entities.player
                ) {
                    entities.player = map.add(
                        generatePlayerComponents(k, k.vec2(object.x, object.y))
                    );
                    continue;
                }
            }
        }

        if (layer.name === 'SpawnPointsChest') {
            for (const object of layer.objects) {
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

        if (layer.name === 'SpawnPointsHouse') {
            for (const object of layer.objects) {
                if (
                    object.name === 'player-house' &&
                    previousScene === 'house' &&
                    !entities.player
                ) {
                    entities.player = map.add(
                        generatePlayerComponents(k, k.vec2(object.x, object.y))
                    );
                    continue;
                }
            }
        }

        if (layer.name === 'SpawnPoints') {
            for (const object of layer.objects) {
                if (object.name === 'player' && !entities.player) {
                    entities.player = map.add(
                        generatePlayerComponents(k, k.vec2(object.x, object.y))
                    );
                    continue;
                }
                if (object.name === 'slime') {
                    entities.slimes.push(
                        map.add(
                            generateSlimeComponents(
                                k,
                                k.vec2(object.x, object.y)
                            )
                        )
                    );
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
                mapData.tilesets
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
    }
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
