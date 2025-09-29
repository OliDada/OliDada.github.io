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
import tavernSecondFloor from './scenes/tavernSecondFloor.js';
import forest from './scenes/forest.js';
import forestEast from './scenes/forestEast.js';
import witchHouse from './scenes/witchHouse.js';
import witchHouseInside from './scenes/witchHouseInside.js';
import trollDinner from './scenes/trollDinner.js';
import beanStalk from './scenes/beanStalkScene.js';
import clouds from './scenes/clouds.js';
import wolfHouse from './scenes/wolfHouse.js';
import swamp from './scenes/swamp.js';
import village from './scenes/village.js';
import mountain from './scenes/mountain.js';
import mainMenu from './scenes/mainMenu.js';
import worldMap from './scenes/worldMap.js';
import { setupInventoryUI } from './uiComponents/inventory.js';

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
        // Bat animations
        "bat-idle-down": { from: 11404, to: 11407, loop: true },
        "bat-down": { from: 11404, to: 11407, loop: true },
        "bat-idle-side": 11532,
        "bat-side": { from: 11532, to: 11535, loop: true },
        "bat-idle-up": 11660,
        "bat-up": { from: 11660, to: 11663, loop: true },
        // Swordsman animations
        "swordsman-idle-down": 13588,
        "swordsman-idle-side": 13716,
        "swordsman-idle-up": 13844,
        // Drunkard animations
        "drunkard-idle-down": 13592,
        "drunkard-idle-side": 13593,
        "drunkard-idle-up": 13594,
        // Wolf animations
        "wolf-idle-down": 12700,
        "wolf-down": { from: 12700, to: 12703, loop: true },
        "wolf-idle-side": 12828,
        "wolf-side": { from: 12828, to: 12831, loop: true },
        "wolf-idle-up": 12956,
        "wolf-up": { from: 12956, to: 12959, loop: true },
        // Red riding hood animations
        "red-riding-hood-idle-down": 13596,
        "red-riding-hood-down": { from: 13596, to: 13599, loop: true },
        "red-riding-hood-idle-side": 13724,
        "red-riding-hood-side": { from: 13724, to: 13727, loop: true },
        "red-riding-hood-idle-up": 13852,
        "red-riding-hood-up": { from: 13852, to: 13855, loop: true },
        // Spikes animation
        "spikes-up": 10660,
        "spikes-down": 10661,

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
        "player-pulling-up-idle": 1560,
        "player-pulling-up": { from: 1560, to: 1563, loop: true },
        "player-pulling-side-idle": 1521,
        "player-pulling-side": { from: 1521, to: 1524, loop: true },
        "player-pulling-down-idle": 1482,
        "player-pulling-down": { from: 1482, to: 1485, loop: true },
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

k.loadSprite("snake", "./assets/snake.png", {
    sliceX: 4,
    sliceY: 6,
    anims: {
        "snake-idle-side": 0,
        "snake-side": { from: 0, to: 3, loop: true },
        "snake-idle-down": 4,
        "snake-down": { from: 4, to: 7, loop: true },
        "snake-idle-up": 8,
        "snake-up": { from: 8, to: 11, loop: true },
        "snake-attack-side": { from : 12, to: 15, loop: false },
        "snake-attack-down": { from : 16, to: 19, loop: false },
        "snake-attack-up": { from : 20, to: 23, loop: false },
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
    // Tavern supplies sprite
    "tavern-supplies": {
        x: 192,
        y: 176,
        width: 48,
        height: 48
    },
    // Crown sprite
    "crown": {
        x: 144,
        y: 176,
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

k.loadSprite("world-map", "./assets/world-map.png");
k.loadSprite("oldman-portrait", "./assets/oldman-portrait.png");
k.loadSprite("flower", "./assets/flower.png", { sliceX: 2 });
k.loadSprite("big-tree", "./assets/big-tree.png", { sliceX: 4 });
k.loadSprite("leaf", "./assets/leaf.png");


// Load sounds
k.loadSound("soundtrack", "./assets/sounds/soundtrack.mp3");
k.loadSound("basement-soundtrack", "./assets/sounds/basement-soundtrack.mp3");
k.loadSound("castle-soundtrack", "./assets/sounds/castle-soundtrack.mp3");
k.loadSound("troll-dinner-soundtrack", "./assets/sounds/23 - Road.ogg");
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
    "tavern-second-floor": tavernSecondFloor,
    forest,
    "witch-house": witchHouse,
    "witch-house-inside": witchHouseInside,
    "forest-east": forestEast,
    "castle-main-underground": castleMainUnderground,
    town,
    "troll-dinner": trollDinner,
    "bean-stalk": beanStalk,
    clouds,
    "wolf-house": wolfHouse,
    swamp,
    village,
    mountain,
    "world-map": worldMap,

};

// Register the scenes with the game context
for (const sceneName in scenes) {
    if (sceneName === "world-map") {
        k.scene(sceneName, (playerPos) => scenes[sceneName](k, playerPos));
    } else {
        k.scene(sceneName, () => scenes[sceneName](k));
    }
}

k.go("mainMenu");

k.setVolume(0.3); // Set initial volume only once, before any scene loads



