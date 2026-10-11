#!/usr/bin/env ruby
# frozen_string_literal: true

# One-off generator for the blog's SVG artwork (favicon + post covers).
# Run: ruby blog/tools/generate-artwork.rb  (outputs are checked in)

require "fileutils"

OUT = File.expand_path("../assets", __dir__)

def hex_points(cx, cy, r)
  w = (Math.sqrt(3) * r) / 2
  [
    [cx, cy - r],
    [cx + w, cy - r / 2],
    [cx + w, cy + r / 2],
    [cx, cy + r],
    [cx - w, cy + r / 2],
    [cx - w, cy - r / 2],
  ].map { |x, y| format("%<x>.1f,%<y>.1f", x: x, y: y) }.join(" ")
end

# 7-hex flower centered at (cx, cy) — same layout as the website hero kernel box
def flower(cx, cy, r)
  w = Math.sqrt(3) * r
  [
    [cx, cy],
    [cx + w, cy],
    [cx - w, cy],
    [cx + w / 2, cy - 1.5 * r],
    [cx + w / 2, cy + 1.5 * r],
    [cx - w / 2, cy - 1.5 * r],
    [cx - w / 2, cy + 1.5 * r],
  ]
end

DEFS = <<~DEFS
  <defs>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7aa2ff"/>
      <stop offset="1" stop-color="#9d7bff"/>
    </linearGradient>
    <radialGradient id="glowBlue" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#7aa2ff" stop-opacity="0.32"/>
      <stop offset="1" stop-color="#7aa2ff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowViolet" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#9d7bff" stop-opacity="0.26"/>
      <stop offset="1" stop-color="#9d7bff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowCyan" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#38bdf8" stop-opacity="0.14"/>
      <stop offset="1" stop-color="#38bdf8" stop-opacity="0"/>
    </radialGradient>
  </defs>
DEFS

def shell(body)
  <<~SVG
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" role="img" aria-label="BPFLab blog artwork">
    #{DEFS.chomp}
      <rect width="1600" height="900" fill="#0b1220"/>
    #{body.strip}
    </svg>
  SVG
end

def flower_group(cx, cy, r, core: "url(#accent)", ring_fill: "rgba(255,255,255,0.05)", ring_stroke: "#7aa2ff")
  flower(cx, cy, r).each_with_index.map do |(x, y), i|
    if i.zero?
      %(      <polygon points="#{hex_points(x, y, r)}" fill="#{core}"/>)
    else
      %(      <polygon points="#{hex_points(x, y, r)}" fill="#{ring_fill}" stroke="#{ring_stroke}" stroke-opacity="0.5" stroke-width="2"/>)
    end
  end.join("\n")
end

def hexes(list, stroke: "#7aa2ff", opacity: 0.4, width: 2, fill: "none")
  list.map do |(x, y, r)|
    %(      <polygon points="#{hex_points(x, y, r)}" fill="#{fill}" stroke="#{stroke}" stroke-opacity="#{opacity}" stroke-width="#{width}"/>)
  end.join("\n")
end

glows = <<~G
  <rect width="1600" height="900" fill="url(#glowBlue)" opacity="0.9" transform="translate(200,-250) scale(1.8)"/>
  <rect width="1600" height="900" fill="url(#glowViolet)" opacity="0.8" transform="translate(-500,150) scale(1.7)"/>
  <rect width="1600" height="900" fill="url(#glowCyan)" transform="translate(150,450) scale(1.6)"/>
G

# ---- cover 1: what-is-ebpf — honeycomb kernel ----
c1 = shell(<<~BODY)
  #{glows}
  #{hexes([[1350, 170, 46], [1430, 216, 26], [1290, 90, 20], [240, 800, 40], [1220, 790, 30], [90, 140, 24]], opacity: 0.35)}
  #{flower_group(430, 470, 96)}
  <path d="M770 470 H1030" stroke="rgba(255,255,255,0.28)" stroke-width="3" fill="none"/>
  <path d="M770 470 H1030" stroke="#7aa2ff" stroke-width="3" stroke-dasharray="8 18" fill="none"/>
  <rect x="1050" y="410" width="200" height="120" rx="18" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" stroke-width="2"/>
  <text x="1150" y="465" text-anchor="middle" fill="#dfe6f1" font-family="monospace" font-size="26">eBPF</text>
  <text x="1150" y="502" text-anchor="middle" fill="#8a93a8" font-family="monospace" font-size="18">Linux</text>
BODY

