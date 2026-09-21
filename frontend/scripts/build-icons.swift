// Regenerates every raster app icon from frontend/public/favicon.svg.
// macOS only (uses AppKit's SVG renderer). The outputs are committed, so this
// only needs running after the SVG changes:
//
//   swift frontend/scripts/build-icons.swift
//
import AppKit

let publicDir = URL(fileURLWithPath: #filePath)
  .deletingLastPathComponent().deletingLastPathComponent()
  .appendingPathComponent("public")
let svg = try! String(contentsOf: publicDir.appendingPathComponent("favicon.svg"), encoding: .utf8)

// Maskable / iOS icons get cropped by the OS, so they need a square full-bleed
// field with the glyph pulled inside the 80% safe zone.
let fullBleed = svg
  .replacingOccurrences(of: " rx=\"14\"", with: "")
  .replacingOccurrences(
    of: "<g id=\"glyph\"",
    with: "<g id=\"glyph\" transform=\"translate(32 32) scale(0.8) translate(-32 -32)\"")
precondition(fullBleed != svg, "favicon.svg no longer has the bg rx / glyph id this script rewrites")

func png(_ source: String, _ size: Int) -> Data {
  let image = NSImage(data: source.data(using: .utf8)!)!
  let rep = NSBitmapImageRep(
    bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8,
    samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
    colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
  rep.size = NSSize(width: size, height: size)
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
  NSGraphicsContext.current!.imageInterpolation = .high
  image.draw(in: NSRect(x: 0, y: 0, width: size, height: size))
  NSGraphicsContext.restoreGraphicsState()
  return rep.representation(using: .png, properties: [:])!
}

// ICO container holding PNG-encoded entries.
func ico(_ sizes: [Int]) -> Data {
  func le<T: FixedWidthInteger>(_ v: T) -> Data { withUnsafeBytes(of: v.littleEndian) { Data($0) } }
  let images = sizes.map { png(svg, $0) }
  var out = le(UInt16(0)) + le(UInt16(1)) + le(UInt16(sizes.count))
  var offset = 6 + 16 * sizes.count
  for (size, data) in zip(sizes, images) {
    out += Data([UInt8(size % 256), UInt8(size % 256), 0, 0]) + le(UInt16(1)) + le(UInt16(32))
    out += le(UInt32(data.count)) + le(UInt32(offset))
    offset += data.count
  }
  return images.reduce(out, +)
}

let outputs: [(String, Data)] = [
  ("favicon.ico", ico([16, 32, 48])),
  ("logo192.png", png(svg, 192)),
  ("logo512.png", png(svg, 512)),
  ("maskable512.png", png(fullBleed, 512)),
  ("apple-touch-icon.png", png(fullBleed, 180)),
]
for (name, data) in outputs {
  try! data.write(to: publicDir.appendingPathComponent(name))
  print("wrote \(name) (\(data.count) bytes)")
}
