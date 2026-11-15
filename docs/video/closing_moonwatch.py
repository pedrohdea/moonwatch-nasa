"""Generate the CLOSING video (5 s): extra edition of the newspaper with the MoonWatch logo.

Uso:
    python3 docs/video/closing_moonwatch.py [output.mp4]

Timeline:
    0.0–1.0 s  "EXTRA EDITION" page spins in
    1.0–2.8 s  MoonWatch logo draws itself in ink on the live photo; dashed trajectory advances
    1.4/2.0 s  "SEE THE RISK." / "PICK THE SITE."
    2.7 s      green stamp "MOONWATCH." with camera shake
    3.4 s      "SAVE THE MISSION."
    4.6–5.0 s  fade to dark

Reuses the look and camera of hook_newspaper.py.
"""

import math
import subprocess
import sys
from pathlib import Path

import numpy as np
from loguru import logger
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from hook_newspaper import (
    F_HEAD,
    F_ITAL,
    F_MAST,
    FPS,
    H,
    INK,
    PAGE_H,
    PAGE_W,
    PAPER,
    W,
    age_parchment,
    build_background,
    build_stamp,
    draw_crescent,
    ease_out_cubic,
    fit_font,
    ornate_rule,
    place_page,
    slam_stamp,
)

DURATION = 5.0
LOGO_PATH = Path(__file__).resolve().parent / "assets/moonwatch_logo.png"
PLATE_BOX = (90, 380, 990, 1180)  # x0, y0, x1, y1 on the page
TAGLINE = ("SEE THE RISK.", "PICK THE SITE.", "SAVE THE MISSION.")
TAGLINE_TIMES = (1.4, 2.0, 3.4)
TAGLINE_Y = (470, 630, 1110)  # stamp sits between line 2 and 3 (reading order)
STAMP_AT, STAMP_POS = 2.7, (1480, 870)
STAMP_TEXT = "MOONWATCH."
DRAW_START, DRAW_END = 1.0, 2.8
STAMP_GREEN = (22, 120, 50)  # marker green of the logo, darkened like stamp ink

# Landmarks of the hand-drawn logo, in source-image pixels (1086x1448).
OVAL_C, OVAL_A, OVAL_B = (640, 822), 350, 305
PATH_A, PATH_B = (520, 655), (690, 890)  # dashed trajectory: Earth -> lander


def load_logo():
    """Extract the green stroke of the logo and crop it to the drawing area.

    Returns:
        Tuple (cropped float32 alpha 0..1, (x, y) offset of the crop in the original image).
    """
    logger.debug("load_logo path={}", LOGO_PATH)
    rgb = np.asarray(Image.open(LOGO_PATH).convert("RGB")).astype(np.float32)
    green = rgb[..., 1] - np.maximum(rgb[..., 0], rgb[..., 2])
    alpha = np.clip((green - 25) / 60, 0, 1)
    ys, xs = np.nonzero(alpha > 0.2)
    pad = 12
    x0, y0 = max(xs.min() - pad, 0), max(ys.min() - pad, 0)
    x1, y1 = xs.max() + pad, ys.max() + pad
    logger.debug("load_logo bbox=({}, {}, {}, {})", x0, y0, x1, y1)
    return alpha[y0:y1, x0:x1], (x0, y0)


def build_reveal_map(shape, offset):
    """Compute, per pixel, the normalized instant (0..1) at which the stroke appears.

    Frame: angular sweep. Title: left to right. Oval: angular sweep.
    Inner icons: by distance from the center. Dashes: along the trajectory.

    Args:
        shape: (height, width) of the logo crop.
        offset: (x, y) of the crop in the original image.

    Returns:
        float32 array with the normalized reveal instant.
    """
    logger.debug("build_reveal_map shape={}", shape)
    h, w = shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    xx += offset[0]
    yy += offset[1]
    ang = (
        (np.arctan2(yy - OVAL_C[1], xx - OVAL_C[0]) + math.pi * 0.75)
        % (2 * math.pi)
        / (2 * math.pi)
    )
    e = np.sqrt(((xx - OVAL_C[0]) / OVAL_A) ** 2 + ((yy - OVAL_C[1]) / OVAL_B) ** 2)

    reveal = 0.0 + 0.35 * ang  # outer frame
    title = (yy > 360) & (yy < 520) & (xx > 280) & (xx < 1000)
    reveal = np.where(title, 0.15 + 0.35 * (xx - 280) / 720, reveal)
    reveal = np.where(np.abs(e - 1) < 0.12, 0.30 + 0.35 * ang, reveal)
    inside = e <= 0.88
    reveal = np.where(inside, 0.55 + 0.25 * np.clip(e, 0, 1), reveal)

    ax, ay = PATH_A
    dx, dy = PATH_B[0] - ax, PATH_B[1] - ay
    seg2 = dx * dx + dy * dy
    s = np.clip(((xx - ax) * dx + (yy - ay) * dy) / seg2, 0, 1)
    dist = np.hypot(xx - (ax + s * dx), yy - (ay + s * dy))
    on_path = inside & (dist < 22)
    reveal = np.where(on_path, 0.70 + 0.22 * s, reveal)
    logger.debug("build_reveal_map done")
    return reveal.astype(np.float32)


