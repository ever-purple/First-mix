export function estimateBpmFromEnvelope(envelope, framesPerSecond, minBpm = 70, maxBpm = 180) {
  const minLag = Math.max(2, Math.floor(framesPerSecond * 60 / maxBpm));
  const maxLag = Math.min(envelope.length - 2, Math.ceil(framesPerSecond * 60 / minBpm));
  let best = { lag: 0, score: -Infinity };
  const scores = [];
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let score = 0;
    let energy = 0;
    for (let i = lag; i < envelope.length; i += 1) {
      score += envelope[i] * envelope[i - lag];
      energy += envelope[i] ** 2 + envelope[i - lag] ** 2;
    }
    score = energy ? score / energy * 2 : 0;
    scores.push(score);
    if (score > best.score) best = { lag, score };
  }
  const sorted = [...scores].sort((a, b) => b - a);
  const runnerUp = sorted[Math.min(3, sorted.length - 1)] || 0;
  return { bpm: Math.round(framesPerSecond * 60 / best.lag * 10) / 10, confidence: Math.max(0, Math.min(1, best.score - runnerUp + best.score * 0.35)) };
}

export function analyzeBpm(buffer) {
  const hop = 1024;
  const frames = Math.floor(buffer.length / hop);
  const envelope = new Float32Array(frames);
  let previous = 0;
  for (let frame = 0; frame < frames; frame += 1) {
    let sum = 0;
    for (let i = 0; i < hop; i += 1) {
      let sample = 0;
      for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) sample += buffer.getChannelData(channel)[frame * hop + i] || 0;
      sum += Math.abs(sample / buffer.numberOfChannels);
    }
    const energy = sum / hop;
    envelope[frame] = Math.max(0, energy - previous * 0.72);
    previous = energy;
  }
  if (envelope.length < 24) throw new Error("音频太短，无法估算 BPM");
  return estimateBpmFromEnvelope(envelope, buffer.sampleRate / hop);
}
