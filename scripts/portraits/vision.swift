// Usage: vision <input-image> <output-mask.png>
// Prints JSON: {"w":..,"h":..,"faces":[[x,y,w,h],...]} with face boxes in pixel coords (origin top-left).
import Foundation
import Vision
import CoreImage
import ImageIO
import UniformTypeIdentifiers

let args = CommandLine.arguments
let inURL = URL(fileURLWithPath: args[1]), outURL = URL(fileURLWithPath: args[2])
guard let src = CGImageSourceCreateWithURL(inURL as CFURL, nil),
      let props = CGImageSourceCopyPropertiesAtIndex(src, 0, nil) as? [CFString: Any] else { exit(1) }
let orientNum = (props[kCGImagePropertyOrientation] as? UInt32) ?? 1
let ci = CIImage(contentsOf: inURL, options: [.applyOrientationProperty: true])!
let ctx = CIContext()
let cg = ctx.createCGImage(ci, from: ci.extent)!
let W = cg.width, H = cg.height
_ = orientNum

let seg = VNGeneratePersonSegmentationRequest()
seg.qualityLevel = .accurate
seg.outputPixelFormat = kCVPixelFormatType_OneComponent8
let faces = VNDetectFaceRectanglesRequest()
let handler = VNImageRequestHandler(cgImage: cg, options: [:])
try handler.perform([seg, faces])

if let buf = seg.results?.first?.pixelBuffer {
    var mask = CIImage(cvPixelBuffer: buf)
    mask = mask.transformed(by: CGAffineTransform(scaleX: CGFloat(W) / mask.extent.width, y: CGFloat(H) / mask.extent.height))
    let out = ctx.createCGImage(mask, from: CGRect(x: 0, y: 0, width: W, height: H))!
    let dest = CGImageDestinationCreateWithURL(outURL as CFURL, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(dest, out, nil)
    CGImageDestinationFinalize(dest)
}
let boxes = (faces.results ?? []).map { f -> [Int] in
    let b = f.boundingBox
    return [Int(b.minX * CGFloat(W)), Int((1 - b.maxY) * CGFloat(H)), Int(b.width * CGFloat(W)), Int(b.height * CGFloat(H))]
}
let json = try JSONSerialization.data(withJSONObject: ["w": W, "h": H, "faces": boxes])
print(String(data: json, encoding: .utf8)!)
