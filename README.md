# Stanford URTC website

Website for the Stanford Undergraduate Research Technology Conference (URTC) 2027, with the theme **Frontiers**.

The site is plain HTML, CSS and JavaScript. There's no build step, framework or package install. Any static host works: GitHub Pages, Netlify, Vercel, or Stanford web hosting.

## Preview locally

```bash
python3 -m http.server 4321
```

Then open http://localhost:4321.

## Files

```
index.html          Home: hero, mission, format, tracks race, impact, essentials, roadmap, interest list
about.html          What URTC is, who it's for, relationship to MIT URTC
submit.html         Call for Research: formats, eligibility, dates, how to submit
team.html           Join the Team: four open chair roles
sponsors.html       Sponsor pitch + contact (tiers placeholder)
contact.html        Contact routes + FAQ
favicon.svg         Site icon (same as the logo mark)
assets/css/styles.css   All styles, with design tokens at the top
assets/js/config.js     ← SITE SETTINGS: links, emails, form endpoint
assets/js/main.js       Menu, forms, scroll reveals, decoding labels, card spotlights
assets/js/ascii.js      The live ASCII art: hero landscape and wordmark, page maps, tracks race
assets/img/logo-mark.svg  Original logo mark
templates/page-template.html  Starting point for new pages
```

## Common tasks

### Add links and emails (`assets/js/config.js`)

| Setting | What it does when filled in |
|---|---|
| `interestFormEndpoint` | Makes the email signup actually submit. Use Formspree, Basin, or anything else that accepts a form POST and returns JSON. Google Forms won't work here. |
| `teamApplicationUrl` | Points every "Apply" button on the team page to your form. Until it's set, the buttons go to the Contact page. |
| `contactEmail`, `sponsorEmail` | Displays the addresses and turns them into `mailto:` links. |
| `cmtPortalUrl` | Turns on the "Submission portal" button on the Call for Research page. |

An empty value never produces a broken link. The site shows a "coming soon" state instead.

### Fill in the six tracks

The tracks are placeholders (Track A to F) until they're announced. Each track's text lives in three places:

1. `index.html`, the tracks race: the `.track` item (`id="track-a"` and so on) holds the name and description shown, large, in the open space of the race screen while that track leads.
2. `index.html`, the craft buttons: each `.car`'s `aria-label` (what screen readers announce).
3. `submit.html`: the track list under Formats.

Delete the `Name TBA` chip once a name is final. The letter badges (A to F) stay as they are.

### Confirm a tentative detail

Search the HTML for `class="tbc"`. Every unconfirmed item (the date, venue, Friday events and keynote) is marked with one of these chips. Once something is officially confirmed, update the text and delete the chip. **Don't remove a chip until the detail is confirmed.**

Content rules while things are pending:
- List a host department only once it has approved. See the `TODO` in `about.html`.
- IEEE Xplore: every accepted paper presented at the conference is published in IEEE Xplore (confirmed by the conference chair).
- Don't use Stanford or IEEE logos unless you have written permission.
- Describe MIT URTC as an inspiration only. Stanford URTC is not an official MIT event.

### Add a new page (Schedule, Registration, Speakers, Archive…)

1. Copy `templates/page-template.html` to the root folder, for example as `schedule.html`.
2. Edit the title, description, hero and sections. The comments in the template walk you through it.
3. Add the page to the `<nav>` list **and** the footer in every HTML file. Search for `nav-list` and `footer-col`.
4. Put `aria-current="page"` on the new page's own nav link.
5. Update the roadmap on the homepage (section `05`, Roadmap). Change `status` to `status status--open` when something launches.

### Reusable building blocks (all in `styles.css`)

- `.section` + `.section-head`: numbered section (`<b>01</b> Label`) with a large light heading; `<em>` words set in the script
- `.split`: two-column layout that stacks on mobile
- `.card-grid` + `.card`: role, contact and sponsor cards
- `.fig-grid` + `.fig-cell`: hairline-ruled "figure" grid. The first cell is the featured one.
- `.spec`: key/value list for dates and details
- `.data-table` inside `.table-wrap`: accessible table that scrolls on mobile
- `.steps`: three-step process
- `.roadmap`: milestones with status
- `.faq`: question-and-answer accordion built with `<details>`
- `.tbc`: "Tentative / TBA" chip
- `.on-dark`: darker band with an ASCII map behind it, used for the interest list
- `.reveal`: fades in on scroll
- `<canvas class="ascii" data-ascii="contour" data-seed="5">` inside a `data-ascii-host` section: a live ASCII map (see below)

### Change colors or fonts

Every color and font is a variable at the top of `styles.css` (`:root`). Cardinal (`--cardinal`) fills buttons; the brighter `--accent` is for text, strokes and glows on black. Keep it rare: CTAs, the script accent words and single highlights.

The script face is set in `--font-script`. If you swap it, adjust `--script-scale` so its x-height matches Helvetica's.

### ASCII art (`assets/js/ascii.js`)

Any `<canvas data-ascii="…">` is drawn as a live field of characters. Put it inside an element with `data-ascii-host`; the canvas fills that host.

| Attribute | What it does |
|---|---|
| `data-ascii="terrain"` | Ridgelines rolling toward the viewer (homepage hero) |
| `data-ascii="contour"` | A top-down topographic map (page heroes, dark bands) |
| `data-ascii="race"` | The tracks race (homepage). See the comment above the tracks section in `index.html`. |
| `data-seed="23"` | Any number gives a different landscape |
| `data-word-from="#hero-word"` | Draws that element's text in characters, exactly where it sits. Runs marked `data-ascii-run="accent"` are drawn in cardinal. Once drawn, the real text turns transparent (it stays for screen readers, and shows without JS). |
| `data-intensity="0.75"` | Overall brightness, 0–1 |

