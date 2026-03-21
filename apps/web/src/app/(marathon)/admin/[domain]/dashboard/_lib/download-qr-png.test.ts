import { afterEach, describe, expect, it, vi } from "vitest"

type FakeSvgImage = {
  href: string
  getAttribute: ReturnType<typeof vi.fn>
  getAttributeNS: ReturnType<typeof vi.fn>
  setAttribute: ReturnType<typeof vi.fn>
  setAttributeNS: ReturnType<typeof vi.fn>
}

function createFakeSvgImage(initialHref: string): FakeSvgImage {
  const image = {
    href: initialHref,
    getAttribute: vi.fn((name: string) => (name === "href" ? image.href : null)),
    getAttributeNS: vi.fn(() => null),
    setAttribute: vi.fn((name: string, value: string) => {
      if (name === "href") {
        image.href = value
      }
    }),
    setAttributeNS: vi.fn(),
  }

  return image
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe("downloadQrPng", () => {
  it("downloads a png from the QR svg and inlines logo images first", async () => {
    const originalImage = createFakeSvgImage("/blikka-logo-dark-qr.svg")
    const clonedImage = createFakeSvgImage("/blikka-logo-dark-qr.svg")
    const clonedSvg = {
      getAttribute: vi.fn((name: string) => {
        if (name === "width" || name === "height") {
          return "512"
        }

        return null
      }),
      querySelectorAll: vi.fn(() => [clonedImage]),
    }
    const svg = {
      cloneNode: vi.fn(() => clonedSvg),
      querySelectorAll: vi.fn(() => [originalImage]),
    } as unknown as SVGSVGElement

    const appendChild = vi.fn()
    const removeChild = vi.fn()
    const anchorClick = vi.fn()
    const drawImage = vi.fn()
    const fillRect = vi.fn()
    const scale = vi.fn()
    const anchor = {
      click: anchorClick,
      download: "",
      href: "",
    }
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({
        drawImage,
        fillRect,
        scale,
      })),
      toBlob: vi.fn((callback: BlobCallback) => {
        callback(new Blob(["png"], { type: "image/png" }))
      }),
    }

    vi.stubGlobal("document", {
      body: {
        appendChild,
        removeChild,
      },
      createElement: vi.fn((tagName: string) => {
        if (tagName === "a") {
          return anchor
        }

        if (tagName === "canvas") {
          return canvas
        }

        throw new Error(`Unexpected tag: ${tagName}`)
      }),
    })

    vi.stubGlobal("window", {
      location: {
        href: "https://blikka.app/admin/demo/dashboard",
      },
      URL,
    })

    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValueOnce("blob:svg")
      .mockReturnValueOnce("blob:png")
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        blob: vi.fn().mockResolvedValue(new Blob(["logo"], { type: "image/svg+xml" })),
      }),
    )

    const serializeToString = vi.fn(() => "<svg />")
    vi.stubGlobal(
      "XMLSerializer",
      class {
        serializeToString = serializeToString
      },
    )

    vi.stubGlobal(
      "FileReader",
      class {
        result: string | ArrayBuffer | null = null
        onload: null | (() => void) = null
        onerror: null | (() => void) = null

        readAsDataURL() {
          this.result = "data:image/svg+xml;base64,PHN2Zy8+"
          this.onload?.()
        }
      },
    )

    vi.stubGlobal(
      "Image",
      class {
        onload: null | (() => void) = null
        onerror: null | (() => void) = null

        set src(_value: string) {
          this.onload?.()
        }
      },
    )

    const { downloadQrPng } = await import("./download-qr-png")

    await downloadQrPng({
      filename: "live-upload-qr.png",
      svg,
    })

    expect(fetch).toHaveBeenCalledWith("https://blikka.app/blikka-logo-dark-qr.svg")
    expect(clonedImage.setAttribute).toHaveBeenCalledWith(
      "href",
      "data:image/svg+xml;base64,PHN2Zy8+",
    )
    expect(serializeToString).toHaveBeenCalledWith(clonedSvg)
    expect(scale).toHaveBeenCalledWith(2, 2)
    expect(fillRect).toHaveBeenCalledWith(0, 0, 512, 512)
    expect(drawImage).toHaveBeenCalledTimes(1)
    expect(anchor.download).toBe("live-upload-qr.png")
    expect(anchor.href).toBe("blob:png")
    expect(anchorClick).toHaveBeenCalledTimes(1)
    expect(appendChild).toHaveBeenCalledWith(anchor)
    expect(removeChild).toHaveBeenCalledWith(anchor)
    expect(createObjectURL).toHaveBeenCalledTimes(2)
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:svg")
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:png")
  })

  it("throws when the qr svg has no size information", async () => {
    const svg = {
      cloneNode: vi.fn(() => ({
        getAttribute: vi.fn(() => null),
        querySelectorAll: vi.fn(() => []),
      })),
    } as unknown as SVGSVGElement

    const { downloadQrPng } = await import("./download-qr-png")

    await expect(
      downloadQrPng({
        filename: "live-upload-qr.png",
        svg,
      }),
    ).rejects.toThrow("QR code size could not be determined")
  })
})
