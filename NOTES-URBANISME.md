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

## 6. APRÈS TRAVAUX — les mêmes mesures

| mesure | avant | après |
|--------|-------|-------|
| chaussées | 72 | 73 |
| chaussées où deux véhicules de 2,80 m se croisent (≥ 7,60 m) | **27 / 72** | **63 / 73** |
| largeur moyenne gagnée | — | +2,22 m sur 63 chaussées |
| chaussées restées sous le seuil | 45 | 10 (coincées entre deux murs) |
| liaisons du graphe passant **hors bitume** | **21** | **0** |
| détour moyen, 56 trajets bout à bout de la ville | **2,25 ×** | **1,90 ×** |
| nœuds cul-de-sac | 48 | 43 |
| véhicules IA bloqués après 900 pas | 0 / 8 | 0 / 8 |
| chevauchements de véhicules | 0 | 0 |
| véhicules hors chaussée | 0 | 0 |
| rue x = 52, de z = 6 à z = 32 (26 m à vol d'oiseau) | **520 m**, puis 70 m avec le contournement | **28 m** |
| stops en ville | 5 (0 arrêt complet mesuré) | 9 (arrêt complet de 429 images mesuré) |
| panneaux | 76 | 94 |
| carrefours sans stop ni cédez-le-passage | 2 | 0 |

Nouvelle hiérarchie : **boulevard 13 m · avenue 11 m · rue 9 m · ruelle 8 m**
(au lieu de 9 / 8 / 7 / 6 / 5). Les paliers 5, 6 et 7 restent déclarés dans `VOIES` pour les
rares chaussées qu'aucune largeur supérieure ne laisse passer.

## 6 bis. LA SECONDE VAGUE (arbitrage du chef : élargir là où c'est prouvable)

| mesure | avant travaux | fin du 1er lot | fin du 2e lot |
|--------|---------------|----------------|---------------|
| chaussées | 72 | 73 | **75** |
| croisement possible (≥ 7,60 m) | 27 / 72 | 63 / 73 | **69 / 75** |
| liaisons du graphe hors bitume | 21 | 0 | **0** |
| détour moyen, 56 trajets | 2,25 × | 1,90 × | **1,76 ×** |
| parcours moyen en 900 pas | 50,5 m | 45,8 m | **62,8 m** |
| nœuds cul-de-sac | 48 | 43 | **37**, dont **0 accidentel** |
| chevauchements de véhicules au DÉPART | 2 paires | 2 paires | **0 sur 47 véhicules** |

### Ce qui a débloqué quoi

1. **L'entrepôt de (92 ; 50), 18 m → 14 m.** Il était le SEUL obstacle des deux plus longues
   rues de la ville : la rue de l'est (x = 80, 196,6 m) et la promenade du littoral
   (x = 104, 197 m). Ses murs tombaient à 3,20 m de chacun des deux axes ; à 8 m de chaussée,
   1,00 m de mur dans la voie. Ses trois frères font 14 m : il les rejoint, garde sa coque
   ouverte, son rideau roulé et son allée d'entrée. **+394 m de rue au gabarit.**
2. **Second passage d'élargissement après `bouchLesTrous()`.** Les bouchons naissent après le
   premier passage et héritaient de la largeur de la plus étroite de leurs voisines : trois
   d'entre eux (les raccords de l'anneau en (±26 ; 0), la desserte du parc en (-30,8 ; 46))
   restaient sous le seuil au milieu d'un réseau passé à 8-13 m.
3. **Deux raccords neufs à l'ouest** (voir §8).

## 7. Ce qui reste ouvert — les SIX chaussées sous 7,60 m, et POURQUOI

Chacune a été mesurée taboo par taboo (`chausseeAcceptable` au palier suivant) :

