/**
 * Regenerates `src/services/bundled-fonts.generated.ts` from `assets/fonts/*.ttf`.
 *
 * The fonts are embedded in source rather than shipped as files because every runtime that builds
 * a contact sheet bundles this package differently — esbuild for the Lambda, webpack for the
 * Next.js app — and a loose asset survives none of them without per-target configuration.
 *
 * Run with: bun packages/image-manipulation/scripts/generate-bundled-fonts.ts
 */
import { gzipSync } from 'node:zlib'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const fontsDir = join(packageRoot, 'assets', 'fonts')
const outFile = join(packageRoot, 'src', 'services', 'bundled-fonts.generated.ts')

const fontFiles = readdirSync(fontsDir)
  .filter((name) => name.endsWith('.ttf'))
  .sort()

if (fontFiles.length === 0) {
  throw new Error(`No .ttf files found in ${fontsDir}`)
}

const entries = fontFiles.map((fileName) => {
  const gzipped = gzipSync(readFileSync(join(fontsDir, fileName)), { level: 9 })
  return `  {\n    fileName: '${fileName}',\n    gzipBase64:\n      '${gzipped.toString('base64')}',\n  },`
})

const contents = `/**
 * GENERATED FILE - do not edit by hand.
 *
 * Produced by \`scripts/generate-bundled-fonts.ts\` from \`assets/fonts/*.ttf\`. Re-run that script
 * after changing the fonts.
 */

export interface BundledFont {
  readonly fileName: string
  /** gzipped TTF, base64 encoded. */
  readonly gzipBase64: string
}

export const BUNDLED_FONTS: ReadonlyArray<BundledFont> = [
${entries.join('\n')}
]
`

writeFileSync(outFile, contents)

console.log(`Wrote ${outFile} (${fontFiles.length} fonts, ${contents.length} bytes)`)
