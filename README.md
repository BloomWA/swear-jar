# 🫙 Digital Swear Jar

A toy for your Zoom meetings. It listens, and every time someone swears a coin (or a
crumpled bill for the big ones) drops into a glass jar with real physics, a censor
bleep, a speech bubble, combos and badges. When you've sworn enough, the jar overflows.

Built with Vite, React, TypeScript, Tailwind v4, Framer Motion, matter.js and
canvas-confetti. All sounds are synthesised with Web Audio, so there are no asset files.

## Quick start

```bash
npm install
npm run dev        # open http://localhost:5173 in Chrome or Edge
```

You don't need a mic to try it. Use **🧪 Test Mode** (or press **T**) to fake swears,
fire a ×5 combo, or "make it rain" so you can see the jar fill and overflow.

Other commands:

```bash
npm test           # unit tests for swear detection, un-censoring and de-duplication
npm run build      # production build into dist/ (serve with `npm run preview`)
```

## Choosing how it listens

| Engine | Privacy | Censoring | Input device | Notes |
|---|---|---|---|---|
| **🔒 Whisper (local), recommended** | Audio never leaves your machine | None | Any device, including loopback | Runs in the browser through transformers.js, on WebGPU if you have it, otherwise WASM. It downloads a model once from Hugging Face (40–250 MB) and then works offline. About 1–3 s delay. |
| ⚡ Chrome Web Speech | **Audio goes to Google** | Chrome outputs `f***`, which the app un-censors | OS default mic only | No setup or download, and close to instant. Chrome and Edge only. |
| ☁️ Deepgram | **Audio goes to Deepgram** | Turned off (`profanity_filter=false`) | Any device | Fastest. It's the only engine that supports **"who said it"** (speaker labels). Needs your own API key, which is stored only in your browser's localStorage. |

**Why Whisper is the default:** it's the only option that is private, uncensored and
able to listen to a loopback device, which is how you hear the whole Zoom call.
Chrome's Web Speech API can't choose an input device, and it censors swears.

Even with Whisper, the detector also matches censored text (`f***`, `s***ty`,
`f**king`, `b*******`). It maps each one back to the closest word in your list by
length, so any engine works.

**De-duplication:** streaming engines re-send the same words as their guesses improve
("shit" → "shit that" → "s*** that fucking"). Each utterance remembers how many swears
it has already paid for, so you're only charged for new ones.

## Editing the swear list and prices

Everything lives in **`src/config/swears.ts`**:

```ts
words: {
  fuck: 1,
  fucking: 1,
  motherfucker: 2,   // big words cost more (and drop a dollar bill instead of a coin)
  ...
}
```

- Each family has a `root` (`fuck`, `shit`). With `catchVariants = true`, any word
  containing the root counts at the family's default price, even if it isn't listed
  (e.g. "fuckwad").
- `allowList` stops false positives such as "shiitake".
- Split compounds are joined: "mother fucker" counts as `motherfucker`.
- To add a new family (e.g. `damn`), copy one of the blocks.

Combo titles, the combo window (30 s) and the milestone badges ($5 / $10 / $25 / $50 /
$100) are in **`src/config/game.ts`**.

## Hearing everyone on the Zoom call (system audio)

Your mic only hears you. To catch everyone, give the app the call's audio.

### Easiest: share a tab or screen (no drivers)
In **Ears → Audio source**, choose **🖥️ Share a tab / screen's audio…**. Chrome then
asks what to share:

- **Zoom in the browser:** pick the Zoom tab and tick **Share tab audio**.
- **Windows (Zoom desktop app):** pick *Entire screen* and tick **Share system audio**.
- **macOS 14.2+ with a recent Chrome:** *Entire screen* may offer system audio too.
  If it doesn't, use BlackHole (below).

### macOS: BlackHole loopback
1. Install [BlackHole 2ch](https://existential.audio/blackhole/) (`brew install blackhole-2ch`).
2. Open **Audio MIDI Setup** → **+** → **Create Multi-Output Device**. Tick your
   headphones/speakers **and** BlackHole 2ch. Put your headphones first and turn on
   *Drift Correction* for BlackHole.
3. In **Zoom → Settings → Audio → Speaker**, choose that **Multi-Output Device**. You
   still hear the call, and BlackHole gets a copy.
4. In the swear jar, click **show device names**, then pick **🔊 BlackHole 2ch**.

That captures everyone except you. To capture yourself too, either run a second tab on
your mic, or create an **Aggregate Device** (your mic + BlackHole) in Audio MIDI Setup
and select that.

### Windows: Stereo Mix or VB-Cable
- **Stereo Mix** (if your sound driver has it): *Sound settings → More sound settings
  → Recording*, right-click → *Show disabled devices* → enable **Stereo Mix**. Then
  pick it in the app.
- **No Stereo Mix?** Install [VB-Audio Virtual Cable](https://vb-audio.com/Cable/).
  Set Zoom's speaker to *CABLE Input*, then in *Recording → CABLE Output →
  Properties → Listen* tick *Listen to this device* so you still hear the call. In
  the app, pick **🔊 CABLE Output**.
- The browser screen-share option above (with *Share system audio*) also works on
  Windows, with no install.

Loopback devices open with echo cancellation and noise suppression **turned off**.
Otherwise the browser would "cancel" the very meeting audio we want to hear.

## Overlay mode and the always-on-top pop-out

- **🪟 Overlay:** a compact view with just the jar and the total. Make the browser
  window small and park it beside Zoom. You can also open `http://localhost:5173/?overlay`.
- **📌 Pop out** (Chrome/Edge 116+): opens a real **always-on-top** mini window using
  Document Picture-in-Picture. It floats above Zoom, which also makes it easy to
  screen-share.

## Other details

- Sound effects: coin clinks driven by real collision speed, a censor bleep, a combo
  arpeggio, and a cash-register ka-ching with a fanfare on milestones. **🔊/🔇**
  mutes them, and the setting is remembered.
- **Empty the jar** shakes the jar, tips it upside down and pours the coins out. It
  then saves the session to **🗓 History** (stored in localStorage). If you close the
  tab mid-meeting, the session is saved to history the next time you open the app.
- The "What the jar heard" transcript has a **hide** toggle for when you're screen-sharing.
- Shortcuts: **Space** starts/pauses listening, **T** fakes a swear.

## Troubleshooting

- **"Couldn't load Whisper"**: the first run needs internet access to huggingface.co
  to download the model. The model IDs are in `src/engines/types.ts` (`WHISPER_MODELS`),
  so you can swap in any transformers.js-compatible Whisper ONNX repo. Without
  WebGPU, *Tiny* or *Base* is the better choice.
- **Whisper misses short swears**: try the *Small* model. Speech is cut into chunks at
  natural pauses, so a swear said mid-sentence still gets heard.
- **Mic blocked**: click the 🔒/🎙️ icon in the address bar and allow the microphone.
  Browsers only allow mic access on `localhost` or HTTPS.
- **Web Speech stops after a while**: Chrome ends sessions after silence. The app
  restarts them automatically.

## Project layout

```
src/config/swears.ts     ← the word list and prices (edit me)
src/config/game.ts       ← combos, milestones, badge titles
src/lib/detector.ts      ← matching, un-censoring, interim/final de-dupe (+ tests)
src/lib/jarWorld.ts      ← matter.js world, jar walls, coin/bill sprites, pouring
src/lib/sound.ts         ← synthesised sound effects
src/engines/             ← whisper (+ web worker), webSpeech, deepgram, audio devices
src/state/               ← zustand store, history, and the game orchestration
src/components/          ← JarScene, Odometer, StatsPanel, SourcePanel, …
```