In the hero, `.hero-horizon` (`data-ascii-horizon`) marks where the ridgelines' horizon sits, between the wordmark and the details. Page heroes and dark bands fade their map out behind the copy with a CSS mask, not boxes.

## Design notes

Experimental, dark and technical: the site reads like an instrument drawing a landscape in characters. All artwork is original and generated in the browser.

- **Palette:** a just-off-black background (`--bg` `#0c0b0b`), warm off-white text (`--fg`), Stanford cardinal `#8c1515` for buttons and a brighter cardinal `--accent` (`#f0464b`) for text, strokes and glows on black.
- **Type:** light Helvetica (Helvetica Neue on Apple devices, Inter Tight elsewhere) for UI, body and big titles. Cormorant Garamond italic as the elegant script for accent words (`<em>` inside headings). IBM Plex Mono, uppercase and wide-tracked, for labels and the ASCII art. Inter Tight, Cormorant Garamond and IBM Plex Mono come from Google Fonts.
- **Frame:** two dashed guides run down the page like the margins of a technical drawing, with crosshairs where sections meet them. Cards and figure cells snap viewfinder corners into place on hover. Labels use `///` separators.
- **ASCII art:** the hero's "URTC 2027" wordmark is drawn in characters above a ridgeline landscape, with one cardinal "frontier" ridge in eleven and a sheen that sweeps across the wordmark every few seconds. Topographic maps sit behind page heroes and dark bands.
- **Atmosphere:** film grain over the whole site, cardinal haze behind the art, and solid cardinal accents: script words, figures and the primary buttons. Glass buttons and panels lift off the art instead of sitting in black boxes. Cards and cells pick up a soft spotlight under the pointer.
- **Pointer:** the cursor leaves a flowing wake rather than a circle: a ragged, comet-like trail that fades behind it. The wake drags ridgelines and contours along with its motion, lifts them toward its path, turns what it passes cardinal and reveals binary underneath. Its reach and strength are kept small and gentle; tune them with `WAKE`, `WAKE_MS` and `WAKE_PX` at the top of `ascii.js`.
- **Cursor:** on a mouse, the system pointer is replaced by a small dot that opens into a ring over anything clickable (links, buttons, the craft). Text fields keep the normal text cursor; touch screens and pens keep the system pointer. It lives in `main.js` and the `.cursor` rules in `styles.css`.
- **Tracks race (homepage):** the scroll-driven moment, inspired by kprverse.com. The section is a tall stage with a sticky view: the race fills the screen, and six small craft (the tracks) race down it, seen from above. Each heads mostly straight down with a slight sway and leaves an ASCII trail at least five characters wide, with dust drifting past. Ahead of them is the frontier: a shock front bowed back on either side like a sonic boom, glowing at its apex, with pressure waves rippling back toward the field. The stage is split into six sectors and then the finish, 60% of a screen of scrolling each. The field stays staggered, so the lead changes hands naturally: the next craft climbs through and the last leader eases back, and the field slowly closes on the frontier. The leader's trail burns cardinal, and its track's notes fill the open space below the frontier in large type, word by word. At the finish the field punches through the frontier, which flares, and runs right off the bottom of the screen, trails and all, while the notes clear; scrolling back up brings it back in from the top. Clicking a craft moves the page to that track's sector at once and lets it take the lead in place, without racing through the sectors in between. Links to `index.html#track-c` land on that sector too. Tune the feel with `FINISH`, `LEADER_AT`, `LEAD`, `SPREAD`, `SETTLE_MS` and `HANDOFF_MS` in `ascii.js`.
- **Navigation extras (homepage):** a right-edge section index (`.rail`, wide screens only) and a floating "Interest list" button (`.float-pill`), hidden over the hero and the interest list. Both are driven by `main.js`.
- **Motion:** the drifting landscape, characters decoding into place on load, mono labels and figures that decode as they scroll in, every section heading lighting up word by word as it scrolls through the screen (all at one shared display size), the ticker (which flows out of the hero with no rule around it and keeps moving under the pointer) and scroll reveals. With "reduce motion" on, each field draws one still frame, nothing animates, and the tracks race becomes a plain grid of six cards.
- **Performance:** one animation loop for every field, paused offscreen and in background tabs. If frames run slow on a device, the field switches to bigger characters.

## Accessibility checklist

- Skip link, landmarks (`header`, `nav`, `main`, `footer`), one `h1` per page
- All decorative SVGs are `aria-hidden`; informative figures have `role="img"` and a title
- Visible focus rings; tap targets of at least 44px; text contrast meets WCAG AA
- The mobile menu sets `aria-expanded` and closes with Escape
- Form fields have labels, and status messages are announced through `role="status"`
- The site still works without JavaScript: the nav shows inline, all content is visible, and the ASCII canvases are replaced by a quiet dot grid
- Every ASCII canvas is `aria-hidden`; the hero wordmark is real text in the `h1`, made transparent once it's drawn
- In the tracks race, all six descriptions stay in the page for screen readers, and the craft are real buttons, so keyboard users can tab to a track and bring it to the front

## Later phases: notes

- **Registration / CFP:** link out to CMT and a registration form at first, using `config.js` plus a new page from the template.
- **Live audience voting with duplicate blocking:** this needs a backend, so a static site can't do it alone. Options: a short-lived Google Form limited to one response per signed-in user, or a small app (for example Firebase or Supabase) that issues one-time codes printed on attendee badges. Link to it from a `vote.html` page.
- **Past winners / archive:** one page per year (`2027.html`), or an `archive.html` built with `.card-grid`.
- If the site grows past about 10 pages, consider moving to a static-site generator such as Eleventy or Astro so the header and footer live in a single file. The CSS and JS carry over unchanged.
