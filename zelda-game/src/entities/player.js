import { gameState, playerState } from "../state/stateManagers.js";
import { areAnyOfTheseKeysDown, playAnimIfNotPlaying } from "../utils";

export function generatePlayerComponents(k, pos) {
    return [
        k.sprite('sprites', {
            anim: 'player-idle-down',
        }),
        k.area({ shape: new k.Rect(k.vec2(3, 4), 10, 12) }),
        k.body(),
        k.pos(pos),
        k.opacity(),
        k.color(),
        {
            speed: 100,
            attackPower: 1,
            direction: 'down',
            isAttacking: false,
            inventory: [],
        },
        'player',
    ];
}



export function setPlayerMovement(k, player) {
    // --- Pull mechanic state ---
    let pullingObject = null;
    let pullOffset = null;
    let pullingDirection = null;

    k.onUpdate(() => {
        if (!player) return;
        if (player.isAttacking) return;
        if (gameState.getFreezePlayer()) {
            player.stop();
            return;
        }

        // Get which keys are down
        const left = k.isKeyDown("left") || k.isKeyDown("a");
        const right = k.isKeyDown("right") || k.isKeyDown("d");
        const up = k.isKeyDown("up") || k.isKeyDown("w");
        const down = k.isKeyDown("down") || k.isKeyDown("s");
    // Use 'e' consistently for pulling
    const pulling = k.isKeyDown("e");

    let moveVec = k.vec2(0, 0);
    let direction = player.direction;
    let isPulling = pulling && pullingObject && pullOffset;

        // Horizontal
        let currentSpeed = player.speed;
        if (isPulling) {
            currentSpeed = Math.max(40, player.speed * 0.5); // Reduce speed while pulling
        }
        if (left) {
            moveVec.x -= currentSpeed;
            direction = "left";
            player.flipX = true;
        } else if (right) {
            moveVec.x += currentSpeed;
            direction = "right";
            player.flipX = false;
        }

        // Vertical
        if (up) {
            moveVec.y -= currentSpeed;
            direction = "up";
        } else if (down) {
            moveVec.y += currentSpeed;
            direction = "down";
        }

        // Normalize diagonal speed
        if (moveVec.x !== 0 && moveVec.y !== 0) {
            moveVec = moveVec.scale(0.7071); // 1/sqrt(2)
        }

        // --- Pull mechanic logic (adjacent, any direction) ---
        if (pulling && !pullingObject) {
            // Find any pullable object adjacent to the player
            const pullables = k.get("pullable");
            console.log("[DEBUG] Player pos:", player.pos);
            pullables.forEach(obj => {
                const dist = obj.pos.dist(player.pos);
                console.log(`[DEBUG] Pullable pos:`, obj.pos, `Distance:`, dist, `AreaWidth:`, obj.areaWidth, `AreaHeight:`, obj.areaHeight, `Tags:`, obj.tags);
            });
                for (const obj of pullables) {
                    // Only allow pulling if close enough (strict proximity)
                    // If this is the secret passage, only allow if isFreed is true
                    if (obj.tags && obj.tags.includes && obj.tags.includes("secret-passage")) {
                        console.log("[DEBUG] Secret passage isFreed:", obj.isFreed);
                        if (!obj.isFreed) continue;
                    }
                    // Use worldPos for Kaboom objects, fallback to pos for proxy/dummy objects
                    const playerWorld = player.worldPos ? player.worldPos() : player.pos;
                    let pullableWorld;
                    if (obj.tags && obj.tags.includes && obj.tags.includes("secret-passage")) {
                        // For secret passage proxy, use pos only
                        pullableWorld = obj.pos;
                    } else if (typeof obj.worldPos === 'function') {
                        pullableWorld = obj.worldPos();
                    } else if (obj.pos && typeof obj.pos.dist === 'function') {
                        pullableWorld = obj.pos;
                    } else if (obj.pos) {
                        // Fallback for plain object
                        pullableWorld = obj.pos;
                    } else {
                        // If no pos, skip
                        return;
                    }
                    const dist = pullableWorld.dist(playerWorld);
                    if (dist < 20) { // Increased threshold for easier testing
                        pullingObject = obj;
                        pullOffset = pullableWorld.sub(playerWorld);
                        pullingDirection = direction; // Store initial pulling direction
                        console.log("Started pulling:", obj);
                        break;
                    }
                }
        }
        if (!pulling && pullingObject) {
            pullingObject = null;
            pullOffset = null;
            // Ensure pullables is always defined before use
            const pullables = k.get("pullable");
            console.log("Pulling candidates:", pullables.map(pullable => ({
                name: pullable.name || pullable.tags || pullable._tags,
                pos: pullable.pos,
                areaWidth: pullable.areaWidth,
                areaHeight: pullable.areaHeight,
                isStatic: pullable.isStatic,
                body: pullable.body,
                tags: pullable.tags || pullable._tags
            })));
            pullingDirection = null;
        }

        // If pulling, keep the object right next to the player and move slower
        if (isPulling && (moveVec.x !== 0 || moveVec.y !== 0)) {
            // Move the pullable by the same movement vector as the player
            // Check for collision with solids before moving the pullable
            let collides = false;
            const objW = pullingObject.area?.shape?.width || pullingObject.areaWidth || 14;
            const objH = pullingObject.area?.shape?.height || pullingObject.areaHeight || 14;
            const objBox = {
                x: pullingObject.pos.x + moveVec.x,
                y: pullingObject.pos.y + moveVec.y,
                w: objW,
                h: objH
            };
            for (const solid of k.get("solid")) {
                if (solid === pullingObject) continue;
                if (!solid.areaWidth || !solid.areaHeight) continue;
                const solidBox = {
                    x: solid.pos.x,
                    y: solid.pos.y,
                    w: solid.areaWidth,
                    h: solid.areaHeight
                };
                // AABB overlap check
                if (
                    objBox.x < solidBox.x + solidBox.w &&
                    objBox.x + objBox.w > solidBox.x &&
                    objBox.y < solidBox.y + solidBox.h &&
                    objBox.y + objBox.h > solidBox.y
                ) {
                    collides = true;
                    break;
                }
            }
            if (!collides) {
                pullingObject.move(moveVec);
            }
        }

        // Only move if any direction is pressed
        if (moveVec.x !== 0 || moveVec.y !== 0) {
            // Animation logic
            if (isPulling && pullingDirection) {
                // Only log when actually pulling
                console.log("Triggering pulling animation", pullingDirection);
                if (pullingDirection === "left") {
                    player.flipX = true;
                    playAnimIfNotPlaying(player, "player-pulling-side");
                } else if (pullingDirection === "right") {
                    player.flipX = false;
                    playAnimIfNotPlaying(player, "player-pulling-side");
                } else if (pullingDirection === "up") {
                    playAnimIfNotPlaying(player, "player-pulling-up");
                } else if (pullingDirection === "down") {
                    playAnimIfNotPlaying(player, "player-pulling-down");
                }
            } else {
                if (direction === "left") {
                    player.flipX = true;
                    playAnimIfNotPlaying(player, "player-side");
                } else if (direction === "right") {
                    player.flipX = false;
                    playAnimIfNotPlaying(player, "player-side");
                } else if (direction === "up") {
                    playAnimIfNotPlaying(player, "player-up");
                } else if (direction === "down") {
                    playAnimIfNotPlaying(player, "player-down");
                }
            }
            player.move(moveVec);
            player.direction = direction;
        } else {
            // Idle animation
            if (isPulling && pullingDirection) {
                if (pullingDirection === "left") {
                    player.flipX = true;
                    playAnimIfNotPlaying(player, "player-pulling-side-idle");
                } else if (pullingDirection === "right") {
                    player.flipX = false;
                    playAnimIfNotPlaying(player, "player-pulling-side-idle");
                } else if (pullingDirection === "up") {
                    playAnimIfNotPlaying(player, "player-pulling-up-idle");
                } else if (pullingDirection === "down") {
                    playAnimIfNotPlaying(player, "player-pulling-down-idle");
                }
            } else {
                if (player.direction === "left") {
                    player.flipX = true;
                    playAnimIfNotPlaying(player, "player-idle-side");
                } else if (player.direction === "right") {
                    player.flipX = false;
                    playAnimIfNotPlaying(player, "player-idle-side");
                } else if (player.direction === "up") {
                    playAnimIfNotPlaying(player, "player-idle-up");
                } else if (player.direction === "down") {
                    playAnimIfNotPlaying(player, "player-idle-down");
                }
            }
            player.stop();
        }
    });

    // Charge attack (shift key)
    k.onKeyDown((key) => {
        if (key !== "shift") return;
        if (!player) return;
        if (gameState.getFreezePlayer()) return;
        if (!playerState.getIsSwordEquipped()) return;
        if (player.isAttacking) return;

        player.isAttacking = true;
        player.stop(); // Stop movement immediately on attack

        // Play charge-up animation before attack

        // Blink effect using opacity
        for (let i = 0; i < 2; i++) {
            k.wait(0.08 * i * 2, () => {
                player.opacity = 0.3;
            });
            k.wait(0.2 * (i * 2 + 1), () => {
                player.opacity = 1;
            });
        }
        if (player.direction === "up") {
            playAnimIfNotPlaying(player, "player-charge-up");
        } else if (player.direction === "down") {
            playAnimIfNotPlaying(player, "player-charge-down");
        } else if (player.direction === "left") {
            player.flipX = true;
            playAnimIfNotPlaying(player, "player-charge-right");
        } else if (player.direction === "right") {
            player.flipX = false;
            playAnimIfNotPlaying(player, "player-charge-right");
        }

        k.wait(0.35, () => {
            if (k.get("swordHitBox").length === 0) {
                // Adjust these offsets as needed for your sprite size
                const swordHitBoxPosX = {
                    left: player.worldPos().x - 12,
                    right: player.worldPos().x + 12,
                    up: player.worldPos().x,
                    down: player.worldPos().x
                };
                const swordHitBoxY = {
                    left: player.worldPos().y,
                    right: player.worldPos().y,
                    up: player.worldPos().y - 16,
                    down: player.worldPos().y + 16
                };

                const hitbox = k.add([
                    k.area({ shape: new k.Rect(k.vec2(0), 14, 14) }),
                    k.pos(
                        swordHitBoxPosX[player.direction],
                        swordHitBoxY[player.direction]
                    ),
                    "swordHitBox",
                ]);

                // Show slash animation at sword hitbox position
                let slashAnim = `slash-${player.direction}`;
                if (player.direction === "left") {
                    slashAnim = "slash-left";
                } else if (player.direction === "right") {
                    slashAnim = "slash-right";
                }
                const slash = k.add([
                    k.sprite("sprites", { anim: slashAnim }),
                    k.pos(
                        swordHitBoxPosX[player.direction],
                        swordHitBoxY[player.direction]
                    ),
                    k.scale(1.5),
                    k.z(100), // Ensure it's above player
                    "slashEffect"
                ]);
                k.wait(9, () => {
                    k.destroyAll("swordHitBox");
                    k.destroy(slash);
                });
                // Lunge forward after slash, but stop if colliding with a solid
                const lungeDistance = 16; // Reasonable charge distance (was 600)
                let dx = 0, dy = 0;
                if (player.direction === "up") {
                    dy = -lungeDistance;
                } else if (player.direction === "down") {
                    dy = lungeDistance;
                } else if (player.direction === "left") {
                    dx = -lungeDistance;
                } else if (player.direction === "right") {
                    dx = lungeDistance;
                }

                const steps = 32; // More steps for finer collision
                let stopped = false;
                for (let i = 1; i <= steps; i++) {
                    k.wait(0.01 * i, () => {
                        if (stopped) return;
                        // Predict next position
                        const nextPos = player.pos.add(k.vec2(dx / steps, dy / steps));

                        // Get player's bounding box at next position
                        const playerWidth = player.areaWidth || 14;
                        const playerHeight = player.areaHeight || 14;
                        const playerBox = {
                            x: nextPos.x,
                            y: nextPos.y,
                            w: playerWidth,
                            h: playerHeight
                        };

                        // Check for overlap with any solid BEFORE moving
                        let collides = false;
                        for (const solid of k.get("solid")) {
                            if (!solid.areaWidth || !solid.areaHeight) continue;
                            const solidPos = solid.pos;
                            const solidBox = {
                                x: solidPos.x,
                                y: solidPos.y,
                                w: solid.areaWidth,
                                h: solid.areaHeight
                            };
                            // AABB overlap check
                            if (
                                playerBox.x < solidBox.x + solidBox.w &&
                                playerBox.x + playerBox.w > solidBox.x &&
                                playerBox.y < solidBox.y + solidBox.h &&
                                playerBox.y + playerBox.h > solidBox.y
                            ) {
                                collides = true;
                                break;
                            }
                        }

                        if (collides) {
                            stopped = true;
                            return;
                        }

                        // Move player
                        player.pos = nextPos;
                        // Always position hitbox and slash in front of player
                        let offset = k.vec2(0, 0);
                        if (player.direction === "up") offset = k.vec2(0, -16);
                        else if (player.direction === "down") offset = k.vec2(0, 16);
                        else if (player.direction === "left") offset = k.vec2(-16, 0);
                        else if (player.direction === "right") offset = k.vec2(16, 0);
                        if (hitbox) hitbox.pos = player.worldPos().add(offset);
                        if (slash) slash.pos = player.worldPos().add(offset);
                    });
                }
                k.wait(0.36, () => {
                    k.destroyAll("swordHitBox");
                    k.destroy(slash);
                    // Reset attack state and animation
                    if (player.direction === "left" || player.direction === "right") {
                        playAnimIfNotPlaying(player, "player-side");
                        player.stop();
                    } else {
                        playAnimIfNotPlaying(player, `player-${player.direction}`);
                        player.stop();
                    }
                    player.isAttacking = false;
                });
            }
            k.play("sword-swing");
            playAnimIfNotPlaying(player, `player-attack-${player.direction}`);
        });
    });

    k.onKeyPress((key) => {
        if (key !== "space") return;
        if (gameState.getFreezePlayer()) return;
        if (!playerState.getIsSwordEquipped()) return;
        if (player.isAttacking) return;

        player.isAttacking = true;
        player.stop(); // Stop movement immediately on attack

        if (k.get("swordHitBox").length === 0) {
            const swordHitBoxPosX = {
                left: player.worldPos().x - 2,
                right: player.worldPos().x + 10,
                up: player.worldPos().x + 5,
                down: player.worldPos().x + 2
            };
            const swordHitBoxY = {
                left: player.worldPos().y + 5,
                right: player.worldPos().y + 5,
                up: player.worldPos().y,
                down: player.worldPos().y + 10
            };

            k.add([
                k.area({ shape: new k.Rect(k.vec2(0), 10, 10) }),
                k.pos(
                    swordHitBoxPosX[player.direction],
                    swordHitBoxY[player.direction]
                ),
                "swordHitBox",
            ]);

            // Show hitbox for 0.1s, but keep attack animation for 0.25s
            k.wait(0.1, () => {
                k.destroyAll("swordHitBox");
            });
            k.wait(0.25, () => {
                if (
                    player.direction === "left" ||
                    player.direction === "right"
                ) {
                    playAnimIfNotPlaying(player, "player-side");
                    player.stop();
                } else {
                    playAnimIfNotPlaying(player, `player-${player.direction}`);
                    player.stop();
                }
                player.isAttacking = false; // Reset after attack finishes
            });
        }
        k.play("sword-swing");
        playAnimIfNotPlaying(player, `player-attack-${player.direction}`);
    });

    k.onKeyRelease(() => {
        if (!player) return;
        if (player.isAttacking) return; // Don't interrupt attack animation
        if (!areAnyOfTheseKeysDown(k, ["left", "a", "right", "d", "up", "w", "down", "s"])) {
            if (player.direction === "left" || player.direction === "right") {
                playAnimIfNotPlaying(player, "player-idle-side");
            } else if (player.direction === "up") {
                playAnimIfNotPlaying(player, "player-idle-up");
            } else if (player.direction === "down") {
                playAnimIfNotPlaying(player, "player-idle-down");
            }
            player.stop();
        }
    });
}