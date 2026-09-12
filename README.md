# MARLON — Empire urbain

Refonte du jeu SuperObby du dépôt `salimusus/marlon`, à partir du commit
`5eac31d304f8eb44258f57adeaf1bdcf52ab6ac5`.

## Jouer

1. Extraire **tout** le ZIP.
2. Ouvrir `index.html` dans Chrome, Edge ou Firefox.
3. Cliquer sur **Entrer dans Marlon**.
4. Ouvrir la carte avec **M** ou le **pavé tactile PS5**.

Le moteur Three.js est livré dans `vendor/three.min.js` : conserver ce dossier à
côté de `index.html`. Le jeu solo ne dépend plus du chargement de Three.js depuis
un CDN. Les polices et le multijoueur PeerJS restent des services externes ; une
police système est utilisée si Google Fonts est inaccessible. Les anciens parcours
restent disponibles depuis le menu des mondes.

## Ce qui change

- **365 000 unités carrées** de terrain contre 231 000 (+58 %), avec des limites
  et une grille de navigation agrandies ensemble.
- **12 secteurs** : les huit secteurs existants et les Hauts, le quartier des
  affaires, le terminal logistique et les Docks Nord.
- Un réseau de voies vers le nord, **16 nouveaux bâtiments**, des halls,
  des toits accessibles, des installations techniques, un terminal à conteneurs
  et des grues. Quatre voitures supplémentaires et un camion.
- Carte stratégique interactive, objectifs balisés et HUD de progression.
- Conquête par **secteurs voisins** : le premier point d'appui se prend dans la
  ville d'origine, puis les liens de la carte déterminent les frontières accessibles.
- Défenses achetables à trois niveaux : 80, 160 puis 240 pièces. Elles s'ajoutent
  aux recrues présentes. Les attaques contre le joueur sont annoncées 60 secondes
  à l'avance. Une défense réussie consomme un niveau de fortification.
- Cinq opérations : reconnaissance, transport routier, conquête, patrouille et
  défense. Récompense pleine à la première réussite, 40 % aux répétitions. Une
  seule opération à la fois ; abandon et expiration ne donnent aucune récompense.
- Façades redessinées en 512 × 512, vitres, peinture automobile avec reflets
  procéduraux, traitement de couleur ACES, végétation arrondie, palette plus sobre,
  interface sombre et icônes SVG principales.
- Mode Ultra HD avec résolution native jusqu'à 3840 pixels de large et adaptation
  automatique de la résolution selon les performances.

Le rendu reste **stylisé et procédural**, en particulier les personnages. Ce
n'est pas une conversion photoréaliste ni un jeu de niveau GTA. Le mode Ultra HD
concerne la résolution de rendu, pas des textures 4K pour chaque objet.

## Commencer une conquête

Rapproche-toi d'un habitant et utilise les **ordres** (bouton en haut ou ↑ sur la
manette) pour devenir son ami puis le recruter. Emmène au moins une recrue valide
sur un secteur accessible. La capture progresse si le gang propriétaire ne le
conteste pas à proximité. Les recrues KO ou captives ne comptent plus. La capture
ne progresse pas depuis un véhicule, une cellule ou un toit élevé.

Les quartiers contrôlés versent leurs revenus dans la planque toutes les deux
minutes. Contrôle les douze secteurs et conserve-les pendant 90 secondes pour
remporter la campagne. Les anciennes sauvegardes sont conservées ; une victoire
sur l'ancienne carte à huit secteurs ne valide pas automatiquement la nouvelle.

## Manette PS5 / DualSense

Brancher la manette en USB, ou l'appairer dans les réglages Bluetooth de l'appareil,
puis appuyer sur une touche dans la page du jeu. Le navigateur doit exposer la
manette via Gamepad API. Le menu contient un écran de diagnostic.

| Commande | Fonction |
|---|---|
| Stick gauche | Déplacement / direction |
| Stick droit | Caméra |
| L3 | Courir |
| R3 | Recentrer la caméra |
| ✕ | Sortir / ranger l'arme |
| ◯ | Sauter ; commande contextuelle du véhicule |
| △ | Interagir / entrer dans un véhicule |
| ▢ | Frapper ; outil de chantier / poser l'hélicoptère |
| L2 maintenue | Viser avec une arme ; se baisser sans arme ; freiner au volant |
| R2 | Tirer avec l'arme sortie ; accélérer au volant |
| L1 | Garde / visée selon la situation |
| ← / → | Changer d'arme ou de cible |
| ↑ | Ordres ; maintenir pour la guerre des gangs |
| Pavé tactile | Ouvrir la carte stratégique |
| Options | Menu / fermer une fenêtre |

L'agencement des boutons de façade du jeu d'origine est conservé. Les profils
standard et HID Sony brut sont normalisés. Une déconnexion libère les touches,
la course, la visée et les gâchettes. Les vibrations simples sont facultatives,
selon le navigateur. Les gâchettes adaptatives et les retours haptiques avancés
ne sont pas implémentés. Une DualSense physique n'a pas été testée ici.

Clavier : ZQSD/WASD, Espace, E pour agir, G pour l'arme, X pour tirer,
M pour la carte, J pour les missions classiques, Échap pour fermer.

## Sauvegarde

La progression reste dans le stockage local du navigateur. Le portefeuille,
les fortifications et les opérations accomplies sont sauvegardés. Une opération
ou une attaque en cours ne reprend pas après fermeture ou changement de monde.
Les sauvegardes d'une page ouverte en fichier local et celles du site GitHub Pages
peuvent être distinctes : continuer sur la même adresse pour retrouver sa partie.

## Publication sur GitHub Pages

Pour mettre à jour le site existant, reporter
`index.html` **et le dossier `vendor/`** dans la branche configurée dans
Settings → Pages du dépôt. Conserver les autres fichiers du dépôt. Aucune
compilation n'est nécessaire.

Ne pas remplacer seulement le HTML : le moteur local serait absent. Le jeu
multijoueur demande une adresse HTTP(S) accessible aux autres appareils et une
connexion aux services PeerJS ; il n'a pas été vérifié dans cette intervention.

## Vérifier les changements

Les tests nécessitent Node.js. Pour les tests Chromium :

```sh
npm install --save-dev playwright
npx playwright install chromium
node harness/lint.js
node harness/empire.js
node harness/empire-browser.js
```

`CHROMIUM_PATH` permet d'indiquer un Chromium déjà installé. Les fichiers de la
suite d'origine ne contiennent plus de chemin Playwright propre à une machine.
Le détail des essais effectués se trouve dans `VERIFICATION.md` et les captures
dans `verification/`. Les tests couvrent les changements et un sous-ensemble de
régressions ; ils ne constituent pas une garantie d'absence de tout bug.

Three.js r128 : licence MIT incluse dans `vendor/THREE-LICENSE.txt`.
