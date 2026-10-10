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
- **Motion.** The site’s `--ease` curve is parsed from the stylesheet and used for the
  gentler moves (hops, dimming, folding the name); the rest use expo, back and spring easing
  (see Motion language).
- **The mark.** Three bars, 2, 3 and 5 modules tall on a 4-unit module (SVG heights 8, 12, 20).
- **Where the name sits.** `.wordmark` in the fixed masthead: a 24 px mark at x = container
  left (104.5 px at 1440 wide with a classic scrollbar, 112 px without, 24 px on phones),
  y = 20 px, then the name in Archivo 600 14 px 12 px to its right. It is measured live, glyph
  by glyph, so it holds at any width and scroll position.

## Concept: three bars and a module

The mark has three bars; the piece is built from them. The bars rise one by one, each opens
into one project, each project closes back into its bar, and the finished mark lands in the
masthead. Musically the bars are chords: read the bar heights 8, 12 and 20 as harmonics of
27.5 Hz and you get 220, 330 and 550 Hz, an A major triad, so each bar plays its note as it
rises and the full chord sounds when the mark is complete.

The bars are made of modules (4 units square; the tallest bar is five of them). One module,
in sea-light, is the piece’s character. It bounces in and stamps the bars into place, comes
back as IterMath’s chosen tile, rides the BSQ route as the shuttle, lands on the tallest bar
as its top module, and winks once the wordmark has landed.

Tempo is 125 BPM, so an eighth note is 240 ms, the site’s `--t-base`. Every cue sits on the
beat grid: beats, eighths, 16ths (120 ms) and, in the final countdown, 32nds.

## Motion language

The piece is meant to feel like a motion designer’s reel: dense, bouncy and alive on every
beat, while every move still reads.

- **Squash and stretch.** Anything that lands squashes (wider and flatter, area kept) and
  springs back. Anything moving fast stretches along its path.
- **Anticipation.** Big moves wind up first: a crouch, a pull-back or a tremble, a 16th ahead.
- **Overlap and follow-through.** Letters and parts arrive staggered, overshoot, and settle on
  damped springs. A hard landing sends a hop or a wobble through its neighbours.
- **Secondary motion.** Two parallax layers of dots drift under everything. On every beat a
  ripple runs through them from the focal point. Each project scene has a marquee of its own
  words crossing the background at low contrast. Once landed, focal objects keep breathing a
  few pixels. These layers stay quiet, so the focal point is always clear.
- **Kinetic type.** Letters move one by one. They rise from masks, slam in from the camera
  (with motion trails), converge, drop and bounce, zip in, or spin like a drill bit. A wave
  then runs along the finished line.
- **Transitions are motion.** Bars burst open into the next scene, scenes leave as flying
  slices, get sucked back into their bar, or break into falling strips. One scene’s object
  becomes the next one’s.
- **Impact.** Big hits get a short camera shake, a zoom punch, a sea-light ring and a
  chromatic split on the word that hit. Fast moves leave motion trails.
- **Easing.** Expo, back and damped springs. The only linear motion is the constant drift of
  the background.
- **No strobing.** Nothing flashes the whole screen. Flashes stay small and well under three
  a second (WCAG 2.3.1); the switches between stone and petrol stay at the scene changes, as
  before.
- **Energy builds.** Events come closer together through the finale, down to 32nds. Then
  everything freezes for an eighth in silence, the one deliberate hold, before the final hit.

## Timing sheet

Seconds from the start; b = beat (0.48 s), so b4.5 is 2.16 s. On every beat the dot field
ripples, and from b4 to b28 the groove plays (a kick on every beat, claps on 2 and 4, hats
on the 16ths, the bass on the off-beats). Those are not repeated below.

### Seed (b0–b4, stone)

