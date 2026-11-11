import { Noto_Serif_SC } from 'next/font/google'

// Hanzi need a CJK-aware serif for legibility at display size — Inter (the
// site's body font) has no real Chinese glyph coverage and renders 汉字 at
// body-text weight, which is illegible for a language-learning product.
export const notoSerifSC = Noto_Serif_SC({
  variable: '--font-hanzi',
  weight: ['500', '700'],
  subsets: ['latin'],
  display: 'optional',
  fallback: ['PingFang SC', 'Microsoft YaHei', 'serif'],
})
