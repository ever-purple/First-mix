# FIRST MIX V1

WorkBuddy 或其他接手者请先阅读 [`WORKBUDDY-HANDOFF.md`](./WORKBUDDY-HANDOFF.md)。它是当前页面组合、设计边界、3D 控台、音乐与继续开发规则的唯一交接入口。

FIRST MIX is a guided browser experience for a beginner's first DJ transition. Phase two validated the audio foundation; phase three now builds the progressive tutorial and recovery system on top of it. The project remains independent from the portfolio application.

## Run

```powershell
npm start
```

Open `http://127.0.0.1:4177` in a modern desktop or mobile browser.

## Test

```powershell
npm test
```

## AI demo safety

The Node server serves only the frontend files needed by FIRST MIX. Dotfiles, server source, test files, and the local `.env` are not public URLs. Keep the real API key in `.env` on the server; never include it in a source upload.

AI analysis is limited by default to 20 calls per UTC day across this server and 5 per client per day, with at most 2 requests in flight. The global count persists in `.ai-usage.json` across restarts; the per-client count resets when the process restarts. Set `AI_DAILY_CALL_LIMIT=0` to disable all paid AI analysis, or set the two limits in `.env` to suit the demo. These limits assume one Node process; a multi-process deployment needs a shared quota store. If using a reverse proxy, overwrite `X-Real-IP` with the actual client address rather than forwarding a visitor-supplied value. Also configure spending protection in the model provider console because a call limit is not a monetary cap.

The automated tests cover control range protection, decibel conversion, equal-power crossfader behavior, ordered tutorial transitions, invalid action rejection, and local coach escalation. Browser verification covers the complete guided path, progressive control locking, responsive layout, and error-free console output.

## Phase two scope

- Two simultaneous 120 BPM synthesized training loops
- Per-deck volume and low mid high EQ
- Equal-power Crossfader
- Sync B to Deck A's current loop position
- Deterministic first-transition completion
- Live sample-rate and base-latency reporting
- Keyboard-operable native controls and reduced-motion support

No audio file is uploaded, no streaming service is connected, and no AI service is called.

## Phase three batch one

- Deterministic Tutorial State Machine: Play A, listen, Sync B, hear MIX, hear B-only, complete
- Progressive interface that unlocks only the current action
- EQ controls unlocked after the first successful transition
- Local Adaptive Coach with contextual two-level hints
- Automatic local hint after eight seconds without action
- Local completion marker for later session recovery work
- First-visit interface tour for Deck, BPM, Beat, Sync, Crossfader, and EQ
- Spotlight treatment that dims non-current regions, with skip, Escape, and replay support
- Post-tutorial Free Mix entry with separate local audio import for Deck A and Deck B
- Browser-only decoding, automatic BPM estimation, manual BPM correction, tempo-matched Sync, and one-click training-track recovery
