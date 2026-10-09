# Homepage intro: plan

A 16-second motion piece drawn live on a canvas over `index.html`, with a soundtrack
synthesised in the browser. When it ends, the mark and name land on the real wordmark in the
masthead and the real page appears around them. The existing site is not changed: the intro
lives in `assets/intro.js` and `assets/intro.css`, plus one `<script>` tag in `index.html`.

## What it takes from the site

- **Content.** The three sentences of the hero headline, each paired with its project from the
  Work page: MangARTI (Manado Malay translator; “Ngana”, “Ngna” and “ngn” are one word, “you”, in
  three spellings; Llama 3 8B, QLoRA, one laptop GPU), IterMath (seven modules from addition to
  permutations: + − × ÷, mixed arithmetic, nCr, nPr; shows the factorial working after a wrong
  answer) and BSQShuttle (33 daily departures across three routes; the Kemanggisan route stops
  at BSQ, Kijang, Syahdan and Anggrek). The name is the wordmark’s: Jonathan Montolalu. No other
  copy, numbers or claims.
- **Palette** (read at runtime from the tokens in `style.css`): stone `#E5E6E1` and ink
  `#14181A` for light scenes, petrol `#0B1618` and chalk `#E8EAE6` for dark ones, sea-light
  `#7FC9B6` as the only accent. Light and dark follow the site’s chapters: the homepage is
  light, the Work page, where the projects are written up, is dark.
- **Type.** Archivo, as on the site: 700 with −0.04em tracking for statements (the `t-display`
  style), 500 for kickers and labels, 600 for the name. Kickers use the Work page’s pattern,
  “01 · MangARTI”.
- **Motion.** The site’s two curves, `--ease` and `--ease-heavy`, are parsed from the
  stylesheet and drive every move.
- **The mark.** Three bars, 2, 3 and 5 modules tall on a 4-unit module (SVG heights 8, 12, 20).
- **Where the name sits.** `.wordmark` in the fixed masthead: a 24 px mark at x = container
  left (104.5 px at 1440 wide with a classic scrollbar, 112 px without, 24 px on phones),
  y = 20 px, then the name in Archivo 600 14 px 12 px to its right. It is measured live, glyph
  by glyph, so it holds at any width and scroll position.

## Concept: three bars

The mark has three bars; the piece is built from them. The bars rise one by one, each opens
into one project, each project folds back into its bar, and the finished mark lands in the
masthead. Musically the bars are chords: read the bar heights 8, 12 and 20 as harmonics of
27.5 Hz and you get 220, 330 and 550 Hz, an A major triad, so each bar plays its note as it
rises and the full chord sounds when the mark is complete.

Tempo is 125 BPM, so an eighth note is 240 ms, the site’s `--t-base`. Every cue sits on a
16th-note grid (120 ms). Nothing fades in at random: elements enter through masks, flips and
wipes, on the beat.

## Scenes (seconds; one bar = 1.92 s)

| Time | Bars | Scene |
| --- | --- | --- |
| 0.00–1.92 | 1 | **Seed** (stone). A 1 px ink hairline draws across the container in one beat, as the loader’s track does. The three bars rise from it at 0.48, 0.96 and 1.44 (plucks at 220, 330, 550 Hz), then the hairline retracts into the mark. A riser and three claps lead into the drop. |
| 1.92–5.76 | 2–3 | **MangARTI** (petrol). Bar 1 opens: up to full height in an eighth, out to full width in the next. “Ngana” rises letter by letter; at 2.88 one “a” drops out, giving “Ngna”; at 3.36 the last “a” drops and the N folds over into n, giving “ngn”. Caption: One word, “you”, in three spellings. From 3.84 “A language model that speaks Manadonese.” lands word by word on eighths, the graphic stepping back behind it. The scene folds back into bar 1 (5.28–5.76), its fill turning back into the bar’s tone. |
| 5.76–9.60 | 4–5 | **IterMath** (petrol). Bar 2 opens. Seven tiles flip in on 16ths (6.00–6.72), + − × ÷ ( ) nCr nPr, each with the next note of a rising run. At 6.96 nCr fills with sea-light (a bell) and its working typesets beneath: the fraction bar draws, n! rises out of it and r!(n − r)! drops out of it. “A math drill that sticks.” follows; “sticks.” drops and stops dead on 8.64, where the beat stops for an eighth. Folds back into bar 2. |
| 9.60–13.44 | 6–7 | **BSQShuttle** (petrol). Bar 3 opens. A route line draws through BSQ, Kijang, Syahdan and Anggrek; the shuttle, a sea-light module, stretches as it moves and arrives at each stop on the beat (10.08, 10.56, 11.04) to a descending station chime, leaving the travelled line sea-light. “A shuttle you can actually catch.” follows; “catch.” pulls in from the right and halts on 12.48. Folds back into bar 3. |
| 13.44–15.36 | 8 | **Name** (stone). The complete mark holds as the drums drop out and the A major chord swells. It steps aside, “Jonathan” and “Montolalu” rise in beside it, and from 14.40 the wordmark flies to the masthead on `--ease-heavy`, scaling down (geometrically) to its real size. On phones the name stands on two lines so it can be large, and folds to one on the way, in two eighths so the lines never cross (14.88: the surname slides clear; 15.12: the lines meet). |
| 15.36–16.04 | 9 | **Landing.** The wordmark lands on the real one on the downbeat, with the final hit. The cover then breaks into modules that clear outward from it within half a second, the wavefront glowing sea-light as the site’s stage does when clicked, revealing the real page. At 15.61 the real wordmark is shown and the drawn one dissolves into it over 0.16 s. The overlay is removed at 16.04; the chord rings out over the page until about 17.5 s. |

