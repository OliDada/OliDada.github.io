import { playerState } from "./state/stateManagers.js";
import { healthBar } from "./uiComponents/healthbar.js";
import { useHealthPotion } from "./items/healthPotion.js";

export function playAnimIfNotPlaying(gameObj, animName) {
    if (gameObj.curAnim() !== animName) {
        gameObj.play(animName);
    }
}

export function areAnyOfTheseKeysDown(k, keys) {
    for (const key of keys) {
        if (k.isKeyDown(key)) {
            return true;
        }
    }
    return false;
}


export function colorizeBackground(k, r, g, b) {
    k.add([k.rect(k.width(), k.height()), k.color(r, g, b), k.fixed()]);
}

export async function fetchMapData(mapPath) {
    return await (await fetch(mapPath)).json();
}

export function drawTiles(k, map, layer, tileheight, tilewidth, tilesets) {
    let nbOfDrawnTiles = 0;
    const tilePos = k.vec2(0, 0);

    function getTilesetForTile(tileId) {
        let selected = null;
        for (const ts of tilesets) {
            if (tileId >= ts.firstgid) selected = ts;
        }
        return selected;
    }

    for (const tile of layer.data) {
        if (nbOfDrawnTiles % layer.width === 0) {
            tilePos.x = 0;
            tilePos.y += tileheight;
        } else {
            tilePos.x += tilewidth;
        }

        nbOfDrawnTiles++;
        if (tile === 0) continue;

        // Skip obviously invalid or corrupted tile IDs
        if (tile < 0 || tile > 10000) continue;

        const ts = getTilesetForTile(tile);
        if (!ts) continue;
        let spriteName;
        if (ts.image && ts.image.split('/').pop() === 'topdownasset.png') {
            // Use the loaded sprite name for topdownasset.png
            spriteName = 'sprites';
        } else if (ts.source) {
            spriteName = ts.source.split('/').pop().replace('.tsx', '');
        } else if (ts.name) {
            spriteName = ts.name;
        } else {
            // fallback: try image filename if present
            spriteName = ts.image ? ts.image.split('/').pop().replace('.png', '') : 'unknown';
        }
        const frame = tile - ts.firstgid;

        // Validate frame is within the tileset's frame count
        if (frame < 0 || (ts.tilecount && frame >= ts.tilecount)) continue;

        map.add([
            k.sprite(spriteName, { frame }),
            k.pos(tilePos),
            k.offscreen(),
        ]);
    }
}

export function generateColliderBoxComponents(k, width, height, pos, tag) {
    return [
        k.rect(width, height),
        k.pos(pos.x, pos.y + 16),
        k.area(),
        k.body({ isStatic: true }),
        k.opacity(0),
        k.offscreen(),
        tag,
    ];
}

export function drawBoundaries(k, map, layer, tag) {
    for (const object of layer.objects) {
        const { x, y, width, height } = object;
        map.add(
            generateColliderBoxComponents(
                k, 
                width, 
                height, 
                k.vec2(x, y), 
                object.name
            )
        );
    }
}

export async function knockback(k, entity, direction, force) {
        // Set velocity directly for reliable knockback
        entity.vel = k.vec2(direction.x * force, direction.y * force);

        await k.wait(0.12);
            entity.vel = k.vec2(0, 0);
}

export async function blinkEffect(k, entity, times = 1, interval = 0.08) {
    for (let i = 0; i < times; i++) {
        entity.color = k.rgb(255, 255, 255); // white
        await k.wait(interval);
        entity.color = k.rgb(255, 0, 0); // red
        await k.wait(interval * 2);
    }
    // Always reset to white (no tint) to avoid black bug
    entity.color = k.rgb(255, 255, 255);
}

export async function deathAnimation(k, entity, times = 3, interval = 0.12) {
    for (let i = 0; i < times; i++) {
        await k.wait(i * interval, () => {
            entity.opacity = 0.5;
            blinkEffect(k, entity, 1, interval / 2);
        });
        await k.wait(i * interval, () => {
            entity.opacity = 1;
        });
    }
}

export async function onAttacked(k, entity, getPlayer) {
    entity.onCollide("swordHitBox", async () => {
        if (entity.isAttacking) return;

        if (entity.hp() <= 0) {
            await deathAnimation(k, entity);
            k.destroy(entity);
            return;
        }

        // Get player direction
        const player = getPlayer();
        let dir = k.vec2(0, 0);
        switch (player.direction) {
            case "left":
                dir = k.vec2(-1, 0);
                break;
            case "right":
                dir = k.vec2(1, 0);
                break;
            case "up":
                dir = k.vec2(0, -1);
                break;
            case "down":
                dir = k.vec2(0, 1);
                break;
        }

        // Run blink and knockback in parallel
        blinkEffect(k, entity);
        knockback(k, entity, dir, 200);
        entity.hurt(getPlayer.attackPower);
    });
}

