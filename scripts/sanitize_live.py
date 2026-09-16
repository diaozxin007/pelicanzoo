"""Rewrite public/live/*.svg in place: strip anything executable, and give every
file a viewBox so it scales instead of stretching.

The game drops these straight into innerHTML, so they have to be safe on disk —
sanitising only in zoo.js would leave the fetched copy untouched.
"""
import pathlib, re

LIVE = pathlib.Path(__file__).resolve().parent.parent / "public" / "live"

def viewbox(tag):
    """No viewBox means width/height are the only size info, and we strip those."""
    if re.search(r"viewBox", tag, re.I):
        return tag
    w = re.search(r'\bwidth\s*=\s*"([\d.]+)', tag)
    h = re.search(r'\bheight\s*=\s*"([\d.]+)', tag)
    if not (w and h):
        return tag
    return tag[:4] + f' viewBox="0 0 {w.group(1)} {h.group(1)}"' + tag[4:]

def clean(svg):
    svg = re.sub(r"<\?xml[^>]*\?>", "", svg)
    svg = re.sub(r"<!DOCTYPE[^>]*>", "", svg, flags=re.I)
    svg = re.sub(r"<script\b[\s\S]*?</script>", "", svg, flags=re.I)
    svg = re.sub(r"""\son\w+\s*=\s*("[^"]*"|'[^']*')""", "", svg, flags=re.I)
    svg = re.sub(r"javascript:", "", svg, flags=re.I)
    svg = re.sub(r"<svg[^>]*>", lambda m: viewbox(m.group(0)), svg, count=1, flags=re.I)
    # One pass only strips the first attribute it meets, so keep going.
    while re.search(r'<svg[^>]*\s(width|height)="', svg, re.I):
        svg = re.sub(r'<svg([^>]*?)\s(width|height)="[^"]*"', r"<svg\1", svg, count=1, flags=re.I)
    return svg.strip()

fixed = 0
for f in sorted(LIVE.glob("*.svg")):
    src = f.read_text(encoding="utf-8", errors="replace")
    out = clean(src)
    if out != src:
        f.write_text(out, encoding="utf-8")
        fixed += 1
print(f"sanitised {fixed} / {len(list(LIVE.glob('*.svg')))} live SVGs")
