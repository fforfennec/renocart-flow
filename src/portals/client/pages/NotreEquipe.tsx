import { useEffect } from "react";
import { ClientHeader } from "@/portals/client/components/ClientHeader";

// Content from renocart.ca « Notre équipe ».
const CDN = "https://renocart.ca/cdn/shop/files";
const TEAM = [
  { name: "Yanis Birouche", role: "Président", img: `${CDN}/Profil_2336x3504_crop_center.jpg?v=1718945267`, text: "Bâtir l'avenir avec précision et soin. Chez RenoCart, nous croyons en l'importance d'offrir un service exceptionnel et de garantir à nos clients des matériaux de qualité supérieure avec une efficacité inégalée." },
  { name: "Badis Birouche", role: "Vice-président", img: `${CDN}/AF_1209-2_3429x5143_crop_center.jpg?v=1718945304`, text: "Soutenir chaque projet avec précision et attention. Je m'engage à rendre nos opérations aussi fluides et fiables que possible, pour que nos clients reçoivent leurs matériaux quand ils en ont besoin." },
  { name: "Junior Ajibola", role: "Analyste d'affaires", img: `${CDN}/AF_1432_3002x4503_crop_center.jpg?v=1718945412`, text: "J'analyse les données commerciales et opérationnelles pour guider nos décisions et améliorer l'expérience de nos clients." },
  { name: "Alexander Schnavel", role: "Directeur des ventes", img: `${CDN}/AF_1416_2852x4278_crop_center.jpg?v=1718945392`, text: "Je supervise l'équipe commerciale et bâtis des relations de confiance avec nos clients et partenaires, pour leur offrir les solutions les plus adaptées à leurs projets." },
];

export default function NotreEquipe() {
  useEffect(() => { document.title = "RenoCart — Notre équipe"; }, []);
  return (
    <div className="min-h-screen bg-background">
      <ClientHeader />
      <main className="max-w-6xl mx-auto px-4 py-10 space-y-10">
        <section className="space-y-4 max-w-3xl">
          <p className="inline-block rounded-md bg-primary/20 px-2 py-0.5 text-xs font-bold uppercase tracking-widest text-secondary">Notre équipe</p>
          <h1 className="text-4xl font-black tracking-tight">Une équipe toujours prête à vous servir.</h1>
          <h2 className="text-lg font-black uppercase">Notre histoire</h2>
          <p className="text-muted-foreground">Deux frères passionnés par la construction ont constaté les difficultés des entrepreneurs à obtenir rapidement des matériaux de qualité. En 2020, avec une camionnette et beaucoup de détermination, ils ont lancé Transport Birouche. Un an plus tard, plus de 8 camions roulaient dans Montréal. Après plus de 1800 chantiers livrés, l'équipe a décidé de fournir elle-même les matériaux.</p>
          <p className="text-muted-foreground">Aujourd'hui, RenoCart est un partenaire de confiance qui sert plus de 200 entreprises chaque semaine dans le Grand Montréal, avec des produits d'entreprises d'ici pour des entrepreneurs d'ici.</p>
        </section>
        <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TEAM.map((m) => (
            <article key={m.name} className="bg-card rounded-2xl border shadow-soft overflow-hidden">
              <img src={m.img} alt={m.name} loading="lazy" className="w-full aspect-[3/4] object-cover" />
              <div className="p-4"><h3 className="font-black text-lg">{m.name}</h3><p className="text-sm font-bold text-primary">{m.role}</p><p className="text-sm text-muted-foreground mt-2">{m.text}</p></div>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
