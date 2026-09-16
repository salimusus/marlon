> **Deux jeux cohabitent sur cette branche.** `index.html` est SuperObby / MARLON (le jeu suivi par le banc d'essai `harness/`, 370 tests). `sunshine.html` est « MARLON — Sunshine City 05 » (réécriture séparée, code dans `src/`, tests dans `tests/`). Le reste de ce fichier décrit Sunshine City.

# MARLON — Sunshine City · 05

Refonte cartoon aux **couleurs vives**, personnages épais et arrondis, véhicules
remodelés et quartiers enrichis. Jeu solo navigateur, avec commerces, missions,
animaux, bandes, conduite et personnalisation. **Version de développement jouable**.
Le bilan détaillé, y compris les demandes encore partielles, figure dans
[BILAN-SUNSHINE.md](BILAN-SUNSHINE.md).

## Jouer

Ouvrir le [jeu publié](https://salimusus.github.io/marlon/). Pour une utilisation
locale, extraire tous les fichiers et ouvrir `index.html`, ou exécuter :

```sh
python3 serve.py
```

Puis ouvrir `http://localhost:8080`. Le jeu n’utilise aucun CDN ou modèle distant.
Garder la même adresse et le même navigateur pour retrouver la sauvegarde.

**Commencer par M / pavé tactile → Lieux, commerces et activités.** Choisir un
lieu place une destination et un trajet jaune sur la minicarte. Entrer par
l’ouverture centrale du bâtiment, approcher le comptoir et appuyer sur **E /
Triangle**. Les achats exigent la monnaie gagnée dans le jeu. Aucun argent réel
ne peut être acheté ou misé.

## Nouveautés 05

- Direction artistique saturée : turquoise, jaune soleil, bleu électrique, corail,
  orange et violet. Façades Art Déco, coins arrondis, villas, végétation groupée,
  enseignes et quartier des Docks avec tags, carcasses et mobilier usé.
- Personnage aux proportions plus épaisses, visage expressif, mains et baskets
  arrondies ; transitions adoucies, respiration et clignements corrigés.
- Voitures remodelées, sièges et conducteurs visibles. E / Triangle près d'une
  voiture occupée et ralentie déclenche l'extraction animée du conducteur et
  une étoile. Les portières se referment en fin d'entrée ou de sortie.
- Tangage de suspension, fumée blanche au freinage, dégâts par pièces : capot,
  phares, vitres et pare-chocs. À zéro santé, explosion cartoon rouge/bleu,
  immobilisation de l'épave et sortie protégée du joueur.
- 42 personnages supplémentaires, dont 12 membres de bandes, et 5 chiens errants.
  Nora, aux Docks (nord-ouest), propose trois missions : nettoyage, colis et
  sauvetage d'un chien. Les missions rapportent respectivement 120, 150 et
  90 pièces une seule fois ; progression conservée au rechargement.
- S'asseoir, discuter, danser, téléphoner, caresser puis adopter un chien,
  utiliser un distributeur et recycler. Les objets utilisables affichent une
  indication à proximité ; les racines de mobilier restent réparables.
- Musique originale synthétisée, pas alternés, moteur selon régime, pluie,
  freinage, choc et explosion. Bouton Son dans le HUD ; volumes et musique dans
  Réglages. L'audio démarre après une interaction et se suspend dans les menus.
- Support vertical corrigé : chutes depuis les toits, réceptions sur les dalles,
  passage au-dessus des voitures et pieds des PNJ sur les trottoirs. Caméra
  progressive, précision du stick droit et sensation de vitesse réglable.
- Rendu Ultra HD jusqu'à **3840 × 2160**, y compris par suréchantillonnage d'un
  écran plus petit. Ombres de contact, matériaux et éclairage revus, décor
  instancié et visibilité limitée au champ de caméra. Ce réglage demande plus
  de ressources ; il ne constitue pas une garantie de fréquence d'images.

## Contenu conservé et enrichi

- Un personnage jeune adulte avec jean bleu clair, débardeur blanc, baskets,
  visage expressif, bras découverts et animations articulées enrichies.
- Une ville d’environ 600 × 600 unités : cent bâtiments, vingt lieux identifiés,
  architecture aux couleurs vives, palmiers, plantations, parcs et enseignes. Les bâtiments
  construits avec étages disposent d’escaliers, de paliers et d’un ascenseur.
  Les intérieurs utilisent une structure modulaire commune.
- 134 habitants, agents, employés et personnages de quartier : 92 de la ville
  initiale et 42 nouveaux. Adversaires, équipiers et conducteurs s’y ajoutent.
  Les personnages proches sont animés et les plus éloignés sont masqués.
- 34 véhicules dans la simulation, 18 familles de modèles dont 14 achetables :
  compacte, berline, break, 4×4, sport, supercar, cabriolet, pick-up, utilitaire,
  classique, buggy, limousine, vélo et moto. Patrouilles et services complètent
  le parc. Les formes, empattements, hauteurs et performances varient.
- Un showroom jaune vitré, quatre véhicules d’exposition et livraison sur le
  parking après achat. Huit peintures de base, prix, puissance et vitesse
  distincts. Les places occupées empêchent une livraison qui ferait apparaître
  deux voitures au même endroit.
- Garage : réparation, moteur, turbo, jupes, becquet, vitres teintées, roues,
  suspension basse, jantes, peinture métallisée ou fluo, double échappement et
  moteur apparent. Les modifications sont visibles ; moteur et turbo augmentent
  accélération et vitesse. Une pièce installée ne peut être facturée deux fois.
- Boutique : douze articles de vêtements et accessoires, achat puis équipement
  gratuit. Coiffeur : cinq coupes. Tatoueur : trois choix de motif. Armurerie :
  quatre profils d’armes avec dégâts et cadence distincts, achat de munitions.
- Pizzeria et hôpital avec achats de soins. Salle de sport et stand de tir avec
  séances animées, progression de force/précision et évolution visuelle des bras.
- École : classe, tables, chaises, tableau gris, cour, marelle, préau et terrain
  de basket. 494 questions : **264 maths, 110 logique, 80 géographie, 40 biologie**.
  Les maths et suites logiques sont générées à partir de paramètres ; les autres
  questions reposent sur une liste de faits. Récompense de 5 pièces par question
  réussie inédite, protégée contre les doubles clics. La question, les choix et
  la réponse sont également dessinés sur le tableau 3D.
- Banque : dépôts et retraits, trois coffres fictifs à ouvrir pendant un braquage
  de 18 secondes. Un coffre toutes les six secondes, gains 750, 1 500 et 2 250
  pièces, alerte trois étoiles. E / Triangle interrompt le braquage.
- Police : patrouilles, gyrophares rouge/bleu, niveaux d’alerte de 1 à 3, poursuite
  locale et amendes. Déclaration contre les gangs simulés au commissariat.
- Circulation automatique, y compris vélo/moto, arrêt devant un feu rouge et
  obstacle proche. Feux à phases vert/orange/rouge, avec intervalles où tous les
  axes sont rouges. Panneaux STOP et cédez-le-passage visibles.
- Collisions : perte de santé, déformation visuelle de carrosserie et pare-chocs,
  bris visuels de vitres et phares, explosion à zéro santé, marques au sol. Bancs, poubelles et
  lampadaires dédiés peuvent être renversés. Un agent technique peut les réparer.
- Accident : constat de 80 pièces, dépanneuse, rapprochement, câble de treuil,
  montée sur plateau et transport au garage. Sortir du véhicule pour permettre
  le chargement. La réparation reste à demander au comptoir.
- Chiens et chats adoptables, nommables, avec suivi, assis, couché et patte.
  Trois compagnons maximum. Approcher un compagnon puis E pour ses commandes.
- Recrutement d’habitants dans la rue, nom du gang et ordres à trois équipiers :
  suivre, protéger, récupérer une voiture, braquer, rapporter des munitions,
  aller à l’hôpital, au sport ou au stand de tir.
- Villa avec intérieur, piscine décorative, jardin, portail automatique et
  trampoline qui fait rebondir le joueur. Grande roue avec tour de cabine.
- Hélicoptère pilotable, montée/descente et pose sur les toits.
- Bureau des missions : colis, circuit automobile, vol panoramique et promenade
  d’un compagnon, avec étapes, délai, récompense et guidage sur la minicarte.
  Les cinq opérations territoriales de la base restent disponibles avec J.
- Casino : roulette animée, rouleaux de machine à sous, poker fermé avec cartes
  à conserver, dames et échecs contre un bot. Monnaie fictive, mise de 20 pièces.
- Cycle jour/nuit de dix-huit minutes de simulation. Soleil, pluie et neige
  sélectionnables dans Pause ; particules et éclairage adaptés.

## Commandes

| Action | Clavier/souris | DualSense |
|---|---|---|
| Marcher / direction | ZQSD ou WASD | Stick gauche |
| Caméra | Souris après clic dans la scène | Stick droit |
| Courir | Maj | L3 maintenu |
| Interagir / entrer / sortir | E | Triangle |
| Carte et annuaire des lieux | M | Pavé tactile |
| Opérations territoriales | J | Create |
| Pause, météo et gang | Échap | Options |
| Sauter | Espace | Rond |
| Arme | G | Croix |
| Viser / tirer | Clic droit / clic gauche | L2 / R2 |
| Recharger | R | Gauche de la croix |
| Corps à corps | F | Carré |
| Recruter à la planque / relever un équipier | B | Haut de la croix |
| Ravitaillement à la planque | H | Bas de la croix |
| Recentrer caméra | C | R3 |
| Accélérer / freiner-reculer | W ou Z / S | R2 / L2 |
| Frein à main | Espace | R1 |
| Hélicoptère : monter / descendre | Espace / Maj | R2 / L2 |

Menus : stick gauche ou croix, puis Croix/Triangle pour valider. Les tableaux de
casino et la sélection des cartes de poker utilisent actuellement la souris ou
le tactile. Les réglages de zone morte, sensibilité, inversion et réduction des
secousses sont conservés. **Les essais DualSense sont simulés**, pas réalisés
sur une manette USB/Bluetooth physique.

## Sauvegarde

Le format de campagne validé de la refonte 03 reste le conteneur. Le champ `city`
contient la progression Sunshine : compte bancaire, tenue, achats, coupe,
tatouage, collection et pièces automobiles, animaux, performances, mission,
questions déjà récompensées, météo, heure et alertes. Les sauvegardes des refontes
02/03 sont reprises avec des valeurs initiales pour les nouveautés.

Sauvegarde automatique, copie précédente de secours et export/import dans Pause.
Les voitures détenues gardent leur position ; la circulation est replacée sur
ses circuits au chargement. La vitesse repart de zéro. Les gestes en cours,
parties de casino, dégâts de mobilier, interventions de dépannage et ordres
transitoires des équipiers ne sont pas repris après fermeture. Une activité
payée puis interrompue par la fermeture peut donc nécessiter un nouvel achat.
Les données du navigateur restent locales ; exporter régulièrement la campagne.

## Casino

Roulette à 37 cases : rouge/noir rapporte 40 pièces pour une mise de 20 ; le zéro
fait perdre. Machine à sous : trois symboles identiques rendent 160, une paire
25, sinon 0. Poker : une paire rend la mise, puis multiplicateurs 2, 3, 4, 6, 8,
20 et 50 suivant la combinaison. Les gains indiqués incluent la mise rendue.

Dames : damier 8 × 8, prises obligatoires, prises multiples et promotion.
Échecs : déplacements légaux, protection du roi, mat/pat et promotion automatique
en dame ; **variante sans roque ni prise en passant**. Les parties de plateau
sont déclarées nulles après 160 demi-coups. Une victoire rend 40 pièces, une
partie nulle 20. Quitter une partie engagée perd la mise. Ces jeux n’implémentent
pas de multijoueur ni de règles de tournoi complètes.

## Développement et vérification

```sh
node tests/core.cjs
node tests/input.cjs
node tests/animation.cjs
node tests/campaign.cjs
node tests/city.cjs
# Avec Playwright et Chromium installés :
node tests/browser.cjs
node tests/lifecycle.cjs
node tests/v5-browser.cjs
node tests/feel-audio.cjs
```

`tests/browser.cjs` lance désormais `city-browser.cjs`. `CHROMIUM_PATH` accepte
un Chromium déjà installé. Les captures et résultats sont dans `verification/`.
Les anciennes captures 01–06 et la vidéo v3 documentent la livraison précédente ;
les captures 13–18 concernent la version 04 ; les vues 07–12 sont produites par
les régressions du code actuel. Les vues 20–25 et `v5-*`
montrent cette version, parfois avec une caméra d’inspection et sans HUD.

Les nouveaux modules sont `city-data.js`, `city-models.js`, `city-world.js`,
`city-sim.js`, `city-ui.js` et `board-games.js`. Ils étendent la base version 3.
La version 05 ajoute `vehicles-v5.js`, `life-v5.js`, `audio-v5.js`,
`feel-v5.js` et `render-v5.js`. Cette organisation facilite l’itération, mais un regroupement des contrôleurs
et une rationalisation des couches de compatibilité restent souhaitables avant
une maintenance à grande échelle.

## Recherche et ressources

Les sources suivantes ont été examinées pour orienter les modèles, les animations
et les coûts de rendu : [Kenney Car Kit](https://kenney.nl/assets/car-kit),
[Quaternius Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html),
[instanciation Three.js](https://threejs.org/docs/pages/InstancedMesh.html) et
[gestion des ombres](https://threejs.org/docs/pages/LightShadow.html).
Kenney et Quaternius proposent les ressources citées sous CC0 ; **leurs modèles
ne sont pas incorporés dans cette livraison**. Les modèles présents sont créés
par le code du projet. Le moteur embarqué reste Three.js r128, avec sa licence
MIT dans `vendor/THREE-LICENSE.txt`. Les documentations récentes ont servi de
référence conceptuelle, sans mise à niveau implicite du moteur.


Pour la version 05, la cohérence des formes et des décors suit les principes de
[construction d’assets et kits modulaires de Roblox](https://create.roblox.com/docs/tutorials/curriculums/environmental-art/develop-polished-assets).
Le jeu utilise ses propres modèles et son identité ; aucun modèle ou personnage
GTA, Roblox, Mario ou Fortnite n'est extrait ou intégré. La suspension audio et
le lissage des paramètres utilisent les recommandations
[Web Audio de MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices).
