// Size-substitution feature (removable): highlights a cart line that replaces an unavailable size.
// To revert: delete this file and its wrapper usage in Commander.tsx.
export function CommanderSubstitution({ replaces, lang, children }: { replaces?: string | null; lang: "fr" | "en"; children: React.ReactNode }) {
  if (!replaces) return <>{children}</>;
  return (
    <div className="rounded-lg border-2 border-primary bg-primary/10 p-2" data-substitution>
      {children}
      <p className="mt-1 text-xs font-semibold text-foreground">
        {lang === "fr" ? `Pour remplacer le ${replaces} qui n’est pas disponible` : `To replace the ${replaces}, which is unavailable`}
      </p>
    </div>
  );
}
