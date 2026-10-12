import { analyzeBpm } from "./bpm-analyzer.js";

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function equalPower(position) {
  const normalized = clamp((position + 1) / 2, 0, 1);
  return {
    a: Math.cos(normalized * Math.PI * 0.5),
    b: Math.sin(normalized * Math.PI * 0.5)
  };
}

export function dbToGain(db) {
  return Math.pow(10, db / 20);
}

export function beatLoopRegion(position, bpm, beats, duration) {
  const beatSeconds = 60 / (Number(bpm) || 120);
  const span = beatSeconds * beats;
  if (!Number.isFinite(duration) || duration <= span) return null;
  const latestStart = Math.floor((duration - span) / beatSeconds) * beatSeconds;
  const start = Math.min(Math.floor(Math.max(0, position) / beatSeconds) * beatSeconds, latestStart);
  return { start, end: start + span, beats };
}

export function loopedPosition(offset, elapsed, loop, duration) {
  const position = offset + elapsed;
  if (!loop) return ((position % duration) + duration) % duration;
  if (position < loop.end) return position;
  return loop.start + ((position - loop.end) % (loop.end - loop.start));
}

export const TRACK_PROFILES = Object.freeze({
  a: Object.freeze({ name: "雾中脉冲", character: "朦胧心跳与小调低音", register: "low", rhythm: "four-on-the-floor" }),
  b: Object.freeze({ name: "回声玻璃", character: "柔和铃音与漂浮和弦", register: "high", rhythm: "on-beat-melody" })
});

const TRAINING_STYLES = Object.freeze({
  hiphop: Object.freeze({ seed: 0, bass: [73.42,58.27,73.42,65.41], melody: [440,523.25,440,392,587.33,523.25,440,392], kick: 1, hat: .24 }),
  kpop: Object.freeze({ seed: 311, bass: [65.41,82.41,73.42,98], melody: [659.25,783.99,659.25,523.25,739.99,880,783.99,659.25], kick: .84, hat: .3 }),
  pop: Object.freeze({ seed: 719, bass: [73.42,87.31,65.41,98], melody: [523.25,659.25,783.99,659.25,587.33,698.46,880,698.46], kick: .92, hat: .18 }),
  folkfusion: Object.freeze({ seed: 1229, bass: [55,73.42,65.41,82.41], melody: [587.33,659.25,783.99,880,783.99,659.25,523.25,587.33], kick: .78, hat: .14 }),
  song: Object.freeze({
    seed: 1770,
    bpm: 112,
    beats: 32,
    introBeats: 8,
    bass: [65.41,65.41,87.31,98],
    // Beethoven's public-domain “Ode to Joy” theme, synthesized in-app.
    melody: [329.63,329.63,349.23,392,392,349.23,329.63,293.66,261.63,261.63,293.66,329.63,329.63,293.66,293.66,null],
    kick: .68,
    hat: .12,
    song: true
  })
});

const COURSE_TRACK_GROUPS = Object.freeze({
  intro: "intro",
  phrase: "c00",
  beat: "c01",
  prep: "c02",
  levels: "c03",
  eq: "c04",
  selection: "c05",
  final: "c06"
});

function seededNoise(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296 * 2 - 1;
  };
}

function addKick(channel, start, sampleRate, strength = 1) {
  const duration = 0.34;
  const count = Math.floor(duration * sampleRate);
  for (let i = 0; i < count && start + i < channel.length; i += 1) {
    const t = i / sampleRate;
    const frequency = 118 * Math.pow(0.42, t / duration);
    const envelope = Math.exp(-t * 13);
    channel[start + i] += Math.sin(2 * Math.PI * frequency * t) * envelope * 0.78 * strength;
  }
}

function addHat(channel, start, sampleRate, noise, strength = 1) {
  const count = Math.floor(0.07 * sampleRate);
  let previous = 0;
  for (let i = 0; i < count && start + i < channel.length; i += 1) {
    const t = i / sampleRate;
    const current = noise();
    const high = current - previous * 0.86;
    previous = current;
    channel[start + i] += high * Math.exp(-t * 52) * 0.14 * strength;
  }
}

