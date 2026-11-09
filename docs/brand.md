# Blikka brand: design principles for a human camera brand

How the craft of photography and the instant-print object translate into Blikka's brand and app UI. Covers case studies, 12 working principles, the palette, type, layout, voice and pitfalls.

Design file: [Paper](https://app.paper.design/file/01M65Y9CDET2K4TE3HVK0A171J). The page "Blikka — Edition 02" is the current presentation of the system: cover, logo, color, type, shape, shot data and grain. "Blikka brand — Edition 01" has the earlier boards, including the product mockups. Logo source files: `apps/web/public/blikka-logo*.svg`.

## Decisions since the first draft

The first draft of this doc proposed a wider palette and licensed type. These are the changes we settled on:

- **Free fonts only.** Every face comes from Google Fonts: Inter Tight, Geist Mono and Righteous.
- **Righteous is the wordmark.** It's used for the name "blikka" and nothing else.
- **No serif or italic voice.** Instrument Serif italic is gone. Captions are set in Inter Tight.
- **No spectrum.** The five color bands read as Polaroid trade dress, so they're gone, including from marketing.
- **No amber.** Chemistry amber is gone too.
- **Two accents:** Safelight red for signals and Blue hour for state.
- **The wordmark is centered on the mark.** We tried standing it on the mark's bottom edge and rejected it. See [Lockup](#lockup).
- **Light mode first.** Paper and Frame white are the default grounds. Darkroom is for capture and night.
- **Soft object, hard frame.** Things you could hold (prints, cards, panels) get the round corners of the modern instant camera. The photo inside is always cut square. This replaces Edition 01's rule of a 2px edge on everything. One pill per screen still holds. See [Shape](#shape).
- **Shot data is the signature detail.** Small Geist Mono pieces (the data line, frame counter, aperture scale, place and time, tags) carry the brand more than any illustration. See [Shot data](#shot-data).
- **Grain is a faint texture, plus data inside frames.** A light grain may sit on grounds and large panels so a page feels printed. Inside frames the ISO still decides how much. It's never a filter. Mockups without a real photo show the shot data on an Ink tile instead of a gray gradient. See [Grain](#grain).

The web app still uses Geist and Special Gothic. It hasn't moved to this system yet.

## The thesis

**Position the product as a camera, not an app.** As generated images get cheap, a photo is valuable because someone was there. The brand should prove presence (who, where, when, unretouched) and treat capture, waiting and giving as rituals. Modern means precise systems with human warmth, not retro costume.

> "We didn't say we made an app. We say we made a camera."
> Sebastiaan de With, Lux Optics (Halide), Apple Developer: Behind the Design

Teenage Engineering, Nothing and Lux Optics get this balance right. They pair strict, engineered systems with play and a physical feel. That balance is the model here.

Blikka runs photo marathons: one city, one day, a roll of topics shot in order and handed in. The rituals are built into the product, so the brand only has to make them visible.

## Photography principles → UI and brand

### Framing

Composition is choosing what to leave out. The frame edge is the first design decision a photographer makes.

| Area | Rule |
| --- | --- |
| Layout | Treat the photo as the layout. One image per view, generous fixed margins, metadata pushed into a dedicated band (the chin) instead of overlays. |
| Type | Small, quiet labels set outside the image. Never type over a person's face. |
| Color | Neutral surround (paper or darkroom black) so the photo carries all the color. |
| Motion | Crop and reframe as physical moves: the frame slides, the image stays put. |
| Interaction | Viewfinder first. Controls live at the edges and within thumb reach, as Kino does around its record button. |
| Copy | Name things by what they frame: roll, frame, topic, print, contact sheet. |
| Sound and haptics | A soft detent tick when a crop snaps to a classic ratio (1:1, 4:5, 3:2). |

## The instant print, studied

| Format | Total (mm) | Image (mm) | Develops |
| --- | --- | --- | --- |
| i-Type / 600 / SX-70 | 88.47 × 107.52 | 78.94 × 76.80 | 10–15 min (i-Type color) |
| Polaroid Go | 53.9 × 66.6 | 47 × 46 | 10–15 min |

Polaroid's published figures are the source for the totals and image areas. Border widths and ratios are worked out from them: sides about 4.8 mm, top plus chin about 30.7 mm, ratio 1 : 1.215. Frame templates (collage.recipes) round the classic format to a 79 mm window with about 4.5 mm top and side borders and a 23.5 mm chin, so the chin is roughly five times the side border.

### Form language

- The asymmetric frame: thin even borders on three sides and a heavy chin. Instantly recognizable, and it works as a layout system.
- A near-square image inside a portrait object, so every image gets the same calm.
- SX-70 (1972): a folding SLR whose styling was refined by Henry Dreyfuss Associates. The object performs a transformation as it unfolds.
- The 2020 Polaroid Now uses softer, more rounded forms that are easier to hold.

### Color stripe heritage, and why we don't use it

- 1968: Paul Giambarba, Polaroid's first art director, created six color stripes for Polacolor film and Colorpack boxes, plus seven gray gradations for black-and-white film.
- The stripes started as a product code and grew into the brand. Signature elements should do a job.
- 2020 rebrand: the spectrum shrinks to a five-color bar under an FF Real wordmark and opens up in motion as op-art patterns.

That spectrum is Polaroid's trade dress. Even rationed to one band at a time, a row of saturated color bars next to a white-bordered photo reads as Polaroid. Blikka doesn't use it.

### Borrowing without kitsch

- ✅ Borrow the proportion, not the picture: a 1 : 1.215 card with a weighted chin for captions and metadata.
- ✅ Borrow the behavior: instant but not immediate, one frame at a time, the print as a gift.
- ❌ Don't copy the rainbow stripe, spectrum bands or the white frame as a logo. They're Polaroid trade dress and read as fan art.
- ❌ Avoid drawn camera bodies, leather textures, tape, push pins and handwriting fonts.

## Case studies

| Brand | What they do | What to take |
| --- | --- | --- |
| Polaroid | Heritage modernized: FF Real plus a compact spectrum bar | One signature element, used sparingly and expressively in motion, "instead of leaning on nostalgia". |
| Teenage Engineering | "No fuzz": simple geometry, a basic palette, a toy-like surface with pro depth | The OP-1 was called a toy and TE took it as a compliment. Fun on the surface, serious underneath. |
| Nothing | "Technical Warmth": Ndot dot-matrix type and the Glyph light interface | A type system with strict rules (Ndot only for names). Glyph lets you leave the phone face down and stay present. |
| Halide / Kino | "Excitement without intimidation": custom routed type, consistent gestures | Never block the viewfinder. Use a recording ring as the one signal, swipe-to-lock, and collect no data. |
| Leica | "The Essentials": no superfluous controls. The M-D removed the screen | Removing things as a brand statement. The tool slows you down on purpose. |
| Fujifilm | Film simulations built on its own film heritage, plus a community recipe culture | A few named looks with real lineage beat 40 anonymous filters. |
| Dispo | Disposable camera UI, no editing, develops at 9 am, shared rolls | Delay plus group rolls turns photos into a social ritual. Watch out: the UI was skeuomorphic. |
| Lapse | 36-shot rolls and a darkroom that develops photos later | Scarcity and waiting as core mechanics, not add-ons. |
| BeReal | One random prompt, 2 minutes, front and back camera at once | Design for authenticity. Research (CHI 2024) also documents the pressure this creates, so give people control. |
| Spotify Wrapped | Data turned into story through expressive type and motion | A year of shooting can become an annual personal story (place, light, people) without fake AI flourishes. |
| Ableton | Flat, editorial, typographic. Custom Ableton Sans for the product | A custom UI face plus restraint makes the tool feel authored. |

## 12 design principles

1. **The photo is the interface.** Chrome recedes. Nothing covers the image or the viewfinder.
2. **Frame, don't decorate.** Use the weighted-chin frame as structure: the image on top, data in the chin.
3. **One shutter, one place.** Consistent gestures and control positions build muscle memory.
4. **Make scarcity a feature.** One frame per topic. Rolls, frame counters and finished rolls are events.
5. **Let it develop.** Deliberate, honest latency with a calm reveal, and always an opt-out.
6. **Texture from process, not filters.** Grain and color driven by real capture data such as ISO, time and light.
7. **Every screen has an object.** Roll, print, contact sheet, darkroom. Metaphors in behavior, not in drawings.
8. **Technical warmth.** Precise, engineered systems with a human voice and real numbers.
9. **Ration color.** Neutral surround, Safelight for signals, Blue hour for state. Nothing else.
10. **Toy on top, depth underneath.** Fun defaults, with pro controls one deliberate gesture away.
11. **Proof of presence.** Who was there, where and when. No generated imagery in the brand, ever.
12. **Private like a film camera.** No analytics on photos. Trust is part of what makes it feel human.

## Logo

The mark is a camera, built from three forms: a grip, a viewfinder and a body with one lens. It's drawn like a tool, not an illustration, so it holds up at 16 px and on a 6 m banner.

The wordmark is "blikka" in lowercase, set in **Righteous** at tracking −0.01em. Its round geometry matches the mark's corner radii.

### Lockup

All values are relative to the mark's height **H**:

- **Vertical alignment:** the wordmark is centered on the mark. Don't stand it on the mark's bottom edge. That leaves the viewfinder sticking up on its own and makes the lockup look lopsided.
- **Wordmark size:** Righteous at 0.88 H. The tall letters (b, l, k) come to about two thirds of the mark's height.
- **Gap between mark and wordmark:** about 0.3 H, roughly one lens diameter (0.324 H).
- **Clear space:** one lens diameter on every side. Nothing enters it, including the photo.

### Construction

The three shapes, measured in H:

| Shape | Corner radius | Note |
| --- | --- | --- |
| 1 Grip | 0.17 H | Full height, a stadium |
| 2 Viewfinder | 0.12 H | The short bar on top |
| 3 Body | 0.19 H | Holds the lens, 0.32 H across |

### Usage

- **Color:** paper on dark, ink on light. Never in an accent color, and never on top of a face.
- **Minimum size:** 16 px for the mark and 72 px wide for the lockup. Below that, use the wordmark alone.
- **Mark alone:** for the app icon and favicon.
- **Don't** rotate, outline, add a lens flare, or put the mark inside a white instant-print frame.

## Color

Daylight first, darkroom for capture and night. A neutral surround so the photo carries all the color, plus two accents and no more.

On a typical light page, Paper and Frame white cover about 62%, Chin and Rule about 20%, Ink about 15%, and the accents together about 3%.

### Darkroom (capture and night mode)

| Name | Hex | Use |
| --- | --- | --- |
| Fixer black | `#0F0F0E` | Dark ground |
| Tray | `#2A2926` | Dark surfaces, dividers on dark |
| Graphite | `#5E5B54` | Muted text on light |
| Silver | `#A7A49C` | Muted text on dark |

### Daylight print (library, gallery, sharing)

| Name | Hex | Use |
| --- | --- | --- |
| Rule | `#DAD5C8` | Hairlines and dividers on light grounds |
| Chin shadow | `#E7E3D8` | Borders, chin band, tinted panels |
| Paper | `#F3F0E8` | Light ground, text on dark |
| Frame white | `#FAF9F5` | Print material, light ground |
| Ink | `#151515` | Text on light |

### Accents

| Name | Hex | Role |
| --- | --- | --- |
| Safelight | `#D3301F` | The only signal color: live, recording, deadline, a submission that needs you. Use it once per screen. |
| Blue hour | `#5F7E9B` | The cool partner to Safelight, used for state in the capture app: the current frame, a finished roll, a jury pick. |

Check contrast on the accents:

- **Frame white on Safelight:** about 4.7:1, which passes AA for body text.
- **Text on Blue hour:** about 4.0:1 with Frame white and 4.3:1 with Ink. That's below AA for small text, so use Blue hour as a fill, or with text at 24 px and up (19 px bold).

## Type

Three faces, each with one job. All are free on Google Fonts.

| Role | Face | Rules |
| --- | --- | --- |
| Wordmark | Righteous 400 | The name only. Never headlines, never UI. |
| UI and brand | Inter Tight | 600 for display, 400 for body, 500 for captions. Track tight above 40 px (about −0.04em). |
| Shot data and labels | Geist Mono | EXIF set like engravings on a lens barrel: uppercase, open tracking (0.06–0.08em), tabular figures. Keep `ƒ` lowercase. |

- **No serif, no italic, no handwriting.** A photographer's caption is set in Inter Tight 500, with the person's words in the copy rather than in a costume font.
- **Dot or pixel type stays out.** A lot of it reads as Nothing.
- **Reference, not to copy:** FF Real (Polaroid), Halide Router, Ndot (Nothing). They show how far a signature face carries a brand.

## Shot data

Every frame carries its EXIF, and that data is the proof someone was there. We set it small, in Geist Mono, like the engraving on a lens barrel. These pieces are the brand's signature detail:

- **Data line:** aperture, shutter, ISO and focal length, each with a small label above (`APERTURE ƒ/2.8`). On a frame or in a chin, it's one line: `ƒ/2.8 · 1/250 · ISO 400`.
- **Frame counter:** `07/24`, the total set in Silver. Beneath it, one tick per frame: shot frames in Ink, the current frame in Blue hour, frames left in Rule.
- **Scale:** an aperture ring (`1.4 2 2.8 4 5.6 8 11 16`) with the frame's value marked in Blue hour.
- **Place and time:** coordinates and a timestamp (`59.3201° N 18.0716° E`, `2026·11·02 18:42:07`) between two corner crop marks.
- **Tags:** short mono labels in a soft outline (`TOPIC 04`, `ISO 400`). A live tag adds the Safelight dot, and a jury pick is filled with Ink.

Rules:

- **Real numbers only.** Use the frame's own EXIF. If a value is missing, leave it out rather than invent one.
- **Small and quiet.** 11–13 px for labels, uppercase with 0.06–0.1em tracking. The numbers get large only when they're the subject, as on a cover or a counter.
- **Outside the image.** Shot data sits in the chin or around the frame, never over the photo. The exception is a mockup frame without a real photo.

## Shape

Soft object, hard frame. Things you could hold are round, like the camera in your hand. The photo is cut square, the way the shutter made it. The soft corners come from the mark, whose grip, viewfinder and body are all rounded.

| Token | Value | Use |
| --- | --- | --- |
| `--radius-cut` | `0` | Photos, always: inside prints, thumbnails, contact sheets, share cards. |
| `--radius-soft` | `28px` | Objects: cards, panels, tiles. |
| `--radius-soft-lg` | `40px` | Large single objects, like a print shown on its own. |
| `--radius-tag` | `10px` | Tags and chips with shot data. |
| `--radius-edge` | `2px` | Other controls: buttons, inputs, nav items, checkboxes. |
| `--radius-pill` | `9999px` | At most one per screen, on the action that matters most: the shutter, Hand in roll, the main export. |

- **Never round a photo.** That crops the photographer's frame. A soft print holds a hard-edged image.
- **Never tilt.** Prints, cards and photos sit straight on the grid. No rotated or scattered polaroid look.
- **One pill per screen.** If two things want to be round, neither is the main action. Pick one.
- **Dots are circles.** The live dot and status dots are round at any size and don't count against the pill.
- **The device is the exception.** A viewfinder or bottom sheet follows the phone's own corner radius, kept concentric (outer radius minus padding). That's the OS's shape, not the brand's.

Edition 02 shows the scale on the shape board. Edition 01 boards 08 and 09 predate the soft radius and still use 2px edges on panels.

## Layout: the frame

We borrow the instant print's proportion, not its look.

- **1 : 1.215.** Every submission is a card. The gallery, the jury view, the share image and the printed exhibition all use one proportion.
- **Chin = 5 units, sides = 1 unit.** The image is near-square.
- **Metadata lives in the chin:** frame number, topic, time and settings. Nothing overlays the photo: no badges, no gradients, no type over a face.
- **Surround is paper or fixer, nothing else.** The page around a print stays neutral.
- **No tape, pins or sprockets.** The frame is a proportion, not a prop. Skip drawn film edges and fake light leaks.

## Grain

Grain works at two strengths. A faint, fixed grain on grounds and large panels makes a page feel printed. Inside a frame, grain is data: the frame's ISO decides how much, read from the EXIF and never picked from a menu.

| Where | Strength | Use |
| --- | --- | --- |
| Ground | About 4%, dark specks | Covers, posters, hero grounds |
| Panel | About 8%, dark specks | Large tinted panels and section breaks |
| Frame | Set by ISO, light specks | Where a photo would be |

Inside frames:

| ISO | Grain | Peak opacity |
| --- | --- | --- |
| 100 | Fine, barely there | 10% |
| 200 | Fine | 13% |
| 400 | Fine, visible | 17% |
| 800 | Fine, dense | 21% |
| 1600 | Soft clumps | 24% |
| 3200 | Soft clumps, dense | 29% |

- **Frames:** roll tiles, contact sheets, share cards and the viewfinder while a frame develops.
- **No ISO, no grain.** If the EXIF has no ISO, the frame stays clean. Never guess a value.
- **Monochrome.** Ink specks on light grounds, warm paper-white specks on dark frames. Grain never adds a color, so it can't become a third accent.
- **Clumps come from softening, not scaling.** High-ISO grain blurs fine noise into soft clumps. Hard square blocks read as digital pixels.
- **Felt, not seen, on grounds.** If you notice the grain before the type, it's too strong. Keep it off body text, the mark and controls, so it doesn't break the rule against [texture on reading surfaces](#pitfalls-to-avoid).
- **Never as a filter on a real photo.** A real photo already has its own grain. This is for frames that show shot data instead of an image.

In mockups without a real photo, a frame is an Ink tile with its shot data in Geist Mono (`ƒ/2.8 · 1/250 · ISO 400`) and the grain for that ISO. Edition 02 shows the three strengths on the grain board. Edition 01 board 10 shows the ISO scale.

## Voice

Technical warmth: precise, engineered systems with a human voice and real numbers. Fun on top, depth underneath, like the camera in your bag.

| Say | Not |
| --- | --- |
| Roll handed in. 8 of 8 frames, 18:42. | Woohoo! Your amazing photos were uploaded successfully! |
| Topic 4 opens at 14:00. Until then, look around. | Hurry! Only 3 hours left to unlock your potential. |
| The jury picked yours. You can see why below. | Our AI magically enhanced your shot. |

## In the world

Marketing uses the same frame, type and numbers as the product. Real photos only, one accent per piece, and the data always set in the chin.

- **Event poster:** fixer black with paper type, the lockup at the top, and the date and place in Geist Mono at the foot. One short Blue hour rule is the only color.
- **Share card:** a 1 : 1.215 print made after judging. Caption and shot data go in the chin, with a small Blue hour "Jury pick" tag.
- **Participant app:** darkroom mode. Live status in Safelight, a topic name, a `05/08` frame counter, a viewfinder that's never covered, and the roll as a strip of frames above one shutter.

## Motion ideas

- **Development reveal:** the image rises from a dark, desaturated version of itself to full color, timed to a real wait.
- **Shutter:** one sharp blink under 100 ms with haptics. The only fast motion in the system.
- **Print eject:** on capture, the card slides out of the bottom edge of the viewfinder, chin first.
- **Roll counter:** a mechanical one-notch advance per frame in tabular figures.
- **Handoff:** give a print with a flick that has inertia. The recipient sees it land face down, then flips it.
- **Recap:** a yearly contact sheet that assembles itself frame by frame (who, where, light), in the Wrapped spirit.

## Pitfalls to avoid

- **Skeuomorphic kitsch:** drawn camera backs, leather, tape, wood grain, sprocket holes as decoration, tilted prints.
- **Filter soup:** 40 presets, fake light leaks and VHS overlays that ignore the real capture.
- **AI slop:** generated hero images, purple gradients, glassy blobs, sparkle icons, "magic" copy.
- **Old-website patterns:** carousels, stock photos of smiling people, centered hero headlines with three icon cards.
- **Copying Polaroid:** rainbow stripes, spectrum bands and white frames used as the logo.
- **Fake scarcity:** limits that exist to sell upgrades, or countdown pressure (BeReal's criticized side).
- **Ndot clones:** dot-matrix everywhere instantly reads as a Nothing derivative.
- **Texture on reading surfaces:** grain behind body text hurts legibility and accessibility.
- **Accent creep:** a third accent color, or Safelight used as decoration instead of a signal.

## Sources

- Color i-Type Film specs (polaroid.com)
- What are Polaroid photo dimensions? (Polaroid Support)
- Polaroid Go film specs (polaroid.com)
- Polaroid & instax photo sizes, measured (collage.recipes)
- Polaroid's famous color stripes, 1968 (Paul Giambarba)
- Polaroid rebrand and the Now camera (It's Nice That)
- The story behind Polaroid's rebrand (Design Week)
- Who designed the SX-70? (OpenSX70)
- Behind the Design: Halide Mark II (Apple Developer)
- Introducing Halide (Lux Optics)
- Introducing Kino (Lux Optics)
- Kino product page (shotwithkino.com)
- Inside design at Teenage Engineering (Inside Design)
- Q&A: Teenage Engineering (XLR8R)
- Designing the EP-133 K.O. II (Perfect Circuit)
- Nothing brand reference, Ndot rules (nothing.wiki)
- Nothing: smartphones are not all the same (DesignWanted)
- The Leica M Series (German Design Council)
- Leica's screenless M-D (TechCrunch)
- Make your own film simulation recipe (Fujifilm X)
- Dispo and the disposable revival (New York Times)
- Retro photo app is winning buzz (Axios)
- Lapse review (TapSmart)
- Time to BeReal notification (BeReal Help)
- "A Teaspoon of Authenticity": BeReal study (CHI 2024)
- The Decisive Moment, new edition (Fondation HCB)
- Inside the design of Spotify Wrapped 2024 (It's Nice That)
- Ableton identity (A Color Bright)
- Ableton Sans (Letters from Sweden)
- Inter Tight, Geist Mono, Righteous (Google Fonts)
