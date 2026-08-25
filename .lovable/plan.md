# Aperçu du courriel envoyé aux fournisseurs

## Objectif

Te fournir une copie exacte du courriel que l'application envoie aux fournisseurs, pour que tu puisses le lire, l'imprimer ou le transférer.

## Ce que je vais produire

Un fichier HTML autonome (`courriel-fournisseur-apercu.html`) rempli avec des données d'exemple réalistes (commande RC3127, adresse de livraison, liste de matériaux, note interne), plus une capture d'image pour prévisualisation directe dans le chat. Le rendu sera identique à ce que reçoit le fournisseur : en-tête RenoCart, bloc Livraison, tableau des matériaux, encadré de note, et les deux boutons « Oui, je confirme » / « Modifier – Je ne peux pas ».

Je vais aussi générer le second gabarit existant : le courriel d'**annulation** envoyé au fournisseur précédent lorsqu'une commande est réassignée.

Aucun changement au code ni au contenu des courriels — c'est uniquement une extraction pour aperçu.

## Envoi à badis@birouche.ca

L'envoi direct vers ton adresse n'est pas possible pour l'instant : aucun domaine d'envoi n'est configuré dans le projet, et la clé Resend actuelle ne peut livrer qu'à l'adresse du propriétaire du compte Resend. Deux options :

1. Tu télécharges le fichier d'aperçu depuis le chat (recommandé, immédiat).
2. On configure un domaine d'envoi pour le projet, et je pourrai ensuite t'expédier le courriel de test à badis@birouche.ca.

Je fais l'option 1 dès l'approbation; dis-moi si tu veux aussi l'option 2.

## Détails techniques

- Source : le HTML inline des courriels dans la fonction `dispatch-order` (courriel de dispatch + courriel d'annulation).
- Sortie : fichiers HTML dans les artéfacts, avec vérification visuelle (rendu converti en image, contrôle des débordements/polices/couleurs) avant livraison.
