# MARLON 0.10 — validation du 20 septembre 2026

Cette révision répond au retour sur l’introduction trop statique, les changements visuels trop discrets et les commandes PS5/Xbox défectueuses.

## Implémentation

- `cinematic.js` : cinq plans en 32 secondes, vrais avatars articulés en mouvement, saut d’obstacle, voitures et roues animées, conquête progressive des huit quartiers, finale d’équipe. Musique originale synthétisée, export, accessibilité et mouvement réduit conservés. Décor instancié et ressources libérées à la fermeture. Étalonnage corrigé après inspection du premier export.
- `city-detail.js` : planification des marquages à partir du réseau final, peinture découpée aux intersections, flèches conformes aux voies, détails de trottoirs, façades et boutiques. Trois lots de géométrie statique ; aucun obstacle de collision supplémentaire. Matériaux routiers et gestion sRGB corrigés dans le moteur principal.
- `controls.js` : normalisation des manettes, hystérésis des gâchettes, zones mortes radiales, répétition de navigation et barrières entre les contextes. Le jeu sépare les touches du clavier, du téléphone et de la manette. Une déconnexion ne relâche pas les touches tenues sur les autres appareils. Pause et changement de monde passent par la même gestion des menus.
- Contacts des véhicules : séparation selon les rectangles orientés des châssis, puis synchronisation immédiate des positions physiques, des modèles et des colliders.
- Version 0.10 affichée à l’accueil ; URL des modules versionnée pour invalider l’ancien cache. La nouvelle introduction est jouée une fois pour les profils ayant déjà vu l’ancienne. Les sauvegardes restent conservées.

## Vérifications automatisées

Commande : `npm test`. Journal : `refonte-010-tests.txt`.

| Suite | Cas |
| --- | ---: |
| Campagne et sauvegardes historiques | 15 |
| Économie et objectifs | 7 |
| Commandes et TV | 16 |
| Nouveau noyau manette et intégration complète | 21 |
| Rendu existant | 9 |
| Voirie, façades et chaîne couleur | 10 |
| Contacts des véhicules | 6 |
| Circulation dans le réseau complet | 14 |
| Sauvegardes malformées | 4 |
| Cinématique, action et cycle de vie | 14 |
| Accessoires invisibles | 1 |
| **Total** | **117** |

La circulation déterministe charge les 89 routes et simule une minute avec huit véhicules. Chaque véhicule parcourt entre 169 et 326 mètres, sans téléportation ni sortie de chaussée détectée dans ce scénario. Les tests de contacts couvrent aussi des véhicules orientés et les remorques longues.

Les tests manette exécutent les véritables gestionnaires clavier et la physique du jeu avec des périphériques simulés : déplacement latéral, mode rotation, vitesse de caméra identique à 30/60/120 lectures par seconde, dérive, gâchettes, menus, saisie, déconnexion et entrée/sortie de la cinématique. Deux anciens montages de test ont été adaptés : une touche gamepad doit être injectée avec sa source, et le stub de la jauge doit avoir son parent DOM. Les réexécutions indépendantes sont conservées dans les journaux `refonte-010-empire-final.txt` et `refonte-010-gamepad-final.txt`.

## Contrôle dans le navigateur

La version locale a été chargée, la cinématique lue puis exportée réellement, et la partie démarrée après fermeture de l’introduction. Le menu Pause et l’écran de diagnostic manette ont été ouverts et fermés. Aucune erreur JavaScript n’a été relevée pendant ces contrôles. Routes et façades ont été inspectées en capture. Les cinq plans du MP4 ont été inspectés après correction des couleurs.

Export vidéo : H.264/AAC, 1920 × 1080, 30 images/s, durée 32,05 secondes. Il s’agit d’un montage dans une scène de présentation avec les modèles du jeu ; ce n’est pas une capture de la ville jouable complète.

## Limites de la vérification

Les périphériques des tests sont simulés. Aucun essai physique contrôlé PS5/Xbox, Bluetooth, téléviseur ou liaison réseau à deux appareils n’est revendiqué. La sortie MP4 à 30 images/s ne mesure pas la fluidité de la ville. La campagne complète et l’endurance restent hors de cette validation.
