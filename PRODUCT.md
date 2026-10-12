# FIRST MIX Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated for the phase two prototype: dependency-free HTML CSS and JavaScript using the Web Audio API. This keeps the audio experiment portable and deployable as a static subdomain while preserving a clear path to a later framework migration.

## Users

The primary user is a Chinese-speaking person with no DJ experience who is curious about mixing but does not want to buy equipment or learn a full professional interface before trying it once.

## Product Purpose

FIRST MIX lets a beginner complete and hear a first transition in the browser. Success means the user can start two prepared tracks, understand the beat relationship, use Sync and move the Crossfader from Deck A to Deck B without needing external hardware.

## Positioning

FIRST MIX is not a simplified professional DJ console. It redesigns the first three minutes of learning around one guided and recoverable transition, then opens a small free-mix space.

## Operating Context

The product is entered from a portfolio case study or shared link and is expected to work with a mouse, keyboard, or touch. The default path uses deterministic training loops. Local files may be added later without uploading them to a server.

## Capabilities and Constraints

- Phase two validates two simultaneous decks, per-deck volume, three-band EQ, equal-power crossfading, a complete A-to-B transition, and browser audio limits.
- The initial prototype uses synthesized and locally generated training audio with no external music rights dependency.
- Spotify and other streaming-service mixing are outside V1.
- The audio engine and tutorial logic must work without AI. AI may later explain known state but cannot score or control sound.
- User activation is required before audio can start because browsers restrict autoplay.

## Brand Commitments

The product name is FIRST MIX. Product language is direct, encouraging, and beginner-friendly. It must avoid pretending the user is already a professional DJ or presenting entertainment trends as validated product demand.

## Evidence on Hand

The project research and phase-one product definition are stored in the editable FIRST MIX project work document. It includes 64 coded public expressions, competitor findings, the user journey, core flow, feature priorities, information architecture, AI system boundary, and interaction specification.

## Product Principles

- One clear action at a time.
- Let the user hear the difference before naming the concept.
- Deterministic systems decide what happened.
- Every error has an immediate recovery path.
- The core experience remains complete without AI or an account.

## Accessibility and Inclusion

Core controls must be keyboard operable, expose visible focus, avoid color-only state, offer alternatives to drag gestures, respect reduced motion, and remain usable on narrow screens.
