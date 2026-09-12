# MARLON — Empire urbain · Refonte 03

**Nouvelle base jouable, réécrite à partir du principe de conquête de territoires.**
Le code du précédent jeu a été remplacé ; seul le moteur Three.js r128 et sa
licence sont réutilisés. Les anciens modes SuperObby ne sont plus présents.

**Statut : version de développement.** Cette livraison ne constitue pas un jeu
AAA, une reproduction de GTA, ni une version validée pour commercialisation.
Les modèles et textures sont procéduraux. La différence visuelle peut être
évaluée dans les captures réelles du dossier `verification/` et directement en jeu.

## Lancer le jeu

1. Extraire **toute** l’archive.
2. Ouvrir `index.html` dans Chrome, Edge ou Firefox avec l’accélération graphique.
3. Cliquer sur **Entrer dans la ville**.
4. À proximité de la planque : **B** pour recruter un équipier (200 €).
5. Approcher la Vesper GT bleue et appuyer sur **E** pour entrer.
6. **M** ouvre la carte. Choisir un quartier voisin et placer un repère.

Tous les fichiers du jeu sont locaux. Aucun CDN, police distante, modèle distant
ou service multijoueur n’est nécessaire. Une ouverture directe du fichier HTML
ne nécessite pas de compilation. Si le navigateur restreint les commandes ou la
sauvegarde en fichier local, lancer le serveur fourni :

```sh
python3 serve.py
```

Sous Windows, `py serve.py` convient également. Ouvrir ensuite
`http://localhost:8080`. Garder la même adresse pour retrouver la progression.

## Nouveautés de la version 3

- Animation avec transitions progressives entre repos, marche, course et visée.
  Les jambes disposent d’une résolution à deux articulations, avec flexion des
  genoux et orientation des pieds. Le haut du corps peut viser ou recharger
  pendant le déplacement ; le cycle des jambes reste continu.
- Respiration, inclinaison du buste, recul, manipulation du chargeur, alternance
  des coups, saut, amortissement de réception, chute et geste de secours.
  Les dégâts de mêlée sont appliqués au contact prévu dans le geste, une seule
  fois par coup. Un troisième coup réussi inflige davantage de dégâts.
- Entrée et sortie de voiture sur 1,45 seconde avec portière articulée, transition
  vers le siège, conducteur visible et volant animé. La conduite attend la fin
  de l’entrée ; la pause suspend la transition.
- Équipiers vulnérables : santé individuelle affichée, mise à terre, 60 secondes
  pour intervenir et réanimation de 2,6 secondes. Une blessure du joueur
  interrompt son geste de secours. Le ravitaillement soigne aussi l’équipe.
- Recherche de chemin autour des bâtiments et séparation locale des acteurs.
  Les équipiers sont replacés dans un emplacement libre à la sortie de voiture.
- Sauvegarde étendue, copie précédente de secours, migration de la refonte 02
  et export/import d’un fichier de campagne depuis Pause.
- Réglage pour réduire les secousses de caméra.

### Examiner les animations

Ouvrir `studio.html` ou **Pause → Studio des animations**. Dix séquences sont
sélectionnables, avec pause, reprise, vitesse de 0,25× à 1,5× et rotation de la
vue par glissement. Le studio utilise le même personnage et le même moteur
d’animation que le jeu, avec déplacement sur place pour faciliter l’inspection.

`verification/MARLON-animations-v3.mp4` montre huit secondes du rendu réel du
studio : marche, course, visée en déplacement, rechargement, coups et saut.
La vidéo est un échantillon de poses, pas une mesure de performance du jeu.

## Ce qui a été reconstruit

- Ville de douze quartiers sur une grille d’environ 600 × 600 unités, avec
  253 constructions principales, vitrines, corniches, toitures techniques,
  escaliers de secours extérieurs, passages piétons, mobilier, arbres,
  quais, voies ferrées, conteneurs et grues.
