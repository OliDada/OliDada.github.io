import { setPlayerMovement, generatePlayerComponents } from "../entities/player.js";
import { generateTrollComponents } from "../entities/troll.js";
import { generateChestComponents, startChestInteraction } from "../entities/chest.js";
import { colorizeBackground, registerHealthPotionHandler, registerMuteHandler, fetchMapData, drawTiles, drawBoundaries, onAttacked, isPartiallyOnScreen } from "../utils.js";
import { healthBar } from "../uiComponents/healthbar.js";
import { gameState } from "../state/stateManagers.js";
import { dialog } from "../uiComponents/dialog.js";


export default async function trollDinner(k) {
    if (gameState.getTrollDinnerHad() === false) {
        gameState.setFreezePlayer(true);
    }

    const previousScene = gameState.getPreviousScene();
    registerHealthPotionHandler(k);
    registerMuteHandler(k);
    colorizeBackground(k, 8, 148, 236);

    const mapData = await fetchMapData("./assets/maps/troll-dinner.json");
    const map = k.add([k.pos(100, 100)]);

    const entities = {
        player: null,
        troll: null,
        chests: [],
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
                if (object.name === "player" && !entities.player && previousScene !== "forest-east" && gameState.getTrollDinnerHad() === false) {
                    entities.player = map.add(generatePlayerComponents(k, k.vec2(object.x, object.y)));
                    // Play sitting animation after spawn
                    if (entities.player && entities.player.play) {
                        entities.player.play("player-sitting-up");
                    }
                    continue;
                }

                if (object.name === "troll" && !entities.troll) {
                    entities.troll = map.add(generateTrollComponents(k, k.vec2(object.x, object.y)));
                    if (entities.troll && entities.troll.play) {
                        entities.troll.play("troll-sitting-down");
                    }
                }

                if (object.name === "player-troll-dinner-entrance" && !entities.player && previousScene === "forest-east" && gameState.getTrollDinnerHad() === true) {
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
            continue;
        }

        // Only draw tile layers
        if (layer.type === "tilelayer") {
            drawTiles(k, map, layer, mapData.tileheight, mapData.tilewidth, mapData.tilesets);
        }
    }

    let chestDialogHad = false;
    entities.player.onCollide("chest", async (chest) => {
        await startChestInteraction(k, chest);
        if (!chestDialogHad) {
            entities.troll.play("troll-sitting-left");
            await dialog(k, k.vec2(250, 500), ["Oh you're gonna take that? I guess that's fine.", "Since we're friends and all."]);
            chestDialogHad = true;
            entities.troll.play("troll-sitting-down");
        }
    });

    entities.player.onCollide('troll-dinner-exit', () => {
        gameState.setPreviousScene('troll-dinner');
        k.go('forest-east');
    });
    

    // Set camera to follow player
    k.setCamScale(4);
    if (entities.player && typeof entities.player.worldPos === "function") {
        k.setCamPos(entities.player.worldPos().sub(0, 20));
    }

    setPlayerMovement(k, entities.player);
    healthBar(k);

    if (gameState.getTrollDinnerHad() === false) {
        // Ensure player stays in sitting animation while frozen
        k.onUpdate(() => {
            if (entities.player && gameState.getFreezePlayer()) {
                if (entities.player.curAnim && entities.player.curAnim() !== "player-sitting-up") {
                    entities.player.play("player-sitting-up");
                }
            }
        });
        // Fade from black at scene start (after tiles drawn)
        const fade = k.add([
            k.rect(k.width(), k.height()),
            k.color(27, 29, 52),
            k.opacity(1),
            k.fixed(),
            "fadeFromBlack"
        ]);
        await k.tween(fade.opacity, 0, 1, v => fade.opacity = v, k.easings.linear);
        console.log("previousScene:", previousScene);

        // Dialog sequence with troll animation changes
        const dialogLines = [
            "So ummm... How do you like the lamb?", 
            "It's like... totally cool if you don't like it.", 
            "Really, it's just something I threw together.",
            "...", 
            "You're not much of a talker huh?", 
            "That's cool, I've always thought talking was like super overrated anyway. Haha", 
            "...", 
            "Anyway, I just wanted to say thanks for coming.", 
            "It's been... nice having someone over for dinner.", 
            "This might be hard to believe but I actually don't have very many friends."
        ];
        await dialog(k, k.vec2(250, 500), dialogLines);
        if (entities.troll) {
            entities.troll.play("troll-laugh");
        }
        await dialog(k, k.vec2(250, 500), ["Crazy huh?\n*chuckles softly*"]);

        // Continue with remaining lines
        const dialogLines2 = [
            "...", 
            "Being a troll under a bridge definitely has its downsides.", 
            "But, you know... I'm proud of my work.",
            "My father was a troll under a bridge, and his father before him.",
            "Guess you could say it runs in the family.",
            "...",
            "Well, I've held you long enough. I bet you have a bunch of friends to go see. *sigh*",
            "W-would you mind if I called you my... friend?",
            "...",
            "I'll take that as a yes! Thanks, friend.",
            "You can feel free to travel over my bridge anytime you want.",
            "Be sure to stop by for dinner again sometime, okay?",
        ];
        await dialog(k, k.vec2(250, 500), dialogLines2);
        gameState.setTrollDinnerHad(true);
    }

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
}