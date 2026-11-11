import { Fragment } from 'react'
import { AudioButton } from './AudioButton'

interface SoundExample {
  hanzi: string
  pinyin: string
  es: string
  audioUrl: string
}

interface ConsonantPair {
  unaspiratedLetter: string
  aspiratedLetter: string
  unaspirated: SoundExample
  aspirated: SoundExample
}

const PAIRS: ConsonantPair[] = [
  {
    unaspiratedLetter: 'b',
    aspiratedLetter: 'p',
    unaspirated: {
      hanzi: '八',
      pinyin: 'bā',
      es: 'ocho',
      audioUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/71/LL-Q9192_%28cmn%29-Luilui6666-%E5%85%AB.wav',
    },
    aspirated: {
      hanzi: '朋友',
      pinyin: 'péngyou',
      es: 'amigo',
      audioUrl: 'https://upload.wikimedia.org/wikipedia/commons/c/cc/LL-Q9192_%28cmn%29-Luilui6666-%E6%9C%8B%E5%8F%8B.wav',
    },
  },
  {
    unaspiratedLetter: 'd',
    aspiratedLetter: 't',
    unaspirated: {
      hanzi: '大',
      pinyin: 'dà',
      es: 'grande',
      audioUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/22/LL-Q9192_%28cmn%29-Luilui6666-%E5%A4%A7.wav',
    },
    aspirated: {
      hanzi: '他',
      pinyin: 'tā',
      es: 'él',
      audioUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/bb/LL-Q9192_%28cmn%29-Luilui6666-%E4%BB%96.wav',
    },
  },
  {
    unaspiratedLetter: 'g',
    aspiratedLetter: 'k',
    unaspirated: {
      hanzi: '高',
      pinyin: 'gāo',
      es: 'alto',
      audioUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/1f/LL-Q9192_%28cmn%29-Jouketou-%E9%AB%98.wav',
    },
    aspirated: {
      hanzi: '看',
      pinyin: 'kàn',
      es: 'ver/mirar',
      audioUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/7d/LL-Q9192_%28cmn%29-Luilui6666-%E7%9C%8B.wav',
    },
  },
  {
    unaspiratedLetter: 'j',
    aspiratedLetter: 'q',
    unaspirated: {
      hanzi: '家',
      pinyin: 'jiā',
      es: 'casa/familia',
      audioUrl: 'https://upload.wikimedia.org/wikipedia/commons/5/53/LL-Q9192_%28cmn%29-Luilui6666-%E5%AE%B6.wav',
    },
    aspirated: {
      hanzi: '去',
      pinyin: 'qù',
      es: 'ir',
      audioUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/09/LL-Q9192_%28cmn%29-Luilui6666-%E5%8E%BB.wav',
    },
  },
  {
    unaspiratedLetter: 'z',
    aspiratedLetter: 'c',
    unaspirated: {
      hanzi: '字',
      pinyin: 'zì',
      es: 'carácter/palabra',
      audioUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/ed/LL-Q9192_%28cmn%29-Jouketou-%E5%AD%97.wav',
    },
    aspirated: {
      hanzi: '菜',
      pinyin: 'cài',
      es: 'comida/verdura',
      audioUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/81/LL-Q9192_%28cmn%29-Levi_Highway_%28%E5%88%97%E7%BB%B4%E5%8A%B3%E5%BE%B7%29-%E8%8F%9C.wav',
    },
  },
]

function LetterLabel({ letter, strong }: { letter: string; strong: boolean }) {
  return (
    <span className={`text-center text-sm font-bold ${strong ? 'text-nurei-cta-hover' : 'text-nurei-muted'}`}>
      {letter}
    </span>
  )
}

function SoundPill({ item, strong }: { item: SoundExample; strong: boolean }) {
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 ${
        strong ? 'bg-nurei-cta/15' : 'bg-nurei-surface'
      }`}
    >
      <div className="text-left">
        <p
          className={`font-[family-name:var(--font-hanzi)] text-lg font-bold ${
            strong ? 'text-nurei-cta-hover' : 'text-nurei-black'
          }`}
        >
          {item.hanzi}
        </p>
        <p className="text-xs text-nurei-muted">
          {item.pinyin} · {item.es}
        </p>
      </div>
      <AudioButton src={item.audioUrl} />
    </div>
  )
}

export function ConsonantPairChart() {
  return (
    <div className="rounded-2xl border border-nurei-border bg-white p-3">
      <div className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-x-2 gap-y-2">
        <div className="col-span-2 flex items-center justify-center gap-1.5 pb-1 text-xs font-semibold text-nurei-muted">
          <span className="size-2 rounded-full border border-nurei-border bg-nurei-surface" />
          sin aire
        </div>
        <div className="col-span-2 flex items-center justify-center gap-1.5 pb-1 text-xs font-semibold text-nurei-cta-hover">
          <span className="size-2 rounded-full bg-nurei-cta" />
          con aire
        </div>

        {PAIRS.map((pair) => (
          <Fragment key={pair.unaspiratedLetter}>
            <LetterLabel letter={pair.unaspiratedLetter} strong={false} />
            <SoundPill item={pair.unaspirated} strong={false} />
            <LetterLabel letter={pair.aspiratedLetter} strong={true} />
            <SoundPill item={pair.aspirated} strong={true} />
          </Fragment>
        ))}
      </div>
    </div>
  )
}