# ---- cover 2: firecracker — microVM boxes ----
c2 = shell(<<~BODY)
  #{glows}
  #{hexes([[1250, 660, 50], [1345, 715, 26], [1185, 745, 22], [300, 150, 34], [1400, 120, 26]], opacity: 0.32)}
  <rect x="330" y="330" width="300" height="150" rx="20" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" stroke-width="2"/>
  <text x="480" y="400" text-anchor="middle" fill="#dfe6f1" font-family="monospace" font-size="24">clang</text>
  <text x="480" y="435" text-anchor="middle" fill="#8a93a8" font-family="monospace" font-size="17">libbpf</text>
  <rect x="740" y="330" width="300" height="150" rx="20" fill="rgba(255,255,255,0.09)" stroke="#7aa2ff" stroke-opacity="0.45" stroke-width="2"/>
  <text x="890" y="400" text-anchor="middle" fill="#dfe6f1" font-family="monospace" font-size="24">microVM</text>
  <text x="890" y="435" text-anchor="middle" fill="#8a93a8" font-family="monospace" font-size="17">Firecracker</text>
  <rect x="1150" y="330" width="300" height="150" rx="20" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" stroke-width="2"/>
  <text x="1300" y="400" text-anchor="middle" fill="#dfe6f1" font-family="monospace" font-size="24">kernel</text>
  <text x="1300" y="435" text-anchor="middle" fill="#8a93a8" font-family="monospace" font-size="17">eBPF</text>
  <path d="M630 405 H740" stroke="rgba(255,255,255,0.3)" stroke-width="3" fill="none"/>
  <path d="M1040 405 H1150" stroke="rgba(255,255,255,0.3)" stroke-width="3" fill="none"/>
  <path d="M890 480 V640 H520 V480" stroke="#7aa2ff" stroke-width="3" stroke-dasharray="9 16" fill="none"/>
  <text x="705" y="622" text-anchor="middle" fill="#7aa2ff" font-family="monospace" font-size="17">SSE</text>
BODY

# ---- cover 3: verifier — core hex under inspection ----
c3 = shell(<<~BODY)
  #{glows}
  #{hexes([[250, 200, 34], [1420, 720, 40], [1330, 660, 22], [1170, 110, 26], [180, 740, 30]], opacity: 0.32)}
  <polygon points="#{hex_points(800, 450, 250)}" fill="none" stroke="#7aa2ff" stroke-opacity="0.5" stroke-width="3"/>
  <polygon points="#{hex_points(800, 450, 180)}" fill="none" stroke="#9d7bff" stroke-opacity="0.35" stroke-width="2" stroke-dasharray="10 12"/>
  #{flower_group(800, 450, 84)}
  <path d="M1150 700 L1230 780" stroke="url(#accent)" stroke-width="10" stroke-linecap="round"/>
  <path d="M1130 660 L1170 700" stroke="url(#accent)" stroke-width="10" stroke-linecap="round"/>
BODY

# ---- placeholder (no image set) ----
ph = shell(<<~BODY)
  #{glows}
  #{hexes([[1300, 200, 34], [300, 700, 30], [1450, 650, 24], [200, 180, 22]], opacity: 0.22)}
  #{flower_group(800, 450, 92, ring_stroke: "#8a93a8")}
BODY

# ---- favicon: honeycomb cluster, gradient fill, page-colored gaps ----
LOGO_PATHS = [
  "m175 0 43.7 25.3v50.5L175 101l-43.8-25.2V25.3L175 0Z",
  "m218.7 75.8 43.7 25.2v50.5l-43.7 25.3-43.7-25.3V101l43.7-25.2Z",
  "m175 151.5 43.7 25.3v50.5L175 252.5l-43.8-25.2v-50.5l43.8-25.3ZM87.5 0 43.7 25.3v50.5L87.5 101l43.7-25.2V25.3L87.5 0Z",
  "M43.7 75.8 0 101v50.5l43.7 25.3 43.8-25.3V101L43.7 75.8Z",
  "m87.5 151.5-43.8 25.3v50.5l43.8 25.2 43.7-25.2v-50.5l-43.7-25.3Z",
].freeze

favicon = <<~SVG
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 -12 286 276">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#7aa2ff"/>
        <stop offset="1" stop-color="#9d7bff"/>
      </linearGradient>
    </defs>
  #{LOGO_PATHS.map { |d| %(    <path fill="url(#g)" stroke="#070b14" stroke-width="12" d="#{d}"/>) }.join("\n")}
  </svg>
SVG

{
  "images/posts/what-is-ebpf.svg" => c1,
  "images/posts/firecracker-microvm.svg" => c2,
  "images/posts/verifier-diagnostics.svg" => c3,
  "images/placeholder.svg" => ph,
  "favicon.svg" => favicon,
}.each do |rel, content|
  path = File.join(OUT, rel)
  FileUtils.mkdir_p(File.dirname(path))
  File.write(path, content)
  puts "wrote #{path} (#{content.bytesize} bytes)"
end
