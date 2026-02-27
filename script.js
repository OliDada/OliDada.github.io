// Use relative path so pages in subfolders can resolve the background image
const originalBackground = "images/1.jpg";

// Helper: set UI surface CSS variables based on the active background value.
function updateUISurfaceForBackground(bgValue) {
    // Default: when the background is an image (url(...)) we use a translucent white overlay
    const isImage = typeof bgValue === 'string' && bgValue.trim().toLowerCase().startsWith('url(');
    const root = document.documentElement;
    if (isImage) {
        root.style.setProperty('--surface-bg', '#ffffff');
        root.style.setProperty('--surface-bg-trans', 'rgba(255,255,255,0.92)');
        root.style.setProperty('--surface-foreground', '#000000');
        return;
    }

    // If bgValue looks like a color (hex or rgb), compute a suitable surface color.
    // We'll convert short hex to full hex and then compute luminance to pick foreground.
    try {
        let col = bgValue ? bgValue.trim() : '';
        // handle rgb(...) by leaving it as-is and using CSS mix if available
        if (col.startsWith('#')) {
            // normalize 3-digit hex (#abc) to 6-digit
            if (col.length === 4) {
                col = '#' + col[1] + col[1] + col[2] + col[2] + col[3] + col[3];
            }
            // parse hex to rgb
            const r = parseInt(col.substr(1,2), 16);
            const g = parseInt(col.substr(3,2), 16);
            const b = parseInt(col.substr(5,2), 16);
            // compute relative luminance (approx)
            const lum = (0.2126*r + 0.7152*g + 0.0722*b) / 255;
            // choose surface color: if background is dark, use light surface and vice versa
            if (lum < 0.45) {
                // dark bg -> lighter surface: lighten the bg color towards white
                const sr = Math.min(255, Math.round(r + (255 - r) * 0.85));
                const sg = Math.min(255, Math.round(g + (255 - g) * 0.85));
                const sb = Math.min(255, Math.round(b + (255 - b) * 0.85));
                const surf = `rgb(${sr},${sg},${sb})`;
                root.style.setProperty('--surface-bg', surf);
                root.style.setProperty('--surface-bg-trans', `rgba(${sr},${sg},${sb},0.9)`);
                root.style.setProperty('--surface-foreground', '#000000');
            } else {
                // light bg -> darker surface: darken slightly
                const sr = Math.max(0, Math.round(r * 0.12));
                const sg = Math.max(0, Math.round(g * 0.12));
                const sb = Math.max(0, Math.round(b * 0.12));
                const surf = `rgb(${sr},${sg},${sb})`;
                root.style.setProperty('--surface-bg', surf);
                root.style.setProperty('--surface-bg-trans', `rgba(${sr},${sg},${sb},0.12)`);
                root.style.setProperty('--surface-foreground', '#ffffff');
            }
            return;
        }
        // fallback: if arbitrary string, use translucent white
        root.style.setProperty('--surface-bg', '#ffffff');
        root.style.setProperty('--surface-bg-trans', 'rgba(255,255,255,0.92)');
        root.style.setProperty('--surface-foreground', '#000000');
    } catch (e) {
        // If anything fails, keep defaults
        root.style.setProperty('--surface-bg', '#ffffff');
        root.style.setProperty('--surface-bg-trans', 'rgba(255,255,255,0.92)');
        root.style.setProperty('--surface-foreground', '#000000');
    }
}

function changeBackgroundColor() {
    const randomColor = "#" + Math.floor(Math.random() * 16777215).toString(16);

    // Set the random color as the background and remove the image
    setBackgroundColor(randomColor);
    // Update the CSS backing layer via a variable so it always fills the viewport
    document.documentElement.style.setProperty('--page-bg', randomColor);
    updateUISurfaceForBackground(randomColor);

    // Save the new background settings to localStorage
    localStorage.setItem("backgroundColor", randomColor);
    localStorage.setItem("backgroundImage", "none");
}

function revertToOriginalBackground() {
    // Reset to the original background image
    // restore the original image on both html and body
    // use full shorthand so the image covers and doesn't repeat
    const img = `url('${originalBackground}') center center / cover no-repeat`;
    // set the CSS backing layer to the image shorthand and clear inline backgrounds
    document.documentElement.style.setProperty('--page-bg', img);
    // When background is an image use translucent white surfaces
    updateUISurfaceForBackground(img);
    document.body.style.background = 'none';
    if (document.documentElement) document.documentElement.style.background = 'none';

    // Save the original background settings to localStorage
    localStorage.setItem("backgroundColor", "");
    localStorage.setItem("backgroundImage", `url('${originalBackground}')`);
}

