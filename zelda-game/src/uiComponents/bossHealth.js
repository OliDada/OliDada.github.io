export function addBossHealthBar(k, boss) {
    const healthBar = addHealthBar(k, boss);
    boss.on("healthChange", (newHealth) => {
        healthBar.setHealth(newHealth);
    });
    return healthBar;
}

function addHealthBar(k, boss) {
    const barWidth = 400;
    const barHeight = 20;
    const borderThickness = 2;

    const healthBarContainer = k.add([
        k.pos(k.width() / 2 - barWidth / 2, 20),
        k.fixed(),
        "bossHealthBarContainer",
    ]);

    // Background
    healthBarContainer.add([
        k.rect(barWidth + borderThickness * 2, barHeight + borderThickness * 2),
        k.color(255, 225, 165),
        k.pos(-borderThickness, -borderThickness),
    ]);

    // Foreground (health bar)
    const healthBar = healthBarContainer.add([
        k.rect(barWidth, barHeight),
        k.color(181, 84, 123),
        k.pos(0, 0),
    ]);

    // Store max health ONCE
    const maxHealth = boss.hp();

    function setHealth(newHealth) {
        const healthRatio = Math.max(0, Math.min(newHealth / maxHealth, 1));
        healthBar.width = barWidth * healthRatio;
    }

    // Initialize with full health
    setHealth(maxHealth);

    return {
        setHealth,
        destroy() {
            healthBarContainer.destroy();
        },
    };
}