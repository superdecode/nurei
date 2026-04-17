"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export type TableHorizontalScroll = "always" | "overflow-only"

type TableProps = React.ComponentProps<"table"> & {
  /** `overflow-only`: horizontal scrollbar solo si el contenido sobrepasa el ancho (evita barra “activa” en vacío). */
  horizontalScroll?: TableHorizontalScroll
}

function Table({ className, horizontalScroll = "overflow-only", ...props }: TableProps) {
  const wrapRef = React.useRef<HTMLDivElement>(null)
  const [needsHScroll, setNeedsHScroll] = React.useState(horizontalScroll === "always")

  React.useLayoutEffect(() => {
    if (horizontalScroll === "always") {
      setNeedsHScroll(true)
      return
    }

    const el = wrapRef.current
    if (!el) return

    const measure = () => {
      // Umbral evita scrollbar fantasma por subpíxeles, bordes y overflow de elementos absolutos
      setNeedsHScroll(el.scrollWidth > el.clientWidth + 8)
    }

    measure()

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(measure)
    })
    ro.observe(el)
    const table = el.querySelector("table")
    if (table) ro.observe(table)

    return () => {
      ro.disconnect()
    }
  }, [horizontalScroll])

  return (
    <div
      ref={wrapRef}
      data-slot="table-container"
      className={cn(
        "relative w-full min-w-0 max-w-full",
        needsHScroll ? "overflow-x-auto" : "overflow-x-hidden",
      )}
    >
      <table
        data-slot="table"
        className={cn(
          "w-full min-w-0 border-collapse caption-bottom text-sm",
          className,
        )}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
