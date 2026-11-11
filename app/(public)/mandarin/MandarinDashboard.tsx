'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle2, Circle, GraduationCap, LayoutGrid, List as ListIcon, Search, Sparkles } from 'lucide-react'
import { notoSerifSC } from './fonts'

interface LessonCard {
  slug: string
  title: string
  objective: string | null
  levelTitle: string
}

interface MandarinDashboardProps {
  isAuthenticated: boolean
  lessons: LessonCard[]
  levelNames: string[]
  completedSlugs: string[]
}

export function MandarinDashboard({ isAuthenticated, lessons, levelNames, completedSlugs }: MandarinDashboardProps) {
  const [levelFilter, setLevelFilter] = useState<string>('todos')
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'cards' | 'lista'>('cards')

  const nextLesson = lessons.find((lesson) => !completedSlugs.includes(lesson.slug))
  const completedCount = lessons.filter((lesson) => completedSlugs.includes(lesson.slug)).length
  const progressPct = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0

  const lessonPositionBySlug = useMemo(() => {
    const map = new Map<string, number>()
    lessons.forEach((lesson, index) => map.set(lesson.slug, index + 1))
    return map
  }, [lessons])

  const filteredLessons = useMemo(() => {
    const query = search.trim().toLowerCase()
    return lessons.filter((lesson) => {
      const matchesLevel = levelFilter === 'todos' || lesson.levelTitle === levelFilter
      const matchesSearch = query.length === 0 || lesson.title.toLowerCase().includes(query)
      return matchesLevel && matchesSearch
    })
  }, [lessons, levelFilter, search])

  const groupedByLevel = useMemo(() => {
    const groups: { levelTitle: string; lessons: LessonCard[] }[] = []
    for (const lesson of filteredLessons) {
      const lastGroup = groups[groups.length - 1]
      if (lastGroup && lastGroup.levelTitle === lesson.levelTitle) {
        lastGroup.lessons.push(lesson)
      } else {
        groups.push({ levelTitle: lesson.levelTitle, lessons: [lesson] })
      }
    }
    return groups
  }, [filteredLessons])

  return (
    <div className={`${notoSerifSC.variable} relative min-h-screen overflow-hidden bg-nurei-warm`}>
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-nurei-cta/25 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/3 -left-32 size-80 rounded-full bg-nurei-cta/15 blur-3xl"
      />

      <div className="relative mx-auto max-w-4xl px-4 py-12 sm:py-16">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
        >
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-nurei-black px-3 py-1 text-xs font-semibold tracking-wide text-white uppercase">
              <GraduationCap className="size-3.5" />
              Curso de mandarín
            </span>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-nurei-black drop-shadow-[0_0_24px_rgba(255,193,7,0.35)] sm:text-5xl">
              Curso de Mandarín
            </h1>
            <p className="mt-2 text-nurei-muted">Aprende mandarín desde cero, en español.</p>

            {lessons.length > 0 && (
              <div className="mt-6 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-nurei-border">
                  <motion.div
                    className="h-full rounded-full bg-nurei-cta"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPct}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                </div>
                <span className="shrink-0 text-sm font-medium text-nurei-muted">
                  {completedCount} de {lessons.length} lecciones
                </span>
              </div>
            )}
          </div>

          {!isAuthenticated && (
            <div className="shrink-0 rounded-2xl border border-dashed border-nurei-border bg-white px-4 py-3 sm:max-w-52">
              <p className="text-sm text-nurei-black">
                <Link href="/registro" className="font-semibold text-nurei-cta underline underline-offset-2">
                  Regístrate
                </Link>{' '}
                para guardar tu progreso.
              </p>
            </div>
          )}
        </motion.header>

        {isAuthenticated && nextLesson && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <Link
              href={`/mandarin/leccion/${nextLesson.slug}`}
              className="group relative mt-8 flex items-center justify-between gap-4 overflow-hidden rounded-3xl border border-nurei-black bg-nurei-black px-6 py-5 text-white shadow-[0_8px_30px_rgba(0,0,0,0.25)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(255,193,7,0.25)]"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -top-10 -right-10 size-40 rounded-full bg-nurei-cta/20 blur-2xl transition-opacity group-hover:opacity-80"
              />
              <div className="relative">
                <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-nurei-cta uppercase drop-shadow-[0_0_10px_rgba(255,193,7,0.6)]">
                  <Sparkles className="size-3.5" />
                  Continúa aprendiendo
                </p>
                <p className="mt-1 text-lg font-semibold">{nextLesson.title}</p>
              </div>
              <ArrowRight className="relative size-6 shrink-0 text-nurei-cta transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setLevelFilter('todos')}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                levelFilter === 'todos' ? 'bg-nurei-black text-white' : 'bg-white text-nurei-muted hover:text-nurei-black'
              }`}
            >
              Todos
            </button>
            {levelNames.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setLevelFilter(name)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  levelFilter === name ? 'bg-nurei-black text-white' : 'bg-white text-nurei-muted hover:text-nurei-black'
                }`}
              >
                {name}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-nurei-muted" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar lección..."
              className="w-full rounded-full border border-nurei-border bg-white py-1.5 pr-4 pl-9 text-sm text-nurei-black placeholder:text-nurei-muted focus:border-nurei-cta focus:outline-none sm:w-56"
            />
          </div>

          <div className="flex items-center gap-1 rounded-full bg-white p-1">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              aria-pressed={viewMode === 'cards'}
              aria-label="Vista de tarjetas"
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === 'cards' ? 'bg-nurei-black text-white' : 'text-nurei-muted hover:text-nurei-black'
              }`}
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('lista')}
              aria-pressed={viewMode === 'lista'}
              aria-label="Vista de lista"
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === 'lista' ? 'bg-nurei-black text-white' : 'text-nurei-muted hover:text-nurei-black'
              }`}
            >
              <ListIcon className="size-4" />
            </button>
          </div>
        </motion.div>

        {viewMode === 'cards' && (
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredLessons.map((lesson, index) => {
              const isCompleted = completedSlugs.includes(lesson.slug)
              return (
                <motion.div
                  key={lesson.slug}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.3) }}
                >
                  <Link
                    href={`/mandarin/leccion/${lesson.slug}`}
                    className="group flex h-full flex-col gap-3 rounded-3xl border border-nurei-border bg-white p-5 shadow-[0_4px_24px_rgba(17,24,39,0.06)] transition-all hover:-translate-y-0.5 hover:border-nurei-cta/40 hover:shadow-[0_8px_28px_rgba(255,193,7,0.18)]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isCompleted ? (
                          <CheckCircle2 className="size-5 shrink-0 text-nurei-stock drop-shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
                        ) : (
                          <Circle className="size-5 shrink-0 text-nurei-border" />
                        )}
                        <span className="text-xs font-semibold text-nurei-cta-hover">
                          Lección {lessonPositionBySlug.get(lesson.slug)}
                        </span>
                      </div>
                      <span className="rounded-full bg-nurei-cta/15 px-2.5 py-1 text-xs font-medium text-nurei-cta-hover">
                        {lesson.levelTitle}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-nurei-black">{lesson.title}</p>
                      {lesson.objective && <p className="mt-1 text-sm text-nurei-muted">{lesson.objective}</p>}
                    </div>
                    <ArrowRight className="mt-auto size-4 text-nurei-border transition-transform group-hover:translate-x-1 group-hover:text-nurei-black" />
                  </Link>
                </motion.div>
              )
            })}
            {filteredLessons.length === 0 && (
              <p className="col-span-full py-8 text-center text-sm text-nurei-muted">
                No hay lecciones que coincidan con tu búsqueda.
              </p>
            )}
          </div>
        )}

        {viewMode === 'lista' && (
          <div className="mt-6 space-y-6">
            {groupedByLevel.map((group) => (
              <div
                key={group.levelTitle}
                className="overflow-hidden rounded-3xl border border-nurei-border bg-white shadow-[0_4px_24px_rgba(17,24,39,0.06)]"
              >
                <h2 className="border-b border-nurei-border bg-nurei-surface px-6 py-4 text-sm font-semibold tracking-wide text-nurei-muted uppercase">
                  {group.levelTitle}
                </h2>
                <ul className="divide-y divide-nurei-border">
                  {group.lessons.map((lesson) => {
                    const isCompleted = completedSlugs.includes(lesson.slug)
                    return (
                      <li key={lesson.slug}>
                        <Link
                          href={`/mandarin/leccion/${lesson.slug}`}
                          className="group flex items-center gap-3 px-6 py-4 transition-colors hover:bg-nurei-surface"
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="size-5 shrink-0 text-nurei-stock drop-shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
                          ) : (
                            <Circle className="size-5 shrink-0 text-nurei-border" />
                          )}
                          <span className="flex-1 font-medium text-nurei-black">{lesson.title}</span>
                          <ArrowRight className="size-4 shrink-0 text-nurei-border transition-transform group-hover:translate-x-1 group-hover:text-nurei-black" />
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
            {groupedByLevel.length === 0 && (
              <p className="py-8 text-center text-sm text-nurei-muted">No hay lecciones que coincidan con tu búsqueda.</p>
            )}
          </div>
        )}

        <p className="mt-12 text-center text-xs text-nurei-muted">
          Audio de pronunciación:{' '}
          <a
            href="https://lingualibre.org"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-nurei-black"
          >
            Lingua Libre
          </a>{' '}
          vía Wikimedia Commons, licencia{' '}
          <a
            href="https://creativecommons.org/licenses/by-sa/4.0/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-nurei-black"
          >
            CC BY-SA 4.0
          </a>
          .
        </p>
      </div>
    </div>
  )
}
