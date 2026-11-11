'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Info,
  Lock,
  MessageSquareQuote,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { fetchWithCredentials } from '@/lib/http/fetch-with-credentials'
import type {
  MandarinLessonDetail,
  MandarinVocabItem,
  MandarinVocabMultipleChoiceData,
  MandarinSentenceOrderData,
} from '@/types/mandarin'
import { VocabMultipleChoice, SentenceOrder } from './exercises'
import { AudioButton } from './AudioButton'
import { VocabExampleModal } from './VocabExampleModal'
import { PinyinCallout } from './PinyinCallout'
import { ToneChart } from './ToneChart'
import { ConsonantPairChart } from './ConsonantPairChart'
import { PinyinFullChart } from './PinyinFullChart'
import { AdvancedNoteCallout } from './AdvancedNoteCallout'
import { HanziWithPinyin } from './HanziWithPinyin'
import { usePinyinVisibility, ALWAYS_VISIBLE_LESSON_SLUGS } from './usePinyinVisibility'
import { notoSerifSC } from '../../fonts'

const PINYIN_LESSON_LINKS: Record<string, { href: string; label: string }> = {
  pinyin: { href: '/mandarin/leccion/tonos', label: 'Sigue con: Los tonos' },
  tonos: { href: '/mandarin/leccion/pinyin', label: 'Repasa: El pinyin' },
}

const PINYIN_SECTION_CATEGORY_BY_ORDER: Record<number, string> = {
  1: 'Resumen',
  2: 'Consonantes',
  3: 'Consonantes',
  4: 'Vocales y finales',
  5: 'Vocales y finales',
}

function getSectionCategory(lessonSlug: string, orderIndex: number): string | null {
  if (lessonSlug === 'pinyin') return PINYIN_SECTION_CATEGORY_BY_ORDER[orderIndex] ?? null
  return null
}

interface LessonPlayerProps {
  lesson: MandarinLessonDetail
  isAuthenticated: boolean
  lessonPosition: { index: number; total: number; nextLesson: { slug: string; title: string } | null } | null
  vocabAudioMap: Record<string, string>
}

type StepId = 'introduccion' | 'vocabulario' | 'ejemplos' | 'practica'

function splitSentences(text: string): string[] {
  // Lowercase is included in the lookahead because this content sometimes
  // opens a sentence with a bare phonetic letter (e.g. "...suaves. p, t, k
  // y c sí llevan..."), which would otherwise never be recognized as a new
  // sentence boundary.
  return text
    .split(/(?<=[.!?])\s+(?=[A-Za-zÁÉÍÓÚÑáéíóúñ0-9\p{Script=Han}])/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

function groupIntoParagraphs(text: string): string[] {
  const sentences = splitSentences(text)
  if (sentences.length <= 1) return [text]

  // Default to one idea (sentence) per paragraph. Only merge a sentence
  // backward when the paragraph built so far is too short to stand on its
  // own as a complete idea — never merge two full-length sentences together.
  const MIN_STANDALONE_LENGTH = 40
  const paragraphs: string[] = []
  for (const sentence of sentences) {
    const previous = paragraphs[paragraphs.length - 1]
    if (previous !== undefined && previous.length < MIN_STANDALONE_LENGTH) {
      paragraphs[paragraphs.length - 1] = `${previous} ${sentence}`
    } else {
      paragraphs.push(sentence)
    }
  }
  return paragraphs
}

interface ExplanationBlock {
  type: 'text' | 'note'
  content: string
}

function splitIntoBlocks(text: string): ExplanationBlock[] {
  const blocks: ExplanationBlock[] = []
  const regex = /\[\[AVANZADO\]\]([\s\S]*?)\[\[\/AVANZADO\]\]/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index).trim()
    if (before) blocks.push({ type: 'text', content: before })
    blocks.push({ type: 'note', content: match[1].trim() })
    lastIndex = match.index + match[0].length
  }
  const rest = text.slice(lastIndex).trim()
  if (rest) blocks.push({ type: 'text', content: rest })
  return blocks
}