- Éclairage directionnel avec ombres, ciel dégradé, brouillard de distance,
  façades texturées, reflets automobiles et réglage de résolution.
- 34 véhicules : coupés, berlines, SUV et utilitaires. Carrosseries construites
  par sections, habitacles vitrés, montants, rétroviseurs, roues et jantes,
  éclairage avant/arrière, suspension visuelle et direction des roues avant.
  Six véhicules suivent des trajets de circulation simples.
- Personnages aux proportions humaines, articulations animées pour la marche,
  la course, le saut, la visée et le corps à corps.
- Contrôleur de déplacement indépendant de la caméra. Le stick gauche ne
  génère jamais de fausses touches clavier. Le stick droit ne fait pas marcher.
- Caméra à la troisième personne avec orbite libre, visée à l’épaule, recentrage
  explicite et rétraction devant les obstacles. Le suivi automatique de la
  direction est réservé au véhicule, après une temporisation de caméra libre.
- Conduite analogique, accélération, freinage puis marche arrière, frein à main,
  collisions, dégâts et sortie uniquement à faible vitesse avec recherche d’un
  emplacement libre.
- Combat avec chargeur, réserve, rechargement, cadence, recul visuel, tracés de
  tirs, dégâts, mêlée, riposte ennemie et soutien des équipiers. Les tirs testent
  l’obstacle entre le canon et le point visé, en plus du rayon de caméra.
- Carte stratégique, conquêtes adjacentes, revenus, fortifications,
  contre-attaques annoncées et cinq opérations.
- Interface revue, menus utilisables à la manette, réglages de sensibilité,
  zone morte, inversion verticale, profil manette, son et commandes tactiles.

## Les commandes

| Action | Clavier / souris | DualSense |
|---|---|---|
| Déplacement / direction | ZQSD ou WASD | Stick gauche |
| Caméra | Souris après clic dans la scène | Stick droit |
| Courir | Maj maintenue | L3 maintenu |
| Recentrer la caméra | C | R3 |
| Entrer / sortir d’un véhicule | E | Triangle |
| Sortir / ranger l’arme | G | Croix |
| Sauter | Espace | Rond |
| Corps à corps | F | Carré |
| Viser | Clic droit maintenu | L2 maintenue |
| Tirer | Clic gauche ou X | R2 |
| Recharger | R | Gauche de la croix directionnelle |
| Accélérer | Z ou W | R2 |
| Freiner puis reculer | S | L2 |
| Frein à main | Espace | R1 |
| Recruter à la planque / relever un équipier proche | B | Haut de la croix directionnelle |
| Soins, munitions, réparation à la planque | H | Bas de la croix directionnelle |
| Carte | M | Pavé tactile |
| Opérations | J | Create |
| Pause / fermer | Échap | Options |

Dans les menus : stick gauche ou croix directionnelle pour parcourir les boutons,
Croix ou Triangle pour activer, Rond pour revenir. La carte propose également
une sélection horizontale avec le stick gauche. Les réglages restent accessibles
au clavier et à la souris. La touche Échap du navigateur peut d’abord libérer la
souris avant de reprendre les commandes normales du menu.

Brancher ou appairer la DualSense puis appuyer sur un bouton dans la page active.
Le profil automatique donne priorité à la correspondance standard du navigateur.
Le profil Sony HID brut lit la caméra sur les axes 2/5 et les gâchettes sur 3/4.
Le diagnostic affiche les valeurs effectivement reçues. Une déconnexion met le
jeu en pause lorsqu’on utilisait la manette. Une perte de focus remet les entrées
à zéro. La zone morte par défaut est radiale, à 17 %.

**Les essais manette de cette livraison sont simulés.** Aucun essai USB ou
Bluetooth sur une DualSense physique n’a été effectué. Les vibrations simples
sont facultatives selon le navigateur ; les gâchettes adaptatives sont absentes.

