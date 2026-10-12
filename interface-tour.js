export const INTERFACE_TOUR_STEPS = Object.freeze([
  { selector: ".deck-a", name: "Deck  音轨台", description: "Deck 是一条独立的歌曲播放通道。A 先播放朦胧心跳，B 稍后接入漂浮铃音。" },
  { selector: ".deck-a .transport-row", name: "BPM 与 Beat  速度和节拍", description: "BPM 表示每分钟有多少拍；Beat 是你能跟着数的单拍。两边速度一致，声音才容易衔接。" },
  { selector: "#syncB", name: "Sync  节拍同步", description: "Sync 会让 B 跳到和 A 相同的拍点。它只负责对齐，不会替你完成转场。" },
  { selector: "#handoff", name: "Crossfader  横向混音推杆", description: "向右推动时，A 逐渐变小，B 逐渐出现。停在中间，可以同时听见两首歌。" },
  { selector: ".deck-a .advanced-controls", name: "EQ  音色均衡", description: "EQ 用来调节低频、中频和高频。低频影响鼓点厚度，高频影响明亮感；第一次转场完成后再解锁。" }
]);

export class InterfaceTour {
  constructor(steps = INTERFACE_TOUR_STEPS) { this.steps = steps; this.index = 0; this.active = false; }
  start() { this.index = 0; this.active = true; return this.snapshot(); }
  next() {
    if (!this.active) return this.snapshot();
    if (this.index >= this.steps.length - 1) this.active = false;
    else this.index += 1;
    return this.snapshot();
  }
  skip() { this.active = false; return this.snapshot(); }
  snapshot() { return { active: this.active, index: this.index, total: this.steps.length, step: this.steps[this.index], isLast: this.index === this.steps.length - 1 }; }
}
