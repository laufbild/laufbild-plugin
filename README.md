# Laufbild.ai

Build a short vertical marketing video on your own machine, in a curated style, with your own Claude subscription.

**From a website, from a brief you give, or from both.** A site is the fastest start: the offer, the brand, the
colours and the proof are already there. A brief is what you use when there is no site, when it is out of date, or
when the video is about one thing the site does not cover. Either way the video claims nothing that is not in the
source you gave.

The styles come from our MCP server, the rendering happens here. Nothing is sent to us, and nothing is charged.

## Install

```bash
claude plugin install laufbild --marketplace laufbild/laufbild-plugin
```

Older Claude Code versions need two commands:

```bash
claude plugin marketplace add laufbild/laufbild-plugin
claude plugin install laufbild@laufbild-ai
```

Using **Codex** or **claude.ai** instead? There is no plugin to install. Add
the MCP server directly:

```
https://laufbild.ai/mcp
```

The server sends its working instructions when you connect, so it behaves the
same everywhere.

## Then just ask

> Make a vertical marketing video for example.com in the Poster style.

Your model lists the styles, pulls the one you picked, installs the renderer if
it is not there yet, builds the composition, sanitizes it, and renders it
locally. You are not asked to prepare anything first.

## Where the styles come from

The styles are not in this repository. They come from the Laufbild.ai MCP server
when you call for them. Two reasons:

**They keep getting better.** We measure which short-video formats are
actually working right now and fold that back into the styles. New and
improved styles are available immediately, with no update to this plugin.

**This repository stays small and auditable.** All that is in here is how the
plugin works. You can read every line and see what it sends to the server and
what it does not.