## Conquérir et gagner

Le joueur commence avec les Forges, 900 €, un chargeur de 24 et 120 munitions de
réserve. Une recrue coûte 200 €, pour une équipe maximale de trois.

La conquête exige un quartier qui touche un quartier contrôlé, l’absence de
défenseurs à proximité du point, un équipier présent et le joueur à pied au sol.
Maintenir la présence pendant 18 secondes donne le quartier, 350 € et 60 points
de réputation. Une absence interrompt la progression sans effacer les secondes
déjà acquises. Les frontières diagonales ne comptent pas.

Chaque quartier rapporte 75 € toutes les deux minutes de simulation. Trois
niveaux de fortification coûtent 120, 240 puis 360 €. Une contre-attaque est
annoncée 45 secondes avant l’arrivée des assaillants. Le joueur dispose ensuite
de 70 secondes pour les éliminer. À défaut, une fortification absorbe l’attaque
en consommant un niveau ; sans fortification, le quartier est perdu. La planque
des Forges est protégée des contre-attaques.

Contrôler les douze quartiers pendant 90 secondes remporte la campagne. Il reste
possible de jouer après la victoire. La mise à terre ramène à la planque, soigne
le joueur et coûte au maximum 180 €. Le ravitaillement à la planque coûte 60 €
si des soins, des munitions ou une réparation sont nécessaires.

Les cinq opérations sont la reconnaissance, la livraison en véhicule, la
conquête, la patrouille et la défense. Une seule peut être active. La première
réussite rapporte la récompense complète ; une répétition rapporte 40 %.
L’abandon ou l’expiration ne donnent aucune récompense.

## Sauvegarde et compatibilité

Sauvegarde automatique toutes les quinze secondes de jeu, après les événements
de progression et en quittant la page ; sauvegarde manuelle dans Pause.
Sont conservés : argent, réputation, santé, munitions, position, territoires,
fortifications, équipiers avec santé et délai de secours, opérations réussies,
victoire, mission et attaque en cours, captures partielles, véhicules avec santé
et position, ennemis neutralisés et délais économiques.

Au chargement, les véhicules sont remis à l’arrêt pour éviter un départ sans
commande. Les gestes transitoires (entrée, sortie, secours, chute du joueur)
ne sont pas sauvegardés : une fermeture pendant ces gestes reprend la dernière
sauvegarde achevée. Les projectiles, effets, chemins calculés et poses ne sont
pas persistés. Les menus suspendent la simulation.

La clé `marlon.rebuild.save.v3` contient un état validé et une somme de contrôle
qui détecte les altérations accidentelles. Ce n’est pas une protection contre
la modification volontaire. La clé `.backup` conserve la sauvegarde valide
précédente ; elle est utilisée automatiquement si la principale est illisible.
Un refus de stockage conserve l’ancienne sauvegarde et affiche un message.

Une sauvegarde de la refonte 02 est migrée lors de la reprise ; les éléments
qu’elle ne conservait pas reprennent leurs valeurs initiales. Les sauvegardes
du jeu antérieur à la refonte 02 ne sont pas importées. **Nouvelle campagne**
efface les sauvegardes des refontes 02/03, après confirmation. Les réglages
restent séparés.

**Pause → Exporter la campagne** télécharge un fichier JSON transportable.
**Importer une campagne** valide le fichier avant de demander le remplacement
et de recharger la partie. Conserver des exports personnels : une suppression
des données du navigateur peut effacer la sauvegarde et sa copie de secours.

## Rendu et performance

Performance désactive les ombres et réduit la résolution ; Équilibré emploie
des ombres 1024 ; Élevé et Ultra HD emploient des ombres 2048. Ultra HD peut
dessiner jusqu’à 3840 pixels de large, selon la fenêtre et l’écran. Cela ne
transforme pas les textures procédurales en photographies 4K.

