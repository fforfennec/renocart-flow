import { FolderPlus, Ban } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClientAuthForm } from "@/components/projects/ClientAuthForm";
import { ProjectForm } from "@/components/projects/ProjectForm";
import type { ClientProject } from "@/lib/clientProjects";
import { cn } from "@/lib/utils";

export type ProjectChoice = ClientProject | "none" | null;

const L = {
  fr: { none: "Aucun projet", add: "Nouveau projet", project: "Projet", newTitle: "Nouveau projet", login: "Connecte-toi pour créer un projet" },
  en: { none: "No project", add: "New project", project: "Project", newTitle: "New project", login: "Sign in to create a project" },
};

/** Horizontally scrolling project chips (projects + none + new). Display only — independent of the voice pipeline. */
export function ProjectStrip({ projects, value, onPick, onNew, lang, dark }: {
  projects: ClientProject[]; value: ProjectChoice; onPick: (p: ProjectChoice) => void; onNew: () => void; lang: "fr" | "en"; dark?: boolean;
}) {
  const t = L[lang];
  const chip = (active: boolean) => cn("shrink-0 min-h-11 rounded-full border-2 px-4 text-sm font-semibold whitespace-nowrap flex items-center gap-1.5 transition-colors",
    active ? "border-primary bg-primary text-primary-foreground" : dark ? "border-secondary-foreground/40 text-secondary-foreground hover:border-primary" : "border-border hover:border-primary");
  const id = value && value !== "none" ? value.id : value;
  return (
    <div role="radiogroup" aria-label={t.project} className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {projects.map((p) => (
        <button key={p.id} role="radio" aria-checked={id === p.id} className={chip(id === p.id)} onClick={() => onPick(p)}>
          {p.name}<span className="opacity-70 text-xs">{p.code}</span>
        </button>
      ))}
      <button role="radio" aria-checked={id === "none"} className={chip(id === "none")} onClick={() => onPick("none")}><Ban className="h-4 w-4" />{t.none}</button>
      <button className={chip(false)} onClick={onNew}><FolderPlus className="h-4 w-4" />{t.add}</button>
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
