interface HanziWithPinyinProps {
  hanzi: string
  pinyin: string
  showPinyin: boolean
  variant?: 'light' | 'dark'
  className?: string
}

export function HanziWithPinyin({ hanzi, pinyin, showPinyin, variant = 'light', className = '' }: HanziWithPinyinProps) {
  const rtColorClass = variant === 'dark' ? 'text-white/60' : 'text-nurei-muted'

  if (!showPinyin) {
    return <span className={`font-[family-name:var(--font-hanzi)] ${className}`}>{hanzi}</span>
  }

  return (
    <ruby className={`font-[family-name:var(--font-hanzi)] ${className}`}>
      {hanzi}
      <rt className={`font-sans text-[0.4em] leading-none font-normal ${rtColorClass}`}>{pinyin}</rt>
    </ruby>
  )
}
