"""Generate the HOOK video (5 s) with a wizarding-newspaper theme (parchment, moving photograph).

Usage:
    python3 docs/video/hook_newspaper.py [output.mp4]

Timeline:
    0.0–1.3 s  newspaper spins onto the screen ("spinning newspaper")
    1.3–5.0 s  slow push-in on the headline; the Moon spins inside the photo
    2.3–2.9 s  red underline on "MONTHS OF WAITING"
    3.3 s      stamp "AND MILLIONS LOST." with camera shake

Fonts: UnifrakturMaguntia and IM Fell English (SIL OFL, in docs/video/fonts/).
Moon texture: NASA SVS CGI Moon Kit (site/shared/vendor/moon-2k.jpg).
"""

import math
import subprocess
import sys
from pathlib import Path

import numpy as np
from loguru import logger
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1920, 1080
FPS = 30
DURATION = 5.0
PAGE_W, PAGE_H = 2000, 1400
PAPER = (222, 202, 160)
INK = (42, 28, 16)
RED = (150, 18, 22)

HERE = Path(__file__).resolve().parent
FONTS = HERE / "fonts"
F_MAST = str(FONTS / "UnifrakturMaguntia-Book.ttf")
F_HEAD = str(FONTS / "IMFeENsc28P.ttf")
F_ITAL = str(FONTS / "IMFeENit28P.ttf")
F_BODY = str(FONTS / "IMFeENrm28P.ttf")
MOON_TEXTURE = HERE.parents[1] / "site/shared/vendor/moon-2k.jpg"

MASTHEAD = "The Lunar Gazette"
KICKER = "At the Lunar South Pole,"
HEAD_1 = "A FOUR-DAY LAUNCH SLIP"
HEAD_2 = "CAN MEAN MONTHS OF WAITING,"
STAMP = "AND MILLIONS LOST."
UNDERLINE_WORDS = "MONTHS OF WAITING,"

PHOTO_BOX = (80, 800, 840, 1280)  # x0, y0, x1, y1 on the page
MOON_VIEW_LAT = math.radians(-58)  # tilt the globe so the south pole faces the reader
MOON_SPIN = 0.12  # rad/s, the "moving photograph"

FILLER = (
    "Mission planners at the lunar south pole work against a narrow clock. "
    "Sunlight grazes the crater rims at low angles, and the windows when a lander "
    "can see both the Sun and the Earth open and close within days. Miss one, and "
    "the next acceptable alignment may be weeks or months away, while crews, "
    "contracts and ground stations keep billing. Engineers call it the cost of "
    "a slip. "
)


def ease_out_cubic(t):
    """Cubic ease-out curve.

    Args:
        t: normalized progress between 0 and 1.

    Returns:
        Eased progress between 0 and 1.
    """
    t = min(max(t, 0.0), 1.0)
    return 1 - (1 - t) ** 3


def fit_font(path, text, max_w, start=220):
    """Find the largest font size at which the text fits the width.

    Args:
        path: path to the font file.
        text: text to measure.
        max_w: maximum width in pixels.
        start: starting size of the search.

    Returns:
        ImageFont.FreeTypeFont at the largest size that fits.
    """
    logger.debug("fit_font text={!r} max_w={}", text, max_w)
    size = start
    font = ImageFont.truetype(path, size)
    while font.getlength(text) > max_w and size > 10:
        size -= 2
        font = ImageFont.truetype(path, size)
    logger.debug("fit_font size={}", size)
    return font


