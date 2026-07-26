import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { bundledFontsError, installBundledFonts } from './bundled-fonts'

/**
 * The bug this guards against is silent: with no font available libvips renders every character as
 * a .notdef box rather than failing, so a sheet built without fonts satisfies every assertion about
 * buffers, dimensions and composite positions. The only honest check is to rasterise text and look
 * at the pixels.
 *
 * "Did anything render" is not enough — boxes draw outlines too. What separates them is that a box
 * is the same rectangle for every character, so `MMMM` and `iiii` come out pixel-identical (a
 * measured ratio of exactly 1.00), while real glyphs put ~4x more ink in four Ms than in four is.
 *
 * The rendering assertions only mean something once `installBundledFonts` has pointed fontconfig at
 * a directory holding nothing but the bundled font — which it does, since the generated config
 * includes no system paths. Two things follow. The install must happen before the first text render
 * in the process, so if another test file ever rasterises text these can start passing on ambient
 * fonts instead. And a developer machine with system fonts would render glyphs even with the whole
 * mechanism removed, so it is the first test — config written, env set — that fails first there.
 */

const CANVAS = { width: 1200, height: 140 }

function textSvg(text: string) {
  return Buffer.from(`
    <svg width="${CANVAS.width}" height="${CANVAS.height}">
      <text x="10" y="90" font-family="Liberation Sans, Arial, sans-serif" font-size="64"
            font-weight="500" fill="black" text-anchor="start">${text}</text>
    </svg>
  `)
}

async function inkPixels(text: string) {
  const rendered = await sharp({
    create: { ...CANVAS, channels: 3, background: '#ffffff' },
  })
    .composite([{ input: textSvg(text), top: 0, left: 0 }])
    .raw()
    .toBuffer({ resolveWithObject: true })

  let ink = 0
  for (let i = 0; i < rendered.data.length; i += rendered.info.channels) {
    if (rendered.data[i]! < 128) {
      ink++
    }
  }
  return ink
}

describe('installBundledFonts', () => {
  it('writes the fonts and a fontconfig config into a directory fontconfig is pointed at', () => {
    const fontDir = installBundledFonts()

    expect(bundledFontsError()).toBeUndefined()
    expect(fontDir).toBeDefined()
    expect(process.env.FONTCONFIG_PATH).toBe(fontDir)
    expect(existsSync(join(fontDir!, 'fonts.conf'))).toBe(true)
    expect(existsSync(join(fontDir!, 'LiberationSans-Regular.ttf'))).toBe(true)
    expect(existsSync(join(fontDir!, 'LiberationSans-Bold.ttf'))).toBe(true)
  })

  it('is idempotent', () => {
    expect(installBundledFonts()).toBe(installBundledFonts())
  })

  it('lets libvips draw real glyphs rather than .notdef boxes', async () => {
    installBundledFonts()

    const narrow = await inkPixels('iiii')
    const wide = await inkPixels('MMMM')

    expect(narrow).toBeGreaterThan(0)
    expect(wide / narrow).toBeGreaterThan(2)
  })

  it('covers the Swedish characters topic names are written in', async () => {
    installBundledFonts()

    const ascii = await inkPixels('aao')
    const swedish = await inkPixels('åäö')

    // Diacritics add ink; a fallback that dropped them would come out at or below the ASCII mark.
    expect(swedish).toBeGreaterThan(ascii)
  })
})