## The handoff

The canvas wordmark is drawn glyph by glyph at positions measured from the real
`.wordmark` (`Range.getBoundingClientRect` per character, the SVG mark’s box snapped to device
pixels as the browser paints it), so it lands on the real one. The real wordmark is hidden
while the intro plays and shown again once the landing wave has cleared the masthead; the
drawn one dissolves into it, then the overlay is removed. The page ends as itself, not a copy.

## Soundtrack

Synthesised with the Web Audio API: kick, clap, hats, a bass on A, a pluck lead, bells, a pad,
a riser and one impact, from oscillators and generated noise, through a tempo-synced delay
(a dotted eighth), a generated reverb and a compressor. Every pitched note is a whole multiple
of 27.5 Hz. The score uses the same beat grid as the pictures. Visuals keep their own clock;
audio events are queued a second ahead on the audio clock, mapped with `getOutputTimestamp()`
so they are heard when they are seen. Sound is off by default; nothing audio is created until
“Sound on” is pressed.

## Behaviour

- Plays once per visit, only when the homepage is the first page of the visit (the site’s own
  `jm:booted` flag, read as `data-boot="warm"`), and records `jm:intro` in sessionStorage. If
  storage is unavailable it does not autoplay.
- Never plays with `prefers-reduced-motion: reduce`, and stops if that setting turns on.
- Controls: Sound on/off and Skip intro (also Escape). Afterwards, “Replay intro” and a credit
  in the footer: the intro and its soundtrack were made with Claude, an AI assistant.
- While it plays: the page is `inert` and `aria-hidden` (only where the intro changed it), the
  document does not scroll (with a stable scrollbar gutter, so nothing reflows), and the
  masthead wordmark is hidden. All restored on exit. Focus is not moved; Replay returns focus
  to its button and keeps the scroll position.
- Loads without blocking: one deferred script, which injects its stylesheet. It only takes
  over while the site’s loader is still up (`data-booted` unset, no `no-js`) and within the
  first 3 s; otherwise it offers Replay only. Any error, missing token or stylesheet, or
  stalled frame loop ends the intro and restores the page. Title, meta, JSON-LD and markup are
  unchanged, so search engines and link previews see the same page.

## Performance

Canvas 2D, no libraries. The device pixel ratio is capped at 2 and stepped down to 1.5 and 1
if frames keep running long. Checked at phone size with 4× and 6× CPU throttling.

## Changes from the first draft

- BSQShuttle no longer shows the device clock: without a timetable beside it, a bare time read
  as noise.
- The two-line name on phones is new: on one line the finale wordmark could only be drawn at
  about 1.5 times its real size on a 390 px screen.
- The wordmark hands over with a 0.16 s dissolve instead of a single-frame swap. Measured in
  Chromium, page text baselines are rounded to whole CSS pixels and canvas text to device
  pixels, so on 2× and 3× screens they can differ by one device pixel; other engines could not
  be measured here.
- The pad’s low voice moved from 110 Hz to 440 Hz: the spectrogram showed the finale’s low end
  as a muddy wash.