def build_moon_maps(w, h):
    """Precompute the orthographic projection of the lunar sphere for the photo.

    Args:
        w: photo width.
        h: photo height.

    Returns:
        Dict with texture, base texture coordinates, shading, mask and stars.
    """
    logger.debug("build_moon_maps w={} h={}", w, h)
    tex = np.asarray(Image.open(MOON_TEXTURE).convert("L")).astype(np.float32)
    th, tw = tex.shape
    r = h * 0.44
    cx, cy = w / 2, h / 2 + 10
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    x, y = (xx - cx) / r, (cy - yy) / r
    rho2 = x * x + y * y
    mask = rho2 <= 1
    z = np.sqrt(np.clip(1 - rho2, 0, 1))
    s, c = math.sin(MOON_VIEW_LAT), math.cos(MOON_VIEW_LAT)
    lat = np.arcsin(np.clip(y * c + z * s, -1, 1))
    lon = np.arctan2(x, z * c - y * s)
    u0 = (lon + math.pi) / (2 * math.pi) * tw
    v = np.clip((math.pi / 2 - lat) / math.pi * th, 0, th - 1).astype(np.int32)
    sun = np.array([-0.75, 0.35, 0.55])
    sun /= np.linalg.norm(sun)
    shade = np.clip(x * sun[0] + y * sun[1] + z * sun[2], 0, 1) ** 0.7 * 1.15 + 0.04
    edge = np.clip((1 - np.sqrt(rho2)) * r / 2.0, 0, 1)  # 2 px anti-aliased limb
    rng = np.random.default_rng(11)
    stars = np.zeros((h, w), np.float32)
    idx = rng.integers(0, h * w, 260)
    stars.flat[idx] = rng.uniform(80, 230, 260)
    stars = (
        np.asarray(
            Image.fromarray(stars.astype(np.uint8)).filter(
                ImageFilter.GaussianBlur(0.7)
            )
        )
        * 2.5
    )
    logger.debug("build_moon_maps done tex={}x{}", tw, th)
    return {
        "tex": tex,
        "tw": tw,
        "u0": u0,
        "v": v,
        "shade": shade,
        "edge": edge * mask,
        "stars": stars,
    }


def render_moon_photo(maps, t):
    """Render the "moving photograph": spinning Moon, in sepia, with flicker.

    Args:
        maps: result of build_moon_maps.
        t: time in seconds.

    Returns:
        RGB image of the photo.
    """
    logger.debug("render_moon_photo t={:.3f}", t)
    shift = MOON_SPIN * t / (2 * math.pi) * maps["tw"]
    u = ((maps["u0"] + shift) % maps["tw"]).astype(np.int32)
    moon = maps["tex"][maps["v"], u] * maps["shade"]
    lum = moon * maps["edge"] + maps["stars"] * (1 - maps["edge"])
    lum *= 0.97 + 0.03 * math.sin(t * 23)  # old-film flicker
    h, w = lum.shape
    yy, xx = np.mgrid[0:h, 0:w]
    vign = 1 - 0.45 * (((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2)
    lum = np.clip(lum * vign, 0, 255) / 255.0
    sepia = np.stack([lum * 255 * 1.0 + 22, lum * 225 + 14, lum * 170 + 6], -1)
    logger.debug("render_moon_photo done")
    return Image.fromarray(np.clip(sepia, 0, 255).astype(np.uint8))


def draw_crescent(d, cx, cy, r, color, bg):
    """Draw a crescent-moon emblem with stars.

    Args:
        d: target ImageDraw.
        cx: center x.
        cy: center y.
        r: radius.
        color: ink color.
        bg: background color (to cut out the crescent).

    Returns:
        None.
    """
    logger.debug("draw_crescent at ({}, {})", cx, cy)
    d.ellipse(
        [cx - r - 14, cy - r - 14, cx + r + 14, cy + r + 14], outline=color, width=3
    )
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)
    o = r * 0.45
    d.ellipse([cx - r + o, cy - r - o * 0.3, cx + r + o, cy + r - o * 0.3], fill=bg)
    for sx, sy, sr in ((0.55, -0.35, 9), (0.75, 0.25, 6), (0.35, 0.5, 5)):
        px, py = cx + sx * r, cy + sy * r
        pts = [
            (
                px + sr * math.cos(a) * (1 if i % 2 == 0 else 0.4),
                py + sr * math.sin(a) * (1 if i % 2 == 0 else 0.4),
            )
            for i, a in enumerate(np.linspace(0, 2 * math.pi, 9)[:-1] - math.pi / 2)
        ]
        d.polygon(pts, fill=color)


def ornate_rule(d, y, x0, x1, color):
    """Draw a thick-thin ornamental rule with a central diamond.

    Args:
        d: target ImageDraw.
        y: vertical position.
        x0: horizontal start.
        x1: horizontal end.
        color: ink color.

    Returns:
        None.
    """
    logger.debug("ornate_rule y={}", y)
    mid = (x0 + x1) // 2
    d.line([x0, y, x1, y], fill=color, width=6)
    d.line([x0, y + 12, x1, y + 12], fill=color, width=2)
    d.line([x0, y - 10, x1, y - 10], fill=color, width=2)
    d.polygon(
        [(mid - 26, y + 1), (mid, y - 18), (mid + 26, y + 1), (mid, y + 20)], fill=color
    )
    d.polygon(
        [(mid - 12, y + 1), (mid, y - 8), (mid + 12, y + 1), (mid, y + 10)], fill=PAPER
    )


def age_parchment(page):
    """Age the paper: stains, coffee rings, burnt edges and grain.

    Args:
        page: RGB image of the page.

    Returns:
        Aged RGBA image.
    """
    logger.debug("age_parchment start")
    rng = np.random.default_rng(5)
    arr = np.asarray(page).astype(np.float32)
    blotch = Image.fromarray((rng.random((6, 9)) * 255).astype(np.uint8))
    blotch = (
        np.asarray(blotch.resize((PAGE_W, PAGE_H), Image.BICUBIC)).astype(np.float32)
        / 255
    )
    arr *= (0.92 + 0.09 * blotch)[..., None]
    rings = Image.new("L", (PAGE_W, PAGE_H), 0)
    rd = ImageDraw.Draw(rings)
    for cx, cy, rr in ((1720, 1180, 120), (1640, 260, 70)):
        rd.ellipse([cx - rr, cy - rr, cx + rr, cy + rr * 0.92], outline=90, width=7)
    rings = (
        np.asarray(rings.filter(ImageFilter.GaussianBlur(4))).astype(np.float32) / 255
    )
    arr *= (1 - 0.35 * rings)[..., None]
    yy, xx = np.mgrid[0:PAGE_H, 0:PAGE_W]
    edge = np.maximum(
        np.abs(xx - PAGE_W / 2) / (PAGE_W / 2), np.abs(yy - PAGE_H / 2) / (PAGE_H / 2)
    )
    rough = (
        np.asarray(
            Image.fromarray((rng.random((60, 90)) * 255).astype(np.uint8)).resize(
                (PAGE_W, PAGE_H), Image.BICUBIC
            )
        ).astype(np.float32)
        / 255
    )
    burn = np.clip((edge + rough * 0.06 - 0.86) / 0.14, 0, 1) ** 1.6
    arr *= (1 - 0.6 * burn)[..., None]
    arr += rng.integers(-12, 12, (PAGE_H, PAGE_W, 1))
    logger.debug("age_parchment done")
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).convert("RGBA")