| Beat | Time | Moves | Sound |
| --- | --- | --- | --- |
| b0 | 0.00 | The module falls in from above the frame, stretched by its speed. | Whoosh down |
| b0.5 | 0.24 | It lands mid-screen and squashes. A 1 px ink hairline (the loader’s track) bursts out from the impact to both container edges, overshoots and settles. | Thud, pop |
| b0.75 | 0.36 | The module hops toward bar 1’s place, stretched. | — |
| b1 | 0.48 | It lands; bar 1 springs up under it (overshoot, settle) and throws it on. | Pluck 220 Hz |
| b1.5 | 0.72 | Top of the module’s arc; bar 1 wobbles. | Hat |
| b2 | 0.96 | Lands on bar 2’s place; bar 2 springs up and throws it on. | Pluck 330 Hz |
| b2.5 | 1.20 | Top of the arc; bar 2 wobbles. | Hat |
| b3 | 1.44 | Lands on bar 3’s place; bar 3 springs up and throws it high. | Pluck 550 Hz, riser |
| b3.25 | 1.56 | The module reaches its apex and turns back toward bar 1. | Clap |
| b3.5 | 1.68 | The hairline tugs outward, then snaps into the mark from both ends. | Clap |
| b3.75 | 1.80 | Anticipation: bar 1 crouches as the module dives at it. | Clap |
| b4 | 1.92 | The module dives into bar 1, and bar 1 bursts open into MangARTI. | Crash |

### MangARTI (b4–b12, petrol)

Throughout: the marquee “MangARTI · Ngana · Ngna · ngn” crosses the background, right to left.

| Beat | Time | Moves | Sound |
| --- | --- | --- | --- |
| b4 | 1.92 | Bar 1 bursts open, up to full height in a 16th, then out to full width in the next 16th; the camera punches in. | Crash, kick |
| b4.5 | 2.16 | The kicker and meta rise letter by letter. “N” slams in from the camera, leaving a trail, and squashes as it lands. | Pop |
| b4.75–b5.5 | 2.28–2.64 | “g”, “a”, “n”, “a” slam in on 16ths. Each landing bumps the letters already there. | Pop on each, rising |
| b5.75 | 2.76 | Anticipation: the first “a” trembles. | — |
| b6 | 2.88 | It is knocked out: it pops up and falls off the bottom, spinning. “n” and “a” slide left to close the gap, a 16th apart, overshoot and settle: “Ngna”. | Drop, whoosh |
| b6.5 | 3.12 | All four letters hop. | Pop |
| b6.75 | 3.24 | Anticipation: the last “a” trembles and the N crouches. | — |
| b7 | 3.36 | The last “a” is knocked out and falls; the N flips over into n with a squash; the letters close up on springs: “ngn”. | Drop, pop |
| b7.25 | 3.48 | The caption “One word, ‘you’, in three spellings” rises letter by letter. | — |
| b7.5 | 3.60 | A wave runs along “ngn”. | Hat |
| b8 | 3.84 | “ngn” steps back (smaller, higher, dimmer) on a spring. “A” rises. | Kick, pluck |
| b8.5 | 4.08 | “language” rises in a wave, each letter overshooting. | Pluck |
| b9 | 4.32 | The letters of “model” fly in from scattered places and converge. | Pluck |
| b9.5 | 4.56 | “that” rises. | Pluck |
| b10 | 4.80 | The letters of “speaks” drop from above and bounce. | Pluck |
| b10.5 | 5.04 | “Manadonese.” (sea-light) slams in from the camera: trail, squash, chromatic split, camera shake and a sea-light ring. | Hit, pluck |
| b10.75 | 5.16 | A wave runs along the whole sentence. | — |
| b11 | 5.28 | The scene leaves as six horizontal slices that fly out left and right in turn, revealing stone and the mark with bar 1 missing. | Whoosh |
| b11.5 | 5.52 | Bar 1 drops back into place, squashes and settles. | Pop |
| b11.75 | 5.64 | Anticipation: bar 2 crouches. | Riser |

### IterMath (b12–b20, petrol)

