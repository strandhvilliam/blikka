import type { Config } from 'tailwindcss'

/*
 * This config replicates Tailwind v4's defaults so the v3 build renders the
 * same as the previous v4 setup:
 *  - `palette` ports v4's default color palette as sRGB hex (v4 ships oklch and
 *    v3's built-in palette uses older, less-saturated values). Hex keeps the
 *    output legacy-browser-safe while matching v4's tuned colors.
 *  - `spacing` reproduces v4's dynamic spacing scale (every 0.25rem step), since
 *    v3 only ships a fixed subset (no 13, 15, 17, 18, 19, 21, 22, 26, 68, ...).
 *  - `boxShadow` / `blur` reproduce v4's shifted shadow + blur scales.
 * Semantic tokens (background, primary, ...) read the channel-split CSS vars in
 * globals.css and re-add the `<alpha-value>` placeholder for opacity modifiers.
 */

// v4 default color palette as sRGB hex. Tailwind v3 still applies `/opacity`
// modifiers (e.g. `bg-red-500/50`) to plain hex colors automatically.
const palette = {
  slate: { '50': '#f8fafc', '100': '#f1f5f9', '200': '#e2e8f0', '300': '#cad5e2', '400': '#90a1b9', '500': '#62748e', '600': '#45556c', '700': '#314158', '800': '#1d293d', '900': '#0f172b', '950': '#020618' },
  gray: { '50': '#f9fafb', '100': '#f3f4f6', '200': '#e5e7eb', '300': '#d1d5dc', '400': '#99a1af', '500': '#6a7282', '600': '#4a5565', '700': '#364153', '800': '#1e2939', '900': '#101828', '950': '#030712' },
  zinc: { '50': '#fafafa', '100': '#f4f4f5', '200': '#e4e4e7', '300': '#d4d4d8', '400': '#9f9fa9', '500': '#71717b', '600': '#52525c', '700': '#3f3f46', '800': '#27272a', '900': '#18181b', '950': '#09090b' },
  neutral: { '50': '#fafafa', '100': '#f5f5f5', '200': '#e5e5e5', '300': '#d4d4d4', '400': '#a1a1a1', '500': '#737373', '600': '#525252', '700': '#404040', '800': '#262626', '900': '#171717', '950': '#0a0a0a' },
  stone: { '50': '#fafaf9', '100': '#f5f5f4', '200': '#e7e5e4', '300': '#d6d3d1', '400': '#a6a09b', '500': '#79716b', '600': '#57534d', '700': '#44403b', '800': '#292524', '900': '#1c1917', '950': '#0c0a09' },
  red: { '50': '#fef2f2', '100': '#ffe2e2', '200': '#ffc9c9', '300': '#ffa2a2', '400': '#ff6467', '500': '#fb2c36', '600': '#e7000b', '700': '#c10007', '800': '#9f0712', '900': '#82181a', '950': '#460809' },
  orange: { '50': '#fff7ed', '100': '#ffedd4', '200': '#ffd6a7', '300': '#ffb86a', '400': '#ff8904', '500': '#ff6900', '600': '#f54900', '700': '#ca3500', '800': '#9f2d00', '900': '#7e2a0c', '950': '#441306' },
  amber: { '50': '#fffbeb', '100': '#fef3c6', '200': '#fee685', '300': '#ffd230', '400': '#ffb900', '500': '#fe9a00', '600': '#e17100', '700': '#bb4d00', '800': '#973c00', '900': '#7b3306', '950': '#461901' },
  yellow: { '50': '#fefce8', '100': '#fef9c2', '200': '#fff085', '300': '#ffdf20', '400': '#fdc700', '500': '#f0b100', '600': '#d08700', '700': '#a65f00', '800': '#894b00', '900': '#733e0a', '950': '#432004' },
  lime: { '50': '#f7fee7', '100': '#ecfcca', '200': '#d8f999', '300': '#bbf451', '400': '#9ae600', '500': '#7ccf00', '600': '#5ea500', '700': '#497d00', '800': '#3c6300', '900': '#35530e', '950': '#192e03' },
  green: { '50': '#f0fdf4', '100': '#dcfce7', '200': '#b9f8cf', '300': '#7bf1a8', '400': '#05df72', '500': '#00c950', '600': '#00a63e', '700': '#008236', '800': '#016630', '900': '#0d542b', '950': '#032e15' },
  emerald: { '50': '#ecfdf5', '100': '#d0fae5', '200': '#a4f4cf', '300': '#5ee9b5', '400': '#00d492', '500': '#00bc7d', '600': '#009966', '700': '#007a55', '800': '#006045', '900': '#004f3b', '950': '#002c22' },
  teal: { '50': '#f0fdfa', '100': '#cbfbf1', '200': '#96f7e4', '300': '#46ecd5', '400': '#00d5be', '500': '#00bba7', '600': '#009689', '700': '#00786f', '800': '#005f5a', '900': '#0b4f4a', '950': '#022f2e' },
  cyan: { '50': '#ecfeff', '100': '#cefafe', '200': '#a2f4fd', '300': '#53eafd', '400': '#00d3f2', '500': '#00b8db', '600': '#0092b8', '700': '#007595', '800': '#005f78', '900': '#104e64', '950': '#053345' },
  sky: { '50': '#f0f9ff', '100': '#dff2fe', '200': '#b8e6fe', '300': '#74d4ff', '400': '#00bcff', '500': '#00a6f4', '600': '#0084d1', '700': '#0069a8', '800': '#00598a', '900': '#024a70', '950': '#052f4a' },
  blue: { '50': '#eff6ff', '100': '#dbeafe', '200': '#bedbff', '300': '#8ec5ff', '400': '#51a2ff', '500': '#2b7fff', '600': '#155dfc', '700': '#1447e6', '800': '#193cb8', '900': '#1c398e', '950': '#162456' },
  indigo: { '50': '#eef2ff', '100': '#e0e7ff', '200': '#c6d2ff', '300': '#a3b3ff', '400': '#7c86ff', '500': '#615fff', '600': '#4f39f6', '700': '#432dd7', '800': '#372aac', '900': '#312c85', '950': '#1e1a4d' },
  violet: { '50': '#f5f3ff', '100': '#ede9fe', '200': '#ddd6ff', '300': '#c4b4ff', '400': '#a684ff', '500': '#8e51ff', '600': '#7f22fe', '700': '#7008e7', '800': '#5d0ec0', '900': '#4d179a', '950': '#2f0d68' },
  purple: { '50': '#faf5ff', '100': '#f3e8ff', '200': '#e9d4ff', '300': '#dab2ff', '400': '#c27aff', '500': '#ad46ff', '600': '#9810fa', '700': '#8200db', '800': '#6e11b0', '900': '#59168b', '950': '#3c0366' },
  fuchsia: { '50': '#fdf4ff', '100': '#fae8ff', '200': '#f6cfff', '300': '#f4a8ff', '400': '#ed6aff', '500': '#e12afb', '600': '#c800de', '700': '#a800b7', '800': '#8a0194', '900': '#721378', '950': '#4b004f' },
  pink: { '50': '#fdf2f8', '100': '#fce7f3', '200': '#fccee8', '300': '#fda5d5', '400': '#fb64b6', '500': '#f6339a', '600': '#e60076', '700': '#c6005c', '800': '#a3004c', '900': '#861043', '950': '#510424' },
  rose: { '50': '#fff1f2', '100': '#ffe4e6', '200': '#ffccd3', '300': '#ffa1ad', '400': '#ff637e', '500': '#ff2056', '600': '#ec003f', '700': '#c70036', '800': '#a50036', '900': '#8b0836', '950': '#4d0218' },
}

