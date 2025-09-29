import { playAnimIfNotPlaying } from "../utils.js";
import { dialog } from "../uiComponents/dialog.js";
import gardenerLines from "../content/gardenerDialogue.js";
import { gameState, gardenerState, playerState, beanStalkState } from "../state/stateManagers.js";
import { healthBar } from "../uiComponents/healthbar.js";

export function generateGardenerComponents(k, pos) {
    return [
        k.sprite('Everything', {
            anim: 'gardener-idle-side',
        }),
        k.area({ shape: new k.Rect(k.vec2(2, 6), 12, 13) }),
        k.body({ isStatic: true}),
        k.pos(pos),
        k.offscreen(),
        k.opacity(),
        {
            speed: 30,
        },
        'gardener',
    ];
}

export async function startInteraction(k, gardener, player, beanStalk) {
    if (player.direction === "left") {
        gardener.flipX = false;
        playAnimIfNotPlaying(gardener, "gardener-idle-side");
    }
    if (player.direction === "right") {
        gardener.flipX = true;
        playAnimIfNotPlaying(gardener, "gardener-idle-side");
    }
    if (player.direction === "up") {
        playAnimIfNotPlaying(gardener, "gardener-idle-down");
    }
    if (player.direction === "down") {
        playAnimIfNotPlaying(gardener, "gardener-idle-up");
    }

    const responses = gardenerLines[gameState.getLanguage()];

    if (gameState.getPlantedBeans() === false) {
        
            let curAnim = gardener.curAnim();

            gardener.play('gardener-idle-side');
            gardener.flipX = false;
            await dialog(
                k, k.vec2(250, 500),
                [
                    "Hmm... maybe some tulips? no that's too common...",
                    "Or perhaps some carrots? no, that's too predictable...",
                    "What about some roses? no, those are too basic...",
                    "Ugh, I just can't decide!",
                ],
                { speed: 10 }
            );
            await gardener.play(curAnim);
            await gardener.play(curAnim);
            if (gardener.flipX === false) {
                gardener.flipX = true;
            }
            await dialog(
                k,
                k.vec2(250, 500),
                [
                    "Oh hello, I was just trying to decide what to plant here.",
                ],
                { speed: 10 }
            );
            gardener.play('gardener-idle-side');
            if (gardener.flipX === true) {
                gardener.flipX = false;
            }
            
            await dialog(
                k,
                k.vec2(250, 500),
                [
                    "The soil here is so rich and fertile, I could grow anything!",
                    "But I can't decide what to plant...",
                    "It has to be something truly special!"
                ],
                { speed: 10 }
            );
            await gardener.play(curAnim);
            if (gardener.flipX === false) {
                gardener.flipX = true;
            }
            await dialog(
                k,
                k.vec2(250, 500),
                [
                    "Do you have any ideas?",
                    "...",
                ],
                { speed: 10 }
            );
            if (playerState.getHasMagicalBeans() === true) {
                await dialog(
                    k,
                    k.vec2(250, 500),
                    [
                        "Wait a minute... those beans you have...",
                        "Could they be... magical beans?",
                        "I've heard stories about them, but I never thought I'd see some in person!",
                        "Could I maybe... Plant them?",
                        "...",
                    ],
                    { speed: 10 },

                );
                await playerState.setHasMagicalBeans(false),
                await k.destroyAll("heartsContainer"),
                await healthBar(k),
                await gameState.setPlantedBeans(true);
                k.play("item");
                await dialog(
                    k,
                    k.vec2(250, 500),
                    [
                        "Thank you so much!"
                    ],
                    { speed: 10 }
                );
                gameState.setFreezePlayer(true);
                await k.tween(
                    gardener.pos,
                    gardener.pos.add(k.vec2(32, 0)),
                    2,
                    v => {
                        gardener.pos = v;
                        // Keep walk animation active during movement
                        if (gardener.curAnim() !== 'gardener-side') {
                            gardener.flipX = false;
                            gardener.play('gardener-side');
                        }
                    },
                    k.easings.linear
                );
                gardener.play("gardener-idle-up");
                await k.wait(2);
                // Set beanstalk animation to bean-stalk-2
                if (beanStalk) {
                    if (beanStalk.play) {
                        beanStalk.play("bean-stalk-2");
                    } else {
                        // Try to access sprite component directly
                        const spriteComp = beanStalk.use && beanStalk.use("sprite");
                        if (spriteComp && spriteComp.play) {
                            spriteComp.play("bean-stalk-2");
                        }
                    }
                    beanStalkState.setBeanStalkHeight(1);
                }
                await k.tween(
                    gardener.pos,
                    gardener.pos.add(k.vec2(-32, 0)),
                    2,
                    v => {
                        gardener.pos = v;
                        // Keep walk animation active during movement
                        if (gardener.curAnim() !== 'gardener-side') {
                            gardener.flipX = true;
                            gardener.play('gardener-side');
                        }
                    },
                    k.easings.linear
                );
                gardener.play(curAnim);
                await dialog(
                    k,
                    k.vec2(250, 500),
                    [
                        "This is so exciting! I can't wait to see what grows!",
                        "Be sure to come back and check on it when you're passing by."
                    ],
                    { speed: 10 }
                );

            } else {
                await dialog(
                    k,
                    k.vec2(250, 500),
                    [
                        "Hmm... I guess not. Well, if you come across anything interesting, please let me know!",
                    ],
                    { speed: 10 }
                );     
            
        }

    }
    let nbTimesTalkedGardenerHeight1 = gardenerState.getNbTimesTalkedGardenerHeight1() || 0;
    if (beanStalkState.getBeanStalkHeight() === 1) {
        let lines1 = [
            ["Thank you again for those magical beans!"],
            ["I can't wait to see what grows!"]
        ];
        await dialog(
            k,
            k.vec2(250, 500),
            lines1[nbTimesTalkedGardenerHeight1 % lines1.length],
            { speed: 10 }
        );
        gardenerState.setNbTimesTalkedGardenerHeight1(nbTimesTalkedGardenerHeight1 + 1);
    }

    let nbTimesTalkedGardenerHeight2 = gardenerState.getNbTimesTalkedGardenerHeight2() || 0;
    if (beanStalkState.getBeanStalkHeight() === 2) {
        let lines2 = [
            ["Look! It's already grown so much!"],
            ["I wonder how tall it will get?"]
        ];
        await dialog(
            k,
            k.vec2(250, 500),
            lines2[nbTimesTalkedGardenerHeight2 % lines2.length],
            { speed: 10 }
        );
        gardenerState.setNbTimesTalkedGardenerHeight2(nbTimesTalkedGardenerHeight2 + 1);
    }

    let nbTimesTalkedGardenerHeight3 = gardenerState.getNbTimesTalkedGardenerHeight3() || 0;
    if (beanStalkState.getBeanStalkHeight() === 3) {
        let lines3 = [
            ["Wow, it's getting really tall now!"],
            ["Thank you again for this!"],
            ["I can't wait to see how high it will grow!"]
        ];
        await dialog(
            k,
            k.vec2(250, 500),
            lines3[nbTimesTalkedGardenerHeight3 % lines3.length],
            { speed: 10 }
        );
        gardenerState.setNbTimesTalkedGardenerHeight3(nbTimesTalkedGardenerHeight3 + 1);
    }

    let nbTimesTalkedGardenerHeight4 = gardenerState.getNbTimesTalkedGardenerHeight4() || 0;
    if (beanStalkState.getBeanStalkHeight() === 4) {
        let lines4 = [
            ["It's almost reaching the clouds!"],
            ["This is amazing!"]
        ];
        await dialog(
            k,
            k.vec2(250, 500),
            lines4[nbTimesTalkedGardenerHeight4 % lines4.length],
            { speed: 10 }
        );
        gardenerState.setNbTimesTalkedGardenerHeight4(nbTimesTalkedGardenerHeight4 + 1);
    }

    let nbTimesTalkedGardenerHeight5 = gardenerState.getNbTimesTalkedGardenerHeight5() || 0;
    if (beanStalkState.getBeanStalkHeight() >= 5) {
        let lines5 = [
            ["It's so tall now, It has reached the clouds!",
            "Thank you, thank you, thank you!",
            "I wonder what's up there..."],
            ["This is unbelievable!"]
        ];
        await dialog(
            k,
            k.vec2(250, 500),
            lines5[nbTimesTalkedGardenerHeight5 % lines5.length],
            { speed: 10 }
        );
        gardenerState.setNbTimesTalkedGardenerHeight5(nbTimesTalkedGardenerHeight5 + 1);
    }

    await k.wait(0.5);
    gardener.play('gardener-idle-side');
    gardener.flipX = false;
}
