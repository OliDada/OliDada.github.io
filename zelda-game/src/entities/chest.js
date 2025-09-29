import { giveItem } from "../utils.js";
import { dialog } from "../uiComponents/dialog.js";
import { healthBar } from "../uiComponents/healthbar.js";
import globalStateManager from "../state/globalState.js";

export function generateChestComponents(k, pos, contents, isOpen = false) {
    return [
        k.sprite('Sprite-0005', {
            anim: isOpen ? 'chest-opened' : 'chest-closed',
        }),
        k.area({ shape: new k.Rect(k.vec2(1, 0), 14, 10) }),
        k.body({ isStatic: true }),
        k.pos(pos),
        k.offscreen(),
        'chest',
        { isOpen, contents },
    ];
}

// When chest is opened:
function openChest(chest) {
    const key = `${Math.round(chest.pos.x)},${Math.round(chest.pos.y)}`;
    const gameState = globalStateManager().getInstance();
    gameState.setChestOpened(key);
}

export async function startChestInteraction(k, chest, player) {

    if (!chest.isOpen) {
        k.play('chest-open');
        chest.isOpen = true;
        chest.use(k.sprite('Sprite-0005', { anim: 'chest-opened' }));
        giveItem(k, player, chest.contents);

        // Save chest as opened in global state
        openChest(chest);

        // Destroy old health bar(s)
        k.get('heartsContainer').forEach(h => h.destroy());

        // Redraw health bar
        healthBar(k);

        // Show dialog with chest contents at a fixed screen position
        if (chest.contents === "tavern-supplies") {
            await dialog(
                k,
                k.vec2(250, 500),
                ["You found some tavern supplies!"],
            );
        } else {
            await dialog(
                k,
                k.vec2(250, 500),
                [`You found a ${chest.contents.replace("-", " ")}`],
            );
        }

    }
}