export function onCollideWithPlayer(k, entity) {
    entity.onCollide("player", async (player) => {
        if (player.isAttacking) return;

        playerState.setHealth(playerState.getHealth() - entity.attackPower);
        k.destroyAll("healthContainer");
        healthBar(k, player);
        k.play("player-hurt");
        await blinkEffect(k, player);
        if (playerState.getHealth() <= 0) {
            playerState.setHealth(playerState.getMaxHealth());
            k.go("world");
        }
    });
}

let isMuted = false;

export function registerMuteHandler(k) {
    k.onKeyPress("m", () => {
        if (isMuted) {
            k.setVolume(0.3);
            isMuted = false;
        } else {
            k.setVolume(0);
            isMuted = true;
        }
    });
}

export function registerHealthPotionHandler(k) {
    k.onKeyPress("h", () => {
        if (useHealthPotion(k)) {
            k.play && k.play("drink", { volume: 0.8 });
            k.destroyAll("heartsContainer");
            healthBar(k); // Make sure this redraws the health bar
        } else if (playerState.getHealth() === playerState.getMaxHealth() && playerState.getHasHadPotion() === true) {
            // Show "Health is already full!" message
            const msg = k.add([
                k.text("Health is already full!", { size: 24, font: "gameboy" }),
                k.anchor("center"),
                k.pos(k.width() / 2, (k.height() / 2) - 200),
                k.fixed(),
                "tempMessage"
            ]);
            k.wait(1, () => {
                k.destroy(msg);
            });
        } else if (playerState.getPotions() === 0 && playerState.getHasHadPotion() === true) {
            // Show "No potions left!" message
            const msg = k.add([
                k.text("You are out of potions!", { size: 24, font: "gameboy" }),
                k.anchor("center"),
                k.pos(k.width() / 2, (k.height() / 2) - 200),
                k.fixed(),
                "tempMessage"
            ]);
            k.wait(1, () => {
                k.destroy(msg);
            });
        }
    });
}

export function giveItem(k, player, item) {
    if (item === "health-potion") {
        playerState.addPotion(1);
        playerState.setHasHadPotion(true);
        k.destroyAll("heartsContainer");
        healthBar(k);
    }
    if (item === "basement-key") {
        playerState.addKey("basement-key");
        playerState.setHasBasementKey(true);
    }
    if (item === "prison-key") {
        playerState.addKey("prison-key");
        playerState.setHasPrisonKey(true);
    }
    // ...other items...
}

export function followPlayer(k, player, entity, distance = 16) {
    if (entity.isFollowing) return; // Prevent multiple handlers
    entity.isFollowing = true;
    entity.startFollowing = false;

    // Listen for the first movement key
    const movementKeys = ["left", "a", "right", "d", "up", "w", "down", "s"];
    let movementHandler;
    movementHandler = k.onKeyPress(movementKeys, () => {
        entity.startFollowing = true;
    });
    k.onUpdate(() => {
        if (!entity.exists() || !player.exists()) return;
        if (!entity.startFollowing) return; // Don't follow until player moves

        // Correct offset: always behind the player
        let offset = k.vec2(0, 0);
        switch (player.direction) {
            case "left":
                offset = k.vec2(distance, 0);
                break;
            case "right":
                offset = k.vec2(-distance, 0);
                break;
            case "up":
                offset = k.vec2(0, distance);
                break;
            case "down":
                offset = k.vec2(0, -distance);
                break;
            default:
                offset = k.vec2(0, distance);
        }
        entity.pos = entity.pos.lerp(player.pos.add(offset), 0.1);

        // Handle flipX for prisoner sprite
        entity.flipX = player.direction === "left";

        // Mirror animation
        if (player.curAnim && entity.curAnim && player.curAnim()) {
            const mappedAnim = prisonerAnimMap[player.curAnim()];
            if (entity.curAnim() !== mappedAnim) {
                entity.play(mappedAnim);
            }
        }
    });
}

const prisonerAnimMap = {
    "player-idle-down": "prisoner-idle-down",
    "player-down": "prisoner-down",
    "player-idle-side": "prisoner-idle-side",
    "player-side": "prisoner-side",
    "player-idle-up": "prisoner-idle-up",
    "player-up": "prisoner-up",
};

export async function slideCamY(k, range, duration) {
    const currentCamPos = k.camPos();
    await k.tween(
        currentCamPos.y,
        currentCamPos.y + range,
        duration, 
        (newPosY) => k.camPos(currentCamPos.x, newPosY),
        k.easings.linear,
    );
}