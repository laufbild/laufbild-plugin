# Local helpers

Two files, no network, nothing leaves your machine.

Install their dependencies once:

```bash
npm install
```

## `sanitize.mjs`

**Run this over generated markup before every render.**

It stands between the HTML, CSS and JavaScript your model wrote out of someone
else's website and a browser on your own machine: no network, no external
addresses, no event attributes, ASCII only, nothing that is not a shape on a
slide. Render only what comes out of it.

```js
import { sanitizeRaw } from "./lib/sanitize.mjs";

const clean = sanitizeRaw(
  { html, css, script },
  { cta: false, photos: 2, contacts: { domains: [], emails: [], phones: [] } },
);
// clean.html, clean.css, clean.script  -> render these
// clean.findings                       -> what it removed, as codes
```

**This file is generated and must not be edited.** It is built from the same
sanitizer that runs on the laufbild servers, with the types removed by the
TypeScript compiler. An attack corpus is run through both versions and their
output and findings are compared, so this copy cannot quietly drift from the
original or lose a rule on the way over. Editing it by hand would break that
guarantee without anything telling you.

## `align.mjs`

Word timings from a voice recording, for the styles that highlight word by
word.

```js
import { alignWords } from "./lib/align.mjs";

const words = await alignWords("voice.wav", { language: "de" });
// -> [{ word: "Rohbau", start: 0.12, end: 0.58 }, ...]  or null
```

It uses whatever Whisper you already have, `faster-whisper` first, then
`whisper`. If neither is installed it returns `null` — that is a normal
answer, not an error. Fall back to sentence-level captions then, and never
invent a timing: a caption that runs ahead of the voice is the most visible
way one of these videos fails.

**You will need this more often than not.** Of the voice routes in the main
README, most return audio and nothing else: Gemini TTS, MiniMax, Chatterbox,
Qwen3-TTS, Zonos and Kokoro all leave the timings to you. The exceptions are
Piper, which returns them from the model itself, the ElevenLabs models on
fal.ai, which return timestamps, and Laufbild.ai's own service.
