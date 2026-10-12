export const TUTORIAL_STEPS = Object.freeze({
  PLAY: 0,
  LISTEN: 1,
  SYNC: 2,
  QUICK_MIX: 3,
  CUT_B_LOW: 4,
  INTRO_B: 5,
  SWAP_LOW: 6,
  MOVE_MID: 7,
  CLEAN_HIGH: 8,
  B_ONLY: 9,
  COMPLETE: 10
});

export const TUTORIAL_COPY = Object.freeze([
  { name: "", title: "先播放 Deck A", hint: "点击左侧唱盘下方的“播放 A”，先听清稳定鼓点。" },
  { name: "", title: "跟着底鼓数四拍", hint: "跟着低沉的鼓点数 1、2、3、4。" },
  { name: "", title: "对齐 Deck B", hint: "按 SYNC B，让两首歌从相同拍点继续。" },
  { name: "", title: "同时听见 A 和 B", hint: "把 Crossfader 推到中间。本节不用调整 EQ。" },
  { name: "", title: "先切掉 B 的低频", hint: "把 B 低频拉到 −12 dB，避免两个底鼓重叠。" },
  { name: "", title: "引入 B 的中高频", hint: "把 Crossfader 推到中间。" },
  { name: "", title: "交换低频", hint: "先把 A 低频降到 −12 dB，再把 B 低频升回 0 dB。" },
  { name: "", title: "收掉 A 的中频", hint: "把 A 中频降到 −8 dB。" },
  { name: "", title: "收掉 A 的高频", hint: "把 A 高频降到 −8 dB。" },
  { name: "", title: "只留下 B", hint: "把 Crossfader 推到最右。" },
  { name: "", title: "转场完成", hint: "A 已退出，B 接住了音乐。" }
]);

export function phrasePosition(seconds, bpm = 120, phraseBeats = 16) {
  const beatSeconds = 60 / bpm;
  const exactBeat = Math.max(0, seconds) / beatSeconds;
  const beatIndex = Math.floor(exactBeat) % phraseBeats;
  return {
    beatIndex,
    beat: beatIndex + 1,
    bar: Math.floor(beatIndex / 4) + 1,
    phase: exactBeat - Math.floor(exactBeat),
    isPhraseStart: beatIndex === 0 && exactBeat - Math.floor(exactBeat) < 0.55
  };
}

const COACH_HINTS = Object.freeze({
  0: ["先点右上角“启动声音”，再点绿色的“播放 A”。", "如果没有声音，检查设备音量，然后再次点击“启动声音”。"],
  1: ["暂时不用操作，只跟着心跳数 1、2、3、4。", "听到四下稳定的低沉声音后，下一步会自动出现。"],
  2: ["找到 Deck B 中变绿的 SYNC B，然后点击它。", "SYNC 只负责对齐拍点，不会立刻改变你正在听到的声音。"],
  3: ["把中间的 Crossfader 推到正中央。", "00 课只体验声音交接，不要求你操作 EQ。"],
  4: ["找到 Deck B 的“低频”推杆，拉到最左边 −12 dB。", "低频是底鼓和贝斯的重量。先切掉 B 的重量，避免两个底鼓重叠。"],
  5: ["把中间的 Crossfader 推到正中央。", "此时 A 提供底鼓，B 只带来较轻的旋律和高频。"],
  6: ["先把 A 低频降到 −12 dB，再把 B 低频升到 0 dB。", "顺序很重要：先让旧底鼓退出，再让新底鼓进入。"],
  7: ["把 A 的中频拉到 −8 dB 或更低。", "中频承载多数旋律；你会听见 A 从主角变成背景。"],
  8: ["把 A 的高频拉到 −8 dB 或更低。", "高频是镲片和亮度。收掉它，A 就不会继续抢注意力。"],
  9: ["把 Crossfader 从中间慢慢推到最右边。", "最右边只剩 B；A 的所有声音都会退出。"],
  10: ["你已经完成了转场。可以重练，或选择下一章。"]
});

export class TutorialMachine {
  constructor() {
    this.course = "quick";
    this.reset();
  }

  setCourse(course) {
    this.course = course === "eq" ? "eq" : "quick";
    return this.reset();
  }

  reset() {
    this.step = TUTORIAL_STEPS.PLAY;
    this.hintLevel = 0;
    this.listenStartedAt = null;
    return this.snapshot();
  }

  startAt(step) {
    this.step = step;
    this.hintLevel = 0;
    this.listenStartedAt = null;
    return this.snapshot();
  }

  dispatch(type, payload = {}) {
    if (type === "PLAY_A" && this.step === TUTORIAL_STEPS.PLAY) {
      this.step = TUTORIAL_STEPS.LISTEN;
      this.listenStartedAt = payload.now ?? 0;
    } else if (type === "TICK" && this.step === TUTORIAL_STEPS.LISTEN) {
      if ((payload.now ?? 0) - this.listenStartedAt >= 2000) this.step = TUTORIAL_STEPS.SYNC;
    } else if (type === "SYNC_B" && this.step === TUTORIAL_STEPS.SYNC) {
      this.step = this.course === "eq" ? TUTORIAL_STEPS.CUT_B_LOW : TUTORIAL_STEPS.QUICK_MIX;
    } else if (type === "HEARD_MIX" && this.step === TUTORIAL_STEPS.QUICK_MIX) {
      this.step = TUTORIAL_STEPS.B_ONLY;
    } else if (type === "CUT_B_LOW" && this.step === TUTORIAL_STEPS.CUT_B_LOW) {
      this.step = TUTORIAL_STEPS.INTRO_B;
    } else if (type === "HEARD_MIX" && this.step === TUTORIAL_STEPS.INTRO_B) {
      this.step = TUTORIAL_STEPS.SWAP_LOW;
    } else if (type === "SWAPPED_LOW" && this.step === TUTORIAL_STEPS.SWAP_LOW) {
      this.step = TUTORIAL_STEPS.MOVE_MID;
    } else if (type === "MOVED_MID" && this.step === TUTORIAL_STEPS.MOVE_MID) {
      this.step = TUTORIAL_STEPS.CLEAN_HIGH;
    } else if (type === "CLEANED_HIGH" && this.step === TUTORIAL_STEPS.CLEAN_HIGH) {
      this.step = TUTORIAL_STEPS.B_ONLY;
    } else if (type === "HEARD_B_ONLY" && this.step === TUTORIAL_STEPS.B_ONLY) {
      this.step = TUTORIAL_STEPS.COMPLETE;
    }
    if (type !== "TICK") this.hintLevel = 0;
    return this.snapshot();
  }

  coach() {
    const hints = COACH_HINTS[this.step];
    const message = hints[Math.min(this.hintLevel, hints.length - 1)];
    this.hintLevel += 1;
    return message;
  }

  snapshot() {
    return {
      step: this.step,
      copy: TUTORIAL_COPY[this.step],
      course: this.course,
      canSync: this.step >= TUTORIAL_STEPS.SYNC,
      canCrossfade: this.step === TUTORIAL_STEPS.QUICK_MIX || this.step >= TUTORIAL_STEPS.INTRO_B,
      canAdjustEq: this.course === "eq" && this.step >= TUTORIAL_STEPS.CUT_B_LOW,
      completed: this.step === TUTORIAL_STEPS.COMPLETE
    };
  }
}