function addClap(channel, start, sampleRate, noise, strength = 1) {
  for (const delay of [0, 0.013, 0.027]) {
    const offset = start + Math.floor(delay * sampleRate);
    const count = Math.floor(0.12 * sampleRate);
    let previous = 0;
    for (let i = 0; i < count && offset + i < channel.length; i += 1) {
      const t = i / sampleRate;
      const current = noise();
      const high = current - previous * 0.72;
      previous = current;
      channel[offset + i] += high * Math.exp(-t * 28) * 0.075 * strength;
    }
  }
}

function addTone(channel, start, duration, sampleRate, frequency, strength = 1) {
  const count = Math.floor(duration * sampleRate);
  for (let i = 0; i < count && start + i < channel.length; i += 1) {
    const t = i / sampleRate;
    const attack = Math.min(1, t * 22);
    const release = Math.max(0, 1 - t / duration);
    const tone = Math.sin(2 * Math.PI * frequency * t) + 0.22 * Math.sin(4 * Math.PI * frequency * t);
    channel[start + i] += tone * attack * release * 0.12 * strength;
  }
}

function addPluck(channel, start, sampleRate, frequency, strength = 1) {
  const duration = 0.42;
  const count = Math.floor(duration * sampleRate);
  for (let i = 0; i < count && start + i < channel.length; i += 1) {
    const t = i / sampleRate;
    const envelope = Math.exp(-t * 7.2) * Math.min(1, t * 55);
    const shimmer = Math.sin(2 * Math.PI * frequency * t)
      + 0.2 * Math.sin(2 * Math.PI * frequency * 2 * t)
      + 0.05 * Math.sin(2 * Math.PI * frequency * 3 * t);
    channel[start + i] += shimmer * envelope * 0.078 * strength;
  }
}

function addPad(channel, start, duration, sampleRate, frequencies, strength = 1) {
  const count = Math.floor(duration * sampleRate);
  for (let i = 0; i < count && start + i < channel.length; i += 1) {
    const t = i / sampleRate;
    const attack = Math.min(1, t * 2.8);
    const release = Math.min(1, Math.max(0, (duration - t) * 2.2));
    const sway = 0.88 + Math.sin(2 * Math.PI * 0.22 * t) * 0.12;
    let value = 0;
    for (const frequency of frequencies) value += Math.sin(2 * Math.PI * frequency * t) / frequencies.length;
    channel[start + i] += value * attack * release * sway * 0.1 * strength;
  }
}

function normalize(channel) {
  let peak = 0;
  for (let i = 0; i < channel.length; i += 1) peak = Math.max(peak, Math.abs(channel[i]));
  if (peak <= 0.92) return;
  const scale = 0.92 / peak;
  for (let i = 0; i < channel.length; i += 1) channel[i] *= scale;
}

export function createTrainingBuffer(context, variant = "a", styleName = "hiphop") {
  const style = TRAINING_STYLES[styleName] || TRAINING_STYLES.hiphop;
  const bpm = style.bpm || 120;
  const beats = style.beats || 16;
  const beatSeconds = 60 / bpm;
  const duration = beats * beatSeconds;
  const buffer = context.createBuffer(2, Math.floor(duration * context.sampleRate), context.sampleRate);
  const noise = seededNoise((variant === "a" ? 1948 : 2718) + style.seed);
  // Both tracks share the same Dm–Bb–F–C harmonic world.
  const bassNotes = style.bass;
  // Restrained D-minor motif: memorable without sounding like an ascending exercise scale.
  const melody = style.melody;
  const padChords = [
    [293.66, 349.23, 440],
    [233.08, 293.66, 349.23],
    [261.63, 349.23, 440],
    [261.63, 329.63, 392]
  ];

  for (let channelIndex = 0; channelIndex < 2; channelIndex += 1) {
    const channel = buffer.getChannelData(channelIndex);
    for (let beat = 0; beat < beats; beat += 1) {
      const start = Math.floor(beat * beatSeconds * context.sampleRate);
      if (variant === "a") {
        addKick(channel, start, context.sampleRate, beat % 4 === 0 ? style.kick : style.kick * .74);
        if (beat % 4 === 1 || beat % 4 === 3) addClap(channel, start, context.sampleRate, noise, 0.24);
        addHat(channel, start + Math.floor(beatSeconds * 0.5 * context.sampleRate), context.sampleRate, noise, style.hat);
        addTone(channel, start, beatSeconds * 0.96, context.sampleRate, bassNotes[Math.floor(beat / 4) % bassNotes.length], channelIndex ? 0.9 : 1);
        if (style.song) {
          if (beat % 4 === 0) addPad(channel, start, beatSeconds * 4, context.sampleRate, padChords[Math.floor(beat / 4) % padChords.length], channelIndex ? .72 : .66);
          if (beat >= style.introBeats) {
            const note = melody[(beat - style.introBeats) % melody.length];
            if (note) addPluck(channel, start, context.sampleRate, note * (channelIndex ? 1.002 : 1), channelIndex ? 1.36 : 1.42);
          }
        }
      } else {
        // B has no percussion, kick, or bass. One clear note lands exactly on every main beat.
        const note = melody[beat % melody.length];
        addPluck(channel, start, context.sampleRate, note * (channelIndex ? 1.002 : 1), channelIndex ? 0.94 : 1);
        if (beat % 4 === 0) addPad(channel, start, beatSeconds * 4, context.sampleRate, padChords[Math.floor(beat / 4) % padChords.length], channelIndex ? 1 : 0.92);
      }
    }
    normalize(channel);
  }
  return { buffer, bpm, duration };
}

