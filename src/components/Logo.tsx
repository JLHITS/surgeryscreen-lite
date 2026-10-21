import { cn } from "@/lib/cn";
import { MARK_PATH, MARK_VIEWBOX, WORDMARK } from "@/lib/logo-art";

/**
 * The bare logo mark (monitor + cross). Inherits colour via `currentColor`, so
 * it themes with the surrounding text — size it with a height utility.
 * Decorative by default; give it an `aria-label` when used without the wordmark.
 */
export function LogoMark({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox={MARK_VIEWBOX}
      fill="currentColor"
      role="img"
      aria-hidden={props["aria-label"] ? undefined : true}
      focusable="false"
      className={className}
      {...props}
    >
      <path fillRule="evenodd" d={MARK_PATH} />
    </svg>
  );
}

/**
 * Full lockup: mark + wordmark. Scales to the surrounding font-size, so size it
 * with a text utility (e.g. `text-xl`) and colour it with a text colour.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[0.32em] font-semibold leading-none tracking-tight whitespace-nowrap",
        className
      )}
    >
      <LogoMark className="h-[1.45em] w-auto shrink-0" />
      <span>{WORDMARK}</span>
    </span>
  );
}
