#!/usr/bin/env python3
"""Pull every pelican-tagged post from Simon Willison's public Datasette.

Source: https://datasette.simonwillison.net/simonwillisonblog
He publishes his blog database openly; we query it rather than scraping HTML.
Output: data/source-posts.json  (one record per post, raw body preserved)
"""
import json, sys, time, urllib.parse, urllib.request
from pathlib import Path

DB = "https://datasette.simonwillison.net/simonwillisonblog.json"
TAG = "pelican-riding-a-bicycle"
OUT = Path(__file__).resolve().parent.parent / "data" / "source-posts.json"

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
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(rows, ensure_ascii=False, indent=1))
    by_kind = {}
    for r in rows:
        by_kind[r["kind"]] = by_kind.get(r["kind"], 0) + 1
    print(f"posts: {len(rows)}  {by_kind}")
    print(f"range: {rows[0]['created'][:10]} .. {rows[-1]['created'][:10]}")
    print(f"wrote: {OUT}  ({OUT.stat().st_size/1024:.0f} KB)")

if __name__ == "__main__":
    main()
