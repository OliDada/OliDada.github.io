import { setPlayerMovement, generatePlayerComponents } from "../entities/player.js";
import { generateChestComponents, startChestInteraction } from "../entities/chest.js";
import { generateSlimeComponents } from "../entities/slime.js";
import { generateTrollComponents } from "../entities/troll.js";
import { setBatAI, generateBatComponents } from "../entities/bat.js";
import { generateSnakeComponents, setSnakeAI } from "../entities/snake.js";
import { generateBeanStalkComponents } from "../entities/beanStalk.js";
import { generateGardenerComponents, startInteraction as startGardenerInteraction } from "../entities/gardener.js";
import { colorizeBackground, registerHealthPotionHandler, registerMuteHandler, fetchMapData, drawTiles, drawBoundaries, onAttacked, isPartiallyOnScreen, onCollideWithPlayer, openWorldMap, lastPlayerPosManager } from "../utils.js";
import { healthBar } from "../uiComponents/healthbar.js";
import { gameState, beanStalkState } from "../state/stateManagers.js";
import { setSlimeAI } from "../entities/slime.js";
import { dialog } from "../uiComponents/dialog.js";
import { setupInventoryUI } from "../uiComponents/inventory.js";

export default async function forestEast(k) {

    const previousScene = gameState.getPreviousScene();

    console.log("previousScene:", previousScene);

    registerHealthPotionHandler(k);
    registerMuteHandler(k);
    colorizeBackground(k, 8, 148, 236);

    const mapData = await fetchMapData("./assets/maps/forest-east.json");
    const map = k.add([k.pos(100, 100)]);

    const entities = {
        player: null,
        chests: [],
        slimes: [],
        bats: [],
        snakes: [],
        troll: null,
        gardener: null,
        beanStalk: null,
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

                if (object.name === "slime" && !entities.slimes.find(s => s.id === object.id)) {
                    const key = `${Math.round(object.x)},${Math.round(object.y)}`;
                    const deadSlimes = gameState.getDeadSlimes ? gameState.getDeadSlimes() : [];
                    if (deadSlimes.includes(key)) {
                        continue; // Don't respawn dead slimes
                    }
                    const slime = map.add(generateSlimeComponents(k, k.vec2(object.x, object.y)));
                    entities.slimes.push(slime);
                }

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

                if (object.name === 'snake') {
                    const snake = map.add(
                        generateSnakeComponents(k, k.vec2(object.x, object.y))
                    );
                    entities.snakes.push(snake);
                    continue;
                }

                if (object.name === "player" && !entities.player && previousScene !== "troll-dinner" && previousScene !== "bean-stalk" && previousScene !== "swamp") {
                    entities.player = map.add(generatePlayerComponents(k, k.vec2(object.x, object.y)));
                    continue;
                }

                if (object.name === "player-troll-dinner" && !entities.player && previousScene === "troll-dinner") {
                    entities.player = map.add(generatePlayerComponents(k, k.vec2(object.x, object.y)));
                }

                if (object.name === "player-bean-stalk" && !entities.player && previousScene === "bean-stalk") {
                    entities.player = map.add(generatePlayerComponents(k, k.vec2(object.x, object.y)));
                }

                if (object.name === "player-swamp" && !entities.player && previousScene === "swamp") {
                    entities.player = map.add(generatePlayerComponents(k, k.vec2(object.x, object.y)));
                }

                if (object.name === 'troll') {
                    entities.troll = map.add(
                        generateTrollComponents(k, k.vec2(object.x, object.y))
                    );
                }

                if (object.name === 'gardener') {
                    entities.gardener = map.add(
                        generateGardenerComponents(k, k.vec2(object.x, object.y))
                    );
                }

                // Not max height beanstalk
                if (object.name === "bean-stalk") {
                    const beanStalkHeight = beanStalkState.getBeanStalkHeight() + 1;
                    if (beanStalkHeight < 6) {
                        entities.beanStalk = map.add(
                            generateBeanStalkComponents(k, k.vec2(object.x, object.y), `bean-stalk-${beanStalkHeight}`)
                        );
                    }
                }

                // Max height beanstalk
                if (object.name === "bean-stalk-max") {
                    if (beanStalkState.getBeanStalkHeight() >= 5) {
                        entities.beanStalk = map.add(
                            generateBeanStalkComponents(k, k.vec2(object.x, object.y), "bean-stalk-6")
                        );
                    }
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

    for (const slime of entities.slimes) {
        setSlimeAI(k, slime);
        onAttacked(k, slime, () => entities.player);
        onCollideWithPlayer(k, slime, entities.player);
        // Listen for slime death and persist dead state
        if (slime.onDeath) {
            slime.onDeath(() => {
                const pos = slime.pos;
                const key = `${Math.round(pos.x)},${Math.round(pos.y)}`;
                if (gameState.addDeadSlime) {
                    gameState.addDeadSlime(key);
                }
            });
        }
    }

    entities.player.onCollide("forest-east-exit", () => {
        beanStalkState.setBeanStalkHeight(beanStalkState.getBeanStalkHeight() + 1);
        gameState.setPreviousScene("forest-east");
        k.go("castle");
    });

    entities.player.onCollide("gardener", () => {
        startGardenerInteraction(k, entities.gardener, entities.player, entities.beanStalk);
    });

    entities.player.onCollide('chest', (chest) => {
        startChestInteraction(k, chest, entities.player);
    });

    entities.player.onCollide("troll-dinner-entrance", () => {
        if (gameState.getTrollDinnerHad() === true) {
            gameState.setPreviousScene("forest-east");
            k.go("troll-dinner");
        }
    });

    entities.player.onCollide("bean-stalk", () => {
        if (beanStalkState.getBeanStalkHeight() >= 5) {
            k.go("bean-stalk");
        }
    });

    entities.player.onCollide("swamp-entrance", () => {
        gameState.setPreviousScene("forest-east");
        k.go("swamp");
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

    for (const snake of entities.snakes) {
        setSnakeAI(k, snake, entities.player);
        snake.enterState('idle'); // Start snake AI now that player exists
        onAttacked(k, snake, () => entities.player);
        onCollideWithPlayer(k, snake, entities.player);
        // Listen for snake death and persist dead state
        if (snake.onDeath) {
            snake.onDeath(() => {
                const pos = snake.pos;
                const key = `${Math.round(pos.x)},${Math.round(pos.y)}`;
                if (gameState.addDeadSnake) {
                    gameState.addDeadSnake(key);
                }
            });
        }
    }

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

const triggerPos = k.vec2(1180, 705);
let hasTalked = false;
let trollMoved = false;
let movementStarted = false;

async function moveTrollSequence(troll) {
    const tile = 16;
    // 1 tile down
    troll.play('troll-down');
    await k.tween(troll.pos, troll.pos.add(k.vec2(0, tile)), 2, v => troll.pos = v, k.easings.linear);
    // 3 tiles right
    troll.play('troll-side');
    troll.flipX = false;
    await k.tween(troll.pos, troll.pos.add(k.vec2(3 * tile, 0)), 4, v => troll.pos = v, k.easings.linear);
    // 2 tiles up
    troll.play('troll-up');
    await k.tween(troll.pos, troll.pos.add(k.vec2(0, -2 * tile)), 3, v => troll.pos = v, k.easings.linear);
    // 3 tiles left
    troll.play('troll-side');
    troll.flipX = true;
    await k.tween(troll.pos, troll.pos.add(k.vec2(-3 * tile, 0)), 4, v => troll.pos = v, k.easings.linear);
    // Return to idle
    troll.play('troll-idle-side');
}

async function trollLeadsPlayer(k, troll, player) {
    entities.troll.unuse('body'); // Disable collision between troll and player during movement
    entities.player.unuse('body');
    gameState.setFreezePlayer(true); // Freeze player control during movement
    const tile = 16;
    // Troll completes all movements first
    troll.play('troll-side'); troll.flipX = false;
    await k.tween(troll.pos, troll.pos.add(k.vec2(5 * tile, 0)), 2, v => { troll.pos = v; troll.flipX = false; }, k.easings.linear);
    troll.play('troll-down');
    await k.tween(troll.pos, troll.pos.add(k.vec2(0, 2 * tile)), 1.2, v => { troll.pos = v; }, k.easings.linear);
    troll.play('troll-side'); troll.flipX = true;
    await k.tween(troll.pos, troll.pos.add(k.vec2(-3 * tile, 0)), 1.6, v => { troll.pos = v; troll.flipX = true; }, k.easings.linear);
    troll.play('troll-up');
    await k.tween(troll.pos, troll.pos.add(k.vec2(0, -1 * tile)), 0.8, v => { troll.pos = v; }, k.easings.linear);
    troll.play('troll-idle-down');

    // Player follows the same path after troll finishes
    await k.wait(0.3);
    // 6 tiles right
    player.play('player-side'); player.flipX = false;
    await k.tween(player.pos, player.pos.add(k.vec2(6 * tile, 0)), 1.6, v => { player.pos = v; player.flipX = false; }, k.easings.linear);
    // 2 tiles down
    player.play('player-down');
    await k.tween(player.pos, player.pos.add(k.vec2(0, 2 * tile)), 1, v => { player.pos = v; }, k.easings.linear);
    // 3 tiles left
    player.play('player-side'); player.flipX = true;
    await k.tween(player.pos, player.pos.add(k.vec2(-3 * tile, 0)), 1.2, v => { player.pos = v; player.flipX = true; }, k.easings.linear);
    // 1 tile up
    player.play('player-up');
    await k.tween(player.pos, player.pos.add(k.vec2(0, -0.5 * tile)), 0.6, v => { player.pos = v; }, k.easings.linear);
    // Return to idle
    player.play('player-idle-down');
    entities.player.use('body'); // Re-enable collision
}


k.onUpdate(() => {
    if (!entities.player || !entities.troll || gameState.getTrollDinnerHad() === true || movementStarted) return;
    if (entities.player.pos.dist(triggerPos) < 48) {
        entities.bats.forEach(bat => bat.destroy());
        entities.slimes.forEach(slime => slime.destroy());
        entities.snakes.forEach(snake => snake.destroy());
        // Start dialog sequence
        dialog(k, k.vec2(250, 500), ["Stop right there!"], { keepFrozen: true });
        movementStarted = true;
        // Freeze player
        gameState.setFreezePlayer(true);
        moveTrollSequence(entities.troll).then(async () => {
            // After movement, show dialog sequence
            const { dialog } = await import("../uiComponents/dialog.js");
            const lines = ["You shall not pass until you answer my riddle! And if you get it wrong...","I will eat you! Muahaha!", "Alright here it comes...", "What has eyes but... can't see... ummm...","Wait... What has umm... a mouth? No, that's not right..."];
            await dialog(k, k.vec2(250, 500), lines);
            // Troll turns to the right
            entities.troll.play('troll-idle-side');
            entities.troll.flipX = false;
            const lines2 = ["Oh god this is so embarrassing... How did that stupid riddle go again...","...","..."];
            await dialog(k, k.vec2(250, 500), lines2);
            // Troll moves left after lines2
            entities.troll.flipX = true;
            const tile = 16;
            entities.troll.play('troll-idle-side');
            const lines3 = ["Forget that stupid riddle!"];
            await dialog(k, k.vec2(250, 500), lines3);
            gameState.setFreezePlayer(true);
            await k.tween(
                entities.troll.pos,
                entities.troll.pos.add(k.vec2(-2 * tile, 0)),
                3,
                v => {
                    entities.troll.pos = v;
                    // Keep walk animation active during movement
                    if (entities.troll.curAnim() !== 'troll-side') {
                        entities.troll.play('troll-side');
                    }
                    entities.troll.flipX = true;
                },
                k.easings.linear
            );
            entities.troll.play('troll-idle-side');
            const lines4 = ["I'll just eat you anyway!"];
            await dialog(k, k.vec2(250, 500), lines4);
            const lines5 = ["Muhahaha!"];
            entities.troll.play('troll-side');
            await dialog(k, k.vec2(250, 500), lines5);
            k.wait(2000);
            entities.troll.play('troll-idle-side');
            const lines6 = ["Wait, why aren't you running away?", "I-I'm about to eat you. I mean it!"];
            await dialog(k, k.vec2(250, 500), lines6);
            k.wait(4000);
            const lines7 = ["...","...","...","*Sigh* Can i be honest with you?"];
            await dialog(k, k.vec2(250, 500), lines7);
            gameState.setFreezePlayer(true);
            await k.tween(
                entities.troll.pos,
                entities.troll.pos.add(k.vec2(0, 0.5 * tile)),
                2,
                v => {
                    entities.troll.pos = v;
                    // Keep walk animation active during movement
                    if (entities.troll.curAnim() !== 'troll-down') {
                        entities.troll.play('troll-down');
                    }
                },
                k.easings.linear
            );
            entities.troll.play('troll-idle-down');
            const lines8 = ["I don't really like the taste of humans...","But please don't tell anyone, ok?", "What would people think of me if they knew I didn't like eating humans?", "I would be the laughing stock of the troll community!"];
            await dialog(k, k.vec2(250, 500), lines8);
            gameState.setFreezePlayer(true);
            await k.tween(
                entities.troll.pos,
                entities.troll.pos.add(k.vec2(0, -0.5 * tile)),
                2,
                v => {
                    entities.troll.pos = v;
                    // Keep walk animation active during movement
                    if (entities.troll.curAnim() !== 'troll-up') {
                        entities.troll.play('troll-up');
                    }
                },
                k.easings.linear
            );
            entities.troll.play('troll-idle-side');
            const lines9 = ["Look, I'll let you pass. If you let me invite you to dinner.", "I promise it will be worth your while.", "The grass is like way greener on the other side of this bridge.", "...","I'll take that as a yes! Follow me."];
            await dialog(k, k.vec2(250, 500), lines9);
            await trollLeadsPlayer(k, entities.troll, entities.player);
            // Fade to black effect
            const fade = k.add([
                k.rect(k.width(), k.height()),
                k.color(27, 29, 52),
                k.opacity(0),
                k.fixed(),
                "fadeToBlack"
            ]);
            await k.tween(fade.opacity, 1, 1, v => fade.opacity = v, k.easings.linear);
            // Unfreeze player
            hasTalked = true;
            gameState.setFreezePlayer(false);
            k.go("troll-dinner");
        });
    }
});

    setPlayerMovement(k, entities.player);
    healthBar(k);
    setupInventoryUI(k);

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
            gameState.setPreviousScene('forest-east');
            return lastPlayerPosManager.get();
        });
    }


}