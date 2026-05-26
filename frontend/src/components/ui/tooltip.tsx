"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "./utils";

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  );
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

// IMPORTANT: globals.css uses `@import "tailwindcss"` (v4 syntax) but the
// installed package is Tailwind v3.4 — so arbitrary utility classes like
// `bg-primary` / `bg-gray-900` are never generated. The original shadcn
// className-based styling resulted in transparent tooltips with invisible
// white text everywhere they were used. We apply the dark theme as inline
// styles so the tooltip always renders correctly regardless of Tailwind state.
// Caller-provided `style` overrides defaults via spread order.
function TooltipContent({
  className,
  style,
  sideOffset = 4,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        collisionPadding={8}
        className={cn("z-50", className)}
        style={{
          background: "#111827",
          color: "#fff",
          fontSize: 12,
          lineHeight: 1.4,
          padding: "6px 10px",
          borderRadius: 6,
          maxWidth: 260,
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          zIndex: 50,
          ...style,
        }}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow style={{ fill: "#111827" }} width={10} height={5} />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
