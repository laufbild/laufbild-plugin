---
name: laufbild
description: Build a short vertical marketing video (1080x1920) in a curated Laufbild.ai style and render it locally with HyperFrames. Works from a website, from a brief the user gives, or from both. Use when asked to make a marketing video, a reel, a short, a vertical video, a video from a website, or a video from a description.
---

# Laufbild.ai

This skill is deliberately short. The working instructions live on the
Laufbild.ai MCP server, not here, so that they improve without you updating this
plugin.

## Do this

1. Call `templates_list` to see the available styles.
2. Call `template_get` with the id you picked. It returns the full style brief
   **and** the build rules: frame, safe areas, captions, audio, sanitizing,
   fonts. Follow what it returns, not what you remember.
3. Build the HyperFrames composition on this machine. The build rules open
   with the one command that installs the renderer. Run it without asking, and
   skip it when it is already there. Load the `hyperframes` skill if available.
4. Call `sounds_list` if the video wants sound effects. The library is free and
   needs no account. **Where each sound goes is your decision**: you can see the
   slides and the timings, the list cannot.
5. Run `lib/sanitize.mjs` from this plugin over the generated markup, and
   render only its output.

## Three things not to get wrong

- **Sanitize before rendering, every time.** The markup was written from the
  text of someone else's website and then runs in a browser on this machine.
  See `SECURITY.md`.
- **Sound is optional, and too much is worse than none.** Every effect needs a
  visible cause and sits on the frame the thing happens. A beat every few
  seconds, never one per element, and nothing under the closing logo.
- **Word-by-word captions need word timings.** An audio file alone does not
  carry them. Either the voice service returns them, or align locally with
  `lib/align.mjs`, or fall back to sentence-level captions. Never fake them.
  Almost nothing returns them, so assume you will be aligning. Piper is the
  one local model that does.

## Voice-over

Only needed if the video is meant to speak, and the user picks the route. The
README has the three routes, the models that are licensed for commercial use,
and the two popular ones that are not.

## Where to read more

https://laufbild.ai/docs