Throughout: a marquee of the module symbols crosses left to right; landed tiles breathe.

| Beat | Time | Moves | Sound |
| --- | --- | --- | --- |
| b12 | 5.76 | Bar 2 bursts open the other way round: out to full width in a 16th, then up to full height in the next; the camera punches in. | Crash, kick |
| b12.5–b14 | 6.00–6.72 | The seven tiles (+ − × ÷ ( ) nCr nPr) jump up from below on 16ths. Each stretches in flight and squashes as it lands, overshooting on a spring. | Pluck on each, rising |
| b14.25 | 6.84 | Anticipation: the nCr tile crouches. | — |
| b14.5 | 6.96 | nCr jumps and fills with sea-light: the module is back. A sea-light ring bursts from it; its neighbours are pushed aside and spring back; the other tiles dim. | Bell |
| b14.75 | 7.08 | nCr lands and squashes. | Pop |
| b15 | 7.20 | “nCr =” rises letter by letter; the fraction bar shoots across. | Whoosh |
| b15.25 | 7.32 | n! springs up out of the bar; r!(n − r)! drops out of it and bounces. | — |
| b15.5–b15.75 | 7.44–7.56 | The three “!” pop on 32nds. | Three pops |
| b16 | 7.68 | The graphic steps back on a spring. “A math” rises. | Kick, pluck |
| b16.5 | 7.92 | The letters of “drill” spin in like a drill bit. | Pluck |
| b17 | 8.16 | “that” rises. | Pluck |
| b17.5 | 8.40 | “sticks.” hangs above its place, wobbling. | — |
| b17.75 | 8.52 | It pulls up, stretched (anticipation). | Whoosh down |
| b18 | 8.64 | It slams down and stops dead: a hard squash that snaps square without bouncing, camera shake, chromatic split. The beat stops for an eighth. | Hard hit |
| b18.5 | 8.88 | Follow-through: the other words hop once, rippling outward from “sticks.”. | Pop |
| b19 | 9.12 | The scene breathes in, then is sucked back into bar 2. The sea-light tile is spat out as a module. | Whoosh |
| b19.5 | 9.36 | Bar 2 lands in place and squashes; the module arcs over toward bar 3. | Pop |
| b19.75 | 9.48 | Anticipation: bar 3 crouches as the module falls at it. | Riser |

### BSQShuttle (b20–b28, petrol)

Throughout: the marquee “BSQ · Kijang · Syahdan · Anggrek” crosses right to left, faster
while the shuttle moves; speed lines streak behind it.

| Beat | Time | Moves | Sound |
| --- | --- | --- | --- |
| b20 | 9.60 | The module hits bar 3, and bar 3 bursts into petrol modules that pop in outward from it until they fill the screen. | Crash, kick |
| b20.25 | 9.72 | The route line shoots across; the four stops pop in on 32nds. | Whoosh |
| b20.5 | 9.84 | The module lands at BSQ as the shuttle and squashes. The stop names rise letter by letter. | Pop |
| b20.75–b21 | 9.96–10.08 | The shuttle pulls back (anticipation), shoots to Kijang stretched, overshoots, and settles. The stop pops and its name hops. The travelled line turns sea-light. | Whoosh, chime |
| b21.5–b22 | 10.32–10.56 | The same to Syahdan. | Whoosh, chime |
| b22.5–b23 | 10.80–11.04 | The same to Anggrek. | Whoosh, chime |
| b23.5 | 11.28 | The shuttle does a happy hop at Anggrek and lands on b23.75. | Pop, pop |
| b24 | 11.52 | The graphic steps back on a spring. “A” rises. | Kick, pluck |
| b24.5 | 11.76 | The letters of “shuttle” zip in from the left with trails, overshoot and settle. | Pluck |
| b25–b25.25 | 12.00–12.12 | “you” and “can” rise. | Pluck |
| b25.5 | 12.24 | The letters of “actually” converge. | Pluck |
| b25.5–b26 | 12.24–12.48 | “catch.” (sea-light) rushes in from the right, stretched, with a trail… | Whoosh |
| b26 | 12.48 | …and halts dead on the beat: it squashes against the stop, and its full stop arrives a 32nd late and bumps it. Shake, chromatic split. | Hit, bell |
| b26.5 | 12.72 | The shuttle hops in the background. | Pop |
| b27 | 12.96 | The scene drops away as six vertical strips that fall one after another, revealing the mark with bar 3 one module short. | Whoosh down |
| b27.5 | 13.20 | Bar 3 pops back into place; the module (the shuttle) falls from above. | Pop |
| b27.75 | 13.32 | Anticipation: the mark crouches. | Riser |

