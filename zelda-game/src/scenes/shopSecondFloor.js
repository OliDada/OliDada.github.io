import { colorizeBackground, drawBoundaries, drawTiles, fetchMapData, registerMuteHandler, registerHealthPotionHandler } from "../utils.js"
import { generatePlayerComponents, setPlayerMovement } from "../entities/player.js";
import { generateShopkeeperComponents } from "../entities/shopkeeper.js";
import { healthBar } from "../uiComponents/healthbar.js";
import { gameState, playerState } from "../state/stateManagers.js";
import { startInteraction } from "../entities/shopkeeper.js";

export default async function shopSecondFloor(k) {

    registerHealthPotionHandler(k);
    registerMuteHandler(k);
    const previousScene = gameState.getPreviousScene();

    colorizeBackground(k, 27, 29, 52);

    const mapData = await fetchMapData("./assets/maps/shop-second-floor.json");

    const map = k.add([k.pos(-240, -372)]);

    const entities = {
        player: null,
    };

    const layers = mapData.layers;
    for (const layer of layers) {
        if (layer.name === "Boundaries") {
            drawBoundaries(k, map, layer);
            continue;
        }

        if (layer.name === "SpawnPoints") {
            
            for (const object of layer.objects) {
                
                if (object.name === "player" && !entities.player && previousScene !== "basement") {
                    entities.player = map.add(generatePlayerComponents(k, k.vec2(object.x, object.y)));
                    continue;
                } 
            }
        }

        // Only draw tile layers
        if (layer.type === "tilelayer") {
            drawTiles(k, map, layer, mapData.tileheight, mapData.tilewidth, mapData.tilesets);
        }
        
    }

    k.setCamScale(4);
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

    entities.player.onCollide("shop", () => {
        gameState.setPreviousScene("shop-second-floor");
        k.go("shop");
    });

    healthBar(k);
}

