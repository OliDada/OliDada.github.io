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

function playerMovementLogic(k, player, currentKey, expectedKey, excludedKeys, direction, moveVec) {
    if (
        currentKey === expectedKey &&
        !areAnyOfTheseKeysDown(k, excludedKeys)
    ) {
        if (direction === "left") {
            player.flipX = true;
        } else if (direction === "right") {
            player.flipX = false;
        }

        switch (direction) {
            case "left":
            case "right":
                playAnimIfNotPlaying(player, "player-side");
                break;
            case "up":
                playAnimIfNotPlaying(player, "player-up");
                break;
            case "down":
                playAnimIfNotPlaying(player, "player-down");
                break;
        }
        player.move(moveVec);
        player.direction = direction;
    }
}

export function setPlayerMovement(k, player) {
    k.onKeyDown((key) => {
        if (player.isAttacking) return;

        if (gameState.getFreezePlayer()) {
            player.stop();
            return;
        }
        // Left
        playerMovementLogic(k, player, key, "left", ["up", "w", "down", "s"], "left", k.vec2(-player.speed, 0));
        playerMovementLogic(k, player, key, "a", ["up", "w", "down", "s", "left"], "left", k.vec2(-player.speed, 0));
        // Right
        playerMovementLogic(k, player, key, "right", ["up", "w", "down", "s"], "right", k.vec2(player.speed, 0));
        playerMovementLogic(k, player, key, "d", ["up", "w", "down", "s", "right"], "right", k.vec2(player.speed, 0));
        // Up
        playerMovementLogic(k, player, key, "up", ["down", "s"], "up", k.vec2(0, -player.speed));
        playerMovementLogic(k, player, key, "w", ["down", "s", "up"], "up", k.vec2(0, -player.speed));
        // Down
        playerMovementLogic(k, player, key, "down", ["up", "w"], "down", k.vec2(0, player.speed));
        playerMovementLogic(k, player, key, "s", ["up", "w", "down"], "down", k.vec2(0, player.speed));
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
    })
}