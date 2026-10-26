import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ClientHeader } from "@/portals/client/components/ClientHeader";

// Content from renocart.ca « Méthodes de livraison » and « Livraison spéciale ».
const CDN = "https://renocart.ca/cdn/shop/files";

const Block = ({ title, children, img }: { title: string; children: React.ReactNode; img?: string }) => (
  <article className="bg-card rounded-2xl border shadow-soft overflow-hidden flex flex-col">
    {img && <img src={img} alt="" loading="lazy" className="w-full h-48 object-cover" />}
    <div className="p-5 space-y-2 text-sm leading-relaxed"><h3 className="text-lg font-black">{title}</h3>{children}</div>
  </article>
);

export default function APropos() {
  useEffect(() => { document.title = "RenoCart — À propos"; }, []);
  return (
    <div className="min-h-screen bg-background">
      <ClientHeader />
      <main className="max-w-6xl mx-auto px-4 py-10 space-y-14">
        <section className="space-y-4">
          <p className="inline-block rounded-md bg-primary/20 px-2 py-0.5 text-xs font-bold uppercase tracking-widest text-secondary">À propos</p>
          <h1 className="text-4xl font-black tracking-tight">Méthodes de livraison</h1>
          <p className="max-w-3xl text-muted-foreground">Chez RenoCart, nous nous efforçons de rendre votre expérience d'achat de matériaux de construction aussi pratique que possible. Nous comprenons que dans le secteur de la construction, le temps est précieux : notre méthode de livraison garantit que vous recevez vos matériaux directement sur le chantier en un temps record.</p>
          <div className="grid md:grid-cols-3 gap-4 pt-2">
            <Block title="Livraison" img={`${CDN}/34_690x_crop_center.png?v=1720103592`}>
              <p>Choisissez une date ainsi qu'une heure de livraison parmi nos trois plages horaires. Vous pouvez les choisir directement au moment de passer votre commande.</p>
            </Block>
            <Block title="Date et heure" img={`${CDN}/35_690x_crop_center.png?v=1720103592`}>
              <p>Les plages de livraison sont les mêmes du lundi au dimanche :</p>
              <ul className="list-disc pl-5 font-semibold"><li>6 h à 9 h</li><li>9 h à 12 h</li><li>13 h à 17 h</li></ul>
            </Block>
            <Block title="Traitement de la commande" img={`${CDN}/32_690x_crop_center.png?v=1720103592`}>
              <p>Une fois votre commande passée, notre équipe la traite instantanément. Vous recevrez une notification du livreur lorsque votre commande sera ramassée. Indiquez toute spécification importante dans les notes de la commande.</p>
            </Block>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <Block title="Sélection de vos matériaux">
              <p>Faites votre sélection parmi notre vaste gamme de matériaux de construction. Si vous ne trouvez pas un produit, indiquez-le dans votre commande : nous le trouverons pour vous et le déposerons avec votre commande complète sur votre chantier.</p>
              <Button asChild className="h-11 font-bold mt-2"><Link to="/commander">Commander</Link></Button>
            </Block>
            <Block title="Pour un retour">
              <p>Nous offrons des services de retour pour vos matériaux. Vos besoins peuvent changer : nous facilitons le processus de retour pour garantir votre satisfaction.</p>
              <Button asChild variant="outline" className="h-11 font-bold mt-2"><a href="https://renocart.ca/pages/demander-un-retour" target="_blank" rel="noopener noreferrer">Demander un retour</a></Button>
            </Block>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-4xl font-black tracking-tight">Livraison spéciale</h2>
          <p className="text-lg font-bold">Nous livrons, vous construisez ! Plus de 200 entrepreneurs livrés chaque semaine.</p>
          <div className="grid md:grid-cols-3 gap-4">
            <Block title="Démarrage de projet" img={`${CDN}/991E4E1C-9DEB-47F0-85CE-12CC95839E14_b88ed87d-749a-4c2e-b6bc-7e09e3a2da8f_690x_crop_center.jpg?v=1719968652`}>
              <p>Nous offrons une consultation gratuite pour l'évaluation de votre projet de construction. Profitez de notre expertise pour optimiser vos plans et vos estimations. Avec plus de 1300 chantiers livrés, notre équipe vous guide pour une planification précise et un démarrage sans souci.</p>
            </Block>
            <Block title="Manutention / Walk-in" img={`${CDN}/7FD6A83E-4CA8-4C0E-8EDF-F50F3E27C171_1_102_o_690x_crop_center.jpg?v=1720118562`}>
              <p>Avec notre service « walk-in », nous livrons vos matériaux directement à l'intérieur de vos chantiers, là où vous en avez besoin. Gagnez du temps et évitez les tracas de la manutention en laissant notre équipe s'occuper de tout.</p>
            </Block>
            <Block title="Livraison complexe">
              <p>Notre service de livraison complexe répond aux exigences particulières de vos chantiers : sites difficiles d'accès, horaires restreints ou conditions de livraison spécifiques. Grâce à notre flotte spécialisée et à notre expertise logistique, vos matériaux arrivent à destination en toute sécurité et sans retard.</p>
            </Block>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <Block title="Vous ne trouvez pas un produit ?">
              <p>Envoyez-nous directement votre liste ou ajoutez une note à votre commande. Notre équipe coordonnera la livraison pour vous.</p>
              <Button asChild variant="outline" className="h-11 font-bold mt-2"><a href="https://renocart.ca/pages/contact" target="_blank" rel="noopener noreferrer">Demande de produit</a></Button>
            </Block>
            <Block title="Vous avez un projet qui débute ?">
              <p>Notre équipe est là pour vous assister !</p>
              <Button asChild className="h-11 font-bold mt-2"><a href="https://calendly.com/renocart/renocart" target="_blank" rel="noopener noreferrer">Parler avec un représentant</a></Button>
            </Block>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {[["« Le Amazon de la construction ! C'est incroyable. »", "Thomas, Gestion KD"],
              ["« J'ai appelé Badis vendredi, mes matériaux sont arrivés samedi sur le chantier. Ma cliente n'en revenait pas ! »", "Kevin, Gestion +"],
              ["« 125 feuilles de gypse coupées puis livrées au 6e étage du square Victoria. Tout ça de nuit ! Super sharp ! »", "Onneil, A+"]].map(([q, a]) => (
              <figure key={a} className="bg-muted rounded-2xl p-5"><blockquote className="font-semibold">{q}</blockquote><figcaption className="text-sm text-muted-foreground mt-2">{a}</figcaption></figure>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
