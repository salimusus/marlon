# Contrôle indépendant — MARLON V5

**Résultat : 24 parcours réussis sur 24, aucune exception JavaScript.**

Le rapport détaillé est `v5-browser-results.json`. Le contrôle utilise Chromium avec SwiftShader, le rendu logiciel de WebGL. Les touches clavier, les clics et les boutons d’interface sont de vrais événements du navigateur. Une manette DualSense est simulée ; aucune manette physique n’a été connectée. Les placements de départ utilisent le mode de diagnostic `?test=1`.

## Parcours vérifiés

| Domaine | Vérification |
| --- | --- |
| Démarrage | Bouton Jouer, 20 lieux, 34 véhicules et 494 questions disponibles. |
| Commandes | Déplacement ZQSD, arrêt sans dérive, saut, pause et reprise ; sticks indépendants dans quatre orientations. |
| Chute | Retour au sol après une chute de 14 m, sans invincibilité artificielle, perte de santé ni téléportation. |
| Véhicules | Conducteurs matérialisés, entrée par E avec extraction, une étoile, portières ouvertes pendant la transition puis fermées ; sortie vers une zone libre. |
| Conduite | Freinage par S, tangage de suspension, émission de fumée, limitation du nombre de particules. |
| Accident | Collision avec la façade du garage, véhicule détruit, une seule explosion, immobilisation et joueur éjecté vivant. |
| Vie de quartier | 42 personnages supplémentaires, 12 membres de factions, cinq chiens errants ; dialogues, caresse et confiance, banc avec position assise et lever. |
| École | Entrée par E, réponse correcte et récompense de cinq pièces. |
| Son | Activation et coupure par le bouton Son ; contexte Web Audio actif après un geste utilisateur. |
| Conservation | Véritable rechargement avec portefeuille, banque et force restaurés. |
| Interface | Concessionnaire sans débordement horizontal sur un écran de 390 px. |
| Résolution | Tampon de rendu de 3840 × 2160 pour un affichage de 1280 × 720. Ce contrôle vérifie les dimensions, sans imposer une image 4K à SwiftShader. |
| Boucle réelle | Seconde page avec requestAnimationFrame natif, démarrage au bouton et déplacement au clavier. |

## Inspection des images du jeu

Les captures du personnage, du vol de voiture, du banc, du quartier des Docks, de la villa et du concessionnaire ont été ouvertes et inspectées. Les couleurs sont franches et saturées. Le personnage possède désormais un visage lisible et des membres plus épais. Les conducteurs sont visibles dans les cabines.

Un défaut majeur de déformation du torse a été détecté pendant cette inspection : la respiration écrasait l’échelle d’un volume de poitrine et produisait une grande forme blanche verticale. Le spécialiste graphisme l’a corrigé ; la capture `v5-character.png` a été régénérée et le défaut a disparu.

La vue de portrait finale demande 639 appels de dessin et 620 082 triangles. Avant la correction de visibilité par la caméra, la même vue demandait 1 217 appels et 1 498 936 triangles. Ces mesures concernent cette vue, ce réglage et cet environnement ; elles ne décrivent pas toutes les situations du jeu.

## Limites de cette validation

- Le test de son confirme l’activation, la coupure et l’état du contexte audio. Il ne constitue pas une écoute de contrôle sur un équipement audio physique.
- Le parcours avec la boucle d’affichage native fonctionne, mais le navigateur utilise un GPU logiciel partagé. Aucune fréquence d’image sur PC de jeu ou mobile n’est certifiée.
- Les captures montrent un jeu cartoon constitué de modèles procéduraux. Les bâtiments conservent une structure modulaire et les dégâts automobiles reposent sur des déformations animées de pièces.
- Ces parcours ne constituent pas une certification commerciale, un contrôle multijoueur, un audit d’accessibilité complet ou un test d’endurance sur plusieurs heures.