function applySavedBackground() {
    // Retrieve saved background settings from localStorage
    const savedColor = localStorage.getItem("backgroundColor");
    const savedImage = localStorage.getItem("backgroundImage");

    // If there's a saved color, apply it via the CSS variable used by the backing layer
    if (savedColor) {
        document.documentElement.style.setProperty('--page-bg', savedColor);
        updateUISurfaceForBackground(savedColor);
        return;
    }

    // If there's a saved image and it references the site image, normalize and set the backing layer
    if (savedImage && savedImage.includes("images/1.jpg")) {
        const img = `url('${originalBackground}') center center / cover no-repeat`;
        document.documentElement.style.setProperty('--page-bg', img);
        updateUISurfaceForBackground(img);
        return;
    }

    // If there's an arbitrary saved image, set it on the backing layer
    if (savedImage) {
        document.documentElement.style.setProperty('--page-bg', savedImage);
        updateUISurfaceForBackground(savedImage);
        return;
    }

    // Fallback: set the default image on the backing layer
    const img = `url('${originalBackground}') center center / cover no-repeat`;
    document.documentElement.style.setProperty('--page-bg', img);
    updateUISurfaceForBackground(img);
}

function setBackgroundColor(color) {
    // Set both html and body inline styles (full shorthand) so they take precedence over stylesheet rules
    // Update the CSS backing variable so the pseudo-element shows the color/image correctly
    document.documentElement.style.setProperty('--page-bg', color);
    updateUISurfaceForBackground(color);
    
    // Save the selected color to localStorage
    localStorage.setItem("backgroundColor", color);
    localStorage.setItem("backgroundImage", "none");
}

// Apply the saved background when the page loads
applySavedBackground();


// ---------------- Arcade hub script additions ----------------

// Utility to fetch local JSON with project metadata
async function loadProjects() {
    try {
        // fetch relative to the current page so the JSON loads correctly
        // whether the page is at the site root or in a subfolder
        const res = await fetch('data/projects.json');
        if (!res.ok) throw new Error('Failed to load projects');
        return await res.json();
    } catch (err) {
        console.warn('Could not load projects.json', err);
        return [];
    }
}

