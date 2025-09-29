import { setPlayerMovement, generatePlayerComponents } from "../entities/player.js";
import { generateSlimeComponents } from "../entities/slime.js";
import { generateGuardComponents } from "../entities/guard.js";
import { colorizeBackground, registerHealthPotionHandler, registerMuteHandler, fetchMapData, drawTiles, drawBoundaries } from "../utils.js";
import { startInteraction } from "../entities/guard.js";
import { healthBar } from "../uiComponents/healthbar.js";
import { gameState } from "../state/stateManagers.js";
import { generateKingComponents } from "../entities/king.js";
import { setupInventoryUI } from "../uiComponents/inventory.js";

export default async function castle(k) {
    registerHealthPotionHandler(k);
    registerMuteHandler(k);
    colorizeBackground(k, 27, 29, 52);

    const mapData = await fetchMapData("./assets/maps/throne-room.json");
    const map = k.add([k.pos(100, 100)]);

    const entities = {
        player: null,
        king: null,
        slimes: [],
        chests: [],
        guards: [],
    };

    const layers = mapData.layers;

    console.log("Map layers:", layers);

    // Handle object layers and entity spawning
    for (const layer of layers) {
        if (layer.name === "Boundaries") {
            drawBoundaries(k, map, layer);
            continue;
        }

        

        if (layer.name === "SpawnPoints") {
            for (const object of layer.objects) {
                if (object.name === "player" && !entities.player) {
                    entities.player = map.add(generatePlayerComponents(k, k.vec2(object.x, object.y)));
                    continue;
                }
                if (object.name === "slime") {
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

                if (object.name === "guard-1") {
                    entities.guards.push(
                        map.add(
                            generateGuardComponents(
                                k,
                                k.vec2(object.x, object.y),
                                "guard-1-idle-down"
                            )
                        )
                    );
                    continue;
                }

                if (object.name === "guard-2") {
                    entities.guards.push(
                        map.add(
                            generateGuardComponents(
                                k,
                                k.vec2(object.x, object.y),
                                "guard-2-idle-down"
                            )
                        )
                    );
                    continue;
                }

                if (object.name === "guard-3") {
                    const guard3 = map.add(
                        generateGuardComponents(
                            k,
                            k.vec2(object.x, object.y),
                            "guard-3-down",
                            "guard-3"
                        )
                    );
                    entities.guards.push(guard3);

                    const startY = object.y;
                    const endY = startY - 300;
                    let direction = -1;
                    let currentAnim = "guard-3-down";
                    
                    k.loop(0.3, () => {
                        k.wait(Math.random(0.5, 1.5));
                        if (guard3.pos.y <= endY) {
                            direction = 1;
                            if (currentAnim !== "guard-3-down") {
                                guard3.play("guard-3-down");
                                currentAnim = "guard-3-down";
                            }
                        }
                        if (guard3.pos.y >= startY) {
                            direction = -1;
                            if (currentAnim !== "guard-3-up") {
                                guard3.play("guard-3-up");
                                currentAnim = "guard-3-up";
                            }
                        }
                        guard3.move(0, 40 * direction);
                    });
                }

                if (object.name === "king") {
                    entities.king = map.add(
                        generateKingComponents(
                            k,
                            k.vec2(object.x, object.y),
                            "king-sitting-down",
                            "king"
                        )
                    );
                }
            }
            continue;
        }
        // Only draw tile layers
        if (layer.type === "tilelayer") {
            drawTiles(k, map, layer, mapData.tileheight, mapData.tilewidth, mapData.tilesets);
        }
    }

    entities.player.onCollide("guard-1", (guard) => {
        startInteraction(k, guard, entities.player, 0); // 0 for guard-1
    });

    entities.player.onCollide("guard-2", (guard) => {
        startInteraction(k, guard, entities.player, 1); // 1 for guard-2
    });

    entities.player.onCollide("guard-3", (guard) => {
        startInteraction(k, guard, entities.player, 2); // 2 for guard-3
    });

    entities.player.onCollide("throne-room-exit", () => {
        gameState.setPreviousScene("throne-room");
        k.go("castle-main");
    });

    // Set camera to follow player
    k.setCamScale(4); // Changed from 0.1 to 4 for typical pixel art scale
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

    setPlayerMovement(k, entities.player);
    healthBar(k);

    setupInventoryUI(k);
}