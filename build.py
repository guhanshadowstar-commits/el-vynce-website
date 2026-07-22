#!/usr/bin/env python3
"""
EL VYNCE — partial-injection build script.

The nav, footer, and cart drawer were previously hand-duplicated across every
HTML page and had already started drifting out of sync. This script makes
partials/{nav,footer,cart-drawer}.html the single source of truth: edit those
files, then run `python3 build.py` to regenerate every page in place.

Pages that don't contain a given block (e.g. 404.html has no nav/footer/cart
drawer) are simply left untouched for that block.

The page-loader partial is different: it doesn't already exist in any page,
so instead of replacing a block it's INSERTED right after the opening <body>
tag (on every page, including 404.html) — that position matters, since it
must be the first thing painted so there's no flash of the page underneath
before it. The insertion is idempotent: rerunning this script never
duplicates it, it just leaves an already-inserted loader alone.
"""
import re
import pathlib

ROOT = pathlib.Path(__file__).parent
PARTIALS_DIR = ROOT / "partials"

BLOCKS = [
    ("nav", re.compile(r'<nav class="fixed top-0.*?</nav>\n', re.DOTALL)),
    ("footer", re.compile(r'<footer class="bg-white border-t.*?</footer>\n', re.DOTALL)),
    ("cart-drawer", re.compile(r'<div class="fixed inset-0 bg-black/40 backdrop-blur-sm z-\[60\].*?</aside>\n</div>\n', re.DOTALL)),
]

SKIP_FILES = {"404.html"}

BODY_OPEN = re.compile(r'(<body[^>]*>\n)')


def main():
    partials = {}
    for name, _ in BLOCKS:
        partials[name] = (PARTIALS_DIR / f"{name}.html").read_text()
    loader_partial = (PARTIALS_DIR / "page-loader.html").read_text()

    changed = []
    for html_file in sorted(ROOT.glob("*.html")):
        text = html_file.read_text()
        original = text

        if html_file.name not in SKIP_FILES:
            for name, pattern in BLOCKS:
                text = pattern.sub(lambda m, n=name: partials[n], text, count=1)

        if '<div id="ev-page-loader"' not in text:
            text = BODY_OPEN.sub(lambda m: m.group(1) + loader_partial, text, count=1)

        if text != original:
            html_file.write_text(text)
            changed.append(html_file.name)

    print(f"Rebuilt {len(changed)} page(s): {', '.join(changed) if changed else '(none changed)'}")


if __name__ == "__main__":
    main()
