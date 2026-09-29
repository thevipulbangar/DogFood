// Pure class builder — importable from server and client components.
import { cn } from "@/lib/utils";

export type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
export type Size = "sm" | "md" | "lg";

// Solid variants are pressable: the face sits on a base (`.btn-3d` in globals.css)
// and sinks into it on hover and press. --btn-base / --btn-edge colour that base.
const VARIANTS: Record<Variant, string> = {
  primary: "btn-3d bg-accent text-accent-ink hover:bg-accent-hover border border-[#c9420f] [--btn-base:#8f2c0b] [--btn-edge:#c9420f]",
  secondary: "btn-3d bg-surface-2 text-fg border border-line-strong hover:bg-surface-3 [--btn-base:var(--btn-neutral-base,#0c0c0e)] [--btn-edge:var(--btn-neutral-edge,rgb(255_255_255/0.16))]",
  outline: "btn-3d bg-bg text-fg border border-line-strong hover:border-fg/40 hover:bg-surface [--btn-base:var(--btn-neutral-base,#060607)] [--btn-edge:var(--btn-neutral-edge,rgb(255_255_255/0.2))]",
  ghost: "bg-transparent text-fg-2 border border-transparent hover:text-fg hover:bg-fg/[0.05] active:scale-[0.98]",
  danger: "btn-3d bg-[#2a1214] text-danger border border-danger/40 hover:bg-[#35161a] [--btn-base:#140709] [--btn-edge:rgb(242_85_90/0.45)]",
};
const SIZES: Record<Size, string> = {
  sm: "h-7 px-2.5 text-[10.5px] gap-1.5 [--d:3px]",
  md: "h-9 px-3.5 text-[11px] gap-2 [--d:4px]",
  lg: "h-12 px-6 text-[12px] gap-2.5 [--d:6px]",
};

export function buttonClass(variant: Variant = "secondary", size: Size = "md", className?: string) {
  return cn(
    "relative inline-flex select-none items-center justify-center whitespace-nowrap rounded-sm font-mono font-semibold uppercase tracking-[0.08em]",
    "touch-manipulation transition-[background-color,border-color,color,transform,box-shadow] duration-150 ease-[cubic-bezier(0,0,0.58,1)]",
    "disabled:pointer-events-none disabled:opacity-40",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}
