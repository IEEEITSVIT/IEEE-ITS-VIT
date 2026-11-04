import json, os, subprocess, sys
import numpy as np
from PIL import Image, ImageFilter, ImageOps

S = os.path.dirname(os.path.abspath(__file__))  # expects the compiled `vision` binary next to this file
OUT_W, OUT_H = 800, 1000
BACKDROP = np.array([0xE3, 0xE4, 0xE6], dtype=np.float32) / 255  # flat neutral studio grey
FACE_H = 0.25      # face box height as a share of frame height
FACE_CY = 0.37     # vertical centre of the face

def lum(a): return a[..., 0] * .2126 + a[..., 1] * .7152 + a[..., 2] * .0722

def process(src, dst):
    mask_path = os.path.join(S, 'mask.png')
    info = json.loads(subprocess.check_output([os.path.join(S, 'vision'), src, mask_path]).decode())
    im = ImageOps.exif_transpose(Image.open(src)).convert('RGB')
    if im.size != (info['w'], info['h']): im = im.resize((info['w'], info['h']))
    mask = Image.open(mask_path).convert('L').resize(im.size).filter(ImageFilter.GaussianBlur(1.2))
    a = np.asarray(im, dtype=np.float32) / 255
    m = np.asarray(mask, dtype=np.float32)[..., None] / 255
    person = m[..., 0] > .5
    faces = sorted(info['faces'], key=lambda f: -f[2] * f[3])
    if faces:
        fx, fy, fw, fh = faces[0]
    else:  # fallback: assume head in upper-middle
        fw = fh = int(im.width * .35); fx = (im.width - fw) // 2; fy = int(im.height * .12)
    face = np.zeros(person.shape, bool); face[fy:fy + fh, fx:fx + fw] = True
    face &= person

    # 1) partial grey-world white balance on the person
    mean = a[person].mean(0)
    a = np.clip(a * (1 + .55 * (mean.mean() / np.maximum(mean, 1e-3) - 1)), 0, 1)
    # 2) exposure: bring the face to a natural mid-tone
    fl = lum(a)[face].mean() if face.any() else lum(a)[person].mean()
    gamma = np.clip(np.log(.50) / np.log(max(min(fl, .95), .05)), .6, 1.6)
    a = a ** gamma
    # 3) contrast: compress to a moderate, consistent spread
    L = lum(a); mu, sd = L[person].mean(), L[person].std()
    k = np.clip(.19 / max(sd, 1e-3), .88, 1.08)
    a = np.clip(mu + (a - mu) * k, 0, 1)
    # 4) gentle desaturation for a uniform look
    g = lum(a)[..., None]; a = np.clip(g + (a - g) * .88, 0, 1)
    # composite on the shared backdrop
    a = a * m + BACKDROP * (1 - m)
    comp = Image.fromarray((a * 255).astype(np.uint8))

    # align: same face size and position for everyone
    scale = (FACE_H * OUT_H) / fh
    # Where the person runs into the photo's edge (body cut by the original crop), zoom in just enough
    # that the cut lands on the frame edge instead of floating above the backdrop.
    H, W = person.shape
    cx, cy = fx + fw / 2, fy + fh / 2
    edge = lambda arr: arr.mean() > .02
    if edge(person[-3:, :]):
        scale = max(scale, OUT_H * (1 - FACE_CY) / max(H - cy, 1))
    if edge(person[:, :3]):
        scale = max(scale, OUT_W / 2 / max(cx, 1))
    if edge(person[:, -3:]):
        scale = max(scale, OUT_W / 2 / max(W - cx, 1))
    cw, ch = OUT_W / scale, OUT_H / scale
    cx, cy = fx + fw / 2, fy + fh / 2
    left, top = cx - cw / 2, cy - FACE_CY * ch
    canvas = Image.new('RGB', (round(cw), round(ch)), tuple((BACKDROP * 255).astype(int)))
    canvas.paste(comp, (round(-left), round(-top)))
    out = canvas.resize((OUT_W, OUT_H), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=1.2, percent=55, threshold=2))
    # if the source ends above the frame bottom, fade nothing: backdrop is flat, so just keep it
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    out.save(dst, 'JPEG', quality=86, optimize=True, progressive=True)
    return len(info['faces'])

if __name__ == '__main__':
    for pair in sys.argv[1:]:
        src, dst = pair.split('=')
        try: print(os.path.basename(dst), 'faces:', process(src, dst))
        except Exception as e: print('FAIL', src, e)
