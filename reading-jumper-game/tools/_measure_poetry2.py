from PIL import Image
import numpy as np

img = Image.open(
    r'E:\angsa\angsa_data\项目\作业帮游戏\reading-jumper-game\assets\theme-bundles\poetry\result-background.jpg'
).convert('RGB')
arr = np.array(img)
w, h = img.size
print('size', w, h)


def to_cocos(left, top, width, height):
    return {
        'x': round(left + width / 2 - 720, 2),
        'y': round(405 - (top + height / 2), 2),
        'w': round(width, 2),
        'h': round(height, 2),
        'html': (round(left, 1), round(top, 1), round(width, 1), round(height, 1)),
    }


def near(p, seed, tol=28):
    return all(abs(int(p[i]) - int(seed[i])) < tol for i in range(3))


def flood(cx, cy, tol=30, limit=250000):
    seed = arr[cy, cx]
    vis = np.zeros((h, w), dtype=bool)
    stack = [(cx, cy)]
    minx = maxx = cx
    miny = maxy = cy
    n = 0
    while stack and n < limit:
        x, y = stack.pop()
        if x < 0 or y < 0 or x >= w or y >= h or vis[y, x]:
            continue
        if not near(arr[y, x], seed, tol):
            continue
        vis[y, x] = True
        n += 1
        minx = min(minx, x)
        maxx = max(maxx, x)
        miny = min(miny, y)
        maxy = max(maxy, y)
        stack.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    return minx, miny, maxx, maxy, n


# Score plaque
box = flood(360, 640, tol=35)
print('plaque', box, to_cocos(box[0], box[1], box[2] - box[0], box[3] - box[1]))

# Mid / right beige boards
for name, pt in [('mid', (700, 420)), ('right', (1100, 420))]:
    box = flood(*pt, tol=32)
    print(name, box[:5], to_cocos(box[0], box[1], box[2] - box[0], box[3] - box[1]))

# Gold/silver medals in middle board
gold = []
for y in range(300, 600):
    for x in range(580, 720):
        r, g, b = map(int, arr[y, x])
        if r > 180 and 120 < g < 220 and b < 100 and r > b + 50:
            gold.append((x, y))
print('gold n', len(gold))
if gold:
    ys = sorted(set(p[1] for p in gold))
    groups = []
    cs = ce = ys[0]
    for y in ys[1:]:
        if y - ce <= 8:
            ce = y
        else:
            groups.append((cs, ce))
            cs = ce = y
    groups.append((cs, ce))
    print('gold y groups', groups)
    for a, b in groups:
        pts = [p for p in gold if a <= p[1] <= b]
        print(
            ' trophy',
            min(p[0] for p in pts),
            a,
            max(p[0] for p in pts),
            b,
            'cy',
            (a + b) / 2,
            'cocosY',
            round(405 - (a + b) / 2, 2),
        )

# Title banners (orange-ish)
for y0, y1, x0, x1, name in [
    (120, 200, 550, 900, 'rankTitle'),
    (120, 200, 950, 1300, 'reviewTitle'),
]:
    pts = []
    for y in range(y0, y1):
        for x in range(x0, x1, 2):
            r, g, b = map(int, arr[y, x])
            if r > 190 and 90 < g < 170 and b < 110:
                pts.append((x, y))
    if pts:
        print(
            name,
            min(p[0] for p in pts),
            min(p[1] for p in pts),
            max(p[0] for p in pts),
            max(p[1] for p in pts),
            'cy',
            (min(p[1] for p in pts) + max(p[1] for p in pts)) / 2,
            'cocos',
            round((min(p[0] for p in pts) + max(p[0] for p in pts)) / 2 - 720, 2),
            round(405 - (min(p[1] for p in pts) + max(p[1] for p in pts)) / 2, 2),
        )