// v4's spacing model: every 0.25rem step (v3 only ships a fixed subset).
const spacing: Record<string, string> = { px: '1px', '0': '0px' }
for (let i = 0.5; i <= 96; i += 0.5) spacing[String(i)] = `${i * 0.25}rem`

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx,js,jsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ...palette,
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
          foreground: 'hsl(var(--popover-foreground) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
        },
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        chart: {
          '1': 'hsl(var(--chart-1) / <alpha-value>)',
          '2': 'hsl(var(--chart-2) / <alpha-value>)',
          '3': 'hsl(var(--chart-3) / <alpha-value>)',
          '4': 'hsl(var(--chart-4) / <alpha-value>)',
          '5': 'hsl(var(--chart-5) / <alpha-value>)',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar) / <alpha-value>)',
          foreground: 'hsl(var(--sidebar-foreground) / <alpha-value>)',
          primary: 'hsl(var(--sidebar-primary) / <alpha-value>)',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground) / <alpha-value>)',
          accent: 'hsl(var(--sidebar-accent) / <alpha-value>)',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground) / <alpha-value>)',
          border: 'hsl(var(--sidebar-border) / <alpha-value>)',
          ring: 'hsl(var(--sidebar-ring) / <alpha-value>)',
        },
        brand: {
          primary: 'hsl(var(--brand-primary) / <alpha-value>)',
          white: 'hsl(var(--brand-white) / <alpha-value>)',
          black: 'hsl(var(--brand-black) / <alpha-value>)',
          gray: 'hsl(var(--brand-gray) / <alpha-value>)',
        },
      },
      spacing,
      minWidth: spacing,
      maxWidth: spacing,
      minHeight: spacing,
      maxHeight: spacing,
      borderRadius: {
        xs: '0.125rem',
        sm: 'calc(var(--radius) - 4px)',
        md: 'calc(var(--radius) - 2px)',
        lg: 'var(--radius)',
        xl: 'calc(var(--radius) + 4px)',
      },
      boxShadow: {
        '2xs': '0 1px rgb(0 0 0 / 0.05)',
        xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        sm: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
        none: 'none',
      },
      blur: {
        xs: '4px',
        sm: '8px',
        DEFAULT: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        '2xl': '40px',
        '3xl': '64px',
      },
      backdropBlur: {
        xs: '4px',
        sm: '8px',
        DEFAULT: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        '2xl': '40px',
        '3xl': '64px',
      },
      ringWidth: {
        DEFAULT: '1px',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)'],
        mono: ['var(--font-geist-mono)'],
        'special-gothic': ['var(--font-special-gothic)'],
        gothic: ['var(--font-gothic)'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'caret-blink': {
          '0%,70%,100%': { opacity: '1' },
          '20%,50%': { opacity: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'caret-blink': 'caret-blink 1.25s ease-out infinite',
        'hero-fade-in-from-bottom': 'hero-fade-in-from-bottom 0.6s ease-out both',
        'hero-fade-in-from-top': 'hero-fade-in-from-top 0.5s ease-out both',
        'hero-fade-in-from-left': 'hero-fade-in-from-left 0.5s ease-out both',
        'hero-fade-in': 'hero-fade-in 0.5s ease-out both',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