| chaussée | longueur | ce qui bloque | verdict |
|----------|----------|---------------|---------|
| (0 ; -34) 7 m et (0 ; -31,55) 7 m | 12 et 18 m | les deux immeubles de (±8 ; -35,5), qui mordent de **25 cm** | **laissées**. Leur écart intérieur est de 7,50 m pour 7 m de chaussée : il n'y a DÉJÀ pas de trottoir. Les écarter assez pour une vraie rue de 8 m + trottoirs demanderait de respacer toute la rangée (-30, -18, ±8, 18, 30), qui vient alors buter dans la colonne x = ±35,5. |
| (-42 ; 25) 6 m | 56 m | le **Parking du commissariat** (mord 12 m) et les deux immeubles de x = -35,5 (0,75 m) | **laissée**. Les deux voitures de patrouille sont garées en (-49 ; 9) et (-44 ; 9) : la seconde est à 1 m du bord actuel de la rue. Élargir, c'est la mettre dans la voie. |
| (-26 ; 0) 6 m | 58 m | le **Parking du centre** (24 × 16 en (-13 ; 8,5), mord 3 m) et la boutique de vêtements (1,8 m) | **laissée**. La dalle du parking et ses 16 places sont entre les deux. |
| (0 ; -4) 6 m | 38 m | le même **Parking du centre** (mord 3 m) | **laissée**, même raison. |
| (0 ; 26) 6 m | 58 m | les **trois boutiques** (Vêtements, Snack, Salle de sport) alignées en z = 19,5, qui mordent de 1,30 m | **laissée**. Il faudrait les reculer de 1,50 m au sud — où se trouvent déjà la terrasse, les trois bancs et le parking. Leurs intérieurs (comptoirs, vitrines, mannequins, tapis de course, banc de musculation, points d'interaction) sont posés à la main, coordonnée par coordonnée : les déplacer sans les casser demande un chantier à part. |

## 8. Les impasses (43 → 37, 0 accidentelle)

**Le critère, mesuré** : une impasse est ACCIDENTELLE quand il existe un autre nœud à moins de
20 m dont le chemin RÉEL par les voies dépasse trois fois ce saut plus 10 m de marge.

- **Sur bitume existant** (le graphe ignorait une arête) : (-54,5 ; 110) ↔ (-47,5 ; 110),
  7 m sur le même goudron pour 62 m de détour ; (-46 ; 12,5) ↔ (-42 ; 9), 5,30 m pour 26 m.
  Passe « 5 quater » de `construireGraphe()` : raccord dès que le détour vaut 3 × le saut + 10,
  **et seulement si tout le segment est sur du bitume déclaré** — c'est ce garde-fou qui garde
  les 0 liaison hors chaussée.
- **Bitume manquant** : les deux rues parallèles de l'ouest (z = 10 et z = 22, 1 m de pelouse
  entre elles) se regardaient sans se toucher à leurs deux bouts : 57 m et 42 m de détour pour
  12 m. Deux raccords nord-sud neufs : « Raccord ouest / est des rues de l'ouest ».
- **Les 37 restantes sont des fins de rue légitimes** : bord de carte, accès circuit,
  hélistation nord, bretelle du rallye, fond du Quartier résidentiel (8), Techno-Parc (2),
  La Zone, Commerces.

## 9. Les véhicules posés à la construction

Balayage des **47 véhicules** (city.cars + aiCars + police + karts), rectangles orientés :
**0 chevauchement**, la paire la plus serrée garde 0,65 m. Deux paires étaient fautives :

- les deux **motos** du parking, 1,10 m d'entraxe pour 1,10 m de large — zéro dégagement.
  La rouge ne peut pas reculer (la voiture de x = -8 tient -9,20 à -6,80) : la bleue avance
  à -3,60. Entraxe 2 m.
- la **benne** (7 m) et le **bulldozer** (5,40 m) du dépôt, 5,81 m de centre à centre, et le
  bulldozer en plus à cheval sur le mur ouest du hangar. Il se gare maintenant dans le hangar,
  à 0,40 m du mur, et sa place se calcule sur la position RÉELLE de la benne (`benne.z - 7`) —
  `gare()` recule la première rangée dès que la rue s'élargit.

Reste connu, **hors urbanisme** : deux karts de la grille de départ du rallye touchent la
barrière basse (0,80 m) du circuit. La grille est calée par `grilleDepart()` ; y toucher
déplacerait le départ de la course.

Mobilier et décor : les 98 panneaux de signalisation ne se chevauchent pas deux à deux
(mesuré) ; arbres, bancs et poubelles sont déjà posés par `decorPublic` avec évitement.

## 10. Journal du premier lot (conservé)

- **10 chaussées** ne peuvent pas atteindre 7,60 m : elles sont bordées des deux côtés par un
  bâtiment ou une parcelle. Les plus gênantes sont la rue de l'est (x = 80, 7 m, 190 m de long)
  et la promenade du littoral (x = 104, 7 m). Les élargir demanderait de **déplacer des
  bâtiments**, ce qui sort de la demande du joueur.
- **43 nœuds cul-de-sac**, dont 22 à plus de 6 m de toute autre chaussée. Une bonne part sont
  des fins de rue légitimes (accès circuit, hélistations, bord de carte) ; les autres attendent
  les terrains neufs du poste QUARTIERS.
- Le débit brut (50 m parcourus en 900 pas) n'a pas bougé : il est limité par la vitesse des
  conducteurs, pas par la géométrie. C'est le **détour** qui a baissé de 16 %.
