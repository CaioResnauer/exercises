My personal exercises

## Fluxo — the course site (`docs/`)

`docs/` holds **Fluxo**, a static course site published with GitHub Pages
(branch `main`, folder `/docs`). The lesson prose is in Portuguese; everything
else — file names, folders, code comments and this README — is in English.

```
docs/
├── .nojekyll                 # serve the files as-is, no Jekyll processing
├── check.py                  # renders every page in a browser and fails on layout bugs
├── index.html                # the track: course progress and one card per lesson
├── assets/
│   ├── course-data.js        # the manifest: every lesson, its state, the storage contract
│   ├── course.css            # shared stylesheet for every page
│   └── course.js             # shared behaviour: track tree, progress, stepper, keyboard
├── lessons/                  # one page per lesson
│   ├── 01-protocolo-de-iteracao.html
│   ├── 04-itertools-e-batching.html
│   ├── 05-memoria-na-pratica.html
│   └── 06-git-e-o-repositorio.html
└── reviews/                  # one page per graded delivery
    └── 04-revisao.html
```

Lessons and reviews are both one directory deep, so every page reaches the
shared assets the same way: `../assets/course.css`.

### The manifest

`assets/course-data.js` is the single source of truth for the track: each
lesson's title, activity count, whether it is published, and its delivery state
(`pending` / `delivered` / `reviewed`). The sidebar tree, the index cards and
the delivery badges are all generated from it, so those facts are written once.

A lesson page repeats two of them on `<body>` — `data-lesson` and
`data-delivery` — because the page needs them before any script runs.
`check.py` fails if the two ever disagree.

Each page also declares its depth in `data-base` (`.` at the root, `..` inside
`lessons/` and `reviews/`), which is how links built from the manifest resolve
from any directory.

### Progress

One number per scope. A lesson page shows only its own progress, in the sidebar
ring; the index shows the course total, summed across every published lesson.

Progress lives in `localStorage` under one key per lesson,
`curso-de:<NN>:v1`, derived from `<body data-lesson>`. Reviews use a suffixed id
(`data-lesson="04-revisao"`), so a review's checklist never collides with its
lesson's. Every read goes through `COURSE.progressOf()`, which returns zero for
a missing key, unparseable JSON, or a `localStorage` accessor that throws —
an anonymous window renders the same page as a normal one.

### The trace stepper

Opt-in: it runs only on pages that contain a `#trace` element. Such a page may
define its own walkthrough in a `<script type="application/json">` inside that
element, holding `lines` (the source lines) and `steps` (`l` = index into
`lines`, plus the state to show). Without that config the stepper falls back to
the lesson 01 walkthrough.

### Running it locally

```
cd docs
python -m http.server
```

Then open <http://localhost:8000>. A plain `file://` open also mostly works, but
the server matches how GitHub Pages resolves the relative paths.

### Checking the pages

```
cd docs
python check.py                 # every page
python check.py lessons/05-memoria-na-pratica.html
```

`check.py` serves `docs/`, opens each page in headless Chromium at 1440px and
390px, and exits non-zero on: text narrower than 120px inside the reading
column, horizontal overflow, a console error, a dead internal link, a missing
`<title>` or `data-lesson`, or a page that disagrees with the manifest.

It reveals one `<article class="act">` at a time before measuring. Activities
ship `hidden`, and a hidden element measures zero wide, so measuring the page as
it loads flags every hidden paragraph and misses the visible bug.

First run needs the browser:

```
pip install playwright && python -m playwright install --with-deps chromium
```

### Adding a lesson

1. Create `docs/lessons/NN-slug.html`. Copy the skeleton from lesson 05: same
   `<head>` (charset, viewport, Google Fonts, `../assets/course.css`), a
   `<body data-lesson="NN" data-base=".." data-delivery="pending">`, and at the
   end of `<body>` the three Prism scripts, then `../assets/course-data.js`,
   then `../assets/course.js` — in that order and without `defer`, since the
   shared script calls `Prism.highlightAll()` on its last line.
2. Write the lesson body as a sequence of `<article class="act">` elements. The
   shared script builds the sidebar from their `data-kind`, `data-title` and
   `data-min` attributes, so no per-lesson JavaScript is needed. Leave
   `<ul class="tree" id="tree"></ul>` empty in the rail — it is generated.
3. Add the lesson to `assets/course-data.js`: set `published: true`, the `slug`,
   and `acts` equal to the number of `<article class="act">` elements. Nothing
   in `index.html` needs editing — the cards come from the manifest.
4. Keep `<span id="ringTxt">0/N</span>` in the rail equal to that same count.
5. Run `python check.py`.

### Adding a review

Delivered exercises get graded, and the grade is published as its own page
rather than sent as a message. The flow is:

1. Read the committed `exercises/python/lessonNN.py` and **run it** — every
   claim in a review should come from an execution, not from reading.
2. Write `docs/reviews/NN-revisao.html` using the same skeleton as a lesson,
   with `<body data-lesson="NN-revisao" data-base=".." data-delivery="reviewed">`.
   Open with a verdict and a per-exercise table, then one
   `<article class="act">` per finding.
3. Where an answer was wrong, do not stop at the fix: add an article that
   re-teaches the underlying concept slowly, with the real output alongside.
   That is the point of the page.
4. In `assets/course-data.js`, set the lesson's `delivery` to `"reviewed"` and
   its `review` to the new path. The badge on the lesson, in the tree and on the
   index card becomes the link to it.
