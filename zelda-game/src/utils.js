import { playerState, cowState } from "./state/stateManagers.js";
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

// Store animated tile sprites and their animation state
export const animatedTileSprites = [];

export function drawTiles(k, map, layer, tileheight, tilewidth, tilesets, zIndex = 0) {
    // Always push animated tiles to animatedTileSprites for every scene.

    const FLIPPED_HORIZONTALLY_FLAG = 0x80000000;
    const FLIPPED_VERTICALLY_FLAG   = 0x40000000;
    const FLIPPED_DIAGONALLY_FLAG   = 0x20000000;
    const TILE_ID_MASK = ~(FLIPPED_HORIZONTALLY_FLAG | FLIPPED_VERTICALLY_FLAG | FLIPPED_DIAGONALLY_FLAG);

    for (let y = 0; y < layer.height; y++) {
        for (let x = 0; x < layer.width; x++) {
            const flippedY = layer.height - 1 - y;
            const rawTileIndex = layer.data[y * layer.width + x];
            const tileIndex = rawTileIndex & TILE_ID_MASK;
            if (!tileIndex || tileIndex < 0) continue;

            // Find the correct tileset for this tile (highest firstgid <= tileIndex)
            let tileset = null;
            let localTileId = null;
            for (const ts of tilesets) {
                if (tileIndex >= ts.firstgid) {
                    tileset = ts;
                    localTileId = tileIndex - ts.firstgid;
                }
            }
            if (!tileset || !tileset.name) {
                console.warn("Tileset missing or has no name for tileIndex:", tileIndex, tileset);
                continue;
            }

            // Add this check:
            if (
                localTileId < 0 ||
                (tileset.tilecount && localTileId >= tileset.tilecount)
            ) {
                console.warn(
                    `Invalid localTileId: ${localTileId} for tileset ${tileset.name} (tileIndex: ${tileIndex})`
                );
                continue;
            }

            const tileDef = tileset.tiles?.find(t => t.id === localTileId);

            if (tileDef && tileDef.animation) {
                const animFrames = tileDef.animation.map(a => a.tileid + tileset.firstgid);
                const animDurations = tileDef.animation.map(a => a.duration);

                // Filter out invalid frames
                const validAnimFrames = animFrames.filter(f =>
                    f >= tileset.firstgid &&
                    (!tileset.tilecount || f < tileset.firstgid + tileset.tilecount)
                );
                if (validAnimFrames.length === 0) {
                    console.warn(`No valid animation frames for tile ${localTileId} in tileset ${tileset.name}`);
                    continue;
                }

                const sprite = map.add([
                    k.sprite(tileset.name, { frame: tileDef.animation[0].tileid }), // Always use local frame index for animated tiles
                    k.pos(x * tilewidth, y * tileheight),
                    k.z(zIndex),
                    {
                        animFrames: tileDef.animation.map(a => a.tileid), // Store local frame indices
                        animDurations,
                        animTime: 0,
                        animIndex: 0,
                        isAnimatedTile: true,
                    }
                ]);
                animatedTileSprites.push(sprite);
            } else {
                map.add([
                    k.sprite(tileset.name, { frame: localTileId }),
                    k.pos(x * tilewidth, y * tileheight),
                    k.z(zIndex)
                ]);
            }
        }
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

        let pos;
        if (object.gid) {
            // Tile object: y is the bottom of the tile
            pos = k.vec2(x, y);
        } else {
            // Rectangle object: y is the top of the rectangle
            pos = k.vec2(x, y - 16);
        }

        map.add(
            generateColliderBoxComponents(
                k,
                width,
                height,
                pos,
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

export async function onAttacked(k, entity, getPlayer, options = {}) {
    entity.onCollide("swordHitBox", async () => {
        if (entity.isAttacking || entity.isDead) return;

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

        // Hurt the entity and check health immediately after
        entity.hurt(getPlayer.attackPower);
        const hp = entity.hp && entity.hp();

        // Call onHurt callback if provided
        if (options.onHurt) {
            await options.onHurt(entity);
        }

        // Prevent death if preventDeath returns true
        if (options.preventDeath && options.preventDeath(entity)) {
            // Optionally, set hp to 1 if it dropped below
            if (entity.hp && entity.hp() < 1) entity.setHP && entity.setHP(1);
            return;
        }

        // If health is now 0 or less, trigger death animation and destroy
        if (hp <= 0) {
            entity.isDead = true;
            if (entity.stop) entity.stop();
            if (k.play) k.play("player-hurt", { volume: 0.7 });
            if (entity.color) {
                entity.color = k.rgb(255, 0, 80);
                await new Promise((resolve) => setTimeout(resolve, 80));
            }
            if (entity.scale && entity.opacity) {
                k.tween(entity.scale, 0.2, 0.3, (v) => { entity.scale = v; });
                k.tween(entity.opacity, 0, 0.3, (v) => { entity.opacity = v; });
                await new Promise((resolve) => setTimeout(resolve, 300));
            } else if (entity.opacity) {
                k.tween(entity.opacity, 0, 0.3, (v) => { entity.opacity = v; });
                await new Promise((resolve) => setTimeout(resolve, 300));
            }
            k.destroy(entity);
            return;
        }
    });
}

export function onCollideWithPlayer(k, entity) {
    entity.onCollide("player", async (player) => {
        if (entity.isDead) return;
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
    k.onKeyPress("p", () => {
        if (isMuted) {
            k.setVolume(0.3);
            isMuted = false;
        } else {
            k.setVolume(0);
            isMuted = true;
        }
    });
}

export function openWorldMap(k, getPlayerPos = null) {
    k.onKeyPress("m", () => {
        const pos = typeof getPlayerPos === "function" ? getPlayerPos() : getPlayerPos;
        k.go("world-map", pos);
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
    if (item === "tavern-supplies") {
        playerState.setHasTavernSupplies(true);
        k.destroyAll("heartsContainer");
        healthBar(k);
    }
    // ...other items...
}

export function followPlayer(k, player, entity, distance = 16) {
    let animMap = null;
    if (entity.name === "prisoner") {
        animMap = {
            "player-idle-down": "prisoner-idle-down",
            "player-down": "prisoner-down",
            "player-idle-side": "prisoner-idle-side",
            "player-side": "prisoner-side",
            "player-idle-up": "prisoner-idle-up",
            "player-up": "prisoner-up",
        };
    } else if (entity.name === "cow") {
        animMap = {
            "player-idle-down": "cow-idle-down",
            "player-down": "cow-down",
            "player-idle-side": "cow-idle-side",
            "player-side": "cow-side",
            "player-idle-up": "cow-idle-up",
            "player-up": "cow-up",
        };
    }
    if (entity.isFollowing) return; // Prevent multiple handlers
    entity.isFollowing = true;
    entity.startFollowing = false;

    // Listen for the first movement key
    const movementKeys = ["left", "a", "right", "d", "up", "w", "down", "s"];
    let movementHandler;
    movementHandler = k.onKeyPress(movementKeys, () => {
        entity.startFollowing = true;
    });
    let updateRef = k.onUpdate(() => {
        if (!entity.exists() || !player.exists()) return;
        if (!entity.startFollowing) return; // Don't follow until player moves

        // For cow, stop following if quest is complete or isFollowingPlayer is false
        if (entity.name === "cow") {
            if (cowState.getCowQuestComplete() || !cowState.getIsFollowingPlayer()) {
                entity.isFollowing = false;
                entity.startFollowing = false;
                entity.use(k.body({ isStatic: true }));
                playAnimIfNotPlaying(entity, "cow-idle-down");
                if (updateRef && updateRef.cancel) updateRef.cancel();
                return;
            }
        }

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

        // Handle flipX for cow and prisoner sprite
        if (entity.name === "cow" || entity.name === "prisoner") {
            entity.flipX = player.direction === "right";
        } else {
            entity.flipX = player.direction === "left";
        }

        // Mirror animation
        if (player.curAnim && entity.curAnim && player.curAnim() && animMap) {
            const mappedAnim = animMap[player.curAnim()];
            if (mappedAnim && entity.curAnim() !== mappedAnim) {
                entity.play(mappedAnim);
            }
        }
    });
}



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

export function isPartiallyOnScreen(k, obj) {
    // Get camera info
    const cam = k.getCamPos();
    const scale = 4; // hardcoded from world.js
    const screenW = 1280;
    const screenH = 720;
    // Camera shows a region centered at cam, scaled
    const viewW = screenW / scale;
    const viewH = screenH / scale;
    const left = cam.x - viewW / 2;
    const right = cam.x + viewW / 2;
    const top = cam.y - viewH / 2;
    const bottom = cam.y + viewH / 2;
    // Get object's bounding box (assume area shape is Rect)
    const pos = obj.worldPos ? obj.worldPos() : obj.pos;
    const area = obj.area ? obj.area : null;
    let objLeft = pos.x, objRight = pos.x, objTop = pos.y, objBottom = pos.y;
    if (area && area.shape && area.shape.w && area.shape.h) {
        objLeft = pos.x;
        objRight = pos.x + area.shape.w;
        objTop = pos.y;
        objBottom = pos.y + area.shape.h;
    }
    // Check for any overlap
    return (
        objLeft < right &&
        objRight > left &&
        objTop < bottom &&
        objBottom > top
    );
}

export async function loadTilesets(mapTilesets, basePath = "./assets/") {
    const merged = [];
    for (const ts of mapTilesets) {
        if (ts.source && ts.source.trim() !== "") {
            // Convert .tsx to .tsj if needed
            let url = ts.source.replace(/\\/g, "/");
            if (url.endsWith(".tsx")) url = url.replace(".tsx", ".tsj");
            // Remove leading ../
            url = url.replace(/^(\.\.\/)+/, "");
            const resp = await fetch(basePath + url);
            const data = await resp.json();
            merged.push({ ...ts, ...data });
        } else {
            // Embedded tileset: just use as-is
            merged.push(ts);
        }
    }
    return merged;
}

export const lastPlayerPosManager = (() => {
    let lastPlayerPos = null;
    return {
        set(pos) {
            lastPlayerPos = pos ? pos.clone() : null;
        },
        get() {
            return lastPlayerPos ? lastPlayerPos.clone() : null;
        },
        clear() {
            lastPlayerPos = null;
        }
    };
})();