class Deck {
  constructor(context, master, variant, trainingStyle = "hiphop") {
    this.context = context;
    this.variant = variant;
    this.trainingStyle = trainingStyle;
    this.track = createTrainingBuffer(context, variant, trainingStyle);
    this.trainingTrack = this.track;
    this.input = context.createGain();
    this.low = context.createBiquadFilter();
    this.mid = context.createBiquadFilter();
    this.high = context.createBiquadFilter();
    this.filter = context.createBiquadFilter();
    this.volume = context.createGain();
    this.cross = context.createGain();
    this.low.type = "lowshelf";
    this.low.frequency.value = 250;
    this.mid.type = "peaking";
    this.mid.frequency.value = 1200;
    this.mid.Q.value = 0.8;
    this.high.type = "highshelf";
    this.high.frequency.value = 4200;
    this.filter.type = "lowpass";
    this.filter.frequency.value = 20000;
    this.filter.Q.value = 0.7;
    this.input.connect(this.low).connect(this.mid).connect(this.high).connect(this.filter).connect(this.volume).connect(this.cross).connect(master);
    this.source = null;
    this.startedAt = 0;
    this.offset = 0;
    this.cuePoint = 0;
    this.cueSaved = false;
    this.playing = false;
    this.playbackRate = 1;
    this.beatLoop = null;
  }

  play(offset = this.offset) {
    if (this.playing) return;
    this.source = this.context.createBufferSource();
    this.source.buffer = this.track.buffer;
    this.source.loop = true;
    if (this.beatLoop) {
      this.source.loopStart = this.beatLoop.start;
      this.source.loopEnd = this.beatLoop.end;
    }
    this.source.playbackRate.value = this.playbackRate;
    this.source.connect(this.input);
    this.offset = ((offset % this.track.duration) + this.track.duration) % this.track.duration;
    if (this.beatLoop && (this.offset < this.beatLoop.start || this.offset >= this.beatLoop.end)) this.offset = this.beatLoop.start;
    this.startedAt = this.context.currentTime;
    this.source.start(0, this.offset);
    this.playing = true;
  }

  pause() {
    if (!this.playing || !this.source) return;
    this.offset = this.position();
    this.source.stop();
    this.source.disconnect();
    this.source = null;
    this.playing = false;
  }

  position() {
    if (!this.playing) return this.offset;
    return loopedPosition(this.offset, (this.context.currentTime - this.startedAt) * this.playbackRate, this.beatLoop, this.track.duration);
  }

  alignTo(seconds) {
    const wasPlaying = this.playing;
    this.pause();
    this.offset = seconds % this.track.duration;
    if (wasPlaying) this.play(this.offset);
  }

  setBeatLoop(beats) {
    const region = beatLoopRegion(this.position(), this.track.bpm, beats, this.track.duration);
    if (!region) return null;
    const wasPlaying = this.playing;
    if (wasPlaying) this.pause();
    this.beatLoop = region;
    this.offset = region.start;
    if (wasPlaying) this.play(region.start);
    return region;
  }

