import { playAnimIfNotPlaying, isPartiallyOnScreen } from "../utils";
import { onAttacked } from "../utils";
import { chickenState } from "../state/stateManagers.js";
import globalStateManager from "../state/globalState.js";


const directionalStates = ["left", "right"];
const gameState = globalStateManager().getInstance();

export function generateChickenComponents(k, pos, health = 2) {
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
        k.health(health),
        {
            speed: 30,
            attackPower: 0.5,
        },
        'chicken',
    ];
}

export function setChickenAI(k, chicken, chickenIndex) {
    chicken.on("hurt", () => {
        console.log(`[ChickenAI] Chicken ${chickenIndex} hurt event: hp=${chicken.hp && chicken.hp()}`);
    });
    chicken.on("death", () => {
        console.log(`[ChickenAI] Chicken ${chickenIndex} death event: hp=${chicken.hp && chicken.hp()}`);
    });
    k.onUpdate(() => {
        // Emit death event if chicken health reaches 0 and hasn't already
        if (chicken.health <= 0) {
            if (!chicken._deathEmitted) {
                chicken._deathEmitted = true;
                chicken.trigger("death");
            }
            return;
        }
        if (!isPartiallyOnScreen(k, chicken)) {
            return;
        }
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
        let elapsed = 0;
        let collided = false;
        while (elapsed < 2) {
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
        let elapsed = 0;
        let collided = false;
        while (elapsed < 3) {
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
        const hp = chicken.hp && chicken.hp();
        if (typeof hp === 'number' && !isNaN(hp)) {
            console.log(`[ChickenAI] setChickenHealth called for index=${chickenIndex}, hp=${hp}`);
            chickenState.setChickenHealth(chickenIndex, hp);
        }
    });

    chicken.on("death", () => {
        chickenState.setChickenHealth(chickenIndex, 0);
    });

    k.onSceneLeave(() => {
        idle.cancel();
        right.cancel();
        left.cancel();
    });
}