// Render cabinet grid from data
async function renderCabinets() {
    const grid = document.getElementById('cabinetGrid');
    if (!grid) return;
    const projects = await loadProjects();
    grid.innerHTML = '';

    // Arrange projects so each row is: featured, featured, non-featured (when available)
    const featured = projects.filter(p => !!p.featured);
    const nonFeatured = projects.filter(p => !p.featured);

    const sequence = [];
    let fIdx = 0, nfIdx = 0;
    // Build rows: take up to 2 featured, then one non-featured
    while (fIdx < featured.length) {
        // push first featured
        sequence.push(featured[fIdx++]);
        // push second featured if available
        if (fIdx < featured.length) sequence.push(featured[fIdx++]);
        // then push one non-featured if available
        if (nfIdx < nonFeatured.length) sequence.push(nonFeatured[nfIdx++]);
    }
    // If there are remaining non-featured items, append them after the featured rows
    while (nfIdx < nonFeatured.length) {
        sequence.push(nonFeatured[nfIdx++]);
    }

    // Render in the computed sequence
    sequence.forEach(p => {
        const el = document.createElement('article');
        el.className = 'cabinet';
        if (p.featured) el.classList.add('featured');
        el.innerHTML = `
            <div class="screen">
                ${p.thumbnail ? `<img class="thumb" src="${p.thumbnail}" alt="${p.title} thumbnail">` : `<div class="placeholder"></div>`}
            </div>
            <div class="label">${p.title}</div>
            <div class="sub">${p.tags ? p.tags.join(', ') : ''}</div>
            <div class="controls">
                <a class="play" href="${p.path}" data-path="${p.path}" target="_blank" rel="noopener">Play</a>
            </div>
        `;
        grid.appendChild(el);
    });

    // Make Play embed the game in-page on normal left-click, but allow modifier clicks to open in new tab
    grid.querySelectorAll('.play').forEach(anchor => {
        anchor.addEventListener('click', async (e) => {
            // modifiers or middle-click -> allow default behavior (open in new tab)
            if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            // prefer an embed-specific path if the project defines one
            const datasetPath = anchor.getAttribute('data-path') || anchor.getAttribute('href');
            let path = datasetPath;
            let match = null;
            try {
                // find the corresponding project entry in the loaded data if available
                const projects = await loadProjects();
                match = projects.find(p => p.path === datasetPath || p.embed === datasetPath || p.title === anchor.closest('.cabinet')?.querySelector('.label')?.textContent);
                if (match && match.embed) path = match.embed;
            } catch (err) {
                // ignore and use datasetPath
            }
            // open in the in-page player
            const player = document.getElementById('playerArea');
            const frame = document.getElementById('playerFrameMain');
            const title = document.getElementById('playerTitle');
            const openNewTab = document.getElementById('openNewTab');
            if (player && frame) {
                player.style.display = 'block';
                player.setAttribute('aria-hidden', 'false');
                const aspectBox = document.getElementById('playerAspectBox');
                // set aspect based on project metadata if available
                if (match && match.aspect && aspectBox) {
                    aspectBox.setAttribute('data-aspect', match.aspect);
                    const parts = match.aspect.split(':').map(Number);
                    if (parts.length === 2 && parts[0] > 0) {
                        const paddingTop = (parts[1] / parts[0]) * 100;
                        aspectBox.style.paddingTop = paddingTop + '%';
                    }
                } else if (aspectBox) {
                    // fallback: reset to default 16:9 and attempt to probe iframe content later
                    aspectBox.setAttribute('data-aspect', '16:9');
                    aspectBox.style.paddingTop = '56.25%';
                }

                // reset any previous inline sizing applied by earlier games
                try {
                    frame.style.width = '';
                    frame.style.height = '';
                    frame.style.maxWidth = '';
                    frame.style.maxHeight = '';
                    // clear any positioning overrides applied when a previous game used playSize
                    frame.style.position = '';
                    frame.style.top = '';
                    frame.style.left = '';
                    frame.style.right = '';
                    frame.style.bottom = '';
                    if (aspectBox) {
                        aspectBox.style.height = '';
                        aspectBox.style.display = '';
                        aspectBox.style.justifyContent = '';
                        aspectBox.style.alignItems = '';
                        // clear any explicit width set for previous playSize
                        aspectBox.style.width = '';
                        aspectBox.style.maxWidth = '';
                    }
                } catch (e) {}

                // set iframe src to embed path
                try {
                    let embedPath = path;
                    // Heuristic: if the path points to a nested src/index.html, prefer the parent folder root
                    // e.g. /dungeon-crawler-game/src/index.html -> /dungeon-crawler-game/
                    try {
                        const lower = String(path).toLowerCase();
                        if (lower.includes('/src/index.html') || /\/src\/index\.html$/i.test(path)) {
                            embedPath = path.replace(/\/src\/index\.html$/i, '/');
                            embedPath = embedPath.replace(/\/index\.html$/i, '/');
                        }
                        // If the project references the Game of Life source, prefer the playable gol.html inside its folder
                        try {
                            if ((match && (match.title || '').toLowerCase().includes('game of life')) || String(path).toLowerCase().includes('game_of_life')) {
                                // prefer the internal gol.html which loads the game's script
                                embedPath = '/Game of Life/gol.html';
                            }
                            if (match && match.source && String(match.source).toLowerCase().includes('game_of_life.js')) {
                                embedPath = '/Game of Life/gol.html';
                            }
                        } catch (e) {}
                        // also handle patterns like /some/path/index.html where the file might be a raw HTML viewer
                        // prefer the directory if that file exists as an entry point
                    } catch (e) {}
                    if (embedPath !== path) console.info('Adjusted embed path from', path, 'to', embedPath);
                    frame.src = addEmbedParam(embedPath);
                } catch (e) {
                    frame.src = addEmbedParam(path);
                }

                // focus iframe so keyboard works immediately (added)
                try {
                    frame.tabIndex = -1;
                    frame.style.outline = 'none';
                    // focus as soon as it loads
                    const __focusOnLoad = () => {
                        requestAnimationFrame(() => focusIframeAndCanvas(frame));
                        frame.removeEventListener('load', __focusOnLoad);
                    };
                    frame.addEventListener('load', __focusOnLoad);
                    // also try immediately (user gesture)
                    requestAnimationFrame(() => focusIframeAndCanvas(frame));
                } catch (err) { /* best-effort, ignore */ }

                // Keep the player title static as 'Now playing' (do not append the game name)
                if (title) title.textContent = 'Now playing';
                if (openNewTab) openNewTab.href = path;

                // Per-game sizing overrides for embeds that don't report sizing
                try {
                    // If the project explicitly provides a playSize, use it first (pixel-perfect)
                    if (match && match.playSize && (match.playSize.width || match.playSize.height)) {
                        const w = Number(match.playSize.width) || '';
                        const h = Number(match.playSize.height) || '';
                        // ensure the iframe uses its inline width/height instead of being stretched by absolute positioning
                        frame.style.position = 'relative';
                        // clear any inset offsets that CSS may have applied for absolute positioning
                        frame.style.top = '';
                        frame.style.left = '';
                        frame.style.right = '';
                        frame.style.bottom = '';
                        if (w) frame.style.width = w + 'px';
                        if (h) frame.style.height = h + 'px';
                        frame.style.maxWidth = '100%';
                        frame.style.maxHeight = '80vh';
                        if (aspectBox) {
                            aspectBox.style.paddingTop = '0';
                            // set explicit pixel height so the surrounding player-area background shrinks to fit
                            if (h) {
                                aspectBox.style.height = h + 'px';
                            } else {
                                aspectBox.style.height = 'auto';
                            }
                            aspectBox.style.display = 'flex';
                            aspectBox.style.justifyContent = 'center';
                            aspectBox.style.alignItems = 'center';
                            // constrain the aspect box to the explicit width so it doesn't expand to the default max-width
                            if (w) {
                                aspectBox.style.width = w + 'px';
                                aspectBox.style.maxWidth = '100%';
                            }
                        }
                    } else {
                        // ensure default absolute positioning is used for aspect-box based sizing
                        frame.style.position = '';
                        const lookup = (match && (match.path || match.source || match.title)) || path || '';
                        const key = String(lookup).toLowerCase();
                        // Flappy Bird: portrait, keep reasonably small
                        if (key.includes('flappybird') || key.includes('flappy')) {
                            frame.style.width = '384px';
                            frame.style.height = '512px';
                            frame.style.maxWidth = '100%';
                            frame.style.maxHeight = '80vh';
                            if (aspectBox) {
                                aspectBox.style.paddingTop = '';
                                aspectBox.style.height = 'auto';
                                aspectBox.style.display = 'flex';
                                aspectBox.style.justifyContent = 'center';
                                aspectBox.style.alignItems = 'center';
                            }
                        }
                        // Snake: square canvas
                        else if (key.includes('/snake') || key.includes('snake')) {
                            frame.style.width = '600px';
                            frame.style.height = '600px';
                            frame.style.maxWidth = '100%';
                            frame.style.maxHeight = '80vh';
                            if (aspectBox) {
                                aspectBox.style.paddingTop = '';
                                aspectBox.style.height = 'auto';
                                aspectBox.style.display = 'flex';
                                aspectBox.style.justifyContent = 'center';
                                aspectBox.style.alignItems = 'center';
                            }
                        }
                    }
                } catch (e) {}

                // Update the hero header to reflect the currently playing game
                try {
                    const playingTitle = (match && match.title) || anchor.closest('.cabinet')?.querySelector('.label')?.textContent || 'Now playing';
                    const playingSubtitle = (match && match.subtitle) || '';
                    if (window && typeof window.setHeroForGame === 'function') window.setHeroForGame(playingTitle, playingSubtitle);
                } catch (e) {}

                // set player subtitle from metadata if available
                const subtitleEl = document.getElementById('playerSubtitle');
                if (subtitleEl) {
                    if (match && match.subtitle) {
                        subtitleEl.textContent = match.subtitle;
                    } else {
                        subtitleEl.textContent = ''; // clear until we probe the iframe
                    }
                }

                // set player description from metadata if available
                const descEl = document.getElementById('playerDescription');
                if (descEl) {
                    if (match && (match.description || match.longDescription)) {
                        descEl.textContent = match.description || match.longDescription;
                    } else {
                        descEl.textContent = '';
                    }
                }

                // Try to adjust aspect by probing the embedded page's canvas once it loads
                frame.addEventListener('load', function adjustAspect() {
                    try {
                        // If the parent provided an explicit playSize, skip probing the iframe content
                        // — the playSize should be authoritative and probing can resize the aspect box unexpectedly.
                        if (match && match.playSize) {
                            frame.removeEventListener('load', adjustAspect);
                            return;
                        }
                        const iframeDoc = frame.contentDocument || frame.contentWindow.document;
                        // probe for subtitle-like elements inside the embedded page if we don't have metadata
                        try {
                            const subtitleEl = document.getElementById('playerSubtitle');
                            if (subtitleEl && (!match || !match.subtitle)) {
                                const found = iframeDoc.querySelector('.sub_title, .player-subtitle, .sub, #subtitle');
                                if (found && found.textContent) subtitleEl.textContent = found.textContent.trim();
                            }
                            // try to probe for a description inside the iframe if we don't have one in metadata
                            const descEl = document.getElementById('playerDescription');
                            if (descEl && (!match || !(match.description || match.longDescription))) {
                                const foundDesc = iframeDoc.querySelector('.description, .desc, .player-description, #description');
                                if (foundDesc && foundDesc.textContent) descEl.textContent = foundDesc.textContent.trim();
                            }
                        } catch (e) {
                            // ignore subtitle probing errors
                        }
                        const canvas = iframeDoc.querySelector('canvas') || iframeDoc.getElementById('gravity-dash-canvas')?.querySelector('canvas');
                        if (canvas && aspectBox) {
                            const w = canvas.width || canvas.clientWidth || canvas.offsetWidth;
                            const h = canvas.height || canvas.clientHeight || canvas.offsetHeight;
                            if (w && h) {
                                const pad = (h / w) * 100;
                                aspectBox.style.paddingTop = pad + '%';
                            }
                        }
                    } catch (e) {
                        // cross-origin or other access denied — silently ignore
                    }
                    frame.removeEventListener('load', adjustAspect);
                });
                // Listen for aspect messages from the embedded iframe (safer than probing in cross-origin cases)
                // Ensure we remove any previous listener first
                if (window.__gameAspectListener) {
                    window.removeEventListener('message', window.__gameAspectListener);
                    window.__gameAspectListener = null;
                }
                const onGameAspect = function(e) {
                    // Only accept messages coming from the current iframe's contentWindow
                    try {
                        if (e.source !== frame.contentWindow) return;
                    } catch (err) {
                        return; // can't access source — ignore
                    }
                    const data = e.data || {};
                    if (data && data.type === 'game-aspect') {
                        const subtitleEl = document.getElementById('playerSubtitle');
                        if (subtitleEl && data.subtitle) subtitleEl.textContent = data.subtitle;
                        const descEl = document.getElementById('playerDescription');
                        if (descEl && data.description) descEl.textContent = data.description;

                        // If the embedded frame reports exact pixel width/height, size the iframe to those dimensions
                        if (data.width && data.height) {
                            try {
                                // set iframe to reported pixel size but allow it to scale down with max-width/max-height
                                frame.style.width = (Number(data.width) || 0) + 'px';
                                frame.style.height = (Number(data.height) || 0) + 'px';
                                frame.style.maxWidth = '100%';
                                frame.style.maxHeight = '80vh';
                                // make the aspect box auto-size and center the iframe
                                if (aspectBox) {
                                    aspectBox.style.paddingTop = '';
                                    aspectBox.style.height = 'auto';
                                    aspectBox.style.display = 'flex';
                                    aspectBox.style.justifyContent = 'center';
                                    aspectBox.style.alignItems = 'center';
                                }
                            } catch (e) {}
                        } else if (data.widthRatio && data.heightRatio && aspectBox) {
                            // if a ratio is provided (widthRatio/heightRatio), compute paddingTop
                            const pad = (Number(data.heightRatio) / Number(data.widthRatio)) * 100;
                            if (!Number.isNaN(pad)) aspectBox.style.paddingTop = pad + '%';
                        } else if (data.aspect && aspectBox) {
                            const parts = String(data.aspect).split(':').map(Number);
                            if (parts.length === 2 && parts[0] > 0) {
                                const pad = (parts[1] / parts[0]) * 100;
                                aspectBox.style.paddingTop = pad + '%';
                            }
                        }
                    }
                };
                window.addEventListener('message', onGameAspect);
                window.__gameAspectListener = onGameAspect;
            }
        });
    });
}