  clearBeatLoop() {
    if (!this.beatLoop) return false;
    const wasPlaying = this.playing;
    if (wasPlaying) this.pause();
    this.beatLoop = null;
    if (wasPlaying) this.play(this.offset);
    return true;
  }

  setEq(band, db) {
    const node = { low: this.low, mid: this.mid, high: this.high }[band];
    if (node) node.gain.setTargetAtTime(clamp(db, -12, 12), this.context.currentTime, 0.025);
  }

  setVolume(value) {
    this.volume.gain.setTargetAtTime(clamp(value, 0, 1), this.context.currentTime, 0.025);
  }

  setFilter(value) {
    const amount = clamp(value, -1, 1);
    if (amount < 0) {
      this.filter.type = "lowpass";
      this.filter.frequency.setTargetAtTime(20000 * Math.pow(0.018, -amount), this.context.currentTime, 0.025);
    } else if (amount > 0) {
      this.filter.type = "highpass";
      this.filter.frequency.setTargetAtTime(20 * Math.pow(250, amount), this.context.currentTime, 0.025);
    } else {
      this.filter.type = "lowpass";
      this.filter.frequency.setTargetAtTime(20000, this.context.currentTime, 0.025);
    }
  }

  setCuePoint() {
    if (this.playing) return this.cuePoint;
    this.cuePoint = this.position();
    this.cueSaved = true;
    return this.cuePoint;
  }

  returnToCue() {
    if (this.playing) this.pause();
    this.offset = this.cuePoint;
    return this.cuePoint;
  }

  replaceTrack(buffer) {
    if (this.playing) this.pause();
    this.track = { buffer, bpm: null, duration: buffer.duration };
    this.playbackRate = 1;
    this.offset = 0;
    this.cuePoint = 0;
    this.cueSaved = false;
    this.beatLoop = null;
  }

  restoreTraining() {
    if (this.playing) this.pause();
    this.track = this.trainingTrack;
    this.playbackRate = 1;
    this.offset = 0;
    this.cuePoint = 0;
    this.cueSaved = false;
    this.beatLoop = null;
  }

  useTrainingStyle(styleName) {
    if (styleName === this.trainingStyle && this.track === this.trainingTrack) return;
    if (this.playing) this.pause();
    this.trainingStyle = styleName;
    this.trainingTrack = createTrainingBuffer(this.context, this.variant, styleName);
    this.track = this.trainingTrack;
    this.playbackRate = 1;
    this.offset = 0;
    this.cuePoint = 0;
    this.cueSaved = false;
    this.beatLoop = null;
  }

  setBpm(bpm) { this.track.bpm = clamp(Number(bpm) || 120, 60, 200); }

  syncTempoTo(targetBpm) {
    if (!this.track.bpm) return false;
    const wasPlaying = this.playing;
    const position = this.position();
    if (wasPlaying) this.pause();
    this.playbackRate = clamp(targetBpm / this.track.bpm, 0.5, 2);
    this.offset = position;
    if (wasPlaying) this.play(position);
    return true;
  }
}

export class AudioEngine extends EventTarget {
  constructor() {
    super();
    this.context = null;
    this.master = null;
    this.analyser = null;
    this.waveformData = null;
    this.captureDestination = null;
    this.recorder = null;
    this.recordingStartedAt = 0;
    this.recordingStartedAtEpoch = 0;
    this.decks = {};
    this.crossfader = 0;
    this.trainingStyle = "hiphop";
  }

