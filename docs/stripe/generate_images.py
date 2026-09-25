"""Renders the Stripe product images (docs/stripe/*.png) with headless Chrome — a one-off script.

Needs Google Chrome and `npm install` in frontend/ (the brand fonts come from @fontsource).
Run: python3 docs/stripe/generate_images.py — re-run after changing a package's token amount.
"""

import pathlib, subprocess
F = str(pathlib.Path(__file__).resolve().parents[2] / "frontend/node_modules/@fontsource")
OUT = pathlib.Path(__file__).parent
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

HEAD = f"""<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{{font-family:Fraunces;font-weight:400;src:url(file://{F}/fraunces/files/fraunces-latin-400-normal.woff2)}}
@font-face{{font-family:Fraunces;font-weight:600;src:url(file://{F}/fraunces/files/fraunces-latin-600-normal.woff2)}}
@font-face{{font-family:'Public Sans';font-weight:500;src:url(file://{F}/public-sans/files/public-sans-latin-500-normal.woff2)}}
@font-face{{font-family:'Public Sans';font-weight:600;src:url(file://{F}/public-sans/files/public-sans-latin-600-normal.woff2)}}
html,body{{margin:0;width:1024px;height:1024px;overflow:hidden}}
body{{background:#e9f0f3;font-family:'Public Sans';color:#1e2a32;position:relative;
 background-image:linear-gradient(#d3dfe4 2px,transparent 2px),linear-gradient(90deg,#d3dfe4 2px,transparent 2px);
 background-size:128px 128px;background-position:-1px -1px}}
.frame{{position:absolute;inset:40px;border:3px solid #1e2a32;background:rgba(255,255,255,.55)}}
.brand{{position:absolute;top:84px;left:88px;display:flex;align-items:center;gap:18px;font-family:Fraunces;font-weight:600;font-size:38px}}
.art{{position:absolute;top:190px;left:0;right:0;height:440px;display:flex;justify-content:center;align-items:center}}
.title{{position:absolute;top:650px;left:0;right:0;text-align:center;font-family:Fraunces;font-weight:600;font-size:124px;line-height:1;color:#1f6f78}}
.title small{{font-size:64px;font-weight:400;color:#1e2a32}}
.sub{{position:absolute;top:806px;left:0;right:0;text-align:center;font-size:40px;font-weight:500;color:#5b6670}}
.tag{{position:absolute;top:84px;right:88px;font-weight:600;font-size:30px;letter-spacing:4px;color:#b8763c;border:3px solid #b8763c;padding:6px 16px}}
</style></head><body><div class="frame"></div>
<div class="brand"><svg width="56" height="56" viewBox="0 0 64 64"><path d="M6 6H43L58 21V58H6Z" fill="#fff" stroke="#1E2A32" stroke-width="3"/><path d="M18 44L40 20" stroke="#1E2A32" stroke-width="3" stroke-linecap="round"/><rect x="15.5" y="41.5" width="5" height="5" fill="#1E2A32"/><circle cx="40" cy="20" r="5" fill="#1F6F78"/></svg>SKS Lotse</div>"""

def coin(x, y):
    # a token seen at a slight angle: rim + face, the logo's course-line mark on it
    return f"""<g transform="translate({x},{y})">
<ellipse cx="0" cy="26" rx="150" ry="58" fill="#164f56" stroke="#1e2a32" stroke-width="5"/>
<rect x="-150" y="0" width="300" height="26" fill="#164f56"/>
<line x1="-150" y1="0" x2="-150" y2="26" stroke="#1e2a32" stroke-width="5"/><line x1="150" y1="0" x2="150" y2="26" stroke="#1e2a32" stroke-width="5"/>
<ellipse cx="0" cy="0" rx="150" ry="58" fill="#1f6f78" stroke="#1e2a32" stroke-width="5"/>
<ellipse cx="0" cy="0" rx="112" ry="42" fill="none" stroke="#e9f0f3" stroke-width="4" stroke-dasharray="10 9"/>
<g transform="scale(1,.39)"><path d="M-44 44L44 -44" stroke="#fff" stroke-width="12" stroke-linecap="round"/><rect x="-54" y="34" width="20" height="20" fill="#fff"/><circle cx="44" cy="-44" r="18" fill="#b8763c"/></g></g>"""

def tokens_art(n):
    step = 62
    total = (n - 1) * step
    
    # draw bottom first
    coins = "".join(coin(512, 250 + total / 2 - i * step) for i in range(n))
    return f'<svg width="1024" height="440" viewBox="0 0 1024 440">{coins}</svg>'

def werbefrei_art():
    return """<svg width="1024" height="440" viewBox="0 0 1024 440">
<rect x="262" y="90" width="500" height="260" fill="#fff" stroke="#b9c9d0" stroke-width="5" stroke-dasharray="18 12"/>
<text x="512" y="170" text-anchor="middle" font-family="Public Sans" font-weight="600" font-size="34" letter-spacing="8" fill="#b9c9d0">ANZEIGE</text>
<rect x="322" y="210" width="380" height="22" fill="#d8e4e9"/><rect x="322" y="254" width="280" height="22" fill="#d8e4e9"/>
<line x1="232" y1="385" x2="792" y2="55" stroke="#b24632" stroke-width="26" stroke-linecap="round"/>
</svg>"""

PAGES = {
    "werbefrei": (werbefrei_art(), "Werbefrei", "Einmalig zahlen – dauerhaft ohne Werbung", "EINMALIG"),
    "tokens_s": (tokens_art(1), '20 <small>Tokens</small>', "für den Lotsen-Check", "PAKET S"),
    "tokens_m": (tokens_art(2), '50 <small>Tokens</small>', "für den Lotsen-Check", "PAKET M"),
    "tokens_l": (tokens_art(3), '100 <small>Tokens</small>', "für den Lotsen-Check", "PAKET L"),
    "tokens_xl": (tokens_art(4), '200 <small>Tokens</small>', "für den Lotsen-Check", "PAKET XL"),
}
for name, (art, title, sub, tag) in PAGES.items():
    html = OUT / f"{name}.html"
    html.write_text(HEAD + f'<div class="tag">{tag}</div><div class="art">{art}</div><div class="title">{title}</div><div class="sub">{sub}</div></body></html>')
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
                    "--allow-file-access-from-files", "--virtual-time-budget=2000",
                    "--window-size=1024,1024", f"--screenshot={OUT / (name + '.png')}", f"file://{html}"],
                   check=True, capture_output=True)
    html.unlink()
    print(name)
