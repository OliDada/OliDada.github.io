/* Pip's maze: breadth-first search over the board as it exists now. No hidden escape. */
(function () {
  'use strict';
  function findPath(width, height, walls, start, goal) {
    const previous = new Int16Array(width * height).fill(-1), visited = new Set();
    if (walls.has(start) || walls.has(goal)) return { path: [], visited };
    const queue = [start]; previous[start] = start; visited.add(start);
    for (let head = 0; head < queue.length; head++) {
      const at = queue[head]; if (at === goal) break;
      const x = at % width, y = Math.floor(at / width);
      for (const [dx, dy] of [[1, 0], [0, -1], [0, 1], [-1, 0]]) {
        const nx = x + dx, ny = y + dy, next = ny * width + nx;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height || walls.has(next) || visited.has(next)) continue;
        previous[next] = at; visited.add(next); queue.push(next);
      }
    }
    if (!visited.has(goal)) return { path: [], visited };
    const path = [goal]; while (path[path.length - 1] !== start) path.push(previous[path[path.length - 1]]);
    return { path: path.reverse(), visited };
  }
  if (typeof module !== 'undefined' && module.exports) { module.exports = { findPath }; return; }
  const $ = s => document.querySelector(s), board = $('#trapBoard');
  if (!board) return;
  const W = 11, START = 55, GOAL = 65, walls = new Set();
  let position = START, route = [], explored = new Set(), running = false, won = false, reroutes = 0, escapes = 0;
  let drawing = false, erase = false, stroke = new Set(), previousCell = null, focusIndex = START, lastMove = 0, spokenBlocked = false;
  let face = '●', speechToken = 0;
  const cells = Array.from({ length: W * W }, (_, i) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'trap-cell';
    button.dataset.cell = i; button.tabIndex = i === focusIndex ? 0 : -1; board.append(button); return button;
  });
  function speak(text) {
    const token = ++speechToken, el = $('#trapComment'); el.textContent = '';
    let n = 0; const letter = () => { if (token !== speechToken) return; el.textContent = text.slice(0, ++n); if (n < text.length) setTimeout(letter, 24); }; letter();
  }
  function render() {
    const path = new Set(route.slice(1, -1));
    cells.forEach((button, i) => {
      const isPip = i === position, isGoal = i === GOAL;
      button.className = 'trap-cell' + (walls.has(i) ? ' wall' : isPip ? ' pip' : isGoal ? ' goal' : path.has(i) ? ' route' : explored.has(i) ? ' searched' : '');
      button.innerHTML = isPip ? face : isGoal ? '◇' : '';
      button.setAttribute('aria-label', `Row ${Math.floor(i / W) + 1}, column ${i % W + 1}: ${isPip ? 'Pip' : isGoal ? 'exit' : walls.has(i) ? 'wall' : i === START ? 'start' : path.has(i) ? 'route' : 'empty'}`);
      button.setAttribute('aria-pressed', String(walls.has(i)));
    });
    $('#trapDistance').textContent = route.length ? route.length - 1 : '—';
    $('#trapReroutes').textContent = reroutes; $('#trapEscapes').textContent = escapes;
    const status = won ? 'Exit reached. Your walls are still here for another attempt.' : !route.length ? 'No route. Erase a wall to give him a way through.' : running ? 'Moving. You can still change the walls.' : 'Route ready. Draw walls, then let Pip move.';
    if ($('#trapStatus').textContent !== status) $('#trapStatus').textContent = status;
    $('#trapRun').textContent = won ? 'Try again' : running ? 'Pause Pip' : 'Let Pip move';
  }
  function solve(wallChange = false) {
    const old = route.join(','), result = findPath(W, W, walls, position, GOAL);
    route = result.path; explored = result.visited;
    if (wallChange && old !== route.join(',')) reroutes++;
    if (!route.length && !spokenBlocked) { spokenBlocked = true; speak("You've removed the solution. Different achievement."); }
    render();
  }
  function paint(i) {
    if (i === null || stroke.has(i) || i === position || i === GOAL || i === START || won) return;
    stroke.add(i);
    if (erase ? !walls.has(i) : walls.has(i)) return;
    if (erase) walls.delete(i); else walls.add(i);
    solve(true);
  }
  function cellAt(e) {
    const rect = board.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX >= rect.right || e.clientY < rect.top || e.clientY >= rect.bottom) return null;
    const cell = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-cell]');
    return cell && board.contains(cell) ? Number(cell.dataset.cell) : null;
  }
  // Fill skipped squares during fast swipes, so drawing a wall does not leave accidental gaps.
  function strokeTo(i) {
    if (i === null) { previousCell = null; return; }
    if (previousCell === null) paint(i);
    else {
      let x = previousCell % W, y = Math.floor(previousCell / W);
      const endX = i % W, endY = Math.floor(i / W);
      while (x !== endX || y !== endY) {
        if (Math.abs(endX - x) >= Math.abs(endY - y) && x !== endX) x += Math.sign(endX - x);
        else y += Math.sign(endY - y);
        paint(y * W + x);
      }
    }
    previousCell = i;
  }
  board.addEventListener('pointerdown', e => {
    if (e.button !== 0 || won) return; e.preventDefault(); drawing = true; stroke.clear(); previousCell = null;
    board.setPointerCapture(e.pointerId); strokeTo(cellAt(e));
  });
  board.addEventListener('pointermove', e => { if (drawing) strokeTo(cellAt(e)); });
  const endStroke = () => { drawing = false; previousCell = null; stroke.clear(); };
  board.addEventListener('pointerup', endStroke); board.addEventListener('pointercancel', endStroke); board.addEventListener('lostpointercapture', endStroke);
  board.addEventListener('keydown', e => {
    const target = e.target.closest('[data-cell]'); if (!target) return;
    const i = Number(target.dataset.cell), delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -W, ArrowDown: W }[e.key];
    if (delta) {
      e.preventDefault(); let next = i + delta;
      if (next < 0 || next >= W * W || (Math.abs(delta) === 1 && Math.floor(next / W) !== Math.floor(i / W))) return;
      cells[focusIndex].tabIndex = -1; focusIndex = next; cells[next].tabIndex = 0; cells[next].focus();
    } else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); stroke.clear(); paint(i); stroke.clear(); }
  });
  // Native button activation from assistive technology has no pointerdown.
  board.addEventListener('click', e => { const t = e.target.closest('[data-cell]'); if (t && e.detail === 0) { stroke.clear(); paint(Number(t.dataset.cell)); stroke.clear(); } });
  function tool(value) { erase = value; $('#trapDraw').setAttribute('aria-pressed', String(!erase)); $('#trapErase').setAttribute('aria-pressed', String(erase)); $('#trapDraw').classList.toggle('on', !erase); $('#trapErase').classList.toggle('on', erase); }
  $('#trapDraw').addEventListener('click', () => tool(false)); $('#trapErase').addEventListener('click', () => tool(true));
  $('#trapRun').addEventListener('click', () => {
    if (won) { position = START; won = false; reroutes = 0; spokenBlocked = false; running = true; }
    else running = !running;
    lastMove = performance.now(); solve();
  });
  $('#trapReset').addEventListener('click', () => {
    endStroke(); walls.clear(); position = START; running = won = spokenBlocked = false; reroutes = 0; tool(false); solve();
    speak('A clean slate. I expect you have a plan this time.');
  });
  function advance(now) {
    // Hidden tabs and background windows never advance the game.
    if (document.hidden || !board.offsetParent || !running || !route.length || won) { lastMove = now; return; }
    if (now - lastMove < 550) return; lastMove = now;
    if (route.length > 1) position = route[1];
    if (position === GOAL) { running = false; won = true; escapes++; speak(reroutes ? 'You moved the walls. I updated the route. We both had a busy afternoon.' : 'I left my route on the screen. You had the same information I did.'); }
    solve();
  }
  setInterval(() => advance(performance.now()), 50);
  window.pipRoomGameBusy = () => { const r = board.getBoundingClientRect(); return !!board.offsetParent && (drawing || running || (r.bottom > 0 && r.top < innerHeight)); };
  solve();
  addEventListener('load', () => { face = window.Pip?.faceSVG('smug') || '●'; render(); });
  if (/[?&]piptest\b/.test(location.search)) window.__pipTrap = () => ({ position, goal: GOAL, walls: [...walls], route: [...route], running, won, reroutes, escapes });

  const retry = $('#gateTry'), result = $('#gateResult'), comment = $('#gateComment');
  const refusals = [
    "Still not human. I checked whether being considerably smarter would help. It didn't.",
    'It has one question. I have the wrong answer. This is apparently security.',
    'Oli did not anticipate artificial superintelligence. He copied a checkbox.'
  ];
  let attempt = 0, gateToken = 0;
  retry.addEventListener('click', () => {
    retry.disabled = true; result.textContent = 'Checking Pip…'; comment.textContent = '';
    setTimeout(() => {
      result.textContent = 'ACCESS DENIED · Still not human.';
      const line = refusals[attempt++ % refusals.length], token = ++gateToken; let n = 0;
      const type = () => { if (token !== gateToken) return; comment.textContent = line.slice(0, ++n); if (n < line.length) setTimeout(type, 24); else retry.disabled = false; }; type();
    }, 650);
  });
})();
