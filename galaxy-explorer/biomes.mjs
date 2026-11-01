// Biomes are chosen from physics, never assigned by index. Each world then
// gets its own colour variation (seeded hue shift, star-tinted vegetation).
import { clamp } from "./physics.mjs";

export const BIOMES = {
    Volcanic: {
        palette: ["#302a36", "#594047", "#955945", "#d08b59"],
        atmosphere: "#ef8b55",
        rock: "#49333c",
        crystal: "#ffb35d",
        relief: 1.6,
        tagline: "Basalt ridges and embers beneath a copper sky.",
        note: "The basalt is threaded with a mineral that stores heat long after sunset.",
        title: "A memory of fire",
        message:
            "The pulse travels through the rock itself. Something beneath the crust is answering.",
    },
    Toxic: {
        palette: ["#4a4a2c", "#7a7340", "#a89a52", "#d8c878"],
        atmosphere: "#e3cf6a",
        rock: "#5d5733",
        crystal: "#f2e48a",
        relief: 0.9,
        tagline: "Crushing yellow cloud over a scorched, glowing plain.",
        note: "The hull sensors read acid rain that evaporates before it reaches the ground.",
        title: "Under the veil",
        message:
            "The signal only escapes the clouds once a day. It has been timed to the rotation.",
    },
    Desert: {
        palette: ["#93664f", "#bb8660", "#d2a777", "#edd2a1"],
        atmosphere: "#edca9b",
        rock: "#94694d",
        crystal: "#efd9a2",
        relief: 0.85,
        tagline: "Wind-carved stone on a quiet amber world.",
        note: "The standing stones are polished on one side. The prevailing wind has not changed for centuries.",
        title: "Written in the dunes",
        message:
            "Under the sand, a repeating arrangement of stone points toward another world.",
    },
    Verdant: {
        palette: ["#536961", "#7b8d77", "#a1aa84", "#b3af8d"],
        atmosphere: "#72c5bd",
        rock: "#65716b",
        crystal: "#a4d0b0",
        relief: 1,
        tagline: "Rolling meadows under a soft haze.",
        lifelessTagline: "Pale mineral flats around still, lifeless lakes.",
        note: "The stones are warm. There is no power source, but the pulse responds to your presence.",
        title: "It was waiting",
        message:
            "One transmission. Repeated for a very long time. “You are not the first.”",
    },
    Oceanic: {
        palette: ["#2d4f6b", "#3f7590", "#7fa8a6", "#c9cfb4"],
        atmosphere: "#7ec4e8",
        rock: "#4f6670",
        crystal: "#a6e6f0",
        relief: 0.7,
        tagline: "A world of open water broken by scattered islands.",
        lifelessTagline: "A sterile ocean under an empty sky.",
        note: "The tide here is enormous. The island you landed on was seabed a few hours ago.",
        title: "Between tides",
        message:
            "The signal is strongest at low tide, as if it was built to be found only then.",
    },
    Frozen: {
        palette: ["#506c8c", "#83a8bd", "#b7d7dc", "#e0edf0"],
        atmosphere: "#9dcfff",
        rock: "#718da8",
        crystal: "#b6efff",
        relief: 1.35,
        tagline: "Blue ice, sharp ridges, and long shadows.",
        note: "Bubbles trapped in the crystal contain a gas absent from the atmosphere.",
        title: "Before the ice",
        message:
            "The signal is older than the glacier. A brief image shows this world covered in water.",
    },
    Amethyst: {
        palette: ["#49435c", "#756183", "#a28aab", "#cebbce"],
        atmosphere: "#b3a0ef",
        rock: "#685475",
        crystal: "#dec0ff",
        relief: 1.1,
        tagline: "Violet crystal highlands in thin, cold air.",
        note: "Every crystal resonates at the same frequency, even on opposite sides of the site.",
        title: "The quiet chorus",
        message:
            "Seven separate notes form a single chord. The source is somewhere beyond this system.",
    },
    Barren: {
        palette: ["#3d3c40", "#5b5a5e", "#807e80", "#a9a6a3"],
        atmosphere: "#2a2f3a",
        rock: "#55535a",
        crystal: "#c8d2e0",
        relief: 1.25,
        tagline: "Airless grey rock, cratered and silent.",
        note: "Footprints would last a million years here. Yours are not the only ones.",
        title: "No wind to erase it",
        message:
            "The transmitter is buried under the dust of countless impacts. It has outlasted all of them.",
    },
};

