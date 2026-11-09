// GENERATED FILE. DO NOT EDIT.
//
// Built from src/video-hf/dynamic/raw/sanitize.ts in the laufbild product
// repository by scripts/build-plugin-sanitizer.mjs. Types removed by the
// TypeScript compiler, the DYN_LIMITS object inlined from the same source.
//
// Edit the original and run the generator. An edit here is overwritten and
// worker/tests/plugin-sanitizer.test.ts will fail in the meantime.
//
// What it does: it takes the HTML, CSS and JavaScript a model wrote from the
// text of an untrusted website and removes everything that could reach out of
// the frame — network access, external addresses, event attributes, non-ASCII,
// anything that is not a shape on a slide. Render only what comes out of it.

/**
 * Sanitizing the raw draft of the "Dynamic" template (normal form v3, DESIGN_LAYOUT_RAW; requirements.json:
 * dynamic-everything-allowed, the author's instruction of 23 October 2026 that everything should be allowed here as
 * well, plan docs/research/dynamic-everything-allowed-2026-10-23.md).
 *
 * Up to v2 a filter let only a small language through: an allow list, placeholders instead of text, a code gate. Here
 * it is the other way round. The model writes arbitrary HTML (including SVG and MathML), CSS and JavaScript with its
 * own text, as it does under Claude Code. The security boundary is the gVisor container per run without network
 * access (worker/jail/), not this code. All this code takes out is what has no business in the render or what gets in
 * the way of our own building blocks:
 *
 *   - addresses pointing outwards (every address except `#id` and `photo:N`), event attributes, `javascript:`,
 *   - elements that load or embed something (iframe, object, embed, link, meta, base, audio, video ...),
 *   - our own marks: the attributes of HyperFrames and of our generator (data-start, data-w, data-dz ...), the
 *     class `clip`, IDs such as `root` or `dz-...`, `data-brand` outside the closing slide,
 *   - foreign contacts in the text (URL, domain, e-mail address, phone number that must not appear in the video),
 *   - control characters.
 *
 * `<style>` and `<script>` inside the HTML move into the CSS and the script. The normal form is ASCII only, with
 * non-ASCII written as a character reference, a CSS escape or `\uXXXX`, because video_designs accepts ASCII only, and
 * `<` is escaped in the CSS and in the script's strings so that no text from the model can close the surrounding
 * `<style>` or `<script>`. sanitizeRaw is idempotent: the normal form passes through once more on every build and
 * comes out unchanged.
 *
 * What our code makes of it afterwards (the `@scope` region, the photos, the brand, the counters that guard against
 * endless loops) lives in the compiler (templates/dynamic/raw.ts), not in the normal form.
 */