def build_page():
    """Build the newspaper front page (without the photo and without animations).

    Returns:
        Tuple (RGBA page, underline box (x0, y, x1), stamp center (x, y)).
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
    mast = fit_font(F_MAST, MASTHEAD, inner - 560, 190)
    d.text((PAGE_W // 2, 118), MASTHEAD, font=mast, fill=INK, anchor="mm")

    y = 225
    ornate_rule(d, y, m, PAGE_W - m, INK)
    d.text(
        (PAGE_W // 2, y + 42),
        "Sunday, November 15, 2026   ~   Shackleton Rim Bureau   ~   Price: One Moonstone",
        font=ImageFont.truetype(F_ITAL, 32),
        fill=INK,
        anchor="mm",
    )
    d.line([m, y + 70, PAGE_W - m, y + 70], fill=INK, width=2)

    d.text(
        (PAGE_W // 2, 355),
        KICKER,
        font=ImageFont.truetype(F_ITAL, 80),
        fill=INK,
        anchor="mm",
    )
    f1 = fit_font(F_HEAD, HEAD_1, inner)
    d.text((PAGE_W // 2, 490), HEAD_1, font=f1, fill=INK, anchor="mm")
    f2 = fit_font(F_HEAD, HEAD_2, inner)
    d.text((PAGE_W // 2, 650), HEAD_2, font=f2, fill=INK, anchor="mm")

    line_x0 = PAGE_W // 2 - f2.getlength(HEAD_2) / 2
    pre = HEAD_2[: -len(UNDERLINE_WORDS)]
    ul = (
        int(line_x0 + f2.getlength(pre)),
        650 + f2.size // 2,
        int(line_x0 + f2.getlength(HEAD_2)),
    )

    top = PHOTO_BOX[1]
    ornate_rule(d, top - 40, m, PAGE_W - m, INK)
    x0, y0, x1, y1 = PHOTO_BOX
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
        ((x0 + x1) // 2, y1 + 50),
        "The south pole turns in the moving plate: the light window lasts only days.",
        font=ImageFont.truetype(F_ITAL, 27),
        fill=INK,
        anchor="mm",
    )

    body = ImageFont.truetype(F_BODY, 29)
    col_gap = 44
    col_x = x1 + 14 + col_gap
    col_w = (PAGE_W - m - col_x - col_gap) // 2
    words = (FILLER * 6).split()
    drop = ImageFont.truetype(F_MAST, 120)
    first_word = words.pop(0)
    d.text((col_x, top - 18), first_word[0], font=drop, fill=INK)
    words.insert(0, first_word[1:])
    for c in range(2):
        x = col_x + c * (col_w + col_gap)
        if c:
            d.line(
                [x - col_gap // 2, top, x - col_gap // 2, PAGE_H - 80],
                fill=INK,
                width=2,
            )
        ly = top
        while ly < PAGE_H - 110:
            indent = 100 if (c == 0 and ly < top + 110) else 0
            line = ""
            while words and body.getlength(line + words[0]) < col_w - indent:
                line += words.pop(0) + " "
            d.text((x + indent, ly), line, font=body, fill=INK)
            ly += 38

    page = age_parchment(page)
    logger.info("build_page done underline={}", ul)
    return page, ul, (PAGE_W // 2, 640)


def build_stamp(text=STAMP, size=130, color=RED):
    """Draw the red stamp with a patchy-ink texture.

    Args:
        text: stamp text.
        size: font size.
        color: RGB ink color.

    Returns:
        RGBA image of the already rotated stamp.
    """
    logger.debug("build_stamp start text={!r}", text)
    font = ImageFont.truetype(F_HEAD, size)
    tw = int(font.getlength(text))
    sw, sh = tw + 120, 250
    img = Image.new("RGBA", (sw, sh), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([10, 10, sw - 10, sh - 10], 24, outline=color, width=14)
    d.rounded_rectangle([34, 34, sw - 34, sh - 34], 14, outline=color, width=4)
    d.text((sw // 2, sh // 2 + 4), text, font=font, fill=color, anchor="mm")
    alpha = np.asarray(img.split()[3]).astype(np.float32)
    noise = np.random.default_rng(3).random(alpha.shape)
    alpha *= np.where(noise < 0.12, 0.4, 1.0)
    img.putalpha(
        Image.fromarray(alpha.astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    )
    img = img.rotate(-7, resample=Image.BICUBIC, expand=True)
    logger.debug("build_stamp done size={}", img.size)
    return img


def build_background():
    """Create the warm dark background (candlelight) with a radial vignette.

    Returns:
        RGB image of the background.
    """
    logger.debug("build_background start")
    yy, xx = np.mgrid[0:H, 0:W]
    r = np.hypot((xx - W / 2) / (W / 2), (yy - H / 2) / (H / 2))
    v = np.clip(1 - r * 0.75, 0, 1)[..., None]
    arr = np.array([18, 12, 8]) + v * np.array([70, 46, 26])
    logger.debug("build_background done")
    return Image.fromarray(arr.astype(np.uint8))


def render_frame(t, page, ul, stamp_xy, stamp, bg, moon_maps):
    """Render one video frame at time t.

    Args:
        t: time in seconds.
        page: base RGBA page.
        ul: underline box (x0, y, x1).
        stamp_xy: stamp center on the page.
        stamp: RGBA image of the stamp.
        bg: RGB background.
        moon_maps: precomputed maps of the Moon photo.

    Returns:
        RGB frame at the final size.
    """
    logger.debug("render_frame t={:.3f}", t)
    pg = page.copy()
    pg.paste(render_moon_photo(moon_maps, t), PHOTO_BOX[:2])
    d = ImageDraw.Draw(pg)

    p = ease_out_cubic((t - 2.3) / 0.6)
    if p > 0:
        x0, y, x1 = ul
        xe = x0 + (x1 - x0) * p
        d.line([x0, y + 14, xe, y + 6], fill=RED, width=14)

    slam_stamp(pg, stamp, (stamp_xy[0], stamp_xy[1] + 330), t - 3.3)

    spin = ease_out_cubic(t / 1.3)
    angle = (1 - spin) * 900 + (-2.5 * spin)
    push = ease_out_cubic((t - 1.3) / 3.7) if t > 1.3 else 0
    scale = 0.03 + 0.83 * spin + 0.09 * push
    if 1.3 < t < 1.5:  # small impact bounce on landing
        scale *= 1 + 0.025 * math.sin((t - 1.3) / 0.2 * math.pi)
    ox, oy = 0.0, 0.0
    if 3.3 < t < 3.55:  # camera shake on stamp impact
        a = (3.55 - t) / 0.25
        ox, oy = 14 * a * math.sin(t * 190), 10 * a * math.cos(t * 230)

    cy = H / 2 - push * 70 * scale  # drift up so the headline gets centered
    return place_page(pg, angle, scale, cy, ox, oy, bg, int(t * 1000))


def slam_stamp(pg, stamp, center, ts):
    """Slam the stamp onto the page (scale 2.4 -> 1 in 0.15 s).

    Args:
        pg: RGBA page (modified in place).
        stamp: RGBA image of the stamp.
        center: stamp center (x, y) on the page.
        ts: time since impact in seconds (<= 0 draws nothing).

    Returns:
        None.
    """
    logger.debug("slam_stamp ts={:.3f}", ts)
    if ts <= 0:
        return
    k = 1 + 1.4 * (1 - ease_out_cubic(ts / 0.15))
    st = stamp.resize((int(stamp.width * k), int(stamp.height * k)), Image.BICUBIC)
    if ts < 0.15:
        st.putalpha(st.split()[3].point(lambda a: int(a * min(1, ts / 0.08 + 0.2))))
    pg.alpha_composite(st, (center[0] - st.width // 2, center[1] - st.height // 2))


def place_page(pg, angle, scale, cy, ox, oy, bg, seed):
    """Place the page on screen: scale, rotation, shadow, shake and film grain.

    Args:
        pg: RGBA page with animations already applied.
        angle: rotation in degrees.
        scale: relative page scale.
        cy: vertical center on screen.
        ox: horizontal offset (shake).
        oy: vertical offset (shake).
        bg: RGB background.
        seed: film grain seed.

    Returns:
        RGB frame at the final size.
    """
    logger.debug("place_page angle={:.1f} scale={:.3f}", angle, scale)
    sw, sh = max(2, int(PAGE_W * scale * 0.9)), max(2, int(PAGE_H * scale * 0.9))
    pg = pg.resize((sw, sh), Image.LANCZOS)
    shadow = Image.new("RGBA", (sw + 120, sh + 120), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rectangle([60, 60, sw + 60, sh + 60], fill=(0, 0, 0, 170))
    shadow = shadow.filter(ImageFilter.GaussianBlur(28))

    frame = bg.copy()
    rot_shadow = shadow.rotate(angle, resample=Image.BICUBIC, expand=True)
    rot_page = pg.rotate(angle, resample=Image.BICUBIC, expand=True)
    frame.paste(
        rot_shadow,
        (
            int(W / 2 - rot_shadow.width / 2 + 18 + ox),
            int(cy - rot_shadow.height / 2 + 26 + oy),
        ),
        rot_shadow,
    )
    frame.paste(
        rot_page,
        (int(W / 2 - rot_page.width / 2 + ox), int(cy - rot_page.height / 2 + oy)),
        rot_page,
    )

    arr = np.asarray(frame).astype(np.int16)
    arr += np.random.default_rng(seed).integers(-6, 6, (H, W, 1))
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


def main(out_path):
    """Render all frames and encode the MP4 via ffmpeg.

    Args:
        out_path: path of the output MP4 file.

    Returns:
        None.
    """
    logger.info("main start out={}", out_path)
    page, ul, stamp_xy = build_page()
    stamp = build_stamp()
    bg = build_background()
    moon_maps = build_moon_maps(
        PHOTO_BOX[2] - PHOTO_BOX[0], PHOTO_BOX[3] - PHOTO_BOX[1]
    )
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
                render_frame(
                    i / FPS, page, ul, stamp_xy, stamp, bg, moon_maps
                ).tobytes()
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
    main(sys.argv[1] if len(sys.argv) > 1 else "hook_newspaper.mp4")