// Cloud colours of giant planets by cloud type (see makeGiant): bands from dark
// belts to bright zones, the haze at the limb, storm and ring colours.
export const GIANT_CLOUDS = {
    ammonia: {
        bands: ["#7e5238", "#b8835a", "#dfc199", "#f2e4cc"],
        haze: "#e8cfa8",
        storm: "#b5523a",
        ring: "#d9c7a6",
        tagline: "Banded ammonia clouds and long-lived storms over a sea of hydrogen.",
    },
    methane: {
        bands: ["#2c6a8a", "#4c98b4", "#7cc2d3", "#bde5ea"],
        haze: "#8fd3e8",
        storm: "#1d4670",
        ring: "#9fb8c4",
        tagline: "A cold blue-green giant wrapped in methane haze.",
    },
    water: {
        bands: ["#8e9ba7", "#bcc5cc", "#dfe4e8", "#f6f7f8"],
        haze: "#dde7f0",
        storm: "#7c8ba0",
        ring: "#c9cfd6",
        tagline: "Bright white water clouds stacked in pale bands.",
    },
    clear: {
        bands: ["#1d3b86", "#2d58ad", "#5884ce", "#98b6e6"],
        haze: "#6f9cf0",
        storm: "#142a62",
        ring: "#8fa2c8",
        tagline: "Too warm for clouds: deep blue hydrogen scatters the starlight.",
    },
    alkali: {
        bands: ["#251a19", "#432c27", "#654132", "#865a43"],
        haze: "#a0563a",
        storm: "#c8673a",
        ring: "#6d5a50",
        tagline: "A dark, scorching giant that swallows almost all its starlight.",
    },
    silicate: {
        bands: ["#3a1410", "#6e2416", "#a8401e", "#e07a32"],
        haze: "#ff7a3a",
        storm: "#ffb04a",
        ring: "#7a4a3a",
        tagline: "It glows red through clouds of molten rock.",
    },
};

// Giants have no surface, so they never host a signal; the shared fields keep
// every body the same shape for the renderer and the map.
for (const [name, atmosphere] of [["Gas giant", "#e8cfa8"], ["Ice giant", "#8fd3e8"]])
    BIOMES[name] = {
        giant: true,
        palette: GIANT_CLOUDS[name === "Ice giant" ? "methane" : "ammonia"].bands,
        atmosphere,
        rock: "#6d5a50",
        crystal: "#d9c7a6",
        relief: 1,
        tagline: "",
        note: "",
        title: "",
        message: "",
    };

export function classify(p) {
    if (p.pressure > 8 && p.temperature > 380 && p.waterState !== "liquid")
        return "Toxic";
    if (
        p.temperature > 650 ||
        (p.volcanism > 0.62 && p.temperature > 180 && p.waterCoverage < 0.7)
    )
        return "Volcanic";
    if (p.waterState === "liquid") {
        if (p.waterCoverage > 0.7) return "Oceanic";
        if (p.life === "simple" || p.life === "complex" || p.temperature < 300)
            return "Verdant";
        return "Desert";
    }
    if (p.waterState === "ice" && p.waterCoverage > 0.3) return "Frozen";
    if (p.pressure < 0.01)
        return p.temperature < 150 && p.volatiles > 0.2 ? "Frozen" : "Barren";
    if (p.temperature < 260) return "Amethyst";
    return "Desert";
}

// --- colour helpers ---
const toHsl = (hex) => {
    const [r, g, b] = [1, 3, 5].map(
        (i) => parseInt(hex.slice(i, i + 2), 16) / 255,
    );
    const max = Math.max(r, g, b),
        min = Math.min(r, g, b),
        l = (max + min) / 2,
        d = max - min;
    if (!d) return [0, 0, l];
    const s = d / (1 - Math.abs(2 * l - 1));
    const h =
        max === r
            ? ((g - b) / d + 6) % 6
            : max === g
              ? (b - r) / d + 2
              : (r - g) / d + 4;
    return [h * 60, s, l];
};
const fromHsl = ([h, s, l]) => {
    const c = (1 - Math.abs(2 * l - 1)) * s,
        x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
        m = l - c / 2;
    const [r, g, b] =
        h < 60
            ? [c, x, 0]
            : h < 120
              ? [x, c, 0]
              : h < 180
                ? [0, c, x]
                : h < 240
                  ? [0, x, c]
                  : h < 300
                    ? [x, 0, c]
                    : [c, 0, x];
    return (
        "#" +
        [r, g, b]
            .map((v) =>
                Math.round((v + m) * 255)
                    .toString(16)
                    .padStart(2, "0"),
            )
            .join("")
    );
};
const shift = (hex, dh, ds = 0, dl = 0) => {
    const [h, s, l] = toHsl(hex);
    return fromHsl([
        (((h + dh) % 360) + 360) % 360,
        clamp(s + ds, 0, 1),
        clamp(l + dl, 0, 1),
    ]);
};

// Plants evolve to absorb the light they get: under dim red stars they turn dark
// red-purple, under hot white stars pale and blue-green.
export function vegetationShift(starTemperature) {
    if (starTemperature < 3900) return { hue: -110, light: -0.12 };
    if (starTemperature < 5200) return { hue: -45, light: -0.05 };
    if (starTemperature > 6600) return { hue: 25, light: 0.06 };
    return { hue: 0, light: 0 };
}

