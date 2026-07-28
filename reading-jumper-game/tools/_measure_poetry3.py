from PIL import Image
import numpy as np

img = Image.open(
    r'E:\angsa\angsa_data\项目\作业帮游戏\reading-jumper-game\assets\theme-bundles\poetry\result-background.jpg'
).convert('RGB')
arr = np.array(img)
w, h = img.size
print('size', w, h)


def cocos(x, y):
    return round(x - 720, 2), round(405 - y, 2)


print('\n=== plaque brown span ===')
for y in range(600, 680):
    browns = []
    for x in range(250, 480):
        r, g, b = map(int, arr[y, x])
        if 140 < r < 220 and 80 < g < 160 and 30 < b < 110 and r > g + 20:
            browns.append(x)
    if len(browns) > 40:
        print('y', y, 'x', min(browns), max(browns), 'n', len(browns), 'cocosY', round(405 - y, 2))

print('\n=== plaque dark slot ===')
for y in range(610, 670):
    row = arr[y, 280:450]
    lum = row.astype(np.float32).mean(axis=1)
    dark = lum < 140
    if dark.sum() > 20:
        xs = np.where(dark)[0] + 280
        print('y', y, 'dark', int(xs.min()), int(xs.max()), 'mid', (xs.min() + xs.max()) / 2, cocos((xs.min() + xs.max()) / 2, y))

print('\n=== mid board bright peaks ===')
mid = arr[280:620, 590:970].astype(np.float32).mean(axis=2)
lums = [float(mid[i].mean()) for i in range(mid.shape[0])]
peaks = []
for i in range(8, len(lums) - 8):
    window = lums[i - 8 : i + 9]
    if lums[i] == max(window) and lums[i] > 190:
        y = 280 + i
        if not peaks or y - peaks[-1][0] > 25:
            peaks.append((y, lums[i]))
print('peaks', [(y, round(L, 1), cocos(778, y)) for y, L in peaks[:8]])

print('\n=== right board bright peaks ===')
right = arr[280:640, 1000:1360].astype(np.float32).mean(axis=2)
rlums = [float(right[i].mean()) for i in range(right.shape[0])]
rpeaks = []
for i in range(8, len(rlums) - 8):
    window = rlums[i - 8 : i + 9]
    if rlums[i] == max(window) and rlums[i] > 185:
        y = 280 + i
        if not rpeaks or y - rpeaks[-1][0] > 18:
            rpeaks.append((y, rlums[i]))
print('peaks', [(y, round(L, 1), cocos(1180, y)) for y, L in rpeaks[:10]])

print('\n=== titles ===')
for name, x0, x1 in [('rank', 600, 900), ('review', 1050, 1350)]:
    pts = []
    for y in range(100, 220):
        for x in range(x0, x1, 2):
            r, g, b = map(int, arr[y, x])
            if r > 200 and 110 < g < 180 and b < 120:
                pts.append((x, y))
    if pts:
        cy = (min(p[1] for p in pts) + max(p[1] for p in pts)) / 2
        cx = (min(p[0] for p in pts) + max(p[0] for p in pts)) / 2
        bot = max(p[1] for p in pts)
        print(name, 'box', min(p[0] for p in pts), min(p[1] for p in pts), max(p[0] for p in pts), max(p[1] for p in pts),
              'cocos', cocos(cx, cy), 'bottomY', bot, 'cocosBottom', round(405 - bot, 2))

print('\n=== board content first bright ===')
for name, x0, x1 in [('mid', 620, 940), ('right', 1030, 1340)]:
    for y in range(250, 380):
        row = arr[y, x0:x1].astype(np.float32).mean(axis=1)
        if row.mean() > 200:
            print(name, 'first bright y', y, 'cocosY', round(405 - y, 2))
            break

# Detect gold medals more carefully - circular yellowish
print('\n=== medals ===')
medal_mask = np.zeros((h, w), dtype=bool)
for y in range(290, 580):
    for x in range(560, 700):
        r, g, b = map(int, arr[y, x])
        # gold/silver/bronze metallic
        if r > 160 and g > 100 and b < 120 and r - b > 40 and abs(r - g) < 80:
            medal_mask[y, x] = True
# cluster by y
row_has = medal_mask.any(axis=1)
groups = []
inb = False
for y in range(290, 580):
    if row_has[y] and not inb:
        inb = True
        start = y
    elif not row_has[y] and inb:
        inb = False
        groups.append((start, y - 1))
if inb:
    groups.append((start, 579))
print('medal y groups', groups)
for a, b in groups:
    xs = np.where(medal_mask[a : b + 1].any(axis=0))[0]
    if len(xs) == 0:
        continue
    cy = (a + b) / 2
    cx = (xs.min() + xs.max()) / 2
    print('medal', int(xs.min()), a, int(xs.max()), b, 'center', cocos(cx, cy), 'h', b - a + 1)

img.crop((250, 600, 480, 680)).save(r'E:\angsa\angsa_data\项目\作业帮游戏\reading-jumper-game\tools\_poetry_plaque_crop.png')
img.crop((580, 250, 980, 620)).save(r'E:\angsa\angsa_data\项目\作业帮游戏\reading-jumper-game\tools\_poetry_rank_crop.png')
img.crop((990, 250, 1380, 640)).save(r'E:\angsa\angsa_data\项目\作业帮游戏\reading-jumper-game\tools\_poetry_review_crop.png')
print('saved crops')
