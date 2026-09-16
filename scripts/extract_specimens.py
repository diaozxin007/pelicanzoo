#!/usr/bin/env python3
"""Turn raw posts into a specimen catalogue.

Each specimen = one pelican image Simon published, with the model that drew it,
his own commentary (the alt text), and whether the vector original survives.

Model names are matched additively against a family vocabulary. Subtractive
suffix-stripping was tried first and ate version numbers (gpt-5-nano -> gpt-nano),
which is exactly the information we care most about.

Output: data/specimens.json
"""
import json, re, html
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POSTS = json.loads((ROOT / "data" / "source-posts.json").read_text())
OUT = ROOT / "data" / "specimens.json"

MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

# --- what counts as a specimen -------------------------------------------------
PELICAN = re.compile(r"pelican|bicycle|\bbike\b", re.I)
# Simon occasionally swaps the animal; those are neighbours, not pelicans.
OTHER_ANIMAL = re.compile(r"flamingo|opossum|possum|raccoon|otter|walrus|heron|stork|duck(?!-)", re.I)
NOISE = re.compile(r"chart|graph|thumbnail|screenshot|logo|headshot|terminal|win-rates"
                   r"|leaderboard|pricing|geometry|banana|trash-hat|\bpaul\b", re.I)
# These say "pelican" in the alt text and still aren't a drawing: bounding-box
# demos, agent transcripts, chat UIs with a pelican somewhere on screen. They
# have to beat the pelican keyword, not lose to it.
HARD_NOISE = re.compile(r"bbox|grounding|count-pelicans|_analysis|hacking"
                        r"|full-ui|openweb-ui|no-reasoning-bug", re.I)
# Simon also posts photos of actual pelicans. They are lovely and they are not
# model output: nobody can guess who "drew" a bird that was standing on a rock.
REAL_BIRD = re.compile(r"breeding-plumage|two-pelicans|livestream"
                       r"|perched on a rock|flying against|whole mess of pelicans", re.I)
SLIDE = re.compile(r"ai-worlds-fair|5-minutes-llms|slides?-\d", re.I)
# Multi-pelican contact sheets: one image, many models. Not a single specimen.
GRID = re.compile(r"comparison|grid|contact-sheet|-all-|matrix|\bvs\b|side-by-side", re.I)

IMG = re.compile(r"<img\b[^>]*>", re.I)
SVG_LINK = re.compile(r'<a\b[^>]*href="(https://static\.simonwillison\.net/[^"]+\.svg)"', re.I)

# --- model vocabulary ----------------------------------------------------------
FAMILIES = [
    "claude","gpt","chatgpt","o1","o3","o4","gemini","gemma","llama","qwen","qwq",
    "mistral","mixtral","magistral","devstral","codestral","pixtral","ministral",
    "deepseek","glm","kimi","grok","phi","nova","command","command-r","jamba",
    "minimax","hunyuan","ernie","doubao","step","moonshot","falcon","olmo","smollm",
    "granite","nemotron","sonar","aya","reka","dbrx","arctic","exaone","solar",
    "cohere","yi","internlm","baichuan","seed","ling","longcat","apriel","trillium",
    "muse","spark","astra","fable","luna","terra","sol","opus","sonnet","haiku",
    "flash","pro","nano","mini","turbo","maverick","scout","behemoth",
    "lite","preview","exp","instruct","chat","vision","coder","math","air",
    "plus","max","ultra","base","it","distill","zero","next","omni",
]
VENDOR_PREFIX = re.compile(r"^(cerebras|groq|together|openrouter|bedrock|us|eu|apac|amazon|google|meta|alibaba|ollama|lmstudio|mlx|local)[-.]", re.I)
VERSION = r"\d+(?:[.-]\d+)*[a-z]?"
EFFORT = re.compile(r"\b(low|medium|high|max|minimal|xhigh|ultra|thinking|nothinking|no-thinking|reasoning|no-reasoning)\b", re.I)

FAM_RE = re.compile(r"(?<![a-z])(" + "|".join(sorted(FAMILIES, key=len, reverse=True)) + r")(?![a-z])", re.I)

def norm_version(v):
    """claude-3-5-sonnet uses dashes where the world writes dots.

    Only single-digit pairs: 05-20 in gemini-2.5-flash-preview-05-20 is a
    release date, not a version, and must survive intact.
    """
    return v.replace("-", ".") if re.fullmatch(r"\d-\d", v) else v

def model_from_text(text):
    """Pull 'family + version + qualifiers' out of a filename stem or alt sentence."""
    t = VENDOR_PREFIX.sub("", text.replace("_", "-"))
    m = FAM_RE.search(t)
    if not m:
        return None
    parts, i = [], m.start()
    # Walk forward collecting family words, versions and size qualifiers.
    tail = t[i:]
    token_re = re.compile(rf"({FAM_RE.pattern}|{VERSION}|\d+[bB])", re.I)
    pos = 0
    while pos < len(tail):
        mt = token_re.match(tail, pos)
        if not mt:
            if tail[pos] in "-. ":
                pos += 1
                # stop if the next token isn't part of the name
                nxt = token_re.match(tail, pos)
                if not nxt:
                    break
                continue
            break
        tok = mt.group(0)
        if EFFORT.fullmatch(tok) and tok.lower() != "pro":
            break
        parts.append(norm_version(tok))
        pos = mt.end()
    name = "-".join(parts).strip("-.")
    return re.sub(r"-{2,}", "-", name) or None

