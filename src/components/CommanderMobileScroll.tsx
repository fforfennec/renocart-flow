import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** An overlay indicator only; scrolling and its contents remain native. */
export function CommanderMobileScroll({ enabled, className, children }: {
  enabled: boolean; className: string; children: ReactNode;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const [visible, setVisible] = useState(false);
  const [thumb, setThumb] = useState({ height: 0, top: 0 });

  useEffect(() => {
    if (!enabled) return;
    const el = viewport.current;
    const inner = content.current;
    if (!el || !inner) return;
    const update = () => {
      const overflow = el.scrollHeight - el.clientHeight;
      const height = overflow > 0 ? Math.max(24, el.clientHeight ** 2 / el.scrollHeight) : 0;
      setThumb({ height, top: overflow > 0 ? (el.clientHeight - height) * el.scrollTop / overflow : 0 });
    };
    const scroll = () => {
      update();
      setVisible(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setVisible(false), 1000);
    };
    const observer = new ResizeObserver(update);
    observer.observe(el);
    observer.observe(inner);
    el.addEventListener("scroll", scroll, { passive: true });
    update();
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", scroll);
      clearTimeout(timer.current);
    };
  }, [enabled]);

  if (!enabled) return <div className={className}>{children}</div>;
  return (
    <div className="relative flex-1 min-h-0 overflow-hidden">
      <div ref={viewport} className={cn(className, "commander-mobile-scroll h-full")}>
        <div ref={content} className="min-h-full">{children}</div>
      </div>
      <div aria-hidden="true" className={cn("commander-scroll-indicator", visible && thumb.height > 0 && "is-scrolling")}
        style={{ height: thumb.height, transform: `translateY(${thumb.top}px)` }} />
    </div>
  );
}