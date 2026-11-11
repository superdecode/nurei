import { AudioButton } from './AudioButton'

interface PinyinFullChartProps {
  haoAudioUrl?: string | null
}

interface LetterNote {
  letter: string
  note: string
}

interface InitialGroup {
  group: string
  items: LetterNote[]
}

const INITIALS: InitialGroup[] = [
  {
    group: 'Labiales',
    items: [
      { letter: 'b', note: 'como en español' },
      { letter: 'p', note: 'con aire' },
      { letter: 'm', note: 'como en español' },
      { letter: 'f', note: 'como en español' },
    ],
  },
  {
    group: 'Alveolares',
    items: [
      { letter: 'd', note: 'como en español' },
      { letter: 't', note: 'con aire' },
      { letter: 'n', note: 'como en español' },
      { letter: 'l', note: 'como en español' },
    ],
  },
  {
    group: 'Velares',
    items: [
      { letter: 'g', note: 'como en español' },
      { letter: 'k', note: 'con aire' },
      { letter: 'h', note: 'más áspera que la j española' },
    ],
  },
  {
    group: 'Palatales',
    items: [
      { letter: 'j', note: 'sin aire' },
      { letter: 'q', note: 'con aire' },
      { letter: 'x', note: '"sh" suave, no como la x española' },
    ],
  },
  {
    group: 'Retroflejas',
    items: [
      { letter: 'zh', note: 'sin aire, lengua hacia atrás' },
      { letter: 'ch', note: 'con aire, lengua hacia atrás' },
      { letter: 'sh', note: 'lengua hacia atrás' },
      { letter: 'r', note: 'sin equivalente en español' },
    ],
  },
  {
    group: 'Sibilantes',
    items: [
      { letter: 'z', note: 'sin aire, como "ds"' },
      { letter: 'c', note: 'con aire, como "ts"' },
      { letter: 's', note: 'como en español' },
    ],
  },
  {
    group: 'Semivocales',
    items: [
      { letter: 'y', note: 'como la "y" del inglés' },
      { letter: 'w', note: 'como la "w" del inglés' },
    ],
  },
]

const FINALS: LetterNote[] = [
  { letter: 'a', note: 'como en español' },
  { letter: 'o', note: 'como en español, labios más redondos' },
  { letter: 'e', note: 'sonido gutural que no existe en español' },
  { letter: 'i', note: 'como en español (distinto tras zh/ch/sh/r/z/c/s)' },
  { letter: 'u', note: 'como en español' },
  { letter: 'ü', note: 'labios redondeados, sin equivalente en español' },
]

function LetterChip({ letter, note }: LetterNote) {
  return (
    <div className="flex items-baseline gap-1.5 rounded-lg border border-nurei-border bg-nurei-surface px-2.5 py-1.5">
      <span className="font-mono text-sm font-bold text-nurei-black">{letter}</span>
      <span className="text-xs text-nurei-muted">{note}</span>
    </div>
  )
}

export function PinyinFullChart({ haoAudioUrl }: PinyinFullChartProps) {
  return (
    <div className="space-y-4 rounded-2xl border border-nurei-border bg-white p-4">
      <div>
        <p className="mb-2 text-xs font-bold tracking-widest text-nurei-cta-hover uppercase">
          Las 21 consonantes iniciales
        </p>
        <div className="space-y-2">
          {INITIALS.map((group) => (
            <div key={group.group} className="flex flex-wrap items-center gap-1.5">
              <span className="w-24 shrink-0 text-xs text-nurei-muted">{group.group}</span>
              {group.items.map((item) => (
                <LetterChip key={item.letter} {...item} />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold tracking-widest text-nurei-cta-hover uppercase">Las 6 vocales/finales simples</p>
        <div className="flex flex-wrap gap-1.5">
          {FINALS.map((item) => (
            <LetterChip key={item.letter} {...item} />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-nurei-muted">
          Toda sílaba de pinyin combina una inicial (opcional) con una final: 好 (hǎo) es la inicial h más la final
          ao.
        </p>
        <div className="flex items-center gap-2 self-start rounded-xl border border-nurei-border bg-nurei-surface px-3 py-2">
          <span className="font-[family-name:var(--font-hanzi)] text-lg font-bold text-nurei-black">好</span>
          <span className="text-xs text-nurei-muted">hǎo</span>
          {haoAudioUrl && <AudioButton src={haoAudioUrl} />}
        </div>
        <p className="text-xs text-nurei-muted">
          Las finales también se combinan entre sí (ai, an, ang, ian...), pero siempre a partir de estas 6 vocales
          base.
        </p>
      </div>
    </div>
  )
}
