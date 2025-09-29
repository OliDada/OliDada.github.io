import { colorizeBackground, playAnimIfNotPlaying, drawBoundaries, drawTiles, fetchMapData, registerMuteHandler, registerHealthPotionHandler, onAttacked } from "../utils.js"
import { generatePlayerComponents, setPlayerMovement } from "../entities/player.js";
import { generateWolfComponents, startInteraction, startWolfBossFight } from "../entities/wolf.js";
import { generateRedRidingHoodComponents } from "../entities/redRidingHood.js";
import { dialog } from "../uiComponents/dialog.js";
import { healthBar } from "../uiComponents/healthbar.js";
import { addBossHealthBar } from "../uiComponents/bossHealth.js";
import { gameState } from "../state/stateManagers.js";
import { setupInventoryUI } from "../uiComponents/inventory.js";

export default async function wolfHouse(k) {

    registerHealthPotionHandler(k);
    registerMuteHandler(k);
    colorizeBackground(k, 27, 29, 52);

    let wolfHealthBar = null;

    const mapData = await fetchMapData("./assets/maps/wolf-house.json");

    const map = k.add([k.pos(100, 192)]);

    const entities = {
        player: null,
        wolf: null,
        redRidingHood: null,
    };

    const layers = mapData.layers;
    for (const layer of layers) {
        if (layer.name === "Boundaries") {
            drawBoundaries(k, map, layer);
            continue;
        }
        if (layer.name === "SpawnPoints") {
            for (const object of layer.objects) {
                if (object.name === "player") {
                    entities.player = map.add(generatePlayerComponents(k, k.vec2(object.x, object.y)));
                    continue;
        
                }
                if (object.name === "wolf") {
                    entities.wolf = map.add(generateWolfComponents(k, k.vec2(object.x, object.y)));
                    continue;
                }
                if (object.name === "red-riding-hood") {
                    entities.redRidingHood = map.add(generateRedRidingHoodComponents(k, k.vec2(object.x, object.y)));
                    continue;
                }
            }
        }

        // Only draw tile layers
        if (layer.type === "tilelayer") {
            drawTiles(k, map, layer, mapData.tileheight, mapData.tilewidth, mapData.tilesets);
        }
        
    }

    const tile = 16;


    k.onUpdate(async () => {
        if (
            entities.player &&
            entities.wolf &&
            !gameState.getWolfEncountered()
        ) {
            if (entities.player.pos.y < 416) {
                gameState.setFreezePlayer(true);
                gameState.setWolfEncountered(true);

                setTimeout(async () => {
                    const dialogLines = [
                        "Hey honey, you're back already?", 
                        "What treats did you bring me this time?", 
                        "...",
                        "Wait... you're not my granddaugher...",
                    ];
                    await dialog(k, k.vec2(250, 500), dialogLines);
                    // Wolf gets out of bed
                    gameState.setFreezePlayer(true); // Freeze player during wolf movement
                    await k.tween(
                        entities.wolf.pos,
                        entities.wolf.pos.add(k.vec2(1.5 * tile, 0)),
                        1,
                        v => {
                            entities.wolf.pos = v;
                            // Keep walk animation active during movement
                            if (entities.wolf.curAnim() !== 'wolf-side') {
                                entities.wolf.play('wolf-side');
                            }
                        },
                        k.easings.linear
                    );
                    if (entities.wolf.pos.y < 432) {
                        await k.tween(
                            entities.wolf.pos,
                            entities.wolf.pos.add(k.vec2(0, (entities.player.pos.y - entities.wolf.pos.y) - tile)),
                            1.5,
                            v => {
                                entities.wolf.pos = v;
                                // Keep walk animation active during movement
                                if (entities.wolf.curAnim() !== 'wolf-down') {
                                    entities.wolf.play('wolf-down');
                                }
                            },
                            k.easings.linear
                        );
                    }
                    if (entities.wolf.pos.x < entities.player.pos.x - tile) {
                        await k.tween(
                            entities.wolf.pos,
                            entities.wolf.pos.add(k.vec2((entities.player.pos.x - entities.wolf.pos.x), 0)),
                            (entities.player.pos.x - entities.wolf.pos.x) / 16, // duration based on distance
                            v => {
                                entities.wolf.pos = v;
                                // Keep walk animation active during movement
                                if (entities.wolf.curAnim() !== 'wolf-side') {
                                    entities.wolf.play('wolf-side');
                                }
                            },
                            k.easings.linear
                        );
                    } else if (entities.wolf.pos.x > entities.player.pos.x + tile) {
                        await k.tween(
                            entities.wolf.pos,
                            entities.wolf.pos.add(k.vec2((entities.player.pos.x - entities.wolf.pos.x), 0)),
                            (entities.wolf.pos.x - entities.player.pos.x) / 16, // duration based on distance
                            v => {
                                entities.wolf.pos = v;
                                // Keep walk animation active during movement
                                if (entities.wolf.curAnim() !== 'wolf-side') {
                                    entities.wolf.play('wolf-side');
                                }
                                entities.wolf.flipX = true;
                            },
                            k.easings.linear
                        );
                    }
                    // Face down
                    playAnimIfNotPlaying(entities.wolf, 'wolf-idle-down');

                    // The wolf intended to dress up as red riding hood's grandma (the player is not red riding hood) and wait for her to arrive to eat her. but the food she brought was so good that the wolf has been pretending to be the grandma ever since. The wolf is embarrassed about the player seeing him like this.
                    const dialogLines2 = [
                        "...", 
                        "Yeah, yeah, laugh it up. I'm a wolf in a pink nightgown.", 
                        "It's not like I wanted to end up like this...",
                        "I was going to eat that girl... but then she kept bringing me these delicious treats.",
                        "Look at me now! I can barely fit in this dress. Can’t even see my own paws past this gut!",
                        "It turns out the girl is actually really nice.",
                        "Somehow she thinks I'm really her grandma. I don't have the heart to tell her otherwise.",
                        "So I've just been going along with it.",
                        "But now you've seen me like this... I can't let anybody find out the truth.",
                        "I'm going to have to eat you now.",

                    ];
                    await dialog(k, k.vec2(250, 500), dialogLines2);

                    // Boss fight starts here!
                    wolfHealthBar = addBossHealthBar(k, entities.wolf);
                    gameState.setFreezePlayer(false); // Unfreeze player

                    startWolfBossFight(k, entities.wolf, entities.player);

                }, 0);
            }
            if (entities.wolf.health <= 1 && entities.wolf.isBoss) {
                // Trigger red riding hood appearance
                gameState.setFreezePlayer(true); // Freeze player during wolf movement
                        await k.tween(
                            entities.redRidingHood.pos,
                            entities.redRidingHood.pos.add(k.vec2(-4 * tile, 0)),
                            2,
                            v => {
                                entities.redRidingHood.pos = v;
                                // Keep walk animation active during movement
                                if (entities.redRidingHood.curAnim() !== 'red-riding-hood-up') {
                                    entities.redRidingHood.play('red-riding-hood-up');
                                }
                            },
                            k.easings.linear
                        );
            }
        }


        // Camera follow (only once)
        if (entities.player && entities.player.pos.dist(k.getCamPos()) > 6) {
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

    entities.player.onCollide("wolf-house-exit", () => {
        if (entities.wolf.isBoss) return; // Prevent exit during boss fight
        gameState.setPreviousScene("wolf-house");
        k.play("door-open");
        k.go("forest");
    });

    k.setCamScale(4);
    k.setCamPos(entities.player.worldPos());

    setPlayerMovement(k, entities.player);


    healthBar(k);

    entities.wolf.onCollide("player", (p) => {
        if (entities.wolf.isBoss && p && p.hurt) {
            p.hurt(1); // or your damage logic
        }
    });

    let wolfFinaleTriggered = false;

    onAttacked(k, entities.wolf, () => entities.player, {
        onHurt: async (wolf) => {
            if (!wolfFinaleTriggered && wolf.hp() <= 1 && wolf.isBoss) {
                wolfFinaleTriggered = true;
                // Freeze player and wolf
                if (wolfHealthBar) wolfHealthBar.destroy();
                gameState.setFreezePlayer(true);
                wolf.paused = true;         // <--- This pauses the wolf's AI
                wolf.isBoss = false;        // <--- This disables boss logic

                
                // Move wolf to center
                const centerPos = k.vec2(704, 432); // Adjust to your room's center
                await k.tween(
                    wolf.pos,
                    centerPos,
                    1.2,
                    (val) => { wolf.pos = val; },
                    k.easings.linear
                );
                wolf.flipX = false;
                playAnimIfNotPlaying(wolf, "wolf-idle-down");

                // Move Red Riding Hood to the wolf
                await k.tween(
                    entities.redRidingHood.pos,
                    wolf.pos.add(k.vec2(-16, 16)),
                    2,
                    v => {
                        entities.redRidingHood.pos = v;
                        if (entities.redRidingHood.curAnim() !== 'red-riding-hood-up') {
                            entities.redRidingHood.play('red-riding-hood-up');
                        }
                    },
                    k.easings.linear
                );
                entities.redRidingHood.play('red-riding-hood-idle-down');

                // Start dialog
                await dialog(k, k.vec2(250, 500), [
                    "Grandma! Are you okay?",
                    "What the hell is going on here!",
                ]);

                entities.player.flipX = true; // Set flipX before tweening

                await k.tween(
                    entities.player.pos,
                    wolf.pos.add(k.vec2(16, 16)),
                    2,
                    v => {
                        entities.player.pos = v;
                        if (entities.player.curAnim() !== 'player-side') {
                            entities.player.play('player-side');
                        }
                    },
                    k.easings.linear
                );
                entities.player.play('player-idle-side');
                entities.redRidingHood.play('red-riding-hood-idle-side');
                await dialog(k, k.vec2(250, 500), [
                    "Did you just attack my grandma?",
                    "What is wrong with you? She's a poor innocent old lady!",
                ]);

                // Unfreeze player and wolf, or trigger ending as needed
                gameState.setFreezePlayer(false);
                // wolf.paused = false; // Only unpause if you want the wolf to resume moving
            }
        },
        preventDeath: (wolf) => wolf.hp() <= 1
    });

    // After creating the wolf entity (e.g. in wolfHouse.js)
    const wolf = entities.wolf;

    // Save the original hurt method
    const originalHurt = wolf.hurt.bind(wolf);

    wolf.hurt = function(amount) {
        originalHurt(amount);
        wolf.trigger("healthChange", wolf.hp());
    };
}
