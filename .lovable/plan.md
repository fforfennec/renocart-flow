# Messages clients (support RenoCart)

## Ce que le client verra
- Nouvel onglet **Support** dans `/projets` (à côté de Projets / Suivi).
- « Nouvelle discussion » : une bande défilante horizontale montre ses projets puis ses commandes (numéro, projet, statut de livraison). Il touche une commande pour la lier, ou choisit « Question générale » (aucune commande).
- Fil de discussion style messagerie, réponses de l'équipe en temps réel, pièces jointes (photos, PDF).
- Gestionnaires / employés ne voient que les commandes de leurs projets assignés ; chacun voit seulement ses propres discussions (le compte principal et les super admins voient toutes celles du compte).

## Courriel
- Shopify envoie aujourd'hui la confirmation de commande : les réponses à ce courriel arrivent chez Shopify, pas chez nous. Pour que le client puisse répondre par courriel, RenoCart enverra son propre courriel « Commande RC-xxxx reçue » (depuis la boîte Gmail déjà connectée) quand une commande arrive. Répondre à ce courriel crée/alimente la discussion de cette commande.
- Les réponses du support écrites dans l'app partent aussi par courriel dans ce même fil si la discussion est liée à une commande venant d'un courriel.
- La lecture des courriels entrants réutilise la vérification automatique existante (même boîte), en distinguant fils clients et fils fournisseurs.

## Côté équipe RenoCart
- Nouvelle page **Messages clients** dans `/admin` : même visuel que Messages fournisseurs — filtre par client à gauche, liste des conversations, chat à droite, non-lus.
- Dans l'en-tête d'une discussion sans commande : bouton « Assigner une commande » qui liste les commandes de ce client ; on peut aussi changer la commande liée.
- Badge « via courriel » / « via le site » sur chaque message.

## Détails techniques
- Tables : `support_threads` (client owner_id, created_by user_id, customer_email, order_id nullable, subject, gmail_thread_id, status, last_message_at) et `support_messages` (thread_id, author_user_id, sender_role client|staff, source web|email, content, attachments jsonb). GRANTs + RLS : client = créateur du fil ou owner/super_admin du compte (via `client_ctx`) ; ordre lié doit passer `client_can_view_order` ; admins tout. Realtime sur `support_messages`.
- RPC `start_support_thread(_order_id, _content)` et `post_support_message` côté client (validation serveur de l'accès à la commande).
- Edge functions : `send-client-confirmation` (appelée par `shopify-order-webhook`, enregistre gmail_thread_id), `support-reply` (staff → message + courriel), extension de `poll-supplier-emails` pour router les fils clients ; `admin` assigne la commande via mise à jour protégée par `has_role(admin)`.
- Fichiers : `src/portals/client/components/projects/SupportChat.tsx`, `Projets.tsx` (onglet), `src/portals/team/pages/admin/ClientMessages.tsx`, menu admin + `TeamRoutes`.
- Rien ne touche à `/commander` ni au système vocal.