export function worldLook(biomeName, p, star, r) {
    const biome = BIOMES[biomeName];
    const hue = r.range(-14, 14),
        sat = r.range(-0.06, 0.06);
    let palette = biome.palette.map((c) => shift(c, hue, sat));
    if (biomeName === "Verdant" || biomeName === "Oceanic") {
        const v = vegetationShift(star.temperature);
        // Lower bands (lowlands) carry the vegetation tint; peaks stay rock.
        palette = palette.map((c, i) =>
            i < 3 && p.life !== "none"
                ? shift(c, v.hue * (1 - i * 0.25), 0.05, v.light)
                : c,
        );
    }
    // Thin air shows almost no glow; thick air glows strongly.
    const airGlow =
        p.pressure <= 0
            ? 0
            : clamp(0.25 + Math.log10(p.pressure + 0.01) * 0.3, 0.1, 1);
    const atmosphere = shift(biome.atmosphere, hue, 0, -(1 - airGlow) * 0.35);
    return {
        palette,
        atmosphere,
        rock: shift(biome.rock, hue, sat),
        crystal: shift(biome.crystal, hue),
        // Low gravity lets mountains grow taller; volcanism adds rugged relief.
        relief: +(
            biome.relief *
            clamp(1 / Math.sqrt(Math.max(p.gravity, 0.05)), 0.75, 1.6) *
            (1 + p.volcanism * 0.25)
        ).toFixed(3),
    };
}

// --- text ---
const celsius = (k) => Math.round(k - 273.15);
export function airWords(p) {
    if (p.pressure <= 0) return "no atmosphere";
    if (p.pressure < 0.1) return "a thin trace of air";
    if (p.pressure < 0.5) return "thin air";
    if (p.pressure < 2) return "breathable-density air";
    if (p.pressure < 10) return "dense air";
    return "crushing air";
}
export function waterWords(p) {
    if (p.waterState === "liquid")
        return p.waterCoverage > 0.7
            ? "global oceans"
            : p.waterCoverage > 0.35
              ? "seas and lakes"
              : "scattered lakes";
    if (p.waterState === "ice")
        return p.subsurfaceOcean
            ? "an ocean hidden under the ice"
            : p.waterCoverage > 0.5
              ? "ice sheets"
              : "polar ice";
    if (p.waterState === "vapor") return "water only as steam";
    return "no water";
}
export const LIFE_WORDS = {
    none: "No sign of life",
    microbial: "Microbial life",
    simple: "Simple plant-like life",
    complex: "Complex life",
};

export function describe(biomeName, p) {
    const biome = BIOMES[biomeName];
    const facts = `${celsius(p.temperature)} °C, ${p.gravity.toFixed(2)} g, ${airWords(p)}, ${waterWords(p)}.`;
    const lifeLine =
        p.life === "none"
            ? ""
            : ` ${LIFE_WORDS[p.life]} detected${p.subsurfaceOcean ? " below the ice" : ""}.`;
    const locked =
        p.tidallyLocked && !p.isMoon ? " One side always faces the star." : "";
    const tagline =
        p.life === "none" && biome.lifelessTagline
            ? biome.lifelessTagline
            : biome.tagline;
    return `${tagline} ${facts}${lifeLine}${locked}`;
}
export function factLine(p) {
    return [
        `${celsius(p.temperature)} °C`,
        `${p.gravity.toFixed(2)} g`,
        p.pressure > 0
            ? `${p.pressure < 0.1 ? p.pressure.toFixed(3) : p.pressure.toFixed(2)} bar`
            : "no air",
        waterWords(p),
        LIFE_WORDS[p.life].toLowerCase(),
    ].join(" · ");
}

// --- giants ---
export function giantLook(p, star, r) {
    const c = GIANT_CLOUDS[p.clouds];
    const hue = r.range(-12, 12),
        sat = r.range(-0.08, 0.08);
    return {
        palette: c.bands.map((x) => shift(x, hue, sat)),
        atmosphere: shift(c.haze, hue),
        rock: shift(c.storm, hue),
        crystal: shift(c.ring, hue * 0.5),
        relief: 1,
        // Pattern of the cloud bands, read by giant-mesh.js.
        bands: r.int(5, 12),
        turbulence: r.range(0.4, 1),
        storm: r.chance(0.55) ? { lat: r.range(-0.55, 0.55), lon: r.range(0, Math.PI * 2), size: r.range(0.08, 0.2) } : null,
        tilt: r.range(-0.45, 0.45),
    };
}
const massWords = (m) => (m < 50 ? `${m.toFixed(0)} Earth masses` : `${(m / 318).toFixed(m < 318 ? 2 : 1)} Jupiter masses`);
export function describeGiant(p) {
    const what = p.kind === "ice" ? "Ice giant" : "Gas giant";
    const hot = p.au < 0.2 ? " It orbits so close that a year lasts days." : "";
    return `${GIANT_CLOUDS[p.clouds].tagline} ${what} of ${massWords(p.mass)}, ${celsius(p.temperature)} °C at the cloud tops, ${p.gravity.toFixed(1)} g. No solid surface to land on; its moons are where to go.${hot}`;
}
export function giantFacts(p) {
    return [
        `${celsius(p.temperature)} °C cloud tops`,
        `${p.gravity.toFixed(2)} g`,
        massWords(p.mass),
        "no solid surface",
        LIFE_WORDS.none.toLowerCase(),
    ].join(" · ");
}
