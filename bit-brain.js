// Bit's brain: asks the pip-brain Worker to answer as Bit (his personality lives in the Worker).
// Used by Bit on Oli's backstage page and by Bit in the corner (bit-proto.js). If it fails, they fall back to scripted lines.
(function () {
    if (window.BitBrain) return;
    const URL = 'https://pip-brain.olafurdadason.workers.dev';
    let fails = 0;
    window.BitBrain = {
        on: () => fails < 3 && !/[?&]nobrain\b/.test(location.search),
        // history: [{ who: 'me' | 'bit', text }], context: a few lines about what's going on
        ask(history, context) {
            const msgs = history.slice(-10).map(h => ({ role: h.who === 'me' ? 'user' : 'assistant', content: String(h.text || '') })).filter(m => m.content);
            if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return Promise.resolve(null);
            let anon = '', site = ''; try { anon = localStorage.getItem('pip-anon') || ''; } catch (e) {}
            try { site = window.Pip && Pip.siteText ? Pip.siteText() : ''; } catch (e) {}
            const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 9000);
            return fetch(URL, { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ who: 'bit', id: anon, site, context: context || '', messages: msgs }) })
                .then(r => r.json())
                .then(j => {
                    clearTimeout(timer);
                    if (!j || !j.reply) { fails++; return null; }
                    fails = 0;
                    const reply = String(j.reply).replace(/\[m:\w+\]|\[p+\]|\[-\d+\]|\{\{[^}]*\}\}|\*\*?|`/g, '').replace(/[ \t]+/g, ' ').trim();
                    return reply ? { reply, suggestions: (Array.isArray(j.suggestions) ? j.suggestions : []).slice(0, 3) } : null;
                })
                .catch(() => { clearTimeout(timer); fails++; return null; });
        }
    };
})();
