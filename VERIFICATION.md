# Vérification — Refonte 03

Vérification effectuée le 12 septembre 2026.

**68 contrôles automatisés réussis, aucun échec.** Aucun message d’exception
JavaScript ou d’erreur de compilation des shaders relevé dans les parcours
navigateur. Ces résultats ne garantissent pas l’absence de tout bug.

## Environnement des essais

Linux, Node.js, Chromium headless et rendu WebGL 1 logiciel SwiftShader.
Les ressources du jeu sont locales. Captures à 1280 × 800 et contrôle
d’interface mobile à 390 × 844. Les scénarios de simulation utilisent une
horloge contrôlée ; un parcours distinct vérifie aussi le démarrage par clic
et le déplacement clavier avec la vraie boucle requestAnimationFrame.
Les manettes sont simulées : aucun essai physique DualSense USB/Bluetooth,
GPU de joueur ou appareil Android n’a été effectué.

## Résultats reproductibles

| Suite | Réussis | Échecs | Preuve incluse |
|---|---:|---:|---|
| Logique et collisions | 13 | 0 | `verification/core-results.txt` |
| Commandes | 7 | 0 | `verification/input-results.txt` |
| Animation | 8 | 0 | `verification/animation-results.txt` |
| Persistance et navigation | 9 | 0 | `verification/campaign-results.txt` |
| Navigateur et intégration | 29 | 0 | `verification/browser-results.json` |
| Import et nouvelle campagne après rechargement | 2 | 0 | `verification/lifecycle-results.json` |

Les tests de commandes couvrent les orientations de caméra, la diagonale,
la zone morte, la séparation des sticks et gâchettes, les entrées résiduelles
et la déconnexion. Les tests de simulation couvrent collisions, conduite,
recrutement, tirs, couverture, rechargement, conquêtes, fortification et mission.

Les nouveaux contrôles vérifient :

- La longueur des segments articulés et la limitation de portée, les démarrages
  et arrêts progressifs, les jambes pendant la visée/recharge, l’événement de
  réception unique et des transformations finies à 30, 60 et 120 Hz.
- La portière, la suspension de l’entrée par la pause, le blocage des commandes
  pendant la transition et la pose assise du conducteur.
- Le contact différé du corps à corps et l’attribution unique des dégâts.
- La mise à terre, le secours temporisé, la perte à expiration et l’exclusion
  des équipiers à terre du calcul de capture.
- La restauration d’une mission, d’une attaque, d’une voiture et des ennemis
  neutralisés, ainsi que la reprise sur une copie de secours après corruption.
- La migration v2 avec portefeuille à zéro, le refus d’un import incorrect,
  la conservation de l’ancienne sauvegarde quand le stockage échoue et les
  détours autour d’un obstacle sans traverser ses angles.
- L’accès aux dix séquences du studio d’animation.
- L’import réel d’un fichier depuis Pause et une nouvelle campagne confirmée,
  suivis d’un rechargement : la sauvegarde à la fermeture ne doit ni écraser
  l’import ni recréer la campagne effacée.

Le fichier de résultats navigateur décrit chaque contrôle et son statut.
Les instructions d’exécution sont dans `README.md`.

## Inspection visuelle et démonstration

Les captures dans `verification/` proviennent du véritable rendu :

- `01-accueil.png` : ville et accueil.
- `02-jeu.png` : personnage, équipe, ombres et interface.
- `03-vehicule.png` : véhicule à proximité du personnage.
- `04-carte.png` : carte et informations du quartier.
- `05-mobile.png` : interface sur fenêtre étroite.
- `06-studio.png` : studio et pose de visée.
- `MARLON-animations-v3.mp4` : six extraits de séquences, huit secondes,
  960 × 600, 24 images/s, sans audio. Les images ont été rendues une à une
  par le studio puis encodées ; leur cadence n’est pas un benchmark.

Les captures du jeu emploient une campagne de test. Une nouvelle campagne
commence avec 900 €, les Forges et aucun équipier.

## Ce qui reste à valider avant la vente

Le rendu et les animations restent procéduraux et stylisés. Les prises de main,
appuis au sol et transitions vers les véhicules demandent encore une finition
artistique ; le studio rend ces limites inspectables. Le système de chemins
ne constitue pas une simulation complète de trafic ni une IA tactique avancée.

Il manque notamment une campagne complète testée par des joueurs, l’équilibrage,
des sessions d’endurance, des mesures sur les GPU cibles, les essais physiques
manette/mobile, les configurations minimales et les critères de la plateforme
de distribution. Les sons sont synthétisés, les bâtiments principalement
extérieurs et aucun installateur natif n’est fourni. **Cette livraison n’est
pas déclarée prête à être commercialisée.**

Aucun déploiement public n’a été effectué pendant cette itération.
