"""Generate the extension icons (a cream cross on a burgundy disc) with the standard library only.
Run: python3 tools/make-icons.py   (writes extension/icons/icon{16,32,48,128}.png)"""
import struct, zlib, os

BURGUNDY = (122, 31, 43, 255)
CREAM = (244, 230, 227, 255)
CLEAR = (0, 0, 0, 0)


def png(size):
    rows = []
    c = (size - 1) / 2
    r = size / 2 - 0.5
    arm = size * 0.09          # half thickness of the cross bars
    long_up, long_down = size * 0.30, size * 0.30
    for y in range(size):
        row = bytearray([0])   # filter type 0
        for x in range(size):
            dx, dy = x - c, y - c
            inside = dx * dx + dy * dy <= r * r
            px = CLEAR
            if inside:
                px = BURGUNDY
                vertical = abs(dx) <= arm and -long_up <= dy <= long_down
                # the horizontal bar sits a little above the middle, like a Latin cross
                horizontal = abs(dy + size * 0.07) <= arm and abs(dx) <= size * 0.20
                if vertical or horizontal:
                    px = CREAM
            row.extend(px)
        rows.append(bytes(row))
    raw = b''.join(rows)

    def chunk(tag, data):
        body = tag + data
        return struct.pack('>I', len(data)) + body + struct.pack('>I', zlib.crc32(body) & 0xffffffff)

    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')


out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'extension', 'icons')
os.makedirs(out, exist_ok=True)
for s in (16, 32, 48, 128):
    with open(os.path.join(out, f'icon{s}.png'), 'wb') as f:
        f.write(png(s))
print('icons written to', os.path.normpath(out))
