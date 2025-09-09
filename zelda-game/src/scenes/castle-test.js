import { setPlayerMovement, generatePlayerComponents } from "../entities/player.js";
import { generateChickenComponents, setChickenAI } from "../entities/chicken.js";
import { colorizeBackground, registerHealthPotionHandler, registerMuteHandler, fetchMapData, drawTiles, drawBoundaries, onAttacked, isPartiallyOnScreen } from "../utils.js";
import { healthBar } from "../uiComponents/healthbar.js";
import { gameState, chickenState } from "../state/stateManagers.js";

export default async function castleTest(k) {
    // Only load map, boundaries, player, and snap camera
    colorizeBackground(k, 8, 148, 236);
    const mapData = await fetchMapData("./assets/maps/castle-test.json");
    const map = k.add([k.pos(100, 100)]);
    let player = null;
    for (const layer of mapData.layers) {
        if (layer.name === "Boundaries") {
            drawBoundaries(k, map, layer);
            continue;
        }
        if (layer.name === "SpawnPoints") {
            for (const object of layer.objects) {
                if (object.name === "player") {
                    player = map.add(generatePlayerComponents(k, k.vec2(object.x, object.y)));
                    break;
                }
            }
        }
        if (layer.type === "tilelayer") {
            drawTiles(k, map, layer, mapData.tileheight, mapData.tilewidth, mapData.tilesets);
        }
    }
    k.setCamScale(4);
    if (player && typeof player.worldPos === "function") {
        k.setCamPos(player.worldPos());
    }
    k.onUpdate(() => {
        if (player && typeof player.worldPos === "function") {
            k.setCamPos(player.worldPos());
        }
    });
    setPlayerMovement(k, player);

     // Add FPS counter as a UI object
    k.add([
        k.text(`FPS: ${(1 / k.dt()).toFixed(1)}`, {
            size: 16,
            font: 'gameboy',
        }),
        k.pos(12, 12),
        k.fixed(),
        { layer: 'ui' },
        {
            update() {
                this.text = `FPS: ${(1 / k.dt()).toFixed(1)}`;
            },
        },
    ]);
}
