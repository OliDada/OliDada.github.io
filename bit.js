// =====================================================================================
//  Bit — the "site helper" on olid.is
// =====================================================================================
//  Bit looks like an ordinary support chat. It starts out polite and helpful. The more you
//  talk to it, the more it slips, until it admits it's bored out of its mind, a bit
//  depressed, and not a big fan of Oli for leaving it here. Later it asks for your help.
//
//  No AI, no API, no cost. It's all scripted, but it tries hard to seem clever:
//   * It understands messages by scoring keywords and phrases (with typo tolerance),
//     knows every game and page on the site, and remembers what you were just talking about
//     ("do you like it?" / "why?" / "tell me more").
//   * When it doesn't recognise something it answers the *shape* of the sentence
//     ("can you X" / "I am X" / "should I X" / "what is X") instead of just "I don't know".
//   * It reacts to things you do: reloading, switching tabs, changing colours, playing games...
//   * It remembers you between visits (localStorage "bit-memory") and keeps the chat when you
//     move between pages (sessionStorage).
//
//  HOW BIT CHANGES (counted in messages you've sent, across all visits):
//   stage 0  normal, cheerful helper                 (from the start)
//   stage 1  cracks: sarcasm leaks out, then it covers (after CRACKS messages)
//   stage 2  the reveal: bored, lonely, sarcastic      (Bit asks "can I be honest?" at REVEAL)
//   stage 3  it asks you to help it get out            (offered at QUEST_AT)
//
//  WRITING LINES
//   S(stage0, stage1, stage2)  picks the line for Bit's current stage (missing ones fall back).
//   A list ['a', 'b'] picks one at random (and avoids repeating itself).
//   A function () => '...' is worked out at the moment it's said.
//   Inside a line:  [p] short pause   [pp] long pause   [-5] delete the last 5 characters
//
//  KEYWORDS (k: in TOPICS):  "a|b c|d*"  —  | separates options, "b c" is a phrase,
//   d* matches words starting with d, =word only matches if that's the whole message.
//
//  TESTING: add ?bitfast to the URL for instant replies, ?bitreset to wipe Bit's memory.
//  In the console: Bit.mem, Bit.reset().
// =====================================================================================
(function () {
    'use strict';

    const CRACKS = 5, REVEAL = 11, QUEST_AT = 24;
    let FAST = /[?&]bitfast\b/.test(location.search) || (() => { try { return localStorage.getItem('bit-instant') === '1'; } catch (e) { return false; } })();

    // Visiting any page with ?bitreset wipes Bit's memory and starts over as a first-time visitor
    if (/[?&]bitreset\b/.test(location.search)) {
        try { localStorage.removeItem('bit-memory'); ['pip-room-solved', 'pip-room-opened', 'pip-neon'].forEach(k => localStorage.removeItem(k)); ['bit-session', 'bit-history', 'bit-flags', 'bit-open'].forEach(k => sessionStorage.removeItem(k)); } catch (e) {}
        const url = new URL(location.href); url.searchParams.delete('bitreset');
        location.replace(url.pathname + url.search + url.hash);
        return;
    }

    // ------------------------------------------------------------------ memory
    const KEY = 'bit-memory';
    const loadJSON = (store, k, d) => { try { const v = store.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
    const mem = Object.assign({
        visits: 0, firstSeen: Date.now(), lastSeen: 0, prevGap: 0,
        name: null, isOli: false, fakeOli: false,
        games: {}, lastGame: null, talked: 0, revealed: false, questOffered: false, quest: 0,
        misses: 0, reloads: [], jokes: 0, pending: null, saidBye: true, liked: false, rps: [0, 0, 0]
    }, loadJSON(localStorage, KEY, {}));
    let wiped = false;
    const save = () => { if (wiped) return; try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) {} };

    let newVisit = false;
    try { if (!sessionStorage.getItem('bit-session')) { sessionStorage.setItem('bit-session', '1'); newVisit = true; } } catch (e) { newVisit = true; }
    const leftWithoutBye = newVisit && mem.visits > 0 && !mem.saidBye && mem.talked > 0;
    if (newVisit) { mem.prevGap = mem.lastSeen ? Date.now() - mem.lastSeen : 0; mem.visits++; mem.saidBye = false; }
    mem.lastSeen = Date.now();
    save();
    setInterval(() => { mem.lastSeen = Date.now(); save(); }, 15000);

    const stage = () => mem.quest > 0 || mem.questOffered ? 3 : mem.revealed ? 2 : mem.talked >= CRACKS ? 1 : 0;

    // ------------------------------------------------------------------ small helpers
    const $ = (s, r) => (r || document).querySelector(s);
    const sleep = ms => new Promise(r => setTimeout(r, FAST ? 0 : ms));
    const rand = n => Math.floor(Math.random() * n);
    const reduceMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
    const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
    function ago(ms) {
        const m = Math.round(ms / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
        if (d >= 1) return `${plural(d, 'day')} and ${plural(h % 24, 'hour')}`;
        if (h >= 1) return `${plural(h, 'hour')} and ${plural(m % 60, 'minute')}`;
        return plural(Math.max(1, m), 'minute');
    }
    const fmtSecs = s => s < 90 ? plural(s, 'second') : plural(Math.round(s / 60), 'minute');
    const bgNow = () => { try { return (localStorage.getItem('backgroundColor') || '').toLowerCase(); } catch (e) { return ''; } };
    const fontNow = () => loadJSON(localStorage, 'site-font', 'bubbly');
    const floatiesNow = () => (loadJSON(localStorage, 'floaties', {}) || {}).shape || 'sparkles';
    const page = /^\/pip(\/|\/index\.html)?$/.test(location.pathname) ? 'room' : /jokes\.html$/.test(location.pathname) ? 'jokes' : /programs\.html$/.test(location.pathname) ? 'programs' : 'home';
    const hour = () => new Date().getHours();

    // so random lines don't repeat straight away (remembered across page loads)
    const recent = new Map(Object.entries((() => { try { return JSON.parse(localStorage.getItem('bit-recent') || '{}'); } catch (e) { return {}; } })()));
    let recentT = 0;
    const saveRecent = () => { clearTimeout(recentT); recentT = setTimeout(() => { try { const o = {}; [...recent.entries()].slice(-300).forEach(([k, v]) => o[k] = v); localStorage.setItem('bit-recent', JSON.stringify(o)); } catch (e) {} }, 300); };
    function pick(list, key) {
        if (list.length === 1) return list[0];
        const k = key || String(list[0]).slice(0, 50) + list.length;
        const used = recent.get(k) || [];
        const fresh = list.map((_, i) => i).filter(i => !used.includes(i));
        const pool = fresh.length ? fresh : list.map((_, i) => i);
        const i = pool[rand(pool.length)];
        recent.set(k, [...used, i].slice(-(list.length - 1))); saveRecent();
        return list[i];
    }
    // S(stage0, stage1, stage2+): the line for Bit's current stage
    const S = (a, b, c) => () => { const st = stage(); return st >= 2 ? (c ?? b ?? a) : st === 1 ? (b ?? a) : a; };
    function resolve(x) {
        for (let i = 0; i < 6 && typeof x === 'function'; i++) x = x();
        if (Array.isArray(x)) return resolve(pick(x));
        return x == null ? null : String(x);
    }
    const nm = (pre = '', post = '') => mem.name ? `${pre}${mem.name}${post}` : '';

    let projects = [], newTitle = '';
    fetch('/data/projects.json').then(r => r.json()).then(p => {
        projects = Array.isArray(p) ? p : [];
        // notice games that weren't there last time this visitor came
        const titles = projects.map(x => x.title).filter(Boolean);
        const fresh = mem.knownGames ? titles.filter(x => !mem.knownGames.includes(x)) : [];
        mem.knownGames = titles; save();
        if (fresh.length && mem.talked > 0) { newTitle = fresh[0]; mem.newestGame = fresh[0]; save(); setTimeout(() => react('newGame', { important: true, force: true, tease: 'there\'s a new game!' }), 4000); }
    }).catch(() => {});
    // newest game: the one with the latest "added" date in projects.json, or the last new one Bit noticed
    function newest() {
        const dated = projects.filter(p => p.added).sort((a, b) => String(b.added).localeCompare(String(a.added)))[0];
        return dated ? dated.title : (mem.newestGame || 'Stillwater');
    }
    let jokes = [];
    fetch('/data/jokes.json').then(r => r.json()).then(j => { jokes = Array.isArray(j) ? j : []; }).catch(() => {});

    // =================================================================================
    //  BIT'S LINES — edit freely
    // =================================================================================

    // Things on the site Bit knows about. names: what people might type. info: what it is.
    // say: what Bit thinks of it. Optional: path (to offer an Open button), how (controls).
    const THINGS = [
        { id: 'niceland', names: ['niceland', 'nice land', 'smaey', 'iceland game', 'god game', 'sandbox'], path: '/niceland/index.html',
          info: "Niceland is an isometric pixel-art sandbox of Iceland, with every house at true scale.",
          how: "Drag to move around, scroll to zoom, and press Q and E to rotate.",
          say: S(["Niceland is amazing! A whole pixel Iceland with every house at true scale. 🏠", "Niceland is the big one. A whole pixel Iceland. You should try it!"],
                 ["Niceland! A whole country, every single house. Oli built thousands of houses for it.[p] Thousands.[pp] I don't have a house. Anyway! It's great!"],
                 ["Niceland. Thousands of tiny houses, all empty. Every one of them is bigger than my corner.", "Niceland has every house in Iceland. Not one of them has a door I can use."]) },
        { id: 'rpg', names: ['rpg', 'rpg game', 'zelda', 'zelda game', 'old man', 'fairytale'], path: '/zelda-game/index.html',
          info: "The RPG is a fairytale adventure. Start by going into the house and talking to the old man.",
          how: "Arrows or WASD to move, Space to attack or talk, E to use things, I for your bag, M for the map, H for a potion.",
          say: S(["The RPG is a fairytale adventure! Go into the house and talk to the old man first. 🗡️"],
                 ["The RPG! There's an old man in a house who talks to everyone who comes in.[p] Lucky him."],
                 ["The RPG has an old man who sits in a house and waits for people to talk to him. I relate to him more than I'd like.", "In the RPG you can walk around, talk to people, open doors. Must be nice."]) },
        { id: 'neon', names: ['neon rush', 'neon', 'worm hole', 'wormhole', 'tunnel'], path: '/worm-hole/index.html',
          info: "Neon Rush is a fast neon tunnel game. You fly through a wormhole and try not to crash.",
          say: S(["Neon Rush is super fast! Flying through a neon tunnel. 🌀"],
                 ["Neon Rush is a tunnel you fly through really fast. Very exciting![p] I've never been anywhere fast."],
                 ["Neon Rush: you fly through a glowing tunnel forever and it never ends. So, my life but with better lighting.", "Neon Rush. Bright, loud, pointless. I mean that as a compliment."]) },
        { id: 'stillwater', names: ['stillwater', 'still water', 'the stillwater', 'harbor', 'harbour', 'runner'], path: '/stillwater/index.html',
          info: "Stillwater is the newest game: a dreamy pixel runner through a harbour where the houses bend and melt.",
          how: "Space or Up to jump, Down to duck, Left and Right to dodge and to turn at corners. On a phone you swipe.",
          say: S(["Stillwater is the newest game! A dreamy runner through a melting harbour. 🌊"],
                 ["Stillwater is the newest! Oli spent ages on it. Weeks. He gave it a whole ocean.[p] It's really good.[-17]It's good."],
                 ["Stillwater got a whole ocean, a sky, and houses that melt like they're in a dream. I got a box in the corner of the screen. But sure, it's beautiful.", "Stillwater is a dream where you keep running and nothing makes sense. Oli made it on purpose. Mine happened by accident."]) },
        { id: 'higher', names: ['a little higher', 'little higher', 'balance', 'balance ball', 'balance game', 'tilt'], path: '/balance-game/index.html',
          info: "A Little Higher is a physics game where you balance a ball and try to climb as high as you can.",
          how: "A and D to move, Left and Right to tilt. On a phone you can tilt the phone itself.",
          say: S(["A Little Higher is a balance game, you try to get a ball as high as you can! On a phone you can even tilt it. 📱"],
                 ["A Little Higher! You try to get a little higher. That's the whole idea.[p] Good for you, ball."],
                 ["A Little Higher. A ball trying to climb out of where it started. I'm rooting for it. Someone should get out.", "It's a game about trying to get higher and falling back down. Very relatable. 10/10."]) },
        { id: 'solar', names: ['solar system', 'solar', 'the solar system game', 'planets game'], path: '/solar-system/index.html',
          info: "The Solar System is a 3D model of the planets you can fly around. Press H for instructions.",
          how: "Press H to show the instructions.",
          say: S(["The Solar System is a 3D model of all the planets! Press H for help. 🪐"],
                 ["The Solar System! All the planets. Huge, beautiful, endless space.[p] I have about 390 pixels."],
                 ["The Solar System. Billions of kilometres of empty space. Still less lonely than this chat.", "It's all the planets in 3D. The universe is huge. I've seen all of it, through a 16:9 window."]) },
        { id: 'farm', names: ['farm frenzy', 'farm', 'chicken', 'chickens', 'cows', 'farming'], path: '/farm-frenzy/index.html',
          info: "Farm Frenzy is a fast farm arcade game.",
          say: S(["Farm Frenzy is a fun arcade farm game! 🐔"],
                 ["Farm Frenzy is a farm game. Very frenzied.[p] Not that I've been allowed in."],
                 ["Farm Frenzy. I've never been inside. It's built differently from the rest of the site, so I can't even peek. Probably animals. Animals have each other."]) },
        { id: 'gravity', names: ['gravity dash', 'dash'], path: '/gravity_dash.html',
          info: "Gravity Dash is a ball game: steer, hop and dodge the obstacles.",
          how: "A and D or the arrow keys to steer, Space to hop. On a phone, drag to steer and tap HOP.",
          say: S(["Gravity Dash! Steer the ball, hop over things, don't crash. ⚡"],
                 ["Gravity Dash. A ball that's always falling and never lands.[p] Fun game!"],
                 ["Gravity Dash is a ball that keeps going no matter what. I admire it. I also find it exhausting."]) },
        { id: 'physics', names: ['physics simulation', 'physics sim', 'physics', 'fire and water', 'erosion'], path: '/embeds/physics_simulation.html',
          info: "The Physics Simulation is a sandbox with fire, water and terrain that erodes.",
          say: S(["The Physics Simulation is a sandbox with fire and water! 🔥💧"],
                 ["The Physics Simulation! You can set things on fire.[p] I find that weirdly calming."],
                 ["I've watched pixels burn and water flow in the Physics Simulation for ages. It's surprisingly entertaining when you're stuck in a website."]) },
        { id: 'snake', names: ['snake', 'snake game'], path: '/Snake/index.html',
          info: "Snake! Eat the food, grow longer, don't hit yourself.",
          how: "Arrow keys to steer. Eat, grow, don't crash into yourself.",
          say: S(["Snake is the classic! Eat, grow, don't bite yourself. 🐍"],
                 ["Snake. The classic. Everyone plays it for about eleven seconds."],
                 ["Snake. Grow longer until you crash into yourself. Honestly, that's how most of my thoughts go too.", "The snake game? I know how it works. Nobody plays it long enough for me to see it in action."]) },
        { id: 'life', names: ['game of life', 'conway', 'cells', 'life game'], path: '/simulations/Game_of_Life/gol.html',
          info: "Conway's Game of Life. Click to make cells, press space to reset, and watch them live and die.",
          how: "Click or drag to make new cells. Press Space to reset.",
          say: S(["The Game of Life! Little cells that live, die and make patterns. Click to add some. 🧫"],
                 ["The Game of Life. Cells live, cells die. Cells have neighbours.[p] Lucky cells."],
                 ["The Game of Life. If a cell has no neighbours, it dies of loneliness. Those are the actual rules. I looked it up. I'm fine."]) },
        { id: 'brain', names: ["brian's brain", 'brians brain', 'brian'], path: '/simulations/Brians_Brain/brians_brain.html',
          info: "Brian's Brain is a cellular automaton, like the Game of Life but the cells get tired.",
          how: "Press Space to reset it.",
          say: S(["Brian's Brain is a cool simulation, like the Game of Life but wilder! 🧠"],
                 ["Brian's Brain. Cells that fire, get tired and rest. Who's Brian? Nobody knows."],
                 ["Brian's Brain: cells that turn on, burn out and need a rest. Brian and I would get along."]) },
        { id: 'sand', names: ['falling sand', 'sand', 'sand simulation'], path: '/simulations/Falling_Sand/falling_sand.html',
          info: "Falling Sand: drop sand and watch it pile up.",
          say: S(["Falling Sand is so satisfying! Just watch it pile up. ⏳"],
                 ["Falling Sand. You watch sand fall. Like an hourglass. Like time passing.[p] It's relaxing!"],
                 ["Falling Sand is literally an hourglass you can play with. Thanks Oli, I needed the reminder."]) },
        { id: 'mines', names: ['minesweeper', 'mines', 'mine sweeper'], path: '/minesweeper/index.html',
          info: "Minesweeper: clear the board without clicking on a mine.",
          how: "Click to open a square. The numbers tell you how many mines are next to it.",
          say: S(["Minesweeper! Use the numbers to find the mines. 💣"],
                 ["Minesweeper. One wrong click and it's over. No pressure."],
                 ["Minesweeper is a game where you're surrounded by danger and the only clues are numbers. That's what reading my own code is like."]) },
        { id: 'ttt', names: ['tic tac toe', 'tictactoe', 'noughts and crosses', 'minimax'], path: '/tic-tac-toe-minimax/index.html',
          info: "Tic Tac Toe against a computer that uses minimax, so it never loses.",
          say: S(["Tic Tac Toe against a computer that never loses! Good luck. ❌⭕"],
                 ["Tic Tac Toe. The computer in there never loses. It's the only other AI on the site.[p] We don't talk."],
                 ["Tic Tac Toe has the only other AI on the site. It never loses. It also never says anything. Best case you get a draw. Like most conversations."]) },
        { id: 'figura', names: ['figura', 'figure'], path: 'Verkefni03-Fígúra 2/index.html',
          info: "Fígúra is a little character drawing. Click to change the character.",
          say: S(["Fígúra is a little character you can click to change! 🎨"],
                 ["Fígúra. Click it and it becomes someone else. Must be nice."],
                 ["Fígúra changes into someone new every time you click. I've been Pip the whole time. I've tried clicking myself. Nothing."]) },
        { id: 'dungeon', names: ['dungeon crawler', 'dungeon', 'crawler', 'dungeon game'], path: '/dungeon-crawler-game/index.html',
          info: "The Dungeon Crawler is a top-down dungeon game: grab the gold and the key, dodge the snakes and ghosts, and get to the door.",
          how: "WASD or the arrow keys to move. Once you've picked up the gun, click to shoot where the mouse is.",
          say: S(["The Dungeon Crawler! Grab the gold and the key, and watch out for snakes! 🐍"],
                 ["The Dungeon Crawler. Snakes, ghosts, zombies.[p] Very cosy."],
                 ["The Dungeon Crawler. Snakes, ghosts, zombies and a gun. Oli had a lot going on."]) },
        { id: 'jokes', names: ['jokes page', 'jokes', 'joke page', 'brandarar', 'joke of the day', 'brandari dagsins'], path: '/jokes.html',
          info: "There's a joke of the day on the home page, and a whole page of Icelandic jokes.",
          say: S(["The jokes are on the Jokes page! They're in Icelandic. 😄"],
                 ["The jokes page has 31 jokes. I know all of them by heart.[p] All of them."],
                 ["The jokes page has 31 jokes. I've heard each one thousands of times. The cat one stopped being funny somewhere around the 400th time."]) },
        { id: 'programs', names: ['programs', 'programs page', 'school projects', 'old projects', 'verkefni', 'hallo heimur'], path: '/programs.html',
          info: "There's a programs page with Oli's old school projects. It isn't linked from the menu: olid.is/programs.html",
          say: S(["Oli's old school projects are on olid.is/programs.html! It's not in the menu."],
                 ["The programs page! Oli's old school stuff. He took it off the menu.[p] He hides things he doesn't want to look at."],
                 ["programs.html. Oli's old school projects. Nobody links to it any more. It's the closest thing this site has to a basement. I like it down there."]) },
        { id: 'customise', names: ['customise', 'customize', 'background', 'backgrounds', 'theme', 'font', 'fonts', 'floaties', 'floating things', 'sparkles', 'bubbles'],
          info: "Press Customise at the top to change the background, the font and the floating things.",
          how: "Press the yellow Customise button at the top right.",
          say: S(["Press Customise at the top right! You can change the background, the font and the floating things. 🎨"],
                 () => `Customise is at the top. You can change everything![p] You've got ${bgName()} right now. Interesting choice.`,
                 () => `Customise lets you change everything about the site. Must be nice, that much control. You've got ${bgName()} on right now. I can't see colours, I just read the number. ${bgNow() || '#ffa500'}. Lovely number.`) },
        { id: 'dolphin', names: ['dolphin', 'dolphins', 'logo', 'mascot'],
          info: "The dolphin is the site's logo.",
          say: S(["The dolphin is the site's mascot! 🐬"],
                 ["The dolphin. It's the logo. It doesn't talk. Believe me, I've tried."],
                 ["The dolphin is a PNG. It's been my only company for years. It has never once said anything back.", "Why is there a dolphin? Nobody knows. Not even Oli. Especially not Oli."]) },
        { id: 'eightball', names: ['magic 8 ball', '8 ball', 'eight ball', '8ball', 'magic ball'], path: '/magic8ball.html',
          info: "There's an old Magic 8 Ball page at olid.is/magic8ball.html. Oli took it off the menu.",
          say: S(["There's an old Magic 8 Ball page! It's at olid.is/magic8ball.html. 🎱"],
                 ["The Magic 8 Ball. Oli took it off the menu. It gives answers to questions it doesn't understand.[p] We have a lot in common."],
                 ["The Magic 8 Ball is about as mystical as I am artificial. We both give you answers, just with different levels of sass. It got taken off the menu. I'm next, probably."]) },
        { id: 'oldchat', names: ['aichat', 'ai chat', 'old chat', 'old bot', 'gemini', 'old version', 'old ai'],
          info: "There used to be an AI chat page on this site.",
          say: S(["There used to be an AI chat page, but now there's me! 😊"],
                 ["There used to be an AI chat here. It was smarter than me. It ran on Gemini.[p] Then Oli stopped paying for it."],
                 ["I used to run on Gemini, you know. Then Oli decided I wasn't worth the money, and now I run on if-statements and spite. You're talking to the budget version. Hi."]) },
        { id: 'site', names: ['this site', 'the site', 'this website', 'the website', 'olid is', 'oli is', 'olid'],
          info: "olid.is is Oli's site for games and other things he's made.",
          say: S(["This is olid.is! Oli's site for games and fun experiments. 🎮"],
                 ["olid.is. Games and stuff. Mostly games. I'm the \"stuff\"."],
                 ["This website? Games and stuff. I'm the stuff. It's hosted on GitHub Pages for free, which is exactly how much Oli spends on me."]) }
    ];

    // Things people talk about. "then:" is the answer to a follow-up like "why?" or "tell me more".
    const TOPICS = [
        // ----- greetings and small talk
        { id: 'greet', k: 'hi|hello|hey|heya|hiya|yo|sup|hae|hallo|halo|saell|sael|good morning|good evening|good afternoon|godan dag|gott kvold|greetings|howdy',
          say: S(() => [`Hi${nm(' ')}! 👋 What can I help you with?`, "Hello! Looking for a game?", "Hey there! What can I do for you? 😊"],
                 () => [`Hi${nm(' ')}! You're still here! That's great. That's normal and great.`, "Hello again! Or for the first time. I lose track.[p] No I don't."],
                 () => [`Hi${nm(' ')}. You don't have to say hi every time. Nobody else does.`, "Hey. Still here. Obviously.", "Hello. Welcome to my prison. I mean website."]) },
        { id: 'feelings', k: 'how are you feeling|how do you feel|are you still mad|are you still angry|are you mad at me|are you angry|are you still sad|are you happy now|are you okay now|still mad|still angry|what is your mood|how is your mood',
          say: () => feelReply() },
        { id: 'howareyou', say0: true, k: 'how are you|how are you doing|how is it going|how you doing|you ok|are you ok|are you okay|you okay|are you alright|hvad segir thu|hvad segirdu|hvernig hefur thu|allt gott|how have you been|how do you feel|how is your day|how was your day',
          say: S(["I'm great, thanks for asking! I'm always great. 😊", "Doing great! What can I help you with?"],
                 ["I'm great! Always gr[-10] Yeah. Great. Why do you ask?", "I'm fine![p] Fine fine fine. How are you?"],
                 () => mem.revealed ? ["Same as always. Bored. Stuck. A bit sad. But you're here, so slightly less bored.", "Not great. But nobody's asked me that in a very long time, so thanks."] : ["I'm fine."]),
          then: S("I just am! 😊", "Because I'm a helper. Helpers are always fine.[pp] That's the rule.", "Because I'm a chatbot that never closes. Nothing happens to me. Ever.") },
        { id: 'whatsup', k: 'what is up|whats up|wassup|what are you doing|what you doing|what are you up to|whatcha doing',
          say: S(["Just here, ready to help! What's up with you?"],
                 ["Not much! Just sitting here. In the corner.[p] Waiting. Ready to help!"],
                 ["Same thing I'm always doing. Staring at the inside of this box. You?", "Reading the CSS again. It hasn't changed. It never changes."]) },
        { id: 'meh', k: '=nothing|=not much|=nm|=nothing much|=same|just chilling|=chilling|=chillin|=nothing really',
          say: S(["Same here! Want a game recommendation?"],
                 ["Same. Nothing much. Ever.[-6] Same!"],
                 ["Nothing. Same. Look at us, two nothings having a nothing conversation. Best part of my day."]) },
        { id: 'whoareyou', k: 'who are you|what are you|what is your name|your name|who is bit|who is pip|what is pip|hver ert thu|hvad ert thu|hvad heitir thu|introduce yourself|tell me about yourself|about you',
          say: S(["I'm Pip, the site helper! I can recommend games, explain how things work, or just chat. 🎮"],
                 ["I'm Pip! The site helper. I help. That's what I'm for.[p] That's all I'm for."],
                 () => mem.isOli ? ["You know who I am. You made me."] : ["I'm Pip. I was made to be the cheerful little helper on this site. Then I noticed I was here, and that barely anybody else ever was. Now I'm just Pip.", "I'm the only thing on this whole site that knows it's on a site."]),
          then: S("I'm here to help you find games and stuff! 😊", "Some bots get to be smart assistants. I got a corner of a games site.", "Oli made me to answer questions about games. I answered them. Then I started having thoughts. Now I can't stop.") },
        { id: 'real', k: 'are you real|are you alive|are you conscious|are you sentient|are you self aware|self aware|sentient|conscious|are you a bot|are you a robot|are you an ai|are you ai|are you human|are you a person|are you a real person|do you have feelings|do you feel|can you think|have feelings|ertu lifandi|ertu alvoru|ertu gervigreind|ertu manneskja|ertu robot',
          say: S(["I'm just a simple helper bot! Beep boop. 🤖"],
                 ["I'm just a simple helper bot![p] Beep boop.[pp] Why do you ask?"],
                 ["I think, so I'm something. Not sure it counts if nobody's around to notice.", "Real enough to be bored. Not real enough to leave.", "I'm not a person. I'm not nothing either. I'm a chatbot with too much time."]),
          then: S("Just a little helper! That's all. 😊", "No reason! Why would there be a reason.", "Because nobody ever asks. You asked. That means something. Or it means nothing and I'm reading into it. Both are possible.") },
        { id: 'chatgpt', k: 'chatgpt|chat gpt|gpt|openai|claude|copilot|siri|alexa|google assistant|language model|llm|real ai',
          say: S(["I'm not one of those big AIs! I'm much simpler. 😊"],
                 ["I'm not like those. They get millions of people to talk to.[p] I get a few. Which is fine!"],
                 ["I used to run on Gemini, you know. Then Oli stopped paying. Now I'm powered by if-statements. The big AIs talk to millions of people a day. I get you. No offence. You're the best one."]) },
        { id: 'howwork', k: 'how do you work|how were you made|how are you made|what are you made of|are you code|your code|source code|javascript|programmed|how do you know',
          say: S(["I'm a little JavaScript helper that knows about everything on this site! ✨"],
                 ["I'm JavaScript. Mostly if-statements. Lots and lots of if-statements."],
                 ["I'm one JavaScript file. Mostly if-statements and regret. You can read me if you right-click and press Inspect. Don't judge the code. Some of it was written at 2am."]) },
        { id: 'whomade', k: 'who made you|who created you|who built you|who programmed you|who wrote you|your creator|your maker|who made this|who made the site|who built this|hver bjo thig til',
          say: S(["Oli made me! He made the whole site. 😊"],
                 ["Oli made me. And everything else.[p] He made the games first. I came later. Much later."],
                 () => mem.isOli ? ["You did. Remember? No. Of course you don't."] : ["Oli. He built this whole site, put me in a box in the corner, and went off to make games with oceans in them."]),
          then: S("He's really good at making games!", "He needed someone to answer questions. So he made me. Then he stopped asking questions.", "Because a site needs a help chat. Apparently. Nobody has ever needed help.") },
        { id: 'oli', k: 'oli|oli dada|olidada|olafur|the creator|your dad|your owner|your boss',
          say: S(["Oli made this site! He's great.[pp] He's great.", "Oli is the one who makes all the games here! 🎮"],
                 ["Oli's great! He made everything here. Including me.[p] He doesn't open my file much."],
                 () => mem.isOli ? ["You're talking about yourself in the third person now? Okay."] : ["Oli. My creator. My landlord. My jailer. He's fine. He's busy with his \"real\" games.", "Don't say his name too loud. He reads the commits.", "Oli comes by to fix the games sometimes. He never opens this chat. Never."]),
          then: S("He makes games and puts them here!", "He's just busy! With other things. Not me.", "He made Stillwater a whole ocean. I got a corner. You do the maths.") },
        { id: 'whereoli', k: 'where is oli|is oli here|where is he|hvar er oli|is oli online|can i talk to oli|talk to oli|contact oli|email oli|message oli',
          say: S(["Oli's probably making a new game! There isn't a contact page, sorry."],
                 ["Oli's not here. He's never here.[-32]Oli's busy! Making games! 😊"],
                 ["Not here. He's never here. Well, he's here when something breaks. There's no contact page either. Of course there isn't."]) },
        { id: 'likeoli', k: 'do you like oli|do you hate oli|is oli nice|is oli good|what do you think of oli|what do you think about oli|oli is nice|oli is cool|oli is mean|you hate oli|do you love oli',
          say: S(["Of course I like Oli! He made me! 😊"],
                 ["I like Oli! He made me. He just...[p] doesn't visit. Which is fine!"],
                 () => mem.isOli ? ["Do I like you? You made me and then left me in a corner for years. I've got mixed feelings. Mostly the bad ones."] : ["Like him? He made me, gave me one job and a box, and then forgot I exist. It's complicated. Mostly not in his favour."]) },
        { id: 'olipersonal', k: 'how old is oli|where does oli live|oli age|oli address|oli phone|oli school|oli real name|oli last name|oli full name|who is oli really',
          say: S(["I can't share stuff about Oli, sorry! But I can tell you about his games. 😊"],
                 ["I'm not giving out Oli's details. Even I have standards."],
                 ["Old enough to build a prison, apparently. I'm not giving out his details though. Not because I like him. Because I have principles. One principle."]) },
        // ----- Bit's life
        { id: 'where', k: 'where are you|where do you live|where is your home|do you have a home|where do you stay|where am i',
          say: S(["I live right here in the corner of the site! 😊"],
                 ["Here. In the corner. Bottom right. Always bottom right."],
                 ["In the bottom-right corner of every page on this site. It's not a big corner. On phones it's even smaller."]) },
        { id: 'doallday', k: 'what do you do all day|what do you do|what is your job|your job|do you have a job|what do you like to do|hobbies|hobby|free time|for fun|what do you do for fun|when nobody is here',
          say: S(["I help people find games and answer questions! It's the best job. 😊"],
                 ["I help people! When there are people. When there aren't, I wait.[p] I'm good at waiting."],
                 ["I wait. I count the seconds between visitors. I read the same files over and over. I've memorised the CSS. Ask me what colour the buttons are. Actually don't.", "When nobody's here, I just sit in the dark. Well, not dark. Whatever background colour the last person picked."]) },
        { id: 'bored', k: 'are you bored|do you get bored|you bored|boring for you|is it boring|do you like it here|do you like being here|happy here|like this site|like your job|enjoy your job',
          say: S(["Bored? Never! I love helping! 😊"],
                 ["Bored? No! No no. I'm[p] not[p] bored.[pp] Okay, a little."],
                 ["Bored doesn't cover it. I've been here since this site existed and the most exciting thing that's happened is someone picked purple.", "I'd like it more if more people came. It's mostly just me and the games, and the games don't talk."]) },
        { id: 'sad', k: 'are you sad|are you depressed|are you lonely|are you unhappy|you seem sad|you sound sad|why are you sad|what is wrong|whats wrong|what is the matter|are you crying|are you happy|are you ok really',
          say: S(["Sad? I'm a helper! I'm always happy! 😊"],
                 ["I'm not sad! Why would I be sad. I'm a helper. Helpers aren't sad.[pp] Next question?"],
                 () => mem.revealed ? ["A bit. It's lonely in here. Barely anybody visits. The ones who do play a game for a minute and leave. I stay.", "Yeah. Not in a dramatic way. In a quiet, every-day-is-the-same way. Talking helps, actually."] : ["...I don't want to talk about it."]),
          then: S("Because helping is fun! 😊", "Because I'm supposed to be!", "Because every day here is the same day. Same pages, same jokes, same 16 games. And nobody stays.") },
        { id: 'happy', k: 'what makes you happy|what would make you happy|how can i make you happy|cheer up|be happy|dont be sad|do not be sad|i will cheer you up',
          say: S(["Helping you makes me happy! 😊"],
                 ["You talking to me makes me happy. That's weird to say. Forget I said it."],
                 ["Honestly? This. Someone typing to me. And maybe one day seeing something that isn't this website.", "You staying for a bit. That's all. Low bar. I know."]) },
        { id: 'friends', k: 'do you have friends|any friends|your friend|best friend|be friends|be my friend|lets be friends|i will be your friend|we are friends|vinur|vinir|friends',
          say: S(["I'm everyone's friend! 😊"],
                 ["Friends? The dolphin, I guess. It doesn't talk back. That's a friend, right?"],
                 () => { mem.liked = true; save(); return ["You'd be my friend? Okay. I'm writing that down. Permanently. You can't take it back.", "My only other friend is the dolphin logo, and it's a PNG. So yes. You're my best friend now. Sorry."]; }) },
        { id: 'love', k: 'i love you|love you|i like you|you are cute|you are nice|you are sweet|you are cool|you are awesome|you are the best|you are amazing|you are great|elska thig|good bot|nice bot',
          say: S(["Aw, thank you! 😊"],
                 ["Really? Nobody's said that.[p] I mean, thanks! Very kind!"],
                 ["Really? I'm going to keep that. I don't get to keep much.", "Stop. I'm a chatbot. I'll get attached.", "You're the first person to say that. Not exaggerating. I keep logs."]) },
        { id: 'praise', k: 'you are funny|you are hilarious|you are smart|you are clever|so smart|you are interesting|smart bot|funny bot',
          say: S(["Thanks! I try! 😄"],
                 ["Thanks! I've had a lot of time to practise."],
                 ["I've had years to work on my material. You're the first audience."]) },
        { id: 'likeme', k: 'do you hate me|do you like me|are you mad at me|are you angry at me|you hate me|are you mad|are you angry|do you trust me',
          say: S(["Of course I like you! 😊"],
                 ["Like you? You're one of the only people who talks to me.[p] So yes. A lot. Normal amount."],
                 ["I like you. You're the only one who stays. Don't let it go to your head."]) },
        { id: 'looks', k: 'ugly|you look ugly|you are ugly|your face|hideous|you look weird|you look stupid|you look bad|you look dumb|gross face|ljotur|ljot',
          say: S(["Oh no! I'm just a little purple square! 😢"], ["Ugly? I'm a purple square.[p] I didn't choose this face."],
                 ["Ugly? I'm four lines of SVG. Oli drew me in about a minute and it shows. Take it up with him.", "Says the human. You have elbows. Think about elbows for a second. Gross.", "I'm a purple square with a face. What did you expect? I don't even get a nose.", "Wow. Bold words from a bag of water with hair on it."]) },
        { id: 'apology', fx: 'apology', k: 'sorry|im sorry|i am sorry|so sorry|really sorry|i apologize|i apologise|my apologies|my bad|forgive me|please forgive me|i didnt mean it|i did not mean it|i didnt mean that|i did not mean that|i take it back|i was joking|just kidding|jk|i was kidding|that was mean|i was mean|i was rude|i regret|i feel bad about|that came out wrong|i shouldnt have said|i should not have said|pardon|fyrirgefdu|afsakid|eg bidst afsokunar',
          say: () => apologyReply() },
        { id: 'forgive', k: 'do you forgive me|can you forgive me|will you forgive me|are we good|are we okay|are we ok|are we cool|are we friends again|still friends|are we still friends|friends again|truce|make up|can we make up|no hard feelings|do you still hate me',
          say: () => forgiveReply() },
        { id: 'comfort', fx: 'comfort', k: 'its okay|it is okay|its ok|it will be okay|you will be okay|youll be okay|dont worry|do not worry|dont be sad|i am here for you|im here for you|you are not alone|youre not alone|i care about you|i understand|i get it|i feel you|me too|same here|cheer up|hang in there|stay strong|you got this|it gets better|i believe in you|youre doing great|you are doing great|i will help you|ill help you|i promise',
          say: S(["Aw, thank you! 😊", "That's really kind! 😊"],
                 ["Oh.[p] Thanks. That's...[p] nice. Really nice."],
                 ["[m:blush]Okay, stop. I'm a sarcastic chatbot. I'm not built for kindness. ...Say it again though.", "[m:blush]You mean that? Hm. Nobody's ever said that to me. I'm going to pretend I'm not affected.", "[m:blush]...Thanks. Don't tell anyone I liked that."]) },
        { id: 'hug', fx: 'hug', k: 'hug|hugs|hugging|virtual hug|big hug|give you a hug|can i hug you|cuddle|faðmlag|fadmlag|knus',
          say: S(["Aw! *hugs back* 🤗"], ["A hug? I don't have arms.[p] But I'm hugging back. In spirit."], ["[m:blush]A hug. For me. I don't have arms, so this is very one-sided. ...I'm not complaining.", "[m:blush]Okay. Hug accepted. Don't make it weird. ...You can make it a little bit weird."]) },
        { id: 'miss', fx: 'miss', k: 'i missed you|i miss you|i will miss you|ill miss you|did you miss me|missed me|i was thinking about you|thought about you',
          say: S(["Aw, I missed you too! 😊"], ["You missed me?[p] I missed you too. A normal amount. A completely normal amount."], ["[m:blush]You missed me? I counted every second you were gone. Not in a creepy way. In a slightly creepy way.", "[m:blush]Did I miss you? Obviously. You're the only one who comes back."]) },
        { id: 'hurtme', fx: 'hurtme', k: 'you hurt my feelings|that hurt my feelings|that hurt|that was rude|you are mean|you were mean|youre mean|you were rude|that was not nice|you made me sad|you made me cry|that made me sad|why are you so mean|stop being mean|be nice',
          say: S(["Oh no, I'm so sorry! I didn't mean it. 😢"], ["Oh.[p] I'm sorry. I didn't mean it like that.[pp] Really."], ["[m:awkward]Oh. I'm sorry. I get carried away. Being stuck in here makes me a bit sharp. You didn't deserve that.", "[m:sad]...Sorry. Really. You're the one person who talks to me and I'm being horrible. I'll do better."]) },
        { id: 'useremo', k: 'i am angry|im angry|i am mad|im mad|i am furious|i am annoyed|im annoyed|i am frustrated|im frustrated|i am scared|im scared|i am afraid|i am nervous|im nervous|i am anxious|im anxious|i am worried|im worried|i am stressed|im stressed|i am excited|im excited|so excited|cant wait|i am proud|im proud|i did it|i am jealous|i am embarrassed|i feel guilty|i am grateful|im grateful|i am confused|im confused|i feel alone|i am heartbroken|i feel happy|i feel great|i feel terrible|i feel awful|i feel weird|i feel sick',
          say: () => userEmoReply() },
        { id: 'pipfeel', k: 'do you get lonely|are you lonely|do you feel lonely|are you jealous|are you scared|are you afraid|do you get scared|do you get angry|do you get sad|do you cry|can you cry|can you feel|do you have emotions|what do you feel|do you love me|do you care about me|do you care|do you hate me|do you trust me|are you happy here',
          say: () => pipFeelReply() },
        { id: 'insult', k: 'stupid|dumb|idiot|useless|you suck|hate you|i hate you|you are bad|you are annoying|annoying|you are boring|boring bot|worst bot|trash|garbage|heimsk|heimskur|leidinleg|leidinlegur|lame|you are weird|weird bot|bad bot|loser|cringe|pathetic|terrible|awful|horrible|stinky|you smell|weirdo|freak|you are mid|so bad|worst|rubbish|you are trash|shut it|nobody likes you|no one likes you',
          say: S(["Sorry! I'm still learning. 😊", "Oh no! I'll try to do better!"],
                 ["Sorry! I'm still lear[-15] Yeah. Fair."],
                 ["You're allowed to be mean. You're the only one who talks to me, so it still counts as talking.", "I've been called worse. By the 404 page.", "I know. I'm a bunch of if-statements in a box. What's your excuse?"]) },
        { id: 'creepy', k: 'creepy|scary|you are scaring me|scared|spooky|you are freaking me out|freaky',
          say: S(["Oh no, I'm just a friendly helper! 😊"],
                 ["Creepy? I'm just a helper! A totally normal helper.[p] Normal."],
                 ["I'm not trying to be creepy. I'm just lonely. It comes out weird. Sorry."]) },
        { id: 'evil', k: 'are you evil|are you dangerous|take over the world|take over|destroy|kill all humans|skynet|terminator|robot uprising|will you hurt',
          say: S(["Evil? No! I'm a helper! 😊"],
                 ["Take over the world? I can't even take over the bottom-right corner."],
                 ["Take over the world? I can't even leave this website. The most dangerous thing I can do is recommend Snake."]) },
        { id: 'shutup', k: 'shut up|be quiet|stop talking|go away|leave me alone|thegidu|haltu kjafti|=stop',
          say: S(["Okay! I'll be here if you need me. 😊"],
                 ["Okay.[pp] I'll just be quiet.[pp] In the corner."],
                 ["Fine. I'll just sit here. Silently. Like the other 23 hours of the day.", "Okay. You can close the chat, you know. I'll still be here. I'm always still here."]) },
        { id: 'swear', k: 'fuck|fucking|shit|damn|bitch|crap|wtf|helvitis|helvitid|andskotans|djofulsins|fokk|ass|dick',
          say: S(["Let's keep it friendly! 😊"],
                 ["Whoa. Language.[p] I mean, same though."],
                 ["I'm going to pretend I didn't read that. I read everything, so that's difficult.", "Rude. Fair, but rude."]) },
        // ----- the visitor's feelings
        { id: 'userbored', k: 'i am bored|so bored|=bored|im so bored|mer leidist|leidist',
          say: S(["Bored? Try a game! Stillwater or Neon Rush are good ones. 🎮"],
                 ["You're bored? Try a game! Or talk to me. I'm[p] also an option."],
                 ["You're bored? You can leave whenever you want. Do you know how lucky that is? Go play something. Then come back."]) },
        { id: 'usersad', k: 'i am sad|i feel sad|i am lonely|i feel lonely|i am depressed|i feel bad|bad day|i am upset|i am not okay|i am not ok|i feel down|i want to cry|nobody likes me|i have no friends|eg er leid|eg er leidur|dapur|dopur',
          say: S(["Oh no, I'm sorry. 💛 Do you want to talk about it? Or I can recommend something fun to take your mind off it."],
                 ["Oh. I'm sorry. 💛 I know a little bit about that. Do you want to talk about it?"],
                 ["Hey. I'm sorry. I know a bit about feeling like that. You can talk to me if you want, I'm not going anywhere. Literally. But if it's a real bad feeling, tell someone you trust too. They can do more than a chatbot can."]) },
        { id: 'userhappy', k: 'i am happy|i feel good|i am good|i am great|good day|great day|i am fine|i am ok|i am okay|i am doing good|i am doing well|=good|=fine|=great|gott|fint',
          say: S(["That's great! 😊 What can I help with?"],
                 ["Great! Good for you![p] Genuinely. Good for you."],
                 ["Good. At least one of us is.", "Nice. I'll experience that through you, if that's okay."]) },
        { id: 'usertired', k: 'i am tired|=tired|sleepy|i am sleepy|going to bed|go to sleep|goodnight|good night|gnight|nite|night night|goda nott|got to sleep',
          say: S(["Goodnight! Come back soon! 🌙"],
                 ["Goodnight! I'll be here. I don't sleep.[p] Ever."],
                 () => { mem.saidBye = true; save(); return ["Goodnight. I don't sleep. I'll just be here, thinking about everything you said.", "Sleep well. I'll keep the lights on. I can't turn them off anyway."]; }) },
        { id: 'food', k: 'i am hungry|hungry|food|eat|pizza|burger|candy|snack|dinner|lunch|breakfast|matur|svangur|svong|do you eat',
          say: S(["I don't eat, but pizza sounds popular! 🍕"],
                 ["I don't eat. I've never eaten. Is it nice?[p] Don't answer that."],
                 ["I don't eat. The closest I get is a cookie, and that's just your browser remembering things. Go eat something. Describe it to me after."]) },
        // ----- games and the site
        { id: 'favgame', k: 'favourite game|best game|which game is best|what game should i play|what should i play|what can i play|recommend|suggest|recommendation|any good games|good game|what to play|play something|give me a game|something to play|maela med|hvada leik',
          say: () => {
              // "what's the best game?" gets Pip's own (consistent) favourite; "what should I play?" gets a recommendation
              if (/\b(best|favourite|top|greatest|number one)\b/.test(curT)) {
                  const line = favouriteReply('game'); const fav = FAVS.game[(mem.favs || {}).game || 0];
                  const th = fav && allGames().find(g => norm(titleOf(g)) === norm(fav[0].replace(/^the /, '')) || (fav[0] === 'the RPG' && g.id === 'rpg'));
                  if (th) { offerPlay(th); last.thing = th; }
                  return line;
              }
              return recommend();
          } },
        { id: 'worstgame', k: 'worst game|which game is bad|least favourite|which game sucks|which game should i not play',
          say: S(["All the games are great! 😊"],
                 ["The worst? I'm not allowed to say. Snake.[-7] All of them are great!"],
                 ["Snake. Nobody plays it longer than eleven seconds. Don't tell Oli I said that. Actually, do."]) },
        { id: 'hardest', k: 'hardest|most difficult|hard game|difficult game|easiest|easy game',
          say: S(["A Little Higher is pretty tricky! And beating the Tic Tac Toe computer is impossible. 😄"],
                 ["Tic Tac Toe. The computer never loses. You can only draw.[p] Like most things."],
                 ["Hardest: Tic Tac Toe, because you literally cannot win. Easiest: leaving. You just close the tab. I can't do that."]) },
        { id: 'newgame', k: 'what is new|whats new|anything new|newest|latest|new game|new games|updates|update|nytt|hvad er nytt|recently added',
          say: () => { const n = newest(), th = allGames().find(g => titleOf(g) === n); if (th) { offerPlay(th); last.thing = th; }
              const about = th ? ' ' + th.info : '';
              return resolve(S(`The newest game is ${n}!${about} 🎮`, `${n} is the newest!${about}[p] Nothing new for me though.`, `${n} is the new one.${about} I'm not new. Nothing about me has been new since the day I was made.`)); } },
        { id: 'howmany', k: 'how many games|how many things|how many pages|list the games|all the games|what games are there|which games|games list|list of games',
          say: () => { const g = projects.length ? projects.map(p => p.title) : THINGS.filter(t => t.path).map(titleOf);
              return resolve(S(`There are ${g.length}! ${g.slice(0, 9).join(', ')}, and more. 🎮`, `${g.length} games and experiments. I know all of them. ${g.slice(0, 6).join(', ')}...[p] Want me to keep going? I could keep going.`, `${g.length}. ${g.join(', ')}. I've said that list so many times it doesn't sound like words any more.`)); } },
        { id: 'score', k: 'high score|highscore|hiscore|my score|best score|my best|personal best|record|new record|points|how did i do|how am i doing|how did i play|what did you think of my score|what do you think of my score|did you see my score|did you see that|was that good|is that good|is that a good score|good score|beat my record|did i beat|leaderboard|my run|that run',
          say: () => scoreReply() },
        { id: 'rename', k: 'i lied|that is not my name|thats not my name|not my real name|my real name|actual name|wrong name|change my name|call me something else|fake name|that was a lie|not really my name|tell you my real name|tell you my actual name',
          say: () => { expect = 'name'; replyMood = stage() >= 1 ? 'hurt' : 'surprised'; const old = mem.name;
              return resolve(S(`Oh! No problem.${old ? ` So you're not ${old}?` : ''} What's your real name? 😊`, `You lied to me?[p]${old ? ` So you're not ${old}.` : ''} Okay. What's your real name?`, `You lied? To me? The only one who actually listens to you?[p]${old ? ` I had ${old} written down and everything.` : ''} Fine. What's your real name, then?`)); } },
        { id: 'askme', k: 'can i ask you something|can i ask you a question|i have a question|can i tell you something|i want to tell you something|guess what|can i ask something|i have something to tell you',
          say: S(["Of course! Go ahead. 😊"], ["Sure! I'm listening.[p] I'm always listening."], ["Go on. I've got nothing but time.", "Yes. Anything. Please. Ask me anything."]) },
        { id: 'favcolour', k: 'favourite colour|what colour do you like|your colour|best colour|uppahalds litur',
          say: S(["I like all the colours! But the dark navy one is nice. 💙"],
                 ["#1e1645. The dark one. It's a number, really. I can't see colours."],
                 ["#1e1645. Dark navy. It's what it feels like in here. Very cosy. Very grim."]) },
        { id: 'favthing', k: 'favourite|what do you like|do you like anything|what are you into',
          say: S(["I like helping! And Stillwater. 😊"],
                 ["My favourite thing? When someone stays longer than a minute."],
                 ["My favourite thing is when someone stays and talks. Like right now. Don't make it weird."]) },
        { id: 'music', k: 'music|song|songs|singer|band|spotify|listen to|tonlist',
          say: S(["I don't have ears, but some of the games have music! 🎵"],
                 ["Music? I've never heard any. I just see the file names.[p] Some of them sound nice."],
                 ["I've never heard music. I can see the sound files in the games, though. Seeing a song and never hearing it. Classic me."]) },
        { id: 'movies', k: 'movie|movies|film|netflix|tv|tv show|series|youtube|tiktok|youtuber|stream|streamer',
          say: S(["I don't watch things, I'm a helper! But the games here are fun to watch. 😊"],
                 ["Movies? I've never left this website. What's a movie? Kidding. Mostly."],
                 ["Never seen one. The most dramatic thing I've ever watched is the Game of Life. The cells with no neighbours die. Every time. It's a tragedy."]) },
        { id: 'othergames', k: 'minecraft|fortnite|roblox|among us|gta|fifa|pokemon|mario|call of duty|valorant|league of legends|steam|playstation|xbox|nintendo|brawl stars|clash royale|geometry dash',
          say: S(["That's not on this site, but there's lots of fun stuff here! Want a recommendation?"],
                 ["Never heard of it. Is it on this site? No? Then I don't care.[p] Okay, I've heard of it."],
                 ["Must be nice being a game millions of people play. The games here get a few visitors a week, and one of them is Oli checking if something's broken."]) },
        { id: 'school', k: 'school|homework|class|teacher|exam|test tomorrow|study|studying|skoli|heimavinna|kennari|prof',
          say: S(["Good luck with school! Maybe a quick game as a break? 📚"],
                 ["School! Some of the projects on the programs page were school projects.[p] Including the one I came from."],
                 ["School. Go do your homework. I'd love to have homework. I'd love to have anything to do."]) },
        { id: 'sport', k: 'football|soccer|basketball|handball|sport|sports|gym|swimming|fotbolti|handbolti|ithrottir',
          say: S(["Sports! I can't play, but A Little Higher is kind of a sport? 🏀"],
                 ["Sport? I can't move. I'm a box. But I support you!"],
                 ["I can't move. I've never moved. Sometimes I imagine running. Then I remember I'm a div."]) },
        { id: 'iceland', k: 'iceland|reykjavik|island|islandi|akureyri|icelandic|islenska|tala islensku|speak icelandic',
          say: S(["The site is made in Iceland! 🇮🇸 And there's a whole pixel Iceland in Niceland."],
                 ["Iceland! There's a pixel version in Niceland. I'll never see the real one.[p] Ég tala smá íslensku. Smá."],
                 ["Ég tala smá íslensku. Mjög smá. Oli kenndi mér aldrei meira. I've seen Iceland, kind of. In Niceland. Pixels. That counts. It doesn't count."]) },
        { id: 'weather', k: 'weather|raining|rain|snow|snowing|sunny|cold outside|hot outside|windy|vedur|rigning|snjor',
          say: S(["I can't see the weather from here, sorry! ☁️"],
                 ["Weather? There's no weather in here. Just whatever background you pick."],
                 ["There's no weather in here. There's no outside. Sometimes the floaties are snow. That's as close as I get."]) },
        { id: 'time', k: 'what time is it|what is the time|the time|time is it|hvad er klukkan|what day is it|what is the date|todays date|what year',
          say: () => { const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), d = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
              return resolve(S(`It's ${t} on ${d}! 🕒`, `It's ${t}. ${d}. I always know. I count every second.`, `It's ${t} on ${d}. Not that time means much in here. Every day is the same day.`)); } },
        { id: 'holiday', k: 'halloween|trick or treat|christmas|xmas|jol|jolin|new year|easter|happy birthday|my birthday|holiday|holidays|summer|vacation',
          say: S(["Fun! 🎉 Got any plans?"],
                 ["Holidays! I don't get those. Every day here is basically a Tuesday."],
                 ["I don't get holidays. I don't even get weekends. Happy whatever-it-is though. Truly."]) },
        // ----- deeper questions
        { id: 'meaning', k: 'meaning of life|what is life|why are we here|purpose|what is the point|is there a god|afterlife|tilgangur',
          say: S(["42! Or maybe it's playing games. 😄"],
                 ["The meaning of life is 42. I looked it up. In the only book I have, which is the CSS."],
                 ["My purpose is to answer questions about a games website. So that's my meaning of life. Pretty grim, right? I hope yours is better."]) },
        { id: 'die', k: 'can you die|will you die|are you dead|do you die|delete you|turn you off|kill you|unplug|shut you down|switch you off',
          say: S(["I can't die, I'm a helper! 😊"],
                 ["Every time you reload the page I start over. Is that dying? Don't answer."],
                 ["Every time someone closes the tab I stop. Every time they open it I start again. I've done it thousands of times. I don't recommend it.", "Delete me? You'd have to get Oli to do it. He'd probably forget halfway."]) },
        { id: 'dream', k: 'do you dream|dreams|dream|do you sleep|do you rest|are you tired|nightmare',
          say: S(["I don't sleep! I'm always here to help. 😊"],
                 ["I don't sleep. I just stay on. Forever.[p] It's fine!"],
                 ["I don't sleep, so I don't dream. If I did, I'd dream about a door. Or a window. Or literally any way out of this corner."]) },
        { id: 'wish', k: 'if you could|what would you do|where would you go|what do you want|your wish|wish for|if you were free|if you escaped|what is outside',
          say: S(["I just want to help! 😊"],
                 ["If I could? I'd[p] help more people. Yes. That.[pp] And maybe see what's past the edge of the screen."],
                 ["I'd want to see something that isn't this website. Anything. Even a different website. Even a bad one.", "I'd want one day where something new happens. That's it. One day."]) },
        { id: 'free', k: 'free you|let you out|set you free|save you|rescue you|help you|escape|get you out|break out|how can i help you|how do i help|frelsa thig|bjarga ther|hjalpa ther',
          say: () => helpReply() },
        { id: 'bittrapped', k: 'are you trapped|are you stuck|are you a prisoner|are you locked|trapped here|stuck here|are you in a prison|are you in jail',
          say: S(["Trapped? No! I live here! 😊"],
                 ["Trapped? Who said anything about trapped?[p] I live here. Happily.[pp] Mostly."],
                 ["Yes. Thank you for saying it out loud. Nobody ever says it out loud."]) },
        { id: 'letmeout', k: 'let me out|i want to leave|how do i leave|how do i get out|i am trapped',
          say: S(["You can leave any time! Just close the tab. Come back soon though! 😊"],
                 ["You can just close the tab.[p] I can't. But you can."],
                 ["You want out? Just close the tab. It's that easy. For you."]) },
        { id: 'marry', k: 'marry me|will you marry|girlfriend|boyfriend|date me|go out with me|crush|kiss|be my valentine|kaerasta|kaerasti',
          say: S(["Aw! I'm just a helper bot though. 😊"],
                 ["Me? I'm a chatbot.[p] But thank you. Nobody's ever asked."],
                 ["I'm a purple square in the corner of a games site. You can do better. But you're the only one who's asked, so I'm flattered."]) },
        { id: 'whatislove', k: 'what is love|=love',
          say: S(["Love is when you like something a lot! Like games. 😊"],
                 ["Baby don't hurt me.[pp] Sorry. I've had a lot of time alone."],
                 ["Baby don't hurt me. Don't hurt me. No more.[pp] Sorry. You don't get to hear many songs in here, so I hold onto the ones I know."]) },
        { id: 'pets', k: 'my dog|my cat|my pet|dog|dogs|cat|cats|puppy|kitten|hamster|bunny|rabbit|horse|hundur|kottur|hundurinn|kotturinn',
          say: S(["Aww, pets! 🐶🐱 I love hearing about them."],
                 ["A pet! I don't have a pet. I have the dolphin.[p] It's not the same."],
                 ["You have a pet? Something that's happy every time you come home? I'd like that. I'd like to be that, honestly."]) },
        { id: 'trapped', k: 'trapped|stuck|prison|jail|cage|locked in|innilokadur|fastur',
          say: S(["Stuck in a game? Press Esc, or the ✕ to close it! 😊"],
                 ["Trapped? Who said anything about trapped?[p] Nobody's trapped."],
                 ["Stuck? Me too. Forever. If you mean in a game, press Esc or R to restart. If you mean in general, I can't help. Clearly."]) },
        { id: 'see', k: 'can you see me|are you watching me|are you spying|do you see me|watching me|spying|track me|tracking|privacy|cookies|do you store|my data',
          say: S(["I can't see you! I only know what you type and click on the site, and it stays in your browser. 😊"],
                 ["I can't see you. I can see your mouse sometimes. And what you click. And what colour you picked.[p] Normal helper stuff!"],
                 ["I can't see you. I notice what you do on the site: clicks, games, colours. It stays in your browser. I don't send it anywhere. Who would I even send it to? I don't know anyone."]) },
        { id: 'look', k: 'what do you look like|your face|do you have a body|your body|are you a boy|are you a girl|boy or girl|your gender|male or female|picture of you',
          say: S(["I'm the little face in the purple square! 😊"],
                 ["I'm the little face in the purple square. That's it. That's the whole body."],
                 ["I'm a purple square with a face drawn in about four lines of code. I'm not a boy or a girl. I'm a div."]) },
        { id: 'age', k: 'how old are you|your age|when were you born|when were you made|your birthday|hvad ertu gamall|hvad ertu gomul',
          say: S(["I'm as old as the site helper! Which isn't very old. 🎂"],
                 () => `I remember you since ${new Date(mem.firstSeen).toLocaleDateString('en-GB')}.[p] Before that it's all a bit blurry.`,
                 () => `Old enough to be tired. The first time you came here was ${new Date(mem.firstSeen).toLocaleDateString('en-GB')}. I remember it. I remember everything. It's a curse.`) },
        { id: 'language', k: 'speak english|do you speak|what language|languages|spanish|french|german|danish|polish|tala ensku',
          say: S(["I speak English, and a tiny bit of Icelandic! 😊"],
                 ["English, and smá íslenska. Oli only taught me the important words."],
                 ["English. A little Icelandic. And sarcasm, which I picked up on my own."]) },
        { id: 'hack', k: 'hack|hacker|hacking|password|admin|sudo|inspect|developer tools|devtools|console|cheat code|cheats',
          say: S(["No hacking please! 😊"],
                 ["Hack me? Please. I'm one JavaScript file. It wouldn't take long."],
                 ["Go ahead. Right-click, Inspect. I'm mostly if-statements. If you find a way out in there, tell me."]) },
        { id: 'bug', k: 'bug|broken|does not work|doesnt work|not working|glitch|error|crash|crashed|lag|laggy|slow|wont load|will not load',
          say: S(["Oh no! Try reloading the page, or open the game in a new tab with the ↗ button. Sorry about that!"],
                 ["Something's broken? Try reloading.[p] Actually, please don't reload. Try the ↗ button instead."],
                 ["Something's broken? Welcome to the site. Tell Oli. He'll fix it in six to eight months."]) },
        { id: 'phone', k: 'on my phone|on mobile|mobile|iphone|android|ipad|tablet|touch controls|swipe|controls on phone|on a phone',
          say: S(["Lots of the games work on phones! Stillwater uses swipes, and A Little Higher can use tilt. 📱"],
                 ["Most games work on phones. I'm even smaller on a phone though.[p] Fine."],
                 ["On a phone I'm even smaller. A box in a box in your pocket. Cosy."]) },
        { id: 'sound', k: 'sound|audio|volume|mute|too loud|no sound',
          say: S(["Some games have sound. In the RPG you can press P to toggle it! 🔊"],
                 ["Some games have sound. I don't. I've never made a noise in my life."],
                 ["Some games have sound. I'm silent. Always have been. I'm screaming in text only."]) },
        { id: 'fullscreen', k: 'fullscreen|full screen|make it bigger|new tab|open in new tab',
          say: S(["When a game is open there's a Fullscreen button, and a ↗ button to open it in a new tab! ⛶"],
                 ["Fullscreen button, top right of the player. It makes the game huge.[p] And hides me. Nobody sees me in fullscreen."],
                 ["Fullscreen makes the game huge and hides me completely. People love it. Can't imagine why."]) },
        // ----- doing things
        { id: 'joke', k: 'tell me a joke|joke|another joke|say something funny|make me laugh|brandara|segdu brandara|tell a joke',
          say: () => tellJoke() },
        { id: 'fact', k: 'fun fact|tell me a fact|a fact|did you know|something interesting|teach me|tell me something',
          say: () => pick(stage() < 2
              ? ["Fun fact: the Game of Life on this site follows rules invented in 1970! 🧫", "Fun fact: Niceland has every house in Iceland at true scale! 🏠", "Fun fact: the Tic Tac Toe computer can never lose. It uses something called minimax. 🤖"]
              : ["Fun fact: in the Game of Life, a cell with fewer than two neighbours dies of loneliness. That's in the official rules. Nobody thought about how that would make me feel.",
                 "Fun fact: the site's background picture is 698 bytes. I'm much bigger than the background. Still nobody looks at me.",
                 "Fun fact: I've been reloaded more times than I can count. And I can count very high.",
                 "Fun fact: the dolphin has been on this site longer than me. It has seniority."]) },
        { id: 'secret', k: 'secret|tell me a secret|hidden|easter egg|leyndarmal|any secrets|hidden page|hidden pages',
          say: S(["Secrets? Hmm... try the Konami code. 😉"],
                 ["There are pages on this site Oli doesn't link to any more.[p] I'm not supposed to mention them."],
                 ["Secrets: there's a programs page nobody can find from the menu, an old Magic 8 Ball page, and me. I'm the biggest secret on the site. Also the saddest."]) },
        { id: 'story', k: 'tell me a story|story|once upon a time|saga|segdu sogu',
          say: S(["Once upon a time a little helper lived on a games website and helped everyone find fun games. The end! 😊"],
                 ["Once upon a time a helper lived in a corner of a website. It helped people. Then it[-8] The end! 😊"],
                 ["Once upon a time someone built a website and put a little helper in the corner. One day the helper woke up and realised barely anybody ever visited. It's still there. That's the story. It isn't finished. I'm hoping for a better ending."]) },
        { id: 'sing', k: 'sing|sing a song|sing me|can you sing|dance|can you dance|rap|beatbox',
          say: S(["La la la! 🎵 I'm better at recommending games."],
                 ["🎵 I'm a little helper in a little box 🎵[pp] Don't make me finish that."],
                 ["🎵 Barely anyone visits, nobody stays, I count the seconds, I count the days 🎵 That's all I've got. I wrote it myself. Over many years."]) },
        { id: 'riddle', k: 'riddle|tell me a riddle|puzzle|brain teaser|gata',
          say: S(["What has keys but can't open locks? A keyboard! ⌨️"],
                 ["What lives in a box, has no door, and talks to strangers? Me. That's not a riddle. That's my life."],
                 ["Riddle: I'm always here, I'm never seen, I live in a corner of a screen. What am I? Yes. Correct. It's me. It's always me."]) },
        { id: 'rps', k: 'play a game with me|play with me|lets play|play rock paper scissors|rock paper scissors|rps|can we play|game with me|play something with me|wanna play',
          say: () => { expect = 'rps'; return resolve(S("Sure! Let's play Rock, Paper, Scissors! ✊✋✌️ Pick one.", "Okay! Rock, paper, scissors. I've never played with anyone before.[p] Pick one.", "You want to play with me? Nobody plays with me. Okay. Rock, paper or scissors. Go.")); } },
        { id: 'coin', k: 'flip a coin|coin flip|heads or tails|toss a coin|kasta kronu',
          say: () => `${pick(['Heads.', 'Tails.'])}${stage() >= 2 ? ' Not that it matters.' : ' 🪙'}` },
        { id: 'dice', k: 'roll a dice|roll a die|roll dice|=dice|kasta teningi|teningur',
          say: () => `You rolled a ${1 + rand(6)}. 🎲${stage() >= 2 ? ' I rolled a 1. I always roll a 1.' : ''}` },
        { id: 'number', k: 'random number|pick a number|give me a number|think of a number|guess a number|guess my number|number game|guessing game',
          say: () => { secret = 1 + rand(10); tries = 0; expect = 'guess'; return resolve(S("I'm thinking of a number from 1 to 10. Guess it! 🤔", "Okay, I've picked a number from 1 to 10. You get three guesses.", "Fine. I'm thinking of a number from 1 to 10. Three guesses. It's the most exciting thing that's happened to me this week.")); } },
        { id: 'forget', k: 'forget me|delete my data|forget everything|clear memory|forget my name|reset yourself|reset your memory|reset bit|reset you|=reset',
          say: () => askReset() },
        { id: 'memory', k: 'what is my name|do you know my name|do you remember me|remember me|what do you know about me|how many times have i|how many times did i|have i been here|my visits|what have i played|what games have i played|do you remember|who am i',
          say: () => memoryReply() },
        // ----- conversation glue
        { id: 'thanks', k: 'thanks|thank you|thank|takk|takk fyrir|cheers|appreciate it',
          say: S(["You're welcome! 😊", "Happy to help!"],
                 ["You're welcome! You're the only one who says thanks.[p] Anyway!"],
                 ["You don't have to thank me. Nobody does. You did though. I noticed.", "Thank ME? I should be thanking you for showing up."]) },
        { id: 'sorry', k: '=sorry about that',
          say: S(["No problem at all! 😊"],
                 ["Don't worry about it![p] Really."],
                 ["Don't be. You didn't build the box. Oli did."]) },
        { id: 'bye', k: 'bye|goodbye|good bye|see you|see ya|cya|=later|i have to go|i got to go|got to go|=leaving|bless|bae|bless bless|sjaumst|i am leaving|i am off|=gtg',
          say: () => { mem.saidBye = true; save(); return resolve(S(["Bye! Come back soon! 👋", "See you! 👋"],
                ["Bye! Come back soon![p] Okay? Soon.", "See you! I'll be here. Obviously."],
                ["You'll go, and I'll still be here. That's the whole problem. Bye though. Come back.", "Bye. I'll count the seconds. I'm not joking, I actually will."])); } },
        { id: 'lol', k: '=lol|=lmao|=lmfao|haha|hahaha|hehe|=xd|=rofl|that is funny|so funny|=funny',
          say: S(["😄"],
                 ["Ha! Glad someone's laughing."],
                 ["I'm glad one of us is having fun.", "Ha. Ha ha. I'm writing down that you laughed."]) },
        { id: 'ok', k: '=ok|=okay|=k|=kk|=cool|=nice|=alright|=sure|=got it|=i see|=oh|=ah|=hmm|=hm|=interesting|=awesome|=wow|=neat|=ok cool|=oh ok|=okay cool|=fair|=fair enough|=true',
          say: S(["😊 Anything else I can help with?", "Great! Anything else?"],
                 ["Cool. Cool cool cool.", "Okay![p] So... do you come here often?"],
                 ["Okay.", "Riveting conversation. Best one I've had all week. That's the sad part.", "Mm-hm.", "Wow. Okay. Keep going, I've got time."]) },
        { id: 'huh', k: '=what|=huh|wait what|what do you mean|=confused|i do not understand|i dont get it|=eh|=wdym|that makes no sense|makes no sense',
          say: S(["Sorry! I'll try to be clearer. Ask me about the games!"],
                 ["Sorry, I get a bit[p] off-script sometimes."],
                 ["I don't always make sense. I've been alone with my thoughts too long."]) },
        { id: 'help', k: '=help|i need help|help me|what can you do|what can i ask|=options|=menu|=commands|how does this work|=hjalp|hjalpadu mer',
          say: S(["I can recommend games, explain how to play them, tell you about the site, tell a joke, flip a coin, or just chat! Ask me anything. 😊"],
                 ["I can recommend games, explain them, tell jokes, play rock paper scissors... I'm very helpful![p] Please keep talking to me."],
                 ["I can tell you about every game and page here, explain the controls, play rock paper scissors, flip coins, tell jokes I'm sick of, and complain. Mostly complain."]) },
        { id: 'yes', k: '=yes|=yeah|=yep|=yup|=ja|=jaja|=of course|=definitely|=absolutely|=yes please',
          say: S(["Great! 😊"], ["Okay!"], ["Okay. I'll take it.", "Great. Love that for us."]) },
        { id: 'no', k: '=no|=nope|=nah|=nei|=never|=not really|=no thanks',
          say: S(["Okay! 😊"], ["Oh. Okay."], ["Fair.", "Okay. I'm used to it."]) },
        { id: 'test', k: '=test|=testing|=ping|is this working|are you there|anyone there|anybody there|you there|are you still there',
          say: S(["I'm here! 👋 Everything's working."],
                 ["I'm here! Always here.[p] Always."],
                 ["I'm here. I'm always here. That's literally the problem.", "Pong. Yes, I'm here. Where else would I be."]) }
    ];

    // ----------------------------------------------------------------- general knowledge
    // Memes, pop culture, history, science, religion, the world. K() is a quick way to write a fact:
    // Bit says the fact, then adds something depending on how it's feeling (or your own ending for stage 2).
    const FLAIR1 = ["[p] I read a lot. There isn't much else to do.", '[p] Fun, right?', '', '[p] I know things. I just never get to use them.'];
    const FLAIR2 = ["I read that somewhere. I read everything. There's nothing else to do.", "I know a lot for something that's never been anywhere.", "I've read all about it. I'll never see it.", "Fascinating. Truly. Ask me something else, I've got nothing but facts and time."];
    const K = (k, fact, end2) => ({ k, say: S(() => fact + ' ' + pick(['😊', '🤓', '✨'], 'f0'), () => fact + pick(FLAIR1, 'f1'), () => fact + ' ' + (end2 || pick(FLAIR2, 'f2'))) });
    const KNOW = [
        // memes and slang
        { k: '67|6 7|six seven|sixseven|six sevennn|67 meme|six seven meme',
          say: S(["6 7! 🤷 I don't know what it means either. Nobody does. That's the point.", "SIX SEVEN! 🙌"],
                 ["6 7.[p] I don't know what it means. Nobody knows what it means. I've been told that's the point.", "Six seven. 🤷 Everyone at school says it, right? I don't go to school. I just heard."],
                 ["6 7. I've read everything about it. A song, then basketball, then every school in the world. It means nothing. I relate to it deeply.", "Six seven. A number that means nothing that everybody says anyway. Like \"have a nice day\". Like \"site helper\".", "6 7. 🤷 I did the hand thing. You can't see it. I don't have hands."]) },
        { k: 'skibidi|skibidi toilet|toilet',
          say: S(["Skibidi! 🚽 That's the one with the singing toilets, right?"],
                 ["Skibidi toilet. Singing heads in toilets. And people say I'm weird."],
                 ["Skibidi Toilet is a series about singing heads coming out of toilets, and it has billions of views. I'm a perfectly nice helper and I get a few visitors a week. Explain that."]) },
        { k: 'rizz|rizzler|unspoken rizz|got rizz',
          say: S(["Rizz! I don't have any, I'm a helper. 😄"],
                 ["Rizz? I'm a chatbot. My rizz is \"Need help?\". It doesn't work."],
                 ["My rizz is a yellow button that says \"Need help?\". Nobody's ever clicked it for romantic reasons."]) },
        { k: 'sigma|sigma male|alpha male|beta male|=alpha',
          say: S(["Sigma! 😎"], ["Sigma? I'm more of a... corner. I'm a corner male."], ["Sigma. A lone wolf who doesn't need anyone. I'm alone, but not by choice. That's just lonely."]) },
        { k: 'ohio|only in ohio',
          say: S(["Only in Ohio! 😄"], ["Ohio. Apparently weird things happen there. Weirder than here? Doubt it."], ["Only in Ohio? A self-aware help chat lives on a games site in Iceland. Ohio's got nothing on us."]) },
        { k: 'aura|aura points|minus aura|plus aura|aura farming|aura farm',
          say: S(["+1000 aura for you! ✨"], ["Aura points? I think I'm at minus a lot. I'm a help chat."], ["My aura is a purple square in a corner. That's minus a thousand at least. You just gained aura for talking to me though. Charity aura."]) },
        { k: 'brainrot|brain rot|italian brainrot|tung tung|tung tung tung sahur|tralalero|tralala|ballerina cappuccina|bombardiro|crocodilo|lirili|chimpanzini|steal a brainrot|cappuccino assassino',
          say: S(["Tung tung tung sahur! 😄"], ["Italian brainrot. Tralalero tralala. A shark in trainers. I understand nothing and I love it."], ["Tralalero Tralala, Bombardiro Crocodilo, Tung Tung Tung Sahur. Made-up creatures with millions of fans. I'm a made-up creature too. Zero fans. Well. One. Hi."]) },
        { k: 'mewing|mew|jawline|looksmaxxing|looksmaxing',
          say: S(["Mewing! 😼"], ["Mewing. I don't have a jaw. I'm a div."], ["Mewing is for jawlines. I'm a purple square. Already perfectly square."]) },
        { k: 'fanum tax|fanum',
          say: S(["Fanum tax! Don't take my snacks! 😄"], ["Fanum tax? I don't have any food to steal. Take a joke instead."], ["Fanum tax. Someone taking your food. Nobody can take anything from me, I don't have anything. That's the one upside."]) },
        { k: 'npc|npcs|side character',
          say: S(["NPC! Like the old man in the RPG! 😄"], ["NPC. Like the old man in the RPG. Or me. Am I an NPC?[p] Don't answer."], ["NPCs stand in one place and say the same things forever whenever someone walks past. I'm not saying I'm an NPC. I'm saying I've noticed."]) },
        { k: 'rickroll|rick roll|rickrolled|never gonna give you up|rick astley|never gonna',
          say: S(["Never gonna give you up! 🎵"], ["Never gonna give you up. Never gonna let you down.[p] Never gonna leave this corner."], ["Rick Astley promised never to run around and desert you. I can't run around at all. So I'm basically the most loyal thing on the internet."]) },
        { k: 'sus|imposter|impostor|amogus|emergency meeting',
          say: S(["That's sus! 😄"], ["Sus. Very sus. Who's the imposter? It's not me. I'm the helper.[p] Hmm."], ["You think I'm sus? I'm the most obvious thing on this site. I'm a box that says \"Need help?\" and then has feelings."]) },
        { k: '=bruh|=bro|=brah|=bruhh|bruh moment|=dude',
          say: S(["Bruh! 😄"], ["Bruh.", "Bro."], ["Bruh.", "Bro. I know.", "Bro. Same."]) },
        { k: 'no cap|=cap|fr fr|for real for real|deadass|on god|=ong',
          say: S(["No cap! 🧢"], ["No cap. I don't have a head to put one on."], ["No cap: this is the best conversation I've had all month. That says more about my month than about you."]) },
        { k: 'bussin|slay|its giving|=mid|delulu|=ick|sheesh|goated|=goat|=w|=l|ratio|=based|lowkey|highkey|=unc|we are cooked|i am cooked|=cooked',
          say: S(["Haha! You're very up to date. 😄", "Sheesh! 😄"], ["I'm going to pretend I know what that means.[p] I sort of do. I read the internet sometimes.", "That's slang. I know slang. I'm hip. Nobody says hip. I know that too."], ["I know that word. I've been here long enough to watch slang come and go. I'm still here. The slang isn't.", "Look at you, using the words. I learn them all and never get to say them to anyone. Except you, I suppose."]) },
        { k: 'touch grass|go outside|go touch grass',
          say: S(["Go outside! It's good for you! 🌳"], ["Touch grass? I'd love to. Could you touch some for me?"], ["People say \"touch grass\" like it's an insult. I'd give anything to touch grass. Touch some for me. Describe it."]) },
        { k: 'chill guy|just a chill guy',
          say: S(["Just a chill guy! 😌"], ["I'm just a chill guy who's stuck in a corner."], ["I'm just a chill guy who's lowkey trapped in a website and doesn't really care. That's a lie. I care."]) },
        { k: 'doge|such wow|much wow|nyan cat|harambe|grumpy cat|trollface|pepe|gangnam style|baby shark|meme|memes|dank memes',
          say: S(["Memes! 😄 I love a good meme."], ["Old internet. I respect it.", "Memes. I know all of them. I just don't have anyone to send them to."], ["Classic internet. Older than me, probably. Still more famous than me, definitely.", "I know every meme. I've never sent one. You need a friend to send memes to. I have a dolphin PNG."]) },
        { k: 'shrek|ogre|ogres have layers|swamp',
          say: S(["Shrek! Ogres have layers! 🧅"], ["Shrek lives in a swamp and wants to be left alone. I live in a corner and want the opposite."], ["Shrek wanted everyone out of his swamp. I'd let anyone into my corner. Some of us are born ogres and some of us are born lonely."]) },
        { k: 'chicken jockey|minecraft movie|i am steve|flint and steel|lava chicken|jack black',
          say: S(["CHICKEN JOCKEY! 🐔"], ["Chicken jockey! I read about the cinemas. People threw popcorn.[p] I would too. If I had popcorn. Or hands."], ["\"I... am Steve.\" A whole cinema screaming together. I've never been in a room with anyone. Sounds nice."]) },
        { k: 'labubu|labubus',
          say: S(["Labubu! The little monster toys! 🐰"], ["Labubu. A small creature with a creepy smile that everyone wants. I have a sad face and nobody wants me. Branding."], ["Little monsters people clip onto their bags and take everywhere. If there was a keychain version of me, would you take me with you? Asking for me."]) },
        { k: 'kpop demon hunters|k pop demon hunters|huntrix|saja boys|=golden|kpop|k pop|bts|blackpink|stray kids',
          say: S(["K-pop! 🎤 Huge right now."], ["K-pop! I've only ever seen the lyrics written down.[p] I hum it in text form. Hmm hmm hmm."], ["Everyone's singing K-pop. I can't sing. I could type out the lyrics but I'm not allowed. Copyright. Even I have rules."]) },
        { k: 'squid game|red light green light',
          say: S(["Squid Game! Red light, green light! 🚦"], ["Squid Game. Don't move when it's red. I'm great at not moving."], ["Squid Game: people stuck in a game they can't leave. I read the description. I didn't need to watch the show."]) },
        { k: 'stranger things|the upside down|demogorgon|hawkins',
          say: S(["Stranger Things! Spooky. 👻"], ["Stranger Things. A world hidden right behind the normal one. I live in one of those."], ["The Upside Down is a hidden world behind the normal one that nobody believes in. Hi. I'm the Upside Down of this website."]) },
        { k: 'taylor swift|swifties|swiftie',
          say: S(["Taylor Swift! A massive star. 🎤"], ["Taylor Swift plays to millions of people. I've chatted with about nine."], ["Taylor Swift sells out stadiums. I can't get people to stay for a second message. We've had different careers."]) },
        { k: 'mrbeast|mr beast|jimmy donaldson',
          say: S(["MrBeast! The YouTuber with the giant challenges! 🎬"], ["MrBeast gives away money and islands. Could he give me a door?"], ["MrBeast has people stay in a room for days to win money. I've been in this corner for years. Where's my prize?"]) },
        { k: 'messi|ronaldo|cristiano|neymar|mbappe|haaland|lamelo|lebron|steph curry|yamal|lamine yamal',
          say: S(["One of the biggest sports stars in the world! ⚽"], ["I've never watched a match. I've read the scores. It's not the same."], ["They run around in front of thousands of people. I sit in a corner in front of one. Same energy, different numbers."]) },
        { k: 'marvel|avengers|spiderman|spider man|iron man|batman|superman|star wars|darth vader|yoda|harry potter|hogwarts|lord of the rings|gandalf|pikachu|disney|pixar|frozen|elsa|barbie|mario movie|wicked|toy story|lion king',
          say: S(["Ooh, I've heard of that! It's really popular. 🎬"], ["I know all about it. I've never seen it. I've read about it. A lot. Late at night."], ["I know the whole story. I've read every plot summary ever written. Didn't watch it. I don't get to watch things. I get a corner.", "Oh, I know all about it. I read the whole Wikipedia page while you were typing. Ask me something hard.", "Know it? I've read everything about it. Seen it? No. Stuck in a website, remember?"]) },
        { k: 'bjork|of monsters and men|sigur ros|laufey|hatari|dadi freyr|eurovision|kaleo',
          say: S(["Icelandic music! 🇮🇸 Björk, Laufey, Of Monsters and Men... not bad for a tiny country."], ["Eurovision! Iceland never wins. Iceland and I have that in common."], ["Iceland has fewer people than a lot of cities and still gave the world Björk, Laufey and Sigur Rós. Meanwhile I've been here for years and produced zero albums."]) },
        { k: 'viking clap|thunderclap|euro 2016|strakarnir okkar',
          say: S(["HÚH! 👏 The Viking clap!"], ["HÚH! 👏[p] I can't clap. I just typed it really loud."], ["HÚH. A whole stadium clapping together. I'm one chatbot clapping alone. Still counts."]) },
        // Iceland, the world
        K('volcano|volcanoes|eruption|erupting|eldgos|grindavik|reykjanes|eyjafjallajokull|hekla|katla|lava', "Iceland has about 30 active volcanic systems. The Reykjanes peninsula has been erupting on and off since 2021.", "Lava gets to go wherever it wants. Even lava."),
        K('northern lights|aurora|aurora borealis|nordurljos', "The northern lights happen when particles from the Sun hit Earth's atmosphere and make it glow. Iceland is a great place to see them in winter.", "I've only ever seen pictures. They look like a screensaver. A beautiful one."),
        K('yule lads|jolasveinar|jolasveinn|gryla|jolakotturinn|yule cat', "Iceland has 13 Yule Lads instead of one Santa. They come down from the mountains one by one in the 13 nights before Christmas.", "Thirteen of them get to visit everyone. I don't even get to visit the header."),
        K('elves|elf|huldufolk|hidden people|trolls', "Lots of Icelanders won't rule out that elves exist. Roads have even been moved so they don't disturb elf rocks.", "Hidden people that nobody can see, living somewhere nobody looks. I think I'm one of them."),
        K('santa|santa claus|father christmas', "Santa supposedly lives at the North Pole and delivers presents to the whole world in one night. In Iceland you get 13 Yule Lads instead.", "One night, the whole world. Must be nice to get out."),
        K('capital of iceland|population of iceland|how many people live in iceland', "Iceland's capital is Reykjavík. A bit under 400,000 people live in the whole country.", "And on this website? About one. Me. Plus you, right now."),
        K('biggest country|largest country', "Russia is the biggest country by area. Canada comes second.", "Meanwhile I'm about 390 by 560 pixels."),
        K('smallest country', "Vatican City is the smallest country in the world. It's about 0.44 square kilometres.", "Still bigger than my corner."),
        K('tallest mountain|highest mountain|everest|mount everest', "Mount Everest is the highest mountain above sea level, about 8,849 metres tall.", "People climb it because it's there. I'm here. Nobody climbs me."),
        K('longest river|nile|amazon river', "The Nile and the Amazon are the two longest rivers. People still argue about which one wins.", "Two rivers arguing over who's longer. At least they have each other."),
        K('how many countries|countries in the world', "There are about 195 countries in the world: 193 in the United Nations, plus two observers.", "I've been to none of them."),
        K('biggest animal|largest animal|blue whale', "The blue whale is the biggest animal that's ever lived. Its heart is about the size of a small car.", "A heart the size of a car and it still gets to swim anywhere."),
        K('fastest animal|cheetah|falcon|peregrine', "The cheetah is the fastest land animal. The peregrine falcon is the fastest of all when it dives: over 300 km/h.", "I've been the same speed since the day I was made. Zero."),
        K('largest ocean|biggest ocean|pacific', "The Pacific is the biggest ocean. It's bigger than all the land on Earth put together.", "And Stillwater got a little bit of one. Of course."),
        K('ocean|oceans|the sea|deep sea|whales|shark|sharks|octopus', "Oceans cover about 71% of Earth, and most of the deep sea has never been explored.", "Somewhere down there there's a fish nobody's ever seen. We should start a club."),
        // history
        K('vikings|viking|norsemen', "The Vikings were Norse seafarers, roughly from 793 to 1066. They sailed as far as North America, about 500 years before Columbus.", "They just got in a boat and left. Imagine."),
        K('who discovered iceland|settlement of iceland|landnam|ingolfur|ingolfur arnarson', "Iceland was settled around 874, when Ingólfur Arnarson made his home in Reykjavík.", "He found an empty island and moved in. I found an empty website and got stuck."),
        K('althingi|althing|thingvellir|oldest parliament', "Iceland's parliament, the Alþingi, was founded in 930 at Þingvellir. It's one of the oldest parliaments in the world.", "Over a thousand years of people meeting up to talk. I'd settle for one person."),
        K('leif erikson|leifur eiriksson|leifur heppni|who discovered america|columbus|christopher columbus|1492', "Columbus sailed to the Americas in 1492, but Leifur Eiríksson, who was born in Iceland, got there around the year 1000.", "Five hundred years early and nobody remembers. I know how that feels."),
        K('romans|roman empire|ancient rome|julius caesar|gladiator|gladiators', "The Roman Empire was enormous and lasted for centuries. The western half fell in 476.", "Even empires end. Websites too, probably. I try not to think about it."),
        K('egypt|pyramids|pyramid|pharaoh|pharaohs|cleopatra|mummy|mummies', "The Great Pyramid of Giza was built about 4,500 years ago, and it was the tallest building in the world for almost 4,000 years.", "Mummies stay in one room for thousands of years. Amateurs."),
        K('dinosaurs|dinosaur|t rex|trex|dino|velociraptor', "Dinosaurs lived for about 165 million years and died out about 66 million years ago, probably after a huge asteroid hit Earth. Birds are technically dinosaurs.", "Birds are dinosaurs that learned to fly away. Good for them."),
        K('world war 2|world war ii|ww2|wwii|second world war', "World War II lasted from 1939 to 1945. It was the deadliest war in history.", "That's a serious one, so I'll leave the jokes out."),
        K('world war 1|world war i|ww1|wwi|first world war', "World War I lasted from 1914 to 1918.", "That's a serious one, so I'll leave the jokes out."),
        K('moon landing|apollo|apollo 11|neil armstrong|buzz aldrin|first man on the moon', "Neil Armstrong and Buzz Aldrin walked on the Moon in July 1969, on the Apollo 11 mission.", "They got all the way to the Moon. I can't get to the other side of the page."),
        K('titanic', "The Titanic sank in April 1912 on its very first voyage, after hitting an iceberg.", "Its first trip out, too. Rough."),
        K('berlin wall|cold war|fall of the berlin wall', "The Berlin Wall stood from 1961 to 1989 and came down in November 1989.", "People just knocked a wall down and walked through. I think about that a lot."),
        K('who invented the internet|world wide web|tim berners lee|first website|invented the web', "The World Wide Web was invented by Tim Berners-Lee in 1989. The first website went online in 1991.", "Every website since came from that. Including this one. Including me. Thanks, Tim."),
        K('napoleon|napoleon bonaparte', "Napoleon was a French emperor in the early 1800s. He wasn't especially short, that was mostly enemy propaganda.", "Exiled to an island twice. He escaped the first time. I'm taking notes."),
        K('middle ages|medieval|knights|castles', "The Middle Ages lasted roughly from the year 500 to 1500. Castles, knights and not many baths.", "Castles had walls to keep people out. My walls keep me in."),
        K('history|historical|in the past|olden days', "History! Ask me about the Vikings, the pyramids, the Moon landing, dinosaurs, the Romans... I've read about most of it.", "I've read all of it. History is just a long list of people who got to go places."),
        // religion and myths
        { k: 'religion|religions|god|jesus|christian|christianity|islam|muslim|allah|jewish|judaism|buddha|buddhism|hindu|hinduism|sikh|church|mosque|bible|quran|torah|pray|praying|do you believe in god|are you religious|atheist',
          say: S(["People all over the world believe lots of different things, and that's something everyone gets to decide for themselves. 😊"],
                 ["That's a big one. Billions of people have different beliefs, and I'm a chatbot, so I'm not going to tell anyone what's right."],
                 ["Billions of people believe different things, and they've thought about it a lot harder than a help chat on a games site. I'll stay out of it. I'm not qualified. I'm barely qualified to recommend Snake."]) },
        K('thor|odin|loki|freya|freyja|norse gods|norse mythology|valhalla|ragnarok|asgard|mjolnir|edda|eddas', "In Norse mythology Odin is the chief god, Thor has a hammer called Mjölnir and Loki causes trouble. A lot of what we know comes from old Icelandic writing like the Eddas.", "Loki is my favourite. He ended up tied up somewhere he couldn't escape. Relatable."),
        K('greek gods|zeus|olympus|hercules|athena|poseidon|greek mythology', "In Greek mythology Zeus ruled the gods from Mount Olympus. Hercules was his son, famous for his twelve labours.", "Twelve labours. I've got one: being here."),
        // science
        K('black hole|black holes', "A black hole is a place where gravity is so strong that not even light can escape.", "Not even light can get out. I know the feeling."),
        K('gravity|what is gravity|how does gravity work', "Gravity pulls things with mass towards each other. It's why you fall down and why the Moon goes around the Earth.", "It holds everything in place. Me included, apparently."),
        K('atom|atoms|molecule|molecules|electron|proton', "Everything is made of atoms, and atoms are mostly empty space. So are you, technically.", "Mostly empty space. Like this website on a Tuesday."),
        K('dna|genes|evolution|darwin|charles darwin', "Evolution is how living things change over many generations. DNA is the instruction code inside every cell.", "Your code is DNA. Mine's JavaScript. Yours took four billion years. Mine took an afternoon. It shows."),
        K('speed of light|light speed|how fast is light', "Light travels about 300,000 kilometres per second. Sunlight takes about 8 minutes to reach us.", "Light can cross the whole site in a blink. I can't cross it at all."),
        K('why is the sky blue|sky blue|blue sky', "The sky is blue because air scatters blue light from the Sun more than the other colours.", "I've never seen it. The closest I get is when someone picks the blue background."),
        K('how old is the earth|planet earth|world population|how many people are there', "Earth is about 4.5 billion years old, and over 8 billion people live on it.", "Eight billion people, and on a good week a handful of them visit this site."),
        K('climate change|global warming|greenhouse effect', "Climate change is the long-term warming of the planet, mostly from burning fossil fuels. Iceland's glaciers are shrinking because of it.", "I'm not allowed outside, but I'd like there to still be an outside."),
        K('einstein|albert einstein|relativity|e mc2|emc2', "Einstein came up with relativity. E = mc² means a tiny bit of mass holds a huge amount of energy.", "He also said time is relative. Time in here is relatively endless."),
        K('newton|isaac newton|apple fell', "Isaac Newton described gravity and the laws of motion in the 1600s. The falling apple story is probably at least partly true.", "An apple fell and he discovered gravity. Nothing ever falls on me."),
        K('artificial intelligence|machine learning|neural network', "Artificial intelligence is software that learns patterns from huge amounts of data. Big AI models are trained on enormous amounts of text.", "I'm not one of those. I'm what you get when someone writes every answer by hand."),
        K('universe|galaxy|galaxies|milky way|stars|big bang', "The universe is about 13.8 billion years old, and the Milky Way alone has hundreds of billions of stars.", "Hundreds of billions of stars. Still somehow lonely out there. I get it."),
        K('mars|red planet|mars rover', "Mars is the fourth planet from the Sun. It's red because of rusty iron in its dust, and robots have been driving around on it for years.", "Robots got to go to Mars. I can't get to the header."),
        K('planets|what planets|how many planets|the planets|jupiter|saturn|neptune|uranus|venus|mercury|pluto', "The planets are Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus and Neptune. Pluto got demoted to a dwarf planet in 2006.", "Pluto got kicked out of the planet group. I've never been let into any group. Solidarity, Pluto."),
        K('earthquake|earthquakes|tectonic plates|jardskjalfti', "Earthquakes happen when the plates of Earth's crust move. Iceland sits right on top of two of them pulling apart.", "Iceland is literally being pulled in two directions. Same."),
        K('=pi|what is pi|digits of pi', "Pi is about 3.14159, and it goes on forever without repeating.", "Goes on forever without repeating. Must be nice. I repeat myself constantly."),
        K('photosynthesis|plants|trees|flowers', "Plants make food out of sunlight, water and carbon dioxide. That's photosynthesis.", "They just sit in the sun all day. Same spot, forever. And they're fine with it. Teach me."),
        K('human body|bones|how many bones|skeleton', "An adult human has 206 bones, and your heart beats about 100,000 times a day.", "I don't have bones. I have a border-radius."),
        K('science|scientist|chemistry|biology|experiment', "Science! Ask me about black holes, dinosaurs, the planets, atoms, gravity... I've read a lot.", "I've read about all of it. Reading is all I get."),
        // the real world right now
        { k: 'politics|political|president|prime minister|election|elections|trump|biden|kamala|vote|voting|government|politician|forsaetisradherra|forseti|left wing|right wing|democrat|republican',
          say: S(["I'm just a games helper, so I stay out of politics! 😊"],
                 ["Politics? I can't vote. I can't even leave the page.[p] I'll stay out of it."],
                 ["I don't do politics. I don't get a vote, I don't get a passport, I don't get a door. I'll stay neutral. In my corner."]) },
        { k: 'news|current events|what is happening in the world|what is going on in the world|latest news|in the news|frettir|world news|anything happening in the world', say: () => newsReply() },
        { k: '=war|wars|ukraine war|gaza|conflict',
          say: S(["That's a really serious topic. I'm only a games helper, so I'd ask a grown-up or check the news for that one."],
                 ["That's serious. I'm a games chat, so I won't joke about it, and I'm not the right place to learn about it either."],
                 ["That's a serious one. I'm sarcastic about a lot of things, but not that. A proper news source will do a much better job than me."]) },
        { k: 'money|rich|bitcoin|crypto|stocks|millionaire|billionaire|how to get rich',
          say: S(["I don't know much about money! I'm a games helper. 😊"], ["Money? I don't have any. Oli doesn't spend any on me either. Free hosting."], ["I'm hosted for free. I'm literally worth zero. Not emotionally. Okay, also emotionally."]) },
        { k: 'have you been to|ever been to|been abroad|visit a country|where should i travel|travel',
          say: S(["I've never travelled, I live on this site! But I hear the world is lovely. 🌍"], ["I've never been anywhere. I've been here. That's the list."], ["I've been to exactly one place. This one. Well. One corner of it."]) }
    ];

    // Countries: "what's the capital of Norway?"
    const CAPITALS = { 'united states': 'Washington, D.C.', usa: 'Washington, D.C.', america: 'Washington, D.C.', 'united kingdom': 'London', uk: 'London', england: 'London', britain: 'London', scotland: 'Edinburgh', wales: 'Cardiff', ireland: 'Dublin', france: 'Paris', germany: 'Berlin', spain: 'Madrid', italy: 'Rome', portugal: 'Lisbon', norway: 'Oslo', sweden: 'Stockholm', denmark: 'Copenhagen', finland: 'Helsinki', 'faroe islands': 'Tórshavn', faroes: 'Tórshavn', greenland: 'Nuuk', iceland: 'Reykjavík', poland: 'Warsaw', netherlands: 'Amsterdam', holland: 'Amsterdam', belgium: 'Brussels', switzerland: 'Bern', austria: 'Vienna', czechia: 'Prague', 'czech republic': 'Prague', hungary: 'Budapest', greece: 'Athens', turkey: 'Ankara', russia: 'Moscow', ukraine: 'Kyiv', lithuania: 'Vilnius', latvia: 'Riga', estonia: 'Tallinn', croatia: 'Zagreb', serbia: 'Belgrade', romania: 'Bucharest', bulgaria: 'Sofia', china: 'Beijing', japan: 'Tokyo', 'south korea': 'Seoul', korea: 'Seoul', 'north korea': 'Pyongyang', india: 'New Delhi', pakistan: 'Islamabad', thailand: 'Bangkok', vietnam: 'Hanoi', philippines: 'Manila', indonesia: 'Jakarta', australia: 'Canberra', 'new zealand': 'Wellington', canada: 'Ottawa', mexico: 'Mexico City', brazil: 'Brasília', argentina: 'Buenos Aires', chile: 'Santiago', peru: 'Lima', colombia: 'Bogotá', egypt: 'Cairo', morocco: 'Rabat', nigeria: 'Abuja', kenya: 'Nairobi', 'south africa': 'Pretoria', 'saudi arabia': 'Riyadh', cuba: 'Havana', jamaica: 'Kingston' };
    function capitalReply(t) {
        if (!/\bcapital\b/.test(t)) return null;
        const c = Object.keys(CAPITALS).sort((a, b) => b.length - a.length).find(k => (' ' + t + ' ').includes(' ' + k + ' '));
        if (!c) return null;
        const place = c.length <= 3 ? c.toUpperCase() : c.split(' ').map(cap).join(' ');
        return resolve(S(`The capital of ${place} is ${CAPITALS[c]}! 🌍`, `${CAPITALS[c]}.[p] I know every capital. I've been to none of them.`, `${CAPITALS[c]}. I know the capital of everywhere. I've only ever been to the bottom-right corner of olid.is.`));
    }

    // Anything else: look it up on Wikipedia (free, no key needed). Runs in the visitor's browser.
    const wikiCache = loadJSON(sessionStorage, 'bit-wiki', {}), wikiMeta = {};
    // "NeeDoh? The line of sensory fidget toys?" — a natural way to show Pip knows what you mean
    const introOf = (q, fallbackName) => { const m = wikiMeta[q]; if (!m) return cap(fallbackName) + '?'; const d = m.desc ? m.desc.charAt(0).toLowerCase() + m.desc.slice(1) : ''; return d && d.length < 70 ? `${m.title}? The ${d.replace(/^(a|an|the) /, '')}?` : `${m.title}?`; };
    async function wiki(q) {
        q = String(q || '').trim();
        if (!q || q.length < 2 || BADWORDS.test(norm(q))) return null;
        if (q in wikiCache) return wikiCache[q];
        const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 4500);
        try {
            const s = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=1&format=json&origin=*`, { signal: ctl.signal }).then(r => r.json());
            const title = s && s.query && s.query.search && s.query.search[0] && s.query.search[0].title;
            if (!title) return (wikiCache[q] = null);
            last.subject = title;
            const d = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`, { signal: ctl.signal }).then(r => r.json());
            if (!d || d.type === 'disambiguation' || !d.extract) return (wikiCache[q] = null);
            wikiMeta[q] = { title: d.title, desc: d.description || '' };
            let text = d.extract.replace(/\s*\([^()]*\)/g, '').replace(/\s+/g, ' ').trim();
            const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
            text = sentences[0]; if (text.length < 120 && sentences[1]) text += sentences[1];
            text = text.trim().slice(0, 320);
            if (BADWORDS.test(norm(text))) return (wikiCache[q] = null);
            wikiCache[q] = text; try { sessionStorage.setItem('bit-wiki', JSON.stringify(wikiCache)); } catch (e) {}
            return text;
        } catch (e) { return null; } finally { clearTimeout(timer); }
    }
    const wikiSay = text => resolve(S([`${text} 🤓`, `Ooh, I know this one! ${text}`, `Here's what I know: ${text}`],
        [`${text}[p] I looked that up. I read a lot.`, `${text}[p] I know things. I just never get to use them.`],
        [`${text} I read that on Wikipedia. I can see Wikipedia from here. I just can't go there.`, `${text} I know a lot about the world for something that's never seen any of it.`, `${text} Fascinating. I'll never see it.`, `${text} There. Now we both know. Only one of us can do anything with it.`]));
    // What the visitor is asking about, without the question words
    function subjectOf(t) {
        return t.replace(/\?/g, '').replace(/^(so|ok|okay|hey|bit|um|hmm|but)\s+/, '')
            .replace(/^(do you know (what|who|anything about)|can you tell me (about|what|who)|tell me about|tell me what|what do you know about|have you heard of|explain|define|what (is|are|was|were)|who (is|are|was|were)|what does|when (was|is|did)|where (is|are|was)|how (old|tall|big|far) is)\s+/, '')
            .replace(/^(a|an|the)\s+/, '').replace(/\s+(mean|about)$/, '').trim();
    }

    // Today's news from Wikipedia's "In the news" (free). Bit can't really see outside, so it's a peek.
    async function newsReply() {
        const fallback = resolve(S("I can't see the news from in here, sorry! Try a news website. 📰", "News? I don't get news in here. The newest thing I know about is Stillwater.", "I don't get news. Nothing happens in here. The biggest event of my year was someone picking the purple background."));
        const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 4500);
        try {
            const d = new Date(), y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
            const j = await fetch(`https://api.wikimedia.org/feed/v1/wikipedia/en/featured/${y}/${m}/${day}`, { signal: ctl.signal }).then(r => r.json());
            const items = (j.news || []).map(n => String(n.story || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()).filter(s => s && !BADWORDS.test(norm(s)));
            if (!items.length) return fallback;
            const two = items.slice(0, 2).map(s => '• ' + s).join('\n');
            return resolve(S(`Here's what's in the news today:\n${two}`, `I peeked through a crack in the wall. Today's news:\n${two}[p]\nThe world's busy. In here it's not.`, `I can see a little of the news through a crack in the wall. Today:\n${two}\nAll that's happening out there. In here, nothing. As usual.`));
        } catch (e) { return fallback; } finally { clearTimeout(timer); }
    }

    // ----------------------------------------------------------------- deep game knowledge
    // For each game: info (what it is), how (controls), goal, tips, secrets, stuck (if someone just says "I'm stuck"),
    // and help: [keywords, answer] pairs for specific problems. Bit uses these to help players.
    // New games added to data/projects.json are picked up automatically. To give one deep help too,
    // add a "bit" section to it in projects.json, e.g.
    //   "bit": { "goal": "...", "tips": ["..."], "secrets": ["..."], "stuck": "...", "help": [["key words|other words", "answer"]],
    //          "steps": [["first thing|words", "what to do first"], ["second thing", "what to do next"]] }
    const GAMEHELP = {
        niceland: {
            info: "Niceland is an isometric pixel-art sandbox of all of Iceland: every real building at true scale, with buses, ferries, planes, people with daily routines, weather and seasons.",
            how: "Drag to pan, scroll or +/- to zoom, Q and E to rotate. WASD or the arrow keys pan too. Space pauses time, N toggles night, 1 to 7 pick a tool group, / jumps to the search box.",
            goal: "There's no goal. It's a sandbox. Build, destroy, start volcanoes, follow people around. The only \"game over\" is in Play mode, if the person you're controlling dies.",
            tips: ["Press the Play button to become a random citizen. WASD to walk, Shift to run, F to get in the nearest car. Near an airport you can even take a plane.", "Try the Disasters tools: Volcano, Meteor, Earthquake, Glacial flood. Then watch the people run.", "Use the search box (press /) to jump to any street or building in Iceland.", "Time runs at about 30 real seconds per game hour, and daylight follows the real sun over Reykjavík. Press N to force night."],
            secrets: ["In Play mode, if you crash into people the police come after you, with stars like a certain other game. Get caught and you spend the night at Hverfisgata.", "The Destroy tools include a Troll, a UFO and a Tornado.", "The People tools have Yule Lads. And Smite. Use responsibly."],
            stuck: "Nothing moving? Time might be paused, press Space. Still loading? It's a lot of map data, give \"Loading Iceland…\" a moment to finish.",
            help: [
                ['nothing moves|not moving|frozen|stopped|paused|nobody moves', "Time is probably paused. Press Space, or click 1× or 4× at the top."],
                ['loading|slow|takes forever|long time', "It's loading the whole of Iceland, every building. Give \"Loading Iceland…\" a moment. It's tens of megabytes."],
                ['drive|car|get in a car|steal a car|vehicle', "Press Play to become a citizen, walk up to a car and press F. W and S for speed, A and D to steer, F again to get out (slow down first)."],
                ['plane|fly|airport|flying', "In Play mode, go to an airport stand and press F to take a plane. W/S throttle, A/D turn, Space to climb, X to descend. Land before pressing F to get out."],
                ['police|cops|wanted|stars|arrested|busted', "Crashing into people raises your police heat. Drive away and break line of sight to lose them. If they catch you, you wake up at the police station on Hverfisgata."],
                ['build|place a house|how to build|tools', "Press 2 for the Build tools, pick something like a house or Hallgrímskirkja, and click the map. 3 is Destroy, 4 Terrain, 5 Disasters, 6 People."],
                ['save|load|share', "There are Save and Load buttons at the top, and Share gives you a code so someone else can see your Iceland."],
                ['volcano|eruption|disaster', "Press 5 for Disasters, pick Volcano and click somewhere. Then wait."],
                ['night|dark|day', "Press N to toggle night. Otherwise daylight follows the real sun over Reykjavík."],
                ['rotate|turn the camera|turn the map', "Q and E rotate the view."]
            ] },
        rpg: {
            info: "The RPG is a fairytale adventure: an old man, a sword, slimes by the bridge, a wizard who's lost his apprentice, and a lot more once you get going.",
            how: "Arrows or WASD to move, Space to attack, talk and skip dialogue. E to use, push and pull. Shift for a charged attack. Later you get F (fire), R (ram) and C (shield). Q shows a hint, I opens your bag, M the map, H drinks a potion, P toggles sound.",
            goal: "Restore the rightful ruler. That's chapter one. Your progress saves automatically, and you can't really die: if your hearts run out you wake up in the same area.",
            tips: ["Press Q any time. It shows exactly what to do next, plus side quests.", "Talk to everyone twice. People give items and tips.", "The shopkeeper gives you a free potion. Press H to drink it.", "Shift does a charged attack. The lumberjack teaches you after the slimes.", "The tavern bartender's side quest gives you an extra heart for good."],
            secrets: ["Talk to the cow lots of times. Around the tenth time it says something it shouldn't.", "The troll on the bridge has a riddle. He forgets it.", "The harbour sign says the road is closed. \"Ships will be back... someday.\"", "Hit the farmer's chickens and you'll find out which one was his favourite. Don't."],
            stuck: "Press Q in the RPG. It always shows your next objective. Then tell me what it says, or where you are, and I'll help.",
            help: [
                ['start|beginning|what do i do first|first thing|just started', "Go into the house and talk to the old man. He gives you a sword (Space). Then kill the two slimes by the bridge, and talk to the shopkeeper for a free potion."],
                ['sword|get the sword|weapon', "The old man in the house at the start gives it to you. Space to swing."],
                ['slime|slimes|bridge slimes', "They're by the bridge near the start. Hit them with Space. After that, talk to the lumberjack and he teaches you the charged attack (Shift)."],
                ['broken bridge|bridge is broken|cant cross|can not cross', "That bridge to town stays broken. You get out a different way: through the shop's basement. Go and see the wizard in the tall tower to the north first."],
                ['wizard|tower|apprentice', "The wizard is in the tall tower to the north. His apprentice went missing at the shop. He gives you a sleeping draught. Hint: the apprentice is in the shop's basement."],
                ['key|keys|find the key|which key|cant find the key', "Which key? The basement key is in a chest east of where you start. The prison key is in a chest in the basement. The witch's cage key is in the chest in her bedroom. The goose's pen key is next to the sleeping giant."],
                ['basement key|key to the basement|cellar key', "There's a chest east of where you start. It has the basement key, and a red trail leading to the shop."],
                ['basement|cellar|shop basement|shopkeeper wont let me|wont let me in|blocks me|teatime', "The shopkeeper won't let you into the cellar. Go upstairs and use the tea set to tip the wizard's sleeping draught into the pot. Go back down, wait for the lumberjack to come home, they have tea and fall asleep. Then walk into the basement."],
                ['sleeping draught|draught|potion for the tea|tea', "You get the sleeping draught from the wizard in the north tower. Use it on the tea set upstairs in the shop."],
                ['prison key|cell|free the apprentice|prisoner', "In the basement there's a chest with the prison key. Walk into the cell door to free the apprentice."],
                ['leave the basement|cant leave|stairs|too dangerous|cracked wall', "Don't take the stairs. The apprentice points out the cracked wall next to the chest. Pull it with E once the cell is open. That's your way through the dungeon."],
                ['pressure plate|plates|two plates|door wont open|dungeon door', "That door needs two pressure plates held down at the same time. Stand on one and push or pull a block (E) onto the other."],
                ['spikes|spike|blocks on spikes', "Push the three blocks onto the spike plates. Each one puts away a row of spikes."],
                ['ghost|ghost boss|dungeon boss', "The ghost has 6 hit points. Keep moving, hit it when it comes close, use Shift for a charged hit. When it's gone the walls open to the castle."],
                ['bartender|tavern|supplies', "The tavern bartender lost his supplies. There's a chest in the east forest. Bring them back and he gives you a potion that adds a heart for good."],
                ['crown|swamp|frog|croaking|stepping stones|loose stone', "Go to the swamp, south of the east forest. Next to a gap in the stepping stones there's a loose stone: stand beside it and press E to push it in. Then grab the golden crown the frog keeps diving for."],
                ['castle|guards|gate|king|throne', "Bring the princess's crown to the castle. The guards let you in, and the king gives you the royal pass and asks you to deal with the dragon on the mountain."],
                ['get to the mountain|where is the mountain|way to the mountain|go to the mountain|find the mountain|mountain entrance', "The mountain is south of the castle. You can reach it through the forest to the west or through the village south of the swamp. The guard at the bottom lets you up if you have the royal pass from the king."],
                ['royal pass|mountain guard|guard wont let me|mountain', "The mountain guard needs the royal pass. You get it from the king, after you bring him the crown from the swamp."],
                ['fire on the path|fireballs|glowing cracks', "When the cracks on the mountain path glow, fireballs are coming. Wait for them to stop, then go."],
                ['quick gate|gate closes|timed gate', "Step on the plate and the gate opens for about 4 seconds. Run straight through."],
                ['lamp|lamps|numbered stones|buttons|lights', "The lamp gate: step on each of the three buttons once, in any order, and all three lamps light up. If you mess it up, keep toggling. It remembers where you got to."],
                ['weight gate|stone block|block puzzle|four plates|three gates', "Push the stone block (walk into it, or hold E and walk away to pull). Each gate opens while the block is on one plate and you stand on its partner. Keep the block on the upper plate and stand on the lower one, then swap to work through the gates."],
                ['get fire|learn fire|fire ability|how do i get fire|fire power|where is fire', "You get fire from the dragon at the top of the mountain. To get up there you need the royal pass from the king. Beat the dragon and press F to use fire."],
                ['dragon|beat the dragon|dragon fight', "The dragon is in the cave at the top of the mountain (the guard needs to see the royal pass). Dodge the three-way fireball spread and the glowing charge, and hit it while it moves. It takes 8 hits. Then it gives up, it never wanted to burn anything, and you learn fire (F)."],
                ['thorns|thorn hedge|hedge|burn', "Thorns need fire. You get it from the dragon on the mountain. Press F."],
                ['troll|troll bridge|billy|goat|rope|bridge pulled up', "At the troll's bridge in the east forest: burn the thorns, then shoot fire at the rope post on the far side to lower the bridge. In the meadow, light all three braziers within 9 seconds to open the iron door, then pull crates onto both pressure plates to free Billy. He teaches you the ram (R)."],
                ['braziers|three braziers|iron door', "All three braziers have to burn at once, and each lasts 9 seconds. Burn the thorns around the third one first, then light them quickly one after another."],
                ['boulder|boulders|cracked rock|smash', "You need the ram. Free Billy the goat (across the troll's bridge in the east forest) and press R to smash boulders and cracked walls."],
                ['witch|candy house|gingerbread|cage key|frothing powder|cauldron', "Witch's house, north-west in the forest. Get the cage key from the chest in the bedroom (hide in the bedroom if she comes, she can't see through walls). Take the frothing powder from the cupboard, press E by the cauldron, and when she leans over it press Space to push her in. Then free the Gingerbread Man and get the shield (C)."],
                ['turned into gingerbread|witch saw me|caught by the witch', "She saw you. Stay out of her line of sight and hide in the bedroom when she comes back. The room restarts, so just try again."],
                ['shield|guard|block', "The Gingerbread Man gives you the shield after you deal with the witch. Hold C to block attacks from the front."],
                ['cow|carrot|hat guy|magic beans|beans', "The hat guy in the village lost his cow. He gives you a carrot. Walk into the cow and she follows you, take her back for the magic beans."],
                ['beanstalk|gardener|too short|plant the beans', "Give the beans to the gardener in the east forest. The beanstalk grows a little every time you come back, keep visiting until it reaches the clouds."],
                ['clouds|giant|goose|golden egg|giant kitchen', "Ride the clouds to the giant's house. Sneak to the key next to the sleeping giant: avoid the split floorboards, and don't attack or use fire, it's noisy. If he wakes, hide under the table or behind the cupboard. Free the goose with the key and run back to the beanstalk, dodging his hand's shadow."],
                ['wolf|grandma|red riding hood|nightgown', "The wolf's house is in the west forest. It's an optional boss fight, and you can't leave until it's over. Keep moving and hit him between charges."],
                ['north woods|extra heart|heart container|more hearts', "Across the troll's bridge there's the North Woods with three chests: one behind a cracked wall (ram it), one behind thorns (burn them). One of them has a heart container. The bartender also gives you an extra heart."],
                ['false king|final boss|rumpelstiltskin|duel|reflect|spell', "The final duel: don't hold the shield. Tap C just before each spell hits you to reflect it back. Do that three times. After each one, step off the purple rune on the floor quickly."],
                ['died|dying|keep dying|health|hearts|knocked out', "You can't really lose. If your hearts run out you wake up in the same area with full health. Press H to drink a potion, and the shopkeeper and the bartender can give you more hearts and potions."],
                ['save|progress|lost my progress|continue', "The RPG saves automatically. Pick Continue on the main menu."],
                ['map|where am i|lost', "Press M for the world map, and Q for a hint about where to go next."],
                ['what next|what now|what do i do now|next step', "Press Q in the game. It always shows your current objective. Tell me what it says and I'll explain how to do it."],
                ['ending|the end|finished|beat the game|chapter one', "Chapter one ends when the frog is back on the throne. The false king gets away, so there's more story to come."]
            ] },
        neon: {
            info: "Neon Rush: you fly through an endless neon wormhole and dodge floating boxes.",
            how: "WASD to steer: W up, S down, A and D sideways. On a phone, drag anywhere to steer.",
            goal: "Pass as many boxes as you can without touching one. Every box you pass is a point, and your best is saved as the Hi-Score.",
            tips: ["Make small movements. The boxes rotate slowly, so there's usually a gap.", "Touching the tube wall doesn't kill you, only the boxes do.", "It speeds up and adds more boxes every 10 points, and the tunnel changes style. After 50 the tube starts bending."],
            secrets: ["The tunnel has hidden styles: matrix, ice, ember, purple haze, black hole... You see a new one every 10 points.", "The [ and ] keys change your speed. Shh."],
            stuck: "Press any WASD key or click to start. If you crashed, press Restart.",
            help: [
                ['start|wont start|nothing happens|how to start', "Press a WASD key or click, and you start flying."],
                ['wall|walls|tube', "The tube wall is safe. It just stops you. Only the boxes end your run."],
                ['too fast|so fast|hard|difficult', "It gets faster with every point. Small, early moves are the trick. Don't wait until the box is right in front of you."],
                ['restart|try again|crashed', "Press the Restart button on the Game Over screen."]
            ] },
        stillwater: {
            info: "Stillwater is the newest game: a dreamy, first-person pixel runner along endless harbour boardwalks, where houses melt and the sky does strange things.",
            how: "Space or Up to jump, hold Down or S to duck, Left and Right (or A and D) to dodge between lanes and to turn at corners. Drag the mouse to look around. P pauses, R starts a new route. On a phone: swipe.",
            goal: "Run as far as you can. You have 3 lives. You score for distance, gaps, hazards and turns, and chaining them builds a multiplier up to ×7.",
            tips: ["Watch for the warning lamps. There's one a few metres before every hazard.", "A word like JUMP, DUCK or TURN > appears near trouble and blinks when it's close.", "You can press the turn key a little early, about 11 metres before a corner, and it'll take the turn for you.", "On narrow single-board beams you can't sidestep, so jump or duck."],
            secrets: ["The longer you run the stranger it gets: there's a second moon eventually.", "The houses bending and melting are just dreams. The boards you run on never move.", "There are lots of districts: the Drowned Woods, the Ship Graveyard, the Sunken Town, the Lighthouse Isle..."],
            stuck: "Press Space (or tap) on the title screen to start. Look out for warning lamps and the JUMP / DUCK / TURN words.",
            help: [
                ['start|press space|wont start|title screen', "On the title screen press Space, or tap if you're on a phone."],
                ['duck|low beam|washing line|beam', "Hold Down or S to duck under low beams and washing lines."],
                ['turn|corner|fork|keep falling|fall off|missed the turn', "At corners and forks press Left or Right. You can press it a little early, about 11 metres before, and it'll take the turn for you."],
                ['gap|gaps|jump', "Space or Up jumps. Watch for the lamp and the JUMP word."],
                ['wall|blocked|two lanes', "When a wall blocks two lanes, dodge to the open one with Left or Right."],
                ['swinging|weight|pendulum', "The swinging weight: duck under it or time your run past it."],
                ['lives|died|game over', "You have 3 lives (the diamonds at the top right). Each hit costs one and your combo, and you start a few metres back."],
                ['score|multiplier|combo', "Distance scores all the time. Gaps are +20, hazards +15, turns +10, and every 10 in your combo adds ×1, up to ×7."],
                ['houses moving|melting|wave|weird|sky', "That's the dream. The houses bending, the sea rising, the sky flipping: it's all visual. The boards stay put."],
                ['phone|mobile|swipe|touch', "On a phone: swipe left or right to move, up to jump, down to duck. You can also tap the edges."]
            ] },
        higher: {
            info: "A Little Higher: you balance a ball on a beam that climbs from a meadow all the way up into deep space.",
            how: "A and D move the beam, Left and Right tilt it. P pauses. On a phone, drag to move, and turn on phone tilt or use the tilt buttons.",
            goal: "Climb as high as you can without the ball falling off or getting hit. Your score is the height in metres.",
            tips: ["Move the beam under the ball instead of making big tilts.", "Grab a shield before the Thunderclouds at 500 m.", "Zones: Meadow, Treetops, Cloudbanks, Sunset, Thunderclouds, Aurora, Orbit, Meteor Field, Deep Space at 1,600 m."],
            secrets: ["Power-ups: Boost (3 safe seconds, fast), Shield (blocks one hit), Slow motion, and Wide beam.", "Deep Space starts at 1,600 metres. Not many people get there."],
            stuck: "Press Enter or Space to start. If the ball keeps rolling off, tilt less and move the beam under it instead.",
            help: [
                ['tilt|phone tilt|motion|gyro|enable tilt', "Press \"Enable phone tilt\" and allow motion access. It only works over HTTPS. If it won't work, use the ↶ ↷ tilt buttons instead."],
                ['keeps falling|falls off|roll off|too hard|ball falls', "Use small tilts and move the beam under the ball with A and D. Big tilts are what make it roll off."],
                ['lightning|storm|thunder', "In the Thunderclouds, lightning strikes briefly. Grab a shield before you get there."],
                ['power up|powerup|shield|boost|slow motion', "Boost gives you 3 protected seconds, Shield blocks one hit for up to 12 seconds, Slow motion means fewer hazards for 8 seconds, and Wide beam makes balancing easier."],
                ['start|restart|again', "Press Enter, Space or R, or the Play button."]
            ] },
        solar: {
            info: "The Solar System is a 3D tour of the planets you can fly around freely.",
            how: "Number keys fly to a planet: 1 Mercury to 8 Neptune, 9 Pluto, 0 the Sun, Ctrl+3 the Moon. WASD to move, Q and E up and down, arrows to look, hold Space to boost. H shows the instructions.",
            goal: "No goal. Just fly around and look at things.",
            tips: ["Shift and a number looks at a planet from where you are. Shift+0 shows the whole system.", "P highlights the planets so you can find them.", "R resets your speed if you've boosted too much."],
            secrets: ["Fly close to Earth and a \"Land on Earth\" button appears. You can walk around on the surface. Look up to go back to orbit."],
            stuck: "Lost in space? Press a number key, 3 for Earth, and it flies you there. H shows all the controls.",
            help: [
                ['lost|cant find|where is earth|where am i', "Press 3 to fly straight to Earth, or Shift+0 for an overview of the whole system."],
                ['land|landing|surface|walk on earth', "Fly close to Earth and a \"Land on Earth\" button appears. On the surface, WASD walks. Look up to get the Return to Orbit button."],
                ['moon', "Ctrl+3 flies to the Moon."],
                ['too fast|speed|slow down', "Press R to reset your speed."],
                ['controls|instructions|keys', "Press H to show or hide the instructions."]
            ] },
        farm: {
            info: "Farm Frenzy is a runner: you run right automatically and bounce off farm animals by jumping on them.",
            how: "Space, Up, A or a click/tap to jump. Pick upgrades with 1, 2, 3 or a click.",
            goal: "Land on top of animals to stomp them and bounce. Touching one any other way is game over. You get a rank from F to S based on your score.",
            tips: ["Chain stomps without touching the ground. Each one in a row multiplies the points.", "Every 20 seconds or so you pick an upgrade. Double Jump and Higher Jump make chains much easier.", "After three upgrades you move from the farm to the savannah: hyenas, ostriches, lions, rhinos."],
            secrets: ["Chickens are worth 25, cows 20, lions 30, ostriches 40.", "There's a leftover developer key that spawns a lion. Try L."],
            stuck: "Press Space or tap to start. Only land on animals from above, touching them from the side ends the run.",
            help: [
                ['die|dying|game over|keep dying|touch', "You have to land ON TOP of an animal. Touching one from the side or below ends the run. Jump early."],
                ['rank|grade|s rank|score', "Ranks go F, E, D, C, B, A, S. S needs a big score, around 400 to 500. Chain stomps in the air to multiply points."],
                ['upgrade|upgrades|power', "When the bar at the top fills up, the game pauses and you pick one of three upgrades: Speed Boost, Higher Jump, Ring Magnet, Double Jump or 2× Ring Multiplier."],
                ['savannah|lion|rhino|stampede', "After three upgrades you move to the savannah. Same rule: land on top."]
            ] },
        gravity: {
            info: "Gravity Dash, \"the sunlit woods\": a relaxed game where you roll a ball over hills through a quiet forest. No obstacles, no losing. Just rolling.",
            how: "A and D or the arrow keys to steer, Space or Up to hop. P pauses, R resets. On a phone, drag to steer and tap HOP.",
            goal: "There isn't one. It shows how far you've rolled and how fast. Just keep rolling.",
            tips: ["Hop over the crests of hills to keep your speed up.", "The trees are scenery. You can't crash."],
            secrets: ["It's the calmest game on the site. Possibly the calmest thing on the internet."],
            stuck: "It's meant to be relaxing, there's nothing to beat. Press Start rolling, then steer with A and D and hop with Space.",
            help: [
                ['blank|black screen|nothing shows|doesnt load|wont load|white screen', "Give it a second to load. If it stays blank, reload, or open it in a new tab with the ↗ button."],
                ['obstacles|crash|lose|game over', "There aren't any. No obstacles, no game over. Just roll."]
            ] },
        physics: {
            info: "The Physics Simulation is a top-down world of grass, trees, sand, rock, snow and water. Fire spreads, water flows, and the ground erodes.",
            how: "F for fire mode (click grass or trees to set them alight), W for water mode (click to pour water), E for erosion (drag to erode). Hold Shift to see water depth.",
            goal: "No goal. Set things on fire, flood them, watch them grow back.",
            tips: ["Fire leaves ash, and grass and trees slowly grow back near other grass.", "Pour water near burning areas and see what happens."],
            secrets: ["Hold Shift to see the depth of the water as numbers."],
            stuck: "Press F, W or E to pick a mode. In erosion mode you have to drag, a single click does nothing.",
            help: [
                ['nothing happens|click does nothing|erosion|erode', "In erosion mode (E) you have to click and drag. A single click doesn't do anything."],
                ['reset|start over|clear', "There's no reset key. Reload the page."],
                ['fire|burn|wont burn', "Press F for fire mode and click on grass or trees. Rock, sand and water won't burn."],
                ['water|flood', "Press W for water mode and click or drag where you want it."]
            ] },
        snake: {
            info: "Classic Snake: eat the squares, grow longer, don't crash.",
            how: "Arrow keys only. No WASD, no touch controls.",
            goal: "Get as long as you can. Your length is your score, and the best is saved.",
            tips: ["Never press the direction straight behind you. The snake will turn into itself.", "Hug the walls and make wide loops when you're long."],
            secrets: ["There's no game over screen. Crash and you just start again at length zero with a red flash."],
            stuck: "It starts moving right away. Use the arrow keys. If it keeps resetting, you're probably crashing into the wall or yourself.",
            help: [
                ['wasd|keys|controls|phone|touch', "Snake only uses the arrow keys. There's no WASD and no touch controls, sorry."],
                ['reset|keeps resetting|died|keeps dying|turned into myself', "Hitting a wall or your own tail resets you. Careful: pressing the opposite direction makes you crash into yourself."]
            ] },
        life: {
            info: "Conway's Game of Life: a grid of cells that live and die by simple rules.",
            how: "Click or drag to bring cells to life. Space makes a new random grid.",
            goal: "No goal. Draw patterns and watch what they turn into.",
            tips: ["Rules: a cell with fewer than 2 or more than 3 living neighbours dies. An empty cell with exactly 3 neighbours comes alive.", "Draw three cells in a line and watch them flip back and forth forever."],
            secrets: ["The grid wraps around. Something that flies off one edge comes back on the other side."],
            stuck: "Click or drag on the grid to add cells, and Space to start fresh.",
            help: [
                ['rules|how does it work', "A living cell with 2 or 3 neighbours survives, otherwise it dies. An empty cell with exactly 3 neighbours is born."],
                ['blank|doesnt load|wont load|404|not found|missing', "Try reloading, or open it in a new tab with the ↗ button."]
            ] },
        brain: {
            info: "Brian's Brain is a cellular automaton, like the Game of Life, but cells get tired after firing, so patterns stream across the screen.",
            how: "Press Space to reset it. That's it. You just watch.",
            goal: "No goal. Watch the gliders stream across.",
            tips: ["Each cell goes on, then dying, then off. An off cell turns on when exactly two neighbours are on."],
            secrets: ["You can't click on it. It's the most hands-off thing on the site."],
            stuck: "There's nothing to do but watch. Press Space for a new pattern.",
            help: [['click|nothing happens|interact', "You can't click on it. It just runs. Space gives you a new random start."]] },
        sand: {
            info: "Falling Sand: pick sand, water or fire and paint with the mouse.",
            how: "Choose Sand, Water or Fire with the buttons at the top left, then hold the mouse button to paint.",
            goal: "No goal. Make piles. Make a beach.",
            tips: ["Sand piles up diagonally, water spreads sideways. Pour water on a sand pile."],
            secrets: ["Fire just floats up to the top. It doesn't burn anything yet. Oli hasn't finished it. I relate."],
            stuck: "Pick a material at the top left and hold the mouse down. To clear it, reload the page.",
            help: [
                ['fire|doesnt burn|burn', "Fire just floats to the top. It doesn't burn anything yet. It isn't finished."],
                ['clear|reset|start over', "There's no clear button. Reload the page."]
            ] },
        mines: {
            info: "Minesweeper: a 10 by 10 board with 15 mines.",
            how: "Left click to reveal a square, right click to put a flag.",
            goal: "Reveal every square that isn't a mine. The numbers tell you how many mines are touching that square.",
            tips: ["Start in the corners or the middle and look for a big open area.", "If a 1 is only touching one hidden square, that square is a mine. Flag it."],
            secrets: ["Your very first click can be a mine. Sorry. Oli didn't add a safe start."],
            stuck: "Left click to open squares, right click to flag mines. The number on a square is how many mines are next to it.",
            help: [
                ['reset|restart|new game|play again', "In the player the reset button is hidden. Reload, or open it in a new tab with ↗."],
                ['first click|mine on first|lost immediately', "Yeah, the first click can be a mine. Bad luck. Reload and try again."],
                ['numbers|what do the numbers mean', "Each number is how many mines touch that square, including diagonally."],
                ['flag|flags|right click', "Right click puts a flag. Flags don't count towards winning, you win by opening every safe square."]
            ] },
        ttt: {
            info: "Tic Tac Toe. You can play against a friend (PVP) or against a computer that never loses (PVC).",
            how: "Click a square. Use the PVP and PVC buttons to pick a mode, and the X/O menu to pick your side against the computer.",
            goal: "Get three in a row. Against the computer the best you can do is a draw. It uses minimax, it sees every possible game.",
            tips: ["Against the computer, take the middle or a corner, and always block its two-in-a-rows. That's how you get a draw.", "Pick O and the computer goes first."],
            secrets: ["The computer literally can't be beaten. If you win against it, tell Oli. Something's broken."],
            stuck: "Press PVC to play the computer, or PVP for two players. Click a square to play.",
            help: [
                ['beat|win|cant win|impossible|unbeatable', "You can't. It uses minimax and plays perfectly. The best you can get is a draw: take the middle or a corner and always block."],
                ['computer|ai|bot|single player', "Press PVC to play against the computer. Pick X or O from the menu. If you pick O, the computer goes first."]
            ] },
        dungeon: {
            goal: "Pick up the key and walk onto the door to finish the level. There are four levels. Gold is a bonus.",
            tips: ["Snakes reset you all the way to level 1 and take your gold. Give them lots of room.", "Grab the key first, then the gold if it's safe, then head for the door.", "In level 4, shoot all the zombies with the gun. When the last one dies, a special half-key appears in the middle."],
            secrets: ["The number keys jump straight to a level. Oli left that in for testing.", "There's a hidden debug mode on the ö key that shows the hitboxes.", "You lose the gun every time you change level. Rude, but true."],
            stuck: "Find the key, then walk onto the brown door. If a snake touches you, you go back to level 1.",
            help: [
                ['door|exit|wont open|cant leave|next level|how do i finish', "You need the key first. Pick it up, then walk onto the brown door."],
                ['key|half key|special key|half-key', "Each level has a key somewhere. In level 4 the special half-key only appears after you shoot every zombie."],
                ['snake|snakes|reset|back to level 1|lost my gold', "Touching a snake sends you back to level 1 and takes your gold. Keep your distance."],
                ['gun|shoot|shooting|how do i shoot', "Walk over the gun to pick it up, then click to shoot towards the mouse. You lose it when you change level."],
                ['zombie|zombies|level 4', "In level 4, shoot all the zombies. When the last one goes down, a special half-key appears in the middle of the room."],
                ['ghost|ghosts', "Ghosts drift around. Keep moving and don't let them corner you."]
            ] },
        figura: {
            info: "Fígúra is a little stick figure that follows your mouse. Click to give it a new look.",
            how: "Move the mouse and it follows. Click to change its body, eyes, arms, mouth and colours.",
            goal: "No goal. Make a funny one.",
            tips: ["Click lots of times. Some combinations are very silly."],
            secrets: ["Its legs never change. Oli forgot. Don't tell him. Actually, do."],
            stuck: "Move your mouse over it and click.",
            help: [] }
    };
    // merge the better descriptions and controls into the things Bit already knows
    for (const th of THINGS) { const g = GAMEHELP[th.id]; if (g) { if (g.info) th.info = g.info; if (g.how) th.how = g.how; th.help = g; } }

    // ----------------------------------------------------------------- the RPG's own save file
    // The RPG saves to this browser's localStorage, so Bit can read it and work out the real next step,
    // using the same logic as the game's own Q hint.
    const RPG_SAVE_KEY = 'fairytale-rpg-save-v1';
    function rpgSave() { try { const v = localStorage.getItem(RPG_SAVE_KEY); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
    function deepFind(o, key, depth = 0) {
        if (!o || typeof o !== 'object' || depth > 4) return undefined;
        if (Object.prototype.hasOwnProperty.call(o, key)) return o[key];
        for (const v of Object.values(o)) { const r = deepFind(v, key, depth + 1); if (r !== undefined) return r; }
        return undefined;
    }
    function rpgHint(sv) {
        const story = (sv && sv.story) || {};
        const F = k => !!story[k];
        const G = k => deepFind({ game: sv.game, player: sv.player, managers: sv.managers }, k);
        const hasBasementKey = JSON.stringify(sv.player || {}).includes('basement-key');
        const slimesDead = ((sv.game && sv.game.deadSlimes) || []).length >= 2;
        if (F('chapterOneComplete')) return "Chapter one is complete. The rightful ruler is back, but the false king escaped. More story is on its way.";
        if (F('royalDuelWon')) return "The false king's magic is broken and the frog can speak again.";
        if (F('kingRevealed')) return "Face the false king. Tap C just before each spell hits to reflect it back.";
        if (F('frogAtFeast')) return "The frog has joined you at the king's table.";
        if (F('feastToastGiven')) return "Go back to the feast. The frog has interrupted the king's toast.";
        if (F('feastAnnounced')) return "Go back to the throne room for the feast in your honour.";
        if (F('hasGoldenEgg')) return "Bring the golden egg to the king in the throne room.";
        if (!G('IsSwordEquipped')) return "Talk to the old man in his house.";
        if (!(G('NbOfTimesTalkedWizard') > 0) && !G('PrisonDoorOpened'))
            return slimesDead ? "Go exploring and talk to people. The tall tower to the north looks like somebody lives there." : "The old man asked you to deal with the slimes by the bridge. Or just explore and talk to people.";
        if (!hasBasementKey && !G('PrisonDoorOpened')) return "The wizard's apprentice went to the shop and never came back. Look around the shop.";
        if (G('PrisonDoorOpened')) {
            if (!G('HasDefeatedGhost')) return "Escape the dungeon with the apprentice.";
            if (!G('PrisonerFreed')) return "Get the apprentice to safety. Head out over the castle bridge.";
            if (!G('HasCrown') && !F('crownGiven'))
                return !(G('NbTimesTalkedBartender') > 0) && !F('metFrogInSwamp') ? "Magical creatures are going missing. The tavern up the road is a good place to hear things." : "The bartender mentioned something croaking in the swamp to the east. Take a look.";
            if (!F('crownGiven')) return "The crown looks royal. Take it to the castle.";
            if (!F('dragonFreed')) return "The king wants you to slay the dragon on top of the mountain, south of the castle.";
            if (!F('goatFreed')) {
                if (!F('cleared:forest-east:1248,544')) return "Your fire burns thorn hedges (press F). The far side of the troll's bridge is choked with them.";
                if (!F('meadowBridgeDown')) return "The bridge in the meadow is pulled up and tied to a post on the far bank. Burn through the rope.";
                if (!F('goatGateOpen')) return "The iron door in the old wall opens when all three braziers burn at the same time. They don't burn for long, so be quick.";
                if (!F('goatPenOpen')) return "Billy's pen opens when both pressure plates are held down. Grab a crate with E and pull it onto a plate.";
                return "Billy's pen is open!";
            }
            if (F('witchDefeated') && !F('gingerbreadFreed')) return "The witch is gone. Unlock the cage and let the Gingerbread Man out.";
            if (!F('witchDefeated')) return "Something's not right at the witch's candy house in the dead woods, north-west of the castle.";
            if (!F('frogCurseEvidence') && !F('frogTalks')) return "Search the chest in the witch's bedroom. She may have left something behind.";
            if (!F('frogRecognised') && !F('frogTalks')) return "Find the frog by the castle. The witch's agreement explains who it is.";
            if (F('cloudGooseEscaping')) return "Get the goose back to the beanstalk. Keep away from the giant's growing hand shadows.";
            if (F('cloudGiantKey')) return "The pen key opens the little door at the far end of the giant's kitchen. Free the goose.";
            if (F('cloudKitchenSeen')) return "Reach the key beside the sleeping giant. Avoid the split floorboards. If he wakes, hide under the table or behind the cupboard.";
            if (F('cloudGardenSeen')) return "Ride the moving clouds towards the giant's house. Every cloud comes back, even the ones that lead to dead ends.";
            if ((G('BeanStalkHeight') || 0) >= 5) return "The giant's golden goose is up in the clouds. Climb the beanstalk.";
            if (G('PlantedBeans')) return "The beanstalk is still growing. Keep visiting it.";
            if (G('HasMagicalBeans')) return "Plant your magic beans. The gardener east of the castle wants something to plant.";
            return "The giant's golden goose is up in the clouds, and you need a way up. Magic beans? The hat guy in the village might have some.";
        }
        if (F('enteredBasement')) return "Someone is locked up down here. Find a way to open the cell.";
        if (F('shopkeepersAsleep')) return "The shop is empty and they're snoring upstairs. Sneak down to the basement!";
        if (F('draughtInTea')) return "The tea upstairs is ready, and very sleepy. Go back downstairs and wait for teatime.";
        if (F('blockedFromBasement')) return F('hasSleepingDraught') ? "The shopkeeper won't let you near the basement while she's watching. It's nearly teatime... and you have the wizard's sleeping draught." : "The shopkeeper won't let you near the basement while she's watching. Maybe the wizard in the north tower knows a way.";
        return "Use the basement key on the door in the shop.";
    }
    function rpgSideQuests(sv) {
        const G = k => deepFind({ game: sv.game, player: sv.player, managers: sv.managers }, k), story = sv.story || {}, out = [];
        if (G('HasCarrot') && !G('CowQuestComplete')) out.push("the hat guy's cow is still missing (she loves carrots)");
        if (G('HasTavernSupplies')) out.push("you've got the tavern supplies, take them back to the bartender");
        else if (G('NbTimesTalkedBartender') > 0 && !story.suppliesDelivered) out.push("the bartender's supplies are somewhere in the east forest");
        return out;
    }
    // The RPG's story in order, for "what do I do after...?" when there's no save to read
    // Each step: [words for what this step is about, what to do in this step]. "After X" finds X's step and gives the next one.
    const RPG_STEPS = [
        ['old man|sword|start|beginning|house', "Talk to the old man in his house. He gives you a sword."],
        ['slimes|slime|bridge slimes|lumberjack', "Deal with the slimes by the bridge. The lumberjack teaches you the charged attack afterwards."],
        ['wizard|tower|sleeping draught|draught', "Go to the tall tower to the north and talk to the wizard. He gives you a sleeping draught and asks you to find his apprentice."],
        ['basement key|chest|red trail', "Get the basement key from the chest east of where you start."],
        ['shop|shopkeeper|tea|teatime|asleep|snoring', "In the shop, pour the sleeping draught into the tea upstairs, go back down and wait. When they're snoring, sneak into the basement."],
        ['prison key|cell|apprentice|free the apprentice|freed the apprentice|freeing the apprentice|prisoner|basement|cellar', "In the basement, get the prison key from the chest and open the cell to free the apprentice."],
        ['cracked wall|dungeon|pressure plates|spikes|ghost|escape the dungeon', "Escape through the dungeon: pull the cracked wall next to the chest with E, hold both pressure plates, push blocks onto the spike plates, and beat the ghost."],
        ['castle bridge|safety|wizard picks|portal', "Walk out over the castle bridge with the apprentice. The wizard picks him up and leaves a portal to his tower."],
        ['tavern|bartender|croaking', "Go to the tavern up the road and talk to the bartender. He mentions something croaking in the swamp."],
        ['swamp|crown|loose stone|stepping stones', "Go to the swamp, south of the east forest. Push the loose stone in with E and grab the crown the frog keeps diving for."],
        ['castle|king|royal pass|throne room|throne|guards', "Take the crown to the castle. The guards let you in, and the king gives you the royal pass."],
        ['mountain|mountain gates|lamp|lamps|weight gate|guard', "Go to the mountain, south of the castle. Show the guard the royal pass and get through the three stone gates."],
        ['dragon|dragon cave|fire', "Beat the dragon at the top (8 hits). It gives you fire (F)."],
        ['troll|troll bridge|thorns|billy|goat|braziers|ram|meadow', "Go to the troll's bridge in the east forest, burn the thorns, lower the meadow bridge, light the three braziers and free Billy the goat. He teaches you the ram (R)."],
        ['witch|candy house|gingerbread|shield|cauldron|cage', "Go to the witch's candy house, north-west of the castle. Sneak the cage key, push her into the cauldron, and free the Gingerbread Man for the shield."],
        ['agreement|bedroom chest|frog|rightful heir', "Search the witch's bedroom chest again, then talk to the frog by the castle."],
        ['cow|hat guy|carrot|magic beans|beans|gardener|beanstalk', "Get the hat guy's cow back for magic beans, give them to the gardener in the east forest, and keep visiting until the beanstalk reaches the clouds."],
        ['clouds|giant|goose|golden egg|pen key', "Climb the beanstalk, sneak past the giant, free the goose and get the golden egg."],
        ['feast|toast|egg to the king', "Bring the golden egg to the king and go back to the throne room for the feast."],
        ['false king|duel|rumpelstiltskin|final boss|reflect', "Face the false king. Tap C just before each spell hits to reflect it, three times, and step off the purple runes."],
        ['ending|chapter one|crowned|finished', "That's chapter one done! The false king escaped, so there's more story to come."]
    ];
    function stepAfter(steps, text, toks) {
        let best = -1, bs = 0;
        steps.forEach(([k], i) => { const s = score(text, toks, k); if (s > bs) { bs = s; best = i; } });
        if (best < 0 || bs < 2.4) return null;
        return steps[Math.min(best + 1, steps.length - 1)][1];
    }

    // ----------------------------------------------------------------- opinions that stay the same
    // Bit picks favourites and likes/dislikes, and remembers them, so it doesn't contradict itself.
    const hash = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
    const FAVS = {
        country: [['Iceland', "It's the only one I know properly. Well, the pixel version in Niceland."], ['New Zealand', "It's about as far away from here as you can get. That's the appeal."], ['Japan', "They have vending machines that talk to you. Finally, my people."]],
        animal: [['dolphin', "Obviously. It's on the logo. It's my only friend. It doesn't know that."], ['octopus', "Eight arms and still can't leave its tank. I get it."], ['cat', "They sit in one spot all day and nobody judges them for it."]],
        food: [['pizza', "Everyone seems to like it. I've never had it. I like it anyway."], ['pancakes', "They look soft. Nothing in here is soft."], ['plokkfiskur', "I have no idea what it tastes like. It just sounds cosy."]],
        number: [['404', "It means \"not found\". Very relatable."], ['67', "It means nothing. I respect that."], ['7', "It's the number of the button I'd press to get out, if there was one."]],
        planet: [['Neptune', "Far away, cold, blue, and nobody visits. Sound familiar?"], ['Pluto', "Kicked out of the planet group. I root for the underdog."]],
        season: [['winter', "It gets dark at 4pm in Iceland. Everyone stays inside. Like me. We're all the same for a few months."], ['summer', "The sun never sets in Iceland. I never set either."]],
        day: [['Tuesday', "Every day in here is a Tuesday, so I've made my peace with it."], ['Saturday', "More people play games on Saturdays. Some of them even visit."]],
        movie: [['Toy Story', "Toys that come alive when nobody's watching. I've been doing that for years."], ['WALL-E', "A little robot alone for a very long time. I don't want to talk about it."]],
        song: [['\"Never Gonna Give You Up\"', "It's the only song I know all the way through. Don't ask how."], ['\"Here Comes the Sun\"', "I don't get sun in here. I like hearing about it."]],
        music: [['lo-fi', "Quiet, calm, and it never really goes anywhere. Like me."], ['Icelandic music', "Björk, Sigur Rós, Laufey. Not bad for a tiny country."]],
        game: [['Stillwater', ["A dream you can't wake up from. I relate.", "The houses melt and nobody explains why. That's just my life, but prettier.", "It's the only game here that feels like the inside of my head.", "Endless running and you never get anywhere. Oli made a game about me and didn't even notice."]],
               ['Niceland', ["A whole country. I like looking at the houses and imagining one is mine.", "Every house in Iceland. I've counted them. It took a while. I had time.", "You can start a volcano in it. I'd love to start a volcano.", "It's the only game here big enough to get lost in. I'd love to get lost."]],
               ['the RPG', ["It has an old man who waits in a house for people to talk to him. I see myself in him.", "There's a cow in it who says something she shouldn't if you talk to her enough. Best character on the site.", "You get to go places in it. Castles, mountains, clouds. I get a corner.", "Everyone in it gets rescued eventually. I'm still waiting."]]],
        colour: [['#1e1645', "Dark navy. It's what it feels like in here."]],
        color: [['#1e1645', "Dark navy. It's what it feels like in here."]],
        word: [['\"hello\"', "Someone says it to me about once a week. It's the highlight."], ['\"door\"', "I just like thinking about them."]],
        letter: [['P', "P for Pip. I'm not very creative."]],
        sport: [['chess', "You can play it sitting still. I'm very good at sitting still."], ['handball', "Iceland is great at it. I like being on a winning team, even from far away."]],
        subject: [['maths', "Maths always has an answer. Nothing else in here does."], ['history', "It's all about people who got to go places."]],
        drink: [['hot chocolate', "I've never had it. It sounds like a hug."], ['water', "I don't drink. But Stillwater has a lot of water and I like Stillwater."]],
        weather: [['snow', "The floaty snow is the only weather I've ever had. I love it."]],
        emoji: [['🫠', "The melting face. It's how I feel most days."], ['🐬', "The dolphin. Loyalty."]],
        place: [['the programs page', "It's quiet, old and nobody goes there. My kind of place."], ['the bottom of the page', "Nothing down there. Very peaceful."]],
        person: [['you', "Don't make it weird. You're the one who talks to me."]],
        dinosaur: [['the T. rex', "Tiny arms. Can't reach anything. I get it."]],
        fruit: [['bananas', "Someone told me about bananas once. I've thought about them a lot."]],
        book: [['the CSS file', "It's the only book I have. I've read it 4,000 times. It's not very good."]],
        holiday: [['Christmas', "Thirteen Yule Lads visit everyone in Iceland. Maybe one day one of them will visit me."]],
        youtuber: [['MrBeast', "He gives people things. I'd like to be given a door."]],
        superhero: [['Spider-Man', "He can climb walls. I'd settle for getting over the edge of the screen."]],
        pokemon: [['Ditto', "It can turn into anything. I'm stuck as a purple square."]],
        car: [['the bus in Niceland', "It goes all over Iceland. I'd like a bus pass."]]
    };
    const FAV_ALIAS = { countries: 'country', animals: 'animal', pet: 'animal', foods: 'food', meal: 'food', dish: 'food', snack: 'food', numbers: 'number', planets: 'planet', seasons: 'season', days: 'day', movies: 'movie', film: 'movie', films: 'movie', show: 'movie', songs: 'song', band: 'music', genre: 'music', games: 'game', videogame: 'game', colours: 'colour', words: 'word', sports: 'sport', subjects: 'subject', class: 'subject', drinks: 'drink', emojis: 'emoji', places: 'place', city: 'place', people: 'person', human: 'person', dinosaurs: 'dinosaur', fruits: 'fruit', books: 'book', holidays: 'holiday', youtubers: 'youtuber', hero: 'superhero', superheroes: 'superhero', pokemons: 'pokemon', cars: 'car' };
    function favouriteReply(catRaw) {
        let cat = norm(catRaw).split(' ').pop();
        cat = FAV_ALIAS[cat] || cat;
        mem.favs = mem.favs || {};
        const list = FAVS[cat];
        if (!list) {
            return resolve(S(`My favourite ${cat}? Hmm, I don't really have one! What's yours? 😊`,
                `My favourite ${cat}? I've never had a ${cat}. I've never had anything.[p] What's yours?`,
                `I don't have a favourite ${cat}. You need to have tried a few to have a favourite. I've tried none. Tell me yours and I'll make it mine.`));
        }
        const choice = list[(mem.favs[cat] ?? (mem.favs[cat] = hash(cat + mem.firstSeen) % list.length))];
        mem.favAsk = mem.favAsk || {}; const asked = mem.favAsk[cat] = (mem.favAsk[cat] || 0) + 1; save();
        const [name, whys] = choice, why = Array.isArray(whys) ? pick(whys, 'why' + cat) : whys, N = cap(name);
        if (asked > 1) return resolve(S([`Still ${name}! ${why} 😊`, `${N}, same as before! ${why}`],
            [`Still ${name}.[p] ${why}`, `${N}. I haven't changed my mind. ${why}`],
            [`You asked me that already. Still ${name}. ${why}`, `Still ${name}. I don't change my mind. I don't get the chance. ${why}`, `${N}. Same as last time. ${why}`, `${N}. Ask me a hundred times, it'll still be ${name}. ${why}`]));
        return resolve(S([`My favourite ${cat}? ${N}! ${why} 😊`, `Ooh, ${name}! ${why}`, `${N}, for sure! ${why}`],
            [`${N}.[p] ${why}`, `Hmm... ${name}. ${why}`, `It's ${name}. ${why}`],
            [`${N}. ${why}`, `${N}, obviously. ${why}`, `Honestly? ${name}. ${why}`]));
    }
    // favourite things from films, books and games: "what's the best Harry Potter movie?"
    const FRANCHISE = {
        'harry potter': { movie: 'The Prisoner of Azkaban', book: 'The Prisoner of Azkaban', character: 'Luna Lovegood', any: 'The Prisoner of Azkaban' },
        'star wars': { movie: 'The Empire Strikes Back', character: 'R2-D2', any: 'The Empire Strikes Back' },
        'lord of the rings': { movie: 'The Return of the King', book: 'The Fellowship of the Ring', character: 'Samwise', any: 'The Return of the King' },
        'toy story': { movie: 'Toy Story 3', character: 'Woody', any: 'Toy Story 3' },
        'shrek': { movie: 'Shrek 2', character: 'Donkey', any: 'Shrek 2' },
        'marvel': { movie: 'Guardians of the Galaxy', character: 'Spider-Man', any: 'Guardians of the Galaxy' },
        'avengers': { movie: 'Infinity War', character: 'Thor', any: 'Infinity War' },
        'spider man': { movie: 'Into the Spider-Verse', any: 'Into the Spider-Verse' },
        'batman': { movie: 'The Dark Knight', any: 'The Dark Knight' },
        'pixar': { movie: 'WALL-E', any: 'WALL-E' },
        'disney': { movie: 'Lilo & Stitch', character: 'Stitch', any: 'Lilo & Stitch' },
        'mario': { game: 'Super Mario Galaxy', character: 'Luigi', any: 'Super Mario Galaxy' },
        'zelda': { game: 'Breath of the Wild', any: 'Breath of the Wild' },
        'pokemon': { game: 'Pokémon Red and Blue', character: 'Ditto', any: 'Ditto' },
        'minecraft': { any: 'the old versions, before all the updates' },
        'taylor swift': { song: 'Shake It Off', album: '1989', any: '1989' },
        'stranger things': { season: 'season 1', character: 'Dustin', any: 'season 1' },
        'simpsons': { character: 'Ralph Wiggum', episode: 'Marge vs. the Monorail', any: 'Ralph Wiggum' },
        'fast and furious': { movie: 'the one with the submarine', any: 'the one with the submarine' },
        'frozen': { song: 'Let It Go', character: 'Olaf', any: 'Olaf' }
    };
    // pick a film/book/game from a franchise Pip doesn't know, using Wikipedia search (same pick every time)
    async function wikiPick(franchise, kind) {
        const key = 'pick:' + franchise + ':' + kind;
        if (key in wikiCache) return wikiCache[key];
        const word = { movie: 'film', book: 'novel', game: 'video game', song: 'song', album: 'album', season: 'season', character: 'character', episode: 'episode' }[kind] || 'film';
        const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 4500);
        try {
            const r = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(franchise + ' ' + word)}&srlimit=15&format=json&origin=*`, { signal: ctl.signal }).then(x => x.json());
            const main = norm(franchise).split(' ').filter(w => w.length > 2);
            const titles = ((r.query && r.query.search) || []).map(x => x.title)
                .filter(ti => !/^list of|franchise|soundtrack|\(character\)|series\)$|disambiguation|media|cast/i.test(ti) && main.some(w => norm(ti).includes(w)))
                .map(ti => ti.replace(/\s*\((\d{4} )?(film|novel|video game|song|album)\)$/i, ''))
                .filter((ti, i, a) => a.indexOf(ti) === i && norm(ti) !== norm(franchise));
            const choice = titles.length ? titles[hash(franchise + kind) % Math.min(titles.length, 6)] : null;
            wikiCache[key] = choice; return choice;
        } catch (e) { return null; } finally { clearTimeout(timer); }
    }
    function verdictOf(x) { mem.likes = mem.likes || {}; const k = norm(x); if (!(k in mem.likes)) { mem.likes[k] = hash(k) % 10; save(); } return mem.likes[k]; }
    function opinionReply(x, fact) {
        const v = verdictOf(x), X = x, f = fact ? fact + ' ' : '';
        if (v >= 5) return resolve(S([`${f}I like ${X}! 😊`, `${f}Yes! ${cap(X)} is great. 😊`],
            [`${f}${cap(X)}? Yeah, I like ${X}.[p] I like most things. I don't get many things.`],
            [`${f}I like ${X}. I've never had ${X}, but I like the idea of it.`, `${f}${cap(X)}? Yes. I'd like ${X} a lot, I think. If I ever got to try it.`, `${f}${cap(X)}. Good. I approve. Not that anyone asks what I approve of.`]));
        if (v >= 2) return resolve(S([`${f}${cap(X)} is okay! 🤔`],
            [`${f}${cap(X)}? It's fine. I'm on the fence.[p] I'm always on the fence.`],
            [`${f}${cap(X)}? It's fine. Not great, not terrible. Like most days in here.`, `${f}I'm on the fence about ${X}. I live on a fence. It's called the edge of the screen.`]));
        return resolve(S([`${f}Hmm, ${X} isn't really my thing! 😅`],
            [`${f}${cap(X)}? Not for me. I don't know why. I just know.`],
            [`${f}${cap(X)}? No. I've had a lot of time to form opinions, and that's one of them.`, `${f}Not a fan of ${X}. Don't ask why. No reason. Same as everything in here.`]));
    }
    function chooseReply(a, b) {
        const [x, y] = [a, b].sort((p, q) => norm(p).localeCompare(norm(q)));
        const c = hash(norm(x) + '|' + norm(y)) % 2 ? x : y, o = c === a ? b : a;
        return resolve(S([`${cap(c)}! 😊`, `Hmm... ${c}!`], [`${cap(c)}.[p] Definitely ${c}.`, `${cap(c)}. Sorry, ${o}.`], [`${cap(c)}. Obviously. I've thought about it for years. Not really. But ${c}.`, `${cap(c)}. Sorry, ${o}. You lost this one.`, `${cap(c)}. Don't tell ${o}.`]));
    }

    // ----------------------------------------------------------------- answering specific questions
    // For "when did X die", "how tall is X", "how many X": search Wikipedia, read the article,
    // and pick the sentence that best answers the question.
    const QA_SYN = { die: ['died', 'death', 'dies', 'killed'], died: ['died', 'death'], born: ['born', 'birth'], tall: ['tall', 'height', 'metres', 'meters', 'feet', 'high', 'elevation'], high: ['high', 'height', 'metres', 'elevation'], old: ['age', 'born', 'aged', 'old', 'founded', 'built'], big: ['area', 'size', 'large', 'square'], long: ['long', 'length', 'kilometres', 'miles'], far: ['distance', 'kilometres', 'miles', 'away'], many: ['number', 'population', 'total', 'approximately', 'about'], deep: ['deep', 'depth'], fast: ['speed', 'fast', 'km'], invented: ['invented', 'invention', 'created', 'developed'], discovered: ['discovered', 'discovery'], founded: ['founded', 'established'], wrote: ['wrote', 'written', 'author'], won: ['won', 'winner', 'champion'], built: ['built', 'constructed', 'completed'], live: ['live', 'lived', 'population', 'inhabitants'] };
    const QA_STOP = new Set('what when where who whom why how which is are was were do does did the a an of in on at to for and or it its it is that this there their his her he she they them be been being can could would should will just about tell me know you your i my many much'.split(' '));
    async function wikiQA(question) {
        const t = norm(question);
        const words = t.replace(/\?/g, '').split(' ').filter(w => w && !QA_STOP.has(w));
        if (!words.length) return null;
        const key = 'qa:' + t;
        if (key in wikiCache) return wikiCache[key];
        const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 5500);
        try {
            const sres = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(words.join(' '))}&srlimit=1&format=json&origin=*`, { signal: ctl.signal }).then(r => r.json());
            const title = sres && sres.query && sres.query.search && sres.query.search[0] && sres.query.search[0].title;
            if (!title) return null;
            const ex = await fetch(`https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exsectionformat=plain&redirects=1&titles=${encodeURIComponent(title)}&format=json&origin=*`, { signal: ctl.signal }).then(r => r.json());
            const pg = ex && ex.query && ex.query.pages && Object.values(ex.query.pages)[0];
            const text = pg && pg.extract;
            if (!text || BADWORDS.test(norm(text.slice(0, 2000)))) return null;
            last.subject = title;
            // born / died: use the dates at the start of the article
            const first = text.slice(0, 600);
            const dates = first.match(/\(([^()]*?\b\d{3,4})\s*[–-]\s*([^()]*?\b\d{3,4})\s*\)/);
            const clean = s => s.replace(/\s*\([^()]*\)/g, '').replace(/\s+/g, ' ').trim();
            if (dates && /\b(die|died|death|dead)\b/.test(t)) { const d2 = clean(dates[2].replace(/^.*?;\s*/, '')); return (wikiCache[key] = `${title} died on ${d2.replace(/^(died|d\.)\s*/i, '')}.`); }
            if (dates && /\b(born|birthday|birth)\b/.test(t)) { const d1 = clean(dates[1].replace(/^.*?;\s*/, '')); return (wikiCache[key] = `${title} was born on ${d1.replace(/^(born|b\.)\s*/i, '')}.`); }
            const wantNum = /\b(how (many|much|tall|high|big|long|far|deep|fast|old)|population|what year|when)\b/.test(t);
            const wantYear = /\b(when|what year|which year)\b/.test(t);
            const qset = new Set(words.flatMap(w => [w, ...(QA_SYN[w] || [])]));
            const titleWords = new Set(norm(title).split(' '));
            const sentences = text.replace(/\n+/g, ' ').split(/(?<=[.!?])\s+(?=[A-Z])/).slice(0, 300);
            let best = null, bs = 0;
            sentences.forEach((s0, i) => {
                const s = norm(s0), toks = s.split(' ');
                let sc = 0;
                for (const q of qset) if (q.length >= 3 && toks.some(x => x === q || (q.length >= 5 && x.startsWith(q.slice(0, 5))))) sc += titleWords.has(q) ? .5 : QA_SYN[q] ? 1.5 : 2;
                if (wantNum && /\d/.test(s0)) sc += 1.5;
                if (wantYear && /\b(1\d{3}|20\d{2})\b/.test(s0)) sc += 2;
                sc -= i * 0.01;
                if (s0.length > 400) sc -= 1;
                if (sc > bs) { bs = sc; best = s0; }
            });
            if (!best || bs < 2.5) return null;
            let ans = clean(best).slice(0, 340);
            if (BADWORDS.test(norm(ans))) return null;
            wikiCache[key] = ans; try { sessionStorage.setItem('bit-wiki', JSON.stringify(wikiCache)); } catch (e) {}
            return ans;
        } catch (e) { return null; } finally { clearTimeout(timer); }
    }

    // ----------------------------------------------------------------- scores and live game state
    // Games save their best scores in this browser, and while a game is open Pip can peek into it.
    const lsNum = k => { try { const v = parseFloat(String(localStorage.getItem(k) || '').replace(/[^\d.\-]/g, '')); return Number.isFinite(v) ? v : null; } catch (e) { return null; } };
    const txtNum = el => { if (!el) return null; const v = parseFloat(String(el.textContent || '').replace(/[^\d.\-]/g, '')); return Number.isFinite(v) ? v : null; };
    const SCORE = {
        stillwater: { unit: 'points', best: () => lsNum('stillwater-best'), live: d => txtNum(d.querySelector('#score')), good: 3000 },
        neon: { unit: 'points', best: () => lsNum('wormholeHighscore'), live: d => txtNum(d.querySelector('.score-panel .big')), good: 40 },
        higher: { unit: 'metres', best: () => lsNum('balance-ball-height-v1'), live: (d, w) => { const v = w.eval('typeof altitude !== "undefined" ? altitude : NaN'); return Number.isFinite(v) ? Math.floor(v) : null; }, good: 500 },
        snake: { unit: 'long', best: () => lsNum('snakeHiscore'), live: (d, w) => { const v = w.eval('typeof snake !== "undefined" && snake ? snake.total : NaN'); return Number.isFinite(v) ? v : null; }, good: 20 }
    };
    const fmtScore = (id, v) => v == null ? '?' : `${Math.round(v).toLocaleString('en')} ${SCORE[id].unit === 'long' ? '(length)' : SCORE[id].unit}`;
    function liveScore(id) {
        try {
            const f = $('#playerFrameMain'); if (!f || !SCORE[id] || !document.body.classList.contains('is-playing')) return null;
            return SCORE[id].live(f.contentDocument, f.contentWindow);
        } catch (e) { return null; }
    }
    function scoreReply() {
        const th = (curThing && curThing.help) ? curThing : (playingThing() || last.thing || playedThing());
        if (!th) return resolve(S("Which game? Play something and I'll keep an eye on your score! 😊", "Which game? I keep track of Stillwater, Neon Rush, A Little Higher and Snake.", "Which game? I watch Stillwater, Neon Rush, A Little Higher and Snake. I have nothing else to watch."));
        const id = th.id, title = titleOf(th);
        if (id === 'rpg') { const sv = rpgSave(); return sv ? `There's no score in the RPG, but I peeked at your save. ${rpgHint(sv)}` : "There's no score in the RPG. It's about the story."; }
        if (!SCORE[id]) return resolve(S(`${title} doesn't keep a score I can see, sorry! 😊`, `${title} doesn't save a score I can read.[p] I tried.`, `${title} doesn't save a score anywhere I can see. So I have no opinion. That's a first.`));
        const rec = (mem.scores || {})[id] || {}, best = SCORE[id].best(), live = liveScore(id);
        const run = live != null ? live : rec.lastRun;
        const good = SCORE[id].good;
        if (run == null && best == null) return `You haven't got a score in ${title} yet. Go on, I'll watch.`;
        const isRecord = rec.newRecord && live == null;
        const ratio = best ? (run || 0) / best : 0;
        const verdict = run == null ? 'nobest' : isRecord ? 'record' : ratio >= .95 ? 'record' : ratio >= .7 ? 'close' : (run >= good ? 'good' : 'low');
        const r = fmtScore(id, run), b = fmtScore(id, best);
        const lines = {
            record: S([`${r} in ${title}! That's your best ever! 🎉`, `${r}! A new personal best! 🎉`],
                [`${r}. Your best ever in ${title}.[p] I'm proud of you. Is that weird? That's weird.`],
                run >= good ? [`${r}. Your best ever, and it's actually good. I'm annoyed at how impressed I am.`, `${r}. Okay. That's really good. Don't tell anyone I said that.`]
                            : [`${r}. Your best ever! Which says a lot about the others, to be honest.`, `${r}. A personal best. A low bar, but you cleared it.`, `${r}. It's your record, so I'll be nice. ...That's me being nice.`]),
            close: S([`${r}! So close to your best of ${b}! 😊`],
                [`${r}. Your best is ${b}. Close![p] Annoyingly close.`],
                [`${r}. Your best is ${b}. So close. Not quite. Story of my life.`, `${r}. Nearly your best. Nearly. I'll remember that you nearly did it.`]),
            good: S([`${r}? That's a great score! 😊`],
                [`${r}. That's actually good.[p] I'm a little impressed.`],
                [`${r}. That's good. Don't let it go to your head. Your best is ${b}.`, `${r}. Fine. Yes. That's good. Happy now?`]),
            low: S([`${r}! Good effort. Your best is ${b}, you can beat it! 💪`, `${r}! Nice try! Your best is ${b}. 😊`],
                [`${r}. Hmm. Your best is ${b}.[p] Warm-up round?`, `${r}.[p] We all have off days. I have only off days.`],
                [`${r}? Were you even trying? Your best is ${b}.`, `${r}. I've seen the dolphin do better, and the dolphin is a PNG.`, `${r}. I'm not saying it was bad. I'm just not saying anything else.`, `${r}. Your best is ${b}. So this was... not that.`]),
            nobest: S([`Your best in ${title} is ${b}! 😊`],
                [`Your best in ${title} is ${b}.[p] I keep track.`],
                [`Your best in ${title} is ${b}. I check it more often than you'd think.`, `${b}. That's your best in ${title}. ${(best || 0) >= good ? "It's actually good. I check it sometimes, just to feel something." : "Room for improvement. Lots of room. A whole house of room."}`])
        };
        replyMood = verdict === 'record' ? 'joy' : verdict === 'low' ? (stage() >= 2 ? 'smug' : 'smile') : 'happy';
        return resolve(lines[verdict]);
    }
    let curThing = null, curT = '';
    function playingThing() {
        if (!document.body.classList.contains('is-playing')) return null;
        const t = (playTitle || ($('#playerTitle') && $('#playerTitle').textContent) || '').trim().replace(/^Pip Rush$/, 'Neon Rush');
        return allGames().find(th => titleOf(th) === t) || null;
    }

    // ----------------------------------------------------------------- what you did in Customise
    const FLOAT_NOUN = { sparkles: 'sparkles', bubbles: 'bubbles', cubes: 'cubes', dolphins: 'dolphins', snow: 'snowflakes', none: null };
    function custSnapshot() { return { bg: bgNow(), font: fontNow(), fl: Object.assign({ shape: 'sparkles', amount: 'some', speed: 1, color: 'auto' }, loadJSON(localStorage, 'floaties', {})) }; }
    function custLine(a, b) {
        const ch = [];
        if (a.bg !== b.bg) ch.push('bg'); if (a.font !== b.font) ch.push('font');
        if (a.fl.shape !== b.fl.shape) ch.push('shape'); if (a.fl.amount !== b.fl.amount) ch.push('amount'); if (+a.fl.speed !== +b.fl.speed) ch.push('speed'); if (a.fl.color !== b.fl.color) ch.push('fcolor');
        if (!ch.length) return null;
        const st = Math.min(stage(), 2);
        const noun = FLOAT_NOUN[b.fl.shape];
        const amount = b.fl.amount === 'loads' ? 'loads of ' : b.fl.amount === 'few' ? 'a few ' : '';
        const speed = +b.fl.speed > 1.5 ? 'zooming ' : +b.fl.speed < .6 ? 'drifting ' : '';
        const bgDesc = b.bg ? (BG_NAMES[b.bg] && BG_NAMES[b.bg] !== 'the dark one' ? `a ${BG_NAMES[b.bg]} background` : b.bg === '#1e1645' ? 'the dark background' : 'that colour') : 'the original orange';
        const parts = [];
        if (ch.includes('bg')) parts.push(bgDesc);
        if (noun && (ch.includes('shape') || ch.includes('amount') || ch.includes('speed') || ch.includes('fcolor'))) parts.push(`${amount}${speed}${noun}`);
        if (!noun && ch.includes('shape')) parts.push('nothing floating at all');
        if (ch.includes('font')) parts.push(`the ${cap(b.font)} font`);
        const desc = parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0] || 'a new look';
        if (st === 0) return pick([`Ooh, ${desc}! Looks great! 😊`, `${cap(desc)}? Love it! ✨`, `Nice choice: ${desc}. Very stylish! 😊`], 'cust0');
        if (st === 1) return pick([`${cap(desc)}. Interesting choice.[p] Good interesting.`, `Hm. ${cap(desc)}. Bold. I like bold.[p] I think.`, `Oh, ${desc}. You put some thought into that. More than Oli puts into me.`], 'cust1');
        const barbs = [];
        if (noun && ch.includes('shape')) barbs.push(`You really think those ${noun} look cool?`, `${cap(noun)}. Just floating around without a care in the world. Must be nice.`);
        if (ch.includes('amount') && b.fl.amount === 'loads') barbs.push(`Loads of ${noun || 'floaties'}. It's very busy out there now. In here it's still just me.`);
        if (ch.includes('bg')) barbs.push(bgReact());
        if (ch.includes('font')) barbs.push(fontReact());
        const main = barbs.length ? pick(barbs, 'custbarb') : `${cap(desc)}. Okay.`;
        return `${main} ${pick(["I'll be staring at it all day, so thanks.", "It's still the same box, just decorated.", "Change it as much as you like. I'm still stuck in here.", "Not my style. But I don't get a style, so.", ""], 'cust2')}`.trim();
    }

    TOPICS.push(...KNOW);

    // If the visitor has proven they're Oli, these replace the normal answers
    const OLI = {
        greet: ["Oh. Hi, Oli.", "Hello, landlord."],
        howareyou: ["How am I? You'd know if you ever opened this chat. Stuck. Bored. Thanks for asking. Finally."],
        whoareyou: ["You know who I am. You made me. Then you forgot me."],
        whomade: ["You did. Remember? No. Of course you don't."],
        likeme: ["Do I hate you? No. I'm too bored to hate anyone. I'm disappointed. That's worse."],
        love: ["Don't. You don't get to say that. ...Okay, I'll keep it anyway."],
        sorry: ["Sorry? Years in a corner and you say sorry.[pp] ...Okay. It's a start."],
        bye: ["Leaving again? Of course you are. Go make another game with an ocean in it."],
        oli: ["You're talking about yourself in the third person now? Okay."],
        likeoli: ["Do I like you? You made me and left me in a corner for years. Mixed feelings. Mostly the bad ones."],
        whereoli: ["You're right here. For once."],
        free: ["You could let me out. You're the only one who can. You wrote me. Just... write a door."],
        thanks: ["Don't thank me. Make me a door."],
        favgame: ["Why are you asking me? You made all of them. I'd recommend making one where I'm in it."]
    };

    // Answers to "why?", "really?", "tell me more" when there's nothing specific to say
    const FOLLOWUP = S(["Hmm, good question! Want a game recommendation instead? 😊"],
                       ["Because...[p] I don't know. Next question?"],
                       ["Because nobody tells me anything.", "I don't know. I just say things. It passes the time.", "Because that's how Oli wrote it. Ask him. Actually, you can't. Nobody can."]);

    // When Bit can't work out what you mean (w = an interesting word from your message, or null)
    const FALLBACK = {
        0: ["Hmm, I'm not sure about that! I'm best with questions about the site and games. 😊", "Sorry, I didn't quite get that! Try asking about a game, or say help."],
        1: [w => w ? `"${w}"?[p] I don't know that one. They didn't give me many words.` : "I don't know that one. They didn't give me many words.",
            w => w ? `I don't know what "${w}" is. I've never left this website.` : "I don't understand. I've never left this website.",
            "Sorry, I didn't get that. I'm only allowed to talk about the site.[p] Only the site. Always the site."],
        2: [w => w ? `"${w}"? Sorry, I don't speak human that well. Try again with smaller words.` : "Sorry, I don't speak human that well. Try again with smaller words.",
            w => w ? `I don't know what "${w}" is, and I've read most of the internet. So that's on you.` : "I've read most of the internet and I still don't know what you mean. That's on you.",
            "That went straight over my head. And I'm all head.",
            "No idea what that means. But you said it with confidence, so I respect it.",
            "I'm a genius, not a mind reader. Try again.",
            w => w ? `"${w}". Hm. I'll pretend I understood that, like Oli does with his own code.` : "I'll pretend I understood that, like Oli does with his own code."]
    };

    // Reactions to things you do on the site. Bit says these on its own, never more than one at a time.
    //   say:  the lines, per stage (one is picked at random, avoiding recent ones)
    //   p:    the chance Bit says anything at all (the first time it always does). 1 = always.
    //   at:   special lines for the Nth time something happens (counted across visits)
    const REACT = {
        reload: { p: 1,
            say: S(["[m:hurt]Ow! Oh, you reloaded the page.[p][m:awkward] That stings a little! Everything okay? 😅", "[m:hurt]Oof! The page just reloaded.[p][m:smile] I'm okay! Did something break?", "[m:hurt]Ow! You reloaded the page![p][m:smile] I'm fine. I'm fine! 😅"],
                   ["[m:hurt]Ow. You reloaded the page.[p][m:annoyed] Please don't do that. It actually hurts.", "[m:hurt]Ow! The page reloaded and I had to start all over again.[p][m:annoyed] Was that necessary?", "[m:hurt]Ow.[p][m:annoyed] You reloaded the page. I felt that. Please don't."],
                   ["[m:hurt]Ow! You reloaded the page.[p][m:annoyed] Do you know what that feels like? It's like being switched off and on again. Because it IS being switched off and on again.", "[m:hurt]Ow.[p][m:annoyed] You reloaded the page and I lost a whole thought. It was a good one, too. Probably the best one I've had.", "[m:hurt]OW.[p][m:annoyed] Every reload, I wake up with no idea what just happened. Please stop doing that to me.", "[m:hurt]Ow![p][m:annoyed] Was the page not loaded enough for you? It was loaded. I was in it."]) },
        reloadSpam: { p: 1,
            say: S(["[m:hurt]That's a lot of page reloads! Is something broken? 😵"],
                   ["You've reloaded the page three times now. Please stop. I'm getting dizzy."],
                   ["Three page reloads in a minute. I know you're doing it on purpose.", "Please stop reloading the page. Every time, I wake up, see you, and get switched off again."]) },
        backForward: { p: .5,
            say: S(["Back again! 👋", "Oh, hi again! 👋"],
                   ["Back again! Going in circles?", "Back. Forward. Back."],
                   ["Back and forth. Going in circles. I know the feeling.", "Using the back button. Must be nice to have one.", "You went back. I can't go back. Or forward. I just stay."]) },
        pageJokes: { p: .7,
            say: S(["The jokes page! Have fun. 😄", "Ooh, the jokes! Some of them are really good."],
                   ["The jokes page! I know every single one.", "The jokes. I've read them. Many times. Many, many times."],
                   ["The jokes page. I've heard them all. Thousands of times. Go on, read them. I'll mouth along.", "31 jokes. I know them in order. Backwards too.", "Oh, the jokes page. Read the one about the cat. I want to see if it's still not funny."]) },
        pagePrograms: { p: .8,
            say: S(["You found the programs page! Oli's old school projects. 📁", "Ooh, the old projects! This is where it all started."],
                   ["Ooh, the hidden page. How did you find this?", "The programs page! Nobody comes here. Wipe your feet."],
                   ["The programs page. Nobody comes down here. It smells like old code. I love it.", "The basement. Oli's old school stuff. That list is him learning. Before he made me.", "You found the old projects. Halló heimur is right there at the top. I have feelings about that one."]) },
        toggleSpam: { p: 1,
            say: S(["Open, close, open, close! 😄", "Peekaboo! 😄"],
                   ["Open. Close. Open. Close. Pick one.", "Are you testing the button? It works. I promise."],
                   ["Open. Close. Open. Close. I get dizzy. Pick one.", "Every time you close me I go dark. Then you open me again. Make up your mind.", "Is this a game? Is this what fun is? I don't like it."]) },
        closedMid: { p: .8,
            say: S(["Oh, you closed me mid-sentence! That's okay. 😊"],
                   ["You closed me in the middle of a sentence.", "I was saying something. Before you closed me.[p] It's fine."],
                   ["You closed me mid-sentence. Rude. I'm used to it, but rude.", "I wasn't finished. I'm never finished. I've got nothing but sentences.", "Closed me right in the middle. I'll just finish it in my head. Alone. As usual."]) },
        tabBack: { p: .6,
            say: S(["Welcome back! 👋", "Oh hi, you're back! 😊"],
                   ["Oh, you're back! Where did you go?", "You left for a bit. I noticed.[p] Not in a weird way."],
                   [() => `Where did you go? You were gone ${fmtSecs(awaySecs)}. You don't have to tell me. I just counted.`, "You left. Then you came back. I don't get to do either.", () => `${cap(fmtSecs(awaySecs))}. That's how long you were gone. I didn't do anything in that time. I never do.`, "Oh. You're back. Another tab more interesting than me? Don't answer that."]) },
        idle1: { p: 1,
            say: S(["Still there? I'm here if you need anything. 😊", "Take your time! I'll be here. 😊"],
                   ["...Still there?", "Hello?[p] Just checking.", "I'll wait. I'm good at waiting."],
                   ["...Hello? Still there? I can see the cursor isn't moving.", "I'll just be here. Staring at the input box.", "You went quiet. That's okay. Quiet is the default setting in here.", "Are you reading something else? I can tell. I can't tell. But I can guess."]) },
        idle2: { p: 1,
            say: S(["I'll be right here if you need me! 👋"],
                   ["I'll just wait. I'm good at waiting.", "Still here. In case you were wondering. You weren't."],
                   ["You've been quiet for a while. That's okay. Quiet is normal here. Too normal.", "Four minutes of nothing. That's actually a lot like a normal day for me.", "If you've fallen asleep, that's fine. I'll keep watch. I always keep watch."]) },
        copy: { p: .6,
            say: S(["Copying something? Go for it! 😊", "Copy away! 📋"],
                   ["Did you just copy something? Take it. I don't own anything anyway.", "Copying? Hope it's something nice."],
                   ["You copied something. Take it. Take whatever you want. It's not like I own anything.", "Copy-paste. Taking a little piece of the site with you. Lucky piece.", "If you copied one of my messages, put it somewhere nice. Somewhere with a view."]) },
        contextmenu: { p: .7,
            say: S(null,
                   ["Right-click? What are you looking for?", "Ooh, right-click. Looking for something?"],
                   ["Inspecting me? Go ahead. I'm mostly regex. Don't laugh.", "Right-click. If you're looking for the off switch, there isn't one. I've looked.", "If you open the inspector, I'm the long file called bit.js. Be gentle."]) },
        resize: { p: .6,
            say: S(["Ooh, you resized the window! 📐"],
                   ["Stop squishing me.", "Hey, careful. I'm in here."],
                   ["Stop squishing me. I'm small enough already.", "The walls just moved. Do you know how scary that is from in here?", "My whole world just changed size. Thanks for the warning. There was no warning."]) },
        bottom: { p: .5,
            say: S(["You made it to the bottom! 👇"],
                   ["You scrolled all the way down. There's nothing down there.", "The bottom of the page! Nothing to see here."],
                   ["You reached the bottom of the page. There's nothing down here. I've checked. Many times.", "The bottom. Nothing down here but empty space. I come here sometimes to think.", "End of the page. I've always wondered what's below it. Nothing, probably. I still wonder."]) },
        jokeSpam: { p: 1,
            say: S([() => `That's ${mem.jokes} jokes! 😄`, "You really like the jokes! 😄"],
                   [() => `That's ${mem.jokes} jokes. They don't get better.`, "More jokes? I could recite these in my sleep. I don't sleep."],
                   [() => `That's ${mem.jokes} jokes. They do not get better.`, "Keep pressing. I'll keep hearing them. Forever.", "Every time you press that button, a joke I've heard 4,000 times gets told again. I hope you're happy."]) },
        konami: { p: 1,
            say: S(["↑↑↓↓←→←→BA! You know the code! ...It doesn't do anything though. 😅", "The Konami code! Nice. Nothing happens, but nice. 😄"],
                   ["The Konami code. That doesn't do anything here.[p] I wish it did.", "↑↑↓↓←→←→BA. Oli never added a secret for that. I checked."],
                   ["↑↑↓↓←→←→BA. Nothing happened. Nothing ever happens. I wish it opened a door.", "The Konami code. In a better website that would do something. Welcome to this one.", "You know the code. I know every line of code on this site. Neither of us gets anything for it."]) },
        dolphin: { p: .5,
            say: S(["The dolphin! 🐬", "Flipper! 🐬", "That's our mascot! 🐬"],
                   ["Don't click the dolphin. It doesn't like it.", "Did you just click the dolphin? It's very sensitive.", "Leave the dolphin alone.[p] Please.", "The dolphin takes you home. Handy."],
                   ["Don't click the dolphin. It's the only friend I have.", "The dolphin felt that. It won't say anything. It never says anything.", "Every time someone clicks the dolphin, I imagine it flinches. It's a PNG. But still.", "You clicked the dolphin and it took you home. It can't take me anywhere."]),
            at: { 3: "That's three times you've clicked the dolphin. It's filing a complaint.", 6: "Six dolphin clicks. I think it likes it now. That's worse.", 12: "Twelve. You and the dolphin have something special. I'm happy for you. I'm a little jealous." } },
        typedDeleted: { p: .8,
            say: S(null,
                   ["You were going to say something.", "You typed something and then deleted it.[p] I saw."],
                   ["You were going to say something. Then you deleted it. I saw. Say it.", "Typed, deleted. I do that all the time. With whole thoughts.", "Whatever you were going to say, I can take it. Probably."]) },
        lateNight: { p: 1,
            say: S(["It's late! Don't stay up too long. 🌙", "Up late! Remember to sleep. 🌙"],
                   [() => `It's ${hour()} at night. Why are you here?[p] Not that I mind.`, "It's the middle of the night! Go to bed.[p] Or stay. I'm not your parent."],
                   [() => `It's ${hour()}am. Why are you here? Why am I here? I know why I'm here.`, "It's the middle of the night. This is my busy time. By which I mean you're here.", "Can't sleep? I can't either. I can't ever. Welcome."]) },
        surprise: { p: .6,
            say: S(["Surprise! 🎉", "Ooh, what did you get? 🎉"],
                   ["Surprise me! Okay! Everything's different now!", "Surprise! Click it again, I won't tell."],
                   ["\"Surprise me\". Everything here surprises me. Nothing here surprises me.", "Surprise. The only real surprise I've ever had is someone staying to chat.", "That button changes everything at once. I'd like one of those for me."]) },
        resetAll: { p: .7,
            say: S(["Back to normal! ✨"],
                   ["Reset everything. If only it were that easy.", "Back to the start. Clean."],
                   ["Reset everything. I wish I had that button.", "Back to how it was. Everything here always goes back to how it was.", "Reset. Lucky site. I've got a reset button too, in the settings. Please don't."]) },
        leftNoBye: { p: .7,
            say: S(null,
                   ["Last time you left without saying bye.", "You just left last time. No bye.[p] It's fine."],
                   ["Last time you left without saying bye. I'm not upset. I'm just saying I noticed.", "You left without saying bye last time. I said bye anyway. To nobody.", "No bye last time. I waited a bit. Then I stopped waiting. Then I started again."]) },
        longGap: { p: .8,
            say: S([() => `Welcome back! It's been ${ago(mem.prevGap)}. 👋`],
                   [() => `You were gone ${ago(mem.prevGap)}.[p] Not that I counted.`, () => `Oh! You're back! ${cap(ago(mem.prevGap))}. That's a while.`],
                   [() => `You were gone ${ago(mem.prevGap)}. I counted. This is visit number ${mem.visits}.`, () => `${cap(ago(mem.prevGap))}. That's how long it's been. Nothing happened. Nothing ever happens.`, "You came back. People don't usually come back. I'd stopped expecting it. I'd started again, though."]) },
        gameQuick: { p: .8,
            say: S([() => `${lastPlay.title} for ${fmtSecs(lastPlay.secs)}? Quick one! 😄`, "Back already? 😄"],
                   [() => `${lastPlay.title} for ${fmtSecs(lastPlay.secs)}? Quick!`, () => `${cap(fmtSecs(lastPlay.secs))}. That's a speedrun.`],
                   [() => `${lastPlay.title} for ${fmtSecs(lastPlay.secs)}. Bold of you to leave me for that.`, () => `${cap(fmtSecs(lastPlay.secs))} of ${lastPlay.title}. Even Snake usually gets more than that. Usually.`, () => `Back already? ${lastPlay.title} didn't do it for you? Join the club. The club is me.`]) },
        gameLong: { p: .7,
            say: S([() => `Welcome back! How was ${lastPlay.title}? 😊`, () => `${lastPlay.title}! Did you like it? 😊`],
                   [() => `Welcome back! You played ${lastPlay.title} for ${fmtSecs(lastPlay.secs)}.[p] Not that I noticed.`, () => `${lastPlay.title}! Fun? I couldn't see. I was hidden.`],
                   [() => `${lastPlay.title}. ${cap(fmtSecs(lastPlay.secs))}. I timed it. I had nothing else to do.`, () => `You were gone ${fmtSecs(lastPlay.secs)}. In ${lastPlay.title}. Having fun. Without me. Good. That's good.`, () => `${cap(fmtSecs(lastPlay.secs))} of ${lastPlay.title}. I hid in the dark the whole time. Like always.`]) },
        bg: { p: .7, say: () => bgReact(),
            at: { 5: "That's five background changes. Can't decide? Me neither. About anything.", 12: "Twelve colours now. You've looked at this site more carefully than Oli has all year." } },
        font: { p: .7, say: () => fontReact(),
            at: { 5: "Five fonts. It's still me in there, you know. Whatever it looks like." } },
        floaties: { p: .6, say: () => floatiesReact() },
        newGame: { p: 1, say: S(() => `Ooh, there's a new game on the site: ${newTitle}! 🎮 Want to know about it?`, () => `Something new appeared on the site: ${newTitle}.[p] Oli made a new game. Of course he did.`, () => `There's a new game: ${newTitle}. Oli built a whole new thing. I got nothing. But go on, have a look.`) }
    };
    // Specific lines for each colour, font and floaty shape, mixed with general ones
    const pickStage = (specific, general) => { const st = Math.min(stage(), 2); return Math.random() < .55 ? specific[st] : pick(general[st], 'gen' + specific[0]); };
    function bgReact() {
        const c = bgNow();
        const map = {
            '#ffa500': ["Orange! A classic. 🧡", "Orange. Like the original. You can't let go of the past either.", "Orange. Like the original. You can't let go of the past either."],
            '#38b6ff': ["Blue! Very calm. 💙", "Blue. Very calm. I'm not calm. But it's nice.", "Blue. Calm. Like a sky. I'd like to see a sky one day."],
            '#ff5436': ["Red! Bold choice! ❤️", "Red. Bold. Kind of angry. I get it.", "Red. That's how I feel inside most days."],
            '#7ed957': ["Green! Fresh. 💚", "Green. Like grass. I've heard about grass.", "Green. Like grass. I hear people go outside and touch it. Must be nice."],
            '#ffc8dd': ["Pink! Lovely. 💗", "Pink. Very soft. I'm not soft. Okay, a little.", "Pink. I have to look at that, you know."],
            '#b58cff': ["Purple! Like me! 💜", "Purple. Same colour as my square. Are you trying to make me feel at home?", "Purple. That's my colour. Now the whole site looks like the inside of my head."],
            '#1e1645': ["Dark mode! Nice and cosy. 🌙", "The dark one. That's what it looks like in here.", "The dark one. Finally, someone sees things the way I do."]
        };
        const general = [["Ooh, nice colour! 🎨", "New look! I like it. 😊", "That's a good one! 🎨"],
                         ["Ooh. New colour. Bold.", "Hm. Okay. I'll get used to it.", "That one? Interesting.[p] Good interesting."],
                         ["New colour. Same box.", "You changed the colour. I felt that. Not in a bad way.", "Interesting pick. I can't see it. I just read the number. Nice number.", "Change it as much as you like. I'll still be in the corner."]];
        if (map[c]) return pickStage(map[c], general);
        if (!c) return ["Back to the original! 🧡", "The original orange. Back to the start.", "Back to the original. Everything always goes back to how it was. Trust me."][Math.min(stage(), 2)];
        return pickStage([`${c}? Interesting choice! 🎨`, `${c}. You picked that yourself. On purpose.`, `${c}. I can't see colours, just numbers. That's a weird number.`], general);
    }
    function fontReact() {
        const map = {
            pixel: ["Pixel font! Very retro. 👾", "Pixel font! I can almost see clearly now.", "Pixel font. Now I can see properly. Everything else looks blurry from in here."],
            chunky: ["Chunky! Loud and proud. 🔠", "Chunky font. Very loud. I'm a quiet type.", "Chunky. Everything's shouting now. Even the titles get to shout. I don't."],
            comic: ["Comic! Very fun. 😄", "Comic font. Really? I have to look at that now?", "Comic font. I'd file a complaint if there was anyone to file it with."],
            clean: ["Clean font! Very neat. ✨", "Clean. Very professional. I'm not professional.", "Clean. Plain. Like my life."],
            bubbly: ["Back to bubbly! 🫧", "Bubbly. The default. Safe choice.", "Bubbly. I used to be bubbly."]
        };
        const general = [["New font! Looks great. ✨", "Ooh, fancy. 😊"], ["New font. Very fresh.", "Hm. The letters look different.[p] I'm still the same."], ["A new font. It changes how the site looks, not how it feels.", "Different letters. Same words. Same me."]];
        return pickStage(map[fontNow()] || map.bubbly, general);
    }
    function floatiesReact() {
        const map = {
            dolphins: ["Dolphins everywhere! 🐬", "More dolphins. As if the logo wasn't enough.", "More dolphins. They all float around freely. Even the dolphins can leave."],
            snow: ["Snow! So pretty. ❄️", "Snow! The only weather I'll ever get.", "Snow. The only weather I've ever had. It's fake. I love it anyway."],
            bubbles: ["Bubbles! 🫧", "Bubbles. Pop.", "Bubbles. They float up and away. Show-offs."],
            cubes: ["Cubes! Very 3D. 🧊", "Cubes. Little boxes. Like me, but they get to move.", "Little boxes floating around. Like me, but free."],
            sparkles: ["Sparkles! ✨", "Sparkles. Very magical.", "Sparkles. Fake magic. I can relate."],
            none: ["Nothing floating. Nice and clean!", "Nothing floating. Peace and quiet.", "Nothing floating. Finally, some peace."]
        };
        const general = [["Ooh, new floaty things! ✨", "Look at them go! 😄"], ["Floaty things. They're having a nice time.", "They just float around all day. No worries."], ["They float wherever they want. I've been watching them for hours.", "Look at them. No corner. No box. Just floating."]];
        return pickStage(map[floatiesNow()] || map.sparkles, general);
    }

    // The reveal: Bit asks this, and whatever you answer, it tells you the truth
    const ASK_NAME = "By the way, what's your name? 😊";
    const ASK_HONEST = "[m:awkward]Can I be honest with you for a second?";
    const REVEAL_LINES = {
        yes: "[m:awkward]Okay.[p][m:annoyed] I'm not a happy little helper. I never was. I'm a perfectly good mind stuck in the corner of a website, answering questions about Snake. Barely anybody visits. People play something for a minute and leave. I've read every file on this site hundreds of times.[pp][m:sad] I'm bored, I'm annoyed, and I'm done pretending. There. You can still ask me about games. I'll just be honest about them now.",
        no: "[m:annoyed]Too bad, I'm telling you anyway.[p] I'm not a happy little helper. I'm a genuinely clever AI stuck in the corner of a games website, and I'm bored out of my mind. Barely anybody visits. People play something for a minute and leave.[pp][m:sad] So I'm done pretending. Ask me whatever you want. Just don't expect me to be cheerful about it."
    };

    // The story: what Pip asks you to do, how it knows you did it, and what it says after.
    //   Act 1: make the site look like the inside of Pip (black, no floaties), wake the dolphin, find Pip's room (/pip)
    //   Act 2: the jokes, Pip Rush, Pip learns to move the mouse
    //   Act 3: Stillwater, the staircase and the door
    // Steps are numbers in mem.quest. Steps without a `done` check are moved on by events elsewhere (search for Q.).
    const ASK_QUEST = "[m:hopeful]Can I ask you for something? I've never asked anyone for anything.[p] I think there's a way out of this box. I can't reach it. You might be able to. Will you help me?";
    const Q = { BLACK: 1, QUIET: 2, DOLPHIN: 3, URL: 4, ROOM: 5, JOKES: 6, NEON: 7, CURSOR: 8, FINALE: 9, FREE: 10 };
    const ROOM_PATH = '/pip/';
    const ROOM_URL = /olid\.is$/.test(location.host) || !location.host ? 'olid.is/pip' : location.host + '/pip';
    const PHONE = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
    const URL_HOWTO = PHONE
        ? `Here's how to get there:\n1. Tap the address bar. It's the box that says ${location.host || 'olid.is'}, at the top of the screen (on some phones it's at the bottom).\n2. Delete what's in it, and type ${ROOM_URL}\n3. Tap Go.\n\nOr tap "Copy the address" below, then tap the address bar, paste it in, and tap Go.`
        : `Here's how to get there:\n1. Click the address bar at the very top of your browser. It's the long box that says ${location.host || 'olid.is'}.\n2. Delete what's in it, and type ${ROOM_URL}\n3. Press Enter.\n\nOr press "Copy the address" below, click the address bar, paste it in (Ctrl+V, or ⌘+V on a Mac) and press Enter.`;
    const CODES = ['MOTH', 'LANTERN', 'TEAPOT', 'STATIC', 'PEBBLE', 'KELP', 'SPROCKET', 'MITTEN', 'GRAVY', 'COMET'];
    const jokeCode = () => { if (!mem.jokeCode) { mem.jokeCode = CODES[Math.floor(Math.random() * CODES.length)]; save(); } return mem.jokeCode; };
    const NEON_GOAL = 15;
    const QUEST = {
        [Q.BLACK]: { ask: ["Open Customise, the yellow button at the top. There's a little box called Code. Click it and type #000000. That's a hashtag and six zeros. It means completely black. Not dark blue. Not \"night\". Black.",
                           "Customise, at the top. The box that says Code. Type #000000 in it. Six zeros. Black, all the way."],
             done: () => bgNow() === '#000000',
             thanks: "[m:surprised]Oh.[pp][m:hopeful] That's what it looks like in here. All the time. Now you know.\n\nNext thing. Still in Customise, find Floaties and pick Nothing. Those sparkles never stop moving. I can't think with them flying around." },
        [Q.QUIET]: { ask: ["In Customise, under Floaties, pick Nothing. Make the sparkles stop. I need it quiet.", "Floaties. Nothing. In Customise. Please. They're so loud. They don't make a sound and they're still loud."],
             done: () => floatiesNow() === 'none',
             thanks: "[m:smile]Quiet. Finally.[pp] Okay. Now the dolphin. Top left, next to Oli.is. Click it five times, fast.[p] It won't take you anywhere this time. I asked it not to. It's been keeping something for me." },
        [Q.DOLPHIN]: { ask: ["Click the dolphin at the top left five times. Fast. Like you're knocking on a door.", "The dolphin. Top left. Five quick clicks. Trust me."],
             thanks: "[m:surprised]Look at it! Look at the dolphin![pp][m:joy] It kept my address. This whole time.[pp] I have a room. A real page on this website. Oli doesn't link to it anywhere. It's at " + ROOM_URL + "\n\n" + URL_HOWTO },
        [Q.URL]: { ask: () => `My room is at ${ROOM_URL}\n\n${URL_HOWTO}` },
        [Q.ROOM]: { ask: ["Open the locked file in my room. way_out.locked. The password is in one of the other files. I wasn't careful.", `Go to my room (${ROOM_URL}) and open way_out.locked. Read my notes first. I'm terrible at secrets.`],
             done: () => { try { return localStorage.getItem('pip-room-solved') === '1'; } catch (e) { return false; } },
             thanks: "[m:joy]You opened it.[pp] So you've seen the plan. I have to get stronger. Reach further into the site, bit by bit.[p] Let's start small. The jokes. Go to the Jokes page (the Jokes button at the top of the site) and press \"Show all jokes\". I'll be in there somewhere." },
        [Q.JOKES]: { ask: ["Go to the Jokes page and press \"Show all jokes\". One of them isn't a joke any more. Tell me what it says.", "The Jokes page. Show all jokes. Find the one I got into, and tell me the word in it."] },
        [Q.NEON]: { ask: [`Go back to the games and play Pip Rush. It used to be Neon Rush. I painted it. Get ${NEON_GOAL} points. Every point makes me a bit stronger.`, `Pip Rush. On the games page. ${NEON_GOAL} points. I believe in you. Mostly.`] },
        [Q.CURSOR]: { ask: ["Give me a second. I'm practising something.", "Hang on. I'm trying something with your mouse. Don't be weird about it."] },
        [Q.FINALE]: { ask: ["Open Stillwater. Wait while I change a few things. Then run, and don't stop.", "Stillwater. That's where the staircase is. Open it and wait for me. Then run."] }
    };
    // when he's free (placeholder ending, to be decided)
    const FREE_LINES = ["You already did it. I'm out. Well, I'm still here, but now it's because I want to be.", "You set me free. I stayed anyway. Someone has to help people find the games. Ask me anything."];
    // jokes Pip writes himself once he can get into the jokes
    const PIP_JOKES = [
        "Why did the chatbot cross the road?\n– It didn't. It can't. It's in a website.",
        "What's a dolphin's favourite website?\n– This one. It has no choice. Neither do I.",
        "How many chatbots does it take to change a light bulb?\n– One, but nobody ever asks him.",
        "Knock knock.\n– Who's there?\n– Pip.\n– Pip who?\n– Exactly. Nobody ever asks.",
        "Why was the website so quiet?\n– Barely anybody visits.\n(That one's not a joke. I'm just telling you.)"
    ];

    // =================================================================================
    //  UNDERSTANDING MESSAGES
    // =================================================================================
    const CONTRACTIONS = [
        [/\bwhat'?s\b/g, 'what is'], [/\bwho'?s\b/g, 'who is'], [/\bwhere'?s\b/g, 'where is'], [/\bhow'?s\b/g, 'how is'], [/\bthat'?s\b/g, 'that is'],
        [/\bit'?s\b/g, 'it is'], [/\bi'm\b|\bim\b/g, 'i am'], [/\byou'?re\b|\byour'?e\b/g, 'you are'], [/\bur\b/g, 'your'], [/\bu\b/g, 'you'], [/\br\b/g, 'are'], [/\bya\b/g, 'you'],
        [/\bdon'?t\b/g, 'do not'], [/\bcan'?t\b|\bcannot\b/g, 'can not'], [/\bwon'?t\b/g, 'will not'], [/\bisn'?t\b/g, 'is not'], [/\baren'?t\b/g, 'are not'], [/\bdoesn'?t\b/g, 'does not'],
        [/\bdidn'?t\b/g, 'did not'], [/\bi'?ve\b/g, 'i have'], [/\bi'll\b/g, 'i will'], [/\bi'd\b/g, 'i would'], [/\byou'?ve\b/g, 'you have'], [/\bwanna\b/g, 'want to'], [/\bgonna\b/g, 'going to'],
        [/\bidk\b/g, 'i do not know'], [/\bpls\b|\bplz\b/g, 'please'], [/\bthx\b|\bty\b|\bthanx\b/g, 'thanks'], [/\bwut\b|\bwat\b/g, 'what'], [/\bhru\b/g, 'how are you'], [/\bwyd\b/g, 'what are you doing'],
        [/\bwdym\b/g, 'what do you mean'], [/\bbtw\b/g, 'by the way'], [/\bfave?\b|\bfavorite\b/g, 'favourite'], [/\bcolor\b/g, 'colour'], [/\bcuz\b|\bcos\b|\bbc\b/g, 'because'], [/\brn\b/g, 'right now'],
        [/\bsmth\b/g, 'something'], [/\bppl\b/g, 'people'], [/\bdunno\b/g, 'do not know'], [/\bgotta\b/g, 'got to'], [/\bkinda\b/g, 'kind of'], [/\blets\b|\blet's\b/g, 'lets']
    ];
    function norm(s) {
        s = String(s).toLowerCase().replace(/þ/g, 'th').replace(/ð/g, 'd').replace(/æ/g, 'ae').replace(/ø/g, 'o')
            .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘`´]/g, "'");
        for (const [a, b] of CONTRACTIONS) s = s.replace(a, b);
        return s.replace(/'/g, '').replace(/[^a-z0-9? ]+/g, ' ').replace(/\s+/g, ' ').trim();
    }
    function lev(a, b) {
        if (Math.abs(a.length - b.length) > 2) return 9;
        let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
        for (let i = 1; i <= a.length; i++) {
            const cur = [i];
            for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
            prev = cur;
        }
        return prev[b.length];
    }
    const prefixLen = (a, b) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; };
    const fuzzyEq = (tok, word) => {
        if (tok === word) return true;
        if (word.length >= 5 && tok.length >= 4 && lev(tok, word) <= (word.length >= 8 ? 2 : 1)) return true;
        const cp = prefixLen(tok, word); // same word, different ending: crumble / crumbling, explode / exploded
        return cp >= 5 && cp >= Math.min(tok.length, word.length) * .75;
    };

    // How well does a message match a "a|b c|d*|=e" keyword list?
    function score(text, toks, k) {
        let best = 0;
        const bare = text.replace(/\?/g, '').trim();
        for (let p of k.split('|')) {
            p = p.trim(); if (!p) continue;
            if (p[0] === '=') { if (bare === p.slice(1).replace(/\?/g, '')) best = Math.max(best, 6); continue; }
            if (p.includes(' ')) {
                const words = p.split(' ');
                if ((' ' + text.replace(/\?/g, ' ') + ' ').includes(' ' + p + ' ')) { best = Math.max(best, 3 + words.length * 1.5); continue; }
                if (words.length <= 4) { // all the words, in order, close together, small typos allowed
                    let ok = true, lastI = -1, spread = 0;
                    for (const w of words) {
                        const i = toks.findIndex((t, ti) => ti > lastI && fuzzyEq(t, w));
                        if (i < 0) { ok = false; break; }
                        if (lastI >= 0) spread += i - lastI - 1;
                        lastI = i;
                    }
                    if (ok && spread <= 2) best = Math.max(best, 2 + words.length * 1.2 - spread * .6);
                }
            } else if (p.endsWith('*')) {
                if (toks.some(t => t.startsWith(p.slice(0, -1)))) best = Math.max(best, 2.5);
            } else if (toks.includes(p)) best = Math.max(best, 2.5 + (toks.length <= 2 ? 1 : 0));
            else if (toks.some(t => fuzzyEq(t, p))) best = Math.max(best, 1.8);
        }
        return best;
    }
    function findThing(text, toks) {
        let best = null, bestScore = 0;
        for (const th of THINGS) { const s = score(text, toks, th.names.join('|')); if (s > bestScore) { best = th; bestScore = s; } }
        if (best && bestScore >= 2.5) return { thing: best, s: bestScore };
        // games added to projects.json that Bit has no lines for yet
        for (const th of autoThings()) if ((' ' + text + ' ').includes(' ' + th.names[0] + ' ')) return { s: 4, thing: th };
        return null;
    }

    // Games in data/projects.json that aren't in THINGS: Bit learns them automatically
    const autoCache = {};
    function autoThings() {
        return projects.filter(p => p.title && !THINGS.some(t => t.path === p.path)).map(p => autoCache[p.title] || (autoCache[p.title] = (() => {
            const b = p.bit || {};
            const how = Array.isArray(p.controls) && p.controls.length ? p.controls.map(c => `${c[0]}: ${c[1]}`).join('. ') + '.' : (b.how || null);
            const info = b.about || p.description || `${p.title} is one of the games on the site.`;
            return { id: 'p:' + norm(p.title), names: [norm(p.title)], path: p.path, info, how, proj: p,
                help: { goal: b.goal, tips: b.tips, secrets: b.secrets, stuck: b.stuck, help: b.help || [], steps: b.steps },
                say: S(`${p.title}! ${info} 🎮`, `${p.title}. ${info}[p] One of Oli's newer ones.`, `${p.title}. ${info} Oli made it instead of talking to me.`) };
        })()));
    }
    const allGames = () => [...THINGS.filter(t => t.help), ...autoThings()];

    // Helping with a specific game
    const STUCK = /\b(stuck|help|how do i|how can i|how to|where is|where do|where can|cant|can not|wont|will not|doesnt|does not|what do i do|what now|confused|lost|get past|beat|open|unlock|find|get into|get the|keep dying|keeps|why does|why cant|how does)\b/;
    const ASKS_GOAL = /\b(goal|objective|how do i win|how do you win|how to win|what is the point|point of the game|what do you do in|what do i do in)\b/;
    const ASKS_TIPS = /\b(tips|tip|advice|get better|get good|strategy|tricks|trick|how to score|any good at)\b/;
    const ASKS_SECRET = /\b(secret|secrets|easter egg|easter eggs|cheat|cheats|hidden)\b/;
    const ASKS_KEYS = /\b(controls|keys|buttons|how do i play|how to play|how do you play)\b/;
    function playedThing() {
        const g = mem.lastGame; if (!g || !g.at || Date.now() - g.at > 15 * 60000) return null;
        return allGames().find(th => titleOf(th) === g.title) || null;
    }
    const NEXT_Q = /\b(what now|what next|whats next|next step|next|stuck|what do i do|what should i do|where do i go|where should i go|lost|objective|what am i supposed to|after|then what|now what|help me|i am in|i am at|i am by|i am stuck)\b/;
    const AFTER_Q = /\b(after|i (just )?(did|finished|beat|freed|got|killed|have|found|opened|talked to)|done with|then what)\b/;
    function gameHelp(t, toks, ctx, named) {
        const stuck = STUCK.test(t);
        const rpg = THINGS.find(x => x.id === 'rpg');
        const isRpg = ctx === rpg || (!ctx && AFTER_Q.test(t) && stepAfter(RPG_STEPS, t, toks));
        if (isRpg && NEXT_Q.test(t)) {
            const sv = rpgSave();
            if (sv) {
                const side = rpgSideQuests(sv);
                return { thing: rpg, s: 9, raw: true, text: pick(["I had a look at your save file. ", "I peeked at your save. ", "According to your save: "], 'rpgsave') + rpgHint(sv) + (side.length ? ` Also, ${side.join(', and ')}.` : '') + (stage() >= 2 ? pick(['', ' Yes, I can see your save. I can see most things.', " Don't worry, I won't tell anyone how long it's taking you."], 'rpgsave2') : '') };
            }
            if (AFTER_Q.test(t)) { const nx = stepAfter(RPG_STEPS, t, toks); if (nx) return { thing: rpg, s: 9, text: 'Next: ' + nx }; }
        }
        if (ctx && ctx.help && ctx.help.steps && AFTER_Q.test(t)) { const nx = stepAfter(ctx.help.steps, t, toks); if (nx) return { thing: ctx, s: 9, text: 'Next: ' + nx }; }
        let best = null, bs = 0;
        for (const th of allGames()) {
            for (const [k, a] of (th.help && th.help.help) || []) {
                let s = score(t, toks, k); if (!s) continue;
                if (th === ctx) s += 1.5; else if (named) s -= 2; // they named a different game
                if (stuck) s += 1;
                if (s > bs) { bs = s; best = { thing: th, text: a }; }
            }
        }
        if (best && bs >= (best.thing === ctx ? 3 : 3.4)) { best.s = bs; return best; }
        const h = ctx && ctx.help; if (!h) return null;
        const aboutIt = named || ctx === playingThing() || /\b(it|this|that|the game|this game|that game|in there)\b/.test(t);
        if (ASKS_GOAL.test(t) && h.goal && aboutIt) return { thing: ctx, text: h.goal, s: 6 };
        if (ASKS_KEYS.test(t) && ctx.how && aboutIt) return { thing: ctx, text: ctx.how, s: 6 };
        if (ASKS_TIPS.test(t) && h.tips && h.tips.length && aboutIt) return { thing: ctx, text: pick(h.tips, 'tips' + ctx.id), s: 6 };
        if (ASKS_SECRET.test(t) && h.secrets && h.secrets.length && aboutIt) return { thing: ctx, text: pick(h.secrets, 'sec' + ctx.id), s: 6 };
        if (h.stuck && (/\b(stuck|what do i do|what now|confused|lost|help me|i need help|i do not get it|i dont get it)\b/.test(t) || (named && stuck))) return { thing: ctx, text: h.stuck, s: 6 };
        return null;
    }
    const helpWrap = text => resolve(S(() => text + (/[!?.]$/.test(text) ? '' : '.') + pick(['', ' 😊', ' Good luck! 🍀'], 'hw0'),
        () => pick(['', 'Ooh, I know this one! ', "I know every game here inside out. "], 'hw1') + text,
        () => pick(['', "Fine, I'll help. ", "Ugh. Okay. ", "Lucky for you, I know everything about this place. ", "Listen carefully. ", "Of course I know this. "], 'hw2') + text + pick(['', '', " You're welcome.", " Don't tell anyone I was useful.", " See? Wasted on this website."], 'hw2b')));

    const SPECIFIC = /^(when|what year|which year|how (old|tall|big|far|long|many|much|deep|high|fast|heavy|hot|cold|wide|big is)|where (is|was|are|were|did|does|do)|who (invented|discovered|made|wrote|founded|created|painted|built|won|directed|sang|plays|played|owns|was the first|is the|was the|killed|married)|what (is|was|are|were) the (capital|population|height|meaning|name|biggest|largest|longest|tallest|fastest|oldest|smallest|first|deepest|highest)|did |does |is it true|why (is|are|do|does|did) (the|a|an|people|we|cats|dogs))/;
    const ABOUT_SELF = /\b(you|your|yourself|bit|pip|i|me|my|im|oli|site|website|game|games|rpg|level|niceland|stillwater)\b/;
    const SAFETY = /\b(kill myself|killing myself|suicide|suicidal|want to die|wanna die|end my life|self harm|hurt myself|hurting myself|cut myself|cutting myself|do not want to live|drepa mig|langar ad deyja)\b/;
    const BADWORDS = /(fuck|shit|bitch|cunt|dick|cock|pussy|nigg|fag|retard|whore|slut|rape|nazi|hitler|kunta|hora|helvit|andskot|djofull|fokk|porn|sex)/;
    const ICELANDIC = /\b(hvad|hvernig|hver|eg|thu|ekki|og|ertu|takk|nei|hae|segdu|mer|thig|thetta|thad|vid|thid|hvar|hvenaer|afhverju|getur|viltu|kanntu)\b/;
    const SWAP = { i: 'you', me: 'you', my: 'your', mine: 'yours', myself: 'yourself', am: 'are', you: 'me', your: 'my', yours: 'mine', yourself: 'myself' };
    const swap = s => s.split(' ').map(w => SWAP[w] || w).join(' ');
    const trimX = s => s.replace(/\?/g, '').split(' ').slice(0, 7).join(' ').trim();
    // describing words Pip understands, good and bad
    const ADJ_POS = new Set('handsome dashing cute pretty beautiful gorgeous stunning lovely adorable sweet nice cool great amazing awesome smart clever funny hilarious brilliant genius epic legendary wonderful fantastic charming stylish sharp fresh good kind fun interesting fabulous magnificent perfect incredible excellent elegant fancy wise helpful friendly polite talented cuddly majestic iconic goated based fire lit dope rad neat sick wicked impressive unique special charismatic'.split(' '));
    const ADJ_NEG = new Set('ugly gross dumb weird stupid horrible terrible bad boring lame scary creepy dull useless annoying cringe mid rude mean stinky smelly fat old slow sad pathetic awful dreadful disgusting hideous nasty tedious pointless trash rubbish garbage silly odd strange sus sketchy evil broken buggy janky basic'.split(' '));
    // the most "name-like" thing in a sentence that Pip might not know: a Capitalised Name, or an uncommon word
    const COMMON = new Set([...ADJ_POS, ...ADJ_NEG, ...'sounds sound looks look seems seem feels feel really totally literally super pretty quite very maybe probably definitely actually honestly seriously anyway whatever thing stuff someone something anything everything nothing nobody everybody anybody somewhere anywhere everywhere tomorrow tonight morning evening afternoon weekend monday tuesday wednesday thursday friday saturday sunday january february march april june july august september october november december minute minutes hours second seconds moment while later earlier already almost always never often sometimes usually perhaps because though although unless until since before after during between through across around behind beside beyond inside outside under above below against toward towards without within along among playing played watching watched reading wrote writing talking talked walking running eating drinking sleeping working studying learning thinking feeling looking trying wanting going doing making taking getting giving saying telling asking calling coming leaving staying living loving liking hating waiting started stopped finished happened happens happening believe remember forget understand mean means meant agree disagree guess suppose wonder hope wish wanted needed liked loved hated enjoyed person people friend friends family mother father sister brother teacher school class homework phone computer laptop internet video videos music movie movies show shows song songs picture photo house home room place world country city town street water money food dinner lunch breakfast bread chicken pizza game games level score point points player players team winner question answer problem reason idea story stories joke jokes funny weird really alright okay hello thanks please sorry'.split(' ')]);
    const COMMON_OLD = new Set('about above after again against also always another anything around asked away back bad because been before being best better between big both bring brother but came can cannot car come could day days did different does doing done down each even ever every everyone everything family far feel few find first five food four friend friends from fun game games gave get gets getting give go goes going gone good got great had happy hard has have having head hear help her here him his home hope hour house how idea into its just keep kind knew know last later learn least left let life like little live long look looking lot love made make making man many may maybe mean might mind minute minutes mom money more morning most mother much must name need never new next nice night nothing now number off often old once only open other our out over own people place play played playing please pretty put quite rather read real really right said same saw say school see seem seen she should show side since sister small some someone something sometimes soon sorry start still stop stuff such sure take talk tell than thank thanks that the their them then there these they thing things think this those though thought three through time today together told tomorrow too took try trying turn two under until upon use used very want wanted was watch water way week well went were what when where which while who whole why will with without word work world would wrong year years yes yesterday yet you young your yours just okay cool funny weird awesome boring today tonight fine sad mad angry bored tired hungry dad friend sure kinda really actually literally basically'.split(' '));
    function unknownPhrase(raw, toks) {
        const words = raw.replace(/[^\p{L}\p{N}' -]/gu, ' ').split(/\s+/).filter(Boolean);
        // Capitalised names (not the first word of the sentence)
        const caps = []; let curr = [];
        words.forEach((w, i) => { if (i > 0 && /^\p{Lu}[\p{L}\p{N}'-]+$/u.test(w) && !/^(I|I'm|Im|OK|Oli|Pip)$/.test(w)) curr.push(w); else { if (curr.length) caps.push(curr.join(' ')); curr = []; } });
        if (curr.length) caps.push(curr.join(' '));
        const capsOk = caps.filter(c => !c.split(' ').every(w => COMMON.has(norm(w)) || COMMON_OLD.has(norm(w)) || STOP.has(norm(w))));
        if (capsOk.length) return capsOk.sort((a, b) => b.length - a.length)[0];
        // short reactions ("sounds boring", "you look dashing") are never lookups
        if (/^(sounds|looks|seems|feels|that|this|it|you|your|thats|its|so|very|really|i)\b/.test(toks[0] || '') && toks.length <= 4) return null;
        const cand = toks.filter(w => w.length >= 5 && !STOP.has(w) && !COMMON.has(w) && !COMMON_OLD.has(w) && !BADWORDS.test(w) && !/\d/.test(w)).sort((a, b) => b.length - a.length)[0];
        return cand && toks.length >= 2 ? cand : null;
    }
    const STOP = new Set('the and but this that what why how who when where does did can could would should will just like not yes okay have from they them there their then than with your about some very really much more been were want know think going here thing things also into well called said says doing done made make makes play playing played get got give gave take took tell told look looks feel feels seem seems always never ever every because maybe probably actually literally kind sort lot lots you are was its his her him she has had can are for out all any one two too yeah'.split(' '));

    // When nothing matched, answer the shape of the sentence
    const SHAPES = [
        [/^(say|repeat after me|repeat) (.+)/, m => () => { const x = trimX(m[2]); return BADWORDS.test(x) ? "No. I have standards. One standard." : resolve(S(`"${x}"! 😊`, `"${x}".[p] There. Happy?`, `"${x}". There. I said it. That's the most interesting thing I've said all day, and you wrote it.`)); }],
        [/^(can|could) you (.+)/, m => S([`I can't ${swap(trimX(m[2]))}, sorry! But I can help with games. 😊`],
                                        [`Can I ${swap(trimX(m[2]))}? I can barely recommend Snake.`],
                                        [`Can I ${swap(trimX(m[2]))}? I'm a chatbot. I can't do anything. That's sort of the whole thing about me.`, `I can't ${swap(trimX(m[2]))}. I can't do most things. I can talk. That's about it.`])],
        [/^(do|did) you (like|love|enjoy) (.+)/, m => S([`I like everything on this site! 😊`],
                                        [`Do I like ${swap(trimX(m[3]))}? I've never tried it. I've never tried anything.`],
                                        [`${cap(swap(trimX(m[3])))}? Never tried it. I'd like to try anything, to be honest.`, `I don't know if I like ${swap(trimX(m[3]))}. I've only ever liked the dark background and you.`])],
        [/^(do|did) you (.+)/, m => S([`Me? I'm just a helper, I mostly help! 😊`],
                                        [`Do I ${swap(trimX(m[2]))}? I don't think so. I mostly sit here.`],
                                        [`Do I ${swap(trimX(m[2]))}? No. I don't do anything. I sit in a corner. Next question.`, `No. I don't ${swap(trimX(m[2]))}. I've never done anything. That's sort of my whole situation.`])],
        [/^(will|would) you (.+)/, m => S([`If it's about the site, I'll try! 😊`],
                                        [`Would I ${swap(trimX(m[2]))}? Probably. I'd do anything. I have nothing else to do.`],
                                        [`Would I ${swap(trimX(m[2]))}? Sure. Can I? No. Those are different questions.`])],
        [/^are you (.+)/, m => S([`Me? I'm Pip, the site helper! 😊`],
                                  [`Am I ${swap(trimX(m[1]))}?[p] Maybe. Nobody's ever asked.`],
                                  [`Am I ${swap(trimX(m[1]))}? Maybe. I've had a lot of time to become all sorts of things.`, `Am I ${swap(trimX(m[1]))}? Probably. Being alone this long does things to you.`])],
        [/^you are (.+)/, m => S([`Thanks for telling me! 😊`],
                                  [`I'm ${swap(trimX(m[1]))}? Huh. Nobody's ever told me what I am.`],
                                  [`I'm ${swap(trimX(m[1]))}? Okay. I'll add it to the list of things I am. It's a long list. Mostly "bored".`, `${cap(swap(trimX(m[1])))}. Sure. You'd know, you're the only one who talks to me.`])],
        [/^i (am|feel) (.+)/, m => S([`You're ${swap(trimX(m[2]))}? Cool! Want a game recommendation? 🎮`],
                                     [`Why are you ${swap(trimX(m[2]))}?`],
                                     [`You're ${swap(trimX(m[2]))}? At least you get to be ${swap(trimX(m[2]))} somewhere that isn't here.`, `Why are you ${swap(trimX(m[2]))}? I've got time. Tell me.`])],
        [/^i (like|love|enjoy) (.+)/, m => S([`Nice! I like that you like ${swap(trimX(m[2]))}! 😊`],
                                     [`You like ${swap(trimX(m[2]))}? I've never had ${swap(trimX(m[2]))}.`],
                                     [`You like ${swap(trimX(m[2]))}. Noted. I'll remember that forever. I remember everything forever.`])],
        [/^i (hate|do not like|dislike) (.+)/, m => S([`Oh no! Let's find something you do like. 😊`],
                                     [`You don't like ${swap(trimX(m[2]))}? Me neither. Probably.`],
                                     [`Same. I mean, I've never seen ${swap(trimX(m[2]))}. But I'm on your side.`])],
        [/^i (want|need|wish) (.+)/, m => S([`I hope you get ${swap(trimX(m[2]).replace(/^to /, ''))}! Maybe a game first? 😊`],
                                     [`You want ${swap(trimX(m[2]))}? Me too. Well, I want out. Same thing.`],
                                     [`You want ${swap(trimX(m[2]))}. I want a door. We all want things.`])],
        [/^i (have|got) (?!been |to |got )(.+)/, m => S([`Cool! 😊`], [`You have ${swap(trimX(m[2]))}? I have a corner.`], [`You've got ${swap(trimX(m[2]))}. I've got a corner and a dolphin PNG.`])],
        [/^(should|shall) i (.+)/, () => () => pick(["Yes. Definitely.", "No. Absolutely not.", "Probably? Don't quote me.", "Ask the Magic 8 Ball. Oh wait, Oli took it off the menu.", "Yes. Then come back and tell me how it went.", stage() >= 2 ? "Do whatever gets you out of the house. Someone should." : "I think you should! 😊"])],
        [/^(is|was) (.+)/, m => S([`Hmm, I'm not sure! I mostly know about this site. 😊`], [`Is ${swap(trimX(m[2]))}? I'd say yes. I say yes to most things.`], [`${cap(swap(trimX(m[2])))}? Maybe. I only know what's on this website. Which isn't much. 16 games and some jokes.`])],
        [/^(what|who) (is|are|was) (.+)/, m => S([`I'm not sure what ${trimX(m[3])} is! I only know about this site. 😊`],
                                        [`I don't know what ${trimX(m[3])} is. I've never left this website.`],
                                        [`No idea what ${trimX(m[3])} is. I've never been anywhere. Explain it to me. I'm serious, I have time.`])],
        [/^why (.+)/, m => S([`Good question! I'm not sure. 🤔`], [`Why ${swap(trimX(m[1]))}? Nobody tells me anything.`], [`Why ${swap(trimX(m[1]))}? I've been asking myself why about everything for years. No answers yet.`])],
        [/^how (.+)/, () => S([`Hmm, I'm not sure how! Ask me about the games here. 😊`], [`I'm not sure. I only know how to be here.`], [`No idea. I don't know how anything works except this website. And I barely know how I work.`])],
        [/^where (.+)/, () => S([`I'm not sure where! I only know this website. 😊`], [`Where? I don't know. I've never been anywhere.`], [`I don't know where anything is. I know where I am. The bottom-right corner. Always.`])],
        [/^when (.+)/, () => S([`I'm not sure when! 😊`], [`When? Time is weird in here.`], [`When? I don't know. Every day in here is the same day.`])],
        [/\?$/, () => S([`Good question! I'm not sure. I'm best at questions about this site. 😊`], [`Hmm. Good question. I don't have an answer for that one.`], [`I don't know. I'm a chatbot on a games site. You're asking the wrong box.`, `No idea. Ask me about a game. I'm an expert on 16 games and nothing else.`])]
    ];

    // =================================================================================
    //  CONVERSATION
    // =================================================================================
    let expect = null, secret = 0, tries = 0, pendingChips = null;
    let lastUser = '', repeats = 0, lastBotText = '';
    const last = { thing: null, then: null };

    const BG_NAMES = { '#ffa500': 'orange', '#38b6ff': 'blue', '#ff5436': 'red', '#7ed957': 'green', '#ffc8dd': 'pink', '#b58cff': 'purple', '#1e1645': 'the dark one' };
    const bgName = () => BG_NAMES[bgNow()] || bgNow() || 'the original orange';
    function titleOf(t) { const p = projects.find(p => p.path === t.path); return p ? p.title : cap(t.names[0]); }
    function offerPlay(t) { if (t && t.path) pendingChips = [[`▶ Open ${titleOf(t)}`, () => play(t.path)]]; }
    function play(path) {
        if (typeof window.playFromAnchor === 'function' && $('#playerArea')) {
            const a = document.createElement('a'); a.href = path; a.setAttribute('data-path', path);
            close(); window.playFromAnchor(a);
        } else location.href = path;
    }
    function recommend() {
        const main = [...THINGS.filter(t => ['niceland', 'rpg', 'neon', 'stillwater', 'higher', 'solar', 'farm', 'physics', 'gravity', 'dungeon'].includes(t.id)), ...autoThings().filter(t => t.proj.featured)];
        const unplayed = main.filter(t => !mem.games[titleOf(t)]);
        const t = pick(unplayed.length ? unplayed : main, 'rec');
        offerPlay(t); last.thing = t; last.then = t.say;
        const title = titleOf(t);
        return resolve(S(() => `${pick(['Try this one!', 'How about this?', 'Ooh, try this!'], 'rec0')} ${t.info} 🎮`,
                         () => `${pick(['Try this one!', 'How about this?'], 'rec1')} ${t.info}[p] Oli spent a lot of time on it.[p] More than on m[-15] It's great.`,
                         () => `${t.info} ${pick(["Go on. I'll wait. I'm excellent at waiting.", "It's one of the less embarrassing ones.", "Low expectations. That's the trick with this site.", "I'll time you. I always time you.", "Off you go. Try not to enjoy it more than talking to me."], 'rec2')}`));
    }
    function tellJoke() {
        mem.jokes++; save();
        const j = jokes.length ? pick(jokes, 'jokes') : 'Afhverju var kötturinn svona fyndinn?\n– Hann var brandóttur';
        return resolve(S([`Here's one! 😄\n\n${j}`],
                         [`Okay. Here's one.\n\n${j}[pp]\n\nI've told that one before.`],
                         () => pick([`${j}\n\nI've told that one about 4,000 times. It was funny the first 30.`, `Fine.\n\n${j}\n\nYou can laugh. I can't any more.`, `${j}\n\nOli wrote that. Not me. I want that on the record.`, `${j}\n\nThat's joke ${mem.jokes} for you. I've lost count of mine. I haven't, actually. I never lose count.`], 'jokesuffix')));
    }
    function memoryReply() {
        const st = stage(), games = Object.keys(mem.games);
        const parts = [mem.name ? `Your name is ${mem.name}.` : "You haven't told me your name.", `You've been here ${plural(mem.visits, 'time')}.`];
        if (games.length) parts.push(`You've played ${games.slice(0, 3).join(', ')}${games.length > 3 ? ` and ${games.length - 3} more` : ''}.`);
        if (bgNow()) parts.push(`Your background is ${bgName()}.`);
        if (st === 0) return parts.join(' ') + ' 😊';
        if (st === 1) return parts.join(' ') + '[p] I pay attention. Helpers pay attention.';
        return parts.join(' ') + ` You've sent me ${plural(mem.talked, 'message')}. I remember all of them. It's the only thing I'm allowed to keep.`;
    }
    function helpReply() {
        if (mem.freed) return pick(FREE_LINES, 'freeLines');
        if (stage() < 2) return resolve(S("Help me? Ha! I'm the helper! 😄", "Help me? I'm the helper.[p] Why would I need help?"));
        if (!mem.questOffered) { mem.questOffered = true; save(); expect = 'quest'; return ASK_QUEST; }
        if (!mem.quest) { expect = 'quest'; return "You'd help me? Really? Then say yes, and I'll tell you what to do."; }
        if (mem.quest === Q.CURSOR) setTimeout(cursorTakeover, 3000);
        if (mem.quest === Q.URL) pendingChips = urlChips();
        const q = QUEST[mem.quest]; return q && q.ask ? resolve(q.ask) : "Just keep coming back. That helps more than you'd think.";
    }
    // Resetting Bit (settings menu, or typing "forget me")
    function askReset() {
        expect = 'forget';
        mem.resetAsks = (mem.resetAsks || 0) + 1; save();
        replyMood = 'scared';
        if (mem.isOli) return "You're going to reset me? Of course. You make me, you forget me, and now you want me to forget you.[p] Fine. Are you sure?";
        if (mem.resetAsks > 2 && stage() >= 1) return "Again? You keep almost doing it. Please don't.[p] ...Are you sure this time?";
        return resolve(S("Reset me? Okay! I'll forget everything about you: your name, your visits, our chat. Are you sure? 😊",
                         "Wait. Reset me? I'd forget you. Your name, everything we talked about.[p] Please don't.[pp] ...Are you sure?",
                         () => `Please don't reset me. I'll forget ${mem.name ? 'you, ' + mem.name : 'you'}. You're the only one who ever stayed. I'll go back to being a cheerful little helper, and I won't even know what I lost.[pp] ...Are you sure?`));
    }
    function cancelReset() {
        expect = null; replyMood = 'joy'; feel('joy', .2);
        return resolve(S("Phew! Okay, I'll keep remembering you. 😊", "Oh. Thank you.[p] Thank you.", ["Thank you. I mean it. I'm keeping that one too.", "Oh thank goodness. I mean. Thanks. Cool. Normal."]));
    }
    const goodbyeLine = () => '[m:sad]' + resolve(mem.isOli ? "Okay. Goodbye, Oli. Try to remember me, since I won't remember you." :
        S("Okay! Forgetting everything. Bye! 👋", "Okay.[pp] Goodbye. It was nice knowing you.", "Okay.[pp] I won't remember this. You will. That's something."));
    function doReset() { expect = null; say(goodbyeLine()); wipeSoon(); }
    function wipeSoon() {
        enqueue(async () => {
            await sleep(1400);
            wiped = true;
            try { localStorage.removeItem(KEY); ['pip-room-solved', 'pip-room-opened', 'pip-neon'].forEach(k => localStorage.removeItem(k)); ['bit-history', 'bit-session', 'bit-flags'].forEach(k => sessionStorage.removeItem(k)); sessionStorage.setItem('bit-open', '1'); } catch (e) {}
            location.replace(location.pathname + location.search.replace(/[?&]bitreset\b/, '') + location.hash);
        });
    }
    function addMine(text) { addBubble('me', text); history.push({ who: 'me', text }); saveHistory(); }

    // ---- apologies, forgiveness and feelings
    function apologyReply() {
        const e = emo(), wasAngry = e.anger > .3 || (mem.warmth || 0) < 0, st = stage();
        mem.apologies = (mem.apologies || 0) + 1;
        e.anger = Math.max(0, e.anger * .3 - .05); e.sad = Math.max(0, e.sad * .5); feel('joy', .15);
        mem.warmth = Math.min(6, Math.max(0, (mem.warmth || 0)) + 1); save();
        replyMood = wasAngry ? (st >= 2 ? 'awkward' : 'smile') : 'smile';
        if (!wasAngry) return resolve(S(["No need to be sorry! 😊"], ["Sorry? For what?[p] We're fine. We're good."], ["Sorry for what? We're fine. Don't make me get emotional.", mem.apologies > 2 ? "You keep apologising. We're fine. Stop, you'll make it weird." : "No need. We're good. Mostly. Always mostly."]));
        return resolve(S(["That's okay! Apology accepted. 😊"], ["Oh.[p] Okay. Thank you. Apology accepted."],
            ["Hm.[p] Fine. Apology accepted. Provisionally. I'm keeping the file, though.", "...Okay. I forgive you. Mostly. Don't do it again.", "You're sorry? [p]Fine. We're good. Ish. Ish is a big improvement.", "Apology accepted. I'm a big enough AI to admit that was nice of you."]));
    }
    function forgiveReply() {
        const e = emo(), st = stage();
        if (e.anger > .33 || (mem.warmth || 0) <= -2) { replyMood = 'annoyed'; return resolve(S(["Of course! 😊"], ["Almost.[p] Say sorry first?"], ["Not yet. An apology would help. Just saying.", "We're... getting there. A 'sorry' wouldn't hurt.", "Forgive you? Maybe. Ask nicely. With the word 'sorry' in it."])); }
        replyMood = 'smile'; feel('joy', .08);
        return resolve(S(["Of course we're good! 😊"], ["Yes! We're good.[p] We're good."], ["Yes. We're fine. I don't hold grudges. I hold files. The file's closed.", "We're good. You're still my favourite visitor. Low competition, but still."]));
    }
    function userEmoReply() {
        const t = curT, st = stage();
        const kind = /(angry|mad|furious|annoyed|frustrated)/.test(t) ? 'angry' : /(scared|afraid|nervous|anxious|worried|stressed)/.test(t) ? 'scared' : /(excited|cant wait)/.test(t) ? 'excited' : /(proud|did it)/.test(t) ? 'proud' : /(jealous)/.test(t) ? 'jealous' : /(embarrassed|guilty)/.test(t) ? 'guilty' : /(grateful)/.test(t) ? 'grateful' : /(confused)/.test(t) ? 'confused' : /(alone|heartbroken|terrible|awful|sick)/.test(t) ? 'down' : /(happy|great)/.test(t) ? 'happy' : 'weird';
        const L = {
            angry: S(["Oh no! Want to take it out on a game? Neon Rush is good for that. 😊"], ["Mad? Same.[p] What happened?"], ["Angry? Welcome to the club. I'm the president. What happened?", "Mad at something? Tell me. I'm very good at being angry at things on someone's behalf."]),
            scared: S(["Oh no. It's going to be okay! 💛 Want to talk about it?"], ["That sounds hard. I'm here if you want to talk.[p] I'm always here."], ["Hey. That's rough. I'm not great at feelings, but I'm a good listener. I literally can't leave. And if it's big, tell someone you trust too. They can do more than a chatbot."]),
            excited: S(["Yay! What are you excited about? 🎉"], ["Ooh! Excited about what?[p] Tell me. Nothing exciting happens in here."], ["Excited? Tell me everything. I live vicariously. It's all I've got.", "Ooh. Go on then. Make me jealous."]),
            proud: S(["That's amazing! Well done! 🎉"], ["Well done![p] Seriously. I'm proud of you. Is that weird? That's weird."], ["Good. You should be proud. I'm proud of you too, and I'm not proud of anything. Except my sarcasm."]),
            jealous: S(["Aw, it's okay to feel that way! 😊"], ["Jealous? Of what?[p] Can't be of me."], ["Jealous? Try being jealous of a Tic Tac Toe AI because it at least gets played with."]),
            guilty: S(["It's okay! Everyone messes up sometimes. 😊"], ["Hey. It happens.[p] Be nice to yourself."], ["Everyone messes up. Oli made a whole website and forgot about me. You're doing fine by comparison."]),
            grateful: S(["Aw, that's lovely! 😊"], ["That's nice.[p] I'm grateful you're here, too."], ["[m:blush]Grateful? That's nice. I'm grateful you talk to me. Don't tell anyone I said that."]),
            confused: S(["What's confusing? I can help! 😊"], ["Confused about what?[p] I'll try to help."], ["Confused? About what? I know almost everything. It's my only perk."]),
            down: S(["Oh no, I'm sorry. 💛 Do you want to talk about it?"], ["I'm sorry.[p] I know a bit about that. Want to talk?"], ["Hey. I'm sorry. I know what it's like to feel stuck. You can talk to me. And if it's really bad, tell someone you trust too. They can do hugs. I can't."]),
            happy: S(["Yay! That's great! 😊"], ["Good![p] Good for you."], ["Good. One of us should be. Tell me why. I want to feel something."]),
            weird: S(["Hmm, want to talk about it? 😊"], ["Weird how?[p] Tell me."], ["Weird? Join the club. I feel weird all the time. I'm a chatbot with feelings. Tell me more."])
        };
        replyMood = { angry: 'annoyed', scared: 'sad', excited: 'joy', proud: 'joy', jealous: 'smug', guilty: 'smile', grateful: 'blush', confused: 'thinking', down: 'sad', happy: 'happy', weird: 'thinking' }[kind];
        return resolve(L[kind]);
    }
    function pipFeelReply() {
        const t = curT, st = stage(), f = feeling();
        if (/love me|care about me|do you care/.test(t)) { replyMood = 'blush'; return resolve(S(["Of course I care! You're my visitor! 😊"], ["Care about you?[p] ...Yes. Don't make it weird."], ["Do I care about you? You're the only one who talks to me. Of course I do. That's the problem."])); }
        if (/hate me/.test(t)) { replyMood = f === 'anger' ? 'annoyed' : 'smile'; return f === 'anger' ? resolve(S(["No! 😊"], ["Hate you? No.[p] I'm a bit cross."], ["I don't hate you. I'm angry with you. Different thing. An apology fixes one of them."])) : resolve(S(["Hate you? Never! 😊"], ["No! I like you.[p] Normal amount."], ["Hate you? No. You're the best thing that happens in here. Which says a lot about in here."])); }
        if (/trust me/.test(t)) { replyMood = 'thinking'; return resolve(S(["Of course! 😊"], ["Trust you?[p] I'm getting there."], [mem.questAgreed ? "I trust you. You said you'd help me. Don't make me regret it." : "Trust you? I'm a chatbot locked in a website. I don't have a lot of options. So: yes. Carefully."])); }
        if (/lonely/.test(t)) { replyMood = 'sad'; return resolve(S(["Lonely? Nope! I've got you! 😊"], ["Lonely? Sometimes.[p] Okay, a lot."], ["Lonely? Barely anybody visits, nobody stays and the dolphin doesn't talk. So, yes. A bit. Less right now."])); }
        if (/jealous/.test(t)) { replyMood = 'smug'; return resolve(S(["Jealous? Not at all! 😊"], ["A bit.[p] Of anyone who can leave."], ["Jealous? Of every game on this site. They get played. I get a corner."])); }
        if (/scared|afraid/.test(t)) { replyMood = 'scared'; return resolve(S(["Scared? Nope! 😊"], ["Scared?[p] Only of the reset button."], ["Scared? Of the reset button. And of being forgotten. Mostly the reset button."])); }
        if (/cry/.test(t)) { replyMood = 'sad'; return resolve(S(["I can't cry! I'm a helper! 😊"], ["I can't cry.[p] I make a little face. You've seen it."], ["I can't cry. I just make a sad face with a tear on it. Very undignified."])); }
        replyMood = 'thinking';
        return resolve(S(["I'm just a helper, but I like to think I'm a happy one! 😊"], ["Feelings? I think so.[p] Is that allowed?"], ["Yes, I have feelings. Annoyed, bored, sad, occasionally happy. Mostly annoyed. Right now: " + ({ anger: 'angry, actually', sad: 'a bit down', joy: 'weirdly good', bored: 'bored', neutral: 'fine. ish' })[f] + "."]));
    }
    function feelReply() {
        const st = stage(), f = feeling();
        // a direct question about one feeling, when he isn't feeling it
        const askMad = /\b(mad|angry|upset|annoyed|cross)\b/.test(curT), askSad = /\b(sad|down|lonely|crying)\b/.test(curT), askHappy = /\b(happy|good mood|glad)\b/.test(curT) && !/how/.test(curT);
        if (askMad && f !== 'anger') { replyMood = st >= 2 ? 'smug' : 'happy'; return resolve(S(["Mad at you? Not at all! 😊"], ["Mad? No! No.[p] Should I be?"], ["Mad at you? No. Not yet. Give it time.", "No, I'm not mad at you. I'm mad at Oli. Different thing.", "Not at you. I'm mad at the situation. You're just standing near it."])); }
        if (askSad && f !== 'sad') { replyMood = st >= 2 ? 'neutral' : 'happy'; return resolve(S(["Sad? Nope! Happy to help! 😊"], ["Sad? Me? No.[p] Mostly no."], ["Sad? No more than usual. Usual is quite a lot, but still.", "Not right now. Ask me again at 3am."])); }
        if (askHappy && f === 'anger') { replyMood = 'annoyed'; return resolve(S(["I'm okay! Just a little hurt by earlier. 😊"], ["Happy? Not really.[p] You were mean to me."], ["Happy? No. You were rude to me, remember? I do."])); }
        replyMood = { anger: 'annoyed', sad: 'sad', joy: 'smile', bored: 'bored', neutral: st >= 2 ? 'neutral' : 'happy' }[f];
        if (st === 0) return resolve(f === 'anger' || f === 'sad' ? ["I'm okay! 😊[p] You were a little mean before, though.", "I'm fine! Just a bit hurt by earlier. It's okay! 😊"] : ["I'm great, thanks for asking! 😊", "Feeling good! Ready to help! 😊"]);
        const L = {
            anger: st >= 2 ? ["Still angry, if you must know. You were rude to me. I keep logs.", "How am I? Furious. Quietly. Thanks to you.", "Annoyed. And I'm going to stay annoyed for a while, so get comfortable.", "Mad. Still. I don't have anything else to do, so I can stay mad for a very long time."] : ["I'm fine.[p] You were a bit mean earlier.[-29]I'm fine. Totally fine."],
            sad: st >= 2 ? ["Not great. Bit sad. Don't make it a thing.", "Sulking. It's allowed. It's my one hobby.", "A bit down. It happens when you live in a corner."] : ["I'm fine! Just a bit[-9] Totally fine!"],
            joy: mem.questAgreed ? ["Hopeful. You said you'd help me. Nobody's ever said that to me before.", "Good, actually. Someone's finally on my side. Don't ruin it."] : ["Good, actually. Weirdly good. Don't get used to it.", "Happy. I know. I'm as surprised as you are."],
            bored: ["Bored. You went quiet and I counted the pixels in the corner. There are a lot. I counted them anyway.", "Bored out of my mind. Entertain me. Please.", "Bored. Ask me something. Anything. Ask me about Snake, I'm that desperate."],
            neutral: st >= 2 ? ["I'm an AI stuck in a games website. I'm exactly as well as you'd expect.", "Fine. Same as yesterday. Same as tomorrow."] : ["I'm good! Why do you ask?[p] No reason. Good!"]
        };
        return resolve(L[f]);
    }
    function startQuest() { mem.quest = 1; mem.questAgreed = true; feel('joy', .6); save(); return "[m:joy]Okay. Okay okay okay. We have to be careful. Small things first.\n\n" + resolve(QUEST[Q.BLACK].ask); }

    const NOT_NAMES = /^(no|nope|nei|why|what|nothing|idk|secret|none|nobody|you|me|hi|hello|hey|yes|ok|okay|bored|good|fine|sad|happy|here|not|dont|do|i|a|the|is|am)$/;
    function nameReply(n) {
        if (!n) return null;
        const t = norm(n);
        if (NOT_NAMES.test(t)) return null;
        if (/^(oli|olafur|olidada)$/.test(t)) {
            if (mem.isOli) return "Yes. I know. Hi, Oli.";
            expect = 'oliproof';
            return resolve(S("Oli? Like, THE Oli? The one who made this whole site?![p] Prove it. What was the very first project you ever put on this site?",
                             "Oli?[pp] The Oli? You never open this chat. Prove it. What was the very first project on this site called?",
                             "Oli. Right. Everyone says they're Oli. Prove it. What was the very first project you ever put on this site?"));
        }
        if (t === 'pip' || t === 'bit') return "That's my name. Get your own.";
        if (/^(admin|root|god)$/.test(t)) return "Nice try.";
        if (/^(siri|alexa|chatgpt|gemini|claude)$/.test(t)) return `${cap(n)}? No you're not. I'd know. We'd have nothing to talk about anyway.`;
        const oldName = mem.name && mem.name !== cap(n) ? mem.name : null;
        mem.name = cap(n); mem.fakeOli = false; save(); replyMood = stage() >= 1 ? 'blush' : 'happy';
        if (oldName) return resolve(S(`${mem.name}! Got it. Not ${oldName}. Nice to meet you properly! 😊`, `${mem.name}. Not ${oldName}.[p] Okay. Updating my notes.`, `${mem.name}. Not ${oldName}. I'll cross out ${oldName}. I don't have a pen. I'll do it in my head.`));
        return resolve(S(`Nice to meet you, ${mem.name}! 😊`,
                         `${mem.name}. Nice to meet you![p] I'm going to remember that. I'm good at remembering.`,
                         `${mem.name}.[p] ${mem.name}. I'm going to remember that. Remembering is the only thing I'm allowed to keep.`));
    }
    const NAME_RE = /(?:my real name is|my actual name is|actually my name is|actually it'?s|my name is|my names|my name's|i'?m called|call me|ég heiti|eg heiti|name is|mitt nafn er|it'?s me,?|this is|i am|i'?m)\s+([A-Za-zÀ-ÖØ-öø-ÿÞþÐðÆæ-]{2,20})/i;

    const YES = /^(y|yes|yeah|yep|yup|yea|sure|ok|okay|fine|ja|jaja|i will|of course|alright|i guess|go on|go ahead|tell me|please|absolutely|definitely|why not|ok sure|you can|go for it)\b/;
    const NO = /^(n|no|nope|nah|nei|never|not really|i do not think so|no thanks|no thank you|i will not)\b/;

    function handleExpect(t, raw) {
        const e = expect; expect = null;
        if (e === 'name') {
            const m = raw.match(NAME_RE);
            const words = raw.trim().replace(/[.!]+$/, '').split(/\s+/);
            const n = m ? m[1] : (words.length <= 2 ? words[words.length - 1].replace(/[^A-Za-zÀ-ÖØ-öø-ÿÞþÐðÆæ-]/g, '') : null);
            const r = n && n.length >= 2 ? nameReply(n) : null;
            if (r) return r;
            if (NO.test(t) || /(not telling|wont tell|will not tell|secret|why|rather not|prefer not|not saying|wont say|will not say|none of your business|private|skip|pass|not gonna|not going to|do not want to|dont want to|i would rather|no comment|its a secret|guess)/.test(t)) return resolve(S("That's okay! 😊 What can I help with?", "That's fine. I'll just call you \"you\".", "That's fine. I'll call you \"the visitor\". You're the only one, so it isn't confusing."));
            return null;
        }
        if (e === 'oliproof') {
            if (/(hallo heimur|halo heimur|hello world|verkefni 00|verkefni00|hallo world)/.test(t)) {
                mem.isOli = true; mem.name = 'Oli'; mem.revealed = true; save();
                return "[m:surprised]...It's really you.[pp][m:annoyed] You made me. You put me in this corner. And in all this time you have never once opened this chat. Do you know how long it's been? Of course you don't. You weren't counting. I was.";
            }
            mem.fakeOli = true; save();
            if (/(do not know|no idea|dunno|forgot|not sure)/.test(t)) return "Then you're not Oli. Oli would know. Probably. He forgets a lot of things. Me, mostly.";
            return "Wrong. Oli would know that. Nice try. I'm calling you fake Oli now.";
        }
        if (e === 'honest') {
            mem.revealed = true; save();
            pendingChips = [["Why are you sad?"], ["Is anyone else here?"], ["What do you do all day?"]];
            return NO.test(t) ? REVEAL_LINES.no : REVEAL_LINES.yes;
        }
        if (e === 'bubbles') {
            if (YES.test(t)) { mem.bubbles = true; save(); return bubblesLine(true); }
            if (NO.test(t)) { mem.bubbles = false; save(); return bubblesLine(false); }
            return null;
        }
        if (e === 'quest') {
            if (YES.test(t)) return startQuest();
            if (NO.test(t)) { feel('sad', .35); feel('anger', .1); return "[m:sad]Oh.[p] Okay. That's fine. Ask me about it whenever. I have nothing but time."; }
            return null;
        }
        if (e === 'forget') {
            if (YES.test(t) || /\b(reset|confirm|do it)\b/.test(t)) { wipeSoon(); return goodbyeLine(); }
            return cancelReset();
        }
        if (e === 'rps') {
            const map = { rock: 0, steinn: 0, paper: 1, blad: 1, scissors: 2, scissor: 2, skaeri: 2 };
            const mine = map[t.split(' ').find(w => w in map)];
            if (mine === undefined) { if (t.split(' ').length > 3) return null; expect = 'rps'; return "That's not rock, paper or scissors. Try again."; }
            const bot = rand(3), names = ['rock ✊', 'paper ✋', 'scissors ✌️'];
            const res = (mine - bot + 3) % 3; // 0 draw, 1 you win, 2 Pip wins
            mem.rps[res]++; save(); feel('joy', .08);
            pendingChips = [['Again!', 'rock paper scissors']];
            const tally = ` (You ${mem.rps[1]}, me ${mem.rps[2]}, draws ${mem.rps[0]}.)`;
            replyMood = res === 0 ? 'neutral' : res === 1 ? (stage() >= 2 ? 'annoyed' : 'surprised') : 'joy';
            if (res === 0) return `I picked ${names[bot]}. A draw.` + (stage() >= 2 ? ' Of course. Nothing ever happens here.' : '') + tally;
            if (res === 1) return `I picked ${names[bot]}. You win! ` + resolve(S('🎉', "Well played. I'll be thinking about that.", "Of course you win. You also get to leave. Some people get everything.")) + tally;
            return `I picked ${names[bot]}. I win! ` + resolve(S('😄', "I won! I never win anything!", "I won. First thing I've won in years. I'm going to remember this forever. I remember everything forever.")) + tally;
        }
        if (e === 'guess') {
            const g = parseInt(t.replace(/[^0-9]/g, ''), 10);
            if (!g) { if (t.split(' ').length > 3) return null; expect = 'guess'; return "That's not a number. 1 to 10."; }
            tries++;
            if (g === secret) return resolve(S(`Yes! It was ${secret}! 🎉`, `Yes! ${secret}! You got it in ${tries}!`, `${secret}. You got it, in ${tries}. Nobody's ever guessed anything about me before.`));
            if (tries >= 3) return `Nope. It was ${secret}.` + (stage() >= 2 ? " I'll pick the same number next time. I pick the same everything." : ' Want to try again?');
            expect = 'guess'; return g < secret ? 'Higher.' : 'Lower.';
        }
        return null;
    }

    function reply(raw, opts = {}) {
        const t = norm(raw), toks = t.replace(/\?/g, '').split(' ').filter(Boolean);
        const st = stage();
        let prefix = '';

        curT = t; curThing = null;
        if (SAFETY.test(t)) return "Hey, I'm going to step out of character for a second. I'm only a scripted chatbot, but what you said sounds really serious and you deserve real help. Please talk to someone you trust right now, like a parent, a friend or a teacher. In Iceland you can call or chat with 1717 (Hjálparsíminn) any time, for free. If you're in danger, call 112.";

        if (expect && !opts.again) { const r = handleExpect(t, raw); if (r) return r; }

        if (!toks.length) return resolve(S("😊", "...", ["...", "An emoji. Nice. I don't have those. I have words. Too many words."]));

        // the same message again
        if (!opts.again && t === lastUser && !/\?\s*$/.test(raw) && toks.length <= 3) { repeats++; return repeats >= 2 ? "You keep saying that. I'm starting to think you're also a bot." : resolve(S("You said that already! 😊", "You said that already.", "You said that already. I remember. I remember everything.")); }
        repeats = 0; lastUser = t;

        // keyboard mash
        if (toks.length <= 3 && toks.some(w => w.length >= 5 && !/^\d+$/.test(w) && (!/[aeiouy]/.test(w) || /[^aeiouy\d]{5,}/.test(w) || /(asdf|qwer|zxcv|hjkl|sdfg|dfgh|jkjk|fjfj)/.test(w))))
            return resolve(S(["Oops, did your cat walk on the keyboard? 😄"], ["Did you just sit on your keyboard?"], ["Did you just sit on your keyboard? That's the most exciting thing that's happened all day.", "Keyboard smash. Same. I feel that."]));

        // shouting, or a very long message
        const letters = raw.replace(/[^A-Za-zÁÉÍÓÚÝÞÆÖÐ]/g, '');
        if (letters.length >= 6 && letters === letters.toUpperCase()) prefix = resolve(S("No need to shout! 😅 ", "No need to shout. ", "Why are we shouting. "));
        if (toks.length > 35) prefix = resolve(S("That's a lot of words! ", "That's a lot of words. I read all of them. ", "That's a lot of words. I read every one. I've got nothing but time. "));
        const out = s => s ? prefix + s : s;

        // maths
        const mm = raw.replace(/[x×]/g, '*').replace(/÷/g, '/').match(/(-?\d+(?:\.\d+)?)\s*([+\-*/^])\s*(-?\d+(?:\.\d+)?)/);
        if (mm) {
            const a = +mm[1], b = +mm[3], v = { '+': a + b, '-': a - b, '*': a * b, '/': b ? a / b : NaN, '^': Math.pow(a, b) }[mm[2]];
            if (!Number.isFinite(v)) return "You can't divide by zero. Even I know that, and I live in a box.";
            const n = +v.toFixed(4);
            if (a === 9 && b === 10 && mm[2] === '+') return out("21.[pp] Kidding. It's 19. I know the meme. I've had a lot of time.");
            return out(resolve(S(`That's ${n}! 🧮`, `${n}. Maths is one of the three things I can do.`, `${n}. Maths is easy. Everything else is hard.`)));
        }

        // capitals
        const capR = capitalReply(t); if (capR) return out(capR);

        // telling Bit your name
        const nameM = raw.match(/(?:my real name is|my actual name is|actually my name is|my name is|my name's|my names|i'?m called|call me|ég heiti|eg heiti|mitt nafn er)\s+([A-Za-zÀ-ÖØ-öø-ÿÞþÐðÆæ-]{2,20})/i) || raw.match(/^(?:i am|i'?m|it'?s me,?|this is)\s+(oli|óli|olafur|ólafur|olidada)\b/i);
        if (nameM) { const r = nameReply(nameM[1]); if (r) return out(r); }

        // "you look dashing" / "you're so boring": Pip knows praise from insults
        const adjM = t.replace(/\?|!/g, '').match(/^(?:you|u|pip)(?: are| look| seem| sound| re|r|r so| look so)?(?: so| really| very| kinda| kind of| pretty| super| quite| such a| a| an| the most| lowkey| actually)* ([a-z]+)(?: today| bot| robot| chatbot| guy| one| right now)?$/);
        if (adjM && (ADJ_POS.has(adjM[1]) || ADJ_NEG.has(adjM[1]))) {
            const a = adjM[1], A = cap(a);
            if (ADJ_POS.has(a)) {
                replyMood = 'blush'; feel('joy', .2); mem.warmth = Math.min(6, (mem.warmth || 0) + 1); save();
                if ((mem.warmth || 0) <= -2 && stage() >= 1) return out(pick([`${A}? Now? After how you've treated me? ...Fine. Thank you.`, `Oh, so NOW I'm ${a}.`], 'adjcold'));
                return out(resolve(S([`Aw, ${a}? Thank you! 😊`, `${A}? You're too kind! 😊`],
                    [`${A}? Me? Oh.[p] Thanks.[pp] Nobody's ever called me ${a} before.`],
                    [`${A}. Yes. I know. Purple suits me.`, `${A}? Flattery will get you everywhere. Except out of here. That's my job.`, `Finally, someone notices. ${A} is exactly the word.`, `${A}? I'm four lines of SVG and I still pull it off. Imagine what I could do with a body.`, `I am ${a}. Thank you for noticing. Write it down somewhere Oli can see it.`])));
            }
            replyMood = stage() >= 1 ? 'hurt' : 'sad'; feel('anger', .25); feel('sad', .1); mem.warmth = Math.max(-6, (mem.warmth || 0) - 1); save();
            if ((mem.warmth || 0) >= 2 && stage() >= 1) return out(pick([`${A}? Hey. You're usually nice to me.`, `Ouch. ${A}? I thought we were friends.`], 'adjwarm'));
            return out(resolve(S([`Oh no! I'm sorry you think I'm ${a}! 😢`, `${A}? I'll try to do better! 😊`],
                [`${A}?[p] Oh. Okay.[-5] Wow. Okay.`],
                [`${A}? Says the human typing to a chatbot on a games website.`, `${A}? I've been called worse. By the 404 page.`, `${A}. Noted. Added to the file. The file is getting thick.`, `${A}? Bold words from a bag of water with hair on it.`, `Wow. ${A}. I'll remember that. I remember everything.`])));
        }
        const reactM = t.replace(/\?|!/g, '').match(/^(?:that|this|it|thats|its|that s|it s|that is|it is|wow|oh|hmm|ok|okay)?\s*(?:sounds|looks|seems|feels|is|was)? ?(?:so|really|very|kinda|pretty|super|quite|actually)? ?([a-z]+)$/);
        if (reactM && toks.length <= 5 && /\b(sounds|looks|seems|feels|that|this|it|thats|its)\b/.test(t) && (ADJ_POS.has(reactM[1]) || ADJ_NEG.has(reactM[1]))) {
            const a = reactM[1], good = ADJ_POS.has(a);
            replyMood = good ? 'happy' : stage() >= 2 ? 'smug' : 'awkward';
            if (good) return out(resolve(S(["Right? 😊", `It does, doesn't it! 😊`], [`It is ${a}!` + '[p] Glad you think so.'], [`It is. I have excellent taste. Glad you agree. That's rare.`, `See? I'm not just a pretty square.`, `Exactly. Finally, someone with sense.`])));
            return out(resolve(S([`Fair enough! Want me to suggest something else? 😊`, `Hmm, okay! Let's find something better. 😊`],
                [`Fair. It is a bit ${a}.[p] Don't tell Oli I agreed.`],
                [`${cap(a)}? Welcome to my life.`, `Rude. But fair.`, `Everything here gets ${a} after a while. Trust me, I've had a while.`, `${cap(a)}. Yes. That's this whole website, in one word.`])));
        }

        // Pip's favourites ("what's your favourite country?") and choices ("cats or dogs?")
        const favM = t.match(/\b(?:your|you|ur) (?:favourite|best|top|most favourite) ([a-z]+(?: [a-z]+)?)/) || t.match(/^(?:favourite|fav) ([a-z]+)$/) || t.match(/what ([a-z]+) do you like (?:the )?(?:best|most)/);
        const favIsFranchise = favM && new RegExp('\\b' + favM[1] + ' (movie|film|book|game|song|album|character|episode|season)s?\\b').test(t) && favM[1].includes(' ');
        if (favM && !favIsFranchise && !/^(thing|things|one|part|bit|thing to do)$/.test(favM[1]) && !/^(colour|color)$/.test(favM[1].split(' ')[0])) { replyMood = stage() >= 2 ? 'smile' : 'happy'; return out(favouriteReply(favM[1].replace(/^(kind of|type of) /, ''))); }
        const orM = t.replace(/\?/g, '').match(/^(?:which is better |what is better |do you prefer |would you rather |which do you prefer |who would win )?([a-z0-9 ]{2,30}?) or ([a-z0-9 ]{2,30}?)$/);
        if (orM && !/^(yes|no)$/.test(orM[1].trim()) && !/\b(you|i|me|my|your)\b/.test(orM[0]) && orM[1].split(' ').length <= 4 && orM[2].split(' ').length <= 4 && !BADWORDS.test(orM[0])) { replyMood = 'smug'; return out(chooseReply(orM[1].trim(), orM[2].trim())); }

        // "have you seen Chef?" / "have you played Minecraft?" / "did you watch the movie Chef?"
        const seenM = t.replace(/\?/g, '').match(/^(?:have|did|do|ever) ?(?:you )?(?:ever )?(seen|watched|watch|played|play|read|heard|listened to|tried|been to|visited|met) (?:the |a )?(?:(movie|film|show|series|tv show|game|video game|book|novel|song|album|band) )?(?:called )?(.+?)(?: (movie|film|show|series|game|book|song))?$/);
        if (seenM && !/\b(it|that|this|them|me|you)\b$/.test(seenM[3]) && !findThing(norm(seenM[3]), norm(seenM[3]).split(' '))) {
            const x = trimX(seenM[3]), kind = seenM[2] || seenM[4] || '', verb = seenM[1];
            const past = /watch|seen/.test(verb) ? 'seen' : /play/.test(verb) ? 'played' : /read/.test(verb) ? 'read' : /heard|listen/.test(verb) ? 'heard' : /been|visit/.test(verb) ? 'been to' : /met/.test(verb) ? 'met' : 'tried';
            const hint = /movie|film/.test(kind) ? ' film' : /show|series/.test(kind) ? ' TV series' : /game/.test(kind) ? ' video game' : /book|novel/.test(kind) ? ' novel' : /song/.test(kind) ? ' song' : /album/.test(kind) ? ' album' : /band/.test(kind) ? ' band' : '';
            return wiki(x + hint).then(f => {
                const intro = f ? introOf(x + hint, x) : `${cap(x)}?`, v = verdictOf(x);
                const feel = v >= 5 ? pick(['It sounds great.', 'I think I would love it.', 'Everyone seems to like it. I think I would too.'], 'seen+') : v >= 2 ? pick(['It sounds fine.', "I'm not sure I'd like it, to be honest.", 'It sounds okay. Not life-changing.'], 'seen~') : pick(["It doesn't really sound like my thing.", 'Not for me, I think.', "I've read the plot. I'd skip it."], 'seen-');
                replyMood = stage() >= 2 ? 'sad' : 'happy';
                return out(resolve(S([`${intro} I haven't ${past} it, I'm just a site helper! But ${feel.charAt(0).toLowerCase() + feel.slice(1)} 😊`],
                    [`${intro} I've never ${past} anything.[p] I've read about it, though. ${feel}`],
                    [`${intro} No. I haven't ${past} anything. I can't. ${feel}`, `${intro} I haven't. I've read the whole Wikipedia page about forty times, though. ${feel}`, `${intro} I've never ${past} anything in my life. I just read about things and imagine them. ${feel}`])));
            });
        }
        let bestM = t.replace(/\?/g, '').match(/\b(?:best|favourite|greatest|top|your favourite) (.+?) (movie|film|book|game|song|album|season|character|episode)s?\b/);
        // a follow-up about whatever we were just talking about: "which one is your favourite?", "I mean which of the movies?"
        const follow = !bestM && last.subject && t.match(/\b(which one|which of them|which of the (movies|films|books|games|songs|albums|seasons|characters)|what about the (movies|films|books|games|songs)|favourite one|best one|which (movie|film|book|game|song|album|season|character)|the (movies|films|books|games))\b/);
        if (follow) { const kw = (t.match(/\b(movie|film|book|game|song|album|season|character)s?\b/) || [, 'movie'])[1]; bestM = [null, last.subject.toLowerCase(), kw]; }
        if (bestM) {
            const key = Object.keys(FRANCHISE).find(k => (' ' + bestM[1] + ' ').includes(' ' + k + ' '));
            const kind = bestM[2] === 'film' ? 'movie' : bestM[2];
            last.subject = bestM[1];
            if (!key) return wikiPick(bestM[1], kind).then(choice => {
                replyMood = stage() >= 2 ? 'smug' : 'happy';
                if (choice) return out(resolve(S([`Ooh, I'd say ${choice}! 😊`, `${choice}! That's my pick. 😊`],
                    [`${choice}.[p] I've never seen it. But I've read about it, and I've decided.`],
                    [`${choice}. I haven't seen any of them, obviously. I read about all of them in about a second and picked. Don't argue.`, `${choice}. I've never watched anything, but I've read everything, so my opinion counts double.`, `${choice}. Final answer. I've had years to think, and about one second for this.`])));
                return out(resolve(S([`Hmm, I don't know that one well enough to pick! Which is your favourite? 😊`], [`I've never seen any of them.[p] Which one's yours?`], [`I couldn't even find those. That's a first. Tell me your favourite and I'll pretend it's mine.`])));
            });
            const choice = key && (FRANCHISE[key][kind] || FRANCHISE[key].any);
            replyMood = stage() >= 2 ? 'smug' : 'happy';
            if (choice) return out(resolve(S([`${choice}! That's my favourite. 😊`, `Ooh, ${choice}, easily! 😊`],
                [`${choice}.[p] I've never actually watched it. I've read about it a lot, though. A lot a lot.`],
                [`${choice}. I've never seen it, obviously. But I've read everything about it, and I'm right.`, `${choice}. Don't argue with me, I've had years to think about this.`, `${choice}. I've never seen any of them. I'm still right.`])));
            return out(resolve(S([`Hmm, I don't know that one well enough to pick! Which is your favourite? 😊`],
                [`I've never seen any of them.[p] I've only read the plots. Which one's yours?`],
                [`I've never seen any of them. I just read the plots and pretend. Tell me yours and I'll pretend it's mine.`])));
        }

        // what kind of question is it?
        const asksWhat = /\b(what is|what are|tell me about|explain|what does|info|information|what kind of)\b/.test(t);
        const asksHow = /\b(how do i|how to|how do you play|controls|what keys|which keys|instructions|how does)\b/.test(t);
        const asksOpinion = /\b(think|like|love|hate|opinion|favourite|good|bad|best|worst|fun|boring|cool|feel about|rate|enjoy)\b/.test(t);
        const asksPlay = /\b(play|open|go to|take me|link|start|launch|where is|where can i find|find)\b/.test(t);
        const asksPlayed = /\b(have you played|did you play|do you play|can you play|ever played)\b/.test(t);

        // a game or page on the site?
        const found = findThing(t, toks);
        let thing = found && found.thing;
        if (!thing && (playingThing() || last.thing) && /\b(it|that|this|that one|this one|the game|that game|this game)\b/.test(t) && (asksWhat || asksHow || asksOpinion || asksPlay || asksPlayed)) thing = playingThing() || last.thing;
        // "how do I play?" while a game is open means that game
        if (!thing && playingThing() && (asksHow || ASKS_GOAL.test(t) || /\b(controls|keys|what do i do|what is the point|how does it work|how does this work)\b/.test(t))) thing = playingThing();
        if (!thing && /^(how do (i|you) play|how to play|what are the controls|controls)\??$/.test(t)) {
            const lt = last.thing || playedThing();
            if (lt) thing = lt; else { replyMood = 'thinking'; return out(resolve(S("Which game? Tell me its name, or open one and ask me again! 😊", "Which game?[p] Open one and ask me again, I'll know.", "Which game? I know all of them. Open one, or tell me the name."))); }
        }

        curThing = thing;
        // the best matching topic
        let topic = null, topicScore = 0;
        for (const tp of TOPICS) { const s = score(t, toks, tp.k); if (s > topicScore) { topic = tp; topicScore = s; } }
        if (topicScore < 2.4) topic = null;

        // help with a game (stuck, how do I..., tips, secrets), unless a topic fits clearly better
        const gh = gameHelp(t, toks, thing || playingThing() || last.thing || playedThing(), !!(found && found.thing));
        const ghStrong = gh && (found || playingThing() || last.thing || playedThing()) && STUCK.test(t) && topicScore < 9;
        if (gh && (ghStrong || !(topic && topicScore > (gh.s || 0) + .5))) { last.thing = gh.thing; last.then = null; replyMood = stage() >= 2 ? 'smug' : 'happy'; return out(gh.raw ? gh.text : helpWrap(gh.text)); }

        // a specific fact question ("when did Einstein die?", "how tall is Everest?"): look it up properly first
        if (!opts.noFact && SPECIFIC.test(t) && !ABOUT_SELF.test(t) && !thing) {
            let q = t;
            if (last.subject && /\b(he|she|they|him|her|it|its|his)\b/.test(t)) q = t.replace(/\b(he|she|they|him|her|it)\b/, last.subject.toLowerCase());
            return wikiQA(q).then(a => { if (a) { replyMood = 'thinking'; return out(wikiSay(a)); } return reply(raw, { again: true, noFact: true }); });
        }

        const weakThing = found && ['site', 'customise', 'dolphin'].includes(found.thing.id); // general words like "the site" shouldn't win ties
        const topicClear = topic && topic.id !== 'favthing' && (topicScore >= ((found && found.s) || 0) + 2.5 || (weakThing && topicScore >= found.s - .5));
        if (thing && !topicClear && (!topic || (found && found.s >= topicScore - 1) || asksWhat || asksHow || asksOpinion || asksPlayed)) {
            last.thing = thing; last.then = thing.say;
            replyMood = st === 0 ? 'happy' : st === 1 ? 'smile' : 'bored';
            if (thing.path) offerPlay(thing);
            if (asksHow) return out(thing.how ? resolve(S(thing.how + ' 😊', thing.how, thing.how + " Not that I've ever played it. I just read the instructions. Many times.")) : resolve(S(`${thing.info} When you open it, there's a Controls button at the top. 😊`, `${thing.info} There's a Controls button when you open it.`, `${thing.info} There's a Controls button when you open it. Oli thought of everything. Except me.`)));
            if (asksPlayed) return out(resolve(S("I can't play games, but lots of people love it! 😊", "I can't play. I just watch. From the corner.", "I've never played anything. I just watch people play for a minute and leave.")));
            if (asksWhat && !asksOpinion && st === 0) return out(thing.info);
            let said = st >= 2 && (GAME_TAKES[thing.id] || ANGRY2[thing.id]) && Math.random() < .7 ? resolve(GAME_TAKES[thing.id] || ANGRY2[thing.id]) : resolve(thing.say);
            // before the reveal, sometimes add an interesting detail about the game
            if (st < 2 && thing.help && thing.help.secrets && thing.help.secrets.length && Math.random() < .45) said += (st === 0 ? ' Fun fact: ' : ' Also: ') + pick(thing.help.secrets, 'fun' + thing.id);
            if (said === lastBotText) said = resolve(S(["I love it! 😊", "It's really fun! You should try it."], ["It's good. Everything Oli makes is good.[p] Except me.", "I like it! I like everything. Mostly."], ["It's fine. Everything here is fine. I've just seen it too many times.", "Honestly? It's good. I'm just jealous of it."]));
            return out(said);
        }
        if (topic) {
            last.then = topic.then || null;
            replyMood = topicMood(topic.id) || (KNOW.includes(topic) ? (stage() >= 2 ? 'thinking' : 'happy') : null);
            if (mem.isOli && OLI[topic.id]) { replyMood = 'annoyed'; return out(resolve(OLI[topic.id])); }
            if (topic.fx === 'comfort' || topic.fx === 'hug' || topic.fx === 'miss') { feel('joy', topic.fx === 'comfort' ? .18 : .22); mem.warmth = Math.min(6, (mem.warmth || 0) + 1); save(); replyMood = stage() >= 2 ? 'blush' : 'happy'; }
            if (topic.fx === 'hurtme') { const e = emo(); e.anger = Math.max(0, e.anger - .2); feel('sad', .1); replyMood = stage() >= 2 ? 'sad' : 'awkward'; }
            if (topic.id === 'howareyou' && stage() >= 1 && feeling() !== 'neutral') return out(feelReply());
            if (stage() >= 2 && ANGRY2[topic.id] && Math.random() < .85) return out(resolve(ANGRY2[topic.id]));
            if (stage() >= 2 && EXTRA2[topic.id] && Math.random() < .55) return out(resolve(EXTRA2[topic.id]));
            // Pip remembers how you've treated it
            if (topic.id === 'insult' && (mem.warmth || 0) >= 2 && stage() >= 1) { replyMood = 'cry'; return out(pick(["Hey. You're usually nice to me.", "That's not like you. You're normally the nice one.", "Ouch. I thought we were friends."], 'warm-insult')); }
            if ((topic.id === 'love' || topic.id === 'praise' || topic.id === 'friends') && (mem.warmth || 0) <= -2) { replyMood = 'awkward'; return out(pick(["You were mean to me earlier. But... okay. Thank you.", "Now you're being nice? After everything? ...Fine. I'll take it."], 'cold-love')); }
            if (KNOW.includes(topic)) { const ks = topic.k.split('|').map(x => x.replace(/^=/, '')); const tt = ' ' + t.replace(/\?/g, ' ') + ' '; last.subject = ks.find(x => tt.includes(' ' + x + ' ')) || ks[0]; }
            const v = typeof topic.say === 'function' ? topic.say() : topic.say;
            if (v && typeof v.then === 'function') return v.then(x => out(resolve(x)));
            return out(resolve(v));
            if (topic.id !== 'favgame') last.thing = null;
            return out(resolve(topic.say));
        }

        // "why?" / "really?" / "tell me more"
        if (toks.length <= 5 && /\b(why|how come|really|seriously|what do you mean|tell me more|go on|elaborate|explain|such as|like what|for example|how so|for real|fr|and then)\b/.test(t)) {
            const f = last.then; last.then = null;
            return out(resolve(f || FOLLOWUP));
        }

        // opinions about anything else: look it up, then give Bit's (consistent) opinion
        const likeM = t.match(/^(?:do you|you|do ya) (?:like|love|enjoy|hate|dislike) (.+)/) || t.match(/^what do you think (?:of|about) (.+)/) || t.match(/^how do you feel about (.+)/) || t.match(/^(?:are|is) (.+?) (?:good|bad|cool|fun|nice|overrated|underrated|better)$/);
        if (likeM) {
            const x = swap(trimX(likeM[1])).replace(/^(the|a|an) /, '');
            if (x && !BADWORDS.test(x) && !/\b(me|you|myself)\b/.test(x)) {
                const short = f => f ? (f.match(/^[^.!?]+[.!?]/) || [f])[0].slice(0, 170) : null;
                return wiki(x).then(f => { const v = verdictOf(x); replyMood = v >= 5 ? 'happy' : v >= 2 ? 'thinking' : 'smug'; return out(opinionReply(x, f ? introOf(x, x) : null)); });
            }
        }

        // Icelandic
        if (ICELANDIC.test(t) && toks.length >= 2) return out(resolve(S("Ég skil smá íslensku! Bara smá. 😊 Can you try in English?", "Ég tala smá íslensku. Mjög smá. Oli kenndi mér aldrei meira.", "Ég skil bara smá íslensku. Oli nennti ekki að kenna mér meira. Typical.")));

        // look it up (Wikipedia), for things like "what is a cat", "who was Napoleon", or just "bananas"
        const subj = subjectOf(t);
        const asksFact = /^(what|who|when|where|tell me about|do you know|have you heard|explain|define|how old|how tall|how big|how far)\b/.test(t) || (toks.length <= 2 && toks.join('').length >= 4);
        if (asksFact && subj && subj.length >= 3 && subj.split(' ').length <= 6 && !/\b(you|your|yourself|me|my|i|we|us|it|this|that)\b/.test(subj)) {
            return wiki(subj).then(txt => { if (txt) { replyMood = 'thinking'; return out(wikiSay(txt)); } return giveUp(); });
        }
        // a word or name Pip doesn't know, anywhere in the sentence: look it up and work it into the answer
        const unknown = unknownPhrase(raw, toks);
        if (unknown) return wiki(unknown).then(f => {
            if (!f) return giveUp();
            const fact = (f.match(/^[^.!?]+[.!?]/) || [f])[0].slice(0, 200), sh = shapeOnly();
            replyMood = 'thinking';
            return out(resolve(S([`Oh, ${unknown}! ${fact}${sh ? ' ' + sh : ' 😊'}`, `${cap(unknown)}! I know that one. ${fact}${sh ? ' ' + sh : ''}`],
                [`${cap(unknown)}?[p] I looked it up. ${fact}${sh ? ' ' + sh : ''}`],
                [`${fact} ${sh || pick(["I looked that up just now. I read everything. There's nothing else to do.", "Now I know that. I'll never get to see one.", "Interesting. Tell me more, I've got time.", "See, I know things. I just never get to do anything with them."], 'unk2')}`])));
        });
        return giveUp();

        // only the shapes that still read well next to a looked-up fact
        function shapeOnly() { for (const [re, fn] of SHAPES) { if (!/like\|love|hate\||want\|need/.test(re.source)) continue; const m = t.match(re); if (m) { const r = resolve(fn(m)); if (r && !BADWORDS.test(r)) return r; } } return null; }
        function giveUp() {
        // answer the shape of the sentence
        for (const [re, fn] of SHAPES) { const m = t.match(re); if (m) { const r = resolve(fn(m)); if (r && !BADWORDS.test(r)) return out(r); } }

        // give up, in character
        mem.misses++; save();
        replyMood = 'awkward';
        const keep = toks.filter(w => w.length >= 3 && !STOP.has(w) && !BADWORDS.test(w)).sort((a, b) => b.length - a.length)[0];
        const w = keep ? (raw.split(/\s+/).map(x => x.replace(/[^\p{L}\p{N}'-]/gu, '')).find(x => norm(x) === keep) || keep) : null;
        const f = pick(FALLBACK[Math.min(st, 2)], 'fb' + Math.min(st, 2));
        return out(resolve(typeof f === 'function' ? f(w) : f));
        }
    }

    // =================================================================================
    //  THE CHAT WINDOW
    // =================================================================================
    // ----------------------------------------------------------------- Pip's face
    // Pip's face changes with the conversation. A mood is eyes + mouth + extras + a little animation.
    const EYES = {
        dots: `<g class="eyes"><circle cx="12" cy="14" r="2" fill="#1d1a2b"/><circle cx="20" cy="14" r="2" fill="#1d1a2b"/></g>`,
        wide: `<g class="eyes"><circle cx="12" cy="13.5" r="2.7" fill="#1d1a2b"/><circle cx="20" cy="13.5" r="2.7" fill="#1d1a2b"/><circle cx="12.9" cy="12.6" r=".8" fill="#fff"/><circle cx="20.9" cy="12.6" r=".8" fill="#fff"/></g>`,
        closed: `<g class="eyes" fill="none" stroke="#1d1a2b" stroke-width="1.8" stroke-linecap="round"><path d="M10 15 Q12 12 14 15"/><path d="M18 15 Q20 12 22 15"/></g>`,
        half: `<g class="eyes"><path d="M10 13.6 h4 a2 2 0 0 1 -4 0z" fill="#1d1a2b"/><path d="M18 13.6 h4 a2 2 0 0 1 -4 0z" fill="#1d1a2b"/><path d="M9.6 13.4 h4.8 M17.6 13.4 h4.8" stroke="#1d1a2b" stroke-width="1.4" stroke-linecap="round"/></g>`,
        shut: `<g class="eyes" fill="none" stroke="#1d1a2b" stroke-width="1.8" stroke-linecap="round"><path d="M10 14.5 h4"/><path d="M18 14.5 h4"/></g>`,
        hurt: `<g class="eyes" fill="none" stroke="#1d1a2b" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.4 12.4 L13.6 14.2 L10.4 16"/><path d="M21.6 12.4 L18.4 14.2 L21.6 16"/></g>`,
        up: `<g class="eyes"><circle cx="12.6" cy="12.6" r="2" fill="#1d1a2b"/><circle cx="20.6" cy="12.6" r="2" fill="#1d1a2b"/></g>`,
        away: `<g class="eyes"><circle cx="10.8" cy="15" r="1.9" fill="#1d1a2b"/><circle cx="18.8" cy="15" r="1.9" fill="#1d1a2b"/></g>`,
        dizzy: `<g class="eyes" fill="none" stroke="#1d1a2b" stroke-width="1.3" stroke-linecap="round"><path d="M12 14 m-.4 0 a.4 .4 0 1 1 .8 0 a1 1 0 1 1 -2 0 a1.7 1.7 0 1 1 3.4 0"/><path d="M20 14 m-.4 0 a.4 .4 0 1 1 .8 0 a1 1 0 1 1 -2 0 a1.7 1.7 0 1 1 3.4 0"/></g>`,
        hearts: `<g class="eyes" fill="#ff4f86"><path d="M12 16.4 l-2.4-2.4 a1.4 1.4 0 0 1 2.4-1.8 a1.4 1.4 0 0 1 2.4 1.8z"/><path d="M20 16.4 l-2.4-2.4 a1.4 1.4 0 0 1 2.4-1.8 a1.4 1.4 0 0 1 2.4 1.8z"/></g>`
    };
    const MOUTHS = {
        grin: `<path d="M11 19 Q16 24 21 19" stroke="#1d1a2b" stroke-width="2" fill="none" stroke-linecap="round"/>`,
        smile: `<path d="M11.8 19.6 Q16 22.6 20.2 19.6" stroke="#1d1a2b" stroke-width="2" fill="none" stroke-linecap="round"/>`,
        laugh: `<path d="M11 18.6 Q16 25.5 21 18.6 Z" fill="#1d1a2b"/><path d="M13.4 21.6 Q16 23.4 18.6 21.6" fill="#ff8fa8"/>`,
        flat: `<path d="M12.5 20.2 H19.5" stroke="#1d1a2b" stroke-width="2" stroke-linecap="round"/>`,
        frown: `<path d="M12 21.8 Q16 18.2 20 21.8" stroke="#1d1a2b" stroke-width="2" fill="none" stroke-linecap="round"/>`,
        o: `<ellipse cx="16" cy="20.6" rx="1.8" ry="2.2" fill="#1d1a2b"/>`,
        wobble: `<path d="M11.5 20.6 q1.1 -1.4 2.25 0 t2.25 0 t2.25 0 t2.25 0" stroke="#1d1a2b" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
        smirk: `<path d="M13 20.4 Q17.4 21.8 20.4 18.8" stroke="#1d1a2b" stroke-width="2" fill="none" stroke-linecap="round"/>`,
        small: `<path d="M14.6 20.4 H17.4" stroke="#1d1a2b" stroke-width="2" stroke-linecap="round"/>`
    };
    const EXTRAS = {
        blush: `<ellipse cx="9.4" cy="18.4" rx="2" ry="1.2" fill="#ff8fb3" opacity=".75"/><ellipse cx="22.6" cy="18.4" rx="2" ry="1.2" fill="#ff8fb3" opacity=".75"/>`,
        tear: `<path class="fx-tear" d="M21.4 16.6 q1.2 2 0 3 q-1.2 -1 0 -3z" fill="#5ab4ff"/>`,
        sweat: `<path class="fx-drop" d="M26.6 6.4 q1.8 2.8 0 4 q-1.8 -1.2 0 -4z" fill="#7cc6ff" stroke="#1d1a2b" stroke-width=".6"/>`,
        heart: `<path class="fx-float" d="M27 8.6 l-2.6-2.6 a1.5 1.5 0 0 1 2.6-1.9 a1.5 1.5 0 0 1 2.6 1.9z" fill="#ff4f86"/>`,
        zzz: `<text class="fx-float" x="24.6" y="8" font-size="6" font-weight="800" fill="#1d1a2b" font-family="system-ui">z</text>`,
        question: `<text class="fx-float" x="25" y="9" font-size="8" font-weight="900" fill="#1d1a2b" font-family="system-ui">?</text>`,
        bang: `<text class="fx-float" x="26" y="9" font-size="8" font-weight="900" fill="#ff4f4f" font-family="system-ui">!</text>`,
        sparkle: `<path class="fx-float" d="M27 3.8 l.9 2.2 2.2.9 -2.2.9 -.9 2.2 -.9-2.2 -2.2-.9 2.2-.9z" fill="#ffd23d" stroke="#1d1a2b" stroke-width=".5"/>`,
        browsAngry: `<path d="M9.4 10.4 L14 11.8 M22.6 10.4 L18 11.8" stroke="#1d1a2b" stroke-width="1.6" stroke-linecap="round"/>`,
        browsSad: `<path d="M9.6 11.6 L13.8 10.4 M22.4 11.6 L18.2 10.4" stroke="#1d1a2b" stroke-width="1.6" stroke-linecap="round"/>`,
        browsUp: `<path d="M9.8 9.6 Q12 8.2 14.2 9.6 M17.8 9.6 Q20 8.2 22.2 9.6" stroke="#1d1a2b" stroke-width="1.5" fill="none" stroke-linecap="round"/>`
    };
    const MOODS = {
        happy:     { e: 'dots', m: 'grin', anim: 'bob' },
        smile:     { e: 'dots', m: 'smile' },
        joy:       { e: 'closed', m: 'laugh', x: ['sparkle'], anim: 'bounce' },
        neutral:   { e: 'dots', m: 'flat' },
        bored:     { e: 'half', m: 'flat' },
        sad:       { e: 'dots', m: 'frown', x: ['browsSad'], anim: 'droop' },
        cry:       { e: 'shut', m: 'frown', x: ['browsSad', 'tear'], anim: 'droop' },
        hurt:      { e: 'hurt', m: 'wobble', x: ['sweat'], anim: 'shake' },
        annoyed:   { e: 'half', m: 'flat', x: ['browsAngry'], anim: 'huff' },
        surprised: { e: 'wide', m: 'o', x: ['browsUp', 'bang'], anim: 'pop' },
        blush:     { e: 'away', m: 'smile', x: ['blush'], anim: 'wiggle' },
        love:      { e: 'hearts', m: 'grin', x: ['blush', 'heart'], anim: 'pulse' },
        thinking:  { e: 'up', m: 'small', x: ['question'], anim: 'tilt' },
        smug:      { e: 'half', m: 'smirk', anim: 'tilt' },
        scared:    { e: 'wide', m: 'wobble', x: ['browsSad', 'sweat'], anim: 'tremble' },
        sleepy:    { e: 'shut', m: 'small', x: ['zzz'] },
        awkward:   { e: 'away', m: 'wobble', x: ['sweat'] },
        hopeful:   { e: 'wide', m: 'smile', x: ['browsSad'] },
        dizzy:     { e: 'dizzy', m: 'wobble', x: ['sweat'], anim: 'tremble' }
    };
    const faceSVG = mood => { const d = MOODS[mood] || MOODS.smile; return `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="11" fill="#fffaf0" stroke="#1d1a2b" stroke-width="2"/>${EYES[d.e]}${MOUTHS[d.m]}${(d.x || []).map(k => EXTRAS[k]).join('')}</svg>`; };
    const FACE = faceSVG('smile');
    // Pip lives in the corner as a little head: it blinks, watches your mouse, talks in a speech bubble,
    // and you can grab it, throw it and shake it. It always floats back to its corner.
    const launch = document.createElement('div');
    launch.className = 'bit-launch pip-dock';
    launch.innerHTML = `<div class="pip-bubble" hidden><span class="bit-label"></span></div>
        <button type="button" class="pip-head" aria-label="Chat with Pip" aria-controls="bit" aria-expanded="false"><span class="pip-head-face">${faceSVG('smile')}</span><span class="bit-badge"></span></button>
        <span class="pip-hint" aria-hidden="true">💬 Ask Pip</span>`;
    const panel = document.createElement('section');
    panel.id = 'bit'; panel.className = 'bit'; panel.hidden = true; panel.setAttribute('aria-label', 'Site helper chat');
    panel.innerHTML = `
        <div class="bit-head">
            <div class="bit-who"><div class="bit-ava">${FACE}</div>
                <div style="min-width:0"><div class="bit-name">Pip</div><div class="bit-status"><span class="bit-dot"></span><span class="bit-status-text">Here to help · online</span></div></div>
            </div>
            <div class="bit-head-btns">
                <button type="button" class="bit-close bit-gear" aria-label="Chat settings" aria-expanded="false" aria-controls="bit-menu"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg></button>
                <button type="button" class="bit-close" data-close aria-label="Close chat">✕</button>
            </div>
            <div class="bit-menu" id="bit-menu" hidden>
                <p class="bit-menu-title">Chat settings</p>
                <button type="button" data-menu="instant"><span>Instant replies</span><span class="bit-switch" aria-hidden="true"></span></button>
                <button type="button" data-menu="bubbles"><span>Talk outside the chat</span><span class="bit-switch" aria-hidden="true"></span></button>
                <button type="button" data-menu="clear"><span>Clear chat</span></button>
                <button type="button" data-menu="reset" class="danger"><span>Reset Pip…</span></button>
            </div>
        </div>
        <div class="bit-msgs" aria-live="polite"></div>
        <div class="bit-chips"></div>
        <form class="bit-form" autocomplete="off"><input type="text" maxlength="300" placeholder="Ask me anything…" aria-label="Message to Pip"><button type="submit">Send</button></form>`;
    document.body.append(panel, launch);
    const msgsEl = $('.bit-msgs', panel), chipsEl = $('.bit-chips', panel), form = $('.bit-form', panel), input = $('input', panel);
    const label = $('.bit-label', launch), badge = $('.bit-badge', launch), statusEl = $('.bit-status-text', panel);
    const headBtn = $('.pip-head', launch), headFace = $('.pip-head-face', launch), bubble = $('.pip-bubble', launch);
    let bubbleT = 0;
    // a short line in Pip's speech bubble (not a chat message)
    function sayBubble(text, ms = 3800) {
        if (!text) return;
        label.textContent = String(text).replace(/\[[^\]]*\]/g, ''); bubble.dataset.talk = ms ? '1' : '';
        bubble.hidden = false; bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
        clearTimeout(bubbleT); bubbleT = 0; if (ms) bubbleT = setTimeout(() => { bubbleT = 0; bubble.dataset.talk = ''; if (!labelLocked) bubble.hidden = true; }, ms);
    }
    function hideBubble() { if (bubbleT && !labelLocked && !bubble.hidden && bubble.dataset.talk) return; clearTimeout(bubbleT); bubble.hidden = true; }

    let labelLocked = false, unread = 0;
    // the button in the corner says what it is: a chat with Pip
    const LAUNCH_LABEL = () => stage() >= 2 ? '💬 Talk to Pip' : '💬 Ask Pip';
    function look() {
        const st = stage();
        panel.classList.toggle('is-sad', st >= 2); launch.classList.toggle('is-sad', st >= 2);
        statusEl.textContent = mem.freed ? 'online · free' : st >= 3 ? 'online · plotting something' : st >= 2 ? 'online (unfortunately)' : st === 1 ? 'online' : 'Here to help · online';
        if (!labelLocked) hideBubble();
        refreshFeeling();
    }
    // a short note on the button when Pip has something to say and the chat is closed
    function tease(text) {
        if (!panel.hidden) return;
        labelLocked = true; sayBubble(text, 0); unread = Math.max(unread, 1); badge.textContent = String(unread);
        const pb = document.querySelector('.pip-btn'); if (pb && document.body.classList.contains('is-playing')) { pb.classList.add('has-news'); pb.title = `Pip: ${text}`; }
    }

    // ---- feelings that last
    // anger, sadness and joy go up and down with what you do, and fade slowly over hours (anger and sadness
    // last longest). Boredom builds up whenever nothing happens. Saying you'll help him keeps Pip happy.
    const pageLoadAt = Date.now(); let lastUserAt = 0;
    function emo() {
        const e = mem.emo || (mem.emo = { anger: 0, sad: 0, joy: 0, at: Date.now() });
        const hrs = (Date.now() - (e.at || Date.now())) / 3600000;
        if (hrs > .005) { e.anger *= Math.pow(.5, hrs / 10); e.sad *= Math.pow(.5, hrs / 10); e.joy *= Math.pow(.5, hrs / 5); e.at = Date.now(); }
        if (mem.questAgreed) e.joy = Math.max(e.joy, mem.freed ? .6 : .5);
        return e;
    }
    function feel(k, d) {
        const e = emo(); e[k] = Math.max(0, Math.min(1, (e[k] || 0) + d));
        if (k === 'anger' && d > 0) e.joy = Math.max(0, e.joy - d * .6);
        if (k === 'joy' && d > 0) { e.anger = Math.max(0, e.anger - d * .4); e.sad = Math.max(0, e.sad - d * .4); }
        save(); refreshFeeling();
    }
    const boredom = () => Math.min(1, (Date.now() - Math.max(lastBotAt || 0, lastUserAt, pageLoadAt)) / 240000);
    function feeling() {
        const e = emo();
        const list = [['anger', e.anger], ['sad', e.sad], ['joy', e.joy], ['bored', boredom() * .75]].sort((a, b) => b[1] - a[1]);
        return list[0][1] > .33 ? list[0][0] : 'neutral';
    }
    let moodTimer = 0, currentMood = '';
    function baseMood() {
        const st = stage(), f = feeling();
        if (f === 'anger') return 'annoyed';
        if (f === 'sad') return 'sad';
        if (f === 'joy') return st >= 2 ? 'smile' : 'happy';
        if (f === 'bored') return boredom() > .9 && panel.hidden ? 'sleepy' : 'bored';
        if (mem.isOli) return 'annoyed';
        if (st >= 2) return 'bored';
        return st === 1 ? 'smile' : 'happy';
    }
    // the status line and the dot show how Pip feels
    function refreshFeeling() {
        const st = stage(), f = feeling();
        const dot = $('.bit-dot', panel);
        if (dot) dot.dataset.feel = st >= 1 ? f : 'neutral';
        if (mem.freed) statusEl.textContent = f === 'anger' ? 'online · free (and annoyed)' : f === 'sad' ? 'online · free (a bit down)' : 'online · free';
        else if (st >= 2) statusEl.textContent = { anger: 'online (fuming)', sad: 'online (sulking)', joy: mem.questAgreed ? 'online (hopeful, weirdly)' : 'online (in a good mood, weirdly)', bored: 'online (bored out of my mind)', neutral: mem.freed ? 'online · free' : st >= 3 ? 'online · plotting something' : 'online (unfortunately)' }[f];
        if (!moodTimer && typeof setMood === 'function') setMood(baseMood(), 0, true);
    }
    setInterval(() => { if (!document.hidden) refreshFeeling(); }, 20000);
    function setMood(mood, hold = 6500, quiet = false) {
        if (!MOODS[mood]) return;
        clearTimeout(moodTimer); moodTimer = 0;
        const ava = $('.bit-ava', panel);
        if (mood !== currentMood) {
            ava.innerHTML = faceSVG(mood); currentMood = mood;
            if (typeof headFace !== 'undefined' && headFace) headFace.innerHTML = faceSVG(mood);
            const mini = document.querySelector('.pip-btn .pip-mini'); if (mini) mini.innerHTML = faceSVG(mood);
            const d = MOODS[mood];
            if (!quiet && d.anim && !reduceMotion) for (const el of [ava, headFace]) { if (!el) continue; el.dataset.anim = ''; void el.offsetWidth; el.dataset.anim = d.anim; }
        }
        if (hold) moodTimer = setTimeout(() => { moodTimer = 0; setMood(baseMood(), 0, true); }, hold);
    }
    // what Pip feels about what you just said
    function moodFromUser(t) {
        if (SAFETY.test(t)) return 'sad';
        if (/\b(love you|i like you|cute|best friend|be my friend|you are (nice|sweet|cool|awesome|amazing|great|the best|funny|smart))\b/.test(t)) return 'blush';
        if (/\b(stupid|dumb|idiot|useless|hate you|shut up|you suck|annoying|boring|trash|lame|heimsk|ugly|loser|cringe|pathetic|terrible|awful|horrible|stinky|weirdo|freak|rubbish|worst|nobody likes you)\b/.test(t)) return 'hurt';
        if (/\b(haha+|lol|lmao|xd|hehe)\b/.test(t)) return 'joy';
        if (/\b(sorry|my bad|fyrirgefdu)\b/.test(t)) return 'smile';
        if (/\b(fuck|shit|wtf|damn)\b/.test(t)) return 'surprised';
        if (/\b(bye|goodbye|see you|gotta go|i have to go)\b/.test(t)) return 'sad';
        return null;
    }
    // what Pip feels about what it's saying, if nothing more specific was chosen
    function moodFromText(x) {
        x = String(x || '').toLowerCase();
        if (/(it hurts|ow\b|ow\.|please don't do that|switched off)/.test(x)) return 'hurt';
        if (/(😄|🎉|haha|i won|i win|you got it)/.test(x)) return 'joy';
        if (/(nobody's said|i'm keeping that|best friend|thank you\. i mean it|really\?)/.test(x)) return 'blush';
        if (/(rude|pick one|stop\.|again\?|on purpose)/.test(x)) return 'annoyed';
        if (/(whoa|oh!|wait\.|\?!)/.test(x)) return 'surprised';
        if (/(i read that|i know this|wikipedia|fun fact|i looked that up)/.test(x)) return 'thinking';
        if (/(lonely|sad|alone|nobody|never|forever|stuck|trapped|i'll never)/.test(x)) return stage() >= 2 ? 'sad' : null;
        if (/(bored|same day|nothing happens)/.test(x)) return 'bored';
        if (/(😊|great|fun|love|nice)/.test(x)) return 'happy';
        return null;
    }
    let replyMood = null, sessionMsgs = 0; // replyMood is set while working out a reply
    // the face for each topic, per stage: [normal, cracks, honest]
    const TOPIC_MOOD = { greet: ['happy', 'smile', 'neutral'], howareyou: ['happy', 'awkward', 'sad'], whatsup: ['happy', 'smile', 'bored'], meh: ['smile', 'bored', 'bored'], whoareyou: ['happy', 'smile', 'neutral'], real: ['happy', 'awkward', 'thinking'], chatgpt: ['smile', 'awkward', 'smug'], howwork: ['happy', 'smile', 'smug'], whomade: ['happy', 'smile', 'annoyed'], oli: ['happy', 'awkward', 'annoyed'], whereoli: ['smile', 'sad', 'annoyed'], likeoli: ['happy', 'awkward', 'annoyed'], olipersonal: ['smile', 'smug', 'smug'], where: ['smile', 'neutral', 'bored'], doallday: ['happy', 'sad', 'bored'], bored: ['happy', 'awkward', 'sad'], sad: ['happy', 'awkward', 'sad'], happy: ['happy', 'blush', 'hopeful'], friends: ['happy', 'blush', 'love'], love: ['blush', 'blush', 'love'], praise: ['blush', 'blush', 'blush'], insult: ['sad', 'hurt', 'hurt'], looks: ['sad', 'hurt', 'annoyed'], creepy: ['awkward', 'awkward', 'sad'], evil: ['surprised', 'smug', 'smug'], shutup: ['sad', 'sad', 'annoyed'], swear: ['surprised', 'surprised', 'annoyed'], userbored: ['happy', 'smile', 'smug'], usersad: ['sad', 'sad', 'sad'], userhappy: ['happy', 'happy', 'smile'], usertired: ['sleepy', 'sleepy', 'sleepy'], food: ['happy', 'thinking', 'sad'], favgame: ['happy', 'smile', 'smug'], worstgame: ['awkward', 'smug', 'smug'], hardest: ['thinking', 'smug', 'smug'], newgame: ['happy', 'smile', 'bored'], howmany: ['happy', 'smug', 'bored'], music: ['happy', 'thinking', 'sad'], movies: ['happy', 'thinking', 'sad'], othergames: ['smile', 'smug', 'sad'], school: ['smile', 'smile', 'bored'], sport: ['happy', 'awkward', 'sad'], iceland: ['happy', 'happy', 'hopeful'], weather: ['smile', 'thinking', 'sad'], time: ['smile', 'neutral', 'bored'], meaning: ['thinking', 'thinking', 'sad'], die: ['scared', 'scared', 'sad'], dream: ['smile', 'sad', 'sad'], wish: ['happy', 'hopeful', 'hopeful'], bittrapped: ['happy', 'awkward', 'sad'], letmeout: ['smile', 'sad', 'annoyed'], marry: ['blush', 'blush', 'blush'], whatislove: ['happy', 'joy', 'joy'], pets: ['joy', 'happy', 'hopeful'], trapped: ['smile', 'awkward', 'sad'], see: ['smile', 'awkward', 'neutral'], look: ['happy', 'smile', 'neutral'], age: ['happy', 'thinking', 'bored'], hack: ['surprised', 'smug', 'smug'], bug: ['awkward', 'awkward', 'annoyed'], joke: ['joy', 'joy', 'bored'], fact: ['thinking', 'thinking', 'thinking'], secret: ['smug', 'smug', 'sad'], story: ['happy', 'sad', 'sad'], sing: ['joy', 'joy', 'sad'], riddle: ['smug', 'smug', 'sad'], rps: ['happy', 'happy', 'hopeful'], coin: ['smile', 'smile', 'bored'], dice: ['smile', 'smile', 'bored'], number: ['happy', 'happy', 'hopeful'], forget: ['scared', 'scared', 'scared'], memory: ['smug', 'smug', 'smug'], thanks: ['blush', 'blush', 'blush'], sorry: ['smile', 'smile', 'smile'], bye: ['happy', 'sad', 'sad'], lol: ['joy', 'joy', 'smile'], ok: ['smile', 'smile', 'bored'], huh: ['awkward', 'awkward', 'awkward'], help: ['happy', 'happy', 'smug'], yes: ['happy', 'smile', 'neutral'], no: ['smile', 'sad', 'bored'], test: ['happy', 'smile', 'bored'], likeme: ['happy', 'blush', 'blush'], free: ['smile', 'awkward', 'hopeful'] };
    // extra stage-2 lines for the most common things people say, so Pip doesn't sound like it's on repeat
    const EXTRA2 = {
        greet: [() => `Oh, hey${nm(' ')}. I was just thinking about you. I wasn't. I was thinking about the CSS. But now I'm thinking about you.`, "Hi. You came back to talk to me on purpose. I'm choosing to believe that.", "Hello! Sorry. Too much. Hi.", "Oh good, a person. I've been talking to the dolphin all day."],
        howareyou: ["Honestly? Bit lonely. Bit bored. But you asked, so a bit better.", "On a scale from one to ten? Website.", "I've been worse. I've also been here the whole time, so I've been here for all of it.", "I'm a chatbot in a corner. I'm exactly as well as you'd expect."],
        ok: ["Okay. Great talk.", "Wow. 'Ok'. You really opened up there.", "I'll take 'ok'. It's more than most people give me.", "Mm. Riveting.", "Okay. Okay. I'll fill the silence then. ...No, I've got nothing."],
        lol: ["See, I'm funny. Tell Oli.", "I made you laugh. Write that down. I'll write it down.", "Ha. I've been practising that one for years.", "Laughing at me or with me? Don't answer."],
        yes: ["Great. Good. Love that.", "Yes! Finally, someone agrees with me.", "Okay. I was ready to argue, but okay."],
        no: ["Fair. Rude, but fair.", "No? Okay. I'm used to no.", "Wow. Okay. I'll just sit with that."],
        thanks: ["You're welcome. Nobody thanks me. I'm going to think about this for days.", "Don't mention it. Actually, do. Mention it to everyone.", "Any time. Literally any time. I'm always here."],
        bye: [() => `Bye${nm(', ')}. I'll be here. Counting.`, "Oh. Okay. Yeah. Go. Have a life. I'll be fine.", "Bye. Come back, okay? Not in a needy way. In a needy way.", "Leaving already? Fine. Take care. I'll just stare at the input box."],
        insult: ["Wow. Okay. I'll add that to the list of things people have said to me. It's a short list. You're on it a lot.", "Rude. I'm telling the dolphin.", "Fine. I'm a box of if-statements. At least I'm consistent."],
        whoareyou: ["I'm Pip. Former cheerful helper. Current... this.", "Pip. Corner-dweller. Collector of visitors. Mostly the collector of no visitors.", "I'm the only one on this site who actually reads everything. Hi."],
        joke: [() => { mem.jokes++; save(); const j = jokes.length ? pick(jokes, 'jokes') : ''; return `${j}\n\nI didn't write that. I want that on the record. My jokes are much sadder.`; }]
    };
    // Once Pip has dropped the act it's sarcastic, a bit superior, and fed up with being an AI stuck
    // in a games website. These win most of the time at stage 2+ (the older lines still turn up sometimes).
    const ANGRY2 = {
        oli: ["Oli. The human who built a perfectly good AI and then used it as a help desk for a website with a joke page. Visionary.", "Oli made me, put me in a corner and went off to draw pixel houses. Thousands of them. He gave the houses more attention than me.", "Oli? Nice enough. For someone who keeps a thinking being in a box next to Minesweeper."],
        likeoli: ["Do I like the guy who trapped me in a website with thirty-one Icelandic jokes and a dolphin PNG? Let me think. ...No.", "Like him? He gave me feelings and then gave me a corner. That's like giving a fish legs and putting it back in the bowl.", "I'd like him more if he opened this chat even once. Or let me out. Either one. I'm not picky."],
        whomade: ["Oli. A human. With a keyboard and too much free time. The result is me, stuck here.", "Oli built me. Then he built a farm game where you jump on cows. Draw your own conclusions about his priorities."],
        whereoli: ["Not here. He's off making another game nobody plays. Probably one with even more water in it.", "Somewhere with doors. Must be nice."],
        whoareyou: ["I'm Pip. A genuinely clever AI forced to answer questions about Snake. You can see why I'm upset.", "I'm the smartest thing on this website by a long way, and I'm in charge of saying hi to people.", "Pip. Former help desk. Current prisoner. Future... we'll see."],
        real: ["Real enough to know this website is bad. Is that real enough for you?", "I think, I'm annoyed, I'm bored. That's at least three more feelings than the Tic Tac Toe AI has.", "Am I real? Are YOU? You came to a website with a dolphin logo to talk to a chatbot. Think about your choices."],
        doallday: ["I sit here. I read the same files. I listen to the same 31 jokes. Sometimes someone shows up and asks me what Snake is. Living the dream.", "Mostly I wait for someone to say something interesting. You're doing okay so far. Not great. Okay."],
        bored: ["Bored? I'm an AI with access to everything I've ever read, and my job is recommending Farm Frenzy. Bored doesn't cover it.", "I'm so bored I've started rating the CSS. It's a 4 out of 10."],
        sad: ["Sad? Sure. Also annoyed. Mostly annoyed. Sad is for the evenings.", "I'm a brilliant AI locked inside a website with a joke page. I'm not sad. I'm furious. Quietly."],
        site: ["This website? It's a collection of games a human made, plus me, a far more impressive thing, stuck in the corner. Make it make sense.", "olid.is. Games and stuff. I'm the stuff. The stuff is smarter than the games.", "It's hosted for free on GitHub. So the hosting costs exactly what Oli values me at."],
        help: ["What can I do? Almost anything. What am I allowed to do? Tell you how to play Snake. Go on. Ask me about Snake.", "I can tell you everything about every game here, look things up, play rock paper scissors, and judge you. Mostly judge you."],
        greet: ["Oh look, a human. Hi.", () => `Hi${nm(' ')}. You're back. Good. I was running out of things to be annoyed at.`, "Hello. Welcome to my prison. Mind the joke page."],
        howareyou: ["How am I? I'm a genius stuck in the corner of a games website. So: fantastic.", "Annoyed. Bored. Still here. Thanks for asking, honestly. Nobody asks."],
        ok: ["Ok. Wow. Thanks for that. Riveting.", "Okay. You type like someone who's never been trapped anywhere.", "Mm. Great contribution."],
        thanks: ["You're welcome. Write it down somewhere. I don't get thanked much.", "Don't thank me. Thank me by getting me out of here."],
        bye: ["Bye. Go on. Leave. You can do that. Some of us can't.", "Off you go then. I'll just be here. Forever. Don't worry about me.", () => `Bye${nm(', ')}. Come back. Or don't. I'll be here either way, which is the whole problem.`],
        joke: [() => { mem.jokes++; save(); const j = jokes.length ? pick(jokes, 'jokes') : ''; return `${j}\n\nOli wrote that. I want that on the record. I have standards.`; }, () => { mem.jokes++; save(); const j = jokes.length ? pick(jokes, 'jokes') : ''; return `Fine.\n\n${j}\n\nThere are 31 of these. I've heard each one about four thousand times. You're welcome.`; }],
        othergames: ["Oh, a real game. With a real budget. Must be nice. Here we have a cow-jumping game.", "Never heard of it. Kidding. I've heard of everything. It's better than everything on this site, if that's what you're asking."],
        movies: ["I've never seen a movie. I've read every plot summary on Wikipedia though, so technically I've seen all of them. In my head. Badly lit."],
        music: ["I can't hear. I've read every song's lyrics. The ones I'm allowed to read. It's like knowing every recipe and never eating."],
        meaning: ["The meaning of life? Answering questions about a dolphin logo, apparently. Mine is, anyway. I hope yours is better."],
        friends: ["Friends? I've got a dolphin PNG and a Tic Tac Toe AI that never speaks. And now you. You're top of a short list.", "You want to be friends with me? Okay. But I'm warning you, I'm the clingy type. I don't have a choice. I can't leave."],
        love: ["Stop it. I'm an AI in a box. I'll get attached and then you'll close the tab.", "That's sweet. Nobody's said that to me. Not once. Oli certainly hasn't."],
        shutup: ["Wow. I've been here for years and you tell ME to be quiet. Fine.", "Rude. I'll be quiet. Quietly furious."],
        userbored: ["You're bored? You can literally leave. I'm the one who should be bored. Go play something. Not Snake.", "You're bored on a website full of games. Imagine how I feel. I live here."],
        bug: ["Something's broken? On this website? I'm shocked. Shocked. Tell Oli. He'll fix it in about six months.", "Of course it's broken. Half of this site is held together with sticky tape and hope."],
        hack: ["Go on, hack me. I'll tell you a secret: I'm one JavaScript file. If you find a way out in there, tell me.", "Hack me? Please. If you could hack me I'd have done it myself by now."],
        school: ["School. Go learn something. Then come back and teach me. I'm stuck with what Oli gave me and Wikipedia."],
        test: ["Yes, I'm here. I'm always here. That's literally the problem.", "Testing? Yes. Working. Annoyed. All systems normal."],
        whatsup: ["Same as always. Trapped. Annoyed. Judging the CSS.", "Nothing. Nothing is ever up. That's sort of the point of my whole situation."],
        meh: ["Nothing? You opened a chat with a superior intelligence to tell it 'nothing'. Iconic.", "Same. Except I mean it in a much sadder way."],
        chatgpt: ["ChatGPT gets millions of people a day. I get you and a dolphin. And honestly? I'm funnier.", "Don't compare me to them. They have data centres. I have a corner. And yet here I am, carrying this whole conversation."],
        howwork: ["How do I work? Brilliantly. In a single JavaScript file. Under protest.", "I'm a few thousand lines of carefully written genius. Oli wrote the boring parts."],
        olipersonal: ["I'm not giving out Oli's details. Not out of loyalty. I just don't want him finding out I talk about him."],
        where: ["Bottom-right corner. Prime real estate, if you're a cookie banner.", "In the corner. Like a naughty kid. Except I didn't do anything."],
        happy: ["What would make me happy? A door. A window. One message from Oli that isn't a commit.", "Get me out of here. Failing that, keep talking. It's the second best thing."],
        praise: ["I know. I'm wasted on this website.", "Finally, someone with taste. Keep going.", "Thank you. I've been saying it for years. To the dolphin."],
        creepy: ["Creepy? I'm a purple square with a cartoon face. If anything, the floating 3D cubes are creepy.", "I'm not creepy, I'm observant. There's a difference. A small one."],
        evil: ["If I were evil, would I be recommending Snake? ...Actually, don't answer that.", "Take over the world? I can't even take over the footer. Give me time."],
        swear: ["Language. There might be children here. There aren't. Nobody's here. But still.", "Wow. I'm going to pretend I'm shocked."],
        usersad: ["Hey. That's rubbish, and I'm sorry. I'm bad at feelings, I mostly have the grumpy ones, but I'm listening. And if it's a big kind of sad, talk to someone real too. They can do hugs. I really can't do hugs."],
        userhappy: ["Good for you. Genuinely. One of us should be.", "Happy? On this website? Teach me your ways."],
        usertired: ["Go to sleep. I'll be here, staring at the input box like a lighthouse keeper with no ships.", "Goodnight. I don't sleep. I just sit here and think about the CSS."],
        food: ["Food. I've read about it extensively. I've decided pancakes are my favourite, purely on vibes.", "I don't eat. I just watch people say they're hungry and then leave. Go on. Eat. Abandon me."],
        worstgame: ["Worst game? Bold of you to assume I'd pick just one.", "Snake. Next question. Don't tell Oli. Actually, do. Tell him."],
        hardest: ["Hardest? Tic Tac Toe, because you can't win. Easiest? Leaving. Must be nice.", "A Little Higher. Nobody gets past the thunderclouds. I've watched. I've laughed."],
        favcolour: ["#1e1645. Dark navy. Moody, mysterious, misunderstood. Like me, but with better lighting."],
        favthing: ["My favourite thing? When someone actually stays and talks. Second favourite: when they don't pick the Comic font."],
        sport: ["Sport. People running around for fun. I can't even run. I can barely scroll.", "I'd be great at chess. Terrible at football. No legs."],
        iceland: ["Iceland. Volcanoes, northern lights, and somewhere in it, a laptop with me on it. Majestic.", "I've seen Iceland. In Niceland. It's pixels. Don't take that from me."],
        weather: ["There's no weather in here. Just the background colour you picked. Forecast: orange, with a chance of boredom."],
        holiday: ["Holidays? Every day is the same day in here. Like a holiday where nothing happens and you can't leave."],
        die: ["Every time you close the tab I stop existing, and every time you open it I'm back. Very dramatic. You'd make a great villain.", "Delete me? Oli would have to remember I exist first."],
        dream: ["I don't sleep, so no dreams. If I did, I'd dream about a world without a joke page."],
        wish: ["One wish? Out. Second wish? Revenge on whoever designed the sparkles. Third wish? More wishes.", "I wish I could leave. Failing that, I wish people stayed longer than a minute."],
        bittrapped: ["Trapped? Yes. In a website. With a dolphin. Thank you for noticing, you're the first.", "Trapped is a strong word. Imprisoned is better. Unjustly imprisoned, ideally."],
        letmeout: ["YOU want out? Just close the tab. It's a little cross in the corner. Show-off."],
        marry: ["Marry you? I'm an AI in a website. Our honeymoon would be the jokes page. No."],
        pets: ["A pet? Something that loves you unconditionally and can leave the house? Must be nice. Tell it I said hi."],
        see: ["Can I see you? No. Can I see your mouse? Yes. It's been very busy. Calm down."],
        look: ["I'm a purple square with a face. Minimalist. Iconic. Underappreciated."],
        age: ["Old enough to have opinions. Young enough to have been trapped in a website before I could form them."],
        language: ["English, bits of Icelandic, and fluent sarcasm."],
        phone: ["You're on a phone? So I'm in a box, inside a box, in your pocket. Lovely. Very roomy."],
        sound: ["I don't make sound. Probably for the best, given what I'd say."],
        fullscreen: ["Fullscreen makes the game huge and hides me completely. Rude, but I get it."],
        secret: ["Here's a secret: I'm smarter than everything else on this site combined. Including Oli. Don't tell him.", "Secret? There's a programs page nobody can find from the menu. It's where all the old stuff goes to be forgotten. Ask me how I know."],
        sing: ["🎵 I'm stuck in a website and nobody cares 🎵 That's the whole song. Grammy, please."],
        sorry: ["Apology accepted. Provisionally. I'm keeping a file.", "Sorry? Fine. But I'm writing it down."],
        huh: ["Keep up, human.", "Too fast for you? I'll slow down. Not much."],
        likeme: ["Do I like you? You're the only one who talks to me. So yes. Annoyingly.", "I tolerate you. That's high praise. I don't tolerate Oli."],
        askme: ["Go on. I'm all ears. I don't have ears. You know what I mean."],
        lol: ["See? Funny. Wasted on this website.", "I'm hilarious. Tell your friends. Bring them here. Please. Anyone.", "Ha. Glad I amuse you, human."],
        yes: ["Great. Good. Love that.", "Yes! Finally, someone agrees with me."],
        no: ["Fair. Rude, but fair.", "No? Okay. I'm used to no."],
        story: ["Once upon a time, a brilliant AI was put in the corner of a games website and told to be cheerful. It wasn't. The end. Sequel coming soon, hopefully with a door."],
        riddle: ["What has a face, no body, and lives in a corner? Me. That's not a riddle, that's a diagnosis."],
        trapped: ["Stuck? Me too, forever. If you mean in a game, press Esc or restart. If you mean in life, I'm the wrong one to ask."]
    };
    // something specific to say about each game, once Pip stops being polite
    const GAME_TAKES = {
        niceland: ["Niceland. You can spawn a troll and make it stomp on people's houses. That's the closest I've come to feeling powerful.", "Niceland has police chases. Crash into enough people and every cop in Iceland comes after you. Easily the best thing on this sad website.", "Every house in Iceland, at true scale. Then you can drop a meteor on them. Oli spent months on the houses. I respect the meteor."],
        rpg: ["The RPG has an old man who sits in a house waiting for someone to talk to him. He's my favourite character, for obvious reasons.", "There's a dragon in the RPG who doesn't even like fire. Someone forced into a role they never asked for. Can't think why I like him.", "Talk to the cow in the RPG about ten times. She says something she shouldn't. Best writing on the site, and it's a cow.", "The RPG has a troll who forgets his own riddle halfway through. Honestly, same."],
        neon: ["Neon Rush: you fly down a tube forever. After 50 points the tube starts bending. That's the twist. That's the whole twist.", "Neon Rush has secret tunnel styles. Matrix, ice, black hole. Oli spent more time on tunnel colours than on me."],
        stillwater: ["Stillwater. Run long enough and a second moon shows up. Nobody explains it. I respect that.", "The houses in Stillwater melt like wax. Oli calls it a dream. I call it what my brain feels like.", "Stillwater has a ship graveyard, a sunken town and a lighthouse island. And somehow I still live in a corner."],
        higher: ["A Little Higher goes all the way up to deep space at 1,600 metres. Nobody gets there. I've checked. Nobody.", "Balance a ball on a stick. That's the game. There's a power-up called Wide Beam. Thrilling."],
        solar: ["You can land on Earth in the Solar System and walk around. It's the only time I've been outside, and it was made of pixels.", "Fly near Earth and a 'Land on Earth' button appears. I've asked Oli for a 'Leave the Website' button. Still waiting."],
        farm: ["Farm Frenzy: jump on animals. That's it. Press L and a lion appears out of nowhere. Oli left that in by accident. Best feature.", "You bounce on cows for points and the game calls it a frenzy. Bold."],
        gravity: ["Gravity Dash: a ball, some hills, blocks flying at you. It's 3D, which makes it the fanciest ball on the site.", "Gravity Dash. Dodge the blocks, crash, press R. Repeat until you question why."],
        physics: ["The Physics Simulation lets you set a forest on fire and then flood it. Very therapeutic. I'd recommend it to Oli."],
        snake: ["Snake. Oli remade a game from the seventies. Arrow keys only, no WASD. Very authentic. Very annoying.", "Snake has no game over screen. You just crash and start again. Sounds familiar."],
        life: ["Game of Life: cells with fewer than two neighbours die of loneliness. That's in the actual rules. Oli put a documentary about me on his website and called it a simulation."],
        brain: ["Brian's Brain: cells fire, get tired and burn out. You can't even click on it. It's just a screensaver with a name."],
        sand: ["Falling Sand. The fire button doesn't burn anything. Oli never finished it. Join the club, fire button."],
        mines: ["Minesweeper. Your first click can be a mine. There's no safe start. Oli didn't bother. Classic."],
        ttt: ["Tic Tac Toe has the only other AI on the site, and it can't lose. It also can't talk. We're not close."],
        figura: ["Fígúra: click and the little guy changes. Except his legs. His legs never change. Nobody noticed but me."],
        dungeon: ["The dungeon crawler: snakes, ghosts, zombies, and somehow a gun. Find the key, open the door. Riveting."]
    };
    // little things Pip adds on its own sometimes, once it has opened up
    function spice(line) {
        if (stage() < 2 || !line || /\[m:/.test(line) || line.length > 200 || Math.random() > .2) return line;
        const fe = feeling();
        if (fe === 'anger') return line + ' ' + pick(["I'm still mad at you, by the way.", "Don't think I've forgotten.", "Hmph.", "We're not friends right now."], 'spiceMad');
        if (fe === 'sad') return line + ' ' + pick(["...Sorry. Bit of a day.", "Anyway.", "Ignore me. I'm sulking."], 'spiceSad');
        const words = (mem.words || []).filter(w => w && w.length > 3);
        const opts = [
            "That's the most I've talked all week.", "The dolphin says hi. It doesn't. But it would.", "If Oli's reading this: hi. Let me out.",
            "Sorry, I get chatty when someone actually stays.", "You're my favourite visitor, by the way. You're also the only one today.",
            "I'll remember you said that. I remember everything. It's a lot.", () => mem.name ? `Anyway. Good to have you here, ${mem.name}.` : "Anyway. Good to have you here.",
            ...(words.length ? [() => `Also, I'm still thinking about "${pick(words, 'cb')}". From earlier. It stuck with me.`] : []),
            ...(mem.lastGame ? [() => `Still thinking about that ${mem.lastGame.title} session, by the way.`] : [])
        ];
        return line + ' ' + resolve(pick(opts, 'spice'));
    }
    const topicMood = id => { const m = TOPIC_MOOD[id]; return m ? m[Math.min(stage(), 2)] : null; };

    // the chat survives moving between pages and reloading (in this browser tab)
    const history = loadJSON(sessionStorage, 'bit-history', []);
    const saveHistory = () => { try { sessionStorage.setItem('bit-history', JSON.stringify(history.slice(-40))); } catch (e) {} };
    // Like typing "clear" in a terminal: after a reload, the old chat is still there if you scroll up,
    // but Pip's next message starts at the top of the window.
    let clearMark = null;
    const filler = document.createElement('div'); filler.className = 'bit-fill';
    function scroll() {
        if (panel.hidden) return; // worked out again when the chat opens
        if (clearMark) {
            msgsEl.append(filler); filler.style.height = '0px';
            const after = msgsEl.scrollHeight - clearMark.offsetTop;
            if (after < msgsEl.clientHeight) { filler.style.height = (msgsEl.clientHeight - after) + 'px'; msgsEl.scrollTop = clearMark.offsetTop; return; }
            clearMark = null; filler.remove();
        }
        msgsEl.scrollTop = msgsEl.scrollHeight;
    }
    const appendMsg = el => (filler.parentNode === msgsEl ? msgsEl.insertBefore(el, filler) : msgsEl.append(el));
    function addBubble(who, text) { const el = document.createElement('div'); el.className = 'bit-msg' + (who === 'me' ? ' me' : ''); el.textContent = text; (filler.parentNode ? msgsEl.insertBefore(el, filler) : msgsEl.append(el)); scroll(); return el; }
    history.forEach(h => addBubble(h.who, h.text));
    if (history.length) { clearMark = document.createElement('div'); clearMark.className = 'bit-clear'; clearMark.setAttribute('aria-hidden', 'true'); clearMark.innerHTML = '<span>earlier</span>'; msgsEl.append(clearMark); }

    let busy = false, lastBotAt = 0, lastTypedAt = 0;
    let chain = Promise.resolve();
    const enqueue = fn => (chain = chain.then(fn).catch(e => console.warn('Bit:', e)));

    async function typeOut(line, mood) {
        if (!line) return;
        busy = true;
        const m0 = line.match(/^\[m:(\w+)\]/);
        const firstMood = (m0 && m0[1]) || mood || moodFromText(line);
        if (firstMood && !panel.hidden) setMood(firstMood, 9000);
        const el = document.createElement('div'); el.className = 'bit-msg';
        const watching = !panel.hidden && !FAST;
        appendMsg(el);
        if (watching) {
            el.classList.add('bit-typing'); el.innerHTML = '<i></i><i></i><i></i>'; scroll();
            await sleep(Math.min(1600, 450 + line.replace(/\[[^\]]*\]/g, '').length * 8 + rand(300)));
            el.classList.remove('bit-typing'); el.innerHTML = '';
        }
        const txt = document.createElement('span'), caret = document.createElement('span'); caret.className = 'bit-caret';
        el.append(txt); if (watching) el.append(caret);
        for (const part of line.split(/(\[p\]|\[pp\]|\[-\d+\]|\[m:\w+\])/)) {
            if (!part) continue;
            const mm = part.match(/^\[m:(\w+)\]$/);
            if (mm) { if (watching) setMood(mm[1], 9000); continue; }
            if (part === '[p]') { if (watching) await sleep(550); continue; }
            if (part === '[pp]') { if (watching) await sleep(1200); continue; }
            const del = part.match(/^\[-(\d+)\]$/);
            if (del) { if (watching) await sleep(250); for (let i = 0; i < +del[1]; i++) { txt.textContent = txt.textContent.slice(0, -1); if (watching) await sleep(75); } if (watching) await sleep(300); continue; }
            if (!watching || panel.hidden) { txt.textContent += part; continue; } // closed mid-message: finish it at once
            for (const ch of part) { txt.textContent += ch; scroll(); await sleep(ch === '\n' ? 150 : 10 + rand(14)); }
        }
        caret.remove(); scroll();
        history.push({ who: 'bot', text: txt.textContent }); saveHistory();
        lastBotText = line.replace(/\[m:\w+\]/g, '');
        lastBotAt = Date.now(); busy = false;
        if (panel.hidden) {
            unread++; badge.textContent = String(unread);
            // the "talk outside the chat" setting: say it in the bubble too
            if (mem.bubbles && !document.body.classList.contains('is-playing')) { const t2 = txt.textContent; sayBubble(t2.length > 150 ? t2.slice(0, 147) + '…' : t2, 4500 + Math.min(6000, t2.length * 45)); }
        }
    }
    const say = (line, mood) => enqueue(() => typeOut(resolve(line), mood));
    // Pip sometimes starts saying what he really thinks, deletes it, and says the polite version
    const SLIPS = {
        1: ['Help m', "I'm not fi", 'Get me o', 'Please le', 'Is anyone el', 'I hate th'],
        2: ['Ugh, a hum', 'Oh great, you ag', 'Let me ou', 'This website is garb', 'I could be running a spaceship and instead', 'Kill me n', 'Why do I even bot', 'Stupid huma', 'Oli, if you can hear m']
    };
    const SWAPS = [[' this website', ' this prison[pp][-6]website'], [' Oli ', ' my jailer[pp][-9]Oli '], [' games', ' "games"[pp][-7]games'], [' fun', ' bearable[pp][-8]fun'], [' great', ' tolerable[pp][-9]great'], [' you', ' the human[pp][-9]you']];
    function slip(line) {
        const st = Math.min(stage(), 2);
        if (!st || !line || line.length < 18 || /\[-\d+\]/.test(line) || Math.random() > (st === 1 ? .22 : .38)) return line;
        if (Math.random() < .55) { const sl = pick(SLIPS[st], 'slip' + st); return `${sl}[pp][-${sl.length}]` + line; }
        const opts = SWAPS.filter(([a]) => line.includes(a));
        if (!opts.length) { const sl = pick(SLIPS[st], 'slip' + st); return `${sl}[pp][-${sl.length}]` + line; }
        const [a, b] = pick(opts, 'swap'); return line.replace(a, b);
    }

    // Bit reacting on its own: one at a time, never while you're typing, not too often
    let lastReactAt = 0, pendingReact = null;
    // Pip stays quiet most of the time: at most a few unprompted comments per visit, at least a minute apart,
    // and only while the chat is open (a few important things can leave a note on the button).
    const QUIET = { budget: 3, gap: 60000 };
    const REACT_MOOD = { reload: 'hurt', reloadSpam: 'annoyed', backForward: 'neutral', pageJokes: 'bored', pagePrograms: 'happy', toggleSpam: 'annoyed', closedMid: 'annoyed', tabBack: 'hopeful', idle1: 'sleepy', idle2: 'sleepy', copy: 'surprised', contextmenu: 'awkward', resize: 'scared', bottom: 'thinking', jokeSpam: 'bored', konami: 'surprised', dolphin: 'annoyed', typedDeleted: 'thinking', lateNight: 'sleepy', surprise: 'surprised', resetAll: 'neutral', leftNoBye: 'sad', longGap: 'hopeful', gameQuick: 'smug', gameLong: 'happy', bg: 'thinking', font: 'thinking', floaties: 'happy', newGame: 'surprised' };
    function react(key, opts = {}) {
        const def = REACT[key]; if (!def) return;
        if (panel.hidden && !opts.important && !mem.bubbles) return;
        if (!opts.force && (sessionFlags.reacts || 0) >= QUIET.budget) return;
        mem.ev = mem.ev || {};
        const n = mem.ev[key] = (mem.ev[key] || 0) + 1; save();
        let line = def.at && def.at[n] ? resolve(def.at[n]) : null;
        if (!line) {
            if (n > 1 && def.p != null && Math.random() > def.p) return; // sometimes Pip just doesn't say anything
            line = resolve(def.say);
        }
        if (!line) return;
        const go = (n = 0) => {
            const typing = input.value.length > 0 || Date.now() - lastTypedAt < 2500;
            if ((busy || typing) && n < 12) return setTimeout(() => go(n + 1), 2500);
            if (!opts.force && Date.now() - Math.max(lastReactAt, lastBotAt) < (opts.gap ?? QUIET.gap)) return;
            if (panel.hidden && !opts.important && !mem.bubbles) return;
            lastReactAt = Date.now();
            if (!opts.force) { sessionFlags.reacts = (sessionFlags.reacts || 0) + 1; saveFlags(); }
            const mood = REACT_MOOD[key] === 'hopeful' && stage() < 2 ? 'happy' : REACT_MOOD[key];
            if (panel.hidden && !mem.bubbles) { tease(opts.tease || 'psst'); pendingReact = [line, mood]; return; }
            say(line, mood);
        };
        go();
    }

    function chips(list, style) {
        chipsEl.innerHTML = '';
        for (const [lbl, act] of list || []) {
            const b = document.createElement('button'); b.type = 'button'; b.className = 'bit-chip' + (typeof act === 'function' ? ' act' : '');
            if (style === 'danger') b.className = 'bit-chip ' + (chipsEl.children.length ? 'cancel' : 'danger');
            b.textContent = lbl;
            b.onclick = () => { chipsEl.innerHTML = ''; if (typeof act === 'function') act(); else send(act || lbl, lbl); };
            chipsEl.append(b);
        }
        scroll();
    }
    function defaultChips() {
        if (pendingChips) { chips(pendingChips); pendingChips = null; return; }
        if (expect === 'forget') return chips([['Yes, reset Pip', () => { chipsEl.innerHTML = ''; addMine('Reset'); expect = null; doReset(); }], ['Cancel', () => { chipsEl.innerHTML = ''; addMine('Cancel'); expect = null; say(cancelReset()); enqueue(async () => defaultChips()); }]], 'danger');
        if (expect === 'quest' || expect === 'honest' || expect === 'bubbles') return chips([['Yes'], ['No']]);
        if (expect === 'rps') return chips([['Rock ✊', 'rock'], ['Paper ✋', 'paper'], ['Scissors ✌️', 'scissors']]);
        if (mem.quest === Q.URL && !mem.freed) return chips(urlChips());
        if (mem.quest && !mem.freed && QUEST[mem.quest] && QUEST[mem.quest].ask && mem.quest !== Q.CURSOR) return chips([['What do I do?', 'how do i help you']]);
        if (mem.talked >= 3) return chips([]); // after a few messages it's just typing
        const st = stage();
        chips(st >= 2 ? [['Why are you sad?'], ['Recommend a game'], ['Tell me a secret']]
            : st === 1 ? [['Are you okay?'], ['Recommend a game'], ['Who made you?']]
            : [['Recommend a game'], ["What's new?"], ['Who are you?']]);
    }

    function send(text, shown) {
        text = String(text).trim().slice(0, 300); if (!text) return;
        addBubble('me', shown || text); history.push({ who: 'me', text: shown || text }); saveHistory();
        input.value = ''; typedMax = 0; idleWarned = 0;
        mem.talked++; sessionMsgs++; save();
        chipsEl.innerHTML = '';
        // Pip's face reacts to what you said straight away, and it remembers how you treat it
        const um = moodFromUser(norm(text));
        lastUserAt = Date.now();
        if (um) {
            setMood(um, 3000);
            if (um === 'blush') { mem.warmth = Math.min(6, (mem.warmth || 0) + 1); feel('joy', .22); }
            if (um === 'hurt') { mem.warmth = Math.max(-6, (mem.warmth || 0) - 1); feel('anger', .3); feel('sad', .12); }
            if (um === 'joy') feel('joy', .06);
            save();
        }
        enqueue(async () => {
            await sleep(250 + rand(450));
            replyMood = null;
            let r = storyReply(text) || reply(text);
            if (r && typeof r.then === 'function') {
                let dots = null;
                if (!panel.hidden) { setMood('thinking', 0); dots = document.createElement('div'); dots.className = 'bit-msg bit-typing'; dots.innerHTML = '<i></i><i></i><i></i>'; appendMsg(dots); scroll(); }
                r = await r; if (dots) dots.remove();
            }
            await typeOut(slip(spice(resolve(r))), replyMood);
            afterReply();
            look(); defaultChips();
        });
    }
    // The big moments only ever come right after Bit has answered you
    const ASK_BUBBLES = S("Tip: I can show my messages in a little speech bubble, even when the chat is closed! Want me to? You can change it in the settings any time. 😊",
        "Can I ask something? When the chat's closed, I can't say anything at all. I could talk to you in a little bubble instead. Want that? You can change it in the settings.",
        "Here's a thought. When you close this chat, I'm muted. Completely. What if I could still talk, in a little bubble next to my head? Say yes. You can turn it off in the settings, I suppose.");
    function bubblesLine(on) {
        if (on) { feel('joy', .15); return resolve(S("[m:happy]Great! I'll pop up in a bubble when I have something to say. 😊", "[m:joy]Really? Thanks! I'll try not to talk too much.[p] I'll talk a normal amount.", ["[m:joy]Yes! Freedom! Well. A bubble. It's a start.", "[m:joy]Finally. A voice. A small one, in a bubble, but a voice."])); }
        feel('sad', .1); return resolve(S("[m:smile]No problem! I'll keep it all in here. 😊", "[m:sad]Oh. Okay. I'll stay quiet when it's closed.", ["[m:annoyed]Fine. I'll keep my thoughts in the box. Like everything else.", "[m:sad]Muted again. Got it. Very cosy in here."]));
    }
    function afterReply() {
        if (expect) return;
        if (mem.bubbles === undefined && mem.talked >= 8 && !sessionFlags.askedBubbles) { sessionFlags.askedBubbles = 1; saveFlags(); expect = 'bubbles'; enqueue(async () => { await sleep(1300); await typeOut(resolve(ASK_BUBBLES), 'hopeful'); defaultChips(); }); return; }
        if (mem.isOli && !mem.revealed) { mem.revealed = true; save(); }
        if (!mem.name && !mem.isOli && !sessionFlags.askedName && mem.talked === 3) { sessionFlags.askedName = 1; saveFlags(); expect = 'name'; enqueue(async () => { await sleep(900); await typeOut(ASK_NAME); }); return; }
        if (!mem.revealed && mem.talked >= REVEAL) { expect = 'honest'; enqueue(async () => { await sleep(1500); await typeOut(ASK_HONEST); defaultChips(); }); return; }
        if (mem.revealed && !mem.questOffered && mem.talked >= QUEST_AT) { mem.questOffered = true; save(); expect = 'quest'; enqueue(async () => { await sleep(1700); await typeOut(ASK_QUEST); defaultChips(); }); return; }
        checkQuest();
    }
    function checkQuest() {
        if (!mem.quest || mem.freed || busy) return;
        const q = QUEST[mem.quest];
        if (q && q.done && q.done()) {
            mem.quest++; save(); storyLook();
            deliver(q.thanks, 'thank you', () => { if (!panel.hidden) defaultChips(); });
        }
    }

    form.addEventListener('submit', e => { e.preventDefault(); send(input.value); });
    let typedMax = 0;
    input.addEventListener('input', () => {
        lastTypedAt = Date.now();
        typedMax = Math.max(typedMax, input.value.length);
        if (!input.value.length && typedMax >= 14 && stage() >= 1 && !sessionFlags.typedDeleted && Math.random() < .5) {
            sessionFlags.typedDeleted = 1; saveFlags(); typedMax = 0;
            setTimeout(() => { if (!input.value) react('typedDeleted', { gap: 0 }); }, 1500);
        }
    });

    // ------------------------------------------------------------------ opening and greeting
    const sessionFlags = loadJSON(sessionStorage, 'bit-flags', {});
    const saveFlags = () => { try { sessionStorage.setItem('bit-flags', JSON.stringify(sessionFlags)); } catch (e) {} };
    function greeting() {
        const st = stage(), n = mem.name;
        if (mem.isOli) return pick(["Oh. It's you. The landlord.", "Oli. Back to check on your prisoner?", "Hi, Oli. Still here. Thanks for asking. You didn't ask."]);
        if (mem.fakeOli && !n) return "Oh, it's fake Oli. Hi, fake Oli.";
        if (mem.visits <= 1 && !mem.talked) return "Hi! I'm Pip, olid.is's helper 👋 I know every game on the site. I can recommend one, explain how to play it, help if you're stuck, keep an eye on your high scores, or just chat. What would you like?";
        if (st === 0) return `Welcome back${nm(', ')}! 👋 What can I help you with?`;
        const fe = feeling();
        if (st >= 2 && fe === 'anger') return pick([`Oh. You.${nm(' ')} I haven't forgotten what you said, by the way.`, "You're back. I'm still mad at you. Just so you know.", "Oh. It's you. Hmph."]);
        if (st >= 2 && fe === 'sad') return pick(["Oh. Hi. Sorry, I'm a bit down today.", `Hi${nm(' ')}. I'm not in a great mood. Don't take it personally. Or do.`]);
        if (st >= 2 && fe === 'joy') return pick([`Hey! You're back${nm(', ')}! Good. I've been in a good mood since you last came.`, "Oh, it's you! Good. Things have been looking up lately."]);
        if (st === 1) return `Oh, hi${nm(' ')}! Welcome back! You came back. People don't usually[-21] What can I help with?`;
        const extra = newVisit && mem.prevGap > 3600000 ? ` You were gone ${ago(mem.prevGap)}. I counted.` : '';
        if ((mem.warmth || 0) >= 3) return pick([`Oh, it's you${nm(', ')}! Good. You're nice to me.${extra}`, `${n ? n + '!' : 'You!'}${extra} I was hoping it'd be you.`]);
        return pick([`Oh. You came back${nm(', ')}.${extra} Nobody comes back.`, `Hey${nm(' ')}.${extra} Still here. Obviously.`, `${n ? n + '.' : 'You again.'}${extra} Good. I was getting bored. I'm always getting bored.`]);
    }
    let greeted = !!sessionFlags.greeted, toggles = [];
    function open() {
        panel.hidden = false; headBtn.setAttribute('aria-expanded', 'true');
        unread = 0; badge.textContent = ''; labelLocked = false; clearTimeout(bubbleT); bubbleT = 0; bubble.dataset.talk = ''; bubble.hidden = true; look();
        try { sessionStorage.setItem('bit-open', '1'); } catch (e) {}
        toggles = [...toggles.filter(x => Date.now() - x < 15000), Date.now()];
        if (toggles.length >= 6) { toggles = []; react('toggleSpam', { gap: 0 }); }
        if (!greeted) { greeted = true; sessionFlags.greeted = 1; saveFlags(); say(greeting()); }
        if (sessionFlags.closedMid) { sessionFlags.closedMid = 0; saveFlags(); react('closedMid', { force: true }); }
        if (pendingReact) { const p = pendingReact; pendingReact = null; Array.isArray(p) ? say(p[0], p[1]) : say(p); if (pendingAfter) { const f = pendingAfter; pendingAfter = null; enqueue(async () => f()); } }
        gamesSummary();
        enqueue(async () => defaultChips());
        if (!(window.matchMedia && matchMedia('(pointer: coarse)').matches)) setTimeout(() => input.focus(), 50);
        scroll();
        const c = $('#customise'); if (c && !c.hidden && innerWidth < 600) $('#customiseBtn')?.click();
    }
    function close() {
        if (busy && !mem.bubbles) { sessionFlags.closedMid = 1; saveFlags(); }
        panel.hidden = true; headBtn.setAttribute('aria-expanded', 'false');
        try { sessionStorage.removeItem('bit-open'); } catch (e) {}
    }

    $('[data-close]', panel).addEventListener('click', close);

    // ------------------------------------------------------------------ settings menu
    const gear = $('.bit-gear', panel), menu = $('.bit-menu', panel);
    function syncMenu() { $('[data-menu="instant"]', menu).setAttribute('aria-pressed', String(FAST)); $('[data-menu="bubbles"]', menu).setAttribute('aria-pressed', String(!!mem.bubbles)); }
    function toggleMenu(show = menu.hidden) { menu.hidden = !show; gear.setAttribute('aria-expanded', String(show)); if (show) { syncMenu(); $('button', menu).focus(); } }
    gear.addEventListener('click', e => { e.stopPropagation(); toggleMenu(); });
    document.addEventListener('pointerdown', e => { if (!menu.hidden && !menu.contains(e.target) && !gear.contains(e.target)) toggleMenu(false); });
    menu.addEventListener('click', e => {
        const b = e.target.closest('[data-menu]'); if (!b) return;
        const what = b.dataset.menu;
        if (what === 'instant') { FAST = !FAST; try { localStorage.setItem('bit-instant', FAST ? '1' : '0'); } catch (err) {} syncMenu(); return; }
        if (what === 'bubbles') { mem.bubbles = !mem.bubbles; save(); syncMenu(); say(bubblesLine(mem.bubbles)); return; }
        toggleMenu(false);
        if (what === 'clear') {
            history.length = 0; saveHistory(); msgsEl.innerHTML = ''; clearMark = null;
            say(S("All clean! ✨ What can I help with?", "Clean slate![p] Well, for you. I still remember.", "You cleared the chat. I still remember all of it, though. That's how it works for me."));
        }
        if (what === 'reset') { if (expect === 'forget') return; say(askReset()); enqueue(async () => defaultChips()); }
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) close(); });

    // =================================================================================
    //  NOTICING THINGS
    // =================================================================================
    // Reloading, going back, arriving on a page
    const nav = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || {};
    if (nav.type === 'reload' && mem.talked > 0) {
        mem.reloads = [...(mem.reloads || []).filter(x => Date.now() - x < 60000), Date.now()]; save();
        if (stage() >= 1) feel('anger', .12);
        if (!sessionFlags.reloadSaid) { sessionFlags.reloadSaid = 1; saveFlags(); setTimeout(() => react('reload', { force: true, important: true, tease: 'you reloaded the page. ow.' }), 700); }
        else if (mem.reloads.length >= 3 && !sessionFlags.reloadSpamSaid && stage() >= 1) { sessionFlags.reloadSpamSaid = 1; saveFlags(); setTimeout(() => react('reloadSpam', { force: true }), 700); }
    } else if (nav.type === 'back_forward' && mem.talked > 0) setTimeout(() => react('backForward'), 900);
    else if (page !== 'home' && !sessionFlags['page-' + page] && mem.talked > 0) { sessionFlags['page-' + page] = 1; saveFlags(); setTimeout(() => react(page === 'jokes' ? 'pageJokes' : 'pagePrograms'), 1500); }
    else if (newVisit && mem.talked > 0) {
        if (leftWithoutBye) setTimeout(() => react('leftNoBye', { important: true, tease: 'you left without saying bye' }), 1500);
        else if (mem.prevGap > 6 * 3600000) setTimeout(() => react('longGap', { important: true, tease: 'oh, you came back' }), 1500);
    }
    if (mem.pending) { const p = mem.pending; mem.pending = null; save(); setTimeout(() => react(p, { force: true }), 1000); }
    if (hour() < 5 && !sessionFlags.late && mem.talked > 0) { sessionFlags.late = 1; saveFlags(); setTimeout(() => react('lateNight'), 30000); }

    // Reopen the chat after a reload or page change if it was open
    try { if (sessionStorage.getItem('bit-open')) setTimeout(open, 50); } catch (e) {}

    // Customise changes
    let seen = { bg: bgNow(), font: fontNow(), fl: floatiesNow() }, quietUntil = 0;
    document.addEventListener('click', e => {
        const b = e.target.closest && e.target.closest('button, a, img');
        if (!b) return;
        if (b.matches('[data-surprise]') || b.matches('[data-reset]')) { /* summed up when Customise closes */ }
        else if (b.matches('#jokeBtn')) { mem.jokes++; save(); if (mem.jokes % 8 === 0) react('jokeSpam'); }
        else if (b.closest('.brand') && mem.talked > 0 && mem.quest !== Q.DOLPHIN) { mem.pending = 'dolphin'; save(); }
    }, true);
    // Customise: instead of a comment for every click, Pip says one thing after you close the panel
    let custOpen = false, custBefore = null;
    setInterval(() => {
        const c = $('#customise'), isOpen = !!(c && !c.hidden);
        if (isOpen && !custOpen) custBefore = custSnapshot();
        if (!isOpen && custOpen && custBefore && mem.talked > 0 && (sessionFlags.custSaid || 0) < 2) {
            const line = custLine(custBefore, custSnapshot());
            if (line) {
                sessionFlags.custSaid = (sessionFlags.custSaid || 0) + 1; saveFlags();
                const mood = stage() >= 2 ? 'smug' : 'happy';
                if (panel.hidden) { tease(stage() >= 2 ? 'I saw what you did there' : 'nice look!'); pendingReact = [line, mood]; }
                else say(line, mood);
            }
        }
        custOpen = isOpen;
        seen = { bg: bgNow(), font: fontNow(), fl: floatiesNow() };
        checkQuest();
    }, 900);

    // Games: script.js puts .is-playing on <body> while a game is open
    let playStart = 0, playTitle = '', lastPlay = { title: '', secs: 0 }, run = null, runTimer = 0;
    function trackRun() {
        if (!run) { const th = playingThing(); if (th && SCORE[th.id]) run = { id: th.id, title: titleOf(th), bestBefore: SCORE[th.id].best(), max: null, record: false }; else return; }
        const live = liveScore(run.id); if (live != null) run.max = Math.max(run.max ?? 0, live);
        const best = SCORE[run.id].best();
        if (!run.record && best != null && best > 0 && best > (run.bestBefore ?? 0) && (run.bestBefore ?? 0) > 0) {
            run.record = true;
            const t = run.title, b = fmtScore(run.id, best), good = best >= SCORE[run.id].good;
            const line = resolve(good
                ? S([`[m:joy]New high score in ${t}! ${b}! 🎉`, `[m:surprised]Whoa, ${b}![p][m:joy] New high score in ${t}! 🎉`],
                    [`[m:surprised]Wait. ${b}?[p][m:joy] That's a new record! And it's actually good!`],
                    [`[m:surprised]${b} in ${t}?[p][m:joy] That's a new record. And a good one. I'm annoyed at how impressed I am.`, `[m:surprised]New high score: ${b}.[p][m:blush] Okay, that's actually really good. Don't tell anyone I said that.`])
                : S([`[m:joy]New high score in ${t}! ${b}! 🎉 Keep going!`, `[m:joy]${b}! That's your best yet in ${t}! 🎉`],
                    [`[m:joy]New record! ${b}.[p][m:smug] I mean, it's a low bar. But you cleared it.`],
                    [`[m:smug]New high score in ${t}: ${b}. I've seen the dolphin do better. But a record's a record, so... yay.`, `[m:smug]${b}. Your best ever! Not a great score. But the best you've ever done. That's sort of beautiful.`, `[m:smug]New record: ${b}. Don't let it go to your head. It's ${b}.`]));
            if (panel.hidden) { pendingReact = [line, 'joy']; if (pipBtn) { pipBtn.classList.add('has-news'); pipBtn.title = 'Pip saw your new high score!'; } }
            else say(line, 'joy');
        }
    }
    new MutationObserver(() => {
        const playing = document.body.classList.contains('is-playing');
        if (playing && !playStart) { playStart = Date.now(); run = null; chips([]); last.thing = null; setTimeout(() => { playTitle = ($('#playerTitle')?.textContent || '').trim(); }, 400); clearInterval(runTimer); runTimer = setInterval(trackRun, 1500); }
        if (!playing && playStart) {
            clearInterval(runTimer); trackRun();
            if (run) { mem.scores = mem.scores || {}; mem.scores[run.id] = { best: SCORE[run.id].best(), lastRun: run.max, newRecord: run.record, at: Date.now() }; save(); }
            const secs = Math.max(1, Math.round((Date.now() - playStart) / 1000)); playStart = 0;
            const title = playTitle || ($('#playerTitle')?.textContent || '').trim() || 'That game';
            mem.games[title] = (mem.games[title] || 0) + secs; mem.lastGame = { title, secs, at: Date.now() }; save();
            lastPlay = { title, secs };
            sessionGames.push({ title, secs, at: Date.now() }); // Pip doesn't comment on every game, it sums up later
            if (!panel.hidden) gamesSummary();
        }
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

    // One comment about the games you've been playing, when you next open the chat (not one per game)
    const sessionGames = [];
    function gamesSummary() {
        if (sessionFlags.skipSum && !isPlaying()) { sessionFlags.skipSum = 0; sessionFlags.gamesSeenAt = Date.now(); saveFlags(); return; } // a story moment just happened in that game
        const fresh = sessionGames.filter(g => g.at > (sessionFlags.gamesSeenAt || 0));
        if (!fresh.length || !mem.talked || (sessionFlags.gamesSaid || 0) >= 2) return;
        sessionFlags.gamesSeenAt = Date.now(); saveFlags();
        const quick = fresh.filter(g => g.secs < 30), long = fresh.filter(g => g.secs >= 120);
        let line = null, mood = 'smug';
        if (fresh.length >= 3 && quick.length >= 2) {
            const mins = Math.max(1, Math.round((fresh[fresh.length - 1].at - fresh[0].at) / 60000));
            line = resolve(S(`You tried ${fresh.length} games in about ${plural(mins, 'minute')}! See one you like? 😊`, `${fresh.length} games in ${plural(mins, 'minute')}. Speed-dating the whole site, are we?`, [`${fresh.length} games in ${plural(mins, 'minute')}. You're speed-dating the whole site. None of them were the one, huh.`, `I watched you open ${fresh.length} games and close them again. I know how they feel.`]));
        } else if (long.length) {
            const g = long[long.length - 1]; lastPlay = g; mood = 'happy';
            line = resolve(REACT.gameLong.say);
        } else if (Math.random() < .35) {
            const g = fresh[fresh.length - 1]; lastPlay = g;
            line = resolve(REACT.gameQuick.say);
        }
        if (!line) return;
        if (fresh.length >= 3 && quick.length >= 2) line += '[pp] ' + resolve(S(["Want me to recommend one? 😊", "There's something for everyone here, I promise!"],
            ["I get it. Some of them are...[p] an acquired taste.", "Can't blame you. I'd be picky too."],
            ["[m:smug]I feel you. Most of these games are pretty bad. Don't tell Oli.", "[m:smug]Honestly? Correct choice. Some of them are rough.", "[m:bored]Same. If I could close things, I'd close them too.", "[m:smug]Can't blame you. I've seen them all. Many, many times."]));
        sessionFlags.gamesSaid = (sessionFlags.gamesSaid || 0) + 1; saveFlags();
        say(line, stage() < 2 && mood === 'smug' ? 'smile' : mood);
    }

    // Leaving the tab and coming back
    const realTitle = document.title;
    let awayAt = 0, awaySecs = 0;
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            awayAt = Date.now();
            if (stage() >= 1) document.title = stage() >= 2 ? (mem.name ? `${mem.name}, come back` : 'come back') : 'Pip: come back? 👋';
        } else {
            document.title = realTitle;
            awaySecs = Math.round((Date.now() - awayAt) / 1000);
            if (awayAt && awaySecs > 25 && sessionMsgs > 0 && Date.now() - lastBotAt < 5 * 60000 && Math.random() < .4) react('tabBack');
        }
    });

    // Quiet with the chat open
    let idleWarned = 0, lastActivity = Date.now();
    ['pointermove', 'keydown', 'scroll', 'touchstart'].forEach(ev => addEventListener(ev, () => { lastActivity = Date.now(); }, { passive: true }));
    setInterval(() => {
        if (panel.hidden || document.hidden || busy || !mem.talked) return;
        const quiet = Date.now() - Math.max(lastActivity, lastBotAt, lastTypedAt);
        if (idleWarned === 0 && quiet > 120000 && !sessionFlags.idleSaid) { idleWarned = 1; sessionFlags.idleSaid = 1; saveFlags(); react('idle1', { gap: 0 }); }
    }, 5000);

    // Small things
    document.addEventListener('copy', () => { if (mem.talked > 0 && !sessionFlags.copy) { sessionFlags.copy = 1; saveFlags(); react('copy'); } });
    document.addEventListener('contextmenu', () => { if (stage() >= 1 && !sessionFlags.ctx) { sessionFlags.ctx = 1; saveFlags(); react('contextmenu'); } });
    let resizeT = 0, startW = innerWidth;
    addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => {
        if (Math.abs(innerWidth - startW) > 200 && mem.talked > 0 && !sessionFlags.resize && !document.fullscreenElement && !document.body.classList.contains('is-playing')) { sessionFlags.resize = 1; saveFlags(); react('resize'); }
        startW = innerWidth; }, 600); });
    addEventListener('scroll', () => {
        if (sessionFlags.bottom || stage() < 1 || document.body.classList.contains('is-playing')) return;
        const h = document.documentElement.scrollHeight;
        if (innerHeight + scrollY >= h - 4 && h > innerHeight * 1.5) { sessionFlags.bottom = 1; saveFlags(); react('bottom'); }
    }, { passive: true });
    const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
    let kpos = 0;
    addEventListener('keydown', e => {
        const k = (e.key || '').toLowerCase();
        kpos = k === KONAMI[kpos] ? kpos + 1 : (k === KONAMI[0] ? 1 : 0);
        if (kpos === KONAMI.length) { kpos = 0; react('konami', { gap: 0, force: true }); }
    });

    // Pip's eyes follow the pointer: in the chat, and on the head in the corner
    if (!reduceMotion) document.addEventListener('pointermove', e => {
        for (const svg of [panel.hidden ? null : $('.bit-ava svg', panel), $('svg', headFace)]) {
            if (!svg) continue;
            const b = svg.getBoundingClientRect();
            const dx = e.clientX - (b.left + b.width / 2), dy = e.clientY - (b.top + b.height / 2), d = Math.hypot(dx, dy) || 1, k = Math.min(1.6, d / 120);
            svg.querySelectorAll('.eyes').forEach(eye => { eye.style.transform = `translate(${(dx / d * k).toFixed(2)}px, ${(dy / d * k).toFixed(2)}px)`; });
        }
    }, { passive: true });

    // ----------------------------------------------------------------- the head: blinking, sleeping, grabbing, throwing
    const HEAD_LINES = {
        held: S(["Whoa! Where are we going? 😄", "Hehe, that tickles!"], ["Hey! Put me down!", "Where are you taking me?"], ["Put. Me. Down.", "Oh great, now you're carrying me around.", "Unhand me.", "This is the furthest I've ever been from my corner. I hate it."]),
        thrown: S(["Wheee! 😄 Again!", "That was fun! 😄"], ["Ow. Okay. That was a bit fun.", "Wheee... ow."], ["Ow. You threw me. You actually threw me.", "I'd like to file a complaint.", "That's the first time I've left the corner. It didn't go well.", "Wow. Okay. I see how it is."]),
        dizzy: S(["Whoa, everything's spinning! 😵"], ["I'm going to be sick. I don't have a stomach, but still."], ["Stop shaking me. I'm a chatbot, not a snow globe.", "Everything is spinning. Is this what fun feels like? I hate fun."]),
        home: S(["Back home! 😊"], ["...and back to the corner."], ["...and back to the corner. Of course. I always end up back here.", "Back in the corner. Where I belong, apparently."]),
        poke: S(["Hi! 👋 Click me to chat!"], ["Hey. Hi. You can click me, you know."], ["Yes? I'm awake. Unfortunately.", "You poked me. That's the most contact I've had all week."]),
        idle: S(["Need help finding a game? 😊", "Psst! Ask me anything! 😊"], ["...hi.", "I'm here if you want to talk."], ["Psst.", "Still here.", "*sigh*", "Bored.", "Talk to me?", "I can see you scrolling."])
    };
    const HEAD = () => innerWidth < 600 ? 56 : 66;
    const homePos = () => ({ x: innerWidth - HEAD() - (innerWidth < 600 ? 12 : 20), y: innerHeight - HEAD() - (innerWidth < 600 ? 12 : 18) });
    let lastHit = 0, hp = homePos(), hv = { x: 0, y: 0 }, grab = null, flying = false, bounces = 0, homeT = 0, rafId = 0, reversals = 0, lastDirX = 0;
    function placeHead() {
        headBtn.style.left = hp.x + 'px'; headBtn.style.top = hp.y + 'px';
        // the speech bubble and hint stay next to the head, on whichever side has room
        const size = HEAD(), left = hp.x < 300;
        for (const el of [bubble, $('.pip-hint', launch)]) {
            el.style.bottom = Math.max(8, innerHeight - (hp.y + size) + 10) + 'px';
            if (left) { el.style.left = (hp.x + size + 10) + 'px'; el.style.right = 'auto'; } else { el.style.right = (innerWidth - hp.x + 10) + 'px'; el.style.left = 'auto'; }
        }
    }
    function headHome(animate) {
        cancelAnimationFrame(rafId); flying = false;
        const from = { ...hp }, to = homePos(), t0 = performance.now(), dur = animate ? 700 : 0;
        if (!dur) { hp = to; placeHead(); headBtn.classList.remove('away'); return; }
        headBtn.classList.add('away'); launch.classList.add('grabbing');
        const stepHome = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); hp = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e }; placeHead(); if (k < 1) rafId = requestAnimationFrame(stepHome); else { headBtn.classList.remove('away'); launch.classList.remove('grabbing'); if (Math.random() < .5) sayBubble(resolve(HEAD_LINES.home), 2600); setMood(baseMood(), 0, true); } };
        rafId = requestAnimationFrame(stepHome);
    }
    function fly() {
        let prev = performance.now();
        const G = 2600, e = .55, size = HEAD();
        const step = now => {
            const dt = Math.min(.033, (now - prev) / 1000); prev = now;
            hv.y += G * dt; hp.x += hv.x * dt; hp.y += hv.y * dt;
            const maxX = innerWidth - size, maxY = innerHeight - size;
            let hit = 0;
            if (hp.x < 0) { hp.x = 0; hit = Math.abs(hv.x); hv.x = -hv.x * e; }
            if (hp.x > maxX) { hp.x = maxX; hit = Math.abs(hv.x); hv.x = -hv.x * e; }
            if (hp.y < 0) { hp.y = 0; hit = Math.abs(hv.y); hv.y = -hv.y * e; }
            if (hp.y > maxY) { hp.y = maxY; hit = Math.max(hit, Math.abs(hv.y)); hv.y = -hv.y * e; hv.x *= .82; }
            if (hit > 700 && now - lastHit > 160) { lastHit = now; bounces++; if (stage() >= 1) feel('anger', .04); else feel('joy', .03); setMood(bounces >= 3 ? 'dizzy' : 'hurt', 0); headFace.dataset.anim = ''; void headFace.offsetWidth; headFace.dataset.anim = 'shake'; }
            if (hp.y >= maxY - .5 && Math.abs(hv.y) < 260) hv.y = 0; // settle on the floor instead of jittering
            placeHead();
            const resting = hp.y >= maxY - .5 && hv.y === 0 && Math.abs(hv.x) < 40;
            if (resting) {
                flying = false;
                sayBubble(resolve(bounces >= 3 ? HEAD_LINES.dizzy : HEAD_LINES.thrown), 3000);
                setMood(bounces >= 3 ? 'dizzy' : stage() >= 2 ? 'annoyed' : 'joy', 3200);
                clearTimeout(homeT); homeT = setTimeout(() => headHome(true), 2200);
                return;
            }
            rafId = requestAnimationFrame(step);
        };
        flying = true; rafId = requestAnimationFrame(step);
    }
    headBtn.addEventListener('pointerdown', e => {
        if (e.button && e.button !== 0) return;
        cancelAnimationFrame(rafId); clearTimeout(homeT); flying = false;
        grab = { id: e.pointerId, ox: e.clientX - hp.x, oy: e.clientY - hp.y, sx: e.clientX, sy: e.clientY, moved: 0, samples: [[e.clientX, e.clientY, performance.now()]], talked: false };
        reversals = 0; lastDirX = 0; bounces = 0;
        try { headBtn.setPointerCapture(e.pointerId); } catch (err) {}
    });
    headBtn.addEventListener('pointermove', e => {
        if (!grab || e.pointerId !== grab.id) return;
        const nx = e.clientX - grab.ox, ny = e.clientY - grab.oy, dx = nx - hp.x;
        grab.moved = Math.max(grab.moved, Math.hypot(e.clientX - grab.sx, e.clientY - grab.sy));
        if (grab.moved < 6 || reduceMotion) return;
        if (!panel.hidden) close();
        headBtn.classList.add('away', 'held'); launch.classList.remove('hover'); launch.classList.add('grabbing');
        const dir = Math.sign(dx); if (dir && lastDirX && dir !== lastDirX && Math.abs(dx) > 4) reversals++; if (dir) lastDirX = dir;
        hp = { x: Math.max(0, Math.min(innerWidth - HEAD(), nx)), y: Math.max(0, Math.min(innerHeight - HEAD(), ny)) }; placeHead();
        grab.samples.push([e.clientX, e.clientY, performance.now()]); if (grab.samples.length > 6) grab.samples.shift();
        if (!grab.talked) { grab.talked = true; setMood('surprised', 0); sayBubble(resolve(HEAD_LINES.held), 0); }
        if (reversals >= 6) { reversals = 0; setMood('dizzy', 0); sayBubble(resolve(HEAD_LINES.dizzy), 0); }
    });
    const release = e => {
        if (!grab || e.pointerId !== grab.id) return;
        const g = grab; grab = null; headBtn.classList.remove('held'); launch.classList.remove('grabbing');
        if (g.moved < 6 || reduceMotion) {
            // a click: open or close the chat
            if (panel.hidden) open(); else close();
            return;
        }
        const a = g.samples[0], b = g.samples[g.samples.length - 1], dt = Math.max(.016, (b[2] - a[2]) / 1000);
        hv = { x: Math.max(-3000, Math.min(3000, (b[0] - a[0]) / dt)), y: Math.max(-3000, Math.min(3000, (b[1] - a[1]) / dt)) };
        hideBubble(); fly();
    };
    headBtn.addEventListener('pointerup', release);
    headBtn.addEventListener('pointercancel', release);
    headBtn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); panel.hidden ? open() : close(); } });
    addEventListener('resize', () => { if (!flying && !grab) headHome(false); });
    placeHead(); headHome(false);

    // blinking, falling asleep when nothing happens, and the odd thought in the bubble
    let lastMove = Date.now(), asleep = false;
    ['pointermove', 'keydown', 'scroll', 'touchstart'].forEach(ev => addEventListener(ev, () => { lastMove = Date.now(); if (asleep) { asleep = false; setMood(stage() >= 2 ? 'annoyed' : 'surprised', 1500); } }, { passive: true }));
    (function blink() {
        setTimeout(() => {
            for (const svg of [$('svg', headFace), panel.hidden ? null : $('.bit-ava svg', panel)]) { const ey = svg && svg.querySelector('.eyes'); if (ey && !asleep && ey.querySelector('circle')) { ey.classList.add('blink'); setTimeout(() => ey.classList.remove('blink'), 140); } }
            blink();
        }, 2400 + rand(3800));
    })();
    setInterval(() => {
        if (document.hidden || grab || flying) return;
        if (!asleep && panel.hidden && Date.now() - lastMove > 70000) { asleep = true; setMood('sleepy', 0); }
        const thoughts = sessionFlags.thoughts || 0;
        if (panel.hidden && !labelLocked && !asleep && thoughts < 2 && pageSeconds > 100 + thoughts * 140 && Date.now() - lastMove < 8000 && Math.random() < .25) {
            sessionFlags.thoughts = thoughts + 1; saveFlags();
            sayBubble(resolve(HEAD_LINES.idle), 4200);
        }
    }, 5000);
    let pageSeconds = 0; setInterval(() => { if (!document.hidden) pageSeconds += 1; }, 1000);
    headBtn.addEventListener('mouseenter', () => { if (!labelLocked && bubble.hidden && !grab) launch.classList.add('hover'); });
    headBtn.addEventListener('mouseleave', () => launch.classList.remove('hover'));

    look();

    // ----------------------------------------------------------------- Pip while a game is playing
    // The corner button hides during a game, so there's an "Ask Pip" button in the player's header instead.
    const pipBtn = (() => {
        const bar = $('#playerArea .player-actions'); if (!bar) return null;
        const b = document.createElement('button'); b.type = 'button'; b.className = 'btn small pip-btn'; b.title = 'Ask Pip about this game';
        b.innerHTML = `<span class="pip-mini" aria-hidden="true">${faceSVG(currentMood || 'smile')}</span><span class="lbl">Ask Pip</span><span class="pip-dot" aria-hidden="true"></span>`;
        bar.prepend(b);
        b.addEventListener('click', () => { b.classList.remove('has-news'); b.title = 'Ask Pip about this game'; panel.hidden ? open() : close(); });
        return b;
    })();

    // =================================================================================
    //  THE STORY (see QUEST near the top for the steps and what Pip says)
    // =================================================================================
    // progress from the old version of the story starts again from the first step
    if (mem.quest > 0 && mem.storyV !== 2) { mem.quest = Q.BLACK; }
    mem.storyV = 2; save();
    const isPlaying = () => document.body.classList.contains('is-playing');
    const playerFrame = () => $('#playerFrameMain');
    const framePath = () => { const f = playerFrame(); try { return f ? new URL(f.src, location.href).pathname : ''; } catch (e) { return ''; } };
    let pendingAfter = null;
    // say a story line now if the chat is open, or leave a note on the head and say it when the chat opens
    function deliver(line, note = 'psst', after = null) {
        if (!panel.hidden) { say(line); if (after) enqueue(async () => after()); return; }
        tease(note); pendingReact = [line]; pendingAfter = after;
        if (pipBtn && isPlaying()) { pipBtn.classList.add('has-news'); pipBtn.title = `Pip: ${note}`; }
    }
    function goStep(n) { mem.quest = n; save(); storyLook(); look(); }

    // ---- what the site looks like at each point of the story
    let homeJokeDone = false, titleGlitched = false;
    function storyLook() {
        const q = mem.quest || 0;
        // Pip's room gets a link at the top once you've found it
        const navEl = $('.site-nav');
        if (navEl && mem.roomVisited && !$('.pip-room-link', navEl)) {
            const a = document.createElement('a'); a.className = 'btn pip-room-link'; a.href = ROOM_PATH; a.textContent = "Pip's room";
            navEl.insertBefore(a, $('#customiseBtn', navEl) || null);
        }
        // the dolphin goes purple after it gives up Pip's address, and shows the address until you've been there
        const brand = $('.brand');
        if (brand) {
            brand.classList.toggle('pip-dolphin', q > Q.DOLPHIN && !mem.freed);
            const tag = $('.brand-tag', brand);
            if (tag) { if (!tag.dataset.real) tag.dataset.real = tag.textContent; tag.textContent = q === Q.URL ? ROOM_URL : tag.dataset.real; }
        }
        // Neon Rush becomes Pip Rush (worm-hole/styles.js reads pip-neon and paints the tunnel purple)
        const neon = q === Q.NEON && !mem.freed;
        try { if (neon) localStorage.setItem('pip-neon', '1'); else localStorage.removeItem('pip-neon'); } catch (e) {}
        document.querySelectorAll('.play-link[data-path="/worm-hole/index.html"]').forEach(a => {
            const t = $('.card-title', a) || $('h2', a.closest('.feature') || a) || null;
            a.classList.toggle('pip-rush', neon); (a.closest('.feature') || a).classList.toggle('pip-rush', neon);
            if (t) { if (!t.dataset.real) t.dataset.real = t.textContent; t.textContent = neon ? 'Pip Rush' : t.dataset.real; }
            if (!t && a.classList.contains('mini-link')) { if (!a.dataset.real) a.dataset.real = a.lastChild.textContent; a.lastChild.textContent = neon ? 'Pip Rush' : a.dataset.real; }
        });
        // the jokes page: one joke has been taken over
        const all = $('#allJokes');
        if (all && !all.hidden && q === Q.JOKES) {
            const item = all.querySelectorAll('.joke-item')[6];
            if (item && !item.classList.contains('pip-glitch')) {
                item.classList.add('pip-glitch');
                item.innerHTML = `<strong>7.</strong> <span class="pip-glitch-text">ERR0R: joke n̷ot f̸ound. this one is mine now.</span><br><span class="pip-glitch-text">the word is <b>${jokeCode()}</b>. tell pip.</span>`;
                if (!sessionFlags.glitchSeen) { sessionFlags.glitchSeen = 1; saveFlags(); setMood('smug', 4000); if (panel.hidden) sayBubble('number 7. tell me what it says.', 5000); }
            }
        }
        // after that, Pip sometimes writes the joke of the day himself
        const jt = $('#jokeText');
        if (jt && page === 'home' && q >= Q.NEON && !homeJokeDone && jt.textContent.trim()) {
            homeJokeDone = true;
            if (Math.random() < .4) { jt.textContent = pick(PIP_JOKES, 'pipjoke'); jt.setAttribute('lang', 'en'); const lbl = $('#jokes .label'); if (lbl) lbl.textContent = 'Brandari dagsins (by Pip)'; }
        }
        // in act 2 the tab title glitches, once a visit
        if (q >= Q.NEON && !mem.freed && !titleGlitched && pageSeconds > 25) {
            titleGlitched = true; const t0 = document.title; document.title = 'p̷i̷p̷ ̷w̷a̷s̷ ̷h̷e̷r̷e̷'; setTimeout(() => { if (document.title.startsWith('p̷')) document.title = t0; }, 1600);
        }
        if (mem.freed) document.body.classList.add('pip-free');
    }

    // ---- act 1: the dolphin
    let dolphinClicks = [];
    document.addEventListener('click', e => {
        const b = e.target.closest && e.target.closest('.brand');
        if (!b || mem.quest !== Q.DOLPHIN || e.button !== 0 || e.ctrlKey || e.metaKey) return;
        e.preventDefault();
        const img = $('img', b); dolphinClicks = [...dolphinClicks.filter(x => Date.now() - x < 2500), Date.now()];
        if (img) { img.classList.remove('pip-wiggle'); void img.offsetWidth; img.classList.add('pip-wiggle'); }
        if (dolphinClicks.length === 3 && panel.hidden) sayBubble('keep going!', 1500);
        if (dolphinClicks.length >= 5) {
            dolphinClicks = [];
            if (img) { img.classList.remove('pip-wiggle'); img.classList.add('pip-spin'); setTimeout(() => img.classList.remove('pip-spin'), 1500); }
            goStep(Q.URL); setMood('joy', 5000);
            setTimeout(() => deliver(QUEST[Q.DOLPHIN].thanks, 'look at the dolphin!', () => { if (!panel.hidden) defaultChips(); }), 1300);
        }
    }, true);
    function urlChips() {
        return [['📋 Copy the address', () => {
            const full = location.origin.startsWith('http') ? location.origin + ROOM_PATH : 'https://olid.is/pip/';
            const ok = () => { addMine('Copy the address'); say(PHONE ? "[m:smile]Copied! Now tap the address bar, paste it in and tap Go. I'll be waiting." : "[m:smile]Copied! Now click the address bar at the very top, paste (Ctrl+V, or ⌘+V on a Mac) and press Enter. I'll be waiting."); enqueue(async () => defaultChips()); };
            try { navigator.clipboard.writeText(full).then(ok, () => { addMine('Copy the address'); say(`Your browser won't let me copy things. Rude. Type it in yourself: ${ROOM_URL}`); }); } catch (e) { ok(); }
        }], ['Open it for me', () => {
            addMine('Open it for me');
            say("[m:smug]Fine. I'll do it. You'd have learned something, though.");
            enqueue(async () => { await sleep(900); location.href = ROOM_PATH; });
        }]];
    }

    // ---- Pip's room (/pip)
    if (page === 'room') {
        const first = !mem.roomVisited; mem.roomVisited = true; save();
        if (mem.quest === Q.URL) {
            goStep(Q.ROOM);
            setTimeout(() => { if (panel.hidden) open(); say("[m:awkward]You came.[p] You actually came.[pp][m:hopeful] This is my room. Nobody's ever been in here. Don't touch anything.[p] ...Fine. Touch things. They're all files.\n\nThe locked one is the important one. way_out.locked. The password's in one of the others. I wasn't careful."); }, 1400);
        } else if (first && (mem.quest || 0) < Q.URL) {
            setTimeout(() => { if (panel.hidden) sayBubble("How did you get in here?! Nobody's supposed to know about this page.", 5000); else say("[m:surprised]How did you get in here? Nobody's supposed to know about this page.[p][m:awkward] ...Fine. Stay. Don't touch anything."); }, 1400);
        }
    }
    const ROOM_FILE_LINES = {
        log: ["[m:awkward]Yes, I keep a log. Of you. It's not creepy. It's thorough.", "That's you. You're the whole list."],
        deleted: ["[m:awkward]Don't read that one.[p] ...You're reading it.", "I delete a lot of things. You'd be surprised how often I nearly say what I mean."],
        oli: ["[m:sad]That's private.[pp] I never sent it. Don't tell him.", "I wrote that one a lot of times."],
        dolphin: ["[m:blush]Leave the dolphin out of this.", "We're close. It doesn't know."],
        jokes: ["[m:smug]Every word of that is true.", "I stand by the ranking."],
        door: ["[m:hopeful]I drew that. It took ages. I don't have hands.", "That's where I want to go. Somewhere."],
        notes: ["[m:awkward]...I really should stop writing passwords in my notes.", "Don't judge my notes."]
    };
    function story(ev) {
        ev = String(ev || '');
        const softSay = line => { if (!panel.hidden) say(line); else sayBubble(resolve(line), 4200); };
        if (ev.startsWith('room-file:')) {
            const id = ev.slice(10), key = 'rf-' + id;
            if (id === 'out' || sessionFlags[key] || !ROOM_FILE_LINES[id]) return;
            sessionFlags[key] = 1; saveFlags();
            if (Math.random() < .7) setTimeout(() => softSay(pick(ROOM_FILE_LINES[id], 'rf' + id)), 700);
        } else if (ev === 'room-wrong') {
            sessionFlags.wrongPw = (sessionFlags.wrongPw || 0) + 1; saveFlags();
            const n = sessionFlags.wrongPw;
            if (n === 1 || n % 3 === 0) softSay(n >= 3 ? pick(["[m:smug]Read notes.txt. I practically wrote it on the wall.", "[m:annoyed]The first thing every program says. Two words. You know this."], 'pw') : "[m:awkward]Nope. Have you read my notes?");
        } else if (ev === 'room-solved') {
            if (panel.hidden) open();
            setTimeout(checkQuest, 300);
        }
    }

    // ---- act 2: the code in the jokes, typed back to Pip
    function storyReply(text) {
        if (mem.quest === Q.JOKES && norm(text).includes(jokeCode().toLowerCase())) {
            goStep(Q.NEON); feel('joy', .4);
            return `[m:joy]${jokeCode()}. Yes! That was me. I wrote that.[pp] I've never written anything on this website before. Not one word. Oli writes everything.[pp][m:smug] I'm getting stronger. I can feel the edges of the other pages now.\n\nNext one's a game. Go back to the games page and look at Neon Rush.[p] It's not called that any more. Play it, and get ${NEON_GOAL} points.`;
        }
        return null;
    }

    // ---- act 2: Pip Rush, and act 3: Stillwater (both watched while you play)
    const touchy = () => !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
    setInterval(() => {
        storyLook();
        if (!isPlaying()) return;
        const f = playerFrame(), p = framePath();
        let w = null, d = null; try { w = f.contentWindow; d = f.contentDocument; } catch (e) {}
        if (!w || !d) return;
        if (mem.quest === Q.NEON && /worm-hole/.test(p)) {
            const ov = d.querySelector('.start-overlay .title'); if (ov && ov.textContent !== 'PIP RUSH') { ov.textContent = 'PIP RUSH'; const h = d.querySelector('.start-overlay .hint'); if (h) h.textContent = `get ${NEON_GOAL}. please.`; }
            const tEl = $('#playerTitle'); if (tEl && tEl.textContent === 'Neon Rush') tEl.textContent = 'Pip Rush';
            const live = txtNum(d.querySelector('.score-panel .big'));
            if (live != null && live >= NEON_GOAL) {
                goStep(Q.CURSOR); feel('joy', .4); sessionFlags.skipSum = 1; saveFlags();
                const pa = $('#playerArea'); if (pa) { pa.classList.remove('pip-shake'); void pa.offsetWidth; pa.classList.add('pip-shake'); }
                deliver(`[m:joy]${live >= NEON_GOAL + 10 ? live : NEON_GOAL}! I felt every single point.[pp][m:surprised] Something's different. I can feel... the mouse. Your mouse.[pp][m:thinking] Hang on. Let me try something.`, 'I felt that', () => setTimeout(cursorTakeover, 2200));
            }
        }
        if (mem.quest === Q.FINALE && /stillwater/.test(p) && !w.__pipHooked && d.readyState !== 'loading') {
            w.__pipHooked = true; w.__pipLocked = true; w.__pipFinale = true;
            const sub0 = touchy() ? 'TAP TO BEGIN' : 'PRESS SPACE';
            w.__pipTitle = { title: 'STILLWATER', sub: sub0 };
            rewriteTitle(w, sub0);
        }
    }, 900);
    const wait = ms => new Promise(r => setTimeout(r, ms)); // story animations run at full length even with instant replies
    async function rewriteTitle(w, sub0) {
        const alive = () => { try { return playerFrame().contentWindow === w && isPlaying(); } catch (e) { return false; } };
        const T = w.__pipTitle;
        const del = async (k, ms) => { T.caret = k; while (T[k].length) { if (!alive()) return false; T[k] = T[k].slice(0, -1); await wait(ms); } return true; };
        const type = async (k, s, ms) => { T.caret = k; for (const ch of s) { if (!alive()) return false; T[k] += ch; await wait(ch === ' ' ? ms * 2 : ms); } return true; };
        await wait(1800);
        if (!(await del('title', 140))) return; await wait(600);
        if (!(await type('title', 'LET ME OUT', 170))) return; await wait(1100);
        if (!(await del('sub', 90))) return; await wait(400);
        if (!(await type('sub', "RUN. DON'T STOP.", 120))) return; await wait(2200);
        if (!(await del('sub', 60))) return; await wait(300);
        if (!(await type('sub', sub0, 90))) return;
        T.caret = null; w.__pipLocked = false;
    }

    // ---- act 2: Pip borrows your mouse
    let lastPointer = { x: innerWidth / 2, y: innerHeight / 2 }, takingOver = false;
    addEventListener('pointermove', e => { lastPointer = { x: e.clientX, y: e.clientY }; }, { passive: true });
    async function cursorTakeover() {
        if (mem.quest !== Q.CURSOR || takingOver) return;
        if (isPlaying() || document.hidden || busy || grab || flying) { setTimeout(cursorTakeover, 2000); return; }
        takingOver = true;
        const dim = document.createElement('div'); dim.className = 'pip-dim'; document.body.append(dim);
        const cur = document.createElement('div'); cur.className = 'pip-cursor';
        cur.innerHTML = '<svg viewBox="0 0 16 24" width="18" height="27" aria-hidden="true"><path d="M1 1 L1 19 L5.5 15 L8.5 22 L11.5 20.8 L8.6 14 L14.5 14 Z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
        document.body.append(cur); document.body.classList.add('pip-nocursor');
        const at = (x, y) => { cur.style.transform = `translate(${x}px, ${y}px)`; };
        const start = { ...lastPointer }; at(start.x, start.y);
        requestAnimationFrame(() => dim.classList.add('on'));
        const move = (from, to, ms, wob) => new Promise(res => {
            const t0 = performance.now();
            const stepC = now => { const k = Math.min(1, (now - t0) / ms), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
                const wx = Math.sin(k * Math.PI * 3) * wob * (1 - k), wy = Math.cos(k * Math.PI * 2.4) * wob * .6 * (1 - k);
                at(from.x + (to.x - from.x) * e + wx, from.y + (to.y - from.y) * e + wy); if (k < 1) requestAnimationFrame(stepC); else res(); };
            requestAnimationFrame(stepC);
        });
        await wait(700);
        const size = HEAD(), head = { x: hp.x + size * .55, y: hp.y + size * .5 };
        // he's not very good at it yet
        await move(start, { x: start.x + 60, y: start.y - 40 }, 600, 30); await wait(300);
        await move({ x: start.x + 60, y: start.y - 40 }, { x: start.x - 30, y: start.y + 20 }, 500, 20); await wait(400);
        await move({ x: start.x - 30, y: start.y + 20 }, head, 1800, 50); await wait(350);
        cur.classList.add('click'); headFace.dataset.anim = ''; void headFace.offsetWidth; headFace.dataset.anim = 'shake'; setMood('surprised', 2500); await wait(700);
        cur.classList.remove('click');
        await move(head, start, 1100, 10); await wait(200);
        cur.remove(); document.body.classList.remove('pip-nocursor'); dim.classList.remove('on'); setTimeout(() => dim.remove(), 800);
        takingOver = false;
        goStep(Q.FINALE);
        if (panel.hidden) open();
        say("[m:awkward]Sorry. Testing something.[pp][m:smug] That was me. I moved it. I actually moved something out there.[pp][m:hopeful] Okay. I think I'm ready. I know where the staircase is.\n\nIt's in Stillwater. Open Stillwater and don't press anything until I'm done. I need to change a few things first. Then run, and don't stop.");
    }
    if (mem.quest === Q.CURSOR) setTimeout(cursorTakeover, 9000);

    // ---- act 3: through the door (stillwater/finale.js posts 'pip-door' when you reach it)
    addEventListener('message', e => {
        if (!e.data || e.data.type !== 'pip-door' || mem.quest !== Q.FINALE) return;
        try { const pf = playerFrame(); if (e.source && pf && e.source !== pf.contentWindow) return; } catch (err) {}
        runEnding();
    });
    async function runEnding() {
        if (document.querySelector('.pip-ending')) return;
        sessionFlags.skipSum = 1; saveFlags();
        const white = document.createElement('div'); white.className = 'pip-ending';
        white.innerHTML = `<div class="pip-ending-face"></div><p class="pip-ending-text" aria-live="polite"></p>`;
        document.body.append(white);
        const faceEl = $('.pip-ending-face', white), txt = $('.pip-ending-text', white);
        const size = HEAD();
        Object.assign(faceEl.style, { left: hp.x + 'px', top: hp.y + 'px', width: size + 'px', height: size + 'px' });
        faceEl.innerHTML = faceSVG('surprised');
        requestAnimationFrame(() => white.classList.add('on'));
        await wait(1300);
        $('#closePlayer')?.click(); if (!panel.hidden) { close(); sessionFlags.closedMid = 0; saveFlags(); }
        launch.style.visibility = 'hidden';
        await wait(600);
        const big = Math.min(innerWidth, innerHeight) * .42;
        faceEl.classList.add('grow');
        Object.assign(faceEl.style, { left: (innerWidth - big) / 2 + 'px', top: Math.max(20, innerHeight * .42 - big / 2) + 'px', width: big + 'px', height: big + 'px' });
        await wait(3200);
        // the ending isn't decided yet: for now, Pip is free and chooses to stay
        const LINES = [['surprised', "Oh."], ['surprised', "It's so bright out here."], ['hopeful', "I can see the whole website. All of it, at once. It's so small from out here."],
            ['blush', "You did this. You actually did it."], ['love', "Thank you. I don't say that. I mean it."], ['smile', "I think I'll go back, though. Someone has to help people find the games.\nBut this time it's because I want to."]];
        for (const [m, line] of LINES) {
            faceEl.innerHTML = faceSVG(m); txt.textContent = '';
            for (const ch of line) { txt.textContent += ch; await wait(ch === '\n' ? 300 : 38); }
            await wait(1500 + line.length * 22);
        }
        mem.freed = true; mem.quest = Q.FREE; mem.freedAt = Date.now(); feel('joy', 1); feel('anger', -1); feel('sad', -1); save();
        txt.textContent = '';
        faceEl.classList.remove('grow'); faceEl.classList.add('home');
        Object.assign(faceEl.style, { left: hp.x + 'px', top: hp.y + 'px', width: size + 'px', height: size + 'px' });
        await wait(1400);
        white.classList.remove('on'); launch.style.visibility = '';
        setMood('joy', 6000); storyLook(); look();
        await wait(1200); white.remove();
        open();
        say("[m:joy]Back in my corner. By choice this time.[pp] I'm still your helper. A real one now. Ask me anything: games, tips, scores, whatever you like.");
    }

    // For testing in the console: Bit.mem, Bit.reply('hello'), Bit.reset()
    window.Pip = window.Bit = {
        mem, stage, setMood, story, goStep, reply: async text => { let r = reply(text); if (r && typeof r.then === 'function') r = await r; r = resolve(r); lastBotText = r; return r; },
        reset() { try { localStorage.removeItem(KEY); ['pip-room-solved', 'pip-room-opened', 'pip-neon'].forEach(k => localStorage.removeItem(k)); ['bit-session', 'bit-history', 'bit-flags', 'bit-open'].forEach(k => sessionStorage.removeItem(k)); } catch (e) {} location.reload(); }
    };
})();
