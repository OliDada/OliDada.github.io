// =====================================================================================
//  pyterm.js — runs Oli's old Python programs in a terminal window, in the browser
// =====================================================================================
//  Python is Pyodide (real CPython compiled to WebAssembly), loaded from the jsDelivr CDN the
//  first time a program runs (~10 MB, cached after that).
//
//  The programs are the original .py files, unchanged. The browser can't stop and wait the way
//  input() does in a real terminal, so before running, the program is rewritten on the fly
//  (with Python's own ast module): input() becomes "await" an answer from the terminal, and every
//  function that ends up calling input() becomes async. os.system("clear") clears the terminal.
//
//  PyTerm.run(file, title)   run backstage/python/<file>
//  PyTerm.show(file, title)  just show the code (cat)
// =====================================================================================
(function () {
    'use strict';
    const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
    const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

    const css = document.createElement('style');
    css.textContent = `
    .pyt-back { position: fixed; inset: 0; z-index: 1300; background: rgba(10, 10, 14, .55); display: grid; place-items: center; padding: 16px; }
    .pyt { width: min(820px, 100%); height: min(620px, calc(100vh - 32px)); display: flex; flex-direction: column; background: #0c0c0c; border-radius: 10px; overflow: hidden; box-shadow: 0 18px 60px rgba(0,0,0,.5); border: 1px solid #333; }
    .pyt-bar { display: flex; align-items: center; gap: 8px; padding: 9px 12px; background: #2a2a2c; color: #bdbdbd; font: 500 13px/1 -apple-system, system-ui, sans-serif; user-select: none; }
    .pyt-dots { display: flex; gap: 7px; } .pyt-dots i { width: 12px; height: 12px; border-radius: 50%; display: block; }
    .pyt-dots i:nth-child(1) { background: #ff5f57; cursor: pointer; } .pyt-dots i:nth-child(2) { background: #febc2e; } .pyt-dots i:nth-child(3) { background: #28c840; }
    .pyt-title { flex: 1; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .pyt-bar button { background: #3a3a3d; color: #ddd; border: 0; border-radius: 5px; padding: 5px 10px; font: 600 12px -apple-system, system-ui, sans-serif; cursor: pointer; }
    .pyt-bar button:hover { background: #4a4a4e; }
    .pyt-out { flex: 1; overflow: auto; padding: 12px 14px 18px; margin: 0; color: #d4d4d4; font: 400 14.5px/1.42 'JetBrains Mono', 'SF Mono', Menlo, Consolas, 'Courier New', monospace; white-space: pre-wrap; overflow-wrap: anywhere; cursor: text; -webkit-text-size-adjust: 100%; }
    .pyt-out .dim { color: #7c7c7c; } .pyt-out .err { color: #ff6b68; } .pyt-out .me { color: #fff; } .pyt-out .cmd { color: #8be28b; }
    .pyt-in { background: transparent; border: 0; outline: none; color: #fff; font: inherit; padding: 0; margin: 0; caret-color: transparent; width: 1ch; min-width: 1ch; }
    .pyt-caret { display: inline-block; width: .6em; height: 1.15em; vertical-align: -.2em; background: #d4d4d4; animation: pytblink 1.05s steps(1) infinite; }
    @keyframes pytblink { 50% { opacity: 0; } }
    @media (max-width: 700px) { .pyt-back { padding: 0; } .pyt { height: 100%; border-radius: 0; } .pyt-out { font-size: 12px; padding: 10px 10px 18px; } .pyt-pad { display: grid !important; } }
    .pyt.game .pyt-out { flex: none; height: 92px; border-top: 1px solid #222; font-size: 12px; padding: 8px 12px; }
    .pyt-screen { flex: 1; min-height: 0; display: grid; place-items: center; background: #000; position: relative; }
    .pyt-screen canvas { position: absolute; inset: 0; margin: auto; max-width: 100%; max-height: 100%; width: auto !important; height: auto !important; image-rendering: pixelated; outline: none; display: block; }
    .pyt-hint { position: absolute; left: 10px; top: 8px; color: #7c7c7c; font: 500 12px 'JetBrains Mono', Menlo, monospace; pointer-events: none; }
    .pyt-pad { display: none; position: absolute; right: 12px; bottom: 12px; grid-template-columns: repeat(3, 48px); grid-template-rows: repeat(2, 48px); gap: 6px; }
    .pyt-pad button { border: 1px solid #555; background: rgba(40,40,44,.85); color: #ddd; border-radius: 8px; font-size: 20px; touch-action: none; user-select: none; -webkit-user-select: none; }
    .pyt-pad [data-k="ArrowUp"] { grid-column: 2; grid-row: 1; } .pyt-pad [data-k="ArrowLeft"] { grid-column: 1; grid-row: 2; } .pyt-pad [data-k="ArrowDown"] { grid-column: 2; grid-row: 2; } .pyt-pad [data-k="ArrowRight"] { grid-column: 3; grid-row: 2; }
    @media (hover: none) and (pointer: coarse) { .pyt-pad { display: grid; } }
    @media (prefers-reduced-motion: reduce) { .pyt-caret { animation: none; } }`;
    document.head.append(css);

    let pyodide = null, loading = null, win = null, out = null, pending = null, runId = 0;
    const host = () => (location.host || 'olid.is').split(':')[0];

    function write(text, cls) {
        if (!out) return;
        const line = out.querySelector('.pyt-line'); // the input line stays last
        const span = document.createElement('span'); if (cls) span.className = cls; span.textContent = text;
        out.insertBefore(span, line);
        out.scrollTop = out.scrollHeight;
    }
    function clear() { if (!out) return; [...out.childNodes].forEach(n => { if (!n.classList || !n.classList.contains('pyt-line')) n.remove(); }); }
    // a line to type into, at the end of the output (after the prompt input() just printed)
    const STOP = '\u0000pyterm-stop';
    function readline() {
        if (!out) return new Promise(() => {}); // window closed: the program just stays paused, harmlessly
        return new Promise((resolve, reject) => {
            const line = out.querySelector('.pyt-line'), inp = line.querySelector('input');
            line.hidden = false; inp.value = ''; inp.style.width = '1ch';
            pending = { resolve, reject };
            setTimeout(() => inp.focus({ preventScroll: false }), 0);
            out.scrollTop = out.scrollHeight;
        });
    }
    function open(title, game) {
        close();
        const back = document.createElement('div'); back.className = 'pyt-back';
        back.innerHTML = `<div class="pyt" role="dialog" aria-label="${esc(title)}"><div class="pyt-bar"><span class="pyt-dots"><i title="Close"></i><i></i><i></i></span><span class="pyt-title">${esc(title)}</span><button type="button" data-again hidden>Run again</button><button type="button" data-close>Close</button></div>
            ${game ? '<div class="pyt-screen"><span class="pyt-hint">' + (matchMedia('(pointer: coarse)').matches ? 'use the arrow buttons' : 'click the game, then use the arrow keys') + '</span><div class="pyt-pad" aria-hidden="true"><button type="button" data-k="ArrowUp">▲</button><button type="button" data-k="ArrowLeft">◀</button><button type="button" data-k="ArrowDown">▼</button><button type="button" data-k="ArrowRight">▶</button></div></div>' : ''}<pre class="pyt-out" tabindex="0"><span class="pyt-line" hidden><input class="pyt-in" aria-label="Type here" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="send"><span class="pyt-caret"></span></span></pre></div>`;
        document.body.append(back);
        win = back; out = back.querySelector('.pyt-out');
        if (game) {
            back.querySelector('.pyt').classList.add('game');
            const scr = back.querySelector('.pyt-screen'); scr.prepend(canvas());
            // on phones: arrow buttons that send the same key presses a keyboard would
            const KC = { ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39 };
            const key = (type, k) => { const ev = new KeyboardEvent(type, { key: k, code: k, keyCode: KC[k], which: KC[k], bubbles: true }); window.dispatchEvent(ev); document.dispatchEvent(ev); };
            scr.querySelectorAll('.pyt-pad button').forEach(b => {
                b.addEventListener('pointerdown', e => { e.preventDefault(); key('keydown', b.dataset.k); });
                ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => b.addEventListener(t, () => key('keyup', b.dataset.k)));
            });
            scr.addEventListener('pointerdown', () => { const c = scr.querySelector('canvas'); c && c.focus(); const h = scr.querySelector('.pyt-hint'); if (h) h.remove(); });
        }
        const inp = out.querySelector('input');
        inp.addEventListener('input', () => { inp.style.width = Math.max(1, inp.value.length + .2) + 'ch'; });
        inp.addEventListener('keydown', e => {
            if (e.key === 'Enter' && pending) {
                e.preventDefault();
                const v = inp.value, p = pending; pending = null;
                out.querySelector('.pyt-line').hidden = true;
                write(v + '\n', 'me'); p.resolve(v);
            }
            if (e.key === 'c' && e.ctrlKey && pending) { const p = pending; pending = null; out.querySelector('.pyt-line').hidden = true; write('^C\n'); p.resolve(STOP); }
        });
        out.addEventListener('click', () => { if (pending && !getSelection().toString()) inp.focus(); });
        back.querySelector('[data-close]').onclick = close;
        back.querySelector('.pyt-dots i').onclick = close;
        back.addEventListener('click', e => { if (e.target === back) close(); });
        document.addEventListener('keydown', escClose);
        return back;
    }
    // one canvas for pygame, reused between runs (SDL keeps hold of it)
    let cv = null;
    function canvas() { if (!cv) { cv = document.createElement('canvas'); cv.id = 'canvas'; cv.tabIndex = 0; cv.width = 640; cv.height = 480; cv.addEventListener('contextmenu', e => e.preventDefault()); } return cv; }
    function escClose(e) { if (e.key === 'Escape' && win) close(); }
    function close() {
        runId++;
        pending = null; // a program waiting for input stays paused forever (closing it is like closing the terminal)
        if (win) win.remove(); win = null; out = null;
        document.removeEventListener('keydown', escClose);
    }

    const HELPER = `
import ast, asyncio, os, sys, js, time, inspect
_token = [0]
_last = {}

def _prep(src, filename):
    tree = ast.parse(src, filename)
    funcs = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            funcs.setdefault(node.name, []).append(node)
    def called(fn):
        names = set()
        for n in ast.walk(fn):
            if isinstance(n, ast.Call):
                if isinstance(n.func, ast.Name): names.add(n.func.id)
                elif isinstance(n.func, ast.Attribute): names.add(n.func.attr)
        return names
    wait = {'input', 'tick'}
    changed = True
    while changed:
        changed = False
        for name, nodes in funcs.items():
            if name in wait or name.startswith('__'): continue
            if any(called(n) & wait for n in nodes):
                wait.add(name); changed = True
    class T(ast.NodeTransformer):
        def visit_FunctionDef(self, node):
            self.generic_visit(node)
            if node.name in wait:
                new = ast.AsyncFunctionDef(**{f: getattr(node, f, None) for f in ast.AsyncFunctionDef._fields})
                return ast.copy_location(new, node)
            return node
        def visit_Call(self, node):
            self.generic_visit(node)
            f = node.func
            if isinstance(f, ast.Name) and f.id == 'input':
                node.func = ast.copy_location(ast.Name('pyterm_input', ast.Load()), f)
                return ast.copy_location(ast.Await(node), node)
            # clock.tick(fps): wait for the next frame without freezing the page
            if isinstance(f, ast.Attribute) and f.attr == 'tick':
                new = ast.Call(func=ast.Name('pyterm_tick', ast.Load()), args=[f.value] + node.args, keywords=node.keywords)
                return ast.copy_location(ast.Await(ast.copy_location(new, node)), node)
            name = f.id if isinstance(f, ast.Name) else f.attr if isinstance(f, ast.Attribute) else None
            if name in wait:
                # one of the program's own functions that now waits; other things with the same name just return
                new = ast.Call(func=ast.Name('pyterm_maybe', ast.Load()), args=[node], keywords=[])
                return ast.copy_location(ast.Await(ast.copy_location(new, node)), node)
            return node
    tree = ast.fix_missing_locations(T().visit(tree))
    return compile(tree, filename, 'exec', flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)

class _Stop(Exception):
    pass

async def pyterm_input(prompt=''):
    if prompt:
        sys.stdout.write(str(prompt)); sys.stdout.flush()
    v = str(await js.PyTerm._readline())
    if v == '\\x00pyterm-stop':
        raise _Stop()
    return v

async def pyterm_maybe(v):
    if inspect.isawaitable(v):
        return await v
    return v

async def pyterm_tick(clock, fps=0, *a):
    if not js.PyTerm._alive(_token[0]):
        raise _Stop()
    now = time.perf_counter()
    delay = (1.0 / fps - (now - _last.get(id(clock), now))) if fps else 0
    await asyncio.sleep(delay if delay > 0 else 0)
    _last[id(clock)] = time.perf_counter()
    return clock.tick()

def _system(cmd):
    if 'clear' in str(cmd) or 'cls' in str(cmd):
        sys.stdout.flush(); js.PyTerm._clear()
    return 0
os.system = _system

async def _run(src, filename, cwd, token):
    _token[0] = token
    os.makedirs(cwd, exist_ok=True)
    os.chdir(cwd)
    sys.path.insert(0, cwd)
    for m in list(sys.modules):  # a program's own modules are loaded fresh every run
        f = getattr(sys.modules[m], '__file__', None) or ''
        if f.startswith('/home/pyodide/py/'):
            del sys.modules[m]
    g = {'__name__': '__main__', '__file__': filename, 'pyterm_input': pyterm_input, 'pyterm_tick': pyterm_tick, 'pyterm_maybe': pyterm_maybe}
    try:
        res = eval(_prep(src, filename), g)
        if asyncio.iscoroutine(res):
            await res
    finally:
        if 'pygame' in sys.modules:
            try:
                sys.modules['pygame'].quit()
            except Exception:
                pass
        if cwd in sys.path:
            sys.path.remove(cwd)
`;
    function load() {
        if (loading) return loading;
        loading = new Promise((resolve, reject) => {
            const sc = document.createElement('script'); sc.src = PYODIDE + 'pyodide.js';
            sc.onload = async () => {
                try {
                    pyodide = await window.loadPyodide({ indexURL: PYODIDE });
                    const dec = new TextDecoder();
                    pyodide.setStdout({ write: buf => { write(dec.decode(buf, { stream: true })); return buf.length; } });
                    pyodide.setStderr({ write: buf => { write(dec.decode(buf, { stream: true }), 'err'); return buf.length; } });
                    await pyodide.runPythonAsync(HELPER);
                    resolve(pyodide);
                } catch (e) { loading = null; reject(e); }
            };
            sc.onerror = () => { loading = null; reject(new Error('Could not download Python.')); };
            document.head.append(sc);
        });
        return loading;
    }
    const url = file => '/backstage/python/' + file.split('/').map(encodeURIComponent).join('/');
    const fetchSrc = file => fetch(url(file)).then(r => { if (!r.ok) throw new Error('No such file: ' + file); return r.text(); });

    // prog: 'calc.py', or { main: 'mario/mario3.py', files: ['mario/scripts/utils.py', 'mario/images/block.png', ...], pygame: true }
    async function run(prog, title) {
        const P = typeof prog === 'string' ? { main: prog } : prog;
        const file = P.main, dir = file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : '', base = file.slice(file.lastIndexOf('/') + 1);
        const back = open(title || ('python3 ' + base), P.pygame), id = ++runId;
        const again = back.querySelector('[data-again]');
        again.onclick = () => run(prog, title);
        write(`oli@${host()} ${dir || 'backstage'} % `, 'cmd'); write(`python3 ${base}\n`);
        let src;
        try { src = await fetchSrc(file); } catch (e) { write(String(e.message) + '\n', 'err'); return; }
        if (!pyodide) write('Starting Python (first time takes a few seconds)...\n', 'dim');
        try { await load(); } catch (e) { if (id === runId) write('Python could not start: ' + e.message + '\n', 'err'); return; }
        if (id !== runId) return;
        const cwd = '/home/pyodide/py/' + (dir || 'main');
        try {
            if (P.pygame) { write('Loading pygame...\n', 'dim'); await pyodide.loadPackage('pygame-ce', { messageCallback: () => {}, errorCallback: () => {} }); pyodide.canvas.setCanvas2D(canvas()); }
            // the program's other files (modules, images) go where it expects them, next to it
            for (const f of P.files || []) {
                const rel = dir ? f.slice(dir.length + 1) : f, path = cwd + '/' + rel;
                const buf = new Uint8Array(await (await fetch(url(f))).arrayBuffer());
                pyodide.FS.mkdirTree(path.slice(0, path.lastIndexOf('/'))); pyodide.FS.writeFile(path, buf);
            }
        } catch (e) { if (id === runId) write('Could not load the program: ' + e.message + '\n', 'err'); return; }
        if (id !== runId) return;
        if (out && out.querySelector('.dim')) { out.querySelectorAll('.dim').forEach(n => n.remove()); }
        try {
            pyodide.globals.set('_src', src); pyodide.globals.set('_fn', base); pyodide.globals.set('_cwd', cwd); pyodide.globals.set('_tok', id);
            if (P.pygame) setTimeout(() => { const c = canvas(); if (win === back) c.focus(); }, 300);
            await pyodide.runPythonAsync('await _run(_src, _fn, _cwd, _tok)');
            if (id === runId) write('\n[Process completed]\n', 'dim');
        } catch (e) {
            if (id !== runId) return;
            const msg = String(e && e.message || e); if (/[?&]piptest/.test(location.search)) console.log('PYTERM', msg);
            if (/_Stop|KeyboardInterrupt/.test(msg)) write('\nKeyboardInterrupt\n', 'err');
            else if (/SystemExit/.test(msg)) write('\n[Process completed]\n', 'dim');
            else {
                // a normal-looking traceback, without the lines that are about the terminal itself
                const lines = msg.split('\n').filter(l => l && !/pyodide|_pyodide|<exec>|_run|pyterm_|File "\/lib|^\s*\^+\s*$/.test(l));
                write('\nTraceback (most recent call last):\n' + lines.filter(l => !/^Traceback/.test(l)).join('\n') + '\n', 'err');
            }
        } finally {
            if (win === back) again.hidden = false;
            try { pyodide.runPython('import sys; sys.stdout.flush(); sys.stderr.flush()'); } catch (e) {}
        }
    }
    async function show(file, title) {
        open(title || file);
        write(`oli@${host()} backstage % `, 'cmd'); write(`cat ${file}\n`);
        try { write(await fetchSrc(file)); write('\n'); } catch (e) { write(String(e.message) + '\n', 'err'); }
        out.scrollTop = 0;
    }
    window.PyTerm = { run, show, close, _readline: readline, _clear: clear, _load: load, _alive: tok => tok === runId && !!win };
})();
