import {
    colorizeBackground,
    drawBoundaries,
    drawTiles,
    fetchMapData,
    registerMuteHandler,
    registerHealthPotionHandler,
} from '../utils.js';
import {
    generatePlayerComponents,
    setPlayerMovement,
} from '../entities/player.js';
import { generateWitchComponents } from '../entities/witch.js';
import { healthBar } from '../uiComponents/healthbar.js';
import {
    playerState,
} from '../state/stateManagers.js';
import { generateChestComponents, startChestInteraction } from '../entities/chest.js';
import globalStateManager from "../state/globalState.js";

const gameState = globalStateManager().getInstance();

export default async function witchHouseInside(k) {

    registerHealthPotionHandler(k);
    registerMuteHandler(k);
    const previousScene = gameState.getPreviousScene();

    colorizeBackground(k, 27, 29, 52);

    const mapData = await fetchMapData('./assets/maps/witch-house-inside.json');
    const map = k.add([k.pos(-380, -392)]);

    const entities = {
        player: null,
        chests: [],
        witch: null,
    };

    for (const layer of mapData.layers) {
        if (layer.name === 'Boundaries') {
            drawBoundaries(k, map, layer);
            continue;
        }


        if (layer.name === 'SpawnPoints') {
            for (const object of layer.objects) {
                if (object.name === "player" && !entities.player && previousScene !== "witch-house-inside") {
                    entities.player = map.add(generatePlayerComponents(k, k.vec2(object.x, object.y)));
                    continue;
                }

                if (object.name === "witch" && !entities.witch) {
                    entities.witch = map.add(generateWitchComponents(k, k.vec2(object.x, object.y)));
                    continue;
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

   

    // Chest interaction
    entities.player.onCollide("chest", (chest) => {
        startChestInteraction(k, chest, entities.player);
    });


    entities.player.onCollide('witch-house-inside-exit', () => {
        
        gameState.setPreviousScene('witch-house-inside');
        k.go('witch-house');
    });


    k.setCamScale(4);
    k.setCamPos(entities.player.worldPos());

    // Camera follow after transition
    k.onUpdate(() => {
        const camPos = k.getCamPos();
        const playerPos = entities.player.worldPos();
        const newPos = camPos.lerp(playerPos, 0.1);
        k.setCamPos(newPos);
    });

    setPlayerMovement(k, entities.player);
    healthBar(k);

}
