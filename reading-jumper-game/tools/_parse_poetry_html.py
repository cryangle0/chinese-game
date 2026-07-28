import re
from pathlib import Path

html = Path(
    r'E:\angsa\angsa_data\项目\作业帮游戏\独立HTML像素级UI原型\reading\pages\29-poetry-settlement.html'
).read_text(encoding='utf8')


def cocos(left, top, width, height):
    return {
        'x': round(left + width / 2 - 720, 2),
        'y': round(405 - (top + height / 2), 2),
        'w': round(width, 2),
        'h': round(height, 2),
    }


for m in re.finditer(r'<(?:div|img)([^>]+)>', html):
    tag = m.group(1)
    cls = re.search(r'class="([^"]+)"', tag)
    box = re.search(r'data-qa-box="([^"]+)"', tag)
    style = re.search(
        r'left:\s*([-\d.]+)px;\s*top:\s*([-\d.]+)px;\s*width:\s*([-\d.]+)px;\s*height:\s*([-\d.]+)px',
        tag,
    )
    text = ''
    # peek following text briefly not available; print attrs
    c = cls.group(1) if cls else ''
    if not any(k in c for k in ('result', 'rank', 'review', 'summary', 'star')) and not box:
        continue
    print(c[:70])
    if box:
        parts = [float(x) for x in box.group(1).split(',')]
        print('  qa', parts, cocos(*parts))
    if style:
        parts = [float(x) for x in style.groups()]
        print('  st', parts, cocos(*parts))