const PRACTICE_SAMPLE_SIZE = 5

function sampleExercises<T>(items: T[], count: number): T[] {
  if (items.length <= count) return items
  const shuffled = [...items]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, count)
}

function extractHanziExamples(text: string): { hanzi: string; detail: string }[] {
  const results: { hanzi: string; detail: string }[] = []
  const seen = new Set<string>()
  for (const match of text.matchAll(/(\p{Script=Han}+)\s*\(([^)]+)\)/gu)) {
    const hanzi = match[1]
    const detail = match[2].trim()
    const key = `${hanzi}|${detail}`
    if (!seen.has(key)) {
      seen.add(key)
      results.push({ hanzi, detail })
    }
  }
  return results
}

export function LessonPlayer({ lesson, isAuthenticated, lessonPosition, vocabAudioMap }: LessonPlayerProps) {
  const router = useRouter()
  const [results, setResults] = useState<Record<string, boolean>>({})
  const [completed, setCompleted] = useState(false)
  const [activeVocab, setActiveVocab] = useState<MandarinVocabItem | null>(null)
  const [pinyinMenuOpen, setPinyinMenuOpen] = useState(false)
  const [pendingNextLesson, setPendingNextLesson] = useState(false)
  const pinyinVisibility = usePinyinVisibility(lesson.slug)

  const vocabAudioByHanzi = useMemo(() => {
    const map = new Map<string, string | null>(Object.entries(vocabAudioMap))
    for (const item of lesson.vocab) {
      if (item.audio_url) map.set(item.hanzi, item.audio_url)
    }
    return map
  }, [lesson.vocab, vocabAudioMap])

  // Sampled once per lesson visit so a lesson with many exercises (e.g. a
  // vocab-bank lesson with one quiz per word) only asks a random subset
  // each time, instead of always the same fixed set in the same order.
  const practiceExercises = useMemo(
    () => sampleExercises(lesson.exercises, PRACTICE_SAMPLE_SIZE),
    // Intentionally excludes lesson.exercises — resampling should only
    // happen when navigating to a different lesson, not on every
    // re-render (e.g. router.refresh() after marking a lesson complete).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lesson.slug]
  )

  const steps = useMemo(() => {
    const list: { id: StepId; label: string; icon: typeof Sparkles }[] = []
    if (lesson.grammar.length > 0) list.push({ id: 'introduccion', label: 'Introducción', icon: Sparkles })
    if (lesson.vocab.length > 0) list.push({ id: 'vocabulario', label: 'Vocabulario', icon: BookOpen })
    if (lesson.examples.length > 0) list.push({ id: 'ejemplos', label: 'Ejemplos', icon: MessageSquareQuote })
    if (lesson.exercises.length > 0) list.push({ id: 'practica', label: 'Práctica', icon: CheckCircle2 })
    return list
  }, [lesson])

  const [activeStepIndex, setActiveStepIndex] = useState(0)
  const activeStep = steps[activeStepIndex]?.id

  useEffect(() => {
    setActiveStepIndex(0)
    setPendingNextLesson(false)
  }, [lesson.slug])

  function goToNextLesson() {
    if (!lessonPosition?.nextLesson) return
    router.push(`/mandarin/leccion/${lessonPosition.nextLesson.slug}`)
  }

  function handleNextLessonClick() {
    if (isAuthenticated && !completed) {
      setPendingNextLesson(true)
      return
    }
    goToNextLesson()
  }

  async function submitAttempt(exerciseId: string, response: Record<string, unknown>) {
    if (!isAuthenticated) {
      toast.error('Inicia sesión para practicar los ejercicios.')
      return
    }
    const res = await fetchWithCredentials(`/api/mandarin/exercises/${exerciseId}/attempt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response }),
    })
    const json = await res.json()
    if (res.ok) {
      setResults((prev) => ({ ...prev, [exerciseId]: json.data.is_correct }))
    } else {
      toast.error('No se pudo evaluar tu respuesta. Intenta de nuevo.')
    }
  }

  async function markComplete() {
    const res = await fetchWithCredentials(`/api/mandarin/lessons/${lesson.slug}/complete`, { method: 'POST' })
    if (res.ok) {
      setCompleted(true)
      router.refresh()
    }
  }

  const answeredCount = practiceExercises.filter((exercise) => exercise.id in results).length
  const allAnswered = practiceExercises.length > 0 && answeredCount === practiceExercises.length
  const isLastStep = activeStepIndex === steps.length - 1

  return (
    <div className={`${notoSerifSC.variable} relative min-h-screen overflow-hidden bg-nurei-warm pb-28`}>
      <div aria-hidden className="pointer-events-none absolute -top-20 right-0 size-96 rounded-full bg-nurei-cta/20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute top-[40%] -left-32 size-80 rounded-full bg-nurei-cta/10 blur-3xl" />

      <div className="relative mx-auto max-w-2xl px-4 py-12 sm:py-16">
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/mandarin"
            className="flex items-center gap-1.5 text-sm font-medium text-nurei-muted transition-colors hover:text-nurei-black"
          >
            <ArrowLeft className="size-4" />
            Volver al curso
          </Link>
          <div className="flex items-center gap-2">
            {!ALWAYS_VISIBLE_LESSON_SLUGS.has(lesson.slug) && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setPinyinMenuOpen((open) => !open)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  pinyinVisibility.showPinyin
                    ? 'border-nurei-border bg-white text-nurei-muted hover:text-nurei-black'
                    : 'border-dashed border-nurei-border bg-nurei-surface text-nurei-border'
                }`}
              >
                <span className={`font-[family-name:var(--font-hanzi)] ${!pinyinVisibility.showPinyin ? 'line-through' : ''}`}>
                  拼音
                </span>
                <ChevronDown className="size-3.5" />
              </button>
              {pinyinMenuOpen && (
                <div className="absolute left-0 z-10 mt-2 w-56 rounded-2xl border border-nurei-border bg-white p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
                  {pinyinVisibility.showPinyin ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          pinyinVisibility.hideForLesson()
                          setPinyinMenuOpen(false)
                        }}
                        className="block w-full rounded-xl px-3 py-2 text-left text-sm text-nurei-black hover:bg-nurei-surface"
                      >
                        Ocultar solo en esta lección
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          pinyinVisibility.hideGlobally()
                          setPinyinMenuOpen(false)
                        }}
                        className="block w-full rounded-xl px-3 py-2 text-left text-sm text-nurei-black hover:bg-nurei-surface"
                      >
                        Ocultar en todo el curso
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        pinyinVisibility.showPinyinEverywhere()
                        setPinyinMenuOpen(false)
                      }}
                      className="block w-full rounded-xl px-3 py-2 text-left text-sm text-nurei-black hover:bg-nurei-surface"
                    >
                      Mostrar pinyin de nuevo
                    </button>
                  )}
                </div>
              )}
            </div>
            )}
            {lessonPosition && (
              <span className="rounded-full bg-nurei-black px-3 py-1 text-xs font-semibold tracking-wide text-white uppercase">
                Lección {lessonPosition.index} de {lessonPosition.total}
              </span>
            )}
          </div>
        </div>

        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mt-6"
        >
          <h1 className="text-3xl font-bold tracking-tight text-nurei-black drop-shadow-[0_0_20px_rgba(255,193,7,0.3)] sm:text-4xl">
            {lesson.title}
          </h1>
          {lesson.objective && <p className="mt-2 text-nurei-muted">{lesson.objective}</p>}

          {lesson.is_demo_content && (
            <div className="mt-4 flex items-start gap-2 rounded-2xl bg-nurei-cta/15 px-4 py-3 text-sm text-nurei-black">
              <Info className="mt-0.5 size-4 shrink-0 text-nurei-cta-hover" />
              <span>Contenido de demostración — pendiente de revisión.</span>
            </div>
          )}
        </motion.header>

        {steps.length > 0 && (
          <div className="mt-8 flex gap-2 overflow-x-auto pb-1">
            {steps.map((step, index) => {
              const Icon = step.icon
              const isActive = index === activeStepIndex
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setActiveStepIndex(index)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    isActive ? 'bg-nurei-black text-white' : 'bg-white text-nurei-muted hover:text-nurei-black'
                  }`}
                >
                  <Icon className="size-4" />
                  {step.label}
                </button>
              )
            })}
          </div>
        )}

        {PINYIN_LESSON_LINKS[lesson.slug] && (
          <Link
            href={PINYIN_LESSON_LINKS[lesson.slug].href}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-nurei-cta-hover hover:underline"
          >
            {PINYIN_LESSON_LINKS[lesson.slug].label}
            <ArrowRight className="size-3.5" />
          </Link>
        )}

        <motion.div key={activeStep} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mt-6">
          {activeStep === 'introduccion' && (
            <div className="space-y-10">
              {lesson.slug === 'pinyin' && (
                <PinyinCallout
                  hanzi="你好"
                  pinyin="nǐ hǎo"
                  es="hola"
                  caption="El pinyin escribe la pronunciación con letras latinas — una sílaba de pinyin por cada carácter."
                  audioUrl={lesson.vocab.find((item) => item.hanzi === '你好')?.audio_url}
                />
              )}
              {lesson.slug === 'tonos' && <ToneChart />}
              {lesson.grammar.map((point, pointIndex) => {
                const blocks = splitIntoBlocks(point.explanation)
                const category = getSectionCategory(lesson.slug, point.order_index)
                const previousCategory =
                  pointIndex > 0 ? getSectionCategory(lesson.slug, lesson.grammar[pointIndex - 1].order_index) : null
                const showCategoryHeader = category !== null && category !== previousCategory
                return (
                  <div key={point.id}>
                    {showCategoryHeader && (
                      <p className="mb-4 text-xs font-bold tracking-widest text-nurei-cta-hover uppercase">{category}</p>
                    )}
                    <section className="space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-nurei-cta/20 text-sm font-bold text-nurei-cta-hover">
                          {pointIndex + 1}
                        </span>
                        <h2 className="text-lg font-bold tracking-tight text-nurei-black">{point.title}</h2>
                      </div>
                      <div className="space-y-5 pl-11">
                      {blocks.flatMap((block, blockIndex) => {
                        if (block.type === 'note') {
                          return [<AdvancedNoteCallout key={`note-${blockIndex}`} text={block.content} />]
                        }
                        return groupIntoParagraphs(block.content).map((paragraph, paragraphIndex) => {
                        const examples = extractHanziExamples(paragraph)
                        return (
                          <motion.div
                            key={`${blockIndex}-${paragraphIndex}`}
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-40px' }}
                            transition={{ duration: 0.4, delay: paragraphIndex * 0.12 }}
                            className="space-y-3"
                          >
                            <div className="flex gap-2.5">
                              {examples.length > 0 && (
                                <span className="mt-1.5 size-2.5 shrink-0 rounded-full border border-nurei-border bg-white" />
                              )}
                              <p className="leading-relaxed text-nurei-black/80">{paragraph}</p>
                            </div>
                            {examples.length > 0 && (
                              <div className="flex flex-wrap gap-2 pl-[1.125rem]">
                                {examples.map((example, exampleIndex) => {
                                  const exampleAudioUrl = vocabAudioByHanzi.get(example.hanzi)
                                  return (
                                    <div
                                      key={exampleIndex}
                                      className="flex items-center gap-2 rounded-xl border border-nurei-border bg-nurei-surface px-3 py-2"
                                    >
                                      <span className="font-[family-name:var(--font-hanzi)] text-lg font-bold text-nurei-black">
                                        {example.hanzi}
                                      </span>
                                      <span className="text-xs text-nurei-muted">{example.detail}</span>
                                      {exampleAudioUrl && <AudioButton src={exampleAudioUrl} />}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </motion.div>
                        )
                        })
                      })}
                      {point.title === 'Todas las consonantes y vocales del pinyin' && (
                        <PinyinFullChart haoAudioUrl={vocabAudioByHanzi.get('好')} />
                      )}
                      {point.title.startsWith('Consonantes con y sin aspiración') && <ConsonantPairChart />}
                      </div>
                    </section>
                  </div>
                )
              })}
            </div>
          )}

          {activeStep === 'vocabulario' && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {lesson.vocab.map((item) => (
                <div
                  key={item.id}
                  role={item.example_hanzi ? 'button' : undefined}
                  tabIndex={item.example_hanzi ? 0 : undefined}
                  onClick={() => item.example_hanzi && setActiveVocab(item)}
                  onKeyDown={(event) => {
                    if (item.example_hanzi && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault()
                      setActiveVocab(item)
                    }
                  }}
                  className={`group relative flex flex-col items-center gap-1 rounded-2xl border border-nurei-border bg-white px-3 py-4 text-center shadow-[0_2px_12px_rgba(17,24,39,0.05)] transition-all hover:-translate-y-0.5 hover:border-nurei-cta/40 hover:shadow-[0_8px_28px_rgba(255,193,7,0.22)] ${item.example_hanzi ? 'cursor-pointer' : ''}`}
                >
                  {item.example_hanzi && (
                    <MessageSquareQuote className="absolute top-2 right-2 size-3.5 text-nurei-border transition-colors group-hover:text-nurei-cta-hover" />
                  )}
                  <div className="flex items-center gap-1">
                    <HanziWithPinyin
                      hanzi={item.hanzi}
                      pinyin={item.pinyin}
                      showPinyin={pinyinVisibility.showPinyin}
                      className="text-3xl font-bold text-nurei-black transition-all group-hover:drop-shadow-[0_0_10px_rgba(255,193,7,0.55)]"
                    />
                    {item.audio_url && <AudioButton src={item.audio_url} />}
                  </div>
                  <span className="text-sm font-medium text-nurei-black">{item.es}</span>
                </div>
              ))}
            </div>
          )}

          {activeStep === 'ejemplos' && (
            <div className="space-y-3">
              {lesson.examples.map((example) => (
                <div
                  key={example.id}
                  className="relative overflow-hidden rounded-2xl bg-nurei-black px-5 py-4 text-white shadow-[0_8px_30px_rgba(0,0,0,0.3)]"
                >
                  <div aria-hidden className="pointer-events-none absolute -top-8 -right-8 size-32 rounded-full bg-nurei-cta/20 blur-2xl" />
                  <div className="relative flex items-center gap-1.5">
                    <HanziWithPinyin
                      hanzi={example.hanzi}
                      pinyin={example.pinyin}
                      showPinyin={pinyinVisibility.showPinyin}
                      variant="dark"
                      className="text-xl font-medium drop-shadow-[0_0_14px_rgba(255,193,7,0.45)]"
                    />
                    {example.audio_url && <AudioButton src={example.audio_url} variant="dark" />}
                  </div>
                  <p className="relative mt-1 text-sm font-medium text-nurei-cta drop-shadow-[0_0_8px_rgba(255,193,7,0.4)]">{example.es}</p>
                </div>
              ))}
            </div>
          )}

          {activeStep === 'practica' && (
            <div className="space-y-4">
              {practiceExercises.map((exercise) => {
                const result = exercise.id in results ? results[exercise.id] : null
                if (exercise.type === 'vocab_multiple_choice') {
                  const data = exercise.data as Omit<MandarinVocabMultipleChoiceData, 'correct_option'>
                  return (
                    <VocabMultipleChoice
                      key={exercise.id}
                      prompt={exercise.prompt}
                      options={data.options}
                      result={result}
                      onSubmit={(response) => submitAttempt(exercise.id, response)}
                    />
                  )
                }
                const data = exercise.data as Omit<MandarinSentenceOrderData, 'correct_order'>
                return (
                  <SentenceOrder
                    key={exercise.id}
                    prompt={exercise.prompt}
                    tokens={data.tokens}
                    result={result}
                    onSubmit={(response) => submitAttempt(exercise.id, response)}
                  />
                )
              })}
            </div>
          )}
        </motion.div>

        {steps.length > 1 && (
          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              disabled={activeStepIndex === 0}
              onClick={() => setActiveStepIndex((index) => Math.max(0, index - 1))}
              className="flex items-center gap-1.5 rounded-full border border-nurei-border bg-white px-4 py-2 text-sm font-medium text-nurei-black transition-colors hover:border-nurei-black/40 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowLeft className="size-4" />
              Atrás
            </button>
            {!isLastStep && (
              <button
                type="button"
                onClick={() => setActiveStepIndex((index) => Math.min(steps.length - 1, index + 1))}
                className="flex items-center gap-1.5 rounded-full bg-nurei-black px-4 py-2 text-sm font-medium text-white transition-colors hover:-translate-y-0.5"
              >
                Siguiente
                <ArrowRight className="size-4" />
              </button>
            )}
          </div>
        )}

        {lessonPosition?.nextLesson && (
          pendingNextLesson ? (
            <div className="mt-4 space-y-3 rounded-2xl border border-dashed border-nurei-cta/40 bg-nurei-cta/10 px-5 py-4">
              <p className="text-sm text-nurei-black/80">
                Todavía no marcaste esta lección como completada — si avanzas ahora, no se guardará tu progreso. ¿Quieres continuar de todas formas?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPendingNextLesson(false)}
                  className="rounded-full border border-nurei-border bg-white px-4 py-2 text-sm font-medium text-nurei-black transition-colors hover:border-nurei-black/40"
                >
                  Quedarme aquí
                </button>
                <button
                  type="button"
                  onClick={goToNextLesson}
                  className="flex items-center gap-1.5 rounded-full bg-nurei-black px-4 py-2 text-sm font-medium text-white transition-colors hover:-translate-y-0.5"
                >
                  Continuar sin completar
                  <ArrowRight className="size-4" />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleNextLessonClick}
              className="mt-4 flex w-full items-center justify-between gap-3 rounded-2xl border border-nurei-black bg-nurei-black px-5 py-4 text-left text-white transition-colors hover:bg-nurei-black/90"
            >
              <span>
                <span className="block text-xs font-semibold tracking-widest text-nurei-cta uppercase">Siguiente lección</span>
                <span className="text-sm font-medium">{lessonPosition.nextLesson.title}</span>
              </span>
              <ArrowRight className="size-4 shrink-0" />
            </button>
          )
        )}
      </div>

      {activeVocab && (
        <VocabExampleModal item={activeVocab} onClose={() => setActiveVocab(null)} lessonSlug={lesson.slug} />
      )}

      <div className="fixed inset-x-0 bottom-0 border-t border-nurei-border bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-4">
          {practiceExercises.length > 0 && (
            <span className="text-sm font-medium text-nurei-muted">
              {answeredCount}/{practiceExercises.length} ejercicios
            </span>
          )}
          {isAuthenticated ? (
            <button
              type="button"
              disabled={!allAnswered || completed}
              onClick={markComplete}
              className="ml-auto flex items-center gap-2 rounded-full bg-nurei-black px-6 py-3 font-semibold text-white shadow-[0_4px_20px_rgba(0,0,0,0.15)] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(255,193,7,0.3)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              <CheckCircle2 className="size-4" />
              {completed ? 'Lección completada' : 'Marcar como completada'}
            </button>
          ) : (
            <span className="ml-auto flex items-center gap-2 text-sm font-medium text-nurei-muted">
              <Lock className="size-4" />
              Inicia sesión para guardar tu progreso.
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
