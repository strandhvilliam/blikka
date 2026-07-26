import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { BUNDLED_FONTS } from './bundled-fonts.generated'

/**
 * Makes Liberation Sans available to libvips, on any runtime, without deployment-side setup.
 *
 * Contact-sheet captions and the participant reference are drawn as SVG `<text>`, which libvips
 * renders through librsvg -> pango -> fontconfig. Neither AWS Lambda nor Vercel ships a single
 * font, and sharp's bundled fontconfig has no config file to fall back on, so pango resolves every
 * character to .notdef and the sheet comes out captioned in empty boxes. librsvg in this build
 * ignores `@font-face`, including base64 `data:` sources, so the font cannot travel inside the SVG
 * either — fontconfig has to find it on disk.
 *
 * Font files and a fontconfig config are therefore written into the runtime's temp directory at
 * startup and pointed at via `FONTCONFIG_PATH`. This used to be per-target deployment config (SST
 * `copyFiles` plus an env var), which covered the contact-sheet Lambda and silently missed the
 * Vercel-hosted admin routes that build sheets through the same service. Embedding the fonts in
 * source and installing them from code makes it one mechanism that no deployment target can forget.
 *
 * Two constraints worth knowing before moving this call:
 *
 * - `FONTCONFIG_PATH` is read once, when libvips first initialises fontconfig. Setting it after the
 *   first text render has no effect for the rest of the process, so this must run before any sheet
 *   is built — hence its place in the {@link ContactSheetBuilder} layer.
 * - The temp directory is the only writable path on Lambda, and fontconfig needs somewhere to write
 *   its cache, so both the fonts and the cache live there.
 * - This works on Node, not on Bun: Bun's `process.env` writes are not visible to the native
 *   `getenv` that fontconfig calls, so a sheet built under `bun run` still comes out in boxes.
 *   Every runtime that builds a sheet is Node (the SST Lambda, Next.js on Vercel, vitest), so this
 *   only bites if a sheet build is ever moved onto Bun — a container task, say. If that happens,
 *   set FONTCONFIG_PATH in that target's environment instead of relying on the assignment below.
 */

const FONT_DIR = join(tmpdir(), 'blikka-fonts')
const FONT_CACHE_DIR = join(tmpdir(), 'blikka-fonts-cache')

const FONTS_CONF = `<?xml version="1.0"?>
<fontconfig>
  <dir>${FONT_DIR}</dir>
  <cachedir>${FONT_CACHE_DIR}</cachedir>

  <!-- Resolve the generic families the sheet SVGs ask for onto the one font we ship. -->
  <alias>
    <family>sans-serif</family>
    <prefer><family>Liberation Sans</family></prefer>
  </alias>
  <alias>
    <family>Arial</family>
    <prefer><family>Liberation Sans</family></prefer>
  </alias>
</fontconfig>
`

/**
 * Write via a unique temp name and rename into place: a reader that sees the final path always
 * sees a complete file, even if two processes install concurrently into a shared temp directory.
 */
function writeAtomic(target: string, contents: Buffer | string) {
  const scratch = `${target}.${process.pid}.tmp`
  writeFileSync(scratch, contents)
  renameSync(scratch, target)
}

let installation: { readonly fontDir: string } | { readonly error: unknown } | undefined

/**
 * Install the bundled fonts and point fontconfig at them. Idempotent, and never throws — a sheet
 * with unreadable captions is worth more than no sheet at all, so callers log and carry on.
 *
 * @returns the directory fontconfig was pointed at, or `undefined` if installation failed.
 */
export function installBundledFonts(): string | undefined {
  if (installation) {
    return 'fontDir' in installation ? installation.fontDir : undefined
  }

  try {
    mkdirSync(FONT_DIR, { recursive: true })
    mkdirSync(FONT_CACHE_DIR, { recursive: true })

    for (const font of BUNDLED_FONTS) {
      const target = join(FONT_DIR, font.fileName)
      if (existsSync(target)) {
        continue
      }
      writeAtomic(target, gunzipSync(Buffer.from(font.gzipBase64, 'base64')))
    }

    writeAtomic(join(FONT_DIR, 'fonts.conf'), FONTS_CONF)

    process.env.FONTCONFIG_PATH = FONT_DIR
    installation = { fontDir: FONT_DIR }
    return FONT_DIR
  } catch (error) {
    installation = { error }
    return undefined
  }
}

/** The failure from the first {@link installBundledFonts} attempt, for logging. */
export function bundledFontsError(): unknown {
  return installation && 'error' in installation ? installation.error : undefined
}
