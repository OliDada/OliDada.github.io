#!/usr/bin/env python3
"""Build Niceland: join src/ into one page.

    python3 build.py          -> index.html          (the page the website serves)
                                 dist/artifact.html  (the same page without <html>/<head>, for the claude.ai artifact)

The JavaScript modules in src/js/ are joined in file-name order inside one function scope, exactly as if they
were one file, so every module can use what the earlier ones define. Keep the numeric prefixes when you add or
rename a module: the order matters for constants that are set up when the page starts.
The map data (*.txt) is not touched here; it is made by tools/ and sits next to index.html.
"""
import glob, os, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
def read(p): return open(os.path.join(ROOT, p), encoding='utf-8').read()

FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
         '<link href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400;500;600;700&family=Silkscreen:wght@400;700&display=swap" rel="stylesheet">\n')

def bundle_js():
    parts = []
    for f in sorted(glob.glob(os.path.join(ROOT, 'src', 'js', '*.js'))):
        parts.append('// ---- ' + os.path.basename(f) + ' ----\n' + open(f, encoding='utf-8').read())
    return "(() => {\n'use strict';\n" + '\n'.join(parts) + '})();\n'

def main():
    css, body, js = read('src/ui/style.css'), read('src/ui/body.html'), bundle_js()
    menu = read('src/ui/phone-menu.js')
    inner = ('<style>\n' + css + '</style>\n' + body + '\n<script>\n' + menu + '</script>\n'
             '<script>\n' + js + '</script>\n')
    page = ('<!doctype html>\n<html lang="is">\n<head>\n<meta charset="utf-8">\n<title>Niceland</title>\n'
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
            '<meta name="description" content="Niceland: an isometric pixel-art god sandbox of Iceland, every house at true scale.">\n'
            '<link rel="icon" href="../images/dolphin2.png">\n' + FONTS +
            '<style>html,body{margin:0;height:100%;background:#0b1622;overflow:hidden}</style>\n</head>\n<body>\n'
            + inner + '</body>\n</html>\n')
    open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8').write(page)
    os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
    open(os.path.join(ROOT, 'dist', 'artifact.html'), 'w', encoding='utf-8').write('<title>Niceland</title>\n' + FONTS + inner)
    print('index.html %.0f KB, %d modules' % (len(page) / 1024, len(glob.glob(os.path.join(ROOT, 'src', 'js', '*.js')))))

if __name__ == '__main__':
    main()
