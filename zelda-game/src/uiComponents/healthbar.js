import { playerState } from "../state/stateManagers.js";

export function healthBar(k) {
    let nbOfFullHearts = Math.floor(playerState.getHealth());
    let addHalfHeart = false;
    let nbOfPotions = playerState.getPotions();
    let keysArr = playerState.getKeys();
    let nbOfKeys = keysArr.length;
    let hasSword = playerState.getIsSwordEquipped();
    let hasHadPotion = playerState.getHasHadPotion();
    let hasHadKey = playerState.getBasementKey ? playerState.getBasementKey() : playerState.getHasBasementKey();
    let hasCarrot = playerState.getCarrot ? playerState.getCarrot() : playerState.getHasCarrot();
    let hasMagicalBeans = playerState.getMagicalBeans ? playerState.getMagicalBeans() : playerState.getHasMagicalBeans();
    let hasTavernSupplies = playerState.getTavernSupplies ? playerState.getTavernSupplies() : playerState.getHasTavernSupplies();
    let hasCrown = playerState.getCrown ? playerState.getCrown() : playerState.getHasCrown();

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

    // Only display key icon and count if player actually has keys
    if (nbOfKeys > 0) {
        heartsContainer.add([
            k.sprite("key"),
            k.pos(previousX + 24, 0)
        ]);
        heartsContainer.add([
            k.text(`x${nbOfKeys}`, { font: "gameboy", size: 24 }),
            k.pos(previousX + 76, 16)
        ]);
        previousX += 98;
    }

    // if (hasCarrot === true) {
    //     heartsContainer.add([
    //         k.sprite("carrot"),
    //         k.pos(previousX + 24, 0)
    //     ]);
    //     previousX += 48;
    // }

    // if (hasMagicalBeans === true) {
    //     heartsContainer.add([
    //         k.sprite("magical-beans"),
    //         k.pos(previousX + 24, 0)
    //     ]);
    //     previousX += 48;
    // }

    // if (hasTavernSupplies === true) {
    //     heartsContainer.add([
    //         k.sprite("tavern-supplies"),
    //         k.pos(previousX + 24, 0)
    //     ]);
    //     previousX += 48;
    // }

    // if (hasCrown === true) {
    //     heartsContainer.add([
    //         k.sprite("crown"),
    //         k.pos(previousX + 24, 0)
    //     ]);
    //     previousX += 48;
    // }

    return heartsContainer;
}