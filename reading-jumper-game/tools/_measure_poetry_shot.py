from PIL import Image
import numpy as np

shot = Image.open(
    r'C:\Users\xinzh\.cursor\projects\e-angsa-angsa-data\assets\c__Users_xinzh_AppData_Roaming_Cursor_User_workspaceStorage_3946ec0a649563de99ff9bb62eb64bd2_images_image-c02eef5c-454e-426d-9328-41f200810eab.png'
).convert('RGB')
sw, sh = shot.size
print('shot', sw, sh)
sa = np.array(shot)

# Assume letterbox or stretch to 1440x810 — check aspect
print('aspect shot', sw / sh, 'design', 1440 / 810)
# stretch mapping
sx, sy = 1440 / sw, 810 / sh


def to_design(x, y):
    return x * sx, y * sy


def to_cocos_pt(dx, dy):
    return round(dx - 720, 2), round(405 - dy, 2)


# Find near-white horizontal bars (rank + review)
white = np.zeros((sh, sw), dtype=bool)
for y in range(int(sh * 0.25), int(sh * 0.75), 1):
    for x in range(int(sw * 0.35), int(sw * 0.95), 1):
        r, g, b = map(int, sa[y, x])
        if r > 240 and g > 240 and b > 235:
            white[y, x] = True

# Row clusters by y
row_counts = white.sum(axis=1)
bands = []
inb = False
start = 0
for y, c in enumerate(row_counts):
    if c > 30 and not inb:
        inb = True
        start = y
    elif c <= 30 and inb:
        inb = False
        bands.append((start, y - 1, int(row_counts[start:y].max())))
if inb:
    bands.append((start, sh - 1, int(row_counts[start:].max())))
print('white bands', bands)

# For each band, find x span — split mid vs right by x center
for a, b, mx in bands:
    xs = np.where(white[a : b + 1].any(axis=0))[0]
    if len(xs) == 0:
        continue
    # cluster xs into segments
    segs = []
    s = xs[0]
    prev = xs[0]
    for x in xs[1:]:
        if x - prev > 15:
            segs.append((s, prev))
            s = x
        prev = x
    segs.append((s, prev))
    for s, e in segs:
        cy = (a + b) / 2
        cx = (s + e) / 2
        dx, dy = to_design(cx, cy)
        left, top = to_design(s, a)
        right, bottom = to_design(e, b)
        print(
            'bar',
            'shot',
            s,
            a,
            e,
            b,
            'design',
            round(left),
            round(top),
            round(right - left),
            round(bottom - top),
            'cocos',
            to_cocos_pt(dx, dy),
            'w',
            round(right - left),
            'h',
            round(bottom - top),
        )

# Score "40" - bright white glyphs in left plaque area
bright = []
for y in range(int(sh * 0.70), int(sh * 0.82)):
    for x in range(int(sw * 0.18), int(sw * 0.38)):
        r, g, b = map(int, sa[y, x])
        if r > 245 and g > 245 and b > 245:
            bright.append((x, y))
if bright:
    print(
        'scoreGlyphs',
        min(p[0] for p in bright),
        min(p[1] for p in bright),
        max(p[0] for p in bright),
        max(p[1] for p in bright),
    )
    cx = (min(p[0] for p in bright) + max(p[0] for p in bright)) / 2
    cy = (min(p[1] for p in bright) + max(p[1] for p in bright)) / 2
    dx, dy = to_design(cx, cy)
    print('score center design', dx, dy, 'cocos', to_cocos_pt(dx, dy))

# Plaque brown band
brown = []
for y in range(int(sh * 0.70), int(sh * 0.82)):
    for x in range(int(sw * 0.15), int(sw * 0.40)):
        r, g, b = map(int, sa[y, x])
        if 150 < r < 210 and 90 < g < 150 and 40 < b < 100:
            brown.append((x, y))
if brown:
    print(
        'plaque',
        min(p[0] for p in brown),
        min(p[1] for p in brown),
        max(p[0] for p in brown),
        max(p[1] for p in brown),
    )
    cx = (min(p[0] for p in brown) + max(p[0] for p in brown)) / 2
    cy = (min(p[1] for p in brown) + max(p[1] for p in brown)) / 2
    dx, dy = to_design(cx, cy)
    print('plaque center design', dx, dy, 'cocos', to_cocos_pt(dx, dy))
