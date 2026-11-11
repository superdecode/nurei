import { Feather } from 'lucide-react'

interface AdvancedNoteCalloutProps {
  text: string
}

export function AdvancedNoteCallout({ text }: AdvancedNoteCalloutProps) {
  return (
    <div className="flex gap-2.5 rounded-2xl border border-dashed border-nurei-cta/40 bg-nurei-cta/10 px-4 py-3">
      <Feather className="mt-0.5 size-4 shrink-0 text-nurei-cta-hover" />
      <div className="space-y-1">
        <p className="text-xs font-bold tracking-widest text-nurei-cta-hover uppercase">Concepto avanzado</p>
        <p className="text-sm leading-relaxed text-nurei-black/80">{text}</p>
        <p className="text-xs text-nurei-muted italic">
          No te preocupes si no lo recuerdas todavía — con la práctica se queda solo.
        </p>
      </div>
    </div>
  )
}
