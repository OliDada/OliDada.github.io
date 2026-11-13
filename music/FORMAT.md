# olid-song format (v1)

One song is one JSON file in `music/songs/`. The Studio (`/music/`) opens and saves these files, and games play them with `music/player.js`. Any game song can be opened in the Studio and remixed.

```json
{
  "format": "olid-song",
  "version": 1,
  "title": "Harbor Demo",
  "bpm": 84,
  "key": "A",
  "scale": "minor",
  "loopFrom": 1,
  "instruments": { "Lead": { "type": "synth", "wave": "square", "color": "#9b87ff" } },
  "patterns": { "verse": { "steps": 32, "tracks": { "Lead": [[0, "E5", 3], [4, "C5", 2]] } } },
  "arrangement": ["verse", "verse"]
}
```

## Top level

| Field | Default | Meaning |
|---|---|---|
| `format` | required | Always `"olid-song"` |
| `version` | `1` | Bump if the format changes in a breaking way |
| `title`, `author` | | Shown in the Studio |
| `game` | `null` | Which game the song belongs to, if any |
| `bpm` | `120` | Tempo |
| `stepsPerBeat` | `4` | Grid resolution. 4 = sixteenth notes |
| `swing` | `0` | 0–1, delays every other step |
| `volume` | `1` | Overall song volume |
| `key`, `scale` | `"C"`, `"major"` | Used by the Studio's "In key" view; doesn't change playback |
| `loopFrom` | `0` | When looping, jump back to this index in `arrangement` (earlier blocks act as an intro) |
| `fx` | `{ "delaySteps": 3, "delayFeedback": 0.35 }` | The echo shared by all tracks: time in steps, repeats 0–0.9 |

## Instruments

The key is the track name. Every setting is optional.

**Synth** (`"type": "synth"`)

| Setting | Default | Meaning |
|---|---|---|
| `wave` | `square` | `sine`, `triangle`, `square`, `sawtooth`, `noise` |
| `volume`, `pan` | `0.3`, `0` | Pan from -1 (left) to 1 (right) |
| `attack`, `decay`, `sustain`, `release` | `0.01`, `0.1`, `0.6`, `0.15` | Envelope, in seconds (sustain is a level 0–1) |
| `filter` | `0` | Low-pass cutoff in Hz ("Brightness"). 0 = open |
| `resonance` | `0` | Filter peak, 0–20 |
| `filterEnv` | `0` | "Sweep": filter opens at the start of each note, 0–1 |
| `unison`, `spread` | `1`, `12` | Number of detuned voices (1–4) and how far apart in cents |
| `vibrato`, `vibratoRate` | `0`, `5` | Depth in cents, speed in Hz |
| `octave`, `detune` | `0`, `0` | Octave shift and fine tune in cents |
| `reverb`, `delay` | `0`, `0` | Send amounts 0–1 |
| `gain` | `1` | The track's fader level, 0–1.5 (separate from `volume`, which is part of the sound) |
| `color` | | Track color in the Studio |

**Drum** (`"type": "drum"`): `kind` (`kick`, `snare`, `clap`, `hat`, `openhat`, `tom`, `perc`), `volume`, `pan`, `pitch` (0.5–2×), `decay` (length multiplier), `reverb`, `delay`, `gain`, `color`.

## Patterns

A pattern is a loop of `steps` grid steps. `tracks` maps a track name to its notes:

```
[step, note, length, velocity]
```

- `step`: where it starts, from 0
- `note`: `"C4"`, `"F#3"`, `"Bb5"` or a MIDI number; `null` for drums
- `length`: in steps (default 1)
- `velocity`: 0–1 (default 1)

Drum hits can be written as just `[step]`.

A pattern can also store its chords, which the Studio's Easy mode uses for its chord strip and helpers:

- `chords`: one scale degree per chord slot (0 = the key's home chord, 3 = IV, 4 = V, 5 = vi…). A slot is 8 steps, or 16 in parts of 4 bars or more.
- `colors` (optional): an extension per slot: `""`, `"7"`, `"sus2"`, `"sus4"` or `"add9"`.

These only describe the harmony; the notes themselves are in `tracks`.

## Arrangement

The order patterns play in. Reusing a name repeats that pattern.

## Using it in a game

Games ask for a **slot**, so visitors can swap in their own song from the Studio (Studio menu → "Use in a game…"):

```js
import { createPlayer, loadGameSong } from "/music/player.js";

const music = createPlayer({ volume: 0.6 });
const song = await loadGameSong("stillwater/run", "/music/songs/stillwater-run.json");

// First play must happen inside a click or key handler (browser autoplay rules).
startButton.addEventListener("click", () => music.play(song));

music.play(otherSong, { fadeIn: 2 });  // switch tracks with a crossfade
music.stop({ fadeOut: 1.5 });
music.setVolume(0.3);
```

`loadGameSong` returns the visitor's song if they've picked one for that slot (stored in their browser), otherwise the default file.

To make a song or slot show up in the Studio, add it to `songs/index.json`:

```json
{
  "songs": [{ "file": "stillwater-run.json", "title": "Stillwater Run", "gameTitle": "Stillwater" }],
  "slots": [{ "id": "stillwater/run", "gameTitle": "Stillwater", "label": "Running music", "default": "stillwater-run.json" }]
}
```

Other player features: `music.preview(song, "Lead", "C5")` plays one note (handy for sound effects), `renderSong(song)` renders to an AudioBuffer, and `createPlayer({ context })` reuses a game's existing `AudioContext`.

## Making official game songs

Make the song in the Studio, then More → Download .json, put the file in `music/songs/` and add it to `songs/index.json`.
