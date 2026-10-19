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
index.html          Home: hero, mission, format, essentials, roadmap, interest list
about.html          What URTC is, who it's for, relationship to MIT URTC
submit.html         Call for Research: formats, eligibility, dates, how to submit
team.html           Join the Team: six open chair roles
sponsors.html       Sponsor pitch + contact (tiers placeholder)
contact.html        Contact routes + FAQ
favicon.svg         Site icon (same as the logo mark)
assets/css/styles.css   All styles, with design tokens at the top
assets/js/config.js     ← SITE SETTINGS: links, emails, form endpoint
assets/js/main.js       Menu, forms, generative art, animations
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

### Confirm a tentative detail

Search the HTML for `class="tbc"`. Every unconfirmed item (the date, venue, Friday events and keynote) is marked with one of these chips. Once something is officially confirmed, update the text and delete the chip. **Don't remove a chip until the detail is confirmed.**

Content rules while things are pending:
- List a host department only once it has approved. See the `TODO` in `about.html`.
- Don't mention IEEE Xplore publication until it's confirmed.
- Don't use Stanford or IEEE logos unless you have written permission.
- Describe MIT URTC as an inspiration only. Stanford URTC is not an official MIT event.

### Add a new page (Schedule, Registration, Speakers, Archive…)

1. Copy `templates/page-template.html` to the root folder, for example as `schedule.html`.
2. Edit the title, description, hero and sections. The comments in the template walk you through it.
3. Add the page to the `<nav>` list **and** the footer in every HTML file. Search for `nav-list` and `footer-col`.
4. Put `aria-current="page"` on the new page's own nav link.
5. Update the roadmap on the homepage (`§ 04`). Change `status` to `status status--open` when something launches.

### Reusable building blocks (all in `styles.css`)

- `.section` + `.section-head`: numbered section with a large serif heading
- `.split`: two-column layout that stacks on mobile
- `.card-grid` + `.card`: role, contact and sponsor cards
- `.fig-grid` + `.fig-cell`: hairline-ruled "figure" grid. The first cell is the featured one.
- `.spec`: key/value list for dates and details
- `.data-table` inside `.table-wrap`: accessible table that scrolls on mobile
- `.steps`: three-step process
- `.roadmap`: milestones with status
- `.faq`: question-and-answer accordion built with `<details>`
- `.tbc`: "Tentative / TBA" chip
- `.on-dark`: dark band, used for the interest list
- `.reveal`: fades in on scroll

### Change colors or fonts

Every color and font is a variable at the top of `styles.css` (`:root`). Cardinal (`--cardinal`) is the accent. Keep it rare: CTAs, emphasis words and single highlights.

## Design notes

The look follows the Stanford IEEE Student Branch site (web.stanford.edu/group/ieee), using original artwork only.

- **Palette:** near-black background (`--bg`), cool off-white text (`--fg`), cardinal `#8c1515` for buttons and a lighter red `--accent` (`#e06a5f`) for text, strokes and glows on dark.
- **Type:** Geist for UI, body and big titles. Instrument Serif for section headings, with red italic accent words. Geist Mono, uppercase and wide-tracked, for labels. All three come from Google Fonts.
- **Surfaces:** glass cards (`--glass`, 1px faint border, 14px radius) and pill buttons.
- **Motifs:** an original silicon-die illustration in the hero, with the Frontiers topographic contours etched inside it and glowing red nodes. Also a ridgeline landscape with one glowing red ridge, and a scale bar.
- **Navigation extras (homepage):** a right-edge section index (`.rail`, wide screens only) and a floating "Interest list" pill (`.float-pill`). Both are driven by `main.js`.
- **Generative art:** contours and ridges are drawn by `main.js` from a seed (`data-contours="23"`, `data-ridges="11"`). Change the number to get a different map.
- **Motion:** pulsing nodes, a drifting ridgeline, the ticker, scroll reveals and slight pointer parallax. All of it turns off for visitors with "reduce motion" on.

## Accessibility checklist

- Skip link, landmarks (`header`, `nav`, `main`, `footer`), one `h1` per page
- All decorative SVGs are `aria-hidden`; informative figures have `role="img"` and a title
- Visible focus rings; tap targets of at least 44px; text contrast meets WCAG AA
- The mobile menu sets `aria-expanded` and closes with Escape
- Form fields have labels, and status messages are announced through `role="status"`
- The site still works without JavaScript: the nav shows inline and all content is visible

## Later phases: notes

- **Registration / CFP:** link out to CMT and a registration form at first, using `config.js` plus a new page from the template.
- **Live audience voting with duplicate blocking:** this needs a backend, so a static site can't do it alone. Options: a short-lived Google Form limited to one response per signed-in user, or a small app (for example Firebase or Supabase) that issues one-time codes printed on attendee badges. Link to it from a `vote.html` page.
- **Past winners / archive:** one page per year (`2027.html`), or an `archive.html` built with `.card-grid`.
- If the site grows past about 10 pages, consider moving to a static-site generator such as Eleventy or Astro so the header and footer live in a single file. The CSS and JS carry over unchanged.
