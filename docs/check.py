#!/usr/bin/env python3
"""Render every page of the course site in a real browser and fail on layout,
console or link problems.

Static HTML checks cannot see any of this: a paragraph squeezed into a 44px
grid column is valid HTML. So the pages are served over HTTP, opened in
headless Chromium, and measured.

Usage:
    python check.py                # checks every .html under this directory
    python check.py lessons/04-itertools-e-batching.html
    python check.py --port 8123    # if the default port is taken

Requires:
    pip install playwright && python -m playwright install --with-deps chromium
"""

from __future__ import annotations

import argparse
import contextlib
import functools
import http.server
import os
import socket
import socketserver
import sys
import threading
from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright, Error as PlaywrightError
except ImportError:  # pragma: no cover - dependency hint only
    sys.exit("playwright is missing: pip install playwright "
             "&& python -m playwright install --with-deps chromium")

DOCS = Path(__file__).resolve().parent

# A text run narrower than this inside the reading column is almost certainly a
# layout bug rather than a deliberate choice. The .trap regression rendered at
# 44px; normal prose in this design is ~640px.
MIN_TEXT_WIDTH = 120
VIEWPORTS = [("desktop", 1440, 900), ("mobile", 390, 844)]


class NestingCheck(HTMLParser):
    """Report mismatched tags.

    A browser silently repairs bad nesting, so a page can render fine and
    still be wrong — `</code></pre>` used to close a <div class="out"> makes
    the rest of the document a child of that div. Chromium never complains,
    which is exactly why this runs on the source instead.
    """

    VOID = {"meta", "link", "br", "hr", "img", "input",
            "circle", "path", "rect", "source"}

    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.stack: list[tuple[str, tuple[int, int]]] = []
        self.problems: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag not in self.VOID:
            self.stack.append((tag, self.getpos()))

    def handle_endtag(self, tag):
        if tag in self.VOID:
            return
        if not self.stack:
            self.problems.append(f"</{tag}> sem abertura na linha {self.getpos()[0]}")
            return
        open_tag, (line, _) = self.stack[-1]
        if open_tag != tag:
            self.problems.append(
                f"</{tag}> na linha {self.getpos()[0]} fecha <{open_tag}> "
                f"aberto na linha {line}")
        self.stack.pop()

    def unclosed(self):
        return [f"<{t}> da linha {p[0]} nunca fechada" for t, p in self.stack]


@dataclass
class Report:
    page: str
    failures: list[str] = field(default_factory=list)

    def fail(self, message: str) -> None:
        self.failures.append(message)


def serve(directory: Path, port: int) -> tuple[socketserver.TCPServer, str]:
    """Start a quiet static server on `port` and return it with its base URL."""

    class Handler(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *_args):  # silence the request log
            pass

    socketserver.TCPServer.allow_reuse_address = True
    handler = functools.partial(Handler, directory=str(directory))
    try:
        httpd = socketserver.TCPServer(("127.0.0.1", port), handler)
    except OSError as error:
        sys.exit(f"cannot bind 127.0.0.1:{port}: {error} (try --port)")
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, f"http://127.0.0.1:{port}"


def free_port() -> int:
    with contextlib.closing(socket.socket()) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


# The measurement runs inside the page. It returns every offending element
# rather than just a count, so a failure names what to look at.
# Only block-level text containers are measured. An inline <code>, <em> or
# <span> is as wide as its own text by definition, so a narrow one is normal;
# a narrow <p> or <li> means the container collapsed.
BLOCKISH = "block list-item flex grid table-cell flow-root"

