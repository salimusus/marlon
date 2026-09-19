# URBANISME — la carte MESURÉE du réseau avant travaux (round 75)

Demande du joueur, mot pour mot :
> « déplace l'armurerie (mets-la dans une zone qui ne gêne pas la circulation)
>   et refais les routes mieux organisées, plus fluides, plus larges »

Toutes les valeurs ci-dessous sont RELEVÉES en page (`harness/sonde.js`), jamais supposées.

## 1. Les gabarits — quel est le plus gros véhicule du jeu ?

Relevé sur `city.cars + city.aiCars + police.cars` (`baseW` × `baseD`, en mètres) :

| véhicule    | largeur | longueur |
|-------------|---------|----------|
| bulldozer   | **2,80**| 5,40     |
| 4×4         | 2,70    | 4,90     |
| camion (truck) | 2,60 | **8,60** |
| camion de pompiers | 2,60 | 8,00 |
| benne / grue | 2,50   | 7,00 / 7,50 |
| voiture     | 2,40    | 4,40     |

**Le critère de largeur** : une voie doit laisser passer le plus large (2,80 m) ET un croisement,
avec 50 cm de garde de chaque côté. La voie de droite est posée par `construireGraphe()` à
`largeur / 4` de l'axe ; deux véhicules qui se croisent occupent donc `largeur/4 ± 1,40`.
Il faut `largeur/4 ≥ 1,40 + 0,50` → **largeur ≥ 7,60 m**.

## 2. Les largeurs AVANT

72 chaussées :

| rôle      | largeur | nombre | croisement possible ? |
|-----------|---------|--------|-----------------------|
| desserte  | 5 m     | 2      | non — les deux véhicules se chevauchent de 1,55 m |
| ruelle    | 6 m     | 28     | non — 10 cm de garde, pas de croisement |
| rue       | 7 m     | 15     | non — 5 cm de garde |
| avenue    | 8 m     | 16     | tout juste (60 cm) |
| boulevard | 9 m     | 11     | oui |

**45 chaussées sur 72 (62 %) sont sous le seuil de 7,60 m.** C'est le défaut ouvert 239/240
du poste Conduite : le camion de pompiers (8 m de long, 2,60 de large) ne passe pas partout.

## 3. L'armurerie — POURQUOI elle gêne (chiffré)

L'armurerie est en (52, 19), 12 × 9 m ; son **stand de tir** est en (52, 7), dalle de 15 × 12 m.

- La **rue de l'héliport** `road(52, -16, 6, 58)` court de z = −45 à z = **13**.
  La **rue commerçante** `road(52, 69, 6, 88)` reprend à z = **25**.
  Entre les deux : le bâtiment. La rue x = 52 est **coupée en deux sur 12 m**.
- Relevé de la grille des voitures (`NAV.cout`) le long de x = 52 :
  `z = 12` bloqué, `z = 14 · 16 · 18 · 20` coût 3 (hors chaussée). Confirmé : trou de 12 m.
- La **dalle du stand de tir** (x 44,5→59,5 ; z 1→13) recouvre la rue x = 52 (x 49→55)
  sur 12 m de long, ET la rue z = 0 (`road(52, 0, 46, 6)`, x 29→75) sur ses 2 premiers mètres.
- Conséquence mesurée : `degageLesRoutes()` **efface 38 objets** à chaque chargement, dont
  **la dalle du stand de tir, sa ligne de tir (13 × 0,5 m) et son portique** — relevé après
  chargement, ces trois solides n'existent plus dans `solids`. Le stand de tir du joueur est
  donc DÉTRUIT par le nettoyage des chaussées à chaque partie, précisément parce qu'il est
  posé sur deux rues.
- Le contournement bricolé au round précédent (3 tronçons de 6 m en x 49→66, z 7→30) coûte
  30 m de détour et ajoute 2 carrefours parasites à un endroit où il n'y a rien à desservir.

## 4. La carte des défauts du réseau

- **48 nœuds cul-de-sac** sur 147 (une seule voie sortante).
- **15 arêtes que le gabarit d'une voiture ne franchit pas** (`e.dur > 0`), toutes sur des
  ruelles de 6 m ou des dessertes de 5 m.
- Le graphe a besoin de **11 liaisons de rattrapage + 6 raccords** pour ne faire qu'un réseau :
  autant d'endroits où deux bouts de bitume ne se touchent pas.
- **La rue z = 0** (`road(52, 0, 46, 6)`) s'arrête à x = 75 ; la rue de l'est (x = 80, w = 6)
  commence à x = 77. **2 m de trottoir** entre les deux, rattrapés par une liaison du graphe.

## 5. La fluidité AVANT

Circulation laissée tourner **900 pas de simulation** (`__G.step(1/60, true)`), 8 voitures IA :

| mesure | avant |
|--------|-------|
| véhicules immobilisés (< 3 m parcourus) | 0 / 8 |
| chevauchements relevés (30 relevés) | 0 |
| véhicules hors chaussée | 0 |
| parcours moyen en 900 pas | 50,5 m |
| **détour moyen sur 56 trajets** (`itineraireVoies`, bout à bout de la ville) | **2,25 × le vol d'oiseau** |

Le débit n'est pas cassé, c'est le **détour** qui l'est : 2,25 fois le vol d'oiseau, parce que
le réseau est un damier plein de trous où chaque trou oblige à un contournement.

## 6. Ce que je fais, dans l'ordre

1. (ce fichier) la carte mesurée — fait.
2. Déplacer l'armurerie et son stand de tir hors des deux rues, avec accès et stationnement,
   et rendre la rue x = 52 continue ; supprimer les 3 tronçons de contournement.
3. Élargir : une passe `elargirLesVoies()` qui monte chaque chaussée au palier supérieur
   SANS entrer dans un bâtiment, dans la mer, dans le sable, dans une parcelle, ni avaler
   un véhicule garé. Nouvelle hiérarchie : 8 / 9 / 11 / 13 m.
4. Réorganiser : boucher les trous relevés au § 4.
5. Mesurer à nouveau le § 5.