def build_logo_layers():
    """Prepare the logo resized for the photo and its reveal map.

    Returns:
        Dict with resized alpha and map, position on the page and trajectory in page coordinates.
    """
    logger.info("build_logo_layers start")
    alpha, offset = load_logo()
    reveal = build_reveal_map(alpha.shape, offset)
    px0, py0, px1, py1 = PLATE_BOX
    margin = 50
    k = min(
        (px1 - px0 - 2 * margin) / alpha.shape[1],
        (py1 - py0 - 2 * margin) / alpha.shape[0],
    )
    size = (int(alpha.shape[1] * k), int(alpha.shape[0] * k))
    a_img = Image.fromarray((alpha * 255).astype(np.uint8)).resize(size, Image.LANCZOS)
    r_img = Image.fromarray(reveal, mode="F").resize(size, Image.BILINEAR)
    pos = (px0 + (px1 - px0 - size[0]) // 2, py0 + (py1 - py0 - size[1]) // 2)
    grain = np.random.default_rng(9).uniform(0.75, 1.0, (size[1], size[0]))

    path = tuple((pos[0] + (x - offset[0]) * k, pos[1] + (y - offset[1]) * k) for x, y in (PATH_A, PATH_B))
    logger.info("build_logo_layers done size={} pos={}", size, pos)
    return {
        "alpha": np.asarray(a_img).astype(np.float32) / 255 * grain,
        "reveal": np.asarray(r_img),
        "pos": pos,
        "path": path,
    }


def build_page():
    """Build the "EXTRA EDITION" page (without logo, taglines or animations).

    Returns:
        Aged RGBA page.
    """
    logger.info("build_page start")
    page = Image.new("RGB", (PAGE_W, PAGE_H), PAPER)
    d = ImageDraw.Draw(page)
    m = 80
    inner = PAGE_W - 2 * m
    d.rectangle([40, 30, PAGE_W - 40, PAGE_H - 30], outline=INK, width=3)
    d.rectangle([52, 42, PAGE_W - 52, PAGE_H - 42], outline=INK, width=1)

    draw_crescent(d, m + 120, 120, 62, INK, PAPER)
    draw_crescent(d, PAGE_W - m - 120, 120, 62, INK, PAPER)
    mast = fit_font(F_MAST, "The Lunar Gazette", inner - 560, 190)
    d.text((PAGE_W // 2, 118), "The Lunar Gazette", font=mast, fill=INK, anchor="mm")
    ornate_rule(d, 225, m, PAGE_W - m, INK)

    d.rectangle([m, 262, PAGE_W - m, 330], fill=INK)
    d.text(
        (PAGE_W // 2, 296),
        "EXTRA   ~   EXTRA EDITION   ~   EXTRA",
        font=ImageFont.truetype(F_HEAD, 50),
        fill=PAPER,
        anchor="mm",
    )

    x0, y0, x1, y1 = PLATE_BOX
    d.rectangle([x0, y0, x1, y1], fill=(232, 216, 180))
    d.rectangle([x0 - 14, y0 - 14, x1 + 14, y1 + 14], outline=INK, width=6)
    d.rectangle([x0 - 5, y0 - 5, x1 + 5, y1 + 5], outline=INK, width=2)
    for px, py in (
        (x0 - 14, y0 - 14),
        (x1 + 14, y0 - 14),
        (x0 - 14, y1 + 14),
        (x1 + 14, y1 + 14),
    ):
        d.polygon(
            [(px - 16, py), (px, py - 16), (px + 16, py), (px, py + 16)], fill=INK
        )
    d.text(
        ((x0 + x1) // 2, y1 + 60),
        "Launch windows at the south pole, watched before they close.",
        font=ImageFont.truetype(F_ITAL, 30),
        fill=INK,
        anchor="mm",
    )

    col_x0 = x1 + 70
    col_mid = (col_x0 + PAGE_W - m) // 2
    for y in (550,):
        d.line([col_mid - 220, y, col_mid + 220, y], fill=INK, width=2)
        d.polygon(
            [
                (col_mid - 12, y),
                (col_mid, y - 10),
                (col_mid + 12, y),
                (col_mid, y + 10),
            ],
            fill=INK,
        )
    d.line([col_x0 - 35, y0 - 14, col_x0 - 35, PAGE_H - 80], fill=INK, width=2)

    page = age_parchment(page)
    logger.info("build_page done")
    return page


def build_tagline_layers():
    """Draw each tagline phrase on its own layer (for the ink-bleed effect).

    Returns:
        List of tuples (cropped RGBA image, (x, y) position on the page).
    """
    logger.debug("build_tagline_layers start")
    col_x0 = PLATE_BOX[2] + 70
    col_w = PAGE_W - 80 - col_x0
    font = fit_font(F_HEAD, max(TAGLINE, key=len), col_w - 40, 140)
    layers = []
    for text, cy in zip(TAGLINE, TAGLINE_Y):
        tw = int(font.getlength(text)) + 40
        th = font.size + 40
        img = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
        ImageDraw.Draw(img).text(
            (tw // 2, th // 2), text, font=font, fill=INK, anchor="mm"
        )
        layers.append((img, (col_x0 + (col_w - tw) // 2, cy - th // 2)))
    logger.debug("build_tagline_layers done size={}", font.size)
    return layers


def render_frame(t, page, logo, taglines, stamp, bg):
    """Render one frame of the closing at time t.

    Args:
        t: time in seconds.
        page: base RGBA page.
        logo: result of build_logo_layers.
        taglines: result of build_tagline_layers.
        stamp: RGBA image of the stamp.
        bg: RGB background.

    Returns:
        RGB frame at the final size.
    """
    logger.debug("render_frame t={:.3f}", t)
    pg = page.copy()

    # logo drawing itself: each pixel fades in around its normalized reveal time
    tn = (t - DRAW_START) / (DRAW_END - DRAW_START)
    vis = np.clip((tn - logo["reveal"]) / 0.06, 0, 1) * logo["alpha"]
    vis *= 0.96 + 0.04 * math.sin(t * 23)  # moving-plate flicker
    layer = np.zeros(vis.shape + (4,), np.uint8)
    layer[..., :3] = INK
    layer[..., 3] = (vis * 255).astype(np.uint8)
    pg.alpha_composite(Image.fromarray(layer), logo["pos"])

    # ink drop travelling along the dashed trajectory
    sp = (tn - 0.70) / 0.22
    if 0 < sp < 1.15:
        (ax, ay), (bx, by) = logo["path"]
        s = min(sp, 1)
        x, y = ax + (bx - ax) * s, ay + (by - ay) * s
        drop = Image.new("RGBA", pg.size, (0, 0, 0, 0))
        ImageDraw.Draw(drop).ellipse(
            [x - 12, y - 12, x + 12, y + 12], fill=INK + (230,)
        )
        pg.alpha_composite(
            drop.crop((int(x) - 30, int(y) - 30, int(x) + 30, int(y) + 30)),
            (int(x) - 30, int(y) - 30),
        )

    # tagline beats: ink bleeds in (blur shrinks while opacity rises)
    for (img, pos), t0 in zip(taglines, TAGLINE_TIMES):
        p = ease_out_cubic((t - t0) / 0.4)
        if p <= 0:
            continue
        lay = img.filter(ImageFilter.GaussianBlur(6 * (1 - p))) if p < 1 else img.copy()
        lay.putalpha(lay.split()[3].point(lambda a: int(a * p)))
        pg.alpha_composite(lay, pos)

    slam_stamp(pg, stamp, STAMP_POS, t - STAMP_AT)

    spin = ease_out_cubic(t / 1.0)
    angle = (1 - spin) * 900 + (-1.5 * spin)
    push = ease_out_cubic((t - 1.0) / 3.6) if t > 1.0 else 0
    scale = 0.03 + 0.83 * spin + 0.06 * push
    if 1.0 < t < 1.2:  # small impact bounce on landing
        scale *= 1 + 0.025 * math.sin((t - 1.0) / 0.2 * math.pi)
    ox, oy = 0.0, 0.0
    if STAMP_AT < t < STAMP_AT + 0.25:  # camera shake on stamp impact
        a = (STAMP_AT + 0.25 - t) / 0.25
        ox, oy = 14 * a * math.sin(t * 190), 10 * a * math.cos(t * 230)
    frame = place_page(pg, angle, scale, H / 2, ox, oy, bg, int(t * 1000) + 7)

    fade = ease_out_cubic((t - 4.6) / 0.4)
    if fade > 0:
        frame = Image.blend(frame, Image.new("RGB", frame.size, (0, 0, 0)), fade)
    return frame


def main(out_path):
    """Render all frames and encode the MP4 via ffmpeg.

    Args:
        out_path: path of the output MP4 file.

    Returns:
        None.
    """
    logger.info("main start out={}", out_path)
    page = build_page()
    logo = build_logo_layers()
    taglines = build_tagline_layers()
    stamp = build_stamp(STAMP_TEXT, 120, STAMP_GREEN)
    bg = build_background()
    n = int(FPS * DURATION)
    cmd = [
        "ffmpeg",
        "-y",
        "-loglevel",
        "error",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        "-s",
        f"{W}x{H}",
        "-r",
        str(FPS),
        "-i",
        "-",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-crf",
        "20",
        "-preset",
        "slow",
        "-movflags",
        "+faststart",
        out_path,
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    try:
        for i in range(n):
            proc.stdin.write(
                render_frame(i / FPS, page, logo, taglines, stamp, bg).tobytes()
            )
    except Exception:
        logger.exception("main frame render failed")
        raise
    finally:
        proc.stdin.close()
        proc.wait()
    if proc.returncode:
        logger.error("ffmpeg exit code={}", proc.returncode)
        raise SystemExit(proc.returncode)
    logger.info("main done frames={} out={}", n, out_path)


if __name__ == "__main__":
    logger.remove()
    logger.add(sys.stderr, level="INFO")
    main(sys.argv[1] if len(sys.argv) > 1 else "closing_moonwatch.mp4")