// Add ?embed=1 to a URL safely (handles relative paths)
function addEmbedParam(path) {
    try {
        const url = new URL(path, window.location.origin);
        url.searchParams.set('embed', '1');
        return url.href;
    } catch (e) {
        // fallback: append naive
        if (path.includes('?')) return path + '&embed=1';
        return path + '?embed=1';
    }
}

// Modal handling
function openProjectModal(path) {
    try {
        const modal = document.getElementById('projectModal');
        const frame = document.getElementById('projectFrame');
        console.log('Opening project modal:', path);
        // ensure modal becomes visible for browsers that don't react to aria attribute alone
        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');
        frame.src = path;
        // move focus to close button for accessibility
        const closeBtn = document.getElementById('modalClose');
        if (closeBtn) closeBtn.focus();
    } catch (err) {
        console.error('Failed to open project modal', err);
    }
}

function closeProjectModal() {
    const modal = document.getElementById('projectModal');
    const frame = document.getElementById('projectFrame');
    modal.setAttribute('aria-hidden', 'true');
    modal.style.display = 'none';
    frame.src = 'about:blank';
}

document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'modalClose') closeProjectModal();
    if (e.target && e.target.id === 'projectModal') closeProjectModal();
});

// close modal with Escape key and backdrop clicks
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeProjectModal();
});