  async initialize() {
    if (this.context && this.master && this.decks.a && this.decks.b) {
      await this.context.resume();
      return;
    }
    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error("当前浏览器不支持 Web Audio API");
      this.context = new AudioContextClass({ latencyHint: "interactive" });
    }
    if (!this.master) {
      this.master = this.context.createGain();
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.74;
      this.waveformData = new Uint8Array(this.analyser.fftSize);
      this.master.gain.value = 0.72;
      this.master.connect(this.analyser).connect(this.context.destination);
      this.captureDestination = this.context.createMediaStreamDestination();
      this.master.connect(this.captureDestination);
    }
    if (!this.decks.a) this.decks.a = new Deck(this.context, this.master, "a", this.trainingStyle);
    if (!this.decks.b) this.decks.b = new Deck(this.context, this.master, "b", this.trainingStyle);
    this.decks.a.setVolume(0.8);
    this.decks.b.setVolume(0.8);
    this.setCrossfader(-1);
    await this.context.resume();
    this.dispatchEvent(new CustomEvent("ready", { detail: this.snapshot() }));
  }

  readWaveform() {
    if (!this.analyser || !this.waveformData) return null;
    this.analyser.getByteTimeDomainData(this.waveformData);
    return this.waveformData;
  }

  async startRecording() {
    await this.initialize();
    if (!window.MediaRecorder) throw new Error("当前浏览器不支持录音保存");
    if (this.recorder?.state === "recording") return;
    const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"].find(type => MediaRecorder.isTypeSupported(type));
    const chunks = [];
    this.recorder = new MediaRecorder(this.captureDestination.stream, preferred ? { mimeType: preferred } : undefined);
    this.recorder.addEventListener("dataavailable", event => { if (event.data.size) chunks.push(event.data); });
    this.recordingStartedAt = performance.now();
    this.recordingStartedAtEpoch = Date.now();
    this.recorder.start(250);
    this.recordingChunks = chunks;
  }

  stopRecording() {
    return new Promise((resolve, reject) => {
      if (!this.recorder || this.recorder.state !== "recording") return reject(new Error("当前没有正在录制的 Mix"));
      const recorder = this.recorder;
      recorder.addEventListener("stop", () => {
        const duration = Math.max(1, (performance.now() - this.recordingStartedAt) / 1000, (Date.now() - this.recordingStartedAtEpoch) / 1000);
        resolve({ blob: new Blob(this.recordingChunks, { type: recorder.mimeType || "audio/webm" }), duration, type: recorder.mimeType || "audio/webm" });
        this.recorder = null;
        this.recordingChunks = [];
      }, { once: true });
      recorder.addEventListener("error", event => reject(event.error || new Error("录音失败")), { once: true });
      recorder.stop();
    });
  }

  async toggle(deckId) {
    await this.initialize();
    const deck = this.decks[deckId];
    if (deck.playing) deck.pause(); else deck.play();
    this.emit("transport", { deck: deckId, playing: deck.playing });
  }

  async syncB() {
    await this.initialize();
    const deckA = this.decks.a;
    const deckB = this.decks.b;
    const targetBpm = (deckA.track.bpm || 120) * deckA.playbackRate;
    if (targetBpm && deckB.track.bpm) deckB.syncTempoTo(targetBpm);
    const aBeat = 60 / targetBpm;
    const bBeat = 60 / (deckB.track.bpm || 120);
    const phase = (deckA.position() % aBeat) / aBeat;
    const currentB = deckB.position();
    const reference = Math.floor(currentB / bBeat) * bBeat + phase * bBeat;
    // SYNC prepares tempo and phase only. Transport remains an explicit PLAY action.
    deckB.alignTo(reference);
    this.emit("sync", { offset: reference, bpm: targetBpm || null, rate: deckB.playbackRate });
  }

  setVolume(deckId, value) {
    this.decks[deckId]?.setVolume(value);
    this.emit("control", { deck: deckId, control: "volume", value });
  }

  setEq(deckId, band, db) {
    this.decks[deckId]?.setEq(band, db);
    this.emit("control", { deck: deckId, control: band, value: db });
  }

  setFilter(deckId, value) {
    this.decks[deckId]?.setFilter(value);
    this.emit("control", { deck: deckId, control: "filter", value });
  }

  setBeatLoop(deckId, beats) {
    const deck = this.decks[deckId];
    if (!deck || ![1, 2, 4, 8, 16, 32].includes(beats)) return null;
    const region = deck.setBeatLoop(beats);
    if (region) this.emit("beatloop", { deck: deckId, active: true, ...region });
    return region;
  }

  clearBeatLoop(deckId) {
    const deck = this.decks[deckId];
    if (!deck?.clearBeatLoop()) return false;
    this.emit("beatloop", { deck: deckId, active: false });
    return true;
  }

  cueDeck(deckId) {
    const deck = this.decks[deckId];
    if (!deck) return null;
    const action = deck.playing && deck.cueSaved ? "return" : "set";
    if (action === "set" && deck.playing) deck.pause();
    const position = action === "return" ? deck.returnToCue() : deck.setCuePoint();
    this.emit("transport", { deck: deckId, playing: false });
    this.emit("cue", { deck: deckId, action, position });
    return { action, position };
  }

  setCrossfader(value) {
    this.crossfader = clamp(value, -1, 1);
    const gains = equalPower(this.crossfader);
    if (this.context) {
      this.decks.a.cross.gain.setTargetAtTime(gains.a, this.context.currentTime, 0.018);
      this.decks.b.cross.gain.setTargetAtTime(gains.b, this.context.currentTime, 0.018);
    }
    this.emit("crossfader", { value: this.crossfader, ...gains });
    return gains;
  }

  async previewEffect(kind) {
    await this.initialize();
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = kind === "echo" ? "triangle" : "sawtooth";
    oscillator.frequency.setValueAtTime(kind === "echo" ? 330 : 180, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.35);

    if (kind === "filter") {
      const filter = this.context.createBiquadFilter();
      filter.type = "lowpass";
      filter.Q.value = 6;
      filter.frequency.setValueAtTime(480, now);
      filter.frequency.exponentialRampToValueAtTime(9200, now + 1.12);
      oscillator.connect(filter).connect(gain).connect(this.master);
    } else {
      const delay = this.context.createDelay(1);
      const feedback = this.context.createGain();
      delay.delayTime.value = 0.22;
      feedback.gain.value = 0.38;
      delay.connect(feedback).connect(delay);
      oscillator.connect(gain).connect(this.master);
      gain.connect(delay).connect(this.master);
    }
    oscillator.start(now);
    oscillator.stop(now + 1.45);
  }

  async previewTeachingDemo(kind) {
    await this.initialize();
    const context = this.context;
    const start = context.currentTime + 0.04;
    const bus = context.createGain();
    bus.gain.value = 0.62;
    bus.connect(this.master);

    const pulse = (time, frequency = 74, volume = 0.2) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, time);
      oscillator.frequency.exponentialRampToValueAtTime(42, time + 0.16);
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(volume, time + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.2);
      oscillator.connect(gain).connect(bus);
      oscillator.start(time);
      oscillator.stop(time + 0.22);
    };
    const pluck = (time, frequency, destination = bus, volume = 0.09) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(frequency, time);
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(volume, time + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.3);
      oscillator.connect(gain).connect(destination);
      oscillator.start(time);
      oscillator.stop(time + 0.32);
    };

    if (kind === "beatmatch") {
      // First half deliberately flams; second half locks both kicks together.
      for (let beat = 0; beat < 4; beat += 1) {
        pulse(start + beat * 0.5, 76, 0.18);
        pulse(start + beat * 0.5 + 0.13, 108, 0.12);
      }
      for (let beat = 0; beat < 4; beat += 1) {
        const time = start + 2.2 + beat * 0.5;
        pulse(time, 76, 0.18);
        pulse(time, 108, 0.12);
      }
    } else if (kind === "bassswap") {
      for (let beat = 0; beat < 8; beat += 1) {
        const time = start + beat * 0.5;
        pulse(time, beat < 4 ? 68 : 96, 0.2);
        pluck(time + 0.08, beat < 4 ? 293.66 : 440, bus, 0.065);
      }
    } else if (kind === "filter") {
      const filter = context.createBiquadFilter();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sawtooth";
      oscillator.frequency.value = 146.83;
      filter.type = "lowpass";
      filter.Q.value = 8;
      filter.frequency.setValueAtTime(14000, start);
      filter.frequency.setValueAtTime(14000, start + 1.2);
      filter.frequency.exponentialRampToValueAtTime(320, start + 2.8);
      filter.frequency.exponentialRampToValueAtTime(9000, start + 3.9);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.075, start + 0.04);
      gain.gain.setValueAtTime(0.075, start + 3.8);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 4.1);
      oscillator.connect(filter).connect(gain).connect(bus);
      oscillator.start(start);
      oscillator.stop(start + 4.15);
      for (let beat = 0; beat < 8; beat += 1) pulse(start + beat * 0.5, 72, 0.12);
    } else {
      const delay = context.createDelay(1);
      const feedback = context.createGain();
      const wet = context.createGain();
      delay.delayTime.value = 0.28;
      feedback.gain.value = 0.48;
      wet.gain.value = 0.7;
      delay.connect(feedback).connect(delay);
      delay.connect(wet).connect(bus);
      for (let beat = 0; beat < 5; beat += 1) {
        const destination = beat < 3 ? bus : delay;
        pluck(start + beat * 0.5, [392, 440, 523.25, 587.33, 659.25][beat], destination, 0.12);
      }
      pulse(start, 76, 0.14);
      pulse(start + 0.5, 76, 0.14);
      pulse(start + 1, 76, 0.14);
    }

    await new Promise(resolve => window.setTimeout(resolve, 4200));
    try { bus.disconnect(); } catch { /* nodes may already be released by the browser */ }
  }

  async loadLocalBuffer(deckId, arrayBuffer) {
    await this.initialize();
    const buffer = await this.context.decodeAudioData(arrayBuffer.slice(0));
    if (!buffer?.duration || buffer.duration < 1) throw new Error("音频内容太短或无法读取");
    this.decks[deckId].replaceTrack(buffer);
    const analysis = analyzeBpm(buffer);
    this.decks[deckId].setBpm(analysis.bpm);
    this.emit("trackloaded", { deck: deckId, duration: buffer.duration, local: true, ...analysis });
    return { duration: buffer.duration, ...analysis };
  }

  static async trackManifest() {
    if (AudioEngine.manifestCache) return AudioEngine.manifestCache;
    const response = await fetch("./assets/tracks/lesson-tracks.json");
    if (!response.ok) throw new Error("曲目清单不可用");
    AudioEngine.manifestCache = await response.json();
    return AudioEngine.manifestCache;
  }

  async loadCourseTracks(courseKey) {
    const group = COURSE_TRACK_GROUPS[courseKey];
    if (!group) return null;
    await this.initialize();
    const manifest = await AudioEngine.trackManifest();
    const picks = manifest.filter((track) => track.course === group && track.autoLoad !== false);
    if (!picks.length) return null;
    const loaded = [];
    for (const pick of picks) {
      const response = await fetch(`./${pick.file}`);
      if (!response.ok) throw new Error(`曲目加载失败：${pick.file}`);
      const info = await this.loadLocalBuffer(pick.deck, await response.arrayBuffer());
      // 清单里已实测的 BPM 优先：运行时 analyzeBpm 在 hop=1024 下只有约 ±3 BPM 的分辨率
      const knownBpm = Number.isFinite(pick.bpm) ? pick.bpm : null;
      if (knownBpm) this.setTrackBpm(pick.deck, knownBpm);
      loaded.push({
        ...pick,
        duration: info.duration,
        bpm: knownBpm ?? info.bpm,
        confidence: knownBpm ? pick.bpmConfidence || "manifest" : info.confidence
      });
    }
    this.courseTracks = { course: courseKey, tracks: loaded };
    this.emit("coursetracks", { course: courseKey, tracks: loaded });
    return loaded;
  }

  setTrackBpm(deckId, bpm) { this.decks[deckId]?.setBpm(bpm); }

  setDeckTempo(deckId, bpm) {
    const deck = this.decks[deckId];
    if (!deck) return false;
    const changed = deck.syncTempoTo(clamp(Number(bpm) || 120, 60, 200));
    if (changed) this.emit("control", { deck: deckId, control: "tempo", value: Number(bpm), rate: deck.playbackRate });
    return changed;
  }

  setTrainingStyle(styleName) {
    this.trainingStyle = TRAINING_STYLES[styleName] ? styleName : "hiphop";
    this.decks.a?.useTrainingStyle(this.trainingStyle);
    this.decks.b?.useTrainingStyle(this.trainingStyle);
    this.setCrossfader(-1);
    this.emit("trainingstyle", { style: this.trainingStyle });
  }

  restoreTrainingTracks() {
    this.decks.a?.restoreTraining();
    this.decks.b?.restoreTraining();
    this.setCrossfader(-1);
    this.emit("tracksrestored", { local: false });
  }

  snapshot() {
    return {
      contextState: this.context?.state || "uninitialized",
      sampleRate: this.context?.sampleRate || null,
      baseLatency: this.context?.baseLatency ?? null,
      crossfader: this.crossfader,
      a: this.decks.a ? { playing: this.decks.a.playing, position: this.decks.a.position(), cuePoint: this.decks.a.cuePoint } : null,
      b: this.decks.b ? { playing: this.decks.b.playing, position: this.decks.b.position(), cuePoint: this.decks.b.cuePoint } : null
    };
  }

  emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}
