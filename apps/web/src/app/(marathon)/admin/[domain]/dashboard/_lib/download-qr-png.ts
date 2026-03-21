"use client"

const XLINK_NAMESPACE = "http://www.w3.org/1999/xlink"

interface DownloadQrPngOptions {
  filename: string
  pixelRatio?: number
  svg: SVGSVGElement | null
}

interface SvgSize {
  height: number
  width: number
}

export async function downloadQrPng({
  filename,
  pixelRatio = 2,
  svg,
}: DownloadQrPngOptions): Promise<void> {
  if (!svg) {
    throw new Error("QR code is not ready to download")
  }

  const clonedSvg = svg.cloneNode(true) as SVGSVGElement

  await inlineSvgImages(clonedSvg)

  const { height, width } = getSvgSize(clonedSvg)
  const svgMarkup = new XMLSerializer().serializeToString(clonedSvg)
  const pngBlob = await renderSvgAsPngBlob({
    height,
    pixelRatio,
    svgMarkup,
    width,
  })

  downloadBlob(pngBlob, filename)
}

async function inlineSvgImages(svg: SVGSVGElement) {
  const images = Array.from(svg.querySelectorAll("image"))

  for (const image of images) {
    const href = image.getAttribute("href") ?? image.getAttributeNS(XLINK_NAMESPACE, "href")

    if (!href || href.startsWith("data:")) {
      continue
    }

    const response = await fetch(new URL(href, window.location.href).href)

    if (!response.ok) {
      throw new Error("Failed to inline QR image asset")
    }

    const dataUrl = await blobToDataUrl(await response.blob())
    image.setAttribute("href", dataUrl)
    image.setAttributeNS(XLINK_NAMESPACE, "href", dataUrl)
  }
}

function getSvgSize(svg: SVGSVGElement): SvgSize {
  const width = parseNumber(svg.getAttribute("width"))
  const height = parseNumber(svg.getAttribute("height"))

  if (width && height) {
    return { height, width }
  }

  const viewBox = svg.getAttribute("viewBox")?.trim().split(/\s+/)

  if (viewBox?.length === 4) {
    const viewBoxWidth = parseNumber(viewBox[2])
    const viewBoxHeight = parseNumber(viewBox[3])

    if (viewBoxWidth && viewBoxHeight) {
      return { height: viewBoxHeight, width: viewBoxWidth }
    }
  }

  throw new Error("QR code size could not be determined")
}

function parseNumber(value: string | null): number | null {
  if (!value) {
    return null
  }

  const parsed = Number.parseFloat(value)

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result)
        return
      }

      reject(new Error("Failed to read QR image asset"))
    }

    reader.onerror = () => reject(new Error("Failed to read QR image asset"))
    reader.readAsDataURL(blob)
  })
}

async function renderSvgAsPngBlob({
  height,
  pixelRatio,
  svgMarkup,
  width,
}: SvgSize & {
  pixelRatio: number
  svgMarkup: string
}): Promise<Blob> {
  const svgBlobUrl = URL.createObjectURL(
    new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" }),
  )

  try {
    const image = await loadImage(svgBlobUrl)
    const canvas = document.createElement("canvas")

    canvas.width = Math.round(width * pixelRatio)
    canvas.height = Math.round(height * pixelRatio)

    const context = canvas.getContext("2d")

    if (!context) {
      throw new Error("Could not prepare QR download canvas")
    }

    context.scale(pixelRatio, pixelRatio)
    context.fillStyle = "#ffffff"
    context.fillRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)

    return await canvasToBlob(canvas)
  } finally {
    URL.revokeObjectURL(svgBlobUrl)
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("Failed to render QR image"))
    image.src = src
  })
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
        return
      }

      reject(new Error("Failed to create QR download image"))
    }, "image/png")
  })
}

function downloadBlob(blob: Blob, filename: string) {
  const downloadUrl = URL.createObjectURL(blob)
  const anchor = document.createElement("a")

  anchor.href = downloadUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(downloadUrl)
}