### Name and the final hit (b28–b32, stone)

Throughout: three sea-light dots orbit the mark, faster with each event, until the pause.

| Beat | Time | Moves | Sound |
| --- | --- | --- | --- |
| b28 | 13.44 | The module lands on bar 3 as its top module, completing the mark. The whole mark squashes on impact. | Hit, crash, the chord |
| b28.25 | 13.56 | The mark crouches. | — |
| b28.5 | 13.68 | It hops aside, stretched, to make room for the name… | Whoosh |
| b28.75 | 13.80 | …and lands, squashing. | Pop |
| b29 | 13.92 | “Jonathan” rises in a fast wave, 30 ms between letters, each overshooting. | Kick |
| b29.5 | 14.16 | “Montolalu” slams in from the camera letter by letter, 30 ms apart, with trails (on phones, on its own line). | Kick, clap |
| b30 | 14.40 | Countdown 3: bar 3 punches up and snaps back; a hop runs along the name; the camera cuts in closer. | Tom |
| b30.5 | 14.64 | Countdown 2: bar 2 punches, a closer cut. The wind-up starts: the wordmark crouches and pulls back from the masthead. On phones the surname slides clear of the first name… | Tom |
| b30.75 | 14.76 | Countdown 1: bar 1 punches, a closer cut. On phones the two lines meet. | Tom |
| b30.875 | 14.82 | All three bars punch and the module sinks into bar 3, turning ink: it is part of the mark now. | Tom roll |
| b31 | 14.88 | **The pause.** Everything freezes mid-action: the wordmark, the dots, the camera. Silence. | Silence |
| b31.5 | 15.12 | The wordmark slams to the masthead in an eighth, stretched along its path, leaving a trail. | Whoosh |
| b32 | 15.36 | **The final hit.** It lands exactly on the real wordmark and squashes; a sea-light ring, a short shake. The cover breaks into modules that clear outward from it within half a second, glowing sea-light at the wavefront, revealing the page. | Impact, kick, crash, chord |
| b32.25 | 15.48 | The wink: the top module of bar 3 blinks sea-light, shut and open, then is ink again. | Pop |
| — | 15.61 | The drawn wordmark is settled exactly in place. The real one is shown and the drawn one dissolves into it over 0.16 s. | — |
| — | 16.04 | The overlay is removed; the chord rings out over the page until about 17.5 s. | — |

## The handoff

The canvas wordmark is drawn glyph by glyph at positions measured from the real
`.wordmark` (`Range.getBoundingClientRect` per character, the SVG mark’s box snapped to device
pixels as the browser paints it), so it lands on the real one. Every squash, shake and wink
after the landing has died away by 15.61 s, when the drawn wordmark is exactly in place. The
real wordmark is hidden while the intro plays and shown again once the landing wave has
cleared the masthead; the drawn one dissolves into it, then the overlay is removed. The page
ends as itself, not a copy.

## Soundtrack

