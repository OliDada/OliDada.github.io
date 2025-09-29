import { gameState, playerState } from "../state/stateManagers.js";
import { dialog } from "./dialog.js";

const INVENTORY_X = 24;
const INVENTORY_Y = 160;

let inventoryContainer = null;

export function setupInventoryUI(k) {
    let isOpen = false;

    k.onKeyPress("i", () => {
        if (isOpen) {
            gameState.setFreezePlayer(false);
            if (inventoryContainer) k.destroy(inventoryContainer);
            inventoryContainer = null;
            isOpen = false;
        } else {
            gameState.setFreezePlayer(true);
            inventoryContainer = showInventory(k);
            isOpen = true;
        }
    });
}

// Custom info text for each item
function getItemInfo(key) {
    switch (key) {
        case "healthPotion":
            return "Restores your health. You can use them by pressing 'H'.";
        case "basement-key":
            return "It's a key to a basement.";
        case "prison-key":
            return "It's a key to a prison cell.";
        // Add more key types as needed
        case "carrot":
            return "A crunchy carrot. Maybe someone would want this?";
        case "magicalBeans":
            return [
                "The beans seem to shimmer with a faint light. You should find a way to plant them."
            ];
        case "tavernSupplies":
            return "It's a barrel full of drinks. They were probably meant for a tavern.";
        case "crown":
            return "The princess's royal crown. Somebody must want this!";
        default:
            // For unknown keys, show a generic message
            if (key.endsWith("key")) return "A mysterious key. It must open something!";
            return "No info available.";
    }
}