The authoritative list is whatever `templates_list` returns. A browsable
catalogue with a description of each style is at
[laufbild.ai/docs#templates](https://laufbild.ai/docs#templates).

## Sound effects

Laufbild.ai also has its own library of short sound effects: pops, whooshes,
impacts, interface clicks, timers, paper and office sounds. Free, no account,
and usable in your videos commercially without attribution. We generated them
ourselves, so each one carries its own provenance record.

`sounds_list` returns them with a one-line note on what each is good for, and
a direct mp3 link. The browsable list is at
[laufbild.ai/docs#sounds](https://laufbild.ai/docs#sounds).

**Which sound goes where is the agent's decision, not ours.** The list is
material plus the discipline for using it: every sound needs a visible cause,
it sits on the frame the thing happens, and fewer is better. Only the agent
building the video can see the slides, so only it can make that call.

Not exclusive, and nobody warrants freedom from third-party rights. The
exact wording is in each sound's provenance file.

## Voice-over

A video without a voice-over is unlimited and needs no account. When you do
want a spoken track, you have three routes. They differ in sound, in price and
in one thing that is easy to overlook: **whether you get word timings back**.

Several styles highlight each word as it is spoken. An audio file alone does
not carry those timings. So either the service hands them to you, or you align
locally with `lib/align.mjs`, or you fall back to sentence-level captions.
Never invent a timing. A caption that runs ahead of the voice is the most
visible way one of these videos fails.

Every licence below was read at its source on 9 November 2026, because several
of the best-sounding open models are non-commercial and that is easy to miss.
Check again before you rely on it: licences change, and two of these models
changed theirs in the past year.

### 1. A local model, free and offline

Nothing leaves the machine and nothing is charged. German is the harder of the
two languages here: several models that sound excellent in English have no
German voice at all.

| Model | Licence | German | Hardware | Word timings |
| --- | --- | --- | --- | --- |
| [Qwen3-TTS 12Hz](https://github.com/QwenLM/Qwen3-TTS) `0.6B` CustomVoice | Apache-2.0, commercial use allowed | Yes, and the best German of the open models | ~1.2 GB of weights, comfortable in 8 GB of VRAM | No, align afterwards |
| [Chatterbox Multilingual](https://huggingface.co/ResembleAI/chatterbox) `0.5B` | MIT, commercial use allowed | Yes, 23 languages. The Nano and Turbo variants are English only | ~3.5 GB of VRAM, compute capability 7.0 or newer | No, align afterwards |
| [Piper](https://github.com/OHF-Voice/piper1-gpl) with a CC0 voice | Engine **GPL-3.0**, and the licence of a voice is per voice, see below | Yes, eight German voices | CPU only, runs on a Raspberry Pi | **Yes, the only one that does** |
| [Zonos v0.1](https://github.com/Zyphra/Zonos) | Apache-2.0, commercial use allowed | Yes. v0.1 speaks five languages, the newer ZONOS2 more | 6 GB of VRAM or more | No, align afterwards |
| [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) | Apache-2.0, commercial use allowed | **No German voice exists** | ~350 MB of weights, CPU is fine | No, align afterwards |

**Do not use these two**, although they are the most downloaded local models
and therefore the first ones you will find:
[XTTS-v2](https://huggingface.co/coqui/XTTS-v2) is under the Coqui Public
Model License, which permits non-commercial use **of the model and of its
outputs**, and Coqui was wound up in 2024, so no commercial licence can be
bought any more. [F5-TTS](https://huggingface.co/SWivid/F5-TTS) has MIT code
but CC-BY-NC weights, and its German community fine-tunes inherit that.

**Piper needs two decisions, not one.** The engine moved from MIT to GPL-3.0
when development moved to `OHF-Voice/piper1-gpl`, because it embeds espeak-ng.
That is fine here: you call it as a tool, and the GPL does not reach the audio
it produces. The voices are licensed one by one, and they are not all the same:
`thorsten`, `thorsten_emotional` and `kerstin` are CC0 and the safe choice,
`mls` is CC-BY-4.0 and needs attribution, `pavoque` is CC-BY-NC-SA-4.0 and is
**not** usable here, and `eva_k`, `karlsson` and `ramona` only point at a
dataset URL that no longer resolves. Read the MODEL_CARD of the voice you pick.

Two things worth knowing: Chatterbox has been retired research since August
2026 and is no longer maintained, and every file it produces carries Resemble
AI's inaudible watermark, which is allowed commercially but is in there.

**Pick one:** Qwen3-TTS 0.6B if there is a GPU, for the best German at a
permissive licence and a small size. Piper with `de_DE-thorsten-high` if there
is no GPU, or whenever the word timings matter more than the sound. Kokoro for
English-only videos where speed is everything.

### 2. fal.ai, when the sound has to be better

A hosted model still sounds better than a local one, and in a 15-second ad the
voice carries everything. fal.ai runs a large catalogue behind one key, pay per
use and no subscription, so you can swap models without changing the
integration. You need your own key: make an account, top up credit, create a
key in the dashboard.

Worth knowing before you pick: **the ElevenLabs models on fal return
timestamps**, which means no separate alignment step. Gemini TTS and MiniMax do
not. If the alignment is the awkward part of your setup, that difference is
worth more than a small difference in price.

### 3. Gemini TTS, what we recommend

If you want one paid voice and no decisions: Gemini TTS, on fal as
`fal-ai/gemini-3.1-flash-tts`. The German is natural, it takes a
plain-language instruction about delivery ("read this calmly, like a founder,
not like an ad"), and it is cheap enough that the voice is not what makes a
video expensive.

**It returns no timing information.** Generate the audio, then run
`lib/align.mjs` over it. Prices and model names on fal change, so check the
model page rather than trusting a number written here.

### Our own voice-over

Laufbild.ai's voice service, which needs an account, returns the word timings
together with the audio, which saves you the alignment step. It is not the only
way to get them, as the ElevenLabs route above shows. The sound is comparable
to the hosted models.

## What is free, and what is not

| Free, no account | Needs an account |
| --- | --- |
| Every style | Our voice-over, with word timings |
| Rendering on your machine, unlimited | Publishing to Instagram |
| Your own voice recording | Scheduling a series in the calendar |
| A local TTS model, see [Voice-over](#voice-over) | |
| Every sound effect | |
| | Videos in the browser, no local setup |

A video without a voice-over really is unlimited. You pay your own model
usage and nothing else.

## Requirements

- Claude Code with Opus, or Codex, or claude.ai
- Node 20 or newer, and a terminal your model can run commands in
- Only for a voice-over: Python 3.10+ if you want a local TTS model or local
  word alignment. Videos without a voice-over need neither.

Nothing to set up beyond that. The two packages that do the rendering,
`hyperframes` and `gsap`, are installed by your model into the project it is
working in, as part of the first video, in one command. The server's
instructions carry the exact versions, the licences and what each package is
for, so you are not expected to know any of this beforehand. Both are free for
this use: HyperFrames is Apache-2.0, and gsap ships under Webflow's standard
no-charge licence, which covers commercial use and only forbids reselling gsap
itself.

## Security

The render runs on your machine, from markup your model wrote out of someone
else's website. Always run `lib/sanitize.mjs` first. The reasoning, and how to
report a vulnerability, is in [SECURITY.md](SECURITY.md).

## Licence

MIT. See [LICENSE](LICENSE).
