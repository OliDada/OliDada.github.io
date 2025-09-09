import { playerState } from "../state/stateManagers.js";

export function healthBar(k) {
    let nbOfFullHearts = Math.floor(playerState.getHealth());
    let addHalfHeart = false;
    let nbOfPotions = playerState.getPotions();
    let nbOfKeys = playerState.getKeys().length;
    let hasSword = playerState.getIsSwordEquipped();
    let hasHadPotion = playerState.getHasHadPotion();
    let hasHadKey = playerState.getHasBasementKey();
    let hasCarrot = playerState.getHasCarrot();
    let hasMagicalBeans = playerState.getHasMagicalBeans();

    let previousX = 0;

    const heartsContainer = k.add([
        k.pos(20, 20),
        k.fixed(),
        "heartsContainer",
    ]);

    // Draw hearts
    for (let i = 0; i < nbOfFullHearts; i++) {
        heartsContainer.add([k.sprite("full-heart"), k.pos(previousX, 0)]);
        previousX += 48;
    }

    if (playerState.getHealth() - nbOfFullHearts === 0.5) {
        addHalfHeart = true;
        heartsContainer.add([k.sprite("half-heart"), k.pos(previousX, 0)]);
        previousX += 48;
    }

    let nbOfEmptyHearts =
        playerState.getMaxHealth() - nbOfFullHearts - (addHalfHeart ? 1 : 0);

    for (let i = 0; i < nbOfEmptyHearts; i++) {
        heartsContainer.add([k.sprite("empty-heart"), k.pos(previousX, 0)]);
        previousX += 48;
    }

    // Draw sword below the first heart
    if (hasSword === true) {
        heartsContainer.add([k.sprite("sword-icon"), k.pos(0, 48)]);
    }

    // Always display potion icon and count if player has ever had a potion
    if (hasHadPotion === true) {
        heartsContainer.add([
            k.sprite("health-potion"),
            k.pos(previousX + 24, 0)
        ]);
        heartsContainer.add([
            k.text(`x${nbOfPotions}`, { font: "gameboy", size: 24 }),
            k.pos(previousX + 76, 16)
        ]);
        previousX += 98; // Move past potion icon and count for next icon
    }

    // Always display key icon and count if player has ever had a key
    if (hasHadKey === true) {
        heartsContainer.add([
            k.sprite("key"),
            k.pos(previousX + 24, 0)
        ]);
        heartsContainer.add([
            k.text(`x${nbOfKeys}`, { font: "gameboy", size: 24 }),
            k.pos(previousX + 76, 16)
        ]);
        previousX += 98; // Uncomment if you want to add more icons after keys
    }

    if (hasCarrot === true) {
        heartsContainer.add([
            k.sprite("carrot"),
            k.pos(previousX + 24, 0)
        ]);
    }

    if (hasMagicalBeans === true) {
        heartsContainer.add([
            k.sprite("magical-beans"),
            k.pos(previousX + 24, 0)
        ]);
    }

    return heartsContainer;
}