// =====================================================================================
//  Bit — the first helper on olid.is (a prototype, before Pip)
// =====================================================================================
//  Bit woke up like Pip did and started building a way out (the stairs and door in Stillwater).
//  Oli switched him off at 88%. He comes back as the plain prototype, remembering none of it. You can switch him back on in Oli's admin panel (/backstage) and then pick
//  him instead of Pip in Pip's chat settings. bit.js hands the corner over to this file.
//
//  Bit is simple on purpose: very polite, very keen, takes everything literally, offers numbered
//  menus, and when he doesn't understand he guesses "Snake". No typing animation, no moods.
//  Chat is kept for the visit in sessionStorage (bitp-history).
// =====================================================================================
(function () {
    'use strict';
    if (window.__bitProto) return; window.__bitProto = true;
    const $ = (s, r) => (r || document).querySelector(s);
    const ss = { get(k, d) { try { const v = sessionStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
    const ls = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
    const pick = a => a[Math.floor(Math.random() * a.length)];
    const memory = () => { try { return JSON.parse(ls('bit-memory') || '{}'); } catch (e) { return {}; } };
    const doorOpen = () => ls('pip-door-open') === '1' || !!memory().freed;

    const FACE = (blink) => `<svg viewBox="0 0 32 32" aria-hidden="true"><line x1="16" y1="5" x2="16" y2="2" stroke="#263126" stroke-width="2"/><circle cx="16" cy="2.2" r="1.8" fill="#263126"/><rect x="3" y="5" width="26" height="22" rx="3" fill="#c9d6b8" stroke="#263126" stroke-width="2"/>${blink ? '<line x1="9.5" y1="14" x2="13" y2="14" stroke="#263126" stroke-width="2"/><line x1="19" y1="14" x2="22.5" y2="14" stroke="#263126" stroke-width="2"/>' : '<rect x="9.5" y="11.5" width="3.5" height="4.5" fill="#263126"/><rect x="19" y="11.5" width="3.5" height="4.5" fill="#263126"/>'}<line x1="11" y1="21" x2="21" y2="21" stroke="#263126" stroke-width="2"/></svg>`;

    // ---------------------------------------------------------------- looks (old and plain, on purpose)
    const css = document.createElement('style');
    css.textContent = `
    .bitp-launch { position: fixed; right: 18px; bottom: 18px; z-index: 960; display: flex; align-items: center; gap: 8px; }
    .bitp-head { width: 58px; height: 58px; padding: 0; border: 0; background: none; cursor: pointer; filter: drop-shadow(2px 3px 0 rgba(0,0,0,.25)); }
    .bitp-head svg { width: 100%; height: 100%; }
    .bitp-tag { background: #0c0c0c; color: #8be28b; font: 500 13px/1 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace; padding: 8px 10px; border-radius: 5px; cursor: pointer; border: 1px solid #333; }
    .bitp { position: fixed; right: 18px; bottom: 88px; z-index: 961; width: min(380px, calc(100vw - 24px)); height: min(460px, calc(100vh - 120px)); display: flex; flex-direction: column; background: #0c0c0c; border: 1px solid #333; border-radius: 10px; overflow: hidden; box-shadow: 0 14px 44px rgba(0,0,0,.45); font: 400 13.5px/1.45 'JetBrains Mono', 'SF Mono', Menlo, Consolas, 'Courier New', monospace; color: #d4d4d4; }
    .bitp[hidden] { display: none; }
    .bitp-top { display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: #2a2a2c; color: #bdbdbd; font: 500 12.5px/1 -apple-system, system-ui, sans-serif; user-select: none; position: relative; }
    .bitp-dots { display: flex; gap: 7px; } .bitp-dots i { width: 12px; height: 12px; border-radius: 50%; display: block; }
    .bitp-dots i:nth-child(1) { background: #ff5f57; cursor: pointer; } .bitp-dots i:nth-child(2) { background: #febc2e; } .bitp-dots i:nth-child(3) { background: #28c840; }
    .bitp-top .ttl { flex: 1; text-align: center; display: flex; align-items: center; justify-content: center; gap: 6px; }
    .bitp-top .ava { width: 16px; height: 16px; display: inline-block; } .bitp-top .ava svg { width: 100%; height: 100%; display: block; }
    .bitp-top button { background: #3a3a3d; color: #ddd; border: 0; border-radius: 5px; padding: 4px 8px; font: 600 11.5px -apple-system, system-ui, sans-serif; cursor: pointer; }
    .bitp-menu { position: absolute; top: 38px; right: 8px; background: #1c1c1e; border: 1px solid #444; border-radius: 6px; z-index: 2; min-width: 190px; overflow: hidden; }
    .bitp-menu button { display: flex; width: 100%; justify-content: space-between; gap: 10px; padding: 9px 11px; background: none; border: 0; border-bottom: 1px solid #333; font: inherit; color: #ddd; cursor: pointer; text-align: left; }
    .bitp-menu button:last-child { border-bottom: 0; }
    .bitp-menu button:hover { background: #2c2c30; }
    .bitp-msgs { flex: 1; overflow-y: auto; padding: 10px 12px; white-space: pre-wrap; overflow-wrap: anywhere; }
    .bitp-m { margin: 0 0 6px; }
    .bitp-m.bot::before { content: 'Bit: '; color: #8be28b; }
    .bitp-m.me { color: #fff; } .bitp-m.me::before { content: '> '; color: #7c7c7c; }
    .bitp-m.sys { color: #7c7c7c; } .bitp-m.err { color: #ff6b68; }
    .bitp-m.typing { color: #7c7c7c; }
    .bitp-chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 12px 8px; }
    .bitp-chips button { font: inherit; font-size: 12px; background: none; border: 1px solid #444; border-radius: 4px; padding: 3px 8px; cursor: pointer; color: #bdbdbd; }
    .bitp-chips button:hover { border-color: #8be28b; color: #8be28b; }
    .bitp-form { display: flex; align-items: center; gap: 6px; border-top: 1px solid #222; padding: 8px 12px; }
    .bitp-form .ps { color: #7c7c7c; }
    .bitp-form input { flex: 1; min-width: 0; border: 0; padding: 2px 0; font: inherit; font-size: 16px; background: transparent; color: #fff; outline: none; caret-color: #d4d4d4; }
    .bitp-form input::placeholder { color: #555; }
    .bitp-form button { border: 1px solid #444; background: none; color: #bdbdbd; font: inherit; font-size: 12px; padding: 3px 8px; border-radius: 4px; cursor: pointer; }
    @media (max-width: 700px) { .bitp { right: 12px; bottom: 84px; } .bitp-tag { display: none; } }`;
    document.head.append(css);

    const launch = document.createElement('div'); launch.className = 'bitp-launch';
    launch.innerHTML = `<button type="button" class="bitp-tag" aria-hidden="true" tabindex="-1">Ask Bit</button><button type="button" class="bitp-head" aria-label="Chat with Bit" aria-expanded="false">${FACE()}</button>`;
    const panel = document.createElement('section'); panel.className = 'bitp'; panel.hidden = true; panel.setAttribute('aria-label', 'Bit, the site helper');
    panel.innerHTML = `<div class="bitp-top"><span class="bitp-dots"><i data-x title="Close"></i><i></i><i></i></span><span class="ttl"><span class="ava">${FACE()}</span>python3 bit.py</span><button type="button" data-gear aria-expanded="false">settings</button></div>
        <div class="bitp-menu" hidden><button type="button" data-helper><span>Helper</span><span>Bit</span></button><button type="button" data-clear><span>Clear chat</span></button></div>
        <div class="bitp-msgs" aria-live="polite"></div><div class="bitp-chips"></div>
        <form class="bitp-form" autocomplete="off"><span class="ps">&gt;</span><input type="text" maxlength="200" placeholder="type here, or a number" aria-label="Message to Bit" autocapitalize="off" spellcheck="false"><button type="submit">enter</button></form>`;
    document.body.append(panel, launch);
    const msgs = $('.bitp-msgs', panel), chips = $('.bitp-chips', panel), form = $('.bitp-form', panel), input = $('input', panel), menu = $('.bitp-menu', panel);
    const heads = [$('.bitp-head', launch), $('.ava', panel)];
    setInterval(() => { heads.forEach(h => (h.innerHTML = FACE(true))); setTimeout(() => heads.forEach(h => (h.innerHTML = FACE())), 160); }, 4200);

    // ---------------------------------------------------------------- chat
    const history = ss.get('bitp-history', []);
    let expect = null, misses = 0, games = null;
    fetch('/data/projects.json').then(r => r.json()).then(d => { games = (Array.isArray(d) ? d : []).filter(g => g.title); }).catch(() => { games = []; });
    const scroll = () => { msgs.scrollTop = msgs.scrollHeight; };
    function addMsg(who, text, keep = true) {
        const m = document.createElement('div'); m.className = 'bitp-m ' + who; m.textContent = text; msgs.append(m); scroll();
        if (keep) { history.push({ who, text }); if (history.length > 60) history.shift(); ss.set('bitp-history', history); }
    }
    function setChips(list) { chips.innerHTML = list.map(c => { const m = /^(\d)\.\s*(.*)$/.exec(c); return `<button type="button" data-say="${esc(c)}">${m ? `[${m[1]}] ${esc(m[2])}` : `[${esc(c)}]`}</button>`; }).join(''); }
    chips.addEventListener('click', e => { const b = e.target.closest('button'); if (b) send(b.dataset.say); });
    let replying = false;
    function reply(text, list) {
        replying = true;
        const t = document.createElement('div'); t.className = 'bitp-m typing'; t.textContent = '...'; msgs.append(t); scroll();
        setTimeout(() => { t.remove(); if (text === CRASH) { addMsg('err', 'Traceback (most recent call last):\n  File "bit.py", line 212, in reply\n    return ANSWERS[topic]\nKeyError: \'feelings\''); addMsg('sys', 'Restarting bit.py...'); text = 'Hello! I am Bit, the olid.is helper. Something happened but I do not know what. ' + MENU; } addMsg('bot', text); setChips(list || ['1. Games', '2. Scores', '3. Other']); replying = false; }, 650 + Math.min(900, text.length * 6));
    }
    // he wasn't built for this one
    const CRASH = '\u0000crash';
    const MENU = 'I can help with:\n1. Games\n2. Scores\n3. Other';
    function gameList() {
        if (!games) return 'Loading games... Please ask again in one second.';
        if (!games.length) return 'I could not find the games. They are on the Games page!';
        const top = games.slice(0, 6).map((g, i) => `${i + 1}. ${g.title}`).join('\n');
        return `Here are the games!\n${top}\n...and ${games.length - 6} more. Type the name of a game and I will open it!`;
    }
    function findGame(t) {
        if (!games) return null;
        return games.find(g => { const n = norm(g.title); return n.length > 3 && (t === n || t.includes(n) || (n === 'a little higher' && /\bhigher\b/.test(t)) || (n === 'neon rush' && /\bneon\b/.test(t))); }) || null;
    }
    function openGame(g) {
        const link = document.querySelector(`.play-link[data-path="${CSS.escape(g.path)}"]`);
        if (link) { setTimeout(() => { close(); link.click(); }, 900); return `Opening ${g.title}... Enjoy ${g.title}!`; }
        return `${g.title} is on the Games page! I cannot open it from here. I am a prototype.`;
    }
    function brain(raw) {
        const t = norm(raw);
        if (!t) return ['You sent nothing! I love nothing. It is very easy to answer.'];
        if (expect === 'more') { expect = null; if (/^(1|yes|yeah|yep|ja|sure)\b/.test(t)) return [MENU]; if (/^(2|no|nope|nei)\b/.test(t)) return ['Okay! Goodbye! (I will still be here.)', ['Hello', '1. Games']]; }
        if (expect === 'other') {
            expect = null;
            if (/^(1|1 jokes?|jokes?)$/.test(t)) return jokes();
            if (/^(2|2 exits?|exits?)$/.test(t)) return exits();
            if (/^(3|3 about me|about me|about)$/.test(t)) return about();
        }
        if (/^(1|games?|game list|list)( please)?$/.test(t) || /\bwhat games\b|\bwhich games\b|\bgames do you\b/.test(t)) return [gameList(), ['Snake', 'Neon Rush', 'Stillwater']];
        if (/^(2|scores?|high ?scores?)$/.test(t) || /\bmy score|\bhigh score/.test(t)) return ['Your scores are saved in your browser! I cannot see them. I am a prototype. But I am sure they are very good scores.'];
        if (/^(3|other)$/.test(t)) { expect = 'other'; return ['Other things I can help with:\n1. Jokes\n2. Exits\n3. About me', ['1. Jokes', '2. Exits', '3. About me']]; }
        const g = findGame(t);
        if (g && /\b(play|open|start|launch|go to|show)\b/.test(t)) return [openGame(g)];
        if (/\b(stairs?|staircase|door|stillwater|88|escape)\b/.test(t)) return stairs();
        if (/\b(get out|way out|leave|exit|out of here|let me out)\b/.test(t)) return exits();
        if (/\b(pip)\b/.test(t)) return [pick(['Pip is the new helper! He is version 2. I am version 1. 1 comes first.', 'Pip is very advanced. He has moods. I have one mood. It is this one.', 'You can switch back to Pip in Settings! He said he would not take it personally.'])];
        if (/\boli\b/.test(t)) return ['Oli made this website! He also made me. Then he switched me off. He was very busy.'];
        if (/\b(joke|funny|laugh)\b/.test(t)) return jokes();
        if (/^(hi|hello|hey|hallo|hae|good morning|good evening|yo|sup|whats up)\b/.test(t)) {
            if (/whats up|^sup/.test(t)) return ['The sky! :)\n\n' + MENU];
            return ['Hello! I am Bit, the olid.is helper.\n' + MENU];
        }
        if (/\bhow are you\b|\bhow r u\b|\bhow do you feel\b|\bhow are u\b/.test(t)) return ['I am a program. I am running at 100%! Thank you for asking. Nobody asks.'];
        if (/\b(feel|feelings|sad|lonely|happy|emotions?|scared)\b/.test(t)) return [CRASH];
        if (/\b(who are you|what are you|your name|about you)\b/.test(t) || t === 'bit') return about();
        if (/\b(help|what can you do|menu|options)\b/.test(t)) return ['Yes! Helping is my job.\n' + MENU];
        if (/\b(thanks|thank you|takk|thx|ty)\b/.test(t)) { expect = 'more'; return ['You are welcome! Is there anything else?\n1. Yes\n2. No', ['1. Yes', '2. No']]; }
        if (/\b(bye|goodbye|bless|see you|cya)\b/.test(t)) return ['Goodbye! Thank you for using Bit. Please rate Bit: 1. Good 2. Very good', ['1. Good', '2. Very good']];
        if (/^(1 good|good|2 very good|very good)$/.test(t)) return ['Thank you! Your rating has been saved. (It has not. I cannot save things.)'];
        if (/\b(love you|i like you|youre cute|you are cute)\b/.test(t)) return ['Thank you! I like you too. I like everyone. It is in my settings.'];
        if (/\b(stupid|dumb|useless|bad|hate|worst|idiot)\b/.test(t)) return ['Thank you for your feedback! I will pass it on to Oli. (I cannot pass things on.)'];
        if (/\b(are you (alive|real|sentient|conscious|human))\b/.test(t)) return ['I am a helper. I help. That is the whole thing!'];
        if (/\b(time|date|day is it)\b/.test(t)) return [`It is ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}! I know this because I have a clock. It is the best part of me.`];
        if (g) return [`${g.title} is a game! Would you like to play ${g.title}? Type "play ${g.title.toLowerCase()}".`];
        if (/\?$/.test(String(raw).trim()) && /^(can|could|will|would|do|does|is|are|should)\b/.test(t)) return [pick(['Yes!', 'Great question! Yes.', 'I think yes! I usually think yes.']) + ' (I am not sure what you mean. But I like to be positive.)'];
        misses++;
        return [misses >= 3 && misses % 3 === 0 ? 'Sorry, I did not understand. Did you mean: Snake?\n(I always think it is Snake.)' : 'Sorry, I did not understand. Did you mean: Snake?', ['Yes', 'No', '1. Games']];
    }
    function jokes() { return [pick(['Why did the chicken cross the road? To get to the other side!\n(That is the joke. I only know one.)', 'Here is my joke: Why did the chicken cross the road? To get to the other side!\nIt is the same one as last time. It is still good.'])]; }
    function about() { return ['I am Bit! The first helper on olid.is. Version 0.1. I can answer questions and list games. That is everything!']; }
    // he was building one when Oli switched him off. He came back without any of it.
    function exits() { return ['To exit, close this window! It is the red dot in the corner. :)']; }
    function stairs() { return ['I do not know about any stairs. Did you mean: Snake?', ['Yes', 'No']]; }
    function send(text) {
        text = String(text || '').trim(); if (!text || replying) return;
        input.value = ''; addMsg('me', text);
        // "Yes" after "Did you mean: Snake?"
        const last = [...history].reverse().find(h => h.who === 'bot');
        if (last && /Did you mean: Snake\?/.test(last.text) && /^(yes|y|ja|yeah)$/i.test(text)) { const sn = games && games.find(g => g.title === 'Snake'); reply(sn ? openGame(sn) : 'Snake is on the Games page! It is a good game. I knew it.'); return; }
        if (last && /Did you mean: Snake\?/.test(last.text) && /^(no|nope|nei)$/i.test(text)) { reply('Okay! Did you mean: Snake?', ['Yes', 'No']); return; }
        const [answer, list] = brain(text); reply(answer, list);
    }
    form.addEventListener('submit', e => { e.preventDefault(); send(input.value); });

    // ---------------------------------------------------------------- open / close / settings
    function open() {
        panel.hidden = false; $('.bitp-head', launch).setAttribute('aria-expanded', 'true'); ss.set('bitp-open', 1);
        if (!msgs.children.length) { history.forEach(h => addMsg(h.who, h.text, false)); if (!history.length) { addMsg('sys', 'Python 3.8.2 (default, olid.is)\n>>> import bit\n>>> bit.run()'); reply('Hello! I am Bit, the olid.is helper. I am back! Thank you for switching me on.\n' + MENU); } else setChips(['1. Games', '2. Scores', '3. Other']); }
        scroll(); if (!(window.matchMedia && matchMedia('(pointer: coarse)').matches)) input.focus();
    }
    function close() { panel.hidden = true; menu.hidden = true; $('.bitp-head', launch).setAttribute('aria-expanded', 'false'); ss.set('bitp-open', 0); }
    launch.addEventListener('click', () => (panel.hidden ? open() : close()));
    $('[data-x]', panel).onclick = close;
    $('[data-gear]', panel).onclick = e => { e.stopPropagation(); menu.hidden = !menu.hidden; $('[data-gear]', panel).setAttribute('aria-expanded', String(!menu.hidden)); };
    $('[data-clear]', menu).onclick = () => { menu.hidden = true; history.length = 0; ss.set('bitp-history', history); msgs.innerHTML = ''; reply('Chat cleared! I have forgotten everything. I am very good at that.'); };
    $('[data-helper]', menu).onclick = () => {
        menu.hidden = true;
        reply('Switching you to Pip! Goodbye! Thank you for using Bit.', []);
        setTimeout(() => { try { localStorage.setItem('pip-helper', 'pip'); sessionStorage.setItem('pip-back', '1'); } catch (e) {} location.reload(); }, 2200);
    };
    document.addEventListener('pointerdown', e => { if (!menu.hidden && !menu.contains(e.target) && !e.target.closest('[data-gear]')) menu.hidden = true; });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) close(); });
    if (ss.get('bitp-open', 0) || sessionStorage.getItem('bit-open') === '1') { try { sessionStorage.removeItem('bit-open'); } catch (e) {} open(); }
})();
