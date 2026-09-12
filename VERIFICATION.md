# Vérification — Sunshine City 04

Vérification le 12 septembre 2026. Résultats du code livré, sous Linux / Chromium
headless / WebGL SwiftShader. Les scénarios principaux avancent une simulation
contrôlée. Ils ne mesurent pas la fréquence d’images d’un ordinateur de joueur.

| Suite | Réussis | Preuve |
|---|---:|---|
| Logique, collisions, conduite de base | 13 | `verification/core-results.txt` |
| Commandes, profils manette et remise à zéro | 7 | `verification/input-results.txt` |
| Animation articulée | 8 | `verification/animation-results.txt` |
| Sauvegarde et navigation de base | 9 | `verification/campaign-results.txt` |
| Catalogues, questions, progression, dames/échecs/poker | 9 | `verification/city-results.txt` |
| Parcours de la nouvelle ville | 30 | `verification/city-browser-results.json` |
| Import et nouvelle campagne après navigation réelle | 2 | `verification/lifecycle-results.json` |

Total : **78 contrôles réussis**. Aucun échec et aucune exception JavaScript
relevée sur ces parcours. Les anciens résultats de refonte 03 constituent un
historique, pas des tests supplémentaires de la nouvelle ville.

Les parcours navigateur couvrent les achats et refus, la livraison physique,
les performances des pièces moteur, les vêtements, les récompenses scolaires
uniques, l’ascenseur/pause, la continuité des escaliers, les animaux, la grande
roue, les coffres chronométrés, l’entraînement, les feux, le mobilier, les missions,
l’hélicoptère, l’ouverture des commerces et casinos, la facturation de la police,
l’arrêt au feu rouge, un ordre de soin d’équipier, le constat et le treuil,
la persistance de progression et l’interface mobile. Le casino vérifie aussi
qu’une animation périmée ne crédite pas une autre session et qu’un gain n’est
pas versé deux fois.

La DualSense est simulée dans quatre orientations de caméra ; le stick droit
est vérifié indépendamment du déplacement. L’entrée, la conduite et la sortie
des nouveaux véhicules sont exécutées dans la simulation. Les profils standard
et Sony HID restent vérifiés par la suite de commandes.

## Inspection visuelle

Les captures 07–17 sont issues du rendu du programme. Les vues 13–17 masquent le
HUD et utilisent une caméra d’inspection pour examiner la ville, le showroom,
la classe et le personnage. Elles ne sont pas des illustrations générées.
Les anciennes captures 01–06 et la vidéo v3 documentent la livraison antérieure.
Les résultats d’essais utilisent des campagnes de test avec des états modifiés.

## Limites

Absence d’essai sur une vraie manette, tablette Android ou GPU de joueur ; absence
de mesure de latence, de test d’endurance, de campagne complète jouée humainement
et de revue pédagogique exhaustive. La présence d’un décor n’implique pas que
chaque objet soit manipulable. Le fichier `BILAN-SUNSHINE.md` distingue les
fonctionnalités livrées des réalisations partielles et des travaux restants.
