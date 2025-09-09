import {
    colorizeBackground,
    drawBoundaries,
    drawTiles,
    fetchMapData,
    registerMuteHandler,
    registerHealthPotionHandler,
    slideCamY,
    onAttacked,
    onCollideWithPlayer
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

const gameState = globalStateManager().getInstance();

export default async function basement(k) {

    //gameState.pauseCurrentSong();
    //const newSong = k.play("basement-soundtrack", { loop: true });
    //gameState.setCurrentSong(newSong);

    registerHealthPotionHandler(k);
    registerMuteHandler(k);
    const previousScene = gameState.getPreviousScene();

    colorizeBackground(k, 27, 29, 52);

    const mapData = await fetchMapData('./assets/maps/basement.json');
    const map = k.add([k.pos(-380, -392)]);

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
    };

    // Spawn entities from Tiled layers
    for (const layer of mapData.layers) {
        if (layer.name === 'Boundaries') {
            drawBoundaries(k, map, layer);
            continue;
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
                    entities.player = map.add(
                        generatePlayerComponents(k, k.vec2(object.x, object.y))
                    );
                    continue;
                }
                if (object.name === 'prisoner') {
                    entities.prisoner = map.add(
                        generatePrisonerComponents(k, k.vec2(object.x, object.y))
                    );
                    continue;
                }
                if (object.name === 'prison-door') {
                    entities.prisonDoor = map.add(
                        generatePrisonDoorComponents(k, k.vec2(object.x, object.y))
                    );
                    continue;
                }
                if (object.name === "secret-passage") {
                    entities.secretPassage = map.add(
                        generateSecretPassageComponents(k, k.vec2(object.x, object.y), false)
                    );
                    continue;
                }
                if (object.name === 'transition') {
                    map.add(generateTransitionComponents(k, k.vec2(object.x, object.y)));
                    continue;
                }
                if (object.name === 'pressure-plate') {
                    const plate = map.add(generatePressurePlateComponents(k, k.vec2(object.x, object.y)));
                    entities.pressurePlates.push(plate);
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

            }
        }

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

    // Helper to check if all plates are down
    function areAllPlatesDown() {
        return entities.pressurePlates.length > 0 && entities.pressurePlates.every(p => p.isDown);
    }

    // Pressure plate collision logic
    entities.player.onCollide("pressure-plate", (plate) => {
        if (plate._colliderCount === undefined) plate._colliderCount = 0;
        plate._colliderCount++;
        if (!plate.isDown) {
            plate.isDown = true;
            plate.play("pressure-plate-down");
            if (areAllPlatesDown()) {
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
                if (areAllPlatesDown()) {
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
            // Make secret passage pushable now
            if (entities.secretPassage) {
                entities.secretPassage.unuse('body');
                entities.secretPassage.use(k.body({ isStatic: false }));
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

    if (entities.ghost) {
        setGhostAI(k, entities.ghost, entities.player);
        onAttacked(k, entities.ghost, () => entities.player);
        onCollideWithPlayer(k, entities.ghost, entities.player);
        // Listen for ghost death and trigger wall shift
        entities.ghost.onDestroy(() => {
            onGhostDestroyed(k);
            if (gameState.getHasDefeatedGhost() === true && entities.shiftingWalls) {
                shiftWalls();
            }
        });
    }
 
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

    // Player leaves pressure plate
    entities.player.onCollideEnd("pressure-plate", (plate) => {
        if (plate._colliderCount === undefined) plate._colliderCount = 0;
        plate._colliderCount = Math.max(0, plate._colliderCount - 1);
        if (plate._colliderCount === 0 && plate.isDown) {
            plate.isDown = false;
            plate.play("pressure-plate-up");
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
}
