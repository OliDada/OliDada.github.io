"""Power lines, pipelines, street lamps, ski lifts and ski runs -> infra.txt (gzip + base64 JSON).
In: data/infra.json
"""

import os, sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import paths  # noqa: E402
import json, gzip, base64

d = json.load(open(paths.data('infra.json')))
raw = json.dumps(d, separators=(',', ':')).encode()
open(paths.out('infra.txt'), 'w').write(base64.b64encode(gzip.compress(raw, 9)).decode())
print('infra.txt', len(d['lines']), 'lines', len(d['pipes']), 'pipes', len(d['lamps']) // 2, 'lamps')
