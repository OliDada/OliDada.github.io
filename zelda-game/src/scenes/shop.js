import { colorizeBackground, drawBoundaries, drawTiles, fetchMapData, registerMuteHandler, registerHealthPotionHandler, followPlayer } from "../utils.js"
import { generatePlayerComponents, setPlayerMovement } from "../entities/player.js";
import { generateShopkeeperComponents } from "../entities/shopkeeper.js";
import { healthBar } from "../uiComponents/healthbar.js";
import { gameState, playerState } from "../state/stateManagers.js";
import { startInteraction } from "../entities/shopkeeper.js";
import { generatePrisonerComponents } from "../entities/prisoner.js";
import { setupInventoryUI } from "../uiComponents/inventory.js";


export default async function shop(k) {

    registerHealthPotionHandler(k);
    registerMuteHandler(k);

    const previousScene = gameState.getPreviousScene();
    console.log("Previous scene:", previousScene);

    colorizeBackground(k, 27, 29, 52);

    const mapData = await fetchMapData("./assets/maps/shop.json");

    const map = k.add([k.pos(-240, -372)]);

    const entities = {
        player: null,
        shopkeeper: null,
        prisoner: null, // Add prisoner here
    };

    const layers = mapData.layers;
    for (const layer of layers) {
        if (layer.name === "Boundaries") {
            drawBoundaries(k, map, layer);
            continue;
        }

        if (layer.name === "SpawnPointsShop") {
            for (const object of layer.objects) {
                if (
                    object.name === "player-shop" &&
                    !entities.player && previousScene === "basement"
                ) {
                    entities.player = map.add(generatePlayerComponents(k, k.vec2(object.x, object.y)));
                    continue;
                }
            }
        }

        if (layer.name === "SpawnPointsShopSecondFloor") {
            for (const object of layer.objects) {
                if (
                    object.name === "player-shop-second-floor" &&
                    !entities.player && previousScene === "shop-second-floor"
                ) {
                    entities.player = map.add(generatePlayerComponents(k, k.vec2(object.x, object.y)));
                    continue;
                }
            }
        }

        if (layer.name === "SpawnPoints") {
            
            for (const object of layer.objects) {

                if (object.name === "player" && !entities.player && previousScene !== "basement" && previousScene !== "shop-second-floor") {
                    entities.player = map.add(generatePlayerComponents(k, k.vec2(object.x, object.y)));
                    continue;
                } 
                if (object.name === "shopkeeper") {
                    entities.shopkeeper = map.add(generateShopkeeperComponents(k, k.vec2(object.x, object.y)));
                    continue;
                }

                if (object.name === "prisoner") {
                    entities.prisoner = map.add(generatePrisonerComponents(k, k.vec2(object.x, object.y)));
                    continue;
                }

                if (object.name === "basement-entrance") {
                    map.add(
                       generatePlayerComponents(
                            k,
                            object.width,
                            object.height,
                            k.vec2(object.x, object.y),
                           "basement-entrance"
                        )
                    );
                    continue;
                }

                
            }
        }

        // Only draw tile layers
        if (layer.type === "tilelayer") {
            drawTiles(k, map, layer, mapData.tileheight, mapData.tilewidth, mapData.tilesets);
        }
        
    }

    if (!entities.player) {
        return;
    }
    k.setCamScale(5);
    k.setCamPos(entities.player.worldPos());
    k.onUpdate(() => {
        if (entities.player.pos.dist(k.getCamPos())) {
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

    // Make prisoner follow player ONLY if freed in basement
    if (
        entities.prisoner &&
        entities.player &&
        gameState.getPrisonDoorOpened()
    ) {
        entities.prisoner.use({ opacity: 1 });
        entities.prisoner.unuse('body');
        followPlayer(k, entities.player, entities.prisoner, 20);
    } else {
        entities.prisoner.use({ opacity: 0 });
        entities.prisoner.unuse('area');

    }

    entities.player.onCollide("shop-exit", () => {
        gameState.setPreviousScene("shop");
        k.play("door-open");
        k.go("world");
    });

    entities.player.onCollide("shop-second-floor", () => {
        gameState.setPreviousScene("shop");
        k.go("shop-second-floor");
    });

    entities.player.onCollide("shopkeeper", () => {
            startInteraction(k, entities.shopkeeper, entities.player);
        });

    let basementEntranceAttempts = 0;
    
    entities.player.onCollide("basement-entrance", () => {
        if (playerState.hasKey("basement-key")) {
            gameState.setPreviousScene("shop");

            k.go("basement");
        } else {
            basementEntranceAttempts = (basementEntranceAttempts || 0) + 1;
            if (basementEntranceAttempts === 1) {
                startInteraction(k, entities.shopkeeper, entities.player, {
                    overrideDialogue: ["What do you think you're doing?"]
                });
            } else if (basementEntranceAttempts === 2) {
                startInteraction(k, entities.shopkeeper, entities.player, {
                    overrideDialogue: ["Get away from there!"]
                });
            } else if (basementEntranceAttempts === 3) {
                startInteraction(k, entities.shopkeeper, entities.player, {
                    overrideDialogue: ["You won't get down there without a key, honey."]
                });
            }
        }
    });

    healthBar(k);
    setupInventoryUI(k); // Initialize inventory UI

}

