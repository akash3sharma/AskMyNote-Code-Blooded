import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-sky-600 via-cyan-600 to-emerald-600 text-white shadow-md shadow-sky-300/40 hover:brightness-110 focus-visible:ring-cyan-500 dark:shadow-cyan-950/50",
        secondary:
          "bg-zinc-100/90 text-zinc-900 hover:bg-zinc-200 focus-visible:ring-zinc-400 dark:bg-slate-800/80 dark:text-zinc-100 dark:hover:bg-slate-700/90",
        outline:
          "border border-zinc-300/90 bg-white/80 text-zinc-800 hover:bg-zinc-100 focus-visible:ring-zinc-500 dark:border-slate-600 dark:bg-slate-900/70 dark:text-zinc-100 dark:hover:bg-slate-800/90",
        ghost:
          "text-zinc-700 hover:bg-zinc-100/90 focus-visible:ring-zinc-500 dark:text-zinc-200 dark:hover:bg-slate-800/80",
        danger: "bg-red-600 text-white hover:bg-red-500 focus-visible:ring-red-500",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-11 px-6",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };
