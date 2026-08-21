# Producing the demo GIF

The README embeds `assets/demo.gif`. This is a 30-60 second screen recording that gives a
first-time visitor an instant sense of what s3BEAR does. Keep it tight and silent (GIFs have
no audio) — the motion tells the story.

## What to show (suggested 40s script)

1. **(0-8s)** Sign in, land on the Buckets view. Let a couple of buckets and objects be visible.
2. **(8-20s)** Open an image object → click **Share** → set an expiry (e.g. 7 days) → copy the
   generated public HTTPS URL.
3. **(20-30s)** Paste that URL into a browser tab or an LLM chat as an image input — it loads,
   proving the object is reachable while the bucket stays private.
4. **(30-40s)** Back in s3BEAR, **revoke** the link, reload the URL → it now returns `410 Gone`.

This arc lands the core message: *private storage, governed access, expiring AI-ready URLs.*

## Recording

- Record at **1280x720** (or 1440x810) so text stays legible when scaled down.
- Use any screen recorder: macOS **QuickTime** (File → New Screen Recording), or **Kap**
  (https://getkap.co) which exports GIF directly.
- Trim dead air. Aim for **30-45 seconds**.

## Optimizing (target < 6 MB)

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
