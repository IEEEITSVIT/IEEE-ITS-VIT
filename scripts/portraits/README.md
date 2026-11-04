# Uniform team portraits

Makes every portrait look alike: same flat backdrop, same 4:5 framing with faces aligned
at the same size/height, and normalised white balance, exposure and contrast (no harsh
contrast or brightness). Uses Apple's Vision framework (person segmentation + face
detection), so it runs offline on macOS.

```bash
swiftc -O scripts/portraits/vision.swift -o scripts/portraits/vision
python3 scripts/portraits/compose.py "path/to/photo.jpg=public/team/first-last.jpg"
```

Then upload `public/team/first-last.jpg` from Admin → Media Library (or keep it in `public/team`)
and select it on the person's card.

**Photo brief for members** (for the most consistent result): plain light wall, chest-up,
facing the camera at eye level, white or light formal shirt (blazer optional), no sunglasses
or caps, soft daylight, at least 1000 px tall.
