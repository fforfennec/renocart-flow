# Plan : Chat fournisseur bidirectionnel (email <-> app)

## Objectif
Transformer le Supplier Chat actuel en une interface type Messenger où chaque fournisseur assigné à une commande a son propre fil de conversation. Un fournisseur peut répondre par email (à commande@renocart.ca) et sa réponse apparaît dans son fil. L'admin peut répondre depuis l'app et le message est envoyé par email au fournisseur.

## Prérequis
- Un compte Google Workspace avec la boîte `commande@renocart.ca`.
- Connecter ce compte Gmail au projet via l'outil de connexion Lovable (scopes `gmail.send`, `gmail.readonly`, `gmail.modify`).
- Les emails de dispatch initiaux seront envoyés par Gmail aussi, avec un sujet normalisé, pour que les réponses soient rattachées au bon fil.

## Architecture

```text
Fournisseur répond par email -> commande@renocart.ca (Gmail)
         |
         v
  poll-supplier-emails (Edge Function cron toutes les 1-2 min)
         |
         v
  order_messages (source='email', supplier_id=...)
         |
         v
  UI Messenger par fournisseur
         |
         v
  Admin répond -> send-supplier-email (Edge Function)
         |
         v
  Gmail API -> email au fournisseur, sujet normalisé
```

## Modèle de données

1. **Table `order_messages`** : ajouter les colonnes suivantes :
   - `supplier_id uuid references auth.users(id) nullable` — fournisseur destinataire/source du message.
   - `source text not null default 'app'` — `'app'` (envoyé depuis l'interface) ou `'email'` (reçu par email).
   - `email_message_id text nullable` — ID du message Gmail, pour éviter les doublons.
   - `is_broadcast boolean not null default false` — true si le message a été envoyé à tous les fournisseurs de la commande.

2. **Migration SQL** : ajouter les colonnes, mettre à jour les politiques RLS existantes, créer un index sur `(order_id, supplier_id, created_at)`.

3. **Rétrocompatibilité** : les anciens messages sans `supplier_id` restent visibles comme messages généraux.

## Edge Functions

### `send-supplier-email`
- Appelée quand l'admin envoie un message dans un fil fournisseur.
- Paramètres : `order_id`, `supplier_id`, `content`, optionnel `broadcast`.
- Récupère l'email du fournisseur via `auth.admin.getUserById` ou `profiles`.
- Construit un email RFC 2822 avec sujet : `Re: Commande {order_number} — {supplier_name}`.
- Envoie via Gmail API (`messages/send`) en utilisant le connector gateway.
- Insère une ligne dans `order_messages` avec `source='app'`.
- Si `broadcast=true`, envoie à tous les fournisseurs assignés et marque `is_broadcast=true`.

### `poll-supplier-emails`
- Appelée par un cron toutes les 1-2 minutes.
- Liste les messages non lus de la boîte Gmail (`is:unread`).
- Pour chaque message :
  - Parse le sujet pour extraire le numéro de commande (`RC####`).
  - Identifie l'expéditeur et cherche le `supplier_id` correspondant dans `profiles`/`auth.users`.
  - Extrait le corps texte du message.
  - Insère dans `order_messages` avec `source='email'`, `email_message_id` pour déduplication.
  - Marque le message comme lu dans Gmail (`removeLabelIds: ["UNREAD"]`).
- Gestion des erreurs : messages sans numéro de commande connu sont ignorés et marqués lus pour éviter le bruit.

## Interface utilisateur

1. **Remplacer le Supplier Chat actuel** par une vue Messenger :
   - Sidebar gauche : liste des fournisseurs assignés à la commande, avec leur nom, statut de réponse, et badge de messages non lus.
   - Panneau droit : fil de conversation du fournisseur sélectionné, mélangeant messages app et emails.
   - Input en bas pour répondre, avec un bouton "Envoyer à tous" optionnel.

2. **Indicateurs visuels** :
   - Messages reçus par email : petit badge "Email" ou icône enveloppe.
   - Messages envoyés depuis l'app : badge "Chat".
   - Messages broadcast : badge "À tous".

3. **Intégration** :
   - Conserver le bouton flottant actuel pour ouvrir le panneau.
   - Le panneau s'ouvre avec la liste des conversations.

## Sécurité

- RLS sur `order_messages` : admins peuvent tout lire/écrire ; fournisseurs ne voient pas cette table (ils interagissent par email).
- L'Edge Function `send-supplier-email` vérifie que l'appelant est admin via `has_role(auth.uid(), 'admin')`.
- Le cron `poll-supplier-emails` utilise la service role key, pas d'appel client direct.
- Ne jamais logger le contenu des emails ou les tokens Gmail.

## Étapes de déploiement

1. Connecter le compte Gmail via l'outil de connexion Lovable.
2. Créer et appliquer la migration SQL pour `order_messages`.
3. Créer les Edge Functions `send-supplier-email` et `poll-supplier-emails`.
4. Configurer le cron job pour `poll-supplier-emails`.
5. Modifier `OrderSidebar.tsx` pour la vue Messenger.
6. Mettre à jour `dispatch-order` pour envoyer le premier email via Gmail avec un sujet normalisé et un Reply-To vers `commande@renocart.ca`.
7. Déployer les Edge Functions affectées.
8. Tester avec un email de fournisseur.

## Notes
- Resend restera configuré en secours pour les emails système non-conversationnels si nécessaire, mais le flux fournisseur passera principalement par Gmail.
- Les fournisseurs n'ont pas besoin de compte app pour répondre : un simple réponse par email suffit.
- Si un fournisseur n'est pas encore dans `profiles`, son email est quand même enregistré dans `order_messages` avec `supplier_id=null` et peut être lié manuellement plus tard.
