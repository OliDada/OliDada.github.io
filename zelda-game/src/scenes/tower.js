import { colorizeBackground, drawBoundaries, drawTiles, fetchMapData, registerMuteHandler, registerHealthPotionHandler } from "../utils.js"
import { generatePlayerComponents, setPlayerMovement } from "../entities/player.js";
import { generateWizardComponents } from "../entities/wizard.js";
import { healthBar } from "../uiComponents/healthbar.js";
import { gameState, playerState } from "../state/stateManagers.js";
import { startInteraction } from "../entities/wizard.js";

export default async function tower(k) {
    registerHealthPotionHandler(k);
    registerMuteHandler(k);
    const previousScene = gameState.getPreviousScene();
    console.log("Previous scene:", previousScene);

    colorizeBackground(k, 27, 29, 52);

    const mapData = await fetchMapData("./assets/maps/tower.json");

    const map = k.add([k.pos(-240, -372)]);

    const entities = {
        player: null,
        wizard: [],
    };

    const layers = mapData.layers;
    for (const layer of layers) {
        if (layer.name === "Boundaries") {
            drawBoundaries(k, map, layer);
            continue;
        }

        if (layer.name === "SpawnPointsTowerSecondFloor") {
            for (const object of layer.objects) {
                if (
                    object.name === "tower-second-floor" &&
                    !entities.player && previousScene === "tower-second-floor"
                ) {
                    entities.player = map.add(generatePlayerComponents(k, k.vec2(object.x, object.y)));
                    continue;
                }
            }
        }


        if (layer.name === "SpawnPoints") {
            
            for (const object of layer.objects) {

                if (object.name === "player" && !entities.player && previousScene !== "tower-second-floor") {
                    entities.player = map.add(generatePlayerComponents(k, k.vec2(object.x, object.y)));
                    continue;
                } 
                if (object.name === "wizard") {
                    entities.wizard = map.add(generateWizardComponents(k, k.vec2(object.x, object.y)));
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

    entities.player.onCollide("tower-exit", () => {
        gameState.setPreviousScene("tower");
        k.go("world");
    });

    entities.player.onCollide("tower-second-floor", () => {
        gameState.setPreviousScene("tower");
        k.go("tower-second-floor");
    });

    entities.player.onCollide("wizard", () => {
            startInteraction(k, entities.wizard, entities.player);
        });


    healthBar(k);

}

