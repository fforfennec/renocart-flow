import { useState, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { LogIn, LogOut, Menu } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type Lang = "fr" | "en";
const L = {
  fr: { order: "Commander", projects: "Mes projets", team: "Notre équipe", about: "À propos", login: "Connexion", logout: "Déconnexion", menu: "Menu" },
  en: { order: "Order", projects: "My projects", team: "Our team", about: "About", login: "Log in", logout: "Log out", menu: "Menu" },
};

/** Shared client header: always shows Commander, Connexion, Mes projets, Notre équipe, À propos. */
export function ClientHeader({ lang = "fr", extra }: { lang?: Lang; extra?: ReactNode }) {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const t = L[lang];
  const links = [
    { to: "/commander", label: t.order },
    { to: "/projets", label: t.projects },
    { to: "/notre-equipe", label: t.team },
    { to: "/a-propos", label: t.about },
  ];
  const cls = ({ isActive }: { isActive: boolean }) =>
    cn("min-h-11 flex items-center px-3 rounded-md text-sm font-bold text-secondary hover:bg-muted", isActive && "bg-primary/15");
  const auth = user
    ? <Button variant="ghost" className="h-11 font-bold" onClick={() => { setOpen(false); signOut(); }}><LogOut className="h-4 w-4 mr-2" />{t.logout}</Button>
    : <Button asChild variant="ghost" className="h-11 font-bold"><Link to="/connexion" onClick={() => setOpen(false)}><LogIn className="h-4 w-4 mr-2" />{t.login}</Link></Button>;

  return (
    <header className="bg-card border-b shrink-0">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
        <Link to="/commander" className="text-2xl font-black tracking-tight text-secondary">RENO<span className="text-primary">CART</span></Link>
        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => <NavLink key={l.to} to={l.to} className={cls}>{l.label}</NavLink>)}
          {auth}
          {extra}
        </nav>
        <div className="flex md:hidden items-center gap-2">
          {extra}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild><Button variant="ghost" size="icon" className="h-11 w-11" aria-label={t.menu}><Menu className="h-5 w-5" /></Button></SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader><SheetTitle>{t.menu}</SheetTitle></SheetHeader>
              <nav className="mt-4 flex flex-col gap-1">
                {links.map((l) => <NavLink key={l.to} to={l.to} className={cls} onClick={() => setOpen(false)}>{l.label}</NavLink>)}
                {auth}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
