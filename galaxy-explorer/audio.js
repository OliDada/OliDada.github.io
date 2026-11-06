// Optional quiet engine drone, created only after an explicit sound-button gesture.
export function createEngineSound({ button, label, onError }) {
    let audioContext, engineGain, engineOsc, sound = false;
    button.onclick = async () => {
        try {
            if (!audioContext) {
                audioContext = new AudioContext();
                engineOsc = audioContext.createOscillator();
                engineOsc.type = "sine";
                engineGain = audioContext.createGain();
                engineGain.gain.value = 0;
                engineOsc.connect(engineGain).connect(audioContext.destination);
                engineOsc.start();
            }
            await audioContext.resume();
            sound = !sound;
            label.textContent = sound ? "ON" : "OFF";
            button.setAttribute("aria-label", sound ? "Disable sound" : "Enable sound");
        } catch {
            onError();
        }
    };
    return {
        // The audio context while sound is on (voices.js), else null.
        context: () => (sound && audioContext?.state === "running" ? audioContext : null),
        // active: engines audible (powered flight near a world).
        update(active, speed, verticalSpeed) {
            if (!engineGain) return;
            engineGain.gain.setTargetAtTime(
                sound && active ? 0.025 + Math.abs(speed) * 0.0004 + Math.abs(verticalSpeed) * 0.001 : 0,
                audioContext.currentTime,
                0.15,
            );
            engineOsc.frequency.setTargetAtTime(
                45 + Math.abs(speed) * 0.65 + Math.abs(verticalSpeed) * 1.2,
                audioContext.currentTime,
                0.15,
            );
        },
    };
}
