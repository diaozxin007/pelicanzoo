#!/usr/bin/env python3
"""Pull every pelican-tagged post from Simon Willison's public Datasette.

Source: https://datasette.simonwillison.net/simonwillisonblog
He publishes his blog database openly; we query it rather than scraping HTML.
Output: data/source-posts.json  (one record per post, raw body preserved)

Since late 2026 the per-effort pelicans live in gists, linked through his
markdown-svg-renderer, and the post itself only carries a grid. Those gists are
fetched here too, so extract_specimens.py stays offline.
Output: data/source-gists.json  (gist id -> {filename: markdown})
"""
import json, re, sys, time, urllib.parse, urllib.request
from pathlib import Path

DB = "https://datasette.simonwillison.net/simonwillisonblog.json"
TAG = "pelican-riding-a-bicycle"
OUT = Path(__file__).resolve().parent.parent / "data" / "source-posts.json"
GISTS_OUT = OUT.with_name("source-gists.json")
GIST_LINK = re.compile(r"markdown-svg-renderer\?url=(?:https%3A%2F%2Fgist\.github\.com%2Fsimonw%2F|https://gist\.github\.com/simonw/)([0-9a-f]+)")

SQL = """
select 'entry' as kind, e.id, e.title, e.slug, e.created, e.body as html
from blog_entry e
join blog_entry_tags et on et.entry_id = e.id
join blog_tag t on t.id = et.tag_id
where t.tag = :tag
union all
select 'blogmark', b.id, b.link_title, b.slug, b.created, b.commentary
from blog_blogmark b
join blog_blogmark_tags bt on bt.blogmark_id = b.id
join blog_tag t on t.id = bt.tag_id
where t.tag = :tag
union all
select 'note', n.id, n.title, n.slug, n.created, n.body
from blog_note n
join blog_note_tags nt on nt.note_id = n.id
join blog_tag t on t.id = nt.tag_id
where t.tag = :tag
union all
select 'beat', b.id, b.title, b.slug, b.created, b.note
from blog_beat b
join blog_beat_tags bt on bt.beat_id = b.id
join blog_tag t on t.id = bt.tag_id
where t.tag = :tag and b.is_draft = 0
order by created
"""

def fetch(url, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": "pelicanzoo-archiver/0.1 (+https://pelicanzoo.ai; archiving the pelican benchmark)"
            })
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode())
        except Exception as e:
            if i == tries - 1:
                raise
            print(f"  retry {i+1}: {e}", file=sys.stderr)
            time.sleep(2 * (i + 1))

def main():
    qs = urllib.parse.urlencode({"sql": SQL, "tag": TAG, "_shape": "array", "_size": "max"})
    rows = fetch(f"{DB}?{qs}")
    if isinstance(rows, dict) and rows.get("error"):
        sys.exit(f"Datasette error: {rows['error']}")
    # Beats store Markdown and release metadata. Archive their rendered
    # public article so the offline extractor sees the same HTML everywhere.
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    for row in rows:
        if row["kind"] != "beat":
            continue
        date = row["created"]
        url = f"https://simonwillison.net/{date[:4]}/{months[int(date[5:7])-1]}/{int(date[8:10])}/{row['slug']}/"
        with urllib.request.urlopen(url, timeout=60) as response:
            page = response.read().decode()
        body = re.search(r'<div class="entry entryPage">(.*?)<div class="entryFooter">', page, re.S)
        if not body:
            raise ValueError(f"Missing article body: {url}")
        row["html"] = body.group(1)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(rows, ensure_ascii=False, indent=1))
    by_kind = {}
    for r in rows:
        by_kind[r["kind"]] = by_kind.get(r["kind"], 0) + 1
    print(f"posts: {len(rows)}  {by_kind}")
    print(f"range: {rows[0]['created'][:10]} .. {rows[-1]['created'][:10]}")
    print(f"wrote: {OUT}  ({OUT.stat().st_size/1024:.0f} KB)")

    ids = sorted({g for r in rows for g in GIST_LINK.findall(r["html"] or "")})
    gists = json.loads(GISTS_OUT.read_text()) if GISTS_OUT.exists() else {}
    # A published transcript does not change; each gist is fetched once, ever.
    for gid in ids:
        if gid in gists:
            continue
        g = fetch(f"https://api.github.com/gists/{gid}")
        gists[gid] = {name: f["content"] for name, f in g["files"].items()}
        time.sleep(1)
    GISTS_OUT.write_text(json.dumps(gists, ensure_ascii=False, indent=1))
    print(f"gists: {len(ids)} linked, {len(gists)} on file")

if __name__ == "__main__":
    main()
