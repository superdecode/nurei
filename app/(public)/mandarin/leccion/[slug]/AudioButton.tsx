'use client'

import { useRef, useState } from 'react'
import { Volume2 } from 'lucide-react'

interface AudioButtonProps {
  src: string
  variant?: 'light' | 'dark'
}

export function AudioButton({ src, variant = 'light' }: AudioButtonProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  function play(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    audioRef.current?.play()
  }

  const colorClass =
    variant === 'dark'
      ? 'text-nurei-cta hover:text-nurei-cta-hover'
      : 'text-nurei-muted hover:text-nurei-black'

  return (
    <button
      type="button"
      onClick={play}
      aria-label="Reproducir audio"
      className={`inline-flex items-center justify-center rounded-full p-1.5 transition-colors ${colorClass} ${isPlaying ? 'animate-pulse' : ''}`}
    >
      <Volume2 className="size-4" />
      <audio
        ref={audioRef}
        src={src}
        preload="none"
        onPlay={() => setIsPlaying(true)}
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
      />
    </button>
  )
}
