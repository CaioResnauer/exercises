My personal exercises

## Course site (`docs/`)

`docs/` holds a static course site published with GitHub Pages (branch `main`,
folder `/docs`). The lesson prose is in Portuguese; everything else — file names,
folders, code comments and this README — is in English.

```
docs/
├── .nojekyll                 # serve the files as-is, no Jekyll processing
├── index.html                # course index, links every published lesson
├── assets/
│   ├── course.css            # shared stylesheet for the index and all lessons
│   └── course.js             # shared behaviour: activity list, progress, trace stepper
└── lessons/
    └── 01-protocolo-de-iteracao.html
```

`course.css` and `course.js` are shared by every page, so a change to either one
lands on all lessons at once. Lesson progress is kept in `localStorage` under a
key derived from `<body data-lesson="NN">`, which gives each lesson its own
independent progress.

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
