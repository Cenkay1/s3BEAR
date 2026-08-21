# Producing the demo GIF

The README embeds `assets/demo.gif`. This is a 30-60 second screen recording that gives a
first-time visitor an instant sense of what s3BEAR does. Keep it tight and silent (GIFs have
no audio) — the motion tells the story.

## What to show — the ONE flow (35-40s)

Do **not** record generic bucket/file browsing — that reads as "just another S3 console" and
undercuts the positioning. Record the single flow that shows the unique value: a private
object becomes an expiring, revocable URL you can hand to an LLM, and the bucket never goes
public.

| Time | Action | What it proves |
|------|--------|----------------|
| 0-5s | Buckets view; click an image in a **private** bucket | Storage is private |
| 5-15s | **Share** → set expiry (e.g. 7d) → **Copy link** (HTTPS URL) | Shareable without making the bucket public |
| 15-25s | Open the link in a new browser tab → the image loads | The URL actually works for a client / LLM |
| 25-35s | Back in s3BEAR → **Revoke** the link → reload the tab → **410 Gone** | You control access; the bucket was never public |

This arc is the visual proof of the README's *The Problem / The Solution* sections.

**Browser tab vs. real LLM:** opening the link in a plain browser tab (step 3) is the safe,
repeatable choice — recommended. Pasting the URL into a real Claude/GPT chat as an image input
is more striking but slower and riskier on a single take; only do it if you rehearse first.

**Optional +8s governance beat:** after the revoke, cut to the **Audit Log** and show the
"share created / revoked" rows appearing. Skip it if it makes the clip drag — short beats long.

## Recording

- **Recommended tool: [Kap](https://getkap.co)** (free, open source). Select a region over
  the browser window and **export straight to GIF** — no ffmpeg/gifski needed. Set ~15 fps and
  width ~1200 in Kap's export dialog, and you can skip the "Optimizing" section below entirely.
- Alternatives: **LICEcap** (records directly to `.gif`), or macOS **QuickTime** / `Cmd+Shift+5`
  (records `.mov`, then convert with the commands below).
- Record at **1280x720** (or 1440x810) so text stays legible when scaled down.
- Keep the cursor slow and deliberate. Trim dead air. Aim for **30-40 seconds**.
- Do not let secrets show on screen: no `admin`/`admin`, no secret key, no real S3 credentials.
  Use seeded demo data.

## Optimizing (only if you recorded a video, not with Kap — target < 6 MB)

A raw GIF can be 30 MB+. Convert from an MP4/MOV recording for a much smaller file.

**Option A — gifski (best quality/size):**

```bash
# 1. record to demo.mov / demo.mp4, then extract frames at 15 fps
ffmpeg -i demo.mov -vf "fps=15,scale=1200:-1:flags=lanczos" -f image2 frames/%04d.png

# 2. build an optimized gif
gifski --fps 15 --width 1200 -o assets/demo.gif frames/*.png
```

**Option B — ffmpeg only (palette method):**

```bash
ffmpeg -i demo.mov -vf "fps=13,scale=1100:-1:flags=lanczos,palettegen" palette.png
ffmpeg -i demo.mov -i palette.png -lavfi "fps=13,scale=1100:-1:flags=lanczos [x]; [x][1:v] paletteuse" assets/demo.gif
```

Then check the size:

```bash
ls -lh assets/demo.gif
```

If it is still too large, drop `fps` to 10-12, or reduce `scale` to `1000` / `900`.

## Placing it

Save the final file as `assets/demo.gif`. The README currently shows a **screenshot
placeholder** so it never displays a broken image. Once your GIF exists, open `README.md`,
find the demo section, and change:

```html
<img src="assets/screenshots/buckets.png" alt="s3BEAR demo" width="800" />
```

to:

```html
<img src="assets/demo.gif" alt="s3BEAR demo" width="800" />
```

Then commit the GIF + README change and push.

> Tip: if you later want higher fidelity with audio, record an MP4 and drag-drop it into a
> GitHub issue or release; GitHub renders uploaded `.mp4` as an inline `<video>`. Link that
> from the demo section. The GIF remains the fallback that shows everywhere (npm, mirrors).