Les éléments fixes sont regroupés par géométrie et matière avec instanciation.
Les véhicules détaillés et personnages lointains sont masqués. Les collisions
utilisent une grille spatiale et des sous-pas pour éviter de franchir un mur
à grande vitesse. La simulation utilise un pas fixe de 1/60 seconde.

## Structure et vérification

```text
index.html             Interface et chargement local
style.css              Présentation, HUD, menus et adaptations d’écran
src/core.js            Mathématiques, collisions, conduite, territoires, sauvegarde
src/input.js           Commandes clavier, souris, manette et remise à zéro
src/world.js           Ville, textures, végétation et obstacles
src/models.js          Personnages et véhicules
src/animation.js       Transitions, articulations et événements des gestes
src/navigation.js      Recherche de chemin et visibilité
src/persistence.js     Validation, copie de secours et migration
src/gameplay-v3.js     Intégration des nouvelles mécaniques
src/game.js            Simulation, combat, équipe, économie, missions, caméra
src/ui.js              Carte, menus, réglages, diagnostic et tactile
src/ui-v3.js           Santé de l’équipe, export/import et réglage caméra
studio.html            Visionneuse interactive des animations
src/studio.js          Scène et séquences du studio
src/main.js            Rendu, éclairage, démarrage et boucle d’animation
vendor/                Three.js r128 et licence MIT
tests/                 Tests reproductibles
verification/          Résultats et captures réelles du navigateur
```

Tests sans navigateur :

```sh
node tests/core.cjs
node tests/input.cjs
node tests/animation.cjs
node tests/campaign.cjs
```

Tests navigateur avec Node.js et Playwright :

```sh
npm install --save-dev playwright
npx playwright install chromium
node tests/browser.cjs
node tests/lifecycle.cjs
```

`CHROMIUM_PATH` permet d’utiliser un Chromium déjà installé. Les scénarios de
simulation avancent une horloge contrôlée afin que leurs résultats ne dépendent
pas de la vitesse du GPU. Ce ne sont pas des mesures de fréquence d’images.
`?test=1` active les outils de diagnostic utilisés par les tests.

## État de la préparation commerciale

Les fondations jouables et les essais automatisés sont livrés. Restent notamment
à produire ou valider :

- Des modèles humains et animations de production, des bâtiments et véhicules
  offrant davantage de variété et un travail artistique validé en jeu. Les
  animations procédurales de cette version ne remplacent pas une bibliothèque
  d’animations finalisées : prises de main, contacts au sol, transitions vers
  les sièges et intersections entre vêtements demandent encore du travail.
- Une IA avec navigation robuste à grande distance, trafic urbain complet,
  évitement entre tous les acteurs et comportements de combat plus avancés.
- L’équilibrage d’une campagne complète, sa durée, sa difficulté et les retours
  de joueurs, dont le coût et la difficulté du secours aux équipiers.
- Des effets et sons de production. Les sons présents sont synthétisés.
- Les tests sur une vraie DualSense en USB et Bluetooth, plusieurs GPU,
  Windows, Android et écrans cibles ; la définition des configurations minimales.
- Les essais de longue durée, de restauration, d’accessibilité et de livraison
  propres à la plateforme de vente choisie.

Les bâtiments sont principalement extérieurs ; cette version n’intègre pas
d’intérieurs visitables, de multijoueur, de campagne narrative doublée, d’APK
ou d’installateur Windows. Les commandes tactiles existent mais n’ont pas été
validées sur tablette physique.

Le site existant n’a pas été publié ou remplacé. Pour une publication statique,
déployer `index.html`, `studio.html`, `style.css`, `src/` et `vendor/` ensemble. Les outils de
test et le serveur Python ne sont pas nécessaires à l’exécution du jeu.

Références techniques : [Gamepad API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API),
[Three.js r128 — sources](https://github.com/mrdoob/three.js/tree/r128).
La licence Three.js est incluse dans `vendor/THREE-LICENSE.txt`.
