import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-xl border border-gray-200 bg-white px-4 py-2 text-base text-gray-900 shadow-sm transition-all focus:border-nurei-cta focus:ring-4 focus:ring-nurei-cta/10 outline-none placeholder:text-gray-400 disabled:bg-gray-50 disabled:opacity-50 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
