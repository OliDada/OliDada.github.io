import { playAnimIfNotPlaying } from "../utils";
import { onAttacked } from "../utils";

// Helper: check if a game object is partially visible on screen
function isPartiallyOnScreen(k, obj) {
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