/**
 * Rareton's 8-bit soundtrack, composed for this game and synthesised live with Web Audio:
 * no recordings, samples or third-party music. A cheerful day loop crossfades into a
 * gentle night tune. Starts silent; call start() from a user gesture.
 */

type Voice = { wave: OscillatorType | "noise"; gain: number; steps: readonly (string | null)[] };
type Track = { bpm: number; voices: readonly Voice[] };

const NOTE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const hz = (name: string) => {
  const match = /^([A-G])(#?)(\d)$/.exec(name)!;
  return 440 * 2 ** ((NOTE[match[1]] + (match[2] ? 1 : 0) + (Number(match[3]) + 1) * 12 - 69) / 12);
};
/** Space-separated 16th-note steps: a note starts, "-" holds the previous note, "." is a rest. */
const seq = (text: string) => text.trim().split(/\s+/).map(step => (step === "." ? null : step));

const DAY: Track = {
  bpm: 112,
  voices: [
    { wave: "square", gain: 0.05, steps: seq(`
      E5 - G5 - C6 - G5 - E5 - D5 - C5 - D5 -   E5 - A5 - C6 - A5 - G5 - E5 - C5 - . .
      F5 - A5 - C6 - A5 - G5 - F5 - E5 - D5 -   D5 - G5 - B5 - D6 - C6 - B5 - G5 - . .
      E5 - G5 - C6 - G5 - E5 - D5 - C5 - D5 -   E5 - A5 - C6 - A5 - G5 - E5 - C5 - . .
      F5 - A5 - C6 - A5 - G5 - F5 - E5 - D5 -   D5 - G5 - F5 - D5 - C5 - - - . . . .`) },
    { wave: "triangle", gain: 0.12, steps: seq(`
      C3 - - - G3 - - - C3 - - - G3 - - -   A2 - - - E3 - - - A2 - - - E3 - - -
      F2 - - - C3 - - - F2 - - - C3 - - -   G2 - - - D3 - - - G2 - - - D3 - - -
      C3 - - - G3 - - - C3 - - - G3 - - -   A2 - - - E3 - - - A2 - - - E3 - - -
      F2 - - - C3 - - - F2 - - - C3 - - -   G2 - - - D3 - - - C3 - - - . . . .`) },
    { wave: "noise", gain: 0.025, steps: seq(Array(8).fill(". . x . . . x . . . x . . . x .").join(" ")) },
  ],
};

const NIGHT: Track = {
  bpm: 76,
  voices: [
    { wave: "triangle", gain: 0.09, steps: seq(`
      A4 - - - C5 - - - E5 - - - D5 - - -   C5 - - - A4 - - - F4 - - - - - - -
      G4 - - - C5 - - - E5 - - - G5 - - -   E5 - - - D5 - - - B4 - - - - - - -`) },
    { wave: "sine", gain: 0.1, steps: seq(`
      A2 - - - - - - - - - - - - - - -   F2 - - - - - - - - - - - - - - -
      C3 - - - - - - - - - - - - - - -   G2 - - - - - - - - - - - - - - -`) },
    { wave: "sine", gain: 0.025, steps: seq(`
      . . E6 . . . A5 . . . C6 . . . E6 .   . . F6 . . . C6 . . . A5 . . . C6 .
      . . G6 . . . E6 . . . C6 . . . E6 .   . . D6 . . . B5 . . . G5 . . . B5 .`) },
  ],
};

export type Music = { start(): Promise<void>; stop(): void; setNight(night: boolean): void; setPaused(paused: boolean): void; dispose(): void };

export function createMusic(): Music {
  let audio: AudioContext | null = null, timer = 0, playing = false, night = false, held = false;
  let master: GainNode, dayBus: GainNode, nightBus: GainNode, noise: AudioBuffer;
  const cursors = new Map<Track, { step: number; time: number }>();

  function setup() {
    audio = new AudioContext();
    master = audio.createGain(); master.gain.value = 0; master.connect(audio.destination);
    dayBus = audio.createGain(); nightBus = audio.createGain();
    dayBus.connect(master); nightBus.connect(master);
    dayBus.gain.value = night ? 0 : 1; nightBus.gain.value = night ? 1 : 0;
    noise = audio.createBuffer(1, audio.sampleRate * 0.05, audio.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }

  function play(track: Track, bus: GainNode, voice: Voice, index: number, at: number, step: number) {
    const note = voice.steps[index];
    if (!note || note === "-" || !audio) return;
    let length = 1;
    while (voice.steps[(index + length) % voice.steps.length] === "-" && length < voice.steps.length) length++;
    const duration = length * step, amp = audio.createGain();
    amp.connect(bus);
    amp.gain.setValueAtTime(0, at);
    amp.gain.linearRampToValueAtTime(voice.gain, at + 0.01);
    amp.gain.setTargetAtTime(voice.gain * 0.6, at + 0.03, 0.08);
    amp.gain.setTargetAtTime(0, at + duration * 0.9, 0.03);
    let source: AudioScheduledSourceNode;
    if (voice.wave === "noise") {
      const buffer = audio.createBufferSource(); buffer.buffer = noise; source = buffer;
    } else {
      const osc = audio.createOscillator(); osc.type = voice.wave; osc.frequency.value = hz(note); source = osc;
    }
    source.connect(amp); source.start(at); source.stop(at + duration + 0.2);
    source.onended = () => amp.disconnect();
    void track;
  }

  /** Look-ahead scheduler: queue every note starting within the next 150 ms. */
  function schedule() {
    if (!audio || !playing) return;
    for (const [track, bus] of [[DAY, dayBus], [NIGHT, nightBus]] as const) {
      const step = 60 / track.bpm / 4, length = track.voices[0].steps.length;
      const cursor = cursors.get(track) ?? { step: 0, time: audio.currentTime + 0.05 };
      while (cursor.time < audio.currentTime + 0.15) {
        for (const voice of track.voices) play(track, bus, voice, cursor.step % voice.steps.length, cursor.time, step);
        cursor.step = (cursor.step + 1) % length; cursor.time += step;
      }
      cursors.set(track, cursor);
    }
  }

  return {
    async start() {
      if (!audio) setup();
      await audio!.resume();
      playing = true; cursors.clear();
      master.gain.setTargetAtTime(1, audio!.currentTime, 0.3);
      window.clearInterval(timer); timer = window.setInterval(schedule, 40); schedule();
    },
    stop() {
      playing = false; window.clearInterval(timer);
      if (audio) master.gain.setTargetAtTime(0, audio.currentTime, 0.1);
    },
    setNight(value) {
      if (value === night) return;
      night = value;
      if (!audio) return;
      dayBus.gain.setTargetAtTime(night ? 0 : 1, audio.currentTime, 1.5);
      nightBus.gain.setTargetAtTime(night ? 1 : 0, audio.currentTime, 1.5);
    },
    setPaused(value) {
      if (value === held || !audio) return;
      held = value;
      if (held) void audio.suspend(); else if (playing) void audio.resume().then(() => { cursors.clear(); });
    },
    dispose() { playing = false; window.clearInterval(timer); void audio?.close(); audio = null; },
  };
}