// tooltips are styled to always appear below the element via CSS

// backdrop click — if clicked outside modal-inner close it
document.addEventListener('click', (e) => {
    const modal = document.getElementById('projectModal');
    if (!modal || modal.getAttribute('aria-hidden') === 'true') return;
    const inner = document.querySelector('.modal-inner');
    if (inner && !inner.contains(e.target) && e.target !== inner) {
        closeProjectModal();
    }
});

// Lazy load three-scene when user toggles 3D or when device supports WebGL
let threeLoaded = false;
// explicit runtime state for whether 3D is currently enabled
let threeEnabled = false;
// Helper to set the toggle button label
function set3DToggleLabel(enabled) {
    const btn = document.getElementById('toggle-3d');
    if (!btn) return;
    btn.textContent = enabled ? '3D on' : '3D off';
}
async function enableDecorative3D(enable) {
    const canvas = document.getElementById('three-canvas');
    if (enable) {
        // If we already have a running instance, just reveal and resume it instead of recreating
        const existingCanvas = document.getElementById('three-canvas');
        if (existingCanvas && window.__threeScene && typeof window.__threeScene.resume === 'function') {
            try {
                existingCanvas.style.display = 'block';
                existingCanvas.style.visibility = 'visible';
                existingCanvas.style.opacity = '1';
                existingCanvas.style.zIndex = '-500';
                existingCanvas.style.background = 'transparent';
                existingCanvas.style.pointerEvents = 'none';
            } catch (e) {}
            try { window.__threeScene.resume(); } catch (e) {}
            threeLoaded = true;
            set3DToggleLabel(true);
            return;
        }

        // Otherwise create a canvas only if it doesn't already exist and initialize
        let newCanvas = existingCanvas;
        if (!newCanvas) {
            newCanvas = document.createElement('canvas');
            newCanvas.id = 'three-canvas';
            newCanvas.className = 'three-canvas';
            try { document.body.appendChild(newCanvas); } catch (e) { document.documentElement.appendChild(newCanvas); }
        }
        // visually hide until ready but keep in layout
        try {
            newCanvas.style.display = 'block';
            newCanvas.style.visibility = 'hidden';
            newCanvas.style.opacity = '0';
        } catch (e) {}
        // disable toggle button while initializing to avoid duplicate inits
        const toggleBtn = document.getElementById('toggle-3d');
        if (toggleBtn) toggleBtn.disabled = true;
    // dynamic import of three-scene script; import is cached but calling initThree ensures re-init after stop()
        try {
            // try to mirror the current page background on the canvas element so the user doesn't see a white flash
            try {
                const pageBg = window.getComputedStyle(document.documentElement).getPropertyValue('--page-bg') || '';
                const bg = (pageBg || '').trim();
                if (bg && bg.toLowerCase().startsWith('url(')) {
                    // image -> keep canvas transparent so image shows through
                    newCanvas.style.background = 'transparent';
                } else if (bg) {
                    // color value (like #aabbcc or rgb(...)) -> apply it to canvas
                    newCanvas.style.background = bg.replace(/"|'/g, '');
                } else {
                    newCanvas.style.background = 'transparent';
                }
            } catch (e) {}

            // primary import attempt
            let mod;
            try {
                mod = await import('./three-scene.js');
            } catch (impErr) {
                console.warn('Initial import of three-scene failed, attempting cache-busted import', impErr);
                // try again with a cache-busting querystring
                try {
                    mod = await import(`./three-scene.js?cb=${Date.now()}`);
                } catch (impErr2) {
                    throw impErr2;
                }
            }

            if (mod && typeof mod.initThree === 'function') {
                await mod.initThree();
            } else {
                throw new Error('three-scene module did not export initThree');
            }

            threeLoaded = true;
            // reveal canvas now that rendering should be happening (ensure pointer events off)
            try {
                newCanvas.style.display = 'block';
                newCanvas.style.visibility = 'visible';
                newCanvas.style.opacity = '1';
                newCanvas.style.zIndex = '-500';
                newCanvas.style.background = 'transparent';
                newCanvas.style.pointerEvents = 'none';
            } catch (e) {}
            set3DToggleLabel(true);
        } catch (err) {
            console.error('3D background failed to initialize', err);
            // remove the newly-inserted canvas if present
            try { const nc = document.getElementById('three-canvas'); if (nc && !threeLoaded && nc.parentNode) nc.parentNode.removeChild(nc); } catch (e) {}
            const btn = document.getElementById('toggle-3d');
            if (btn) { btn.textContent = '3D off (error)'; btn.disabled = false; }
            set3DToggleLabel(false);
            return;
        } finally {
            // re-enable the toggle if it wasn't left disabled
            try { const btn = document.getElementById('toggle-3d'); if (btn) btn.disabled = false; } catch (e) {}
        }
    } else {
        // try to pause animation if three-scene exposed a pause function; prefer pause to preserve GL context
        if (window.__threeScene) {
            if (typeof window.__threeScene.pause === 'function') {
                window.__threeScene.pause();
            } else if (typeof window.__threeScene.stop === 'function') {
                // fallback to a full stop if pause isn't available
                window.__threeScene.stop();
            }
        }
        // keep the canvas in DOM to preserve the GL context; just hide it visually
        try {
            const nc = document.getElementById('three-canvas');
            if (nc) {
                nc.style.opacity = '0';
                nc.style.visibility = 'hidden';
                nc.style.pointerEvents = 'none';
            }
        } catch (e) {}
        set3DToggleLabel(false);
    }
}

// Attach toggle
document.addEventListener('DOMContentLoaded', () => {
    renderCabinets();

    // capture default hero texts so we can restore them when the player closes
    try {
        window.__defaultHeroTitle = document.querySelector('.hero-title')?.textContent || 'Games';
        window.__defaultHeroSub = document.querySelector('.sub_title')?.textContent || 'Welcome :)';
    } catch (e) {
        window.__defaultHeroTitle = 'Games';
        window.__defaultHeroSub = 'Welcome :)';
    }

    // expose global helpers so handlers created outside this block can call them
    window.setHeroForGame = function(title, subtitle) {
        try {
            const heroTitleEl = document.querySelector('.hero-title');
            const heroSubEl = document.querySelector('.sub_title');
            if (heroTitleEl) heroTitleEl.textContent = title || window.__defaultHeroTitle;
            if (heroSubEl) heroSubEl.textContent = subtitle || '';
        } catch (e) {}
    };

    window.resetHero = function() {
        try {
            const heroTitleEl = document.querySelector('.hero-title');
            const heroSubEl = document.querySelector('.sub_title');
            if (heroTitleEl) heroTitleEl.textContent = window.__defaultHeroTitle;
            if (heroSubEl) heroSubEl.textContent = window.__defaultHeroSub;
        } catch (e) {}
    };

    const toggle = document.getElementById('toggle-3d');
    if (toggle) {
        toggle.addEventListener('click', async (ev) => {
            ev.preventDefault();
            // ignore clicks when disabled (but ensure we aren't stuck disabled)
            if (toggle.disabled) {
                console.info('Toggle button is disabled; enabling for retry');
                toggle.disabled = false;
            }
            const canvas = document.getElementById('three-canvas');
            // determine desired state using explicit runtime flag
            const enable = !threeEnabled;
            console.info('3D toggle clicked — desired enable=', enable);
            try {
                // disable while running
                toggle.disabled = true;
                await enableDecorative3D(enable);
                // update runtime state and label
                threeEnabled = !!enable;
                set3DToggleLabel(threeEnabled);
            } catch (err) {
                console.error('enableDecorative3D threw', err);
                // make sure UI isn't left disabled
                toggle.disabled = false;
            } finally {
                // ensure button re-enabled for further attempts
                try { toggle.disabled = false; } catch (e) {}
            }
        });
    }

        // Auto-enable 3D if supported and user hasn't requested reduced motion
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced && toggle) toggle.style.display = 'none';
        function hasWebGL() {
            try {
                const canvas = document.createElement('canvas');
                return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
            } catch (e) { return false }
        }
        if (!prefersReduced && hasWebGL()) {
            // Slight delay to allow paint and avoid blocking
            setTimeout(async () => {
                try {
                    await enableDecorative3D(true);
                    threeEnabled = true;
                    set3DToggleLabel(true);
                } catch (e) {
                    threeEnabled = false;
                    set3DToggleLabel(false);
                }
            }, 300);
        }

    // initialize the toggle label from the explicit flag
    try {
        set3DToggleLabel(!!threeEnabled);
    } catch (e) { /* ignore */ }

    // modal close button
    const closeBtn = document.getElementById('modalClose');
    if (closeBtn) closeBtn.addEventListener('click', closeProjectModal);

    // Player close button
    const closePlayer = document.getElementById('closePlayer');
    if (closePlayer) closePlayer.addEventListener('click', () => {
        const player = document.getElementById('playerArea');
        const frame = document.getElementById('playerFrameMain');
        if (player) { player.style.display = 'none'; player.setAttribute('aria-hidden', 'true'); }
        if (frame) frame.src = 'about:blank';
        // restore hero header when player closes
        try { if (window && typeof window.resetHero === 'function') window.resetHero(); } catch (e) {}
    });

    // Right-side color controls
    const pageColorPicker = document.getElementById('pageColorPicker');
    const randomBgBtn = document.getElementById('randomBgBtn');
    const revertBgBtn = document.getElementById('revertBgBtn');
    // initialize picker from saved background color
    try {
        const saved = localStorage.getItem('backgroundColor');
        if (saved) {
            if (pageColorPicker) pageColorPicker.value = saved;
            setBackgroundColor(saved);
        }
    } catch (e) { }
    const pageColorDisplay = document.getElementById('pageColorDisplay');
    if (pageColorPicker) {
        pageColorPicker.addEventListener('input', (e) => {
            setBackgroundColor(e.target.value);
            if (pageColorDisplay) pageColorDisplay.style.background = e.target.value;
        });
        // sync display on load
        if (pageColorDisplay) pageColorDisplay.style.background = pageColorPicker.value;
    }
    if (randomBgBtn) randomBgBtn.addEventListener('click', changeBackgroundColor);
    if (revertBgBtn) revertBgBtn.addEventListener('click', revertToOriginalBackground);

    // controls are inline in the header now (pageColorPicker, randomBgBtn, revertBgBtn, toggle-3d, programs)

    // Fullscreen toggle for the player area
    const toggleFs = document.getElementById('toggleFullscreen');
    if (toggleFs) {
        toggleFs.addEventListener('click', async () => {
            const player = document.getElementById('playerArea');
            const frame = document.getElementById('playerFrameMain');
            if (!player) return;
            // If already fullscreen via the element class, exit
            if (document.fullscreenElement || player.classList.contains('fullscreen')) {
                try {
                    if (document.fullscreenElement) await document.exitFullscreen();
                    player.classList.remove('fullscreen');
                    toggleFs.textContent = 'Fullscreen';
                } catch (e) { console.warn('Exit fullscreen failed', e) }
                return;
            }
            // Try to request fullscreen on the iframe first (better for keyboard input)
            try {
                if (frame && frame.requestFullscreen) {
                    await frame.requestFullscreen({ navigationUI: 'hide' });
                } else if (player.requestFullscreen) {
                    await player.requestFullscreen({ navigationUI: 'hide' });
                }
                player.classList.add('fullscreen');
                toggleFs.textContent = 'Exit Fullscreen';
            } catch (err) {
                // fallback: add class that simulates fullscreen
                console.warn('Fullscreen request failed, falling back to CSS fullscreen', err);
                player.classList.add('fullscreen');
                toggleFs.textContent = 'Exit Fullscreen';
            }
        });
    }

    // exit fullscreen with ESC key or handle fullscreenchange to update UI
    document.addEventListener('fullscreenchange', () => {
        const player = document.getElementById('playerArea');
        const toggleFs = document.getElementById('toggleFullscreen');
        if (!document.fullscreenElement) {
            if (player) player.classList.remove('fullscreen');
            if (toggleFs) toggleFs.textContent = 'Fullscreen';
        } else {
            if (toggleFs) toggleFs.textContent = 'Exit Fullscreen';
        }
    });

    // Open in new tab link — ensure it opens the current player src if clicked
    const openNewTabLink = document.getElementById('openNewTab');
    if (openNewTabLink) {
        openNewTabLink.addEventListener('click', (e) => {
            // default anchor behavior opens it in a new tab because of target=_blank
        });
    }

    // Header: Change background site button (replaces the old Jokes button)
    const changeBgSiteBtn = document.getElementById('changeBgSiteBtn');
    if (changeBgSiteBtn) {
        changeBgSiteBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // open the dedicated change background page in a new tab
            window.open('/change_color.html', '_blank', 'noopener');
        });
    }
});

// helper: focus an iframe and its inner canvas (best-effort)
function focusIframeAndCanvas(frame) {
  try {
    frame.tabIndex = -1;
    frame.style.outline = 'none';

    if (frame.contentWindow && typeof frame.contentWindow.focus === 'function') {
      frame.contentWindow.focus();
    }

    const doc = frame.contentDocument;
    if (doc) {
      const innerCanvas = doc.querySelector('canvas');
      if (innerCanvas) {
        innerCanvas.tabIndex = -1;
        innerCanvas.style.outline = 'none';
        try { innerCanvas.focus(); } catch (_) {}
      }
    }

    try { frame.contentWindow.postMessage({ type: 'focus' }, '*'); } catch (_) {}
  } catch (err) {
    console.debug('focusIframeAndCanvas failed', err);
  }
}