Synthesised with the Web Audio API: kick, clap, hats, toms, a bass on A, a pluck lead, bells,
a pad, pops, whooshes, a riser and an impact, from oscillators and generated noise, through a
tempo-synced delay (a dotted eighth), a generated reverb and a compressor. Every pitched note
is a whole multiple of 27.5 Hz. The score uses the same beat grid as the pictures: each event
in the timing sheet has its sound. For the pause, everything is cut, reverb and echo tails
included, so the silence is real. Visuals keep their own clock; audio events are queued a
second ahead on the audio clock, mapped with `getOutputTimestamp()` so they are heard when
they are seen. The mapping is re-read every frame (the median of the last five readings), so
a bad first reading or an audio clock drifting against the page’s cannot put the sound out of
step. Sound is off by default; nothing audio is created until “Sound on” is pressed.

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
  over a page the visitor has not seen: the site’s loader must still be up when the script
  runs (`data-booted` unset, no `no-js`); otherwise it offers Replay only. The stylesheet costs
  one more round trip, and on phones the loader often lifts before it arrives, so from the
  moment the script runs a plain cover in the loader’s colour sits just beneath the loader.
  It comes down in the same frame the intro goes up. If the stylesheet fails, the cover goes at
  once; if the stylesheet is still not there 2 s after the loader has lifted, or the site falls
  back to its static page, the cover goes and the intro is offered as Replay only. Any error or
  missing token or stylesheet ends the intro and restores the page, as do frames stopping for
  6 s (checked once a second). Title, meta, JSON-LD and markup are unchanged, so search engines
  and link previews see the same page.

## Performance

Canvas 2D, no libraries. If frames keep running long, the intro first leaves out its extra
effects (motion trails, chromatic splits, the marquee and the second dot layer), then steps
the device pixel ratio (capped at 2) down to 1.5 and 1. Checked at phone size with 4× and 6×
CPU throttling, in Chromium with a software GPU, which makes drawing slower than a phone’s GPU
does.

Measured with the site’s stage running (average frame rate over the whole intro, including
the stage’s start-up; the median frame was 16.7 ms in every case):

| | First version | This version |
| --- | --- | --- |
| Phone size, 4× slower CPU | 45 fps | 42 fps |
| Phone size, 6× slower CPU | 45 fps | 37 fps |
| Desktop, 1440 × 900 | 40 fps | 36 fps |

Toned down for speed after measuring: the dot field was the costliest effect (drawn as one
path it halved the frame rate), so each dot is now its own rectangle and the grid is
sparser; letters slam in from twice their size rather than nearly three times; motion
trails have two copies, not three. The busiest stretches are the openings of MangARTI and
IterMath, where large letters enter on every 16th (about 38–40 fps on desktop, against
55–58 before).

The site’s 3D stage starts while the intro plays and, on a slow device, can hold up every
frame for seconds as it does (here, with a software GPU, 2–4 s). The first gap of more than
1 s between frames is therefore a pause: the piece carries on where it stopped and the sound,
if on, picks up again in step. Later long gaps are dropped frames, so a device that is slow
throughout still finishes on time.

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
- Fixed after release: on a first visit from a phone the intro often did not play. The site’s
  loader lifted while the intro’s stylesheet was still loading, and on slow connections the
  stylesheet arrived after the old 3 s takeover limit. The limit is gone and the cover described
  under Behaviour holds the page until the stylesheet arrives. Separately, the stage’s start-up
  could hold frames up past the old 3 s stall limit, which ended the intro, or skip its opening;
  the limit is now 6 s and the first long gap is a pause (see Performance). With phone-like
  network delays and a 4× slower CPU it now plays to the end in all six cases tried (4G, slow
  4G and 3G, each with and without a warm cache); before, it did not start in three of them.
- Second version, more motion: the first one felt too calm, with stretches of up to half a
  second in which nothing on screen changed. Same length, scenes, cut points and handoff; new
  motion on every beat, written up in the timing sheet before the code. Measured frame by
  frame at 60 steps a second, the only identical frames are now the deliberate pause, where
  the first version had 25 still stretches. In the project scenes three to four times as much
  of the screen changes from one frame to the next (4.2–5.4% against 0.9–1.7% at desktop size).
