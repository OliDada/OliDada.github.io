import { playAnimIfNotPlaying, isPartiallyOnScreen } from "../utils.js";
import { onAttacked } from "../utils.js";
import { slimeState } from "../state/stateManagers.js";


const directionalStates = ["left", "right", "up", "down"];

export function generateSlimeComponents(k, pos) {
    return [
        k.sprite('sprites', {
            anim: 'slime-idle-down',
        }),
        k.area({ shape: new k.Rect(k.vec2(1, 5), 14, 12) }),
        k.body(),
        k.pos(pos),
        k.offscreen(),
        k.opacity(),
        k.state(
            "idle",
            ["idle", ...directionalStates]
        ),
        k.health(3),
        {
            speed: 30,
            attackPower: 0.5,
        },
        'slime',
    ];
}

export function setSlimeAI(k, slime) {
    // Sync health with slimeState for tracked slimes
    slime.on("hurt", () => {
        if (typeof slime._slimeIndex === "number" && typeof slimeState !== "undefined") {
            slimeState.setSlimeHealth(slime._slimeIndex, slime.health);
        }
    });

    slime.on("death", () => {
        if (typeof slime._slimeIndex === "number" && typeof slimeState !== "undefined") {
            slimeState.setSlimeHealth(slime._slimeIndex, 0);
                if (window && window.console) {
                    console.log('SlimeState health after death:', slimeState.getSlimeHealth());
                }
        }
    });

    k.onUpdate(() => {
        // Skip AI updates if the slime is dead or offscreen
        if (slime.health <= 0) return;
        if (!isPartiallyOnScreen(k, slime)) return;
        switch (slime.state) {
            case "idle":
                slime.move(0);
                break;
            case "left":
                slime.move(-slime.speed, 0);
                break;
            case "right":
                slime.move(slime.speed, 0);
                break;
            case "up":
                slime.move(0, -slime.speed);
                break;
            case "down":
                slime.move(0, slime.speed);
                break;
        }
    });

    // Listen for slime death and persist dead state
    slime.on("death", () => {
        // Debug: print both spawn key and current position
        const spawnKey = slime._spawnKey;
        const deathKey = `${Math.floor(slime.pos.x)},${Math.floor(slime.pos.y)}`;
        if (window && window.console) {
            console.log('Slime died at spawnKey:', spawnKey, 'deathKey:', deathKey);
        }
        if (window.gameState && window.gameState.addDeadSlime && spawnKey) {
            window.gameState.addDeadSlime(spawnKey);
        }
    });

    const idle = slime.onStateEnter("idle", async () => {
        slime.stop();
        await k.wait(3);
        // Only move if partially on screen
        if (isPartiallyOnScreen(k, slime)) {
            slime.enterState(
                directionalStates[Math.floor(Math.random() * directionalStates.length)]
            );
        } else {
            slime.enterState("idle");
        }
    });
    const right = slime.onStateEnter("right", async () => {
        slime.flipX = false;
        playAnimIfNotPlaying(slime, "slime-side");
        const waitTime = k.rand(1, 5);
        let elapsed = 0;
        let collided = false;
        while (elapsed < waitTime) {
            await k.wait(0.1);
            elapsed += 0.1;
            if (slime.getCollisions().length > 0) {
                collided = true;
                break;
            }
        }
        if (collided) {
            slime.enterState("left");
            return;
        }
        slime.enterState("idle");
    });
    const left = slime.onStateEnter("left", async () => {
        slime.flipX = true;
        playAnimIfNotPlaying(slime, "slime-side");
        const waitTime = k.rand(1, 5);
        let elapsed = 0;
        let collided = false;
        while (elapsed < waitTime) {
            await k.wait(0.1);
            elapsed += 0.1;
            if (slime.getCollisions().length > 0) {
                collided = true;
                break;
            }
        }
        if (collided) {
            slime.enterState("idle");
            return;
        }
        slime.enterState("idle");
    });
    const up = slime.onStateEnter("up", async () => {
        playAnimIfNotPlaying(slime, "slime-up");
        const waitTime = k.rand(1, 5);
        let elapsed = 0;
        let collided = false;
        while (elapsed < waitTime) {
            await k.wait(0.1);
            elapsed += 0.1;
            if (slime.getCollisions().length > 0) {
                collided = true;
                break;
            }
        }
        if (collided) {
            slime.enterState("idle");
            return;
        }
        slime.enterState("idle");
    });
    const down = slime.onStateEnter("down", async () => {
        playAnimIfNotPlaying(slime, "slime-down");
        const waitTime = k.rand(1, 5);
        let elapsed = 0;
        let collided = false;
        while (elapsed < waitTime) {
            await k.wait(0.1);
            elapsed += 0.1;
            if (slime.getCollisions().length > 0) {
                collided = true;
                break;
            }
        }
        if (collided) {
            slime.enterState("idle");
            return;
        }
        slime.enterState("idle");
    });

    k.onSceneLeave(() => {
        idle.cancel();
        right.cancel();
        left.cancel();
        up.cancel();
        down.cancel();
    });
}