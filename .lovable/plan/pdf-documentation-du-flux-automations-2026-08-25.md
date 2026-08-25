# PDF — Documentation du flux Automations

Générer un PDF d'une page (en français) qui documente le flux d'automation tel qu'il est configuré dans l'app.

## Contenu du PDF

1. En-tête : titre « Automations — Flux de dispatch RenoCart », date de génération, état actuel (Actif / En pause).
2. Diagramme vertical des étapes avec les délais entre chaque :
   - Nouvelle commande — En attente (5 min)
   - Envoi au fournisseur prioritaire (nom du fournisseur configuré) → 35 min
   - Branche : Accepte / Pas de réponse → 5 min
   - Broadcast (liste des fournisseurs configurés) → 30 min
   - Branche : Un fournisseur accepte / Personne ne répond
   - Assignation manuelle
3. Tableau des règles : description de chaque étape (texte des infobulles actuelles), délai, action déclenchée.
4. Note d'avertissement : seuls les fournisseurs listés sur la page Automations reçoivent des emails automatiques.
5. Note : la mise en pause globale ou par commande suspend le flux (incluant la pause auto quand date de livraison, fenêtre horaire ou type de camion manquent).

## Détails techniques

- Lecture des données réelles depuis la base : `app_settings.automations_paused`, `supplier_priority` (ordre 1 = prioritaire, autres = broadcast) et `suppliers` (noms).
- Génération du PDF avec reportlab, police Unicode (DejaVu Sans) pour les accents français, couleurs alignées sur la charte de l'app.
- Fichier livré dans `/mnt/documents/automations-flux-renocart.pdf`, téléchargeable depuis le chat.
- QA : conversion des pages en images et inspection visuelle avant livraison.
- Aucun fichier de l'application n'est modifié — c'est un livrable seulement.
