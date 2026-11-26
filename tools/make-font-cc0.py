"""Write the CC0 build of Calmet UI that the site and the extension ship: the traced letters and nothing else.

Calmet UI is traced from the scans of the 1732 print of Calmet's commentary. The font's own project also makes an EXTENDED build, which grafts
accents, symbols and spaces from Source Serif 4 (Adobe, SIL OFL 1.1) onto the traced letters; that build is under the OFL. This script takes
the two UNEXTENDED files of that project (CalmetUI-Regular.src.ttf, CalmetUI-Italic.src.ttf: about 100 code points, no glyph of another font)
and only rewrites their name tables: the licence lines say CC0 1.0 Universal, the version is 0.2.

Run:  python3 tools/make-font-cc0.py DIR_WITH_THE_SRC_FILES      (needs fontTools: pip install fonttools)
Writes assets/fonts/CalmetUI-{Regular,Italic}.ttf and the same two files into extension/src/options/fonts/.
A character that is not in the font (for example %, +, the middle dot, é) is set by the next font of the CSS font stack.
"""
import os
import shutil
import sys

from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGETS = [os.path.join(ROOT, 'assets', 'fonts'), os.path.join(ROOT, 'extension', 'src', 'options', 'fonts')]
COPYRIGHT = ('Calmet UI: the 1732 Calmet type traced from its scans, with composed umlauts, sharp s and UI metrics. '
             'Dedicated to the public domain under CC0 1.0 Universal.')
LICENSE = 'CC0 1.0 Universal: dedicated to the public domain; no rights reserved.'
LICENSE_URL = 'https://creativecommons.org/publicdomain/zero/1.0/'
VERSION = 0.2


def build(src, out, style):
    font = TTFont(src)
    name = font['name']
    # the traced face: no glyph from any other font may be in it
    assert len(font.getGlyphOrder()) < 140, f'{src}: more glyphs than the traced face has'
    for rec in list(name.names):
        if rec.nameID in (0, 3, 5, 13, 14):
            name.removeNames(nameID=rec.nameID)
    for platform, enc, lang in ((3, 1, 0x409), (1, 0, 0)):
        name.setName(COPYRIGHT, 0, platform, enc, lang)
        name.setName(f'CalmetUI-{style};CC0 build', 3, platform, enc, lang)
        name.setName(f'Version {VERSION}', 5, platform, enc, lang)
        name.setName(LICENSE, 13, platform, enc, lang)
        name.setName(LICENSE_URL, 14, platform, enc, lang)
    font['head'].fontRevision = VERSION
    font.save(out)
    return len(font.getBestCmap())


def main():
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    here = sys.argv[1]
    for style in ('Regular', 'Italic'):
        src = os.path.join(here, f'CalmetUI-{style}.src.ttf')
        first = os.path.join(TARGETS[0], f'CalmetUI-{style}.ttf')
        n = build(src, first, style)
        for target in TARGETS[1:]:
            shutil.copyfile(first, os.path.join(target, f'CalmetUI-{style}.ttf'))
        print(f'{style}: {n} code points, {os.path.getsize(first):,} bytes')


if __name__ == '__main__':
    main()