function showInventory(k) {
    const keys = playerState.getKeys();
    const items = [
        { key: "healthPotion", label: "Potion", sprite: "health-potion", has: playerState.getPotions() > 0 },
        // Add each key as a separate item
        ...keys.map(keyName => ({
            key: keyName,
            label: keyName.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase()), // e.g. "basement-key" -> "Basement Key"
            sprite: "key",
            has: true
        })),
        { key: "carrot", label: "Carrot", sprite: "carrot", has: playerState.getHasCarrot() },
        { key: "magicalBeans", label: "Beans", sprite: "magical-beans", has: playerState.getHasMagicalBeans() },
        { key: "tavernSupplies", label: "Supplies", sprite: "tavern-supplies", has: playerState.getHasTavernSupplies() },
        { key: "crown", label: "Crown", sprite: "crown", has: playerState.getHasCrown() },
    ].filter(item => item.has);

    if (items.length === 0) {
        const width = 380;
        const height = 180;
        const container = k.add([
            k.pos(INVENTORY_X, INVENTORY_Y),
            k.fixed(),
            "inventoryContainer",
            k.z(200),
            { opacity: 0 },
        ]);

        // Shadow
        container.add([
            k.rect(width, height, { radius: 8 }),
            k.color(27, 29, 52),
            k.opacity(0.35),
            k.pos(6, 6),
            k.z(198),
        ]);
        // Box
        container.add([
            k.rect(width, height, { radius: 8 }),
            k.color(27, 29, 52),
            k.opacity(0.96),
            k.outline(6, k.rgb(255, 255, 255)),
            k.pos(0, 0),
            k.z(199),
        ]);
        // Title
        container.add([
            k.text("INVENTORY", { font: "gameboy", size: 28 }),
            k.color(255, 255, 255),
            k.pos(width / 6, 16),
            k.z(201),
        ]);
        // Empty message
        container.add([
            k.text("Your inventory\n    is empty!", { font: "gameboy", size: 20 }),
            k.color(180, 180, 180),
            k.pos(60, height / 2),
            k.z(202),
        ]);

        // Fade in effect
        let fade = 0;
        const updateHandler = k.onUpdate(() => {
            if (container.exists() && fade < 1) {
                fade += 0.1;
                container.opacity = Math.min(fade, 1);
            }
        });
        container.onDestroy(() => updateHandler.cancel());

        return container;
    }

    const width = 380;
    const spacing = 72;
    const height = Math.max(100, items.length * 64 + 110);

    const container = k.add([
        k.pos(INVENTORY_X, INVENTORY_Y),
        k.fixed(),
        "inventoryContainer",
        k.z(200),
        { opacity: 0 },
    ]);

    // Shadow for depth
    container.add([
        k.rect(width, height, { radius: 8 }),
        k.color(27, 29, 52),
        k.opacity(0.35),
        k.pos(6, 6),
        k.z(198),
    ]);

    // Black box with thick white border
    container.add([
        k.rect(width, height, { radius: 8 }),
        k.color(27, 29, 52),
        k.opacity(0.96),
        k.outline(6, k.rgb(255, 255, 255)),
        k.pos(0, 0),
        k.z(199),
    ]);

    // Title with bold font and centered
    container.add([
        k.text("INVENTORY", { font: "gameboy", size: 28 }),
        k.color(255, 255, 255),
        k.pos(width / 3 - 80, 16),
        k.z(201),
    ]);

    // Draw each item
    items.forEach((item, i) => {
        // Item icon
        container.add([
            k.sprite(item.sprite),
            k.pos(28, 54 + i * spacing),
            k.scale(1.3),
            k.z(203),
        ]);
        // Item label
        container.add([
            k.text(item.label, { font: "gameboy", size: 22 }),
            k.color(255, 255, 255),
            k.pos(120, 68 + i * spacing),
            k.z(203),
        ]);
    });

    // Selection highlight (keyboard only)
    let selected = 0;
    const highlight = container.add([
        k.rect(width - 24, 70, { radius: 8 }),
        k.pos(12, 48 + selected * spacing),
        k.color(255, 255, 255),
        k.opacity(0.18),
        k.z(210),
        "inventoryHighlight",
    ]);

    function updateHighlight() {
        highlight.pos = k.vec2(12, 48 + selected * spacing);
    }

    // Info dialog management
    let cancelInfoDialog = null;

    async function showInfoDialog() {
        if (cancelInfoDialog) {
            cancelInfoDialog();
            cancelInfoDialog = null;
        }
        const key = items[selected].key;
        let infoText = getItemInfo(key);

        if (!infoText) infoText = [`Info about ${items[selected].label}`];
        if (typeof infoText === "string") infoText = [infoText];

        let dialogClosed = false;
        cancelInfoDialog = () => {
            if (!dialogClosed) {
                dialogClosed = true;
                k.get("dialogBox").forEach(box => k.destroy(box));
            }
        };

        await dialog(
            k,
            [INVENTORY_X + 420, INVENTORY_Y + 320],
            infoText,
            { speed: 0, tag: "dialogBox" }
        );
        dialogClosed = true;
        cancelInfoDialog = null;
        gameState.setFreezePlayer(true);
    }

    // Keyboard navigation handlers
    const downHandler = k.onKeyPress(["down", "s"], () => {
        if (selected < items.length - 1) {
            selected++;
            updateHighlight();
            if (cancelInfoDialog) cancelInfoDialog();
        }
    });
    const upHandler = k.onKeyPress(["up", "w"], () => {
        if (selected > 0) {
            selected--;
            updateHighlight();
            if (cancelInfoDialog) cancelInfoDialog();
        }
    });
    const infoHandler = k.onKeyPress("e", async () => {
        await showInfoDialog();
    });

    // Fade in effect
    let fade = 0;
    const updateHandler = k.onUpdate(() => {
        if (container.exists() && fade < 1) {
            fade += 0.1;
            container.opacity = Math.min(fade, 1);
        }
    });

    // Clean up handlers when inventory is closed
    container.onDestroy(() => {
        downHandler.cancel();
        upHandler.cancel();
        infoHandler.cancel();
        updateHandler.cancel();
        if (cancelInfoDialog) cancelInfoDialog();
    });

    return container;
}