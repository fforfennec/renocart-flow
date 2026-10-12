# Module « Gestion de projet » pour les clients

## Ce que le client pourra faire
1. **Se connecter** sur une nouvelle page client (/projets) avec son courriel et un mot de passe (création de compte si nouveau).
2. **Créer et modifier des projets** : nom du projet, code de projet, adresse de livraison, nom du contact, téléphone du contact, notes.
3. **Ouvrir un projet** et voir :
   - le total des dépenses (taxes incluses, et sous-total avant taxes) ;
   - le total des matériaux commandés (par produit, avec quantités) ;
   - la liste des factures, chacune téléchargeable, plus un bouton « Tout télécharger » (fichier ZIP).
4. **Voir une section « Sans projet »** avec les factures des commandes non assignées, et pouvoir assigner une commande à un projet après coup.

## Dans /commander
- **Client qui a déjà des projets** : au début de la conversation, une bande défilante de pastilles : ses projets, « Aucun projet » et « + Nouveau projet ».
- **Client sans projet** (ou pas connecté) : à la fin, avant « Placer ma commande », le bot demande « Associer cette commande à un projet ? » [Créer un projet] [Non, commander].
- Une ligne « Projet » s'ajoute au récapitulatif avec « Modifier ».
- L'adresse du projet est pré-remplie au paiement Shopify (modifiable).
- Le nom et le code du projet sont envoyés à Shopify avec la commande.
- Le système d'écoute et de compréhension n'est pas touché.

## Factures
- Le nom et le code du projet sont enregistrés sur la commande Shopify (visibles dans l'admin Shopify et sur la commande).
- La facture téléchargeable est produite à partir des données de la commande Shopify (produits, quantités, prix, taxes, total) et affiche le nom et le code du projet.

## Limites à connaître
- **Même login que la boutique Shopify** : pas inclus dans cette étape. Ça demande d'activer les « nouveaux comptes clients » Shopify et une connexion spéciale. Pour l'instant : compte courriel ; la commande est reliée au client par son courriel, donc ses anciennes commandes Shopify faites avec le même courriel apparaîtront aussi.
- **Prix et totaux** : l'accès Shopify qui donne les prix a expiré. Il faudra le reconnecter, sinon les totaux et factures resteront vides pour les nouvelles commandes.
- **Facture Shopify officielle** : Shopify ne permet pas de télécharger ses factures automatiquement. Si tu veux leur modèle exact (ex. application Order Printer), il faudra y ajouter toi-même le nom et le code du projet ; je te donnerai la ligne à coller.

## Détails techniques
- Tables : `client_projects` (owner_id, name, code, address, contact_name, contact_phone, notes), colonnes sur `orders` : customer_email, customer_user_id, project_id, subtotal, total_tax, total_price, currency, line prices sur `order_items`. RLS : le client ne voit que ses projets et commandes (par user_id ou courriel vérifié).
- Rôle client séparé (`app_role` += 'client') ; les pages admin/fournisseur inchangées.
- Cart attributes Shopify : project_id, project_name, project_code ; buyerIdentity.deliveryAddressPreferences pour l'adresse.
- shopify-order-webhook : lit les attributs projet, le courriel, les prix et taxes.
- Facture PDF générée côté navigateur (jsPDF), ZIP avec JSZip.
