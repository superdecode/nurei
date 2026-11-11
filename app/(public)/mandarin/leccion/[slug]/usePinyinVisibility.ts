'use client'

import { useCallback, useEffect, useState } from 'react'

const GLOBAL_KEY = 'mandarin-pinyin-hidden-global'
const LESSON_KEY = 'mandarin-pinyin-hidden-lessons'

// "Introducción al chino" is where students first learn to read pinyin at
// all — a global "hide pinyin" preference set from a later Gramática
// lesson must never carry over into these lessons.
export const ALWAYS_VISIBLE_LESSON_SLUGS = new Set(['pinyin', 'tonos', 'hola', 'presentarse', 'pronombres'])

function readGlobalHidden(): boolean {
  try {
    return localStorage.getItem(GLOBAL_KEY) === 'true'
  } catch {
    return false
  }
}

function readHiddenLessons(): string[] {
  try {
    const raw = localStorage.getItem(LESSON_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function usePinyinVisibility(lessonSlug: string) {
  const [globalHidden, setGlobalHidden] = useState(false)
  const [lessonHidden, setLessonHidden] = useState(false)

  useEffect(() => {
    setGlobalHidden(readGlobalHidden())
    setLessonHidden(readHiddenLessons().includes(lessonSlug))
  }, [lessonSlug])

  const hideForLesson = useCallback(() => {
    const list = readHiddenLessons()
    if (!list.includes(lessonSlug)) {
      try {
        localStorage.setItem(LESSON_KEY, JSON.stringify([...list, lessonSlug]))
      } catch {
        // localStorage unavailable — visibility just won't persist across reloads
      }
    }
    setLessonHidden(true)
  }, [lessonSlug])

  const hideGlobally = useCallback(() => {
    try {
      localStorage.setItem(GLOBAL_KEY, 'true')
    } catch {
      // localStorage unavailable — visibility just won't persist across reloads
    }
    setGlobalHidden(true)
  }, [])

  const showPinyinEverywhere = useCallback(() => {
    try {
      localStorage.setItem(GLOBAL_KEY, 'false')
      localStorage.setItem(LESSON_KEY, JSON.stringify(readHiddenLessons().filter((slug) => slug !== lessonSlug)))
    } catch {
      // localStorage unavailable — visibility just won't persist across reloads
    }
    setGlobalHidden(false)
    setLessonHidden(false)
  }, [lessonSlug])

  const isAlwaysVisibleLesson = ALWAYS_VISIBLE_LESSON_SLUGS.has(lessonSlug)

  return {
    showPinyin: isAlwaysVisibleLesson || (!globalHidden && !lessonHidden),
    isHidden: !isAlwaysVisibleLesson && (globalHidden || lessonHidden),
    hideForLesson,
    hideGlobally,
    showPinyinEverywhere,
  }
}