def attr(tag, name):
    m = re.search(rf'\b{name}="([^"]*)"', tag, re.I)
    return html.unescape(m.group(1)) if m else ""

def post_url(p):
    y, mo, d = p["created"][:4], int(p["created"][5:7]), int(p["created"][8:10])
    return f"https://simonwillison.net/{y}/{MONTHS[mo-1]}/{d}/{p['slug']}/"

specimens, seen, stems = [], set(), set()
for p in POSTS:
    h, url = p["html"] or "", post_url(p)
    items = [(attr(t.group(0), "src"), attr(t.group(0), "alt")) for t in IMG.finditer(h)]
    items += [(m.group(1), "") for m in SVG_LINK.finditer(h)]

    for src, alt in items:
        if not src:
            continue
        if src.startswith("/"):
            src = "https://static.simonwillison.net" + src
        if src in seen:
            continue
        name = src.rsplit("/", 1)[-1]
        stem, ext = name.rsplit(".", 1)[0], name.rsplit(".", 1)[-1].lower()
        blob = f"{stem} {alt}"

        is_slide = bool(SLIDE.search(name))
        species = "pelican"
        if OTHER_ANIMAL.search(blob):
            species = OTHER_ANIMAL.search(blob).group(0).lower()

        # Decide whether this is a specimen at all.
        if HARD_NOISE.search(stem):
            continue
        if not is_slide and REAL_BIRD.search(blob):
            continue
        if NOISE.search(stem) and not PELICAN.search(blob):
            continue
        if GRID.search(f"{stem} {alt[:120]}"):
            continue
        signal = bool(PELICAN.search(blob)) or species != "pelican"
        # Inside a pelican post, a linked .svg is a vector original by default.
        if ext == "svg":
            signal = True
        if not signal:
            continue

        # Same drawing re-posted as .jpg and .png: one pelican, one card.
        if stem in stems:
            continue
        seen.add(src)
        stems.add(stem)
        model = model_from_text(stem)
        msrc = "filename"
        if not model and is_slide:
            model, msrc = model_from_text(alt), "alt"
        if not model:
            model, msrc = model_from_text(p["title"] or ""), "title"
        eff = EFFORT.search(stem) or (EFFORT.search(alt) if is_slide else None)

        specimens.append({
            "id": stem,
            "asset": src,
            "format": ext,
            "alive": ext == "svg",              # vector original survives
            "animated": "animated" in stem.lower() or "animat" in alt.lower(),
            "slide_photo": is_slide,            # photo of a conference slide
            "species": species,
            "model": model,
            "effort": eff.group(0).lower() if eff else None,
            "model_source": msrc if model else None,
            "needs_review": model is None,
            "keeper_note": alt.strip(),         # Simon's own words
            "post_title": p["title"],
            "post_url": url,
            "observed": p["created"][:10],
        })

# --- normalise -----------------------------------------------------------------
ALIASES = {
    "gpt-45": "gpt-4.5",
    "gpt-120": "gpt-oss-120b",     # gpt-oss-120b, filename drops the "oss"
    "gpt-20": "gpt-oss-20b",
    "gpt-2.5": "gpt-4.5",
}
# A bare qualifier is a mis-match, not a model.
VAGUE = re.compile(r"^(it|mini|max|pro|lite|plus|air|base|next|chat|preview|exp|nano|flash|turbo)$", re.I)

for s_ in specimens:
    m = s_["model"]
    if not m:
        continue
    m = m.lower()
    m = ALIASES.get(m, m)
    if VAGUE.match(m) or len(m) < 3:
        s_["model"], s_["model_source"], s_["needs_review"] = None, None, True
    else:
        s_["model"] = m

# Title cards, prompt slides and interstitials are not specimens.
specimens = [s_ for s_ in specimens if not (s_["needs_review"] and s_["slide_photo"])]

specimens.sort(key=lambda s: (s["observed"], s["id"]))
OUT.write_text(json.dumps(specimens, ensure_ascii=False, indent=1))

n = len(specimens)
alive = sum(s["alive"] for s in specimens)
pel = sum(s["species"] == "pelican" for s in specimens)
print(f"标本总数        {n}")
print(f"  鹈鹕          {pel}    近亲物种 {n-pel}")
print(f"  活体 (SVG)    {alive}   ({alive/n:.0%})")
print(f"  会动的        {sum(s['animated'] for s in specimens)}")
print(f"  演讲翻拍      {sum(s['slide_photo'] for s in specimens)}")
print(f"  带饲养员手记  {sum(1 for s in specimens if len(s['keeper_note'])>20)}")
print(f"  待人工确认    {sum(s['needs_review'] for s in specimens)}")
print(f"识别出的模型    {len({s['model'] for s in specimens if s['model']})}")
print(f"时间跨度        {specimens[0]['observed']} .. {specimens[-1]['observed']}")
