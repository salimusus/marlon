# Vérification — Sunshine City 05

Campagne de vérification du 12 septembre 2026, sous Linux / Chromium headless /
WebGL SwiftShader. Les résultats portent sur les scénarios décrits ci-dessous.

| Suite | Réussis | Preuve |
|---|---:|---|
| Logique, collisions et conduite de base | 13 | `verification/core-results.txt` |
| Commandes et profils manette | 7 | `verification/input-results.txt` |
| Animation articulée | 8 | `verification/animation-results.txt` |
| Sauvegarde et navigation | 9 | `verification/campaign-results.txt` |
| Catalogues, école et jeux de plateau | 9 | `verification/city-results.txt` |
| Régression des activités urbaines | 30 | `verification/city-browser-results.json` |
| Import et nouvelle campagne avec navigation réelle | 2 | `verification/lifecycle-results.json` |
| Contrôle indépendant de la version 05 | 24 | `verification/v5-browser-results.json` |
| Chutes, caméra et signal audio | 16 | `verification/feel-audio-results.json` |
| Couleurs rouge/bleu de l’explosion après collision | 1 | `verification/v5-explosion-color-results.json` |

**119 contrôles réussis, aucun échec final ni exception JavaScript relevée.**
Ce nombre compte les assertions regroupées en scénarios des suites ; il ne
signifie pas que toutes les combinaisons possibles du jeu ont été explorées.

## Contrôle indépendant

Le rapport [v5-review.md](verification/v5-review.md) détaille les 24 parcours de
l'agent de contrôle : démarrage avec le bouton Jouer, vraies touches clavier,
manette simulée dans quatre orientations, vol occupé, extraction du conducteur,
portières, freinage, collision contre une façade, explosion unique, sortie
protégée, banc, chiens, gangs, école, son, sauvegarde, mobile et résolution UHD.
Une seconde page conserve la boucle requestAnimationFrame native et vérifie
un déplacement au clavier. Les positions de départ et certains états de scénario
sont préparés via `?test=1`, puis les actions utilisateur sont exécutées.

L'inspection des images a découvert un défaut de respiration qui étirait le
torse en un grand ovale blanc. Il a été corrigé dans l'animation, puis la capture
du personnage a été régénérée et inspectée pour vérifier sa disparition.

## Cas complémentaires

Les 16 contrôles de chute et de son couvrent des hauteurs de 8, 16 et 40 mètres,
un passage du toit à la rue, une réception rapide sur dalle, les escaliers, le
support indépendant des PNJ et le passage au-dessus d'une voiture. Ils ne donnent
pas d'invincibilité au joueur pour masquer un problème de chute.

Le graphe audio ne se crée qu'après interaction. Les essais vérifient les pas,
les événements, la suspension en pause, les volumes persistants et un signal
moteur effectivement non nul, dont l'amplitude reste bornée. Ce contrôle du
signal ne remplace pas une écoute sur des équipements physiques variés.

## Rendu et portée des mesures

Le réglage Ultra HD crée un tampon de **3840 × 2160 pixels** pour un viewport
1280 × 720. Ce contrôle de dimensions n'est pas un benchmark d'image 4K.
La vue de portrait inspectée demande 639 appels de dessin et 620 082 triangles
après optimisation, contre 1 217 appels et 1 498 936 triangles avant correction
de la visibilité dans cette même vue. Le coût d'une vue générale est plus élevé.
Aucun chiffre de FPS sur PC ou téléphone de joueur n'est revendiqué.

Les captures `20-*` à `25-*` et `v5-*` proviennent du programme. Certaines vues
utilisent une caméra d'inspection et masquent le HUD. Elles ne sont pas des
illustrations générées. Les captures 01–06 et 13–18 et les anciens rapports de refonte 03
restent des documents historiques ; ils ne s'ajoutent pas au total de tests V5.

## Validation restant à faire

Aucun essai sur manette physique, GPU de joueur, tablette ou équipement audio
physique ; pas de test d'endurance de plusieurs heures ni de campagne complète
jouée humainement. L'agent de contrôle valide les parcours indiqués, pas une
certification commerciale. Le [bilan](BILAN-SUNSHINE.md) précise les simulations
simplifiées, les décors qui restent non manipulables et les travaux restants.
