import k from './kaplayContext.js';
import world from './scenes/world.js';
import house from './scenes/house.js';
import shop from './scenes/shop.js';
import shopSecondFloor from './scenes/shopSecondFloor.js';
import basement from './scenes/basement.js';
import tower from './scenes/tower.js';
import towerSecondFloor from './scenes/towerSecondFloor.js';
import town from './scenes/town.js';
import castle from './scenes/castle.js';
import castleMain from './scenes/castleMain.js';
import castleMainUnderground from './scenes/castleMainUnderground.js';
import throneRoom from './scenes/throneRoom.js';
import barn from './scenes/barn.js';
import tavern from './scenes/tavern.js';
import forest from './scenes/forest.js';
import forestEast from './scenes/forestEast.js';
import witchHouse from './scenes/witchHouse.js';
import witchHouseInside from './scenes/witchHouseInside.js';
import trollDinner from './scenes/trollDinner.js';
import beanStalk from './scenes/beanStalkScene.js';
import clouds from './scenes/clouds.js';
import mainMenu from './scenes/mainMenu.js';
import { gameState } from './state/stateManagers.js';
import castleTest from './scenes/castle-test.js';

k.loadFont("gameboy", "./assets/gb.ttf");
k.loadSprite("Everything", "./assets/Everything.png", { 
    sliceX: 128, 
    sliceY: 128,
    anims: {
        // Chicken animations
        "chicken-idle-side": 20,
        "chicken-side": { from: 20, to: 23, loop: true },
        // Witch animations
        "witch-idle-down": 12684,
        "witch-down": { from: 12684, to: 12687, loop: true },
        "witch-idle-up": 12940,
        "witch-up": { from: 12940, to: 12943, loop: true },
        "witch-idle-side": 12812,
        "witch-side": { from: 12812, to: 12815, loop: true },
        // Hatguy animations
        "hatguy-idle-down": 12688,
        "hatguy-down": { from: 12688, to: 12691, loop: true },
        "hatguy-idle-up": 12944,
        "hatguy-up": { from: 12944, to: 12947, loop: true },
        "hatguy-idle-side": 12816,
        "hatguy-side": { from: 12816, to: 12819, loop: true },
        // Troll animations
        "troll-idle-down": 12692,
        "troll-down": { from: 12692, to: 12695, loop: true },
        "troll-idle-side": 12820,
        "troll-side": { from: 12820, to: 12823, loop: true },
        "troll-idle-up": 12948,
        "troll-up": { from: 12948, to: 12951, loop: true },
        "troll-sitting-down": 13460,
        "troll-sitting-side": 13461,
        "troll-sitting-up": 13462,
        "troll-sitting-left": 13463,
        "troll-laugh": { from: 13332, to: 13335, loop: false },
        // Gardener animations
        "gardener-idle-down": 12696,
        "gardener-down": { from: 12696, to: 12699, loop: true },
        "gardener-idle-side": 12824,
        "gardener-side": { from: 12824, to: 12827, loop: true },
        "gardener-idle-up": 12952,
        "gardener-up": { from: 12952, to: 12955, loop: true },
    }
});

k.loadSprite("House", "./assets/House.png", { sliceX: 14, sliceY: 7 });
k.loadSprite("1_terrain", "./assets/1_terrain.png", { sliceX: 16, sliceY: 16 });
k.loadSprite("Maple Tree", "./assets/Maple Tree.png", { sliceX: 10, sliceY: 3 });
k.loadSprite("4_buildings", "./assets/4_buildings.png", { sliceX: 24, sliceY: 24 });
k.loadSprite("floors-walls", "./assets/floors-walls.png", { sliceX: 9, sliceY: 7 });
k.loadSprite("candy-house", "./assets/candy-house.png", { sliceX: 16, sliceY: 16 });
k.loadSprite("bean-stalk-tiles", "./assets/bean-stalk-tiles.png", { sliceX: 6, sliceY: 16 });
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
        "player-charge-up": 1055,
        "player-attack-down": 1092,
        "player-charge-down": 1053,
        "player-attack-left": 1093,
        "player-charge-left": 1056,
        "player-attack-right": 1093,
        "player-charge-right": 1054,
        "player-sitting-up": 1172,
        // Slash animations
        "slash-up": { from: 1087, to: 1091, loop: false },
        "slash-down": { from: 1126, to: 1130, loop: false },
        "slash-left": { from: 1048, to: 1052, loop: false },
        "slash-right": { from: 1009, to: 1013, loop: false },
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
        // Ghost animations
        "ghost-down": { from: 862, to: 863, loop: true },
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
        // Frog
        "frog-idle-down": 789,
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

k.loadSprite("fence-door", "./assets/fence-door.png", {
    sliceX: 2, // Number of frames
    sliceY: 1,
    anims: {
        "fence-door-closed": 0,
        "fence-door-opened": 1,
    }
});

k.loadSprite("shifting-walls", "./assets/shifting-walls.png", {
    sliceX: 7, 
    sliceY: 1,
    anims: {
        "wall-1": 0,
        "wall-2": 1,
        "wall-3": 2,
        "wall-4": 3,
        "wall-5": 4,
        "wall-6": 5,
        "wall-7": 6,
    }
});

k.loadSprite("bean-stalk", "./assets/bean-stalk.png", {
    sliceX: 6, 
    sliceY: 1,
    anims: {
        "bean-stalk-1": 0,
        "bean-stalk-2": 1,
        "bean-stalk-3": 2,
        "bean-stalk-4": 3,
        "bean-stalk-5": 4,
        "bean-stalk-6": 5,
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
    // Carrot sprite
    "carrot": {
        x: 144,
        y: 272,
        width: 48,
        height: 48
    },
    // Magical Beans sprite
    "magical-beans": {
        x: 192,
        y: 272,
        width: 48,
        height: 48
    },

});
k.loadSprite("smoke", "./assets/smoke.png", {
    sliceX: 7,
    sliceY: 1,
    anims: {
        "smoke": { from: 0, to: 6, loop: false },
    }
});

k.loadSpriteAtlas("./assets/smoke.png", {
    "smoke-1": {
        x: 0,
        y: 0,
        width: 32,
        height: 32
    },
    "smoke-2": {
        x: 32,
        y: 0,
        width: 32,
        height: 32
    },
    "smoke-3": {
        x: 64,
        y: 0,
        width: 32,
        height: 32
    },
    "smoke-4": {
        x: 96,
        y: 0,
        width: 32,
        height: 32
    },
});
k.loadSprite("cow", "./assets/cow.png", {
    // Cow sprites
    sliceX: 4,
    sliceY: 3,
    anims: {
        "cow-idle-down": 4,
        "cow-down": { from: 4, to: 7, loop: true },
        "cow-idle-side": 0,
        "cow-side": { from: 0, to: 3, loop: true },
        "cow-idle-up": 8,
        "cow-up": { from: 8, to: 11, loop: true },
    }
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
    "castle-main": castleMain,
    "throne-room": throneRoom,
    barn,
    tavern,
    forest,
    "witch-house": witchHouse,
    "witch-house-inside": witchHouseInside,
    "castle-test": castleTest,
    "forest-east": forestEast,
    "castle-main-underground": castleMainUnderground,
    town,
    "troll-dinner": trollDinner,
    "bean-stalk": beanStalk,
    clouds,

};

// Register the scenes with the game context
for (const sceneName in scenes) {
    k.scene(sceneName, () => scenes[sceneName](k)); // Register each scene
}


k.go("mainMenu");

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
