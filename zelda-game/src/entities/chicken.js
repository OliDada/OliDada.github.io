import { playAnimIfNotPlaying } from "../utils";
import { onAttacked } from "../utils";
import { chickenState } from "../state/stateManagers.js";
import globalStateManager from "../state/globalState.js";

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

const directionalStates = ["left", "right"];
const gameState = globalStateManager().getInstance();

export function generateChickenComponents(k, pos) {
    return [
        k.sprite('Everything', {
            anim: 'chicken-idle-side',
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
        k.health(2),
        {
            speed: 30,
            attackPower: 0.5,
        },
        'chicken',
    ];
}

export function setChickenAI(k, chicken, chickenIndex) {
    k.onUpdate(() => {
        // Skip AI updates if the chicken is dead or offscreen
        if (chicken.health <= 0) return;
        if (!isPartiallyOnScreen(k, chicken)) return;
        switch (chicken.state) {
            case "idle":
                chicken.move(0);
                break;
            case "left":
                chicken.move(-chicken.speed, 0);
                break;
            case "right":
                chicken.move(chicken.speed, 0);
                break;
        }
    });

    const idle = chicken.onStateEnter("idle", async () => {
        chicken.stop();
        await k.wait(3);
        // Only move if partially on screen
        if (isPartiallyOnScreen(k, chicken)) {
            chicken.enterState(
                directionalStates[Math.floor(Math.random() * directionalStates.length)]
            );
        } else {
            chicken.enterState("idle");
        }
    });
    const right = chicken.onStateEnter("right", async () => {
        chicken.flipX = true;
        playAnimIfNotPlaying(chicken, "chicken-side");
        const waitTime = k.rand(1, 5);
        let elapsed = 0;
        let collided = false;
        while (elapsed < waitTime) {
            await k.wait(0.1);
            elapsed += 0.1;
            if (chicken.getCollisions().length > 0) {
                collided = true;
                break;
            }
        }
        if (collided) {
            chicken.enterState("left");
            return;
        }
        chicken.enterState("idle");
    });
    const left = chicken.onStateEnter("left", async () => {
        chicken.flipX = false;
        playAnimIfNotPlaying(chicken, "chicken-side");
        const waitTime = k.rand(1, 5);
        let elapsed = 0;
        let collided = false;
        while (elapsed < waitTime) {
            await k.wait(0.1);
            elapsed += 0.1;
            if (chicken.getCollisions().length > 0) {
                collided = true;
                break;
            }
        }
        if (collided) {
            chicken.enterState("idle");
            return;
        }
        chicken.enterState("idle");
    });

    chicken.on("hurt", () => {
        chickenState.setChickenHealth(chickenIndex, chicken.health);
    });

    k.onSceneLeave(() => {
        idle.cancel();
        right.cancel();
        left.cancel();
    });
}