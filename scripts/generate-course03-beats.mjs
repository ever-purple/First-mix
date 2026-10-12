import fs from 'node:fs';

const rate = 44100;
const duration = 24;
const length = rate * duration;

function makeBeat(bpm, variant) {
  const out = new Float32Array(length);
  const beat = 60 / bpm;
  let seed = variant === 'A' ? 9137 : 2903;
  const noise = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2147483648 - 1);
  const addKick = (time, freq, level) => {
    const start = Math.round(time * rate), n = Math.round(.28 * rate);
    for (let i = 0; i < n && start + i < length; i++) {
      const t = i / rate, env = Math.exp(-t * 17), sweep = freq + 54 * Math.exp(-t * 28);
      const body = Math.sin(2 * Math.PI * sweep * t) * env;
      const attack = Math.sin(2 * Math.PI * 145 * t) * Math.exp(-t * 72) * .38;
      out[start + i] += (body + attack) * level;
    }
  };
  const addHat = (time, level) => {
    const start = Math.round(time * rate), n = Math.round(.055 * rate);
    let last = 0;
    for (let i = 0; i < n && start + i < length; i++) {
      const t = i / rate, white = noise(), high = white - last * .88; last = white;
      out[start + i] += high * Math.exp(-t * 65) * level;
    }
  };
  const addClap = (time, level) => {
    const start = Math.round(time * rate), n = Math.round(.16 * rate);
    for (let i = 0; i < n && start + i < length; i++) {
      const t = i / rate;
      const burst = Math.exp(-t * 24) * (1 + .55 * Math.sin(2 * Math.PI * 31 * t));
      out[start + i] += noise() * burst * level;
    }
  };
  const addBass = (time, freq, level) => {
    const start = Math.round(time * rate), n = Math.round(.5 * rate);
    for (let i = 0; i < n && start + i < length; i++) {
      const t = i / rate;
      const attack = Math.min(1, t / .012), env = attack * Math.exp(-t * 5.6);
      const tone = Math.sin(2 * Math.PI * freq * t)
        + .62 * Math.sin(2 * Math.PI * freq * 2 * t)
        + .24 * Math.sin(2 * Math.PI * freq * 3 * t);
      out[start + i] += tone * env * level;
    }
  };
  const addChord = (time, frequencies, level) => {
    const start = Math.round(time * rate), n = Math.round(1.8 * rate);
    for (let i = 0; i < n && start + i < length; i++) {
      const t = i / rate, attack = Math.min(1, t / .08), env = attack * Math.exp(-t * 1.35);
      let tone = 0;
      for (const freq of frequencies) tone += Math.sin(2 * Math.PI * freq * t) + .12 * Math.sin(2 * Math.PI * freq * 2 * t);
      out[start + i] += tone / frequencies.length * env * level;
    }
  };
  for (let i = 0, time = 0; time < duration; i++, time = i * beat) {
    if (variant === 'A') {
      addKick(time, 64, 1.12);
      addHat(time + beat / 2, .055);
    } else {
      addHat(time + beat / 2, .035);
    }
  }
  if (variant === 'B') {
    const roots = [55, 43.65, 65.41, 49];
    const chords = [
      [220, 261.63, 329.63],
      [174.61, 220, 261.63],
      [196, 261.63, 329.63],
      [196, 246.94, 293.66],
    ];
    const hits = [0, 1.5, 2.5, 3.25];
    for (let bar = 0, time = 0; time < duration; bar++, time = bar * beat * 4) {
      const root = roots[bar % roots.length];
      addChord(time, chords[bar % chords.length], .16);
      hits.forEach((offset, index) => addBass(time + offset * beat, index === 2 ? root * 1.5 : root, index === 0 ? .68 : .5));
    }
  }
  for (let i = 0; i < out.length; i++) out[i] = Math.tanh(out[i] * 2.15);
  let peak = 0; for (const v of out) peak = Math.max(peak, Math.abs(v));
  const gain = .97 / peak; for (let i = 0; i < out.length; i++) out[i] *= gain;
  return out;
}

function writeWav(path, samples) {
  const bytes = Buffer.alloc(44 + samples.length * 2);
  bytes.write('RIFF', 0); bytes.writeUInt32LE(36 + samples.length * 2, 4); bytes.write('WAVE', 8);
  bytes.write('fmt ', 12); bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * 2, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) bytes.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  fs.writeFileSync(path, bytes);
}

writeWav('first-mix/assets/tracks/course-03-beat-a.wav', makeBeat(93, 'A'));
writeWav('first-mix/assets/tracks/course-03-beat-b.wav', makeBeat(80, 'B'));
