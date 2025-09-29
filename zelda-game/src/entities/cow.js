import { playAnimIfNotPlaying, followPlayer } from '../utils.js';
import { gameState, cowState, playerState } from '../state/stateManagers.js';
import cowLines from '../content/cowDialogue.js';
import { dialog } from '../uiComponents/dialog.js';

export function generateCowComponents(k, pos) {
    return [
        k.sprite('cow', { anim: 'cow-idle-up' }),
        k.area({ shape: new k.Rect(k.vec2(8, 12), 16, 16) }),
        k.body({ isStatic: true }),
        k.pos(pos),
        k.offscreen(),
        'cow',
        {
            name: 'cow',
            hp() {
                return 1;
            },
            hurt() {},
        },
    ];
}

export async function startInteraction(k, cow, player) {
    if (player.direction === 'left') {
        cow.flipX = true;
        playAnimIfNotPlaying(cow, 'cow-idle-side');
    }
    if (player.direction === 'right') {
        cow.flipX = false;
        playAnimIfNotPlaying(cow, 'cow-idle-side');
    }
    if (player.direction === 'up') {
        playAnimIfNotPlaying(cow, 'cow-idle-down');
    }
    if (player.direction === 'down') {
        playAnimIfNotPlaying(cow, 'cow-idle-up');
    }

    if (
        cowState.getCowQuestComplete() === true ||
        playerState.getHasCarrot() === false
    ) {
        const lines = cowLines[gameState.getLanguage()]; // Always use first cow's lines
        let nbTimesTalkedCow = cowState.getNbTimesTalkedCow();
        let lineToSay = nbTimesTalkedCow;

        if (lines[lineToSay]) {
            await dialog(k, k.vec2(250, 500), [lines[lineToSay]], {
                speed: 10,
            });
        }
        cowState.setNbTimesTalkedCow(nbTimesTalkedCow + 1);
    }
}

let saidMoo = false;
export async function enableCowFollowOnPlayerCollision(k, cow, player) {
    cow.unuse('body');
    if (cowState.getCowQuestComplete() === false) {
        if (!saidMoo) {
            await dialog(
                k,
                k.vec2(250, 500),
                ["Moo?"],
                {
            speed: 10,
            });
        }
        saidMoo = true;
        followPlayer(k, player, cow, 20);
        cowState.setIsFollowingPlayer(true);
    } else {
        // When quest is complete, cow stops following
        cow.use(k.body({ isStatic: true }));
        playAnimIfNotPlaying(cow, 'cow-idle-down');
        cowState.setIsFollowingPlayer(false);
    }
    return;

    // Add update loop to stop following if quest is completed
    k.onUpdate(() => {
        if (cowState.getIsFollowingPlayer() && cowState.getCowQuestComplete()) {
            cow.use(k.body({ isStatic: true }));
            playAnimIfNotPlaying(cow, 'cow-idle-down');
            cowState.setIsFollowingPlayer(false);
        }
    });
}
