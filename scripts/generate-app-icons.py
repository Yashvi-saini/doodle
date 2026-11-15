"""Draws the Doodle logo and writes the app icon set.

Usage (needs Pillow: pip install pillow):
    python scripts/generate-app-icons.py apps/mobile/assets

Writes icon.png (1024, iOS and legacy Android), adaptive-icon.png (Android adaptive icon
foreground, kept inside the central safe zone) and logo.png (in-app logo, transparent).
Shapes are drawn at 4x and downsampled for anti-aliasing.
"""

import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw

INK = (27, 27, 31, 255)
ORANGE = (255, 90, 54, 255)
CREAM = (244, 241, 234, 255)
WHITE = (255, 255, 255, 255)
YELLOW = (253, 216, 53, 255)
PINK = (236, 64, 122, 255)
WOOD = (255, 214, 165, 255)

SS = 4  # supersampling factor


def thick_polyline(draw, points, width, fill):
    """Polyline with round joins and caps."""
    draw.line(points, fill=fill, width=width, joint="curve")
    r = width / 2
    for x, y in (points[0], points[-1]):
        draw.ellipse((x - r, y - r, x + r, y + r), fill=fill)


def arc_points(cx, cy, rx, ry, start_deg, end_deg, steps=48, wobble=0.0):
    pts = []
    for i in range(steps + 1):
        t = math.radians(start_deg + (end_deg - start_deg) * i / steps)
        w = 1 + wobble * (math.sin(3 * t + 0.6) + 0.6 * math.cos(5 * t))
        pts.append((cx + rx * w * math.cos(t), cy + ry * w * math.sin(t)))
    return pts


MARK_CENTRE = (575, 492)


def centred(scale):
    return (-(MARK_CENTRE[0] - 500) * scale, -(MARK_CENTRE[1] - 500) * scale)


def draw_mark(size, scale, offset=None):
    """The logo mark (card + smiley + pencil) on a transparent canvas of `size` (at 1x)."""
    offset = centred(scale) if offset is None else offset
    S = size * SS
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    def p(x, y):
        # Design space is 1000x1000 centred on (500, 500).
        return (
            (500 + (x - 500) * scale + offset[0]) * S / 1000,
            (500 + (y - 500) * scale + offset[1]) * S / 1000,
        )

    def px(v):
        return v * scale * S / 1000

    border = px(30)
    radius = px(70)
    shadow = px(34)

    # Card: hard offset shadow, then white card with ink border.
    x0, y0, x1, y1 = 190, 215, 770, 735
    a, b = p(x0, y0), p(x1, y1)
    d.rounded_rectangle((a[0] + shadow, a[1] + shadow, b[0] + shadow, b[1] + shadow), radius, fill=INK)
    d.rounded_rectangle((*a, *b), radius, fill=WHITE, outline=INK, width=round(border))

    # Smiley, slightly hand-drawn: wobbly head, dot eyes, big grin.
    # Draw the head as a filled ring (outer ink, inner white) so the outline has clean edges.
    hc, stroke = p(470, 470), px(30)
    outer = arc_points(*hc, px(165) + stroke / 2, px(158) + stroke / 2, 0, 360, steps=240, wobble=0.018)
    inner = arc_points(*hc, px(165) - stroke / 2, px(158) - stroke / 2, 0, 360, steps=240, wobble=0.018)
    d.polygon(outer, fill=INK)
    d.polygon(inner, fill=WHITE)
    for ex in (412, 528):
        c = p(ex, 425)
        r = px(26)
        d.ellipse((c[0] - r, c[1] - r * 1.25, c[0] + r, c[1] + r * 1.25), fill=INK)
    grin = arc_points(*p(470, 492), px(98), px(72), 18, 162, steps=40)
    thick_polyline(d, grin, round(px(30)), ORANGE)

    # Pencil, tip touching the card's lower right, body heading off to the upper right.
    angle = math.radians(-50)
    ux, uy = math.cos(angle), math.sin(angle)  # along the pencil, tip -> end
    nx, ny = -uy, ux  # across the pencil
    tip = (640, 690)
    half_w = 52
    lengths = {"tip": 0, "wood": 105, "body": 320, "band": 372, "eraser": 440}

    def along(dist, side):
        x = tip[0] + ux * dist + nx * half_w * side
        y = tip[1] + uy * dist + ny * half_w * side
        return p(x, y)

    def quad(d0, d1, fill):
        pts = [along(d0, -1), along(d1, -1), along(d1, 1), along(d0, 1)]
        d.polygon(pts, fill=fill, outline=INK, width=round(px(24)))
        return pts

    quad(lengths["band"], lengths["eraser"], PINK)
    quad(lengths["body"], lengths["band"], (200, 200, 205, 255))
    quad(lengths["wood"], lengths["body"], YELLOW)
    # Sharpened wood cone and graphite tip.
    cone = [p(*tip), along(lengths["wood"], -1), along(lengths["wood"], 1)]
    d.polygon(cone, fill=WOOD, outline=INK, width=round(px(24)))
    lead = 0.36
    graphite = [p(*tip), along(lengths["wood"] * lead, -lead), along(lengths["wood"] * lead, lead)]
    d.polygon(graphite, fill=INK)

    return img.resize((size, size), Image.LANCZOS)


def full_icon(size):
    """Square icon: orange background with the mark (iOS / legacy Android / web)."""
    bg = Image.new("RGBA", (size, size), ORANGE)
    bg.alpha_composite(draw_mark(size, scale=0.92))
    return bg


def main(out_dir: Path):
    out_dir.mkdir(parents=True, exist_ok=True)
    full_icon(1024).save(out_dir / "icon.png")
    # Adaptive foreground: content must stay inside the central ~66% safe zone.
    draw_mark(1024, scale=0.68).save(out_dir / "adaptive-icon.png")
    # In-app logo: just the mark, tightly framed, on transparent.
    draw_mark(512, scale=1.12).save(out_dir / "logo.png")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