import { parse as acornParse, tokenizer as acornTokenizer } from "acorn";
import { parseFragment, serialize } from "parse5";
// DYN_LIMITS, inlined from src/shared/dynamic-design.ts when this file was generated.
const DYN_LIMITS = {
    "response": {
        "group": 40000,
        "all": 80000
    },
    "html": {
        "chars": 6000,
        "elements": 96,
        "depth": 10,
        "classesPerElement": 4
    },
    "decorations": 48,
    "textBoxes": 16,
    "css": {
        "chars": 6000,
        "rules": 80,
        "declarationsPerRule": 24,
        "styleAttrChars": 600,
        "selectorsPerRule": 4,
        "classesPerCompound": 3
    },
    "placeholders": {
        "label": 2,
        "img": 1,
        "icon": 4
    },
    "steps": 4,
    "motion": {
        "perSlide": 12,
        "perVideo": 60,
        "timelineCommands": 1200
    },
    "blur": {
        "maxPx": 24,
        "maxElements": 4
    },
    "numbers": {
        "maxAbs": 2400,
        "maxDecimals": 3
    },
    "raw": {
        "html": 12000,
        "css": 8000,
        "script": 12000,
        "response": {
            "group": 90000,
            "all": 180000
        }
    },
    "ident": {
        "pattern": {},
        "reserved": [
            "clip",
            "scene",
            "cap",
            "w",
            "fill",
            "pre",
            "root",
            "capline",
            "caption-group",
            "conj",
            "conj-pair",
            "em"
        ],
        "reservedPrefixes": [
            "dz-",
            "dyn-",
            "lb-"
        ]
    }
};
/** The parameters of the function that a slide's script is (dynamic/raw/runtime.ts). */
export const RAW_SCRIPT_PARAMS = ["root", "tl", "gsap", "phrases", "rand", "slide", "fx"];
// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
/** Text to be stored, with the control characters taken out. */
const clean = (s) => s.replace(CONTROL, "");
/** Every character outside printable ASCII. Tab and line break are kept. */
const NON_ASCII = /[^\t\n\r\x20-\x7e]/gu;
// Contacts: the same patterns as worker/pipeline/sanitize.ts (URL_RE, DOMAIN_RE, EMAIL_RE, PHONE_RE), here without
// an import, because the compiler runs inside the generator. What may appear in the video comes from the script and
// the brief (contactsOf).
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
const DOMAIN_RE = /\b(?=[a-z0-9-]*[a-z])[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:[a-z]{2}|com|net|org|info|biz|shop|app|dev|online|site|store|cloud|digital|agency|studio|design|berlin|bayern|hamburg|koeln|wien|swiss|tirol|ai|io|eu|tv|xyz|pro|guru|expert|immo|bau|haus|jetzt|reise|versicherung)\b/gi;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_RE = /(?:\+|00)\d[\d\s/.-]{6,}\d|\b0\d{2,5}[\s/.-]?\d{3,}(?:[\s/.-]?\d{2,})+\b/g;
const digits = (s) => s.replace(/\D/g, "");
/** The fixed namespaces of SVG, XHTML, XLink, MathML and XML, spelled exactly like this. */
const NAMESPACE_RE = /http:\/\/www\.w3\.org\/(?:2000\/svg|1999\/xhtml|1999\/xlink|1998\/Math\/MathML|XML\/1998\/namespace|2000\/xmlns\/)(?![\w/.-])/g;
/**
 * The contacts in a text that is allowed to appear in the video (the spoken script, the brief): domains, e-mail
 * addresses and phone numbers reduced to their digits. The company's own domain is added explicitly, without "www.".
 */
export function contactsOf(texts, ownDomain) {
    const domains = new Set();
    const emails = new Set();
    const phones = new Set();
    const own = ownDomain.toLowerCase().replace(/^www\./, "").trim();
    if (own)
        domains.add(own);
    for (const t of texts) {
        for (const m of t.matchAll(EMAIL_RE))
            emails.add(m[0].toLowerCase());
        for (const m of t.matchAll(PHONE_RE))
            phones.add(digits(m[0]));
        for (const m of t.replace(EMAIL_RE, " ").matchAll(DOMAIN_RE))
            domains.add(m[0].toLowerCase().replace(/^www\./, ""));
    }
    return { domains: [...domains], emails: [...emails], phones: [...phones] };
}
/** Is a domain, or a subdomain of it, allowed? */
function domainAllowed(d, c) {
    const x = d.toLowerCase().replace(/^www\./, "");
    return c.domains.some((own) => x === own || x.endsWith(`.${own}`));
}
/**
 * Removes the foreign contacts from a text. `hit` counts them. `code` says that the text is a string inside the
 * script. A lot of what stands there looks like a domain but is code ("power2.in", "data.js"), so in that case only
 * addresses with http(s):// or www., e-mail addresses and phone numbers count.
 */
