/**
 * Rareton's 8-bit soundtrack, composed for this game and synthesised live with Web Audio:
 * no recordings, samples or third-party music. A wistful 3/4 day waltz crossfades into a
 * music-box night lullaby, with a soft echo. Starts silent; call start() from a user gesture.
 */

type Voice = { wave: OscillatorType; gain: number; vibrato?: boolean; steps: readonly (string | null)[] };
type Track = { bpm: number; voices: readonly Voice[] };

const NOTE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const hz = (name: string) => {
  const match = /^([A-G])(#?)(\d)$/.exec(name)!;
  return 440 * 2 ** ((NOTE[match[1]] + (match[2] ? 1 : 0) + (Number(match[3]) + 1) * 12 - 69) / 12);
};
/** Space-separated 16th-note steps: a note starts, "-" holds the previous note, "." is a rest. */
const seq = (text: string) => text.trim().split(/\s+/).map(step => (step === "." ? null : step));

/** Bars are 3/4 waltz time: 12 sixteenth-note steps each. */
const DAY: Track = {
  bpm: 84,
  voices: [
    { wave: "square", gain: 0.035, vibrato: true, steps: seq(`
      A4 - - - - - C5 - - - F5 -     E5 - - - - - D5 - C5 - - -     D5 - - - - - - - F5 - D5 -     C5 - - - - - - - - - . .
      A4 - - - D5 - F5 - - - A5 -    G5 - - - E5 - - - C5 - - -     D5 - - - C5 - A#4 - - - A4 -   G4 - - - - - - - - - . .
      C6 - - - - - A5 - - - F5 -     G5 - - - - - E5 - - - C5 -     D5 - - - F5 - A#5 - - - A5 -   G5 - - - - - E5 - - - . .
      F5 - - - - - E5 - D5 - - -     C5 - - - E5 - - - A4 - - -     A#4 - - - D5 - - - C5 - A#4 -  A4 - - - - - - - - - . .`) },
    { wave: "triangle", gain: 0.08, steps: seq(`
      F2 - C3 - F3 - A3 - F3 - C3 -   A2 - E3 - A3 - C4 - A3 - E3 -   A#2 - F3 - A#3 - D4 - A#3 - F3 -   C3 - G3 - C4 - E4 - C4 - G3 -
      D3 - A3 - D4 - F4 - D4 - A3 -   A2 - E3 - A3 - C4 - A3 - E3 -   A#2 - F3 - A#3 - D4 - A#3 - F3 -   C3 - G3 - C4 - E4 - C4 - G3 -
      F2 - C3 - F3 - A3 - F3 - C3 -   A2 - E3 - A3 - C4 - A3 - E3 -   A#2 - F3 - A#3 - D4 - A#3 - F3 -   C3 - G3 - C4 - E4 - C4 - G3 -
      D3 - A3 - D4 - F4 - D4 - A3 -   A2 - E3 - A3 - C4 - A3 - E3 -   A#2 - F3 - A#3 - D4 - A#3 - F3 -   F2 - C3 - F3 - A3 - F3 - C3 -`) },
  ],
};

const NIGHT: Track = {
  bpm: 58,
  voices: [
    { wave: "triangle", gain: 0.07, vibrato: true, steps: seq(`
      E5 - - - - - - - D5 - C5 -     C5 - - - - - A4 - - - - -      G4 - - - C5 - - - E5 - - -     D5 - - - - - - - - - . .
      E5 - - - A5 - - - G5 - E5 -    F5 - - - E5 - - - C5 - - -     D5 - - - C5 - - - A4 - - -     G#4 - - - - - - - - - . .`) },
    { wave: "sine", gain: 0.08, steps: seq(`
      A2 - - - - - - - - - - -   F2 - - - - - - - - - - -   C3 - - - - - - - - - - -   G2 - - - - - - - - - - -
      A2 - - - - - - - - - - -   F2 - - - - - - - - - - -   D3 - - - - - - - - - - -   E2 - - - - - - - - - - -`) },
    { wave: "sine", gain: 0.02, steps: seq(`
      . . . . E6 . . . A6 . . .   . . . . F6 . . . C6 . . .   . . . . G6 . . . E6 . . .   . . . . D6 . . . B5 . . .
      . . . . C6 . . . E6 . . .   . . . . A5 . . . C6 . . .   . . . . F6 . . . D6 . . .   . . . . G#5 . . . B5 . . .`) },
  ],
};

export type Music = { start(): Promise<void>; stop(): void; setNight(night: boolean): void; setPaused(paused: boolean): void; dispose(): void };

export function createMusic(): Music {
  let audio: AudioContext | null = null, timer = 0, playing = false, night = false, held = false;
  let master: GainNode, dayBus: GainNode, nightBus: GainNode;
  const cursors = new Map<Track, { step: number; time: number }>();

  function setup() {
    audio = new AudioContext();
    master = audio.createGain(); master.gain.value = 0; master.connect(audio.destination);
    // A soft echo gives the chiptune a dreamy, far-away feel.
    const delay = audio.createDelay(1), feedback = audio.createGain(), wet = audio.createGain();
    delay.delayTime.value = 0.36; feedback.gain.value = 0.3; wet.gain.value = 0.28;
    master.connect(delay); delay.connect(feedback); feedback.connect(delay); delay.connect(wet); wet.connect(audio.destination);
    dayBus = audio.createGain(); nightBus = audio.createGain();
    dayBus.connect(master); nightBus.connect(master);
    dayBus.gain.value = night ? 0 : 1; nightBus.gain.value = night ? 1 : 0;
  }

  function play(bus: GainNode, voice: Voice, index: number, at: number, step: number) {
    const note = voice.steps[index];
    if (!note || note === "-" || !audio) return;
    let length = 1;
    while (voice.steps[(index + length) % voice.steps.length] === "-" && length < voice.steps.length) length++;
    const duration = length * step, amp = audio.createGain();
    amp.connect(bus);
    amp.gain.setValueAtTime(0, at);
    amp.gain.linearRampToValueAtTime(voice.gain, at + 0.03);
    amp.gain.setTargetAtTime(voice.gain * 0.7, at + 0.05, 0.25);
    amp.gain.setTargetAtTime(0, at + duration * 0.92, 0.05);
    const source = audio.createOscillator(), frequency = hz(note);
    source.type = voice.wave; source.frequency.value = frequency;
    if (voice.vibrato && duration > 0.3) {
      // Gentle vibrato that eases in on held notes.
      const lfo = audio.createOscillator(), depth = audio.createGain();
      lfo.frequency.value = 5; depth.gain.setValueAtTime(0, at); depth.gain.linearRampToValueAtTime(frequency * 0.006, at + 0.35);
      lfo.connect(depth); depth.connect(source.frequency); lfo.start(at); lfo.stop(at + duration + 0.2);
    }
    source.connect(amp); source.start(at); source.stop(at + duration + 0.3);
    source.onended = () => amp.disconnect();
  }

  /** Look-ahead scheduler: queue every note starting within the next 150 ms. */
  function schedule() {
    if (!audio || !playing) return;
    for (const [track, bus] of [[DAY, dayBus], [NIGHT, nightBus]] as const) {
      const step = 60 / track.bpm / 4, length = track.voices[0].steps.length;
      const cursor = cursors.get(track) ?? { step: 0, time: audio.currentTime + 0.05 };
      while (cursor.time < audio.currentTime + 0.15) {
        for (const voice of track.voices) play(bus, voice, cursor.step % voice.steps.length, cursor.time, step);
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
