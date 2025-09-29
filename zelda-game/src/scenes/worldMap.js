import globalStateManager from "../state/globalState.js";

export default function worldMapScene(k, playerPos) {
    // Helper to center camera on player marker
    function centerCameraOnMarker() {
        if (playerMarker && typeof k.setCamPos === 'function') {
            k.setCamPos(playerMarker.pos.clone());
        }
    }
    console.log("playerPos in worldMapScene:", playerPos);
    for (let i = 0; i < k.height(); i += 8) {
        k.add([
            k.rect(k.width(), 8),
            k.pos(0, i),
            k.color(8, 148, 236),
            k.z(0),
            k.fixed(),
        ]);
    }

    // Decorative border (golden)
    const borderThickness = 12;
    k.add([
        k.rect(k.width(), borderThickness),
        k.pos(0, 0),
        k.color(218, 165, 32),
        k.z(1),
        k.fixed(),
    ]);
    k.add([
        k.rect(k.width(), borderThickness),
        k.pos(0, k.height() - borderThickness),
        k.color(218, 165, 32),
        k.z(1),
        k.fixed(),
    ]);
    k.add([
        k.rect(borderThickness, k.height()),
        k.pos(0, 0),
        k.color(218, 165, 32),
        k.z(1),
        k.fixed(),
    ]);
    k.add([
        k.rect(borderThickness, k.height()),
        k.pos(k.width() - borderThickness, 0),
        k.color(218, 165, 32),
        k.z(1),
        k.fixed(),
    ]);

    // Subtle triangle "Triforce" in the corner
    k.add([
        k.polygon([
            k.vec2(0, 32), k.vec2(32, 0), k.vec2(64, 32), // top triangle
            k.vec2(0, 32), k.vec2(32, 64), k.vec2(64, 32), // bottom triangle
        ]),
        k.pos(borderThickness + 32, borderThickness + 32),
        k.scale(2),
        k.z(2),
        k.fixed(),
    ]);

    // Get previous scene
    const previousScene = globalStateManager().getInstance().getPreviousScene();

    // --- World/map sizes (adjust as needed) ---
    const worldWidth = 1024;
    const worldHeight = 1024;
    const mapImageWidth = 512;
    const mapImageHeight = 512;

    const scaleX = mapImageWidth / worldWidth;
    const scaleY = mapImageHeight / worldHeight;

    let zoom = 1;
    let offset = k.vec2(0, 0);

    if (playerPos) {
        const movementMultiplier = 2;
        // Calculate where the marker would be with no offset
        const playerMapX = (playerPos.x * scaleX * movementMultiplier - mapImageWidth / 2) * zoom;
        const playerMapY = (playerPos.y * scaleY * movementMultiplier - mapImageHeight / 2) * zoom;
        let markerX = k.width() / 2 + playerMapX;
        let markerY = k.height() / 2 + playerMapY;
        if (previousScene === "castle") {
            markerX += -390 * zoom;
            markerY += -600 * zoom;
        }
        if (previousScene === "forest-east") {
            markerX += 670 * zoom;
            markerY += -840 * zoom;
        }
        if (previousScene === "forest") {
            markerX += -1608 * zoom;
            markerY += -828 * zoom;
        }
        if (previousScene === "witch-house") {
            markerX += 300 * zoom;
            markerY += 1000 * zoom;
        }
        if (previousScene === "castle-main") {
            markerX += -490 * zoom;
            markerY += -1540 * zoom;
        }
        if (previousScene === "swamp") {
            markerX += 455 * zoom;
            markerY += -215 * zoom;
        }
        if (previousScene === "village") {
            markerX += -170 * zoom;
            markerY += -250 * zoom;
        }
        if (previousScene === "mountain") {
            markerX += -580 * zoom;
            markerY += -425 * zoom;
        }
        if (previousScene === "town") {
            markerX += -22 * zoom;
            markerY += 384 * zoom;
        }
        if (previousScene === "world") {
            markerX += -600 * zoom;
            markerY += 384 * zoom;
        }
        // Calculate offset needed to bring marker to center of screen
        offset = k.vec2(
            offset.x + (k.width() / 2 - markerX),
            offset.y + (k.height() / 2 - markerY)
        );
    }

    // World map image (centered, with pan/zoom)
    const mapSprite = k.add([
        k.sprite("world-map"),
        k.pos(k.width() / 2 + offset.x, k.height() / 2 + offset.y),
        k.anchor("center"),
        k.z(3),
        k.scale(zoom),
    ]);


    // --- Player marker logic ---
    let markerX = mapSprite.pos.x;
    let markerY = mapSprite.pos.y;

    const movementMultiplier = 2; // Increase this for more movement
    if (playerPos) {
        

        const playerMapX = (playerPos.x * scaleX * movementMultiplier - mapImageWidth / 2) * zoom;
        const playerMapY = (playerPos.y * scaleY * movementMultiplier - mapImageHeight / 2) * zoom;
        markerX += playerMapX;
        markerY += playerMapY;
    }

    // Clamp marker scale for visibility
    const minMarkerScale = 1.8;
    const maxMarkerScale = 2.5;
    let playerMarker = k.add([
        k.sprite("sprites", { anim: "player-idle-down" }),
        k.pos(0, 0), // Temporary, will be set in updateMap()
        k.anchor("center"),
        k.z(5),
        k.scale(Math.min(Math.max(2 * zoom, minMarkerScale), maxMarkerScale)),
    ]);

    // Update map position and scale
    function updateMap() {
        mapSprite.scaleTo(zoom);
        mapSprite.pos = k.vec2(
            k.width() / 2 + offset.x,
            k.height() / 2 + offset.y
        );
        if (playerMarker && playerPos) {
            const worldCenterX = worldWidth / 2;
            const worldCenterY = worldHeight / 2;
            const playerOffsetX = (playerPos.x - worldCenterX) * scaleX * movementMultiplier * zoom;
            const playerOffsetY = (playerPos.y - worldCenterY) * scaleY * movementMultiplier * zoom;
            let markerX = mapSprite.pos.x + playerOffsetX;
            let markerY = mapSprite.pos.y + playerOffsetY;
            if (previousScene === "castle") {
                markerX += -390 * zoom;
                markerY += -600 * zoom;
            }
            if (previousScene === "forest-east") {
                markerX += 670 * zoom;
                markerY += -840 * zoom;
            }
            if (previousScene === "forest") {
                markerX += -1608 * zoom;
                markerY += -828 * zoom;
            }
            if (previousScene === "witch-house") {
                markerX += -1530 * zoom;
                markerY += -1740 * zoom;
            }
            if (previousScene === "castle-main") {
                markerX += -490 * zoom;
                markerY += -1540 * zoom;
            }
            if (previousScene === "swamp") {
                markerX += 455 * zoom;
                markerY += -215 * zoom;
            }
            if (previousScene === "village") {
                markerX += -170 * zoom;
                markerY += -250 * zoom;
            }
            if (previousScene === "mountain") {
                markerX += -580 * zoom;
                markerY += -425 * zoom;
            }
            if (previousScene === "town") {
                markerX += -22 * zoom;
                markerY += 384 * zoom;
            }
            if (previousScene === "world") {
                markerX += -1110 * zoom;
                markerY += -95 * zoom;
            }
            playerMarker.pos = k.vec2(markerX, markerY);
            // Clamp marker scale for visibility
            playerMarker.scaleTo(Math.min(Math.max(2 * zoom, minMarkerScale), maxMarkerScale));
        }
    }

    // Immediately set correct positions after all setup
    updateMap();
    centerCameraOnMarker();

    // Zoom controls
    k.onKeyPress("+", () => {
        zoom = Math.min(zoom + 0.2, 3);
        updateMap();
        centerCameraOnMarker();
    });
    k.onKeyPress("-", () => {
        zoom = Math.max(zoom - 0.2, 0.2);
        updateMap();
        centerCameraOnMarker();
    });

    // Pan controls (arrow keys and WASD)
    const panSpeed = 32;
    k.onKeyDown(["left", "a"], () => {
        offset.x += panSpeed * zoom;
        updateMap();
    });
    k.onKeyDown(["right", "d"], () => {
        offset.x -= panSpeed * zoom;
        updateMap();
    });
    k.onKeyDown(["up", "w"], () => {
        offset.y += panSpeed * zoom;
        updateMap();
    });
    k.onKeyDown(["down", "s"], () => {
        offset.y -= panSpeed * zoom;
        updateMap();
    });

    // Reset pan/zoom with "0"
    k.onKeyPress("0", () => {
    zoom = 1;
    offset = k.vec2(0, 0);
    updateMap();
    centerCameraOnMarker();
    });

    // Instructions text
    k.add([
        k.text(
            [
                "'M': Close Map",
                "'+/-': Zoom In/Out",
                "'Arrows/WASD': Pan",
                "'0': Reset View"
            ].join("\n"),
            { size: 18, font: "gameboy" }
        ),
        k.pos(24, k.height() - 110),
        k.color(255, 255, 255),
        k.z(10),
        k.fixed(),
    ]);

    // Return to previous scene on key press
    k.onKeyPress("m", () => {
        const prev = globalStateManager().getInstance().getPreviousScene() || "world";
        k.go(prev);
    });
}