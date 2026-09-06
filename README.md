My personal exercises

## Course site (`docs/`)

`docs/` holds a static course site published with GitHub Pages (branch `main`,
folder `/docs`). The lesson prose is in Portuguese; everything else — file names,
folders, code comments and this README — is in English.

```
docs/
├── .nojekyll                 # serve the files as-is, no Jekyll processing
├── index.html                # course index, links every published lesson and review
├── assets/
│   ├── course.css            # shared stylesheet for every page
│   └── course.js             # shared behaviour: activity list, progress, trace stepper
├── lessons/                  # one page per lesson
│   ├── 01-protocolo-de-iteracao.html
│   └── 04-itertools-e-batching.html
└── reviews/                  # one page per graded delivery
    └── 04-revisao.html
```

Lessons and reviews are both one directory deep, so every page reaches the
shared assets the same way: `../assets/course.css`.

`course.css` and `course.js` are shared by every page, so a change to either one
lands on all lessons at once. Lesson progress is kept in `localStorage` under a
key derived from `<body data-lesson="NN">`, which gives each page its own
independent progress. Reviews use the same mechanism with a suffixed id
(`data-lesson="04-revisao"`), so a review's checklist never collides with its
lesson's.

The trace stepper in `course.js` is opt-in: it runs only on pages that contain a
`#trace` element. Such a page may define its own walkthrough in a
`<script type="application/json">` inside that element, holding `lines` (the
source lines) and `steps` (`l` = index into `lines`, plus the state to show).
Without that config the stepper falls back to the lesson 01 walkthrough.

### Running it locally

```
cd docs
python -m http.server
```

Then open <http://localhost:8000>. A plain file:// open also mostly works, but
the server matches how GitHub Pages resolves the relative paths.

### Adding a lesson

1. Create `docs/lessons/NN-slug.html`. Copy the skeleton from lesson 01: same
   `<head>` (charset, viewport, Google Fonts, `../assets/course.css`), a
   `<body data-lesson="NN">`, and at the end of `<body>` the three Prism scripts
   followed by `../assets/course.js` — in that order and without `defer`, since
   the shared script calls `Prism.highlightAll()` on its last line.
2. Write the lesson body as a sequence of `<article class="act">` elements. The
   shared script builds the sidebar from their `data-kind`, `data-title` and
   `data-min` attributes, so no per-lesson JavaScript is needed.
3. Add one `<li>` to the lesson list in `docs/index.html`, replacing the
   `soon`/`res-static` placeholder with a link to the new file.
4. Keep the `<span id="ringTxt">0/N</span>` in the rail equal to the number of
   `<article class="act">` elements on the page.

### Adding a review

Delivered exercises get graded, and the grade is published as its own page
rather than sent as a message. The flow is:

1. Read the committed `exercises/python/lessonNN.py` and **run it** — every
   claim in a review should come from an execution, not from reading.
2. Write `docs/reviews/NN-revisao.html` using the same skeleton as a lesson,
   with `<body data-lesson="NN-revisao">`. Open with a verdict and a per-exercise
   table, then one `<article class="act">` per finding.
3. Where an answer was wrong, do not stop at the fix: add an article that
   re-teaches the underlying concept slowly, with the real output alongside.
   That is the point of the page.
4. Link it from `docs/index.html` and from the lesson's "Recursos" tab.
