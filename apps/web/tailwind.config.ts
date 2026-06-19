import type { Config } from 'tailwindcss'

/*
 * This config replicates Tailwind v4's defaults so the v3 build renders the
 * same as the previous v4 setup:
 *  - `palette` ports v4's oklch default color palette (v3's built-in palette
 *    uses older, less-saturated sRGB values).
 *  - `spacing` reproduces v4's dynamic spacing scale (every 0.25rem step), since
 *    v3 only ships a fixed subset (no 13, 15, 17, 18, 19, 21, 22, 26, 68, ...).
 *  - `boxShadow` / `blur` reproduce v4's shifted shadow + blur scales.
 * Semantic tokens (background, primary, ...) read the channel-split CSS vars in
 * globals.css and re-add the `<alpha-value>` placeholder for opacity modifiers.
 */

// v4 default color palette (oklch), with the alpha placeholder for `/opacity`.
const palette = {
  slate: { '50': 'oklch(98.4% 0.003 247.858 / <alpha-value>)', '100': 'oklch(96.8% 0.007 247.896 / <alpha-value>)', '200': 'oklch(92.9% 0.013 255.508 / <alpha-value>)', '300': 'oklch(86.9% 0.022 252.894 / <alpha-value>)', '400': 'oklch(70.4% 0.04 256.788 / <alpha-value>)', '500': 'oklch(55.4% 0.046 257.417 / <alpha-value>)', '600': 'oklch(44.6% 0.043 257.281 / <alpha-value>)', '700': 'oklch(37.2% 0.044 257.287 / <alpha-value>)', '800': 'oklch(27.9% 0.041 260.031 / <alpha-value>)', '900': 'oklch(20.8% 0.042 265.755 / <alpha-value>)', '950': 'oklch(12.9% 0.042 264.695 / <alpha-value>)' },
  gray: { '50': 'oklch(98.5% 0.002 247.839 / <alpha-value>)', '100': 'oklch(96.7% 0.003 264.542 / <alpha-value>)', '200': 'oklch(92.8% 0.006 264.531 / <alpha-value>)', '300': 'oklch(87.2% 0.01 258.338 / <alpha-value>)', '400': 'oklch(70.7% 0.022 261.325 / <alpha-value>)', '500': 'oklch(55.1% 0.027 264.364 / <alpha-value>)', '600': 'oklch(44.6% 0.03 256.802 / <alpha-value>)', '700': 'oklch(37.3% 0.034 259.733 / <alpha-value>)', '800': 'oklch(27.8% 0.033 256.848 / <alpha-value>)', '900': 'oklch(21% 0.034 264.665 / <alpha-value>)', '950': 'oklch(13% 0.028 261.692 / <alpha-value>)' },
  zinc: { '50': 'oklch(98.5% 0 0 / <alpha-value>)', '100': 'oklch(96.7% 0.001 286.375 / <alpha-value>)', '200': 'oklch(92% 0.004 286.32 / <alpha-value>)', '300': 'oklch(87.1% 0.006 286.286 / <alpha-value>)', '400': 'oklch(70.5% 0.015 286.067 / <alpha-value>)', '500': 'oklch(55.2% 0.016 285.938 / <alpha-value>)', '600': 'oklch(44.2% 0.017 285.786 / <alpha-value>)', '700': 'oklch(37% 0.013 285.805 / <alpha-value>)', '800': 'oklch(27.4% 0.006 286.033 / <alpha-value>)', '900': 'oklch(21% 0.006 285.885 / <alpha-value>)', '950': 'oklch(14.1% 0.005 285.823 / <alpha-value>)' },
  neutral: { '50': 'oklch(98.5% 0 0 / <alpha-value>)', '100': 'oklch(97% 0 0 / <alpha-value>)', '200': 'oklch(92.2% 0 0 / <alpha-value>)', '300': 'oklch(87% 0 0 / <alpha-value>)', '400': 'oklch(70.8% 0 0 / <alpha-value>)', '500': 'oklch(55.6% 0 0 / <alpha-value>)', '600': 'oklch(43.9% 0 0 / <alpha-value>)', '700': 'oklch(37.1% 0 0 / <alpha-value>)', '800': 'oklch(26.9% 0 0 / <alpha-value>)', '900': 'oklch(20.5% 0 0 / <alpha-value>)', '950': 'oklch(14.5% 0 0 / <alpha-value>)' },
  stone: { '50': 'oklch(98.5% 0.001 106.423 / <alpha-value>)', '100': 'oklch(97% 0.001 106.424 / <alpha-value>)', '200': 'oklch(92.3% 0.003 48.717 / <alpha-value>)', '300': 'oklch(86.9% 0.005 56.366 / <alpha-value>)', '400': 'oklch(70.9% 0.01 56.259 / <alpha-value>)', '500': 'oklch(55.3% 0.013 58.071 / <alpha-value>)', '600': 'oklch(44.4% 0.011 73.639 / <alpha-value>)', '700': 'oklch(37.4% 0.01 67.558 / <alpha-value>)', '800': 'oklch(26.8% 0.007 34.298 / <alpha-value>)', '900': 'oklch(21.6% 0.006 56.043 / <alpha-value>)', '950': 'oklch(14.7% 0.004 49.25 / <alpha-value>)' },
  red: { '50': 'oklch(97.1% 0.013 17.38 / <alpha-value>)', '100': 'oklch(93.6% 0.032 17.717 / <alpha-value>)', '200': 'oklch(88.5% 0.062 18.334 / <alpha-value>)', '300': 'oklch(80.8% 0.114 19.571 / <alpha-value>)', '400': 'oklch(70.4% 0.191 22.216 / <alpha-value>)', '500': 'oklch(63.7% 0.237 25.331 / <alpha-value>)', '600': 'oklch(57.7% 0.245 27.325 / <alpha-value>)', '700': 'oklch(50.5% 0.213 27.518 / <alpha-value>)', '800': 'oklch(44.4% 0.177 26.899 / <alpha-value>)', '900': 'oklch(39.6% 0.141 25.723 / <alpha-value>)', '950': 'oklch(25.8% 0.092 26.042 / <alpha-value>)' },
  orange: { '50': 'oklch(98% 0.016 73.684 / <alpha-value>)', '100': 'oklch(95.4% 0.038 75.164 / <alpha-value>)', '200': 'oklch(90.1% 0.076 70.697 / <alpha-value>)', '300': 'oklch(83.7% 0.128 66.29 / <alpha-value>)', '400': 'oklch(75% 0.183 55.934 / <alpha-value>)', '500': 'oklch(70.5% 0.213 47.604 / <alpha-value>)', '600': 'oklch(64.6% 0.222 41.116 / <alpha-value>)', '700': 'oklch(55.3% 0.195 38.402 / <alpha-value>)', '800': 'oklch(47% 0.157 37.304 / <alpha-value>)', '900': 'oklch(40.8% 0.123 38.172 / <alpha-value>)', '950': 'oklch(26.6% 0.079 36.259 / <alpha-value>)' },
  amber: { '50': 'oklch(98.7% 0.022 95.277 / <alpha-value>)', '100': 'oklch(96.2% 0.059 95.617 / <alpha-value>)', '200': 'oklch(92.4% 0.12 95.746 / <alpha-value>)', '300': 'oklch(87.9% 0.169 91.605 / <alpha-value>)', '400': 'oklch(82.8% 0.189 84.429 / <alpha-value>)', '500': 'oklch(76.9% 0.188 70.08 / <alpha-value>)', '600': 'oklch(66.6% 0.179 58.318 / <alpha-value>)', '700': 'oklch(55.5% 0.163 48.998 / <alpha-value>)', '800': 'oklch(47.3% 0.137 46.201 / <alpha-value>)', '900': 'oklch(41.4% 0.112 45.904 / <alpha-value>)', '950': 'oklch(27.9% 0.077 45.635 / <alpha-value>)' },
  yellow: { '50': 'oklch(98.7% 0.026 102.212 / <alpha-value>)', '100': 'oklch(97.3% 0.071 103.193 / <alpha-value>)', '200': 'oklch(94.5% 0.129 101.54 / <alpha-value>)', '300': 'oklch(90.5% 0.182 98.111 / <alpha-value>)', '400': 'oklch(85.2% 0.199 91.936 / <alpha-value>)', '500': 'oklch(79.5% 0.184 86.047 / <alpha-value>)', '600': 'oklch(68.1% 0.162 75.834 / <alpha-value>)', '700': 'oklch(55.4% 0.135 66.442 / <alpha-value>)', '800': 'oklch(47.6% 0.114 61.907 / <alpha-value>)', '900': 'oklch(42.1% 0.095 57.708 / <alpha-value>)', '950': 'oklch(28.6% 0.066 53.813 / <alpha-value>)' },
  lime: { '50': 'oklch(98.6% 0.031 120.757 / <alpha-value>)', '100': 'oklch(96.7% 0.067 122.328 / <alpha-value>)', '200': 'oklch(93.8% 0.127 124.321 / <alpha-value>)', '300': 'oklch(89.7% 0.196 126.665 / <alpha-value>)', '400': 'oklch(84.1% 0.238 128.85 / <alpha-value>)', '500': 'oklch(76.8% 0.233 130.85 / <alpha-value>)', '600': 'oklch(64.8% 0.2 131.684 / <alpha-value>)', '700': 'oklch(53.2% 0.157 131.589 / <alpha-value>)', '800': 'oklch(45.3% 0.124 130.933 / <alpha-value>)', '900': 'oklch(40.5% 0.101 131.063 / <alpha-value>)', '950': 'oklch(27.4% 0.072 132.109 / <alpha-value>)' },
  green: { '50': 'oklch(98.2% 0.018 155.826 / <alpha-value>)', '100': 'oklch(96.2% 0.044 156.743 / <alpha-value>)', '200': 'oklch(92.5% 0.084 155.995 / <alpha-value>)', '300': 'oklch(87.1% 0.15 154.449 / <alpha-value>)', '400': 'oklch(79.2% 0.209 151.711 / <alpha-value>)', '500': 'oklch(72.3% 0.219 149.579 / <alpha-value>)', '600': 'oklch(62.7% 0.194 149.214 / <alpha-value>)', '700': 'oklch(52.7% 0.154 150.069 / <alpha-value>)', '800': 'oklch(44.8% 0.119 151.328 / <alpha-value>)', '900': 'oklch(39.3% 0.095 152.535 / <alpha-value>)', '950': 'oklch(26.6% 0.065 152.934 / <alpha-value>)' },
  emerald: { '50': 'oklch(97.9% 0.021 166.113 / <alpha-value>)', '100': 'oklch(95% 0.052 163.051 / <alpha-value>)', '200': 'oklch(90.5% 0.093 164.15 / <alpha-value>)', '300': 'oklch(84.5% 0.143 164.978 / <alpha-value>)', '400': 'oklch(76.5% 0.177 163.223 / <alpha-value>)', '500': 'oklch(69.6% 0.17 162.48 / <alpha-value>)', '600': 'oklch(59.6% 0.145 163.225 / <alpha-value>)', '700': 'oklch(50.8% 0.118 165.612 / <alpha-value>)', '800': 'oklch(43.2% 0.095 166.913 / <alpha-value>)', '900': 'oklch(37.8% 0.077 168.94 / <alpha-value>)', '950': 'oklch(26.2% 0.051 172.552 / <alpha-value>)' },
  teal: { '50': 'oklch(98.4% 0.014 180.72 / <alpha-value>)', '100': 'oklch(95.3% 0.051 180.801 / <alpha-value>)', '200': 'oklch(91% 0.096 180.426 / <alpha-value>)', '300': 'oklch(85.5% 0.138 181.071 / <alpha-value>)', '400': 'oklch(77.7% 0.152 181.912 / <alpha-value>)', '500': 'oklch(70.4% 0.14 182.503 / <alpha-value>)', '600': 'oklch(60% 0.118 184.704 / <alpha-value>)', '700': 'oklch(51.1% 0.096 186.391 / <alpha-value>)', '800': 'oklch(43.7% 0.078 188.216 / <alpha-value>)', '900': 'oklch(38.6% 0.063 188.416 / <alpha-value>)', '950': 'oklch(27.7% 0.046 192.524 / <alpha-value>)' },
  cyan: { '50': 'oklch(98.4% 0.019 200.873 / <alpha-value>)', '100': 'oklch(95.6% 0.045 203.388 / <alpha-value>)', '200': 'oklch(91.7% 0.08 205.041 / <alpha-value>)', '300': 'oklch(86.5% 0.127 207.078 / <alpha-value>)', '400': 'oklch(78.9% 0.154 211.53 / <alpha-value>)', '500': 'oklch(71.5% 0.143 215.221 / <alpha-value>)', '600': 'oklch(60.9% 0.126 221.723 / <alpha-value>)', '700': 'oklch(52% 0.105 223.128 / <alpha-value>)', '800': 'oklch(45% 0.085 224.283 / <alpha-value>)', '900': 'oklch(39.8% 0.07 227.392 / <alpha-value>)', '950': 'oklch(30.2% 0.056 229.695 / <alpha-value>)' },
  sky: { '50': 'oklch(97.7% 0.013 236.62 / <alpha-value>)', '100': 'oklch(95.1% 0.026 236.824 / <alpha-value>)', '200': 'oklch(90.1% 0.058 230.902 / <alpha-value>)', '300': 'oklch(82.8% 0.111 230.318 / <alpha-value>)', '400': 'oklch(74.6% 0.16 232.661 / <alpha-value>)', '500': 'oklch(68.5% 0.169 237.323 / <alpha-value>)', '600': 'oklch(58.8% 0.158 241.966 / <alpha-value>)', '700': 'oklch(50% 0.134 242.749 / <alpha-value>)', '800': 'oklch(44.3% 0.11 240.79 / <alpha-value>)', '900': 'oklch(39.1% 0.09 240.876 / <alpha-value>)', '950': 'oklch(29.3% 0.066 243.157 / <alpha-value>)' },
  blue: { '50': 'oklch(97% 0.014 254.604 / <alpha-value>)', '100': 'oklch(93.2% 0.032 255.585 / <alpha-value>)', '200': 'oklch(88.2% 0.059 254.128 / <alpha-value>)', '300': 'oklch(80.9% 0.105 251.813 / <alpha-value>)', '400': 'oklch(70.7% 0.165 254.624 / <alpha-value>)', '500': 'oklch(62.3% 0.214 259.815 / <alpha-value>)', '600': 'oklch(54.6% 0.245 262.881 / <alpha-value>)', '700': 'oklch(48.8% 0.243 264.376 / <alpha-value>)', '800': 'oklch(42.4% 0.199 265.638 / <alpha-value>)', '900': 'oklch(37.9% 0.146 265.522 / <alpha-value>)', '950': 'oklch(28.2% 0.091 267.935 / <alpha-value>)' },
  indigo: { '50': 'oklch(96.2% 0.018 272.314 / <alpha-value>)', '100': 'oklch(93% 0.034 272.788 / <alpha-value>)', '200': 'oklch(87% 0.065 274.039 / <alpha-value>)', '300': 'oklch(78.5% 0.115 274.713 / <alpha-value>)', '400': 'oklch(67.3% 0.182 276.935 / <alpha-value>)', '500': 'oklch(58.5% 0.233 277.117 / <alpha-value>)', '600': 'oklch(51.1% 0.262 276.966 / <alpha-value>)', '700': 'oklch(45.7% 0.24 277.023 / <alpha-value>)', '800': 'oklch(39.8% 0.195 277.366 / <alpha-value>)', '900': 'oklch(35.9% 0.144 278.697 / <alpha-value>)', '950': 'oklch(25.7% 0.09 281.288 / <alpha-value>)' },
  violet: { '50': 'oklch(96.9% 0.016 293.756 / <alpha-value>)', '100': 'oklch(94.3% 0.029 294.588 / <alpha-value>)', '200': 'oklch(89.4% 0.057 293.283 / <alpha-value>)', '300': 'oklch(81.1% 0.111 293.571 / <alpha-value>)', '400': 'oklch(70.2% 0.183 293.541 / <alpha-value>)', '500': 'oklch(60.6% 0.25 292.717 / <alpha-value>)', '600': 'oklch(54.1% 0.281 293.009 / <alpha-value>)', '700': 'oklch(49.1% 0.27 292.581 / <alpha-value>)', '800': 'oklch(43.2% 0.232 292.759 / <alpha-value>)', '900': 'oklch(38% 0.189 293.745 / <alpha-value>)', '950': 'oklch(28.3% 0.141 291.089 / <alpha-value>)' },
  purple: { '50': 'oklch(97.7% 0.014 308.299 / <alpha-value>)', '100': 'oklch(94.6% 0.033 307.174 / <alpha-value>)', '200': 'oklch(90.2% 0.063 306.703 / <alpha-value>)', '300': 'oklch(82.7% 0.119 306.383 / <alpha-value>)', '400': 'oklch(71.4% 0.203 305.504 / <alpha-value>)', '500': 'oklch(62.7% 0.265 303.9 / <alpha-value>)', '600': 'oklch(55.8% 0.288 302.321 / <alpha-value>)', '700': 'oklch(49.6% 0.265 301.924 / <alpha-value>)', '800': 'oklch(43.8% 0.218 303.724 / <alpha-value>)', '900': 'oklch(38.1% 0.176 304.987 / <alpha-value>)', '950': 'oklch(29.1% 0.149 302.717 / <alpha-value>)' },
  fuchsia: { '50': 'oklch(97.7% 0.017 320.058 / <alpha-value>)', '100': 'oklch(95.2% 0.037 318.852 / <alpha-value>)', '200': 'oklch(90.3% 0.076 319.62 / <alpha-value>)', '300': 'oklch(83.3% 0.145 321.434 / <alpha-value>)', '400': 'oklch(74% 0.238 322.16 / <alpha-value>)', '500': 'oklch(66.7% 0.295 322.15 / <alpha-value>)', '600': 'oklch(59.1% 0.293 322.896 / <alpha-value>)', '700': 'oklch(51.8% 0.253 323.949 / <alpha-value>)', '800': 'oklch(45.2% 0.211 324.591 / <alpha-value>)', '900': 'oklch(40.1% 0.17 325.612 / <alpha-value>)', '950': 'oklch(29.3% 0.136 325.661 / <alpha-value>)' },
  pink: { '50': 'oklch(97.1% 0.014 343.198 / <alpha-value>)', '100': 'oklch(94.8% 0.028 342.258 / <alpha-value>)', '200': 'oklch(89.9% 0.061 343.231 / <alpha-value>)', '300': 'oklch(82.3% 0.12 346.018 / <alpha-value>)', '400': 'oklch(71.8% 0.202 349.761 / <alpha-value>)', '500': 'oklch(65.6% 0.241 354.308 / <alpha-value>)', '600': 'oklch(59.2% 0.249 0.584 / <alpha-value>)', '700': 'oklch(52.5% 0.223 3.958 / <alpha-value>)', '800': 'oklch(45.9% 0.187 3.815 / <alpha-value>)', '900': 'oklch(40.8% 0.153 2.432 / <alpha-value>)', '950': 'oklch(28.4% 0.109 3.907 / <alpha-value>)' },
  rose: { '50': 'oklch(96.9% 0.015 12.422 / <alpha-value>)', '100': 'oklch(94.1% 0.03 12.58 / <alpha-value>)', '200': 'oklch(89.2% 0.058 10.001 / <alpha-value>)', '300': 'oklch(81% 0.117 11.638 / <alpha-value>)', '400': 'oklch(71.2% 0.194 13.428 / <alpha-value>)', '500': 'oklch(64.5% 0.246 16.439 / <alpha-value>)', '600': 'oklch(58.6% 0.253 17.585 / <alpha-value>)', '700': 'oklch(51.4% 0.222 16.935 / <alpha-value>)', '800': 'oklch(45.5% 0.188 13.697 / <alpha-value>)', '900': 'oklch(41% 0.159 10.272 / <alpha-value>)', '950': 'oklch(27.1% 0.105 12.094 / <alpha-value>)' },
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
        background: 'oklch(var(--background) / <alpha-value>)',
        foreground: 'oklch(var(--foreground) / <alpha-value>)',
        card: {
          DEFAULT: 'oklch(var(--card) / <alpha-value>)',
          foreground: 'oklch(var(--card-foreground) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'oklch(var(--popover) / <alpha-value>)',
          foreground: 'oklch(var(--popover-foreground) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'oklch(var(--primary) / <alpha-value>)',
          foreground: 'oklch(var(--primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'oklch(var(--secondary) / <alpha-value>)',
          foreground: 'oklch(var(--secondary-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'oklch(var(--muted) / <alpha-value>)',
          foreground: 'oklch(var(--muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'oklch(var(--accent) / <alpha-value>)',
          foreground: 'oklch(var(--accent-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'oklch(var(--destructive) / <alpha-value>)',
        },
        border: 'oklch(var(--border) / <alpha-value>)',
        input: 'oklch(var(--input) / <alpha-value>)',
        ring: 'oklch(var(--ring) / <alpha-value>)',
        chart: {
          '1': 'oklch(var(--chart-1) / <alpha-value>)',
          '2': 'oklch(var(--chart-2) / <alpha-value>)',
          '3': 'oklch(var(--chart-3) / <alpha-value>)',
          '4': 'oklch(var(--chart-4) / <alpha-value>)',
          '5': 'oklch(var(--chart-5) / <alpha-value>)',
        },
        sidebar: {
          DEFAULT: 'oklch(var(--sidebar) / <alpha-value>)',
          foreground: 'oklch(var(--sidebar-foreground) / <alpha-value>)',
          primary: 'oklch(var(--sidebar-primary) / <alpha-value>)',
          'primary-foreground': 'oklch(var(--sidebar-primary-foreground) / <alpha-value>)',
          accent: 'oklch(var(--sidebar-accent) / <alpha-value>)',
          'accent-foreground': 'oklch(var(--sidebar-accent-foreground) / <alpha-value>)',
          border: 'oklch(var(--sidebar-border) / <alpha-value>)',
          ring: 'oklch(var(--sidebar-ring) / <alpha-value>)',
        },
        brand: {
          primary: 'oklch(var(--brand-primary) / <alpha-value>)',
          white: 'oklch(var(--brand-white) / <alpha-value>)',
          black: 'oklch(var(--brand-black) / <alpha-value>)',
          gray: 'oklch(var(--brand-gray) / <alpha-value>)',
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
