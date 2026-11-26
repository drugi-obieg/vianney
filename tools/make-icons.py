"""Render the icons from the bust in assets/vianney-bust.png (needs ImageMagick: `magick`).

The bust is a black-and-white cut of the well-known portrait of St. Jean-Marie Vianney (public domain, via Wikimedia
Commons: https://commons.wikimedia.org/wiki/File:Jean-Marie_Vianney.png). The outline of head and shoulders was traced by hand
(assets/vianney-bust-outline.png is that outline alone, as a plain silhouette); inside it the picture is cut to two tones, so that
the dark stole, the eyes and the smile stay. White on a black rounded square, in the way macOS draws its app icons.

Run: python3 tools/make-icons.py
Writes extension/icons/icon{16,32,48,128}.png and assets/{icon-512,apple-touch-icon,favicon-32}.png
"""
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BUST = ROOT / 'assets' / 'vianney-bust.png'     # 500 x 739, white figure on black


def render(size: int, out: Path, scale: float = 1.0, top: float = 0.085, radius: float = 0.225) -> None:   # scale > 1: the shoulders run off the sides
    w = round(size * scale)
    r = size * radius
    cmd = [
        'magick', '-size', f'{size}x{size}', 'xc:black',
        '(', str(BUST), '-colorspace', 'Gray', '-filter', 'Lanczos', '-resize', f'{w}x', ')',
        '-gravity', 'north', '-geometry', f'+0+{round(size * top)}', '-compose', 'Lighten', '-composite', '-crop', f'{size}x{size}+0+0', '+repage',
        '-alpha', 'set',
        '(', '-size', f'{size}x{size}', 'xc:none', '-fill', 'white', '-draw', f'roundrectangle 0,0 {size - 1},{size - 1} {r},{r}', ')',
        '-compose', 'DstIn', '-composite',
        '-define', 'png:compression-level=9', str(out),
    ]
    subprocess.run(cmd, check=True)


if __name__ == '__main__':
    for s in (16, 32, 48, 128):
        render(s, ROOT / 'extension' / 'icons' / f'icon{s}.png')
    render(512, ROOT / 'assets' / 'icon-512.png')
    render(180, ROOT / 'assets' / 'apple-touch-icon.png')
    render(32, ROOT / 'assets' / 'favicon-32.png')
    print('icons written')