function scrubContacts(text, c, hit, code = false) {
    // The namespaces of the W3C are not contacts: document.createElementNS("http://www.w3.org/2000/svg", ...) builds
    // SVG in the script, and without that address an element without a namespace would come out of it and draw nothing
    // (found on 23 October 2026).
    const kept = [];
    let out = text.replace(NAMESPACE_RE, (m) => `\u0000${kept.push(m) - 1}\u0000`);
    out = out.replace(URL_RE, (m) => {
        const host = m.replace(/^https?:\/\//i, "").split(/[/?#:]/)[0] ?? "";
        if (domainAllowed(host, c))
            return m;
        hit();
        return "";
    });
    out = out.replace(EMAIL_RE, (m) => {
        if (c.emails.includes(m.toLowerCase()))
            return m;
        hit();
        return "";
    });
    if (!code)
        out = out.replace(DOMAIN_RE, (m) => {
            if (domainAllowed(m, c))
                return m;
            hit();
            return "";
        });
    out = out.replace(PHONE_RE, (m) => {
        if (c.phones.includes(digits(m)))
            return m;
        hit();
        return "";
    });
    return out.replace(/\u0000(\d+)\u0000/g, (_, i) => kept[Number(i)] ?? "");
}
// ---------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------
/** Elements that load, embed or execute something, or that are read as raw text: they are dropped with their content. */
const DROP_ELEMENTS = new Set([
    "iframe",
    "frame",
    "frameset",
    "object",
    "embed",
    "applet",
    "link",
    "meta",
    "base",
    "basefont",
    "bgsound",
    "audio",
    "video",
    "source",
    "track",
    "noscript",
    "template",
    "slot",
    "portal",
    "fencedframe",
    "xmp",
    "noembed",
    "noframes",
    "plaintext",
    "param",
    "head",
    "html",
    "body",
]);
/** SMIL animations that could set an address. */
const SMIL = new Set(["animate", "set", "animatetransform", "animatemotion", "animatecolor"]);
/** Attributes that carry an address. */
const URL_ATTRS = new Set([
    "href",
    "src",
    "srcset",
    "poster",
    "action",
    "formaction",
    "data",
    "background",
    "ping",
    "cite",
    "longdesc",
    "manifest",
    "codebase",
    "archive",
    "lowsrc",
    "dynsrc",
    "usemap",
    "profile",
    "icon",
    "srcdoc",
    "itemtype",
    "attributionsrc",
]);
/** Attributes of our generator and of HyperFrames: a model that sets them would steer our timeline or our checks. */
const RESERVED_ATTR = /^(?:data-(?:start|duration|end|track-index|composition(?:-.*)?|hf(?:-.*)?|media(?:-.*)?|volume|has-audio|w|w-.*|slide|label|dz|dy.*|dyr.*|lb.*|bm.*|surface|say|img|icon|step|in|out|accent|with)|contenteditable|autofocus|target|is|nonce|integrity|crossorigin|referrerpolicy|loading|fetchpriority|popover.*)$/i;
/** The IDs and classes that our generator or HyperFrames read as meaningful. */
const RESERVED_ID = /^(?:root|dz-|lb-|dyr-|own-mark-|__)/i;
const RESERVED_CLASS = /^(?:clip|lb-.*|dz-.*|dyn-.*|dyr-.*)$/i;
/** A name that is a clean tag name, or a clean attribute name, in HTML. */
const TAG_NAME = /^[a-z][a-z0-9-]*(?::[a-z][a-z0-9-]*)?$/i;
const ATTR_NAME = /^[a-z_:][a-z0-9_.:-]*$/i;
/** `photo:N` (1 to 99), or a link to a fragment inside the document. */
const PHOTO_REF = /^photo:(\d{1,2})$/;
const FRAGMENT_REF = /^#[A-Za-z_][A-Za-z0-9_.:-]{0,80}$/;
/** The elements whose image is allowed to be `photo:N`. */
const IMAGE_ELEMENTS = new Set(["img", "image", "feimage"]);
/** Attributes holding text that a person reads: for the content check and for the contacts. */
const TEXT_ATTRS = new Set(["alt", "title", "aria-label", "aria-description", "placeholder", "value", "label"]);
const isElement = (n) => "tagName" in n;
const isText = (n) => n.nodeName === "#text";
function sanitizeHtml(src, ctx, f) {
    const frag = parseFragment(clean(src));
    const css = [];
    const scripts = [];
    const texts = [];
    const photos = new Set();
    let brand = false;
    const contactHit = () => f.add("contact");
    const textOf = (el) => el.childNodes.map((c) => (isText(c) ? c.value : isElement(c) ? textOf(c) : "")).join("");
    const walk = (parent) => {
        const keep = [];
        for (const n of parent.childNodes) {
            if (n.nodeName === "#comment" || n.nodeName === "#documentType")
                continue;
            if (isText(n)) {
                n.value = scrubContacts(clean(n.value), ctx.contacts, contactHit);
                if (n.value.trim())
                    texts.push(n.value.trim());
                keep.push(n);
                continue;
            }
            if (!isElement(n))
                continue;
            const tag = n.tagName.toLowerCase();
            // <style> and <script> in the HTML: the content moves into the CSS or the script, the element is dropped (in SVG too).
            if (tag === "style") {
                css.push(textOf(n));
                f.add("moved-style");
                continue;
            }
            if (tag === "script") {
                if (!n.attrs.some((a) => a.name.toLowerCase() === "src")) {
                    scripts.push(textOf(n));
                    f.add("moved-script");
                }
                else
                    f.add("drop-element");
                continue;
            }
            if (DROP_ELEMENTS.has(tag) || !TAG_NAME.test(n.tagName) || (tag === "title" && n.namespaceURI === "http://www.w3.org/1999/xhtml")) {
                f.add("drop-element");
                continue;
            }
            // SMIL that could set an address is dropped entirely.
            if (SMIL.has(tag)) {
                const target = (n.attrs.find((a) => a.name.toLowerCase() === "attributename")?.value ?? "").toLowerCase();
                if (/href|src/.test(target) || n.attrs.some((a) => /javascript:|data:/i.test(a.value))) {
                    f.add("drop-element");
                    continue;
                }
            }
            const attrs = [];
            for (const a of n.attrs) {
                const name = a.prefix ? `${a.prefix}:${a.name}` : a.name;
                const lower = name.toLowerCase();
                const local = a.name.toLowerCase();
                a.value = clean(a.value);
                if (!ATTR_NAME.test(name) || lower.startsWith("on")) {
                    f.add("drop-attr");
                    continue;
                }
                if (RESERVED_ATTR.test(lower)) {
                    f.add("drop-reserved");
                    continue;
                }
                if (lower === "data-brand") {
                    if (!ctx.cta || brand) {
                        f.add("drop-brand");
                        continue;
                    }
                    brand = true;
                    attrs.push({ ...a, value: "" });
                    continue;
                }
                if (local === "id") {
                    if (RESERVED_ID.test(a.value)) {
                        f.add("drop-reserved");
                        continue;
                    }
                }
                if (local === "class") {
                    const tokens = a.value.split(/\s+/).filter(Boolean);
                    const kept = tokens.filter((t) => !RESERVED_CLASS.test(t));
                    if (kept.length !== tokens.length)
                        f.add("drop-reserved");
                    if (!kept.length)
                        continue;
                    attrs.push({ ...a, value: kept.join(" ") });
                    continue;
                }
                if (URL_ATTRS.has(local)) {
                    const v = a.value.trim();
                    const photo = PHOTO_REF.exec(v);
                    if (photo && IMAGE_ELEMENTS.has(tag) && (local === "src" || local === "href")) {
                        const k = Number(photo[1]);
                        if (k >= 1 && k <= ctx.photos) {
                            photos.add(k);
                            attrs.push({ ...a, value: `photo:${k}` });
                        }
                        else
                            f.add("photo-range");
                        continue;
                    }
                    if (local === "href" && FRAGMENT_REF.test(v)) {
                        attrs.push({ ...a, value: v });
                        continue;
                    }
                    f.add("drop-url");
                    continue;
                }
                if (lower === "style") {
                    const st = sanitizeCss(a.value, f, { declarations: true });
                    if (st.css.trim())
                        attrs.push({ ...a, value: st.css });
                    continue;
                }
                // Values holding a pseudo address (SMIL values, filter ...) are of no use in the render.
                if (/^\s*(?:javascript|vbscript):/i.test(a.value)) {
                    f.add("drop-url");
                    continue;
                }
                if (TEXT_ATTRS.has(local)) {
                    a.value = scrubContacts(a.value, ctx.contacts, contactHit);
                    if (a.value.trim())
                        texts.push(a.value.trim());
                }
                attrs.push(a);
            }
            n.attrs = attrs;
            // An image without an allowed source would only show the icon for a missing image.
            if (IMAGE_ELEMENTS.has(tag) && !attrs.some((a) => (a.name === "src" || a.name === "href") && PHOTO_REF.test(a.value))) {
                f.add("drop-element");
                continue;
            }
            walk(n);
            keep.push(n);
        }
        parent.childNodes = keep;
        for (const k of keep)
            k.parentNode = parent;
    };
    walk(frag);
    // Non-ASCII becomes a character reference. The names are ASCII by now (TAG_NAME, ATTR_NAME) and no raw-text
    // elements are left: every remaining character sits in text or in an attribute value, and a reference holds there.
    const html = serialize(frag).replace(NON_ASCII, (ch) => `&#x${ch.codePointAt(0).toString(16)};`);
    return { html: html.trim(), css, scripts, texts, photos: [...photos].sort((a, b) => a - b), brand };
}
// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------
/** At-rules that load something or change our frame: they are dropped together with their block. */
const CSS_DROP_AT = new Set(["import", "charset", "namespace", "font-face", "document", "-moz-document", "scope", "view-transition"]);
/** Functions whose argument is an address: they turn into `none`. */
const CSS_URL_FUNCS = new Set(["image-set", "-webkit-image-set", "cross-fade", "-webkit-cross-fade", "element", "-moz-element", "src", "image"]);
const cssEscape = (cp) => `\\${cp.toString(16)} `;
/**
 * Sanitizes CSS. The comments are gone, the braces are closed, `url()` carries nothing but `photo:N` or `#id`, a
 * function taking an address becomes `none`, an at-rule that loads something is removed, and `<` and non-ASCII are
 * escaped. `declarations` says that the input is a style attribute and therefore has no blocks.
 */
export function sanitizeCss(src, f, o = {}) {
    const s = clean(src);
    const out = [];
    const strings = [];
    let depth = 0;
    let i = 0;
    const n = s.length;
    const push = (x) => out.push(x);
    /** Writes one character to the output, escaping non-ASCII and `<`. */
    const emitChar = (ch) => {
        const cp = ch.codePointAt(0);
        if (ch === "<" || cp > 0x7e)
            push(cssEscape(cp));
        else
            push(ch);
    };
    const readString = (quote) => {
        let raw = quote;
        let value = "";
        i++;
        while (i < n) {
            const ch = s[i];
            if (ch === "\\" && i + 1 < n) {
                // An escape is kept exactly as it stands, hex or character, while the value is decoded for the check.
                const m = /^\\([0-9a-fA-F]{1,6}\s?|[^\n0-9a-fA-F])/.exec(s.slice(i));
                if (m) {
                    raw += m[0];
                    const hex = /^[0-9a-fA-F]/.test(m[1]) ? Number.parseInt(m[1].trim(), 16) : null;
                    value += hex !== null && hex > 0 && hex <= 0x10ffff ? String.fromCodePoint(hex) : m[1];
                    i += m[0].length;
                    continue;
                }
                i++;
                continue;
            }
            if (ch === "\n")
                break; // an unclosed string ends at the end of the line (CSS)
            if (ch === quote) {
                i++;
                return { raw: raw + quote, value };
            }
            const cp = ch.codePointAt(0);
            raw += ch === "<" || cp > 0x7e ? cssEscape(cp) : ch;
            value += String.fromCodePoint(cp);
            i += ch.length > 1 || cp > 0xffff ? 2 : 1;
        }
        return { raw: raw + quote, value };
    };
    /** A name (an identifier, a function, an at-rule), with the escapes decoded for the comparison. */
    const readName = () => {
        let raw = "";
        let name = "";
        while (i < n) {
            const ch = s[i];
            if (ch === "\\" && i + 1 < n && s[i + 1] !== "\n") {
                const m = /^\\([0-9a-fA-F]{1,6}\s?|[^\n0-9a-fA-F])/.exec(s.slice(i));
                const hex = /^[0-9a-fA-F]/.test(m[1]) ? Number.parseInt(m[1].trim(), 16) : null;
                const ch2 = hex !== null && hex > 0 && hex <= 0x10ffff ? String.fromCodePoint(hex) : m[1];
                name += ch2;
                // An escape for an ordinary letter is written out as that letter afterwards, so `u\72 l(` becomes `url(`.
                // That way every later check reads the name the way the browser reads it.
                raw += /^[A-Za-z0-9_-]$/.test(ch2) ? ch2 : m[0];
                i += m[0].length;
                continue;
            }
            if (/[A-Za-z0-9_-]/.test(ch) || ch.codePointAt(0) > 0x7f) {
                const cp = ch.codePointAt(0);
                raw += cp > 0x7e ? cssEscape(cp) : ch;
                name += String.fromCodePoint(cp);
                i += cp > 0xffff ? 2 : 1;
                continue;
            }
            break;
        }
        return { raw, name: name.toLowerCase() };
    };
    /** Skips ahead to the matching parenthesis, minding the strings on the way. */
    const skipParens = () => {
        let d = 1;
        while (i < n && d > 0) {
            const ch = s[i];
            if (ch === '"' || ch === "'") {
                readString(ch);
                continue;
            }
            if (ch === "(")
                d++;
            else if (ch === ")")
                d--;
            i++;
        }
    };
    /** Skips an at-rule together with its prelude and its block. */
    const skipAtRule = () => {
        while (i < n && s[i] !== ";" && s[i] !== "{" && s[i] !== "}") {
            const ch = s[i];
            if (ch === '"' || ch === "'")
                readString(ch);
            else if (ch === "(") {
                i++;
                skipParens();
            }
            else
                i++;
        }
        if (s[i] === ";") {
            i++;
            return;
        }
        if (s[i] !== "{")
            return;
        let d = 0;
        while (i < n) {
            const ch = s[i];
            if (ch === '"' || ch === "'") {
                readString(ch);
                continue;
            }
            if (s.startsWith("/*", i)) {
                const end = s.indexOf("*/", i + 2);
                i = end < 0 ? n : end + 2;
                continue;
            }
            if (ch === "{")
                d++;
            else if (ch === "}") {
                d--;
                if (d === 0) {
                    i++;
                    return;
                }
            }
            i++;
        }
    };
    while (i < n) {
        const ch = s[i];
        if (s.startsWith("/*", i)) {
            const end = s.indexOf("*/", i + 2);
            i = end < 0 ? n : end + 2;
            push(" ");
            continue;
        }
        if (ch === '"' || ch === "'") {
            const str = readString(ch);
            if (str.value.trim())
                strings.push(str.value.trim());
            push(str.raw);
            continue;
        }
        if (ch === "@" && !o.declarations) {
            i++;
            const { raw, name } = readName();
            if (CSS_DROP_AT.has(name)) {
                f.add("css-at");
                skipAtRule();
                continue;
            }
            push(`@${raw}`);
            continue;
        }
        if (/[A-Za-z_\\-]/.test(ch) || ch.codePointAt(0) > 0x7f) {
            const { raw, name } = readName();
            if (s[i] === "(") {
                i++;
                if (name === "url") {
                    // url( ... ): read the content, with or without quotation marks.
                    let j = i;
                    while (j < n && /\s/.test(s[j]))
                        j++;
                    let target = "";
                    if (s[j] === '"' || s[j] === "'") {
                        i = j;
                        target = readString(s[j]).value;
                        while (i < n && s[i] !== ")")
                            i++;
                        i++;
                    }
                    else {
                        const end = s.indexOf(")", j);
                        target = end < 0 ? s.slice(j) : s.slice(j, end);
                        i = end < 0 ? n : end + 1;
                    }
                    target = target.trim();
                    const photo = PHOTO_REF.exec(target);
                    if (photo) {
                        push(`url("photo:${Number(photo[1])}")`);
                        continue;
                    }
                    if (FRAGMENT_REF.test(target)) {
                        push(`url(${target})`);
                        continue;
                    }
                    f.add("css-url");
                    push("none");
                    continue;
                }
                if (CSS_URL_FUNCS.has(name)) {
                    f.add("css-url");
                    skipParens();
                    push("none");
                    continue;
                }
                push(`${raw}(`);
                continue;
            }
            push(raw);
            continue;
        }
        if (ch === "{") {
            if (o.declarations) {
                i++;
                continue;
            }
            depth++;
            push("{");
            i++;
            continue;
        }
        if (ch === "}") {
            i++;
            if (o.declarations || depth === 0)
                continue; // one brace too many
            depth--;
            push("}");
            continue;
        }
        emitChar(ch);
        i += ch.codePointAt(0) > 0xffff ? 2 : 1;
    }
    while (depth-- > 0)
        push("}");
    const css = out
        .join("")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    return { css, strings };
}
// ---------------------------------------------------------------------------
// JavaScript
// ---------------------------------------------------------------------------
/** The function our generator puts the body into, written exactly like this for the check, with the line breaks that keep a comment at the end from swallowing anything. */
export const rawScriptWrapper = (body) => `(function (${RAW_SCRIPT_PARAMS.join(", ")}) {\n"use strict";\n${body}\n})`;
/**
 * Does the body parse inside our wrapper AND on its own? On its own, because a body such as `}); x(); (function () {`
 * would be valid inside the wrapper but would close it too early, and in the list of functions (build.ts) that would
 * break the whole timeline. On its own it parses with return outside a function, which a body is allowed to use.
 */
function parsesAsBody(body) {
    try {
        acornParse(body, { ecmaVersion: "latest", sourceType: "script", allowReturnOutsideFunction: true });
        return acornParse(rawScriptWrapper(body), { ecmaVersion: "latest", sourceType: "script" });
    }
    catch {
        return null;
    }
}
/** `\uXXXX` for one character, as a surrogate pair beyond the BMP. */
function jsEscape(ch) {
    let out = "";
    for (let k = 0; k < ch.length; k++)
        out += `\\u${ch.charCodeAt(k).toString(16).padStart(4, "0")}`;
    return out;
}
/** Where the strings, templates and regular expressions sit in the body. null: it cannot be read. */
function literalSpans(body) {
    const spans = [];
    try {
        for (const t of acornTokenizer(body, { ecmaVersion: "latest", allowReturnOutsideFunction: true, allowAwaitOutsideFunction: true })) {
            const label = t.type.label;
            if (label === "string" || label === "template" || label === "regexp")
                spans.push({ start: t.start, end: t.end });
        }
    }
    catch {
        return null;
    }
    return spans;
}
/**
 * Escapes `<` as `\x3c` inside strings, templates and regular expressions, and every non-ASCII character everywhere
 * as `\uXXXX`. Returns null if `</script` or `<!--` would be left standing afterwards, which would end the
 * surrounding element, or if the body no longer parses.
 */
function escapeScript(text) {
    const spans = literalSpans(text);
    if (!spans)
        return null;
    let built = "";
    let pos = 0;
    for (const sp of spans) {
        built += text.slice(pos, sp.start);
        built += text.slice(sp.start, sp.end).replace(/</g, "\\x3c");
        pos = sp.end;
    }
    built += text.slice(pos);
    built = built.replace(NON_ASCII, (ch) => jsEscape(ch));
    if (/<\/?script|<!--/i.test(built) || !parsesAsBody(built))
        return null;
    return built;
}
/**
 * Sanitizes the script of a slide. It has to parse as the body of our function (rawScriptWrapper). Foreign contacts
 * in strings are removed, then escapeScript runs. A script that does not get through this is dropped entirely and
 * recorded as a finding, while the slide itself stays.
 */
function sanitizeScript(src, ctx, f) {
    const body = clean(src).trim();
    if (!body)
        return { script: "", strings: [], ok: true };
    const tree = parsesAsBody(body);
    if (!tree) {
        f.add("script-syntax");
        return { script: "", strings: [], ok: false };
    }
    // Text and contacts out of the tree, as decoded values. The positions are those in the checked text minus the start of the body.
    const strings = [];
    const replace = [];
    const offset = rawScriptWrapper("").indexOf("\n\n") + 1;
    const visit = (node) => {
        if (!node || typeof node !== "object")
            return;
        const x = node;
        if (x.type === "Literal" && typeof x.value === "string") {
            let hit = false;
            const scrubbed = scrubContacts(x.value, ctx.contacts, () => (hit = true), true);
            if (hit)
                replace.push({ start: x.start - offset, end: x.end - offset, text: JSON.stringify(scrubbed) });
            if (scrubbed.trim())
                strings.push(scrubbed.trim());
        }
        if (x.type === "TemplateElement") {
            const cooked = x.value?.cooked;
            if (typeof cooked === "string") {
                let hit = false;
                const scrubbed = scrubContacts(cooked, ctx.contacts, () => (hit = true), true);
                if (hit)
                    replace.push({ start: x.start - offset, end: x.end - offset, text: scrubbed.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${") });
                if (scrubbed.trim())
                    strings.push(scrubbed.trim());
            }
        }
        for (const [k, v] of Object.entries(x)) {
            if (k === "loc" || k === "range")
                continue;
            if (Array.isArray(v))
                v.forEach(visit);
            else if (v && typeof v === "object" && "type" in v)
                visit(v);
        }
    };
    visit(tree);
    let text = body;
    if (replace.length)
        f.add("contact");
    for (const e of [...replace].sort((a, b) => b.start - a.start))
        text = text.slice(0, e.start) + e.text + text.slice(e.end);
    const built = escapeScript(text);
    if (built === null) {
        f.add("script-markup");
        return { script: "", strings, ok: false };
    }
    return { script: built, strings, ok: true };
}
// ---------------------------------------------------------------------------
// One slide
// ---------------------------------------------------------------------------
/**
 * Sanitizes one slide of the raw draft, as described at the head of this file. Idempotent. `ok` is false only when
 * nothing is left to render or a limit (DYN_LIMITS.raw) is exceeded.
 */
export function sanitizeRaw(input, ctx) {
    const f = new Set();
    const h = sanitizeHtml(input.html ?? "", ctx, f);
    // Every part on its own, the CSS of the field and the styles out of the HTML, the script of the field and the
    // scripts out of the HTML: an unclosed block or a broken script in one part takes nothing away from the others.
    const cssParts = [input.css ?? "", ...h.css].filter((x) => x.trim()).map((x) => sanitizeCss(x, f));
    const c = { css: cssParts.map((x) => x.css).filter(Boolean).join("\n"), strings: cssParts.flatMap((x) => x.strings) };
    const jsParts = [input.script ?? "", ...h.scripts].filter((x) => x.trim()).map((x) => sanitizeScript(x, ctx, f));
    const js = { script: jsParts.map((x) => x.script).filter(Boolean).join("\n;\n"), strings: jsParts.flatMap((x) => x.strings) };
    let ok = true;
    if (!h.html.trim()) {
        f.add("html-empty");
        ok = false;
    }
    if (h.html.length > DYN_LIMITS.raw.html) {
        f.add("html-size");
        ok = false;
    }
    if (c.css.length > DYN_LIMITS.raw.css) {
        f.add("css-size");
        ok = false;
    }
    if (js.script.length > DYN_LIMITS.raw.script) {
        f.add("script-size");
        ok = false;
    }
    return {
        ok,
        html: h.html,
        css: c.css,
        script: js.script,
        findings: [...f],
        texts: [...h.texts, ...c.strings, ...js.strings],
        photos: h.photos,
        brand: h.brand,
    };
}
