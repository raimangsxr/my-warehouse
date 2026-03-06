from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DIR = ROOT / 'src' / 'public'
ICONS_DIR = PUBLIC_DIR / 'icons'

NAVY = '#0a1730'
NAVY_SOFT = '#123d6b'
STEEL = '#6d86ad'
STEEL_DARK = '#4d6b96'
CARD = '#f5f6f7'
WHITE = '#ffffff'
ORANGE = '#f28d2b'
ORANGE_LIGHT = '#f7a94a'
SHADOW = (8, 20, 43, 80)


def rounded_card(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], radius: int, fill: str) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def polygon(draw: ImageDraw.ImageDraw, points: list[tuple[float, float]], fill: str) -> None:
    draw.polygon([(int(x), int(y)) for x, y in points], fill=fill)


def line(draw: ImageDraw.ImageDraw, points: list[tuple[float, float]], fill: str, width: int) -> None:
    draw.line([(int(x), int(y)) for x, y in points], fill=fill, width=width, joint='curve')


def draw_house_icon(size: int, maskable: bool) -> Image.Image:
    image = Image.new('RGBA', (size, size), NAVY)
    shadow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)

    outer_margin = int(size * (0.08 if maskable else 0.1))
    card = (outer_margin, outer_margin, size - outer_margin, size - outer_margin)
    radius = int(size * 0.11)

    shadow_inset = int(size * 0.012)
    shadow_box = (card[0] + shadow_inset, card[1] + shadow_inset, card[2] + shadow_inset, card[3] + shadow_inset)
    rounded_card(shadow_draw, shadow_box, radius, '#08101d')
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=int(size * 0.03)))
    image.alpha_composite(shadow)

    draw = ImageDraw.Draw(image)
    rounded_card(draw, card, radius, CARD)

    tile_left, tile_top, tile_right, tile_bottom = card
    tile_w = tile_right - tile_left
    tile_h = tile_bottom - tile_top

    line_w = max(8, int(size * 0.03))
    house_left = tile_left + tile_w * 0.17
    house_right = tile_right - tile_w * 0.18
    house_top = tile_top + tile_h * 0.28
    house_base = tile_bottom - tile_h * 0.2
    roof_apex_x = tile_left + tile_w * 0.5
    roof_apex_y = tile_top + tile_h * 0.14

    line(draw, [(house_left, house_top), (roof_apex_x, roof_apex_y), (house_right, house_top)], NAVY_SOFT, line_w)
    line(draw, [(house_left + line_w // 2, house_top + line_w // 2), (house_left + line_w // 2, house_base)], NAVY_SOFT, line_w)
    line(draw, [(house_right - line_w // 2, house_top + line_w // 2), (house_right - line_w // 2, house_base)], STEEL, line_w)
    line(draw, [(house_left + line_w // 2, house_base), (house_right - line_w // 2, house_base)], STEEL, line_w)

    arrow = [
        (tile_left + tile_w * 0.42, tile_bottom - tile_h * 0.47),
        (tile_left + tile_w * 0.57, tile_bottom - tile_h * 0.62),
        (tile_left + tile_w * 0.54, tile_bottom - tile_h * 0.67),
        (tile_left + tile_w * 0.67, tile_bottom - tile_h * 0.8),
        (tile_left + tile_w * 0.61, tile_bottom - tile_h * 0.81),
        (tile_left + tile_w * 0.88, tile_top + tile_h * 0.18),
        (tile_left + tile_w * 0.84, tile_bottom - tile_h * 0.4),
        (tile_left + tile_w * 0.78, tile_bottom - tile_h * 0.34),
        (tile_left + tile_w * 0.76, tile_bottom - tile_h * 0.55),
        (tile_left + tile_w * 0.57, tile_bottom - tile_h * 0.36),
    ]
    polygon(draw, arrow, NAVY_SOFT)
    polygon(draw, [
        (tile_left + tile_w * 0.42, tile_bottom - tile_h * 0.47),
        (tile_left + tile_w * 0.57, tile_bottom - tile_h * 0.62),
        (tile_left + tile_w * 0.54, tile_bottom - tile_h * 0.67),
        (tile_left + tile_w * 0.68, tile_bottom - tile_h * 0.8),
        (tile_left + tile_w * 0.67, tile_bottom - tile_h * 0.73),
        (tile_left + tile_w * 0.53, tile_bottom - tile_h * 0.59),
        (tile_left + tile_w * 0.49, tile_bottom - tile_h * 0.63),
        (tile_left + tile_w * 0.36, tile_bottom - tile_h * 0.49),
    ], STEEL)

    mast_x = tile_left + tile_w * 0.36
    mast_top = tile_bottom - tile_h * 0.57
    mast_bottom = tile_bottom - tile_h * 0.2
    draw.rounded_rectangle((mast_x, mast_top, mast_x + tile_w * 0.03, mast_bottom), radius=int(size * 0.01), fill=NAVY_SOFT)

    body = (
        tile_left + tile_w * 0.25,
        tile_bottom - tile_h * 0.36,
        tile_left + tile_w * 0.45,
        tile_bottom - tile_h * 0.2,
    )
    draw.rounded_rectangle(body, radius=int(size * 0.025), fill=NAVY_SOFT)
    cabin = (
        tile_left + tile_w * 0.31,
        tile_bottom - tile_h * 0.5,
        tile_left + tile_w * 0.44,
        tile_bottom - tile_h * 0.36,
    )
    draw.rounded_rectangle(cabin, radius=int(size * 0.02), outline=NAVY_SOFT, width=max(4, int(size * 0.012)), fill=CARD)
    line(draw, [(tile_left + tile_w * 0.36, tile_bottom - tile_h * 0.49), (tile_left + tile_w * 0.37, tile_bottom - tile_h * 0.36)], NAVY_SOFT, max(4, int(size * 0.011)))
    line(draw, [(tile_left + tile_w * 0.43, tile_bottom - tile_h * 0.42), (tile_left + tile_w * 0.47, tile_bottom - tile_h * 0.4)], NAVY_SOFT, max(4, int(size * 0.01)))
    line(draw, [(tile_left + tile_w * 0.43, tile_bottom - tile_h * 0.42), (tile_left + tile_w * 0.45, tile_bottom - tile_h * 0.39)], NAVY_SOFT, max(4, int(size * 0.01)))

    fork_y = tile_bottom - tile_h * 0.23
    line(draw, [(tile_left + tile_w * 0.44, fork_y), (tile_left + tile_w * 0.69, fork_y)], NAVY_SOFT, max(5, int(size * 0.013)))

    wheel_r = int(size * 0.038)
    for cx in (tile_left + tile_w * 0.31, tile_left + tile_w * 0.48):
        cy = tile_bottom - tile_h * 0.2
        draw.ellipse((cx - wheel_r, cy - wheel_r, cx + wheel_r, cy + wheel_r), fill=WHITE, outline=NAVY_SOFT, width=max(4, int(size * 0.01)))
        inner = int(wheel_r * 0.42)
        draw.ellipse((cx - inner, cy - inner, cx + inner, cy + inner), fill=NAVY_SOFT)

    box_size = tile_w * 0.09
    box_gap = tile_w * 0.012
    box_x = tile_left + tile_w * 0.55
    box_y = tile_bottom - tile_h * 0.39
    draw.rectangle((box_x, box_y, box_x + box_size, box_y + box_size), fill=ORANGE)
    draw.rectangle((box_x + box_size + box_gap, box_y + box_size + box_gap, box_x + 2 * box_size + box_gap, box_y + 2 * box_size + box_gap), fill=ORANGE)
    draw.rectangle((box_x, box_y + box_size + box_gap, box_x + box_size, box_y + 2 * box_size + box_gap), fill=ORANGE_LIGHT)
    draw.rectangle((box_x + box_size + box_gap, box_y + box_size + box_gap, box_x + 2 * box_size + box_gap, box_y + 2 * box_size + box_gap), fill=ORANGE)

    return image


def write_assets() -> None:
    ICONS_DIR.mkdir(parents=True, exist_ok=True)

    regular_1024 = draw_house_icon(1024, maskable=False)
    maskable_1024 = draw_house_icon(1024, maskable=True)

    regular_1024.resize((512, 512), Image.LANCZOS).save(ICONS_DIR / 'icon-512x512.png', format='PNG')
    regular_1024.resize((192, 192), Image.LANCZOS).save(ICONS_DIR / 'icon-192x192.png', format='PNG')
    maskable_1024.resize((512, 512), Image.LANCZOS).save(ICONS_DIR / 'icon-maskable-512x512.png', format='PNG')
    maskable_1024.resize((192, 192), Image.LANCZOS).save(ICONS_DIR / 'icon-maskable-192x192.png', format='PNG')
    regular_1024.resize((180, 180), Image.LANCZOS).save(PUBLIC_DIR / 'apple-touch-icon.png', format='PNG')
    regular_1024.resize((512, 512), Image.LANCZOS).save(ICONS_DIR / 'icon-source.png', format='PNG')
    regular_1024.resize((48, 48), Image.LANCZOS).save(
        PUBLIC_DIR / 'favicon.ico',
        format='ICO',
        sizes=[(16, 16), (32, 32), (48, 48)],
    )


if __name__ == '__main__':
    write_assets()
