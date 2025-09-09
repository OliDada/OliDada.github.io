import { setPlayerMovement, generatePlayerComponents } from "../entities/player.js";
import { colorizeBackground, registerHealthPotionHandler, registerMuteHandler, fetchMapData, drawTiles, drawBoundaries, onAttacked, isPartiallyOnScreen } from "../utils.js";
import { healthBar } from "../uiComponents/healthbar.js";
import { gameState } from "../state/stateManagers.js";


export default async function witchHouse(k) {

    const previousScene = gameState.getPreviousScene();

    console.log("previousScene:", previousScene);

    registerHealthPotionHandler(k);
    registerMuteHandler(k);
    colorizeBackground(k, 8, 148, 236);

    const mapData = await fetchMapData("./assets/maps/witch-house.json");
    const map = k.add([k.pos(100, 100)]);

    const entities = {
        player: null,
        gingerbread: [],
        chests: [],
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
                if (object.name === "player" && !entities.player && previousScene !== "witch-house-inside") {
                    entities.player = map.add(generatePlayerComponents(k, k.vec2(object.x, object.y)));
                    continue;
                }

                if (object.name === "player-witch-house-inside" && !entities.player && previousScene === "witch-house-inside") {
                    entities.player = map.add(generatePlayerComponents(k, k.vec2(object.x, object.y)));
                }
            }
            continue;
        }

        // Only draw tile layers
        if (layer.type === "tilelayer") {
            drawTiles(k, map, layer, mapData.tileheight, mapData.tilewidth, mapData.tilesets);
        }
    }


    entities.player.onCollide("witch-house-exit", () => {
        gameState.setPreviousScene("witch-house");
        k.go("forest");
    });

    entities.player.onCollide("witch-house-inside-entrance", () => {

        gameState.setPreviousScene("witch-house");
        k.go("witch-house-inside");
    });
    // Set camera to follow player
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


}