MEASURE_JS = """
(minWidth) => {
  const blockish = new Set(
    "block list-item flex grid table-cell flow-root".split(" "));
  const scope = document.querySelector('.reader') || document.body;
  const bad = [];
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_ELEMENT);
  for (let el = walker.currentNode; el; el = walker.nextNode()) {
    if (el.children.length) continue;                  // only leaf elements
    const text = (el.textContent || '').trim();
    if (text.length < 12) continue;                    // icons, badges, digits
    const style = getComputedStyle(el);
    if (!blockish.has(style.display)) continue;        // inline: width is the text
    if (style.whiteSpace === 'pre') continue;          // code keeps its own width
    // A flex/grid item is sized by its content on purpose: a chip, a button or
    // a label in a toolbar is legitimately narrow.
    const parentDisplay = el.parentElement
      ? getComputedStyle(el.parentElement).display : '';
    if (/flex|grid/.test(parentDisplay)) continue;
    // Anything inside a horizontally scrollable box (a wide table, a code
    // block) is allowed to be narrower than the viewport.
    let scrollable = false;
    for (let a = el.parentElement; a && a !== scope.parentElement; a = a.parentElement) {
      const ox = getComputedStyle(a).overflowX;
      if (ox === 'auto' || ox === 'scroll') { scrollable = true; break; }
    }
    if (scrollable) continue;
    const box = el.getBoundingClientRect();
    if (box.width === 0 && box.height === 0) continue; // still hidden
    if (box.width >= minWidth) continue;
    bad.push({
      tag: el.tagName.toLowerCase(),
      cls: el.className && el.className.toString().slice(0, 40),
      width: Math.round(box.width),
      text: text.slice(0, 60).replace(/\\s+/g, ' '),
    });
  }
  return bad;
}
"""

OVERFLOW_JS = """
() => {
  const doc = document.documentElement;
  const over = doc.scrollWidth - doc.clientWidth;
  if (over <= 1) return null;
  // Name the offender, so the failure is actionable. Two things would
  // otherwise hide it: a position:fixed off-canvas panel always sticks out
  // past the viewport without adding to scrollWidth, and an element inside a
  // scrolling box is clipped by it. Skip both and report the deepest element
  // whose right edge actually reaches scrollWidth.
  const clipped = (el) => {
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const ox = getComputedStyle(a).overflowX;
      if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') return true;
    }
    return false;
  };
  let worst = null;
  document.querySelectorAll('body *').forEach((el) => {
    const style = getComputedStyle(el);
    if (style.position === 'fixed' || el.closest('[style*="position:fixed"]')) return;
    let fixedAncestor = false;
    for (let a = el; a; a = a.parentElement) {
      if (getComputedStyle(a).position === 'fixed') { fixedAncestor = true; break; }
    }
    if (fixedAncestor || clipped(el)) return;
    const right = el.getBoundingClientRect().right;
    if (right > doc.clientWidth + 1 && (!worst || right >= worst.right)) {
      worst = { right: Math.round(right),
                width: Math.round(el.getBoundingClientRect().width),
                tag: el.tagName.toLowerCase(),
                cls: (el.className || '').toString().slice(0, 40),
                text: (el.textContent || '').trim().slice(0, 50).replace(/\\s+/g, ' ') };
    }
  });
  return { over, worst };
}
"""


