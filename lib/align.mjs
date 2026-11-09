// Word timings for a voice recording, aligned locally.
//
// Several laufbild styles highlight the spoken word as it is spoken: Classic
// marks word by word, Kinetic cuts on the beat, Voice Dialogue follows the
// loudness. An audio file alone does not carry those timings, and guessing
// them is worse than not having them — a caption that runs ahead of the voice
// is the most visible way these videos fail.
//
// So there are exactly three honest outcomes, and this file implements the
// middle one:
//
//   1. Your speech service returned word timings. Use them, do not call this.
//   2. It did not: align locally with Whisper, here.
//   3. Whisper is not installed: this returns null, and the caller falls back
//      to sentence-level captions. It never invents a timing.
//
// No dependencies beyond Node and whatever Whisper you already have. Nothing
// leaves this machine.
//
// Usage:
//   import { alignWords, whisperAvailable } from "./align.mjs";
//   const words = await alignWords("voice.wav", { language: "de" });
//   // -> [{ word: "Rohbau", start: 0.12, end: 0.58 }, ...] or null

import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

/** How long we let Whisper run before giving up, in milliseconds. */
const TIMEOUT_MS = 10 * 60 * 1000;

function run(command, args, { cwd, timeout = TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    } catch {
      resolve({ ok: false, code: -1, stdout: "", stderr: "spawn failed" });
      return;
    }
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeout);
    child.stdout.on("data", (d) => {
      stdout += d;
    });
    child.stderr.on("data", (d) => {
      stderr += d;
    });
    child.on("error", () => {
      clearTimeout(timer);
      resolve({ ok: false, code: -1, stdout, stderr });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, code, stdout, stderr });
    });
  });
}

/**
 * Which local Whisper we can use, if any.
 *
 * `faster-whisper` first: it is markedly faster on a CPU and its word
 * timestamps are the ones laufbild measured against. `whisper` second.
 */
export async function whisperAvailable() {
  const python = await run("python3", ["-c", "import faster_whisper"]);
  if (python.ok) return "faster-whisper";
  const cli = await run("whisper", ["--help"]);
  if (cli.ok) return "whisper";
  return null;
}

// Read word timings out of what openai-whisper writes as JSON.
function wordsFromWhisperJson(text) {
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    return null;
  }
  const words = [];
  for (const segment of doc?.segments ?? []) {
    for (const w of segment?.words ?? []) {
      const word = String(w.word ?? w.text ?? "").trim();
      const start = Number(w.start);
      const end = Number(w.end);
      if (!word || !Number.isFinite(start) || !Number.isFinite(end)) continue;
      words.push({ word, start, end });
    }
  }
  return words.length > 0 ? words : null;
}

// The same, for the script we drive faster-whisper with below.
function wordsFromLines(text) {
  const words = [];
  for (const line of text.split("\n")) {
    if (!line.startsWith("W\t")) continue;
    const [, start, end, ...rest] = line.split("\t");
    const word = rest.join("\t").trim();
    const a = Number(start);
    const b = Number(end);
    if (!word || !Number.isFinite(a) || !Number.isFinite(b)) continue;
    words.push({ word, start: a, end: b });
  }
  return words.length > 0 ? words : null;
}

// Printed by python3, so faster-whisper needs no wrapper package. One line per
// word, tab separated, which is far easier to parse correctly than its JSON.
const FASTER_WHISPER = `
import sys
from faster_whisper import WhisperModel
path, size, language = sys.argv[1], sys.argv[2], sys.argv[3]
model = WhisperModel(size, device="cpu", compute_type="int8")
segments, _ = model.transcribe(path, language=(language or None), word_timestamps=True)
for segment in segments:
    for w in (segment.words or []):
        sys.stdout.write("W\\t%.3f\\t%.3f\\t%s\\n" % (w.start, w.end, w.word.strip()))
`;

/**
 * Monotonic, non-overlapping, never negative.
 *
 * Whisper pulls words together and tears them apart, and an overlap makes a
 * highlight jump backwards mid-sentence. Fixing it here is cheap; noticing it
 * in a finished video is not.
 */
function tidy(words) {
  const out = [];
  let previousEnd = 0;
  for (const w of words) {
    const start = Math.max(previousEnd, Math.max(0, w.start));
    const end = Math.max(start, w.end);
    out.push({ word: w.word, start, end });
    previousEnd = end;
  }
  return out;
}

/**
 * Align `file` and return `[{ word, start, end }]`, or `null` when no local
 * Whisper is installed or it produced nothing usable.
 *
 * `null` is a normal answer, not an error: the caller falls back to
 * sentence-level captions. Only an unreadable file throws.
 */
export async function alignWords(file, { language = "de", model = "small", engine } = {}) {
  await access(file);
  const chosen = engine ?? (await whisperAvailable());
  if (!chosen) return null;

  if (chosen === "faster-whisper") {
    const r = await run("python3", ["-c", FASTER_WHISPER, file, model, language]);
    if (!r.ok) return null;
    const words = wordsFromLines(r.stdout);
    return words ? tidy(words) : null;
  }

  // openai-whisper writes a file rather than printing, so it needs a folder.
  const dir = await mkdtemp(join(tmpdir(), "laufbild-align-"));
  try {
    const r = await run("whisper", [
      file,
      "--model",
      model,
      "--language",
      language,
      "--word_timestamps",
      "True",
      "--output_format",
      "json",
      "--output_dir",
      dir,
      "--verbose",
      "False",
    ]);
    if (!r.ok) return null;
    const name = `${basename(file).replace(/\.[^.]+$/, "")}.json`;
    let text;
    try {
      text = await readFile(join(dir, name), "utf8");
    } catch {
      return null;
    }
    const words = wordsFromWhisperJson(text);
    return words ? tidy(words) : null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export default alignWords;
