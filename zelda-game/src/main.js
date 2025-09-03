import k from './kaplayContext.js';
import world from './scenes/world.js';
import house from './scenes/house.js';
import shop from './scenes/shop.js';
import shopSecondFloor from './scenes/shopSecondFloor.js';
import basement from './scenes/basement.js';
import tower from './scenes/tower.js';
import towerSecondFloor from './scenes/towerSecondFloor.js';
import castle from './scenes/castle.js';
import throneRoom from './scenes/throneRoom.js';
import barn from './scenes/barn.js';
import tavern from './scenes/tavern.js';
import mainMenu from './scenes/mainMenu.js';
import { gameState } from './state/stateManagers.js';

k.loadFont("gameboy", "./assets/gb.ttf");
k.loadSprite("Everything", "./assets/Everything.png", { 
    sliceX: 128, 
    sliceY: 128,
    anims: {
        "chicken-idle-side": 20,
        "chicken-side": { from: 20, to: 23, loop: true }
    }
});

k.loadSprite("House", "./assets/House.png", { sliceX: 14, sliceY: 7 });
k.loadSprite("1_terrain", "./assets/1_terrain.png", { sliceX: 16, sliceY: 16 });
k.loadSprite("Maple Tree", "./assets/Maple Tree.png", { sliceX: 10, sliceY: 3 });
k.loadSprite("4_buildings", "./assets/4_buildings.png", { sliceX: 24, sliceY: 24 });
k.loadSprite("floors-walls", "./assets/floors-walls.png", { sliceX: 9, sliceY: 7 });
k.loadSprite("Sprite-0005", "./assets/Sprite-0005.png", { 
    sliceX: 33, 
    sliceY: 24,
    anims: {
        "chest-closed": 239,
        "chest-opened": 240
    }
});
k.loadSprite("topdownasset", "./assets/topdownasset.png", { 
    sliceX: 39, 
    sliceY: 62,
});
// Player models
k.loadSprite("sprites", "./assets/topdownasset.png", { 
    sliceX: 39, 
    sliceY: 62,
    anims: {
        // Player animations
        "player-idle-down": 936,
        "player-down": { from: 936, to: 939, loop: true },
        "player-idle-side": 975,
        "player-side": { from: 976, to: 978, loop: true },
        "player-idle-up": 1014,
        "player-up": { from: 1014, to: 1017, loop: true },
        "player-attack-up": 1094,
        "player-attack-down": 1092,
        "player-attack-left": 1093,
        "player-attack-right": 1093,
        // Slime animations
        "slime-idle-down": 858,
        "slime-down": { from: 858, to: 859, loop: true },
        "slime-idle-side": 860,
        "slime-side": { from: 860, to: 861, loop: true },
        "slime-idle-up": 897,
        "slime-up": { from: 897, to: 898, loop: true },
        // Lumberjack animations
        "lumberjack-idle-down": 948,
        "lumberjack-idle-side": 989,
        "lumberjack-idle-up": 1026,
        // Oldman animations
        "oldman-idle-down": 866,
        "oldman-idle-side": 907,
        "oldman-idle-up": 905,
        // Shopkeeper animations
        "shopkeeper-idle-down": 964,
        "shopkeeper-idle-side": 1003,
        "shopkeeper-idle-up": 1042,
        // Prisoner animations
        "prisoner-idle-down": 940,
        "prisoner-down": { from: 940, to: 943, loop: true },
        "prisoner-idle-side": 979,
        "prisoner-side": { from: 980, to: 982, loop: true },
        "prisoner-idle-up": 1018,
        "prisoner-up": { from: 1018, to: 1021, loop: true },
        // Prison door animations
        "prison-door-closed": 505,
        "prison-door-opened": 506,
        // Wizard animations
        "wizard-idle-down": 792,
        "wizard-idle-side": 793,
        "wizard-idle-up": 794,
        // Secret passage
        "secret-passage": 414,
        // Pressure plate
        "pressure-plate-up": 618,
        "pressure-plate-down": 619,
        // Guards
        "guard-1-idle-down": 944,
        "guard-2-idle-down": 679,
        "guard-3-idle-down": 679,
        "guard-3-down": { from: 679, to: 682, loop: true },
        "guard-3-idle-up": 767,
        "guard-3-up": { from: 757, to: 760, loop: true },
        // King
        "king-sitting-down": 918,
        // Farmer
        "farmer-idle-down": 1209,
        "farmer-idle-side": 1248,
        "farmer-idle-up": 1287,
        // Bartender
        "bartender-idle-down": 1213,
    }
});

k.loadSprite("dungeonDoor", "./assets/dungeonDoor.png", {
    sliceX: 4, // Number of frames
    sliceY: 1,
    anims: {
        "dungeon-door-1": 0,
        "dungeon-door-2": 1,
        "dungeon-door-3": 2,
        "dungeon-door-4": 3,
    }
});

k.loadSpriteAtlas("./assets/topdownasset.png", {
    // Heart sprites
    "full-heart": {
        x: 0,
        y: 224,
        width: 48,
        height: 48
    },
    "half-heart": {
        x: 48,
        y: 224,
        width: 48,
        height: 48
    },
    "empty-heart": {
        x: 96,
        y: 224,
        width: 48,
        height: 48
    },
    // Potion sprites
    "health-potion": {
        x: 0,
        y: 272,
        width: 48,
        height: 48
    },
    // Sword sprites
    "sword-icon": {
        x: 192,
        y: 224,
        width: 48,
        height: 48
    },
    // Key sprites
    "key": {
        x: 96,
        y: 272,
        width: 48,
        height: 48
    },

});


// Load sounds
k.loadSound("soundtrack", "./assets/sounds/soundtrack.mp3");
k.loadSound("basement-soundtrack", "./assets/sounds/basement-soundtrack.mp3");
k.loadSound("castle-soundtrack", "./assets/sounds/castle-soundtrack.mp3");
k.loadSound("dialogue", "./assets/sounds/dialogue.mp3");
k.loadSound("sword-swing", "./assets/sounds/sword-swing.mp3");
k.loadSound("item", "./assets/sounds/item.mp3");
k.loadSound("drink", "./assets/sounds/drink.mp3");
k.loadSound("chest-open", "./assets/sounds/chest-open.mp3");
k.loadSound("player-hurt", "./assets/sounds/player-hurt.mp3");
k.loadSound("door-open", "./assets/sounds/door-open.mp3");


// Define the game scenes
const scenes = {
    mainMenu,
    world,
    house,
    shop,
    "shop-second-floor": shopSecondFloor,
    basement,
    tower,
    "tower-second-floor": towerSecondFloor,
    castle,
    "throne-room": throneRoom,
    barn,
    tavern
};

// Register the scenes with the game context
for (const sceneName in scenes) {
    k.scene(sceneName, () => scenes[sceneName](k)); // Register each scene
}


k.go("castle");

k.setVolume(0.3); // Set initial volume only once, before any scene loads

let isMuted = false;

k.onKeyPress("m", () => {
    if (isMuted) {
        console.log("Unmuting");
        k.setVolume(0.3);
        isMuted = false;
    } else {
        console.log("Muting");
        k.setVolume(0);
        isMuted = true;
    }
});
