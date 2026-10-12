import { useEffect, useRef, useState } from "react";
import { FolderPlus, Ban, Check, ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClientAuthForm } from "@/components/projects/ClientAuthForm";
import { ProjectForm } from "@/components/projects/ProjectForm";
import type { ClientProject } from "@/lib/clientProjects";
import { cn } from "@/lib/utils";

export type ProjectChoice = ClientProject | "none" | null;

const L = {
  fr: { none: "Aucun projet", add: "Nouveau projet", project: "Projet", newTitle: "Nouveau projet", login: "Connecte-toi pour créer un projet", select: "Choisir un projet", search: "Rechercher un projet…" },
  en: { none: "No project", add: "New project", project: "Project", newTitle: "New project", login: "Sign in to create a project", select: "Choose a project", search: "Search a project…" },
};

/** Compact dropdown with a scrollable list of projects (projects + none + new). Display only — independent of the voice pipeline. */
export function ProjectPicker({ projects, value, onPick, onNew, lang, dark, dropUp }: {
  projects: ClientProject[]; value: ProjectChoice; onPick: (p: ProjectChoice) => void; onNew: () => void; lang: "fr" | "en"; dark?: boolean; dropUp?: boolean;
}) {
  const t = L[lang];
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const label = value === "none" ? t.none : value ? value.name : t.select;
  const q = query.trim().toLowerCase();
  const filtered = q ? projects.filter((p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)) : projects;
  const currentId = value && value !== "none" ? value.id : value;

  const pick = (p: ProjectChoice) => { onPick(p); setOpen(false); };
  return (
    <div ref={ref} className="relative w-full max-w-xs min-w-56">
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setQuery(""); }}
        aria-expanded={open}
        className={cn(
          "min-h-11 w-full rounded-full border-2 px-4 pr-3 text-sm font-semibold flex items-center justify-between gap-2 transition-colors text-left",
          value ? "border-primary text-foreground" : dark ? "border-secondary-foreground/40 text-secondary-foreground hover:border-primary" : "border-border hover:border-primary",
        )}
      >
        <span className="truncate">{label}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 opacity-70 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div
          className={cn(
            "absolute z-50 left-0 w-full min-w-64 max-w-xs rounded-xl border border-border bg-popover text-popover-foreground shadow-lg overflow-hidden flex flex-col",
            dropUp ? "bottom-full mb-1" : "top-full mt-1",
          )}
        >
          {projects.length > 6 && (
            <div className="p-2 border-b border-border">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.search}
                className="w-full min-h-10 rounded-lg border border-border bg-transparent px-3 text-sm outline-none focus:border-primary"
              />
            </div>
          )}
          <div className="max-h-64 overflow-y-auto overscroll-contain py-1 thin-scroll">
            {filtered.map((p) => (
              <button key={p.id} type="button" onClick={() => pick(p)} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-accent min-h-11">
                <Check className={cn("h-4 w-4 shrink-0", currentId === p.id ? "opacity-100 text-primary" : "opacity-0")} />
                <span className="truncate font-medium">{p.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">{p.code}</span>
              </button>
            ))}
            {projects.length > 0 && filtered.length === 0 && (
              <p className="px-3 py-2.5 text-sm text-muted-foreground">{lang === "fr" ? "Aucun résultat" : "No match"}</p>
            )}
            <div className="border-t border-border my-1" />
            <button type="button" onClick={() => pick("none")} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-accent min-h-11">
              <Ban className="h-4 w-4 shrink-0 opacity-60" />
              <span className="truncate">{t.none}</span>
            </button>
            <button type="button" onClick={() => { setOpen(false); onNew(); }} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-left hover:bg-accent min-h-11">
              <FolderPlus className="h-4 w-4 shrink-0" />
              <span className="truncate">{t.add}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function NewProjectDialog({ open, onOpenChange, signedIn, onCreated, lang }: {
  open: boolean; onOpenChange: (o: boolean) => void; signedIn: boolean; onCreated: (p: ClientProject) => void; lang: "fr" | "en";
}) {
  const t = L[lang];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>{signedIn ? t.newTitle : t.login}</DialogTitle></DialogHeader>
        {signedIn ? <ProjectForm compact onCancel={() => onOpenChange(false)} onSaved={onCreated} /> : <ClientAuthForm redirectPath="/commander" />}
      </DialogContent>
    </Dialog>
  );
}
