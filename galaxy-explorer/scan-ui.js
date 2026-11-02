// The scan prompt (a ring around the crosshair, filling while you hold E, with what
// you are aiming at underneath) and the card that shows what you found. Plain DOM;
// game.js decides what is aimed at, when a scan runs and what it counted toward.
//
//   const ui = createScanUI({ touch });
//   ui.prompt({ title, known } | null, progress)   every frame
//   ui.card({ eyebrow, title, lede, facts, tags, footer: { text, ready } })
//   ui.flash()                                      a scan completed
//   ui.hideCard()
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

export function createScanUI({ touch = false } = {}) {
    const prompt = el("div", "scan-prompt");
    prompt.setAttribute("aria-hidden", "true");
    const ring = el("i", "scan-ring"), text = el("div", "scan-text"), title = el("strong"), action = el("span");
    text.append(title, action);
    prompt.append(ring, text);
    const card = el("aside", "scan-card");
    card.setAttribute("role", "status");
    card.hidden = true;
    document.getElementById("hud").append(prompt, card);
    let hideTimer = 0, shown = { key: null, p: null };
    const actionText = (known, scanning) => known
        ? (touch ? "Recorded · tap Details" : "Recorded · E for details")
        : scanning ? "Scanning…" : touch ? "Hold Scan to scan" : "Hold E to scan";
    const setAction = (known, scanning) => {
        action.replaceChildren();
        const words = actionText(known, scanning);
        const m = !touch && /^(.*?)\bE\b(.*)$/.exec(words);
        if (m) action.append(m[1], el("kbd", null, "E"), m[2]); else action.append(words);
    };

    return {
        prompt(target, progress = 0) {
            if (!target) {
                if (shown.key !== null) { prompt.classList.remove("visible"); shown.key = null; }
                return;
            }
            const scanning = progress > 0.001;
            const key = `${target.title}|${target.known}|${scanning}`;
            if (key !== shown.key) {
                shown.key = key;
                title.textContent = target.title;
                setAction(target.known, scanning);
                prompt.classList.toggle("known", !!target.known);
                prompt.classList.add("visible");
            }
            const p = Math.round(progress * 100);
            if (p !== shown.p) { shown.p = p; ring.style.setProperty("--p", `${p}%`); prompt.classList.toggle("scanning", scanning); }
        },
        flash() {
            prompt.classList.remove("done");
            void prompt.offsetWidth; // restart the animation
            prompt.classList.add("done");
        },
        card({ eyebrow, title: name, lede, facts = [], tags = [], footer }) {
            const close = el("button", "scan-close", "×");
            close.setAttribute("aria-label", "Close");
            close.onclick = () => this.hideCard();
            const tagRow = el("div", "scan-tags");
            for (const t of tags) tagRow.append(el("span", t.tone ? `tone-${t.tone}` : "", t.text));
            const dl = el("dl");
            for (const [k, v] of facts) dl.append(el("dt", null, k), el("dd", null, v));
            const foot = footer ? el("div", `scan-foot${footer.ready ? " ready" : ""}`, footer.text) : null;
            card.replaceChildren(close, el("div", "scan-eyebrow", eyebrow), el("h3", null, name), ...(tags.length ? [tagRow] : []), el("p", "scan-lede", lede), dl, ...(foot ? [foot] : []));
            card.hidden = false;
            card.classList.remove("in");
            void card.offsetWidth;
            card.classList.add("in");
            clearTimeout(hideTimer);
            hideTimer = setTimeout(() => this.hideCard(), 14000);
        },
        hideCard() {
            clearTimeout(hideTimer);
            card.classList.remove("in");
            hideTimer = setTimeout(() => (card.hidden = true), 250);
        },
        get cardOpen() { return !card.hidden; },
    };
}
