# Blikka brand: design principles for a human camera brand

How the craft of photography translates into Blikka's brand and app UI. Covers the thesis, principles, logo, color, type, shape, layout, grain, voice and pitfalls.

Design file: [Paper](https://app.paper.design/file/01M65Y9CDET2K4TE3HVK0A171J).

| Page | What it holds |
| --- | --- |
| Blikka — Edition 03 · full | The current system: cover, logo, color by day and after dark, type, shape, shot data, grain |
| Blikka — Edition 03 · neutral light | A shorter set: cover, color in both themes, type, shape |
| Blikka — Edition 03 | The short set on the earlier beige light ground |
| Participant flow — Edition 03 | The participant app in light and dark, including the v3 flow (Google or guest, the roll as home) |
| Organizer — org home | Org home, running and first run, in light and dark (the `E03` boards) |
| Blikka — Edition 02, Edition 01 | Earlier editions, kept for reference. They still show the instant print, which the system no longer uses |

Logo source files: `apps/web/public/blikka-logo*.svg`.

## What Edition 03 changed

- **No instant print.** No white print card, no weighted chin, no 1 : 1.215 frame layout. The metaphor is the camera and the roll: viewfinder, frame counter, roll list, results.
- **Words in Schibsted Grotesk, values in Martian Mono.** Mono is only for things you could measure. Nav, labels, buttons and eyebrows are in the sans, in sentence case. Inter Tight and Geist Mono are gone.
- **Every surface in light and dark,** following the system setting. Each light color has one dark partner.
- **Left-aligned.** Center only screens with one thing to look at, such as a countdown or a confirmation.
- **Cards only in the organizer app.** The participant app is flat, grouped with hairlines and space.
- **Photos bleed in org cards.** A photo runs to the card's edge and takes its corners. Everywhere else a photo is cut square.
- **Four radii.** Photos 0, controls 10px, org cards 12px, one pill per screen. Sheets follow the device.
- **Grain is for marketing.** The product has none, unless it means something on that screen.
- **A new dark surface, Tank.** It's the dark partner of the white card, for cards and sheets.
- **Light is neutral gray.** The beige light palette (Paper, Frame white, Chin, Rule, Graphite) is gone from the product. Paper stays as dark mode's text color.

## The thesis

**Position the product as a camera, not an app.** As generated images get cheap, a photo is valuable because someone was there. The brand should prove presence (who, where, when, unretouched) and treat capture, waiting and giving as rituals. Modern means precise systems with human warmth, not retro costume.

> "We didn't say we made an app. We say we made a camera."
> Sebastiaan de With, Lux Optics (Halide), Apple Developer: Behind the Design

Teenage Engineering, Nothing and Lux Optics get this balance right. They pair strict, engineered systems with play and a physical feel. That balance is the model here.

Blikka runs photo events of every kind: marathons, live by-camera events, topic-by-topic walks, club nights and exhibitions. Whatever the format, a participant shoots a roll of topics. The rituals are built into the product, so the brand only has to make them visible.

## Why the print went away

Editions 01 and 02 built the layout on the instant print: a card in its proportion, a heavy chin for captions, the photo inset in a white border. It read as Polaroid every time, even without the color stripes. In the app it also meant a soft card around every photo, which made screens look like a scrapbook.

The camera carries the same ideas without the costume. A roll has a fixed number of frames, a counter, an order and a moment you're done. Those are things the product already does.

## Principles

1. **The photo is the interface.** Chrome recedes. Nothing covers the image or the viewfinder.
2. **The roll is the home.** A participant enters once, and the roll is the screen they return to all day. Every format is the same roll in a different state.
3. **One main action per screen.** It gets the pill. Everything else is quieter.
4. **Make scarcity a feature.** One frame per topic. Counters and a finished roll are moments.
5. **Words and values.** Sentences in the sans, measurements in mono. Never the other way round.
6. **Ration color.** A neutral surround, Safelight for live or due, Blue hour for state. In the product, three status colors report what happened. Nothing else.
7. **Toy on top, depth underneath.** Defaults a first-timer understands, with more control one deliberate step away.
8. **Proof of presence.** Who was there, where and when. No generated imagery in the brand, ever.
9. **Private like a film camera.** No analytics on photos. Trust is part of what makes it feel human.

## Case studies

| Brand | What they do | What to take |
| --- | --- | --- |
| Teenage Engineering | Simple geometry, a basic palette, a toy-like surface with pro depth | Fun on the surface, serious underneath. |
| Nothing | Ndot dot-matrix type with strict rules for where it goes | A type system with rules. Ndot is only for names, the way our mono is only for values. |
| Halide and Kino | Custom type, consistent gestures, a viewfinder nothing covers | One signal color and controls that stay in the same place. |
| Leica | Removing controls as a brand statement. The M-D dropped the screen | Restraint you can feel. |
| Fujifilm | Film simulations with real lineage | A few named looks beat 40 anonymous filters. |
| Dispo and Lapse | Rolls, waiting and developing later | Scarcity and waiting as core mechanics, not add-ons. |
| BeReal | One prompt, two minutes | Design for authenticity, but don't build countdown pressure. |
| Polaroid | Heritage modernized around the instant print and its color stripes | Why we don't use the print. It's their trade dress, and borrowing it reads as fan art. |

## Logo

The mark is a camera, built from three forms: a grip, a viewfinder and a body with one lens. It's drawn like a tool, not an illustration, so it holds up at 16 px and on a 6 m banner.

The wordmark is "blikka" in lowercase, set in **Righteous** at tracking −0.01em. Its round geometry matches the mark's corner radii.

### Lockup

All values are relative to the mark's height **H**:

- **Vertical alignment:** the wordmark is centered on the mark. Standing it on the mark's bottom edge leaves the viewfinder sticking up on its own.
- **Wordmark size:** Righteous at 0.88 H. The tall letters (b, l, k) come to about two thirds of the mark's height.
- **Gap between mark and wordmark:** about 0.3 H, roughly one lens diameter (0.324 H).
- **Clear space:** one lens diameter on every side. Nothing enters it, including a photo.

### Construction

| Shape | Corner radius | Note |
| --- | --- | --- |
| 1 Grip | 0.17 H | Full height, a stadium |
| 2 Viewfinder | 0.12 H | The short bar on top |
| 3 Body | 0.19 H | Holds the lens, 0.32 H across |

### Usage

- **Color:** Paper on dark, Ink on light. Never in an accent color, and never on top of a face.
- **Minimum size:** 16 px for the mark and 72 px wide for the lockup. Below that, use the wordmark alone.
- **Mark alone:** for the app icon and favicon.
- **Don't** rotate it, outline it, add a lens flare, or put it inside a white print frame.

## Color

One palette, two lights. Every surface comes in light and dark and follows the system. Each light color has one dark partner, so a screen is designed once and recolored by role.

| Role | Light | Dark |
| --- | --- | --- |
| Ground | `#FAFAFA` | Fixer `#0F0F0E` |
| Card and sheet | White `#FFFFFF` | Tank `#1C1B19` |
| Sidebar and top bar | `#F4F4F4` | Fixer `#0F0F0E` |
| Dashboard page panel | `#FDFDFD` | `#161514`, halfway from Fixer to Tank |
| Control edge | `#D4D4D4` | Silver `#A7A49C` |
| Focus ring | `#8A8A8A` | Silver `#A7A49C` |
| Panel and selected nav | `#F0F0F0` | Tray `#2A2926` |
| Line | `#E5E5E5` | Tray `#2A2926` |
| Muted text | `#666666` | Silver `#A7A49C` |
| Text | Ink `#151515` | Paper `#F3F0E8` |
| Main action | Ink fill, white text | Paper fill, Ink text |

Light is untinted gray. A tinted ground changes how a photo's white balance reads, and near white any warmth shows as cream. The warmth lives in dark, where it reads as depth.

In dark, both raised surfaces get lighter than the ground: Tank for cards and sheets, Tray for panels. Tray is also the hairline color, because a darker line disappears on Fixer.

### Accents

The accents are the same in both themes.

| Name | Hex | Job |
| --- | --- | --- |
| Safelight | `#D3301F` | Live or due: the live dot, the last-photo deadline, a timer running out. Once per screen. |
| Blue hour | `#5F7E9B` | State: the current frame's tick, an open topic, an upload in progress, a jury pick. |

Neither accent reaches 4.5:1 for small text in both themes (Safelight is about 3.8:1 on Fixer and 4.8:1 on the light ground, Blue hour about 4.5:1 and 4.1:1). So accents are dots, ticks, outlines and fills, not small text. A live line is a Safelight dot followed by text in Ink or Paper. A tag filled with Blue hour uses text at 14 px semibold or larger.

### Status

Product only: the dashboard and the forms people fill in. Never the landing page, posters, social posts or anything that sells. Each status has a light and a dark value.

| Name | Light | Dark | Job |
| --- | --- | --- | --- |
| Leaf | `#359658` | `#5FA87A` | Done: saved, published, uploaded. |
| Golden hour | `#C8800D` | `#CA933E` | Needs a look: incomplete setup, a topic without a name, waiting on someone. |
| Burn | `#A71F43` | `#DE6E74` | Failed: errors, a failed upload, destructive actions. |

- **Color the dot, not the words.** Leaf and Golden hour are dots and 6% tints behind an alert, with the text in Ink or Paper. An amber dark enough for text turns brown.
- **Only Burn is text,** for error messages. It reaches 4.5:1 on the ground, card and panel in both themes.
- **Report, then stop.** No colored buttons, cards or headings.
- **Burn is not Safelight.** Safelight is live or due. Burn is something that went wrong, so it's a darker, cooler red.
- **In progress is Blue hour,** not a status color.

## Type

Two faces and the wordmark. All are free on Google Fonts.

| Role | Face | Rules |
| --- | --- | --- |
| Wordmark | Righteous 400 | The name only. Never headlines, never UI. |
| Words | Schibsted Grotesk | Headlines at 600, tracked tight (about −0.04em above 36 px). Body at 400, labels and buttons at 500. Sentence case. |
| Values | Martian Mono | Times, counts, dates, coordinates, settings and entry numbers. Uppercase with open tracking (0.06 to 0.08em) at small sizes. Keep `ƒ` lowercase. |

### Words and values

Mono is for things you could measure. If it's a word, it goes in the sans, however small.

| In mono | In the sans |
| --- | --- |
| `14:00`, `04/08`, `12:40 LEFT` | Nav items, buttons, field labels |
| `ƒ/2.8 · 1/250 · ISO 400` | Section headings and eyebrows |
| `59.3201° N 18.0716° E` | Helper text and messages |
| `NO. 147`, `21 NOV · 38 ENTERED` | Topic names and event names |
| A place or status word inside a value line: `LIVE · STOCKHOLM` | Status on its own: "Live now", "Draft", "Closed" |

When a line mixes them, set each part in its own face: "Hand in by" in the sans, `20:00` in mono. Prose keeps its numbers in the sans: "The last photo is due at 18:00."

- **No serif, no italic, no handwriting.**
- **No dot or pixel type.** It reads as Nothing.
- **Big numbers are fine** when they're the subject of the screen: a countdown, a frame counter, an entry number, an organizer's stats.

## Shot data

A photo's EXIF is the proof someone was there. It's shown in mono, small, next to the photo and never over it.

- **Data line:** one line under the photo, `ƒ/2.8 · 1/250 · ISO 400` on the left and the capture time on the right.
- **Frame counter:** `04/08`, with the total dimmed. Beneath it, one tick per frame: done in Ink (Paper in dark), the current frame in Blue hour, the rest in the line color (`#E5E5E5`, Tray in dark).
- **Real numbers only.** Use the photo's own EXIF. If a value is missing, leave it out rather than invent one.

## Shape

Square photos, soft controls.

| Radius | Use |
| --- | --- |
| 0 | Photos, anywhere a photo is the work: the roll, the frame check, results, jury, gallery, exports |
| 10px (`--radius-control`) | Inputs, secondary buttons, tags, segmented controls, menus, selected nav. It's ui-sdk's default `--ui-radius` |
| 12px (`--radius-card`) | Org app cards only. No shadow, a hairline at most |
| Full | The one main action per screen: the shutter, Add photos, New event |
| The device's | Bottom sheets and the viewfinder, kept concentric with the phone |

- **Never round a photo where it's the work.** A dashboard card is navigation, so its photo bleeds and takes the card's corners. Inset photos with a white border are the print again, so don't use them.
- **Never tilt.** Photos and cards sit straight on the grid.
- **One pill per screen.** If two things want to be round, neither is the main action. Pick one.
- **Dots are circles** at any size and don't count against the pill.
- **No shadows** on cards. Use the ground, a hairline and space.

## Layout

- **Left-aligned by default.** A big headline top left, content in one column, the main action pinned to the bottom on phones.
- **Center single-focus screens:** a countdown, "Roll handed in", an empty state like an organizer's first event.
- **The participant app is flat.** Rows sit on the ground with hairlines between them. No cards.
- **The organizer app uses cards** where a page needs grouping: the live event, upcoming events, lists of things that need you.
- **One question per step** in participant entry, with the keyboard up and a progress bar.
- **Nothing cute.** No avatar stacks, star badges or icon-in-circle cards.

## Grain

Grain is for marketing: posters, the landing page and brand boards. A faint grain (about 4% on grounds, 8% on large panels) makes printed and large-screen pieces feel like paper.

The product has no grain in either theme. A screen can use it only when it means something there, such as a photo that is still processing. Never as background texture, never behind text, and never as a filter on a real photo.

## Voice

Technical warmth: precise systems with a human voice and real numbers. Quiet and grown-up, not slogans.

| Say | Not |
| --- | --- |
| All 8 in. You can replace a frame until 20:00. | Woohoo! Your amazing photos were uploaded successfully! |
| Topic names stay hidden until 10:00. | Hurry! Only 3 hours left to unlock your potential. |
| The jury picked one of yours. | Our AI magically enhanced your shot. |
| No time on this photo. Check it's in the right place. | ERROR: EXIF timestamp missing. |

## In the world

Marketing uses the same type, numbers and accents as the product. Real photos only, one accent per piece.

- **Landing page:** a split ground, Paper with the headline on one side and Fixer with a real photo and its data line on the other. The nav is in the sans. A live ticker under it can be mono, because it's values.
- **Event poster:** Fixer with Paper type, the lockup at the top, the date and place in mono at the foot.
- **Share image:** the photo cut square on Paper or Fixer, the data line under it, and a Blue hour "Jury pick" tag when it applies. No print frame.

## Motion ideas

- **Shutter:** one sharp blink under 100 ms with haptics. The only fast motion in the system.
- **Roll counter:** a mechanical one-notch advance per frame, in tabular figures.
- **Upload:** a thin Blue hour line fills under the roll row while the photo uploads, then the row settles into done.
- **Topic opens:** the hidden name resolves in place at the moment the topic unlocks.
- **Recap:** a yearly contact sheet that assembles itself frame by frame.

## Pitfalls to avoid

- **The instant print:** white print frames, weighted chins, inset photos, rainbow stripes.
- **Mono creep:** mono nav, mono labels, mono buttons. If it's a word, it's in the sans.
- **Skeuomorphic kitsch:** drawn camera backs, leather, tape, sprocket holes, tilted prints.
- **Filter soup:** presets, fake light leaks and grain on real photos.
- **AI slop:** generated hero images, purple gradients, sparkle icons, "magic" copy.
- **Old-website patterns:** carousels, stock photos of smiling people, three icon cards under a centered hero.
- **Fake scarcity:** limits that exist to sell upgrades, or countdown pressure.
- **Ndot clones:** dot-matrix type reads as Nothing.
- **Accent creep:** a third accent, Safelight as decoration, accent-colored small text, or status colors in marketing.
- **Shadows and soft cards everywhere:** the org app gets flat 12px cards, the participant app gets none.

## Sources

- Behind the Design: Halide Mark II (Apple Developer)
- Introducing Halide and Introducing Kino (Lux Optics)
- Inside design at Teenage Engineering (Inside Design)
- Nothing brand reference, Ndot rules (nothing.wiki)
- The Leica M Series (German Design Council)
- Leica's screenless M-D (TechCrunch)
- Make your own film simulation recipe (Fujifilm X)
- Dispo and the disposable revival (New York Times)
- Lapse review (TapSmart)
- "A Teaspoon of Authenticity": BeReal study (CHI 2024)
- Polaroid's famous color stripes, 1968 (Paul Giambarba)
- Schibsted Grotesk, Martian Mono, Righteous (Google Fonts)