def check_page(page, base_url: str, rel: str, html: str) -> Report:
    report = Report(rel)
    console: list[str] = []
    page.on("console", lambda m: console.append(f"{m.type}: {m.text}")
            if m.type == "error" else None)
    page.on("pageerror", lambda e: console.append(f"pageerror: {e}"))

    page.goto(f"{base_url}/{rel}", wait_until="load")
    page.wait_for_timeout(300)

    # --- document contract -------------------------------------------------
    title = page.title().strip()
    if not title:
        report.fail("sem <title>")
    if page.eval_on_selector("body", "b => b.dataset.lesson || ''").strip() == "":
        report.fail("<body> sem data-lesson")

    # --- source nesting ----------------------------------------------------
    nesting = NestingCheck()
    nesting.feed(html)
    for problem in nesting.problems[:5] + nesting.unclosed()[:5]:
        report.fail(f"aninhamento: {problem}")

    # --- page against the manifest -----------------------------------------
    # course-data.js is the single source of truth for titles, activity counts
    # and delivery state, while each lesson page also declares its own id and
    # state on <body>. Two places holding the same fact will drift, so the two
    # are compared here rather than trusted.
    manifest = page.evaluate("() => (window.COURSE && window.COURSE.lessons) || null")
    if manifest:
        lesson_id = page.eval_on_selector("body", "b => b.dataset.lesson || ''")
        delivery = page.eval_on_selector("body", "b => b.dataset.delivery || ''")
        owner = lesson_id.split("-")[0]
        entry = next((l for l in manifest if l["id"] == owner), None)
        if entry:
            if delivery and entry["delivery"] != delivery:
                report.fail(f"data-delivery={delivery!r} mas o manifesto diz "
                            f"{entry['delivery']!r} para a aula {owner}")
            if "-" not in lesson_id:
                acts = len(page.query_selector_all(".act"))
                if acts and entry["acts"] != acts:
                    report.fail(f"a pagina tem {acts} atividades mas o manifesto "
                                f"declara {entry['acts']}")
                slug = entry.get("slug")
                if slug and not rel.endswith(slug.split("/")[-1]):
                    report.fail(f"slug do manifesto ({slug}) nao bate com {rel}")
        elif lesson_id not in ("index",):
            report.fail(f"data-lesson={lesson_id!r} nao existe no manifesto")

    # --- javascript errors -------------------------------------------------
    for message in console:
        report.fail(f"console: {message}")

    # --- internal links ----------------------------------------------------
    hrefs = page.eval_on_selector_all(
        "[href], [src]",
        "els => els.map(e => e.getAttribute('href') || e.getAttribute('src'))")
    page_dir = (DOCS / rel).parent
    for href in hrefs:
        if not href or href.startswith(("http://", "https://", "#", "mailto:", "data:")):
            continue
        target = (page_dir / href.split("#")[0].split("?")[0]).resolve()
        if not target.exists():
            report.fail(f"link interno quebrado: {href}")

    # --- layout, one activity at a time ------------------------------------
    # THE GOTCHA: activities live in <article class="act" hidden>, and a hidden
    # element measures 0 wide. Measuring the page as-is reports every hidden
    # paragraph as broken (false positives) while the one visible activity may
    # look fine (false negative on the real bug). So each activity is revealed
    # alone, measured, and hidden again.
    activities = page.eval_on_selector_all(".act", "els => els.map(e => e.id)")
    for label, width, height in VIEWPORTS:
        page.set_viewport_size({"width": width, "height": height})

        overflow = page.evaluate(OVERFLOW_JS)
        if overflow:
            worst = overflow["worst"] or {}
            report.fail(f"[{label}] overflow horizontal de {overflow['over']}px "
                        f"(<{worst.get('tag')} class=\"{worst.get('cls')}\"> "
                        f"{worst.get('width')}px: {worst.get('text')!r})")

        if not activities:
            for bad in page.evaluate(MEASURE_JS, MIN_TEXT_WIDTH):
                report.fail(f"[{label}] <{bad['tag']} class=\"{bad['cls']}\"> "
                            f"com {bad['width']}px: {bad['text']!r}")
            continue

        for act_id in activities:
            page.evaluate(
                """(id) => {
                    document.querySelectorAll('.act').forEach(a => { a.hidden = true; });
                    document.getElementById(id).hidden = false;
                }""", act_id)
            page.wait_for_timeout(30)
            for bad in page.evaluate(MEASURE_JS, MIN_TEXT_WIDTH):
                report.fail(f"[{label}] #{act_id} <{bad['tag']} "
                            f"class=\"{bad['cls']}\"> com {bad['width']}px: {bad['text']!r}")
            overflow = page.evaluate(OVERFLOW_JS)
            if overflow:
                worst = overflow["worst"] or {}
                report.fail(f"[{label}] #{act_id} overflow horizontal de "
                            f"{overflow['over']}px (<{worst.get('tag')} "
                            f"class=\"{worst.get('cls')}\"> {worst.get('width')}px: "
                            f"{worst.get('text')!r})")

    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pages", nargs="*", help="paths relative to docs/ (default: all)")
    parser.add_argument("--port", type=int, default=0, help="port for the local server")
    args = parser.parse_args()

    if args.pages:
        targets = [p.lstrip("./") for p in args.pages]
    else:
        targets = sorted(
            str(p.relative_to(DOCS)) for p in DOCS.rglob("*.html"))
    if not targets:
        sys.exit("no .html pages found")

    httpd, base_url = serve(DOCS, args.port or free_port())
    reports: list[Report] = []
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(args=["--no-sandbox"])
            context = browser.new_context(viewport={"width": 1440, "height": 900})
            page = context.new_page()
            for rel in targets:
                try:
                    reports.append(check_page(page, base_url, rel, (DOCS / rel).read_text()))
                except PlaywrightError as error:
                    broken = Report(rel)
                    broken.fail(f"nao carregou: {error}")
                    reports.append(broken)
            browser.close()
    finally:
        httpd.shutdown()

    failed = 0
    for report in reports:
        if report.failures:
            failed += 1
            print(f"FALHOU  {report.page}")
            for failure in report.failures:
                print(f"        {failure}")
        else:
            print(f"ok      {report.page}")

    total = len(reports)
    print(f"\n{total - failed}/{total} paginas ok")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
