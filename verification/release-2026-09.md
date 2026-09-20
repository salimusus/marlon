# Vérification — MARLON Empire urbain, 20 septembre 2026

Périmètre : jeu de la page principale `index.html`, pas la réécriture Sunshine.

## Régressions automatisées

| Suite | Cas réussis | Portée |
|---|---:|---|
| `harness/empire.js` | 15 | Territoires, frontières, capture, défense, récompenses, sauvegarde, commandes |
| `harness/strategy.js` | 7 | Réseau connecté, revenus, remise industrielle, GPS, missions concurrentes |
| `harness/controls-tv.js` | 16 | Contrôleur, neutralisation, joystick, paquets, reconnexion, liaison TV |
| `harness/visual.js` | 9 | Matériaux, ombres, animations à trois fréquences, nettoyage GPU |
| `harness/traffic.js` | 14 | Implantation, itinéraires, gabarits, freinage, virages et simulation de circulation |
| `harness/save-strategy.js` | 4 | Données malformées, conversion numérique, restauration des recrues |
| `harness/cinematic.js` | 6 | Clavier, focus, manette, visibilité, erreurs média et fermeture |
| `harness/cosmetic-performance.js` | 1 | Accessoires invisibles et réactivation des matrices avec Three.js réel |
| **Total** | **72** | Contrôles ciblés, pas couverture exhaustive du jeu |

Syntaxe JavaScript du jeu et de la cinématique vérifiée. La suite utilise le code du jeu dans une VM avec des substituts DOM/Three.js, ou des fonctions extraites de ce code. Le test cinéma utilise les vrais objets de scène Three.js avec canvas/médias simulés. Ces suites ne mesurent pas les FPS d’un GPU physique.

Les cinq échecs initiaux du vieux test empire concernaient l’extension abandonnée de douze territoires. Les assertions ont été actualisées pour la carte réelle à huit secteurs ; elles vérifient toujours frontières, sol, points de mission et validation des données.

## Contrôle dans le navigateur

- Démarrage réel depuis l’accueil, entrée dans la ville et reprise de sauvegarde.
- Ouverture de la carte, huit secteurs affichés, renseignements économiques et lancement de reconnaissance.
- Carte à 390 × 844 : aucun débordement horizontal du document ou de la carte mesuré.
- Suivi d’opération : boîte séparée de la minicarte, intersection des rectangles = fausse.
- Menu TV : code généré, état « prêt », disponibilité de présentation et absence de manette affichées. Aucun téléviseur ni contrôleur physique connecté.
- Cinématique : lecture, export réel, retour à l’accueil, puis démarrage du jeu ; aucune exception JavaScript capturée dans ces parcours.
- Vidéo exportée et transcodée : H.264 / AAC, 1920 × 1080, 30 images/s, environ 32 secondes. Lisibilité contrôlée sur les images ; piste audio présente et normalisée.

## Limites observées et validation restante

La mesure d’affichage du navigateur intégré a indiqué 15 images/s pendant un premier parcours, puis 18 images/s au dernier contrôle avec un seul jeu ouvert, avec réduction adaptative à 640 × 360. Ces conditions ne sont pas comparables : aucun gain de FPS global n’est revendiqué. Ce résultat n’est ni un benchmark matériel documenté ni une garantie de fluidité ; le jeu ne doit pas être annoncé comme stable à 60 FPS sur tout appareil. L’optimisation des accessoires supprime de façon vérifiée le recalcul de 89 nœuds cachés sur un avatar standard de 334 nœuds sans retirer de détail visible.

Les régressions de circulation couvrent une minute simulée, huit véhicules, une géométrie de ville et un scénario déterministes. Elles ne couvrent pas toutes les poursuites, interventions, collisions et combinaisons de véhicules.

La vérification finale du trafic donne 169–326 m parcourus, **zéro relevé hors chaussée, zéro téléportation et zéro état non fini pour les huit véhicules** ; les deux camions parcourent 257 et 283 m. Le raccourcissement de l’anticipation en courbe élimine les coins coupés qui étaient encore présents dans la première passe. `release-traffic-final.txt` contient ce dernier résultat et remplace les métriques de trafic intermédiaires de `release-tests.txt`.

Les sauvegardes ne sont pas transférées entre PC et TV par le lien de présentation. La diffusion à distance dépend du navigateur, du service de signalisation et du réseau. Un essai à deux appareils reste requis.

Avant commercialisation : campagne complète et endurance, essais sur la liste de machines et navigateurs cibles, contrôleurs USB/Bluetooth, TV et réseau réel, et vérification des droits des habillages et autres contenus hérités. Aucun engagement « tous les bugs corrigés » ni certification commerciale.
