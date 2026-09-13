# MARLON V5 — point de reprise après interruption

La refonte V5 a été implémentée et testée localement, mais le 13 septembre 2026 l'environnement de travail est devenu hors ligne pendant l'envoi des captures. La publication du code V5 n'a pas été achevée. Cette branche conserve un point de reprise ; elle n'est pas une version jouable V5 publiée.

La branche de jeu `claude/bonjou-igzkfi` reste au commit V4 `a1e93d3b64db5d93631a408333a45d33c4e079b6`. Ne pas annoncer le déploiement V5 sur la base de ce document.

## État réalisé avant interruption

- Six agents spécialisés : modèles/animations, architecture, véhicules, audio/commandes, vie/interactions et contrôle indépendant.
- Palette vive : #00cfc4, #ff2858, #ffcf00, #176bff, #922cff, #ff6b00, #52d919, #f51eff.
- Personnage jeune, débardeur blanc, jean clair, volumes arrondis et épais ; visage, respiration et clignements.
- 18 familles de véhicules remodelées, conducteurs visibles, extraction animée lors du vol, une étoile, portières, freinage/suspension/fumée, dégâts par pièces et explosion rouge/bleu.
- 101 bâtiments, 503 objets, quartiers Art Déco/villas et Docks délabrés ; 42 personnages supplémentaires, 12 membres de bandes, 5 chiens errants, interactions et trois missions.
- Musique et effets Web Audio originaux, caméra/sticks revus, support vertical corrigé pour les chutes et les PNJ.
- Rendu jusqu’à 3840 × 2160, culling par caméra et optimisation de géométrie.

## Vérifications réalisées localement

118 contrôles réussis : core 13, input 7, animation 8, campaign 9, city 9, city-browser 30, lifecycle 2, v5-browser 24, feel-audio 16. Un contrôle de couleur d'explosion supplémentaire a ensuite réussi. Aucun de ces résultats n'est une certification commerciale ou un benchmark sur GPU/manette physique.

L'agent indépendant a détecté un torse déformé par la respiration ; le défaut a été corrigé puis revérifié sur capture. Les essais incluent clavier réel, manette simulée, boucle RAF native, vol/conduite/explosion, chutes de 8, 16 et 40 m, interactions, signal audio, sauvegarde et dimensions UHD.

Les fichiers source et preuves complets restent à récupérer depuis l'environnement reconnecté :
`/workspace/scratch/6a513a53bc11/MARLON-Empire-Urbain`.

## Empreintes Git des principaux fichiers testés

Ces SHA sont des empreintes de blobs calculées localement, pas une affirmation que les blobs sont déjà présents sur GitHub.

| Fichier | SHA attendu |
|---|---|
| src/city-models.js | 375a64c1c21dd77b93deecf50e4f06124106d558 |
| src/animation.js | 5f03a697c0f74f986fafe35d1f30e4f7e2752667 |
| src/city-world.js | 968a17dda1ecc171249175d7812cb8e106fe6de8 |
| src/vehicles-v5.js | 9c68b995d40a6b314e28eadd0c768ecfe97c0ae2 |
| src/life-v5.js | 53bbba19d971bda12c7d38260d6e57172ff6aa7e |
| src/audio-v5.js | d4f60c380a4dacba4a95e72642a8e4bb299657a7 |
| src/feel-v5.js | 6ef9bc18a737d1261227c2870c340a0c7dfbe8ba |
| src/render-v5.js | c33dc33ada6afa08bf83dfae659d415bbf2b9e8b |
| src/city-data.js | 9dcdd0e52c82fa17609a71c8adc5043a6451af71 |
| src/city-sim.js | 3d219e5225de39332b44bbafd764ab90cabd1840 |
| src/main.js | e803a370b1deb6ca953e22fc1862b3583331437c |
| src/studio.js | e68efb6f0c3096aef23400173b8d6f11068f6cc1 |
| src/world.js | fc7d0cb9d848eb2dd54d537f395157081d79ff34 |
| index.html | 5dcdeacf97065ff9da5ef68e7cd2a8130a708e5c |
| city.css | faf5613acfd98d519c6c59ef66f43b289793c8db |
| studio.html | 07f5228e5f3db0c5b74585b458c607121889fbdb |
| tests/v5-browser.cjs | 083c21a148064c84fca1c9e59e9c7a0fbc7ad4d6 |
| tests/feel-audio.cjs | 374fca0578f4c21f1e5f24d9ebe6b1518d55f66e |

## Reprise

1. Rétablir l'environnement et vérifier ces fichiers avant toute reconstruction.
2. Relire VERIFICATION.md et verification/v5-review.md locaux ; récupérer les captures et rapports.
3. Reprendre le transfert des fichiers modifiés sur une base de l'arbre V4 6b6ac93915868a9329b2144c9afd276e7084483d, en préservant les fichiers historiques distants.
4. Vérifier les SHA du nouvel arbre, créer le commit V5 puis avancer la branche de jeu sans force.
5. Attendre le succès GitHub Pages et fournir le lien de la version effectivement déployée.

La capture jointe est l'un des fichiers transférés avant l'interruption. Elle ne remplace pas les sources manquantes.
