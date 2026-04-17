"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-[100] bg-black/20 transition-opacity duration-150 supports-backdrop-filter:backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:opacity-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  size = "md",
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
  size?: "sm" | "md" | "lg" | "xl" | "full"
}) {
  const sizes = {
    sm: "sm:max-w-sm",
    md: "sm:max-w-lg",
    lg: "sm:max-w-2xl",
    xl: "sm:max-w-4xl",
    full: "sm:max-w-[95vw]",
  }

  return (
    <DialogPortal>
      <DialogOverlay />
      {/* Flex centering avoids translate(-50%,-50%) which blurs text on many GPUs; blur stays on overlay only */}
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className={cn(
            "relative pointer-events-auto flex flex-col w-full rounded-3xl bg-popover text-sm text-popover-foreground shadow-2xl duration-150 outline-none data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-bottom-1 data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-bottom-1 overflow-hidden max-h-[90vh]",
            sizes[size],
            className
          )}
          {...props}
        >
          {showCloseButton && (
            <DialogPrimitive.Close
              data-slot="dialog-close"
              aria-label="Cerrar"
              className="absolute top-3 right-3 z-[200] inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-gray-600 transition-all hover:bg-black/10 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-cyan/60"
            >
              <XIcon className="h-4 w-4" />
              <span className="sr-only">Cerrar</span>
            </DialogPrimitive.Close>
          )}
          {children}
        </DialogPrimitive.Popup>
      </div>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-1.5 p-6", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-3 p-6 sm:flex-row sm:justify-end bg-muted/30 border-t",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-none font-medium",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
