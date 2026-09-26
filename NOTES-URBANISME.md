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

---

# ROUND 76 — LA RÉCONCILIATION (poste VILLE & DÉCOR)

La version 0.10 (Codex) et les travaux du round 75 (routes élargies, armurerie déplacée,
trois quartiers neufs) ont fusionné sans conflit git mais se contredisaient par endroits.
Règle suivie : pour chaque désaccord, **mesurer les deux versions** et garder la meilleure.
Toutes les valeurs ci-dessous sont relevées en page (`harness/sonde.js`).

## 1. Ce que la fusion n'avait PAS cassé (vérifié, pas supposé)

L'état pré-fusion de notre branche (`git show 4dfb71c:index.html`, passé au banc avec
`JEU=`) donne **exactement** les mêmes relevés que l'état fusionné pour : les 10 balançoires,
le mur qui ferme le hall de l'immeuble (-8 ; -35,5), les 2 et 5 lampadaires du Marché et du
Techno-Parc, les 3 murs du commissariat, les 2 articles morts du camp du Bois. **Ces six
défauts sont les nôtres**, pas ceux de la 0.10 : ils datent du round 75 (ou d'avant).

## 2. Les réparations, avec la mesure qui les a tranchées

| défaut | avant | après |
|--------|-------|-------|
| lampadaires du Marché / du Techno-Parc | 2 et 5 | **11 et 10** (156 en ville, 105 avant) |
| murs du commissariat (h = 3,8 m) | 3 | **5** (nord et ouest rendus) |
| carrefours rue secondaire / boulevard sans stop ni cédez | 1 | **0** (210 panneaux) |
| culs-de-sac accidentels | 1 — (-175 ; 257,5), 9,2 m à vol d'oiseau, 108 m par les voies | **0** (38 impasses, toutes légitimes) |
| entrée du hall des immeubles | porte de 2 m, arrêt nez au mur à z = -31,6 | **baie de 5 m**, on entre en marchant droit |
| articles de comptoir sans usage | 2 (Lampe frontale, Boussole) | **0** sur 17 au catalogue du sac |

**Le lampadaire n'était pas déplacé, il était SUPPRIMÉ.** `degageLesRoutes()` épargne « les
feux et les lampadaires » (`o.feu || o.lampe`) parce qu'une passe spéciale les repousse
ensuite au bord de la voie — mais le solide créé par `lamp()` ne portait pas la marque
`lampe` : il partait avec le mobilier ordinaire, avant. Depuis l'élargissement (Rue des
Primeurs et Rue de la Halle, 7 → 11 m), c'était 8 lampadaires sur 10 au Marché.

**Les murs du commissariat** tombaient pour la même raison : le « Raccord est des rues de
l'ouest » (x = -65, 8 m) posé au round 75 mordait d'un mètre dans la coque (mur ouest à
x = -62), et la protection « objet DANS un bâtiment » rate les murs de 7 cm (l'emprise
`city.batiments` est rognée de 0,5 m). Le raccord est passé en x = -66,5 : il garde ses 8 m,
recouvre toujours les deux rues de l'ouest et laisse 50 cm entre son bitume et le mur.

## 3. L'art de la ville de la 0.10 : gardé, et corrigé

La 0.10 a sorti les lignes blanches et l'axe jaune de la TEXTURE de la chaussée (ils se
répétaient à l'identique et traversaient tous les carrefours) pour les peindre en géométrie
découpée à chaque croisement, avec les flèches de direction. **C'est mieux : on garde.**
Prix mesuré (Ultra HD, passe d'ombres comprise) : 3 maillages fusionnés, +30 756 triangles
et +4 appels de dessin, identiques depuis n'importe quel point de vue (rien n'est jamais
éliminé par le tronc de vue). Le budget d'image tient : 9 621 appels au pire (plafond 10 000)
et 6 018 au centre-ville (plafond 9 000).

Ce qu'elle ignorait : **les deux marquages que le jeu pose lui-même avant elle**. Relevé sur
la ville entière : **220 marques tombaient dans les 114 passages piétons** (l'axe jaune
traversait les zébras de part en part) et **19 doublaient une ligne d'arrêt de feu** (deux
barres blanches côte à côte). La peinture est maintenant coupée à chaque passage comme elle
l'est à chaque carrefour : **0 et 0**, et 394 marques de moins (2 267 → 1 873).
`city.zebras` recense l'emprise de chaque passage peint — c'est une liste de DÉCOR, les
conducteurs continuent de ne lire que `city.passages`.

## 4. Ce qui reste ouvert

- **5 lampadaires posés à la main dans l'emprise d'un bâtiment** — (-4,2 ; 20), (0 ; 201,6),
  (10 ; -108), (-124 ; -146), (-170 ; 274) — et 7 plantés dans un autre objet. Ces douze-là
  sont antérieurs (mesurés identiques avant/après) : ils appartiennent aux postes qui ont
  bâti ces quartiers.
- **Les six chaussées sous 7,60 m** du §7 restent comme décrites.

## 5. Les bancs Node de la version 0.10 (lancés, et verts)

La 0.10 est arrivée avec ses propres bancs en Node (rapides, sans navigateur, chargés par
`harness/run.js` — ils acceptent `JEU=` pour comparer deux versions). Le seul échec de
géométrie qu'ils relevaient :

> `All building and shop footprints stay outside the 89 streets : building −54,28 overlaps
> street −65,18 by 0.75`

C'est **exactement** le raccord du §2 : son bord est tombait à x = -61 et l'emprise du
commissariat commence à x = -61,75. Le décalage à x = -66,5 (qui rendait aussi ses deux murs)
ferme ce défaut : la chaussée y est passée à 9 m à l'élargissement, bord est à x = -62,
**25 cm de dégagement**. Tolérance du banc : 40 cm de chevauchement ; la pire valeur de la
ville est maintenant **+0,30 m**, les trois boutiques de z = 19,5 contre la rue z = 26 (défaut
connu du §7).

État après travaux : `traffic.js` **14/14**, `verify.cjs` 14 + cosmétiques, `vehicle-contact.js`
6/6, `strategy.js` 7/0, `city-detail.js` 10/10, `cinematic.js` 14, `empire.js` 15/0,
`save-strategy.js` 4/0, `gamepad.js`, `controls-tv.js`, `cosmetic-performance.js` : **0 échec
sur les 12 bancs**. `harness/audit.js` : la liste des poteaux plantés dans un bâtiment est
redevenue celle d'avant mes corrections (10, tous antérieurs, tous à La Zone) et le nombre de
régions piétonnes séparées passe de 11 à 10.

---

# ROUND 78 — POSTE VILLE & VÉHICULES

Trois défauts (n° 95, 96, 99) et trois relevés de géométrie laissés par le poste CONDUITE.
Règle de travail du round : **pour chaque point, regarder une capture avant de conclure.**
Un camion garé dans une porte, ça se voit ; ça ne se calcule pas.

## 1. Le contact des véhicules : la tôle, pas l'enveloppe (n° 96)

La voiture **conduite** était le seul véhicule dont le contact se calculait encore sur la boîte
**alignée sur les axes**. Cette boîte GONFLE quand on braque : `vehicleSolid()` la recalcule en
`W·|cos h| + D·|sin h|`, donc une caisse de 2,40 × 4,40 m à 45° présente une boîte de **4,81 m
de côté** — 2,00 m de large en trop. Au parking du centre, voisines à 2,40 m, il suffisait de
tourner le volant pour « toucher » une voiture jamais approchée.

| manœuvre de sortie de place, R2 à fond, quart de tour à gauche | avant | après |
|---|---|---|
| contacts détectés en 2,9 s | 7 | **1** |
| dont contacts FANTÔMES (châssis non jointifs) | **6** (le pire à **1,278 m** d'écart) | **0** |
| écart réel des tôles au moment du constat | **0,255 m** | — (aucun constat) |
| accidents ouverts | 1 | **0** |
| dégâts | 58,5 % | **0 %** |
| distance parcourue en 15 s | 1,58 m | **29,02 m** |
| images sous 0,6 m/s (sur 900) | 725 | **111** |

`contactVehicules()` — la séparation orientée (SAT) — existait déjà et servait à **toutes les
autres paires** de véhicules. `separerVehicules()` saute explicitement `drive.car` au motif
qu'« elle a son propre traitement » : c'est ce traitement-là qui était resté en arrière. Il n'y
a plus qu'**une seule géométrie de contact** pour tout le monde.

Second défaut au même endroit : l'impact se lisait sur `drive.speed`, **la vitesse que le moteur
réclame**. Calée contre sa voisine, pied au plancher, la voiture affichait **16,62 m/s** en
n'avançant plus. On mesure maintenant le rapprochement des deux tôles **le long de la normale de
contact**, en vitesse relative. C'est l'esprit de la règle déjà appliquée au choc contre un MUR
(`perte` : « la vitesse que le mur a ÔTÉE »). Un frôlement a une normale perpendiculaire à la
marche : rapprochement quasi nul, donc une rayure. **Les seuils n'ont pas bougé**
(`ACCIDENT_VITESSE_MIN` = 10 m/s, 12 m/s contre un véhicule garé) — ils recevaient une valeur
fausse, voilà tout. Contre-épreuve : lancée à 14 m/s dans une voiture garée, elle ouvre toujours
un accident et s'immobilise.

*(Essayé et retiré : mesurer l'impact par la PROFONDEUR d'interpénétration rapportée à la durée
de l'image. Sur la première image de contact elle ne vaut que « ce qu'on a avancé MOINS le jeu
qui restait », donc elle dépend de l'endroit où la voiture se trouvait à l'image d'avant —
mesuré **3,2 m/s pour un encastrement à 14 m/s**, et plus aucun accident nulle part.)*

## 2. Une seule table de sièges (n° 95)

Il y en avait **deux**. `chienTick` portait la sienne, écrite à la main, qui posait le chien à
`lx −0,52 / lz +0,05` dans une voiture fermée — très exactement le siège « avant » de `PLACES`.
`placeOccupants` l'asseyait pourtant bien (`assiedChien`, place `chien`, centre de la banquette),
mais `poseJoueurAuVolant` tourne AVANT `cityCommon` : chienTick le remettait sur les genoux du
passager à chaque image. Écart chien ↔ passager avant : **0,10 m → 1,30 m**, stable sur 8 s.

Deuxième racine, la **déclaration** : `enterCar` n'inscrivait `c.chien` que si le chien était à
moins de 6 m, alors que chienTick l'embarque sans aucune condition de distance. D'où « le chien
est dans la caisse et `c.chien` est faux ». Une seule règle : il monte s'il a une place et qu'il
n'est ni couché dans sa niche ni lancé sur quelqu'un.

Les **deux-roues et le jet-ski** gardent leur repère à eux : le chien y voyage dans son panier
(`panierChien`), calé sur ces valeurs-là, et personne ne s'y assied à sa place.

## 3. Un pare-chocs pousse de côté, il n'emporte pas (n° 99)

Ce n'est pas le pilote, c'est la **résolution de collision du joueur** — et ce n'est pas propre
au camion de pompiers : **n'importe quel véhicule qui avance** emportait l'enfant immobile.

Quand le joueur est déjà dans la boîte d'un solide, `moveAxis` le repose sur **la face la plus
proche**. C'est juste pour un portail qui se referme. Face à un véhicule qui roule, c'est un
**chasse-neige** : collé au pare-chocs, la face la plus proche est la face AVANT, donc on le
repose devant la caisse, à chaque image. `desincarcere` ne voyait rien : le joueur ne pénétrait
jamais la caisse, il était reposé devant elle.

| manette posée, aucune entrée, 30 s | avant | après |
|---|---|---|
| emporté par un camion à 1,5 m/s (allure « au pas » en intervention) | **33,4 m** | **0 m** |
| emporté par une voiture à 1,5 m/s | 33,4 m | **0 m** |
| emporté à 0,8 m/s | 20,4 m | **0,37 m** |
| écart latéral (il sort de la voie) | 1,7 m | **1,72 m**, et le véhicule le dépasse |
| véhicule à l'ARRÊT | 0 m | **0 m** |

Sur l'axe de marche du véhicule on annule le pas au lieu de reposer le joueur devant lui, et le
dégagement — armé sur-le-champ — l'écarte **du côté LIBRE** (testé par `penetration`) pour ne pas
l'envoyer dans une façade. La boîte de collision retient pour cela le cap du véhicule et le fait
qu'il roule (`o.vh`, `o.vmob`, posés dans `vehicleSolid`).

## 4. Les trois relevés de géométrie du poste CONDUITE

### a) Le camion de pompiers garé au travers de sa caserne — **corrigé**

La « perche de descente » n'était pas une perche : un **panneau de 3 × 6,80 × 0,30 m** planté en
(−40 ; 126), au milieu de la travée. Le camion (2,60 × 8 m en (−40 ; 128), donc z de 124 à 132)
le contenait sur toute sa largeur. Et — vu en capture, pas calculé — il **sortait par le toit** :
le pavillon de la caserne plafonne à 5,10 m, le panneau montait à 6,80, soit **1,70 m de plaque
blanche en l'air au-dessus du toit**, qui coupait en deux l'enseigne « CASERNE DES POMPIERS ».

C'est une vraie perche maintenant : 0,30 m de section, du sol à 4,50 m (la sous-face du toit est
à 4,70), contre le flanc ouest de la travée, avec sa trappe de dortoir — à 4,70 m de la caisse du
camion. **Solides dans la caisse du camion : 1 → 0. Solides qui percent le toit : 1 → 0.**

**C'est le décor qu'on déplace, pas le camion** : sa place est calculée par `gare()` /
`placeDeService`, le garde-fou qui tient son gabarit hors de la chaussée, et la sortie de la cour
est un acquis mesuré du round 77 (14,1 m jusqu'à la rue, 1 image lente sur 700). On ne discute pas
avec le garde-fou pour un décor mal taillé.

### b) La rue x = 52 mordue par son propre mobilier — **corrigé**

Six bancs en x = 48,5 (z = 40, 49, 58, 67, 76, 85). Un banc tourné dans l'axe de la rue a une
boîte de **0,85 m** de large : il s'étendait donc jusqu'à **x = 48,925** alors que le bitume
commence à 48,5 — **42,5 cm de banc dans la voie**, six fois. Et ça se voit : sur la capture, les
bancs débordent de la ligne blanche de rive sur le goudron.

| rue x = 52 (section nord, 7 m, x 48,5 → 55,5) | avant | après |
|---|---|---|
| pire chevauchement du mobilier sur la chaussée | **0,425 m** | **0** |
| jeu entre le mobilier et le gabarit de la voie de droite (axe x = 50,25, demi-gabarit 1,20 m) | **0,125 m** | **0,725 m** |

Les bancs reculent de 60 cm, à x = 47,9 (bord est 48,325). **On recule le mobilier, on n'élargit
pas la rue** : l'avertissement du round 76 est clair, il ne reste que 10 cm de marge géométrique
en ville. `node harness/traffic.js` lancé avant de commiter : **14/14**.

*Nuance sur le relevé reçu* : les **deux poteaux de x = 48,1** (z = 36 et 92) ne mordaient PAS.
Leur section est de 0,15 m, donc leur bord est tombe à 48,175 — 32,5 cm en deçà de la rive.
Mesuré, seuls les six bancs étaient en cause. Et l'itinéraire du centre vers (40 ; 90) passait
**déjà** par la rue x = 52 (80,0 m pour 80,9 m à vol d'oiseau, 11 points sur 15 sur cet axe) : le
calcul d'itinéraire n'était plus en cause, c'était bien la **marge** qui manquait — 12,5 cm.

### c) La place du centre étroite pour les gros véhicules — **laissé, volontairement**

Relevé : sur les 9 chaussées à moins de 30 m du centre, **3 sont sous le seuil de 7,60 m** —
(0 ; −4) 6 m, (−26 ; 0) 6 m, (0 ; 26) 6 m. Le plus long véhicule du jeu est le camion, 8,60 m.

Ce sont **exactement** les trois chaussées déjà documentées au §7 ci-dessus comme laissées
sciemment au round 75, avec leur raison chiffrée : la dalle du **Parking du centre** et ses
16 places marquées pour les deux premières, les **trois boutiques de z = 19,5** pour la troisième.
Ces trois boutiques sont par ailleurs la **pire valeur de la ville** (+0,30 m contre la rue
z = 26) : c'est précisément sur elles que porte l'avertissement des 10 cm. Les élargir demande de
déplacer le parking et les intérieurs des trois boutiques (comptoirs, vitrines, mannequins, tapis
de course, points d'interaction), tous posés à la main coordonnée par coordonnée. **C'est un
chantier à part, et il mangerait la marge que le round 76 demande de préserver.** Le pilotage gère
la place aujourd'hui ; on ne touche pas.

---

# ROUND 83 — POSTE PLANTATIONS & STATIONNEMENT

Deux défauts d'urbanisme relevés par le joueur. Même règle de travail qu'aux rounds précédents :
**tout chiffre ci-dessous est relevé**, en page (`harness/sonde.js`) ou par un banc Node monté sur
`harness/run.js` avec une graine figée avant la construction du monde.

## 1. Des arbres et des palmiers plantés sur la chaussée

### Le recensement AVANT (5 graines)

Le contrôle relève les troncs **dans la SCÈNE** et non dans `solids` : un arbre qu'on a déjà jeté
compte comme un défaut, pas comme une réussite.

| graine | palmiers | arbres | troncs mordant une chaussée | houppiers SANS tronc |
|--------|----------|--------|------------------------------|----------------------|
| 6174 | 44 | 199 | 1 | 0 |
| **987654321** | **42** | 199 | 1 | **2** (x = 105,57 et 105,58) |
| 1 | 42 | 198 | 1 | 0 |
| 42 | 41 | 198 | 1 | 0 |
| 20260926 | 41 | 199 | 1 | 0 |

### Les deux causes, chiffrées

1. **La rangée de palmiers de la plage tire son abscisse DANS la chaussée.** `buildBeach()` plante
   six palmiers à `rnd(105, 110)`, `z = -50 + i × 38`. La **promenade du littoral**
   (`road(104, …, 5, …)`) tient **x = 101,5 à 106,5** — c'est la chaussée **la plus étroite de la
   ville, 5 m**, et `elargirLesVoies()` n'a jamais pu la monter d'un palier. Le tronc fait 0,6 m :
   - `x < 106,2` → chevauchement > 60 cm → `degageLesRoutes()` **emporte le tronc** (24 % des tirages)
   - `106,2 ≤ x < 106,8` → chevauchement ≤ 60 cm → le palmier **reste dans la voie** (12 %)
   Espérance : **2,2 palmiers fautifs sur 6**. La graine 987654321 en donne exactement 2.
2. **Le filet de sécurité faisait pire que le mal.** `degageLesRoutes()` retire le solide **ET son
   maillage** : pour un palmier il n'emporte que le TRONC (0,7 m de large, donc hors de la
   protection « haut ET large »), et les **six palmes restent en l'air à 5,10 m**, au-dessus d'une
   rue vide. `degageDecorSurRoutes()`, lui, ne retire que le SOLIDE : le tronc reste debout au
   milieu de la rue, bien visible, et l'enfant le traverse.
   Le tronc fautif commun aux 5 graines est l'**arbre de (156 ; 259)**, 24 cm dans une chaussée de
   8 m — c'est-à-dire **dans la voie de droite** (axe à largeur/4 = 2 m, demi-gabarit 1,20 m : il ne
   reste que 0,80 m).

### La réparation

Trois fonctions neuves, `bitumeSous` / `placeHorsBitume` / `replanteHorsChaussee` :

- **À LA PLANTATION.** `tree()` (branche ville) et `palm()` refusent la chaussée **et les passages
  piétons**, avec 50 cm de garde, en s'écartant perpendiculairement à la rue fautive, du côté le
  plus court d'abord, par pas de 60 cm. Un emplacement qui tombe **dans un bâtiment** est refusé
  lui aussi (première version sans ce garde-fou : 2 arbres poussés dans un mur, `audit.js` passait
  de 14 à 15 poteaux dans un bâtiment). Les six palmiers de la plage passent par la même porte :
  le tirage reste `rnd(105, 110)`, le pas de 38 m de la rangée ne bouge pas, le tronc atterrit à
  **x = 107,4**.
- **AU DÉGAGEMENT.** La végétation porte la marque `vegetal` et son houppier (`feuillage`) : elle
  **DÉMÉNAGE** au lieu de disparaître, exactement comme les feux et les lampadaires depuis le
  round 76. Elle est jugée plus sévèrement que le reste du mobilier — **30 cm de garde** au lieu
  de 60 cm de chevauchement toléré — parce qu'un tronc à 24 cm dans la voie arrête déjà une
  voiture. **17 plantations sont replantées** à chaque chargement (`city.replantes`).

### Le recensement APRÈS (mêmes 5 graines)

| graine | palmiers | arbres | troncs sur la chaussée | houppiers sans tronc |
|--------|----------|--------|------------------------|----------------------|
| 6174 | **44** | **210** | **0** | **0** |
| 987654321 | **44** | **210** | **0** | **0** |
| 1 | **44** | **209** | **0** | **0** |
| 42 | **44** | **209** | **0** | **0** |
| 20260926 | **44** | **210** | **0** | **0** |

**La ville ne s'est pas vidée, elle a verdi** : 41-44 palmiers → 44, et 198-199 arbres → 209-210.
Les 11 arbres et les 2 palmiers qu'on jetait à chaque chargement sont replantés.
**Aucune géométrie n'est élargie** : on recule la plantation, on ne touche pas au bitume.

## 2. Une rue bordée de deux voitures garées face à face est infranchissable

### Le vrai gabarit n'est pas `baseW`

`carBlocked()` traite un véhicule comme une **chaîne de disques** de rayon `DISQ.r` et gonfle
l'obstacle d'autant. La largeur de passage réellement demandée, mesurée :

| véhicule de service | tôle (`baseW`) | passage réel |
|---------------------|----------------|--------------|
| bulldozer | 2,80 | **3,15** |
| camion (truck) | 2,60 | 3,01 |
| camion de pompiers | 2,60 | 2,96 |
| grue | 2,50 | 2,96 |
| benne | 2,50 | 2,91 |
| voiture (référence) | 2,40 | 2,85 |
| dépanneuse | 2,40 | 2,77 |
| ambulance | 2,30 | 2,68 |

C'est cette largeur-là qu'il faut mesurer, sinon on « prouve » un passage qui ne passe pas.

### Le recensement : UN SEUL cas dans toute la ville, sur les 5 graines

**La sortie du commissariat**, `road(-46, 9, 6, 12)` portée à 8 m par `elargirLesVoies()` :

| | |
|---|---|
| bitume | **8,00 m** (x -50,0 à -42,0 ; z 3 à 15) |
| voiture de patrouille ouest (-49 ; 9) | x -50,20 à -47,80 |
| voiture de patrouille est (-44 ; 9) | x -45,20 à -42,80 |
| **LARGEUR LIBRE entre les deux** | **2,60 m** |
| passage exigé (bulldozer + 20 cm de garde de chaque côté) | **3,55 m** |
| **déficit** | **0,95 m** |

Les deux voitures sont posées à une abscisse FIXE (`buildPolice`, `sx + 5` et `sx + 10`) : le
défaut ne dépend d'aucun tirage, il est identique sur les 5 graines.

**PREUVE AVANT, 900 pas de simulation (1/60 s)**, départ en (-46 ; 1), cap au nord, conducteur qui
tente en plus un écart latéral de 15 cm quand il est bloqué :

| véhicule | avance en 900 pas | images bloquées |
|----------|-------------------|-----------------|
| bulldozer | **2,17 m** | 874 / 900 |
| camion | **0,67 m** | 892 / 900 |
| camion de pompiers | **0,92 m** | 889 / 900 |
| dépanneuse | **1,75 m** | 879 / 900 |
| ambulance | **2,50 m** | 870 / 900 |

Balayage géométrique du couloir, abscisse par abscisse sur toute la longueur de la rue :
**aucune abscisse ne laisse passer même l'ambulance.**

### L'arbitrage : pourquoi PAS élargir

- **Élargir la rue ne change RIEN.** Les deux voitures sont à une abscisse fixe : un mètre de
  bitume de plus s'ajoute **autour** d'elles et l'entre-deux reste à 2,60 m. Il faudrait
  2 × 2,40 + 3,55 = **8,35 m entre leurs deux flancs extérieurs**, donc une rue de 8,6 m, pour un
  gain **nul** puisque les voitures ne bougent pas. Et l'avertissement des **10 cm** s'applique
  ici : la rive ouest viendrait butter sur le trottoir de x -51,8 à -50,0 et sur le mur ouest du
  commissariat (x -50,2 à -49,8). **Refusé.**
- **Réserver la rue aux petits véhicules** dans le calcul d'itinéraire : c'est l'accès du Parking
  du commissariat et la seule sortie vers la route ouest. Y interdire les 2,80 m coupe le réseau
  pour les secours. **Refusé.**
- **Reculer les places dans une alvéole sur le trottoir** : le trottoir ouest fait **1,80 m**, une
  voiture **2,40 m**. Il faudrait déplacer le trottoir ET la rive — la marge de 10 cm. **Refusé.**
- **Stationnement alterné (un seul côté)** : on déplace **UN véhicule**. Coût géométrique **zéro**.
  **Retenu.**

### La réparation

`stationnementAlterne()`, passe neuve appelée juste après `declareLesParkings()` (donc quand les
rues et tous les véhicules de service sont en place, avant le graphe des voies). Elle recense les
paires de véhicules garés **en vis-à-vis à moins de 8 m** l'un de l'autre le long d'une rue (8 m :
en deçà, on ne slalome pas un camion de 8,60 m entre deux caisses) dont l'entre-deux tombe sous
`gabaritDeService() + 0,40` = **3,55 m**, et **déplace l'un des deux le moins loin possible**. Le
nouvel emplacement doit être libre (`vehBloque`), rester sur **la place de stationnement déclarée**
— sinon c'est du stationnement sauvage, règle du poste Circulation — et laisser passer le gabarit
pour **les deux** véhicules.

### Les mesures APRÈS (5 graines, identiques)

| mesure | avant | après |
|--------|-------|-------|
| bouchons recensés dans la ville | **1** | 1 recensé, **0 non résolu** |
| véhicules déplacés | — | **1** (voiture de patrouille, 6,18 m, même place déclarée) |
| (-44 ; 9) devient | — | **(-47 ; 14,40)**, du même côté que sa jumelle |
| **largeur libre** | **2,60 m** | **3,80 m** |
| géométrie déplacée | — | **0 m²** — la marge de 10 cm est intacte |
| bulldozer, 900 pas | 2,17 m, bloqué | **TRAVERSE, 55,33 m** (236 images bloquées) |
| camion, 900 pas | 0,67 m, bloqué | **TRAVERSE, 53,83 m** |
| camion de pompiers | 0,92 m, bloqué | **TRAVERSE, 54,17 m** |
| dépanneuse | 1,75 m, bloqué | **TRAVERSE, 55,00 m** |
| ambulance | 2,50 m, bloqué | **TRAVERSE, 55,67 m** |
| bande d'abscisses possibles (balayage du couloir) | **aucune** | **2,75 à 3,00 m** selon le véhicule |

## 3. Ce qui n'a PAS bougé (vérifié, pas supposé)

**Attention en lisant `harness/audit.js` : il n'est PAS semé.** Deux lancements du MÊME fichier
donnent des noms de villas différents et 14 ou 15 poteaux dans un bâtiment — la comparaison
avant/après y est sans valeur. Le relevé qui tranche est semé : liste complète des poteaux plantés
dans un bâtiment, graines 6174, 987654321 et 42, ancien index.html contre le neuf →
**43 poteaux, liste IDENTIQUE au caractère près**, sur les trois graines.

*(Une première version de `placeHorsBitume` ne regardait que le bitume et poussait deux arbres DANS
un mur — la maison de (-40 ; 264) et le bloc du Techno-Parc. Le garde-fou « un emplacement dans un
bâtiment n'en est pas un » ferme ce défaut ; c'est ce relevé semé qui le prouve.)*

Les autres bancs Node comparés avec `JEU=` sur l'ancien index.html : `garage.js` **identique**,
`layout.js` identique sauf le nombre de solides (**5288 → 5303**, soit les 15 plantations qu'on ne
jette plus), `zones.js` identique hors tirages non semés (noms de villas, barrière aléatoire).
Les six chaussées sous 7,60 m du §7 du round 75 restent comme décrites : **on n'a élargi aucune
rue, on n'a déplacé aucun mur.**

Bancs : `traffic.js` **14/14**, `vehicle-contact.js` **6/6**, `city-detail.js` **10/10**,
`strategy.js` 7/0, `empire.js` 15/0, `save-strategy.js` 4/0, `cosmetic-performance.js` vert.
Lint **5 ✅**. Tests ajoutés à la fin de `harness/play.js` : **n° 512** (aucun arbre ni palmier sur
la chaussée, deux graines) et **n° 513** (le plus large véhicule de service traverse la rue étroite,
avant / après dans la même page).

---

# ROUND 83 — ITEM 3 : LE MÊME BALAYAGE, MAIS POUR TOUT LE MOBILIER

L'item 1 n'avait marqué que la végétation. Tout le reste du décor de voirie — bancs, poubelles,
panneaux, lampadaires, feux, abribus, bornes, totems — n'était connu de **personne** : aucune
liste, aucune marque, donc aucun contrôle possible. Il entre maintenant au registre
**`city.meubles`** à la pose (`declareMeuble`), avec son GROUPE, ses SOLIDES et ses FICHES
(`city.benches`, `city.panneaux`, `city.trafficLights`, la ligne d'arrêt d'un feu) : c'est la
seule façon de le **déplacer d'un bloc** au lieu de le supprimer.

## 1. L'inventaire, tel que le code le produit

**874 meubles** au registre, 10 familles (graine 6174) :

| famille | n | | famille | n | | famille | n |
|---------|---|-|---------|---|-|---------|---|
| arbre | 210 | | poubelle | 86 | | borne | 6 |
| panneau | 210 | | palmier | 40 | | abribus | 4 |
| lampadaire | 158 | | feu | 38 | | totem | 3 |
| banc | 119 | | | | | | |

*(Les 196 fiches de `city.benches` comptent aussi les chaises d'école, les sièges du cinéma et
les banquettes d'abribus : 119 seulement sont des bancs de voirie posés par `bench()`. Et le
registre OUBLIE ce que le jeu retire volontairement — les feux qu'`elagueLesFeux()` élimine
faute de file à arrêter, ceux qui tombent dans une parcelle de villa : 56 feux posés, 38
gardés.)*

## 2. Les trois questions, et les seuils

Les seuils sont ceux du **code**, pas d'une opinion : **`P.hw` = 0,40 m**, donc l'enfant fait
**0,80 m** de large, et `STEP_UP` = 0,60 m, donc il enjambe tout ce qui monte à moins de 60 cm.

| question | seuil | pourquoi celui-là |
|----------|-------|-------------------|
| **chaussée** | 30 cm entre l'emprise et la rive | même règle que la végétation : un objet à 24 cm dans une rue de 8 m est déjà dans la voie de droite (axe à largeur/4, demi-gabarit 1,20 m) |
| **porte** | **1,00 m** de passage libre **dehors** | 0,80 m de gabarit + 10 cm de jeu de chaque côté : une baie est un ENTONNOIR et la collision du joueur est une boîte alignée sur les axes — en deçà, il accroche le montant à chaque image au lieu de passer |
| **trottoir** | **0,90 m** pour ranger, **0,80 m** (le gabarit nu) pour juger | 5 cm de jeu de chaque côté ; en deçà l'enfant est obligé de descendre sur la route |

## 3. Les chiffres AVANT

**a) La passe compte elle-même**, sur la même population (graine 6174 ; 245 à 246 selon la
graine) : **245 meubles en faute sur 874** — **106 sur le bitume**, **139 fermant un trottoir**
sous 0,90 m, **0 devant une porte**.
Par famille : panneau 132 · lampadaire 61 · arbre 21 · feu 12 · banc 8 · palmier 6 ·
poubelle 4 · abribus 1.

**b) Un second recensement, indépendant du registre**, sait mesurer une version antérieure
(`ca70b34`, qui n'a pas de registre) : il reconstruit la population à partir des registres du
jeu (`city.benches`, `city.panneaux`, `city.trafficLights`, `breakables`) et de la signature de
forme des abribus, bornes et totems. **Cinq graines** (6174, 987654321, 1, 42, 20260926) :

| | avant | après |
|---|-------|-------|
| mobilier dont l'emprise mord une chaussée | **69** | **0** |
| portes sous 1,00 m de passage | **0 / 30** | **0 / 30** |
| trottoirs sous 0,80 m | 44-45 / 311 | **40-41 / 311** |
| … dont **à cause d'un meuble** | **7** | **3** |
| trottoir le plus étroit de la ville | **0,00 m** | **0,00 m** (un mur, voir §6) |

**Les deux cas les plus flagrants**, mesurés :
- un **ABRIBUS planté à 2,08 m DANS la chaussée** de (−145 ; 264), 8 m de large — il n'a pas
  bougé, c'est la rue qui s'est élargie par-dessus lui au round 75 ; pire, `degageLesRoutes()`
  lui **arrachait ses quatre pieds** à chaque chargement ;
- un **BANC qui ferme COMPLÈTEMENT** (0,00 m) le trottoir de (−3,9 ; 9,9) : une boîte de 2,30 m
  sur un trottoir de 1,80 m — l'enfant est obligé de descendre sur la route.

## 4. La réparation : `rangeLeMobilier()`

Une passe appelée **en dernier** (après le décor solidifié, les métiers et les cabines
d'ascenseur : c'est le dernier moment où une rue, un mur ou un véhicule peut encore apparaître
sous un banc). Pour chaque meuble en faute, elle cherche **la place valable la plus proche**, en
s'écartant D'ABORD perpendiculairement à la rue, **du côté opposé au bitume**.

**C'est ce qui conserve le SENS du décor** : l'abribus reste au bord de la route (relevé après
rangement : 2,80 à 4,80 m du bitume le plus proche), le banc contre son trottoir, le panneau à
vue des voitures, la jardinière contre sa façade. Recul **médian 0,60 m**, maximum 6,07 m ; les
17 feux déplacés le sont de 0,30 à 2,01 m et **leurs 38 lignes d'arrêt restent toutes sur une
chaussée**, comme avant.

**ON NE RANGE QUE LES TROIS QUESTIONS DU POSTE.** Un meuble déjà planté dans un mur, dans un
autre objet ou hors carte n'est pas un défaut de voirie : c'est du décor posé à la main. Le
déplacer casse la scène — mesuré : la première version déplaçait la **poubelle du camp du Bois
des Aventuriers** et le contrôle « le camp et le mobilier arrêtent » tombait. Ces états restent
en revanche des **refus de destination** : on n'a pas le droit d'ENVOYER un meuble dans un mur.
Une **place de stationnement marquée** en est un aussi (un lampadaire rangé sur une place du
Parking du Sud, et le contrôle des 16 places n'en comptait plus que 15 libres).

## 5. Les mesures APRÈS

| mesure | avant | après |
|--------|-------|-------|
| meubles en faute | **245** (106 chaussée + 139 trottoir) | 245 trouvées, **245 rangées, 0 restante** |
| mobilier sur la chaussée | 69 | **0** |
| trottoirs fermés par un meuble | 7 | **3** (cas combinés, voir §6) |
| portes sous 1,00 m | 0 / 30 | **0 / 30** |
| **meubles supprimés** | — | **0** |

**RIEN N'EST SUPPRIMÉ, ET LA VILLE A MÊME REGAGNÉ CE QU'ELLE JETAIT.** Un meuble déclaré n'est
plus jamais ramassé par `degageLesRoutes()` ni par `degageDecorSurRoutes()` : il attend le
rangement. Comptes à graine figée, ancien index.html contre le neuf :

| | avant | après |
|---|-------|-------|
| solides de meuble disparus de `solids` | 24 | **0** |
| lampadaires | 156 | **158** (+2 que le nettoyage jetait) |
| pieds d'abribus emportés par le nettoyage | **4** | **0** (les 4 pieds rendus) |
| bancs / panneaux / feux / poubelles / cônes / étals | 196 / 210 / 38 / 86 / 8 / 14 | **identiques** |
| objets cassables | 538 | 540 (les 2 lampadaires) |
| solides au total (graine 6174) | 5307 | 5313 |

## 6. Ce qu'on ne range pas, et pourquoi

- **3 trottoirs restent sous 0,80 m à cause d'un meuble**, et ce sont des **cas combinés** : deux
  lampadaires en (±4,8 ; −31,5) laissent 0,45 m parce que le trottoir est coincé entre eux et la
  **façade des immeubles de (±8 ; −35,5)** (mur avant à z = −32,17, déjà décrit au round 76) ; un
  panneau en (31,1 ; 20,4) laisse 0,77 m, 3 cm sous le gabarit. La passe garantit que **chaque
  meuble pris seul** laisse 0,90 m : c'est le mur d'en face qui manque.
- **37 à 38 trottoirs restent sous 0,80 m SANS qu'un meuble y soit pour rien** : ce sont des
  **murs**, des **clôtures de 40 m** et des **piliers de portail** (0,80 × 3,60 m) le long
  desquels le trottoir a été posé — le pire est à **0,00 m**. Les déplacer, c'est déplacer de
  l'architecture : **c'est exactement ce qui mangerait les 10 cm de marge**, et c'est un chantier
  de voirie à part (il faudrait décaler le trottoir, donc la rive, donc la chaussée).

## 7. LES 10 CM DE MARGE, NOIR SUR BLANC

**Ils n'ont pas bougé.** Cet item n'a déplacé **que du mobilier** : aucune chaussée élargie,
aucun mur, aucun bâtiment, aucune dalle, aucun trottoir touché. **91 chaussées** et **311
trottoirs** avant comme après, aux mêmes largeurs, sur les cinq graines relevées. La pire valeur
de la ville reste celle du round 76 : les trois boutiques de z = 19,5 contre la rue z = 26,
**+0,30 m**.

## 8. Coût de chargement

La première version relisait les 311 trottoirs ET les 5 300 solides à **chaque essai de
position** : **+0,84 s** de chargement (9,10 → 9,94 s au banc Node). Les portes sont sorties une
fois pour toutes et les trottoirs rangés dans une grille de 16 m : **8,57 s**, soit moins
qu'avant les travaux.

## 9. Les deux captures du cas flagrant

`verification/b3-trottoir-avant.png` et `b3-trottoir-apres.png`, même caméra, même graine 6174,
monde rebâti UNE SEULE FOIS avec la graine avant les prises. Le trottoir de **(−3,9 ; 9,9)**,
entre la Salle de sport et le Snack :

| | avant | après |
|---|-------|-------|
| banc | (−4,00 ; 14,90), en travers | (−5,20 ; 13,70), rangé le long |
| **passage libre minimal** | **0,00 m** (en z = 14,6) | **1,05 m** (en z = 13,4) |

Sur la capture AVANT, le banc barre la totalité du trottoir devant la vitrine de la Salle de
sport : l'enfant doit descendre sur la chaussée pour continuer. Sur la capture APRÈS, il est
rangé le long de la terrasse et le trottoir passe.

## 10. Bancs

Lint **5 ✅**. `traffic.js` **14/14**, `vehicle-contact.js` **6/6**, `city-detail.js` **10/10**,
`strategy.js` 7/0, `empire.js` 15/0, `save-strategy.js` 4/0, `cosmetic-performance.js` vert.
Deux tests ajoutés à la fin de `harness/play.js` (les numéros bougent à chaque fusion, on ne les
écrit pas en dur) : « aucun mobilier urbain ne mord la chaussee, et le trottoir reste
marchable » et « les 30 entrees de la ville laissent passer l'enfant, mobilier compris ».

---

# ROUND 83 — ITEM 4 : LE CHANTIER DE VOIRIE (les trottoirs qui mènent dans un mur)

`trottoirs()` posait une bande de **1,80 m le long de CHAQUE rue**, coupée uniquement par les
**autres rues**. Elle ne regardait ni les murs, ni les clôtures, ni les piliers de portail. Un
trottoir à 0,00 m de large n'est pas un détail : **il jette l'enfant sur la chaussée**.

## 1. Le classement, chiffré (graine 6174 ; les 5 graines donnent 44 à 45)

**45 trottoirs sur 311** laissent moins que le gabarit du joueur (`2 × P.hw` = **0,80 m**).

| ce qui ferme | nombre |
|--------------|--------|
| clôture (8 m et plus, fine) | **14** |
| autre (dalles, estrades, jardinières) | **12** |
| mur de bâtiment | **11** |
| pilier de portail (0,80 × 3,60 m) | **4** |
| bâti divers | 1 |
| mobilier | 3 |

### La question qui décide de tout

**Le trottoir est-il mal posé, ou le bâtiment ?** Critère mesuré : l'obstacle mord-il AUSSI la
chaussée ? Réponse : **40 des 45 ne la mordent pas**. Ils sont chez eux ; c'est la bande de pavé
qui a été tirée par-dessus eux. Les 5 autres sont des dalles basses et des jardinières
(h = 0,12 à 1,50 m), pas des bâtiments. **Aucune architecture n'est à déplacer.**

### Le chiffre qui résume le mensonge

| | avant |
|---|-------|
| surface pavée totale | 17 121 m² |
| **surface pavée là où l'enfant ne peut pas passer** | **336 m² (1,96 %)** |
| **longueur de trottoir menteur** | **186,8 m** |

## 2. La réparation : `recoupeLesTrottoirs()`

Une passe appelée **avant** le rangement du mobilier (celui-ci doit garantir ses 0,90 m sur le
trottoir RÉEL, pas sur celui d'avant). Elle échantillonne chaque bande tous les 25 cm, calcule
le plus large intervalle libre en travers, et :

- **(a) elle RÉTRÉCIT et DÉCALE** le pavé là où il reste au moins **0,90 m** (`TROTTOIR_MIN`
  = 0,80 m de gabarit + 5 cm de jeu de chaque côté) — **45 tronçons** ;
- **(b) elle INTERROMPT** le pavé, **bordure comprise**, là où il ne passe pas — **32 coupés**,
  **1 retiré** en entier. La bordure s'arrête avec la dalle : l'interruption se VOIT, au lieu du
  ruban de 8 cm qui ressemblait à un passage ;
- **(c) elle ne déplace AUCUN mur.** À la place, là où l'obstacle n'est pas un mur mais une
  **estrade** dont le dessus est à 0,60–1,05 m (10 à 40 cm au-dessus du pas de l'enfant,
  `STEP_UP` = 0,60 m), elle **pose une marche de chaque côté** : l'enfant monte en deux fois.
  **15 marches**, hautes de 0,30 à 0,56 m, jamais à moins de 70 cm d'une rive.

233 trottoirs sont gardés intacts. Total : **311 → 377 tronçons**.

## 3. Les mesures APRÈS

| mesure | avant | après |
|--------|-------|-------|
| trottoirs sous 0,80 m | **45 / 311** | **0 / 377** |
| trottoir le plus étroit posé | 0,00 m | **0,90 m** (jamais moins, par construction) |
| **surface pavée où l'enfant ne passe pas** | **336 m²** | **16 m² (−95 %)** |
| **longueur de trottoir menteur** | **186,8 m** | **11,8 m** |
| surface pavée totale | 17 121 m² | 15 631 m² (−1 490 m² de pavé mensonger) |
| trottoirs fermés par un MEUBLE | 3 | **0** |

## 4. Les 97 passages fermés recensés (`city.recoupe.fermes`)

| ce qu'il faudrait enjamber | nombre | ce qu'on a fait |
|----------------------------|--------|-----------------|
| **mur** (dessus > 1,05 m) | **75** | on ne le déplace pas — voir §6 |
| **pincement** (rien de haut sur l'axe, deux objets qui serrent des deux bords) | 14 | le pavé s'interrompt |
| **estrade** (dessus 0,60 à 1,05 m) | 8 | **15 marches posées** |

Les trois plus longs : **40,5 m** en (39,9 ; 288,4) — la terrasse du parc nord, ceinte d'une
clôture de **2,45 m** ; **26,2 m** en (−177,1 ; −160,4), un bloc de 1,50 m ; **17,0 m** en
(114,4 ; −160,4), une rangée de jardinières de 0,80 m (celle-là a ses marches).

## 5. La preuve par le jeu, et ce qu'elle dit vraiment

L'enfant **suit le pavé** (à chaque image il vise le centre du trottoir 3 m devant lui, comme un
joueur qui longe le trottoir), 900 pas de simulation à 1/60 s, sur les cinq pires :

| site (longueur à parcourir) | avance AVANT | images sur la chaussée | avance APRÈS | images sur la chaussée |
|---|---|---|---|---|
| promenade du parc nord (58,7 ; 288,4) — 75,7 m | 18,70 m | 0 | 18,70 m | 0 |
| **rue du hameau (−150,4 ; 295,2) — 51,7 m** | **1,02 m** | 0 | **8,10 m** | 0 |
| traverse de La Zone (−150 ; −160,4) — 57,2 m | 1,20 m | 0 | 1,20 m | 0 |
| rue de l'ouest (−178,3 ; 5,9) — 13,6 m | 7,67 m | 0 | 7,67 m | 0 |
| desserte du concessionnaire (−107,4 ; 16) — 21 m | 1,13 m | 0 | 1,13 m | 0 |

**Et je dis ce que ça veut dire, sans l'arranger.** Sur quatre de ces cinq sites, la recoupe
**n'ouvre pas le passage** : le pincement y descend sous 0,80 m, il n'existe aucune bande de
0,90 m à cet endroit, et c'est un **mur** (2,45 m, 1,50 m…) qui barre. Le gain y est ailleurs :
le pavé ne ment plus, il s'arrête — bordure comprise — avant le mur. Un seul des cinq, la rue du
hameau, s'ouvre vraiment grâce à deux marches : **1,02 → 8,10 m**.

**Le chiffre « images sur la chaussée » vaut 0 partout, avant comme après** : dans cette mesure
l'enfant qui suit le pavé ne descend pas sur la route, **il s'arrête net contre le mur**. Un
enfant réel contournerait, et c'est là qu'il passerait sur la chaussée — mais ce n'est pas ce
que mesure ce banc, et je ne vais pas prétendre le contraire.

## 6. LES 10 CM DE MARGE — mesurés, pas invoqués

| | avant | après |
|---|-------|-------|
| chaussées | 91 | **91** |
| largeurs (m : nombre) | 5:1 · 6:4 · 7:5 · 8:19 · 9:18 · 11:32 · 13:12 | **identiques** |
| bâtiments / intérieurs | 44 / 24 | **44 / 24** |
| **pire chevauchement bâti ↔ chaussée** | **+0,300 m** (boutique 7,6 × 7,6 en (−18 ; 19,5) contre la rue (0 ; 26)) | **+0,300 m**, le même |

**Zéro centimètre pris à qui que ce soit.** Cet item n'a déplacé aucun mur, aucun bâtiment,
aucune dalle, aucune chaussée : il a seulement RETIRÉ du pavé et AJOUTÉ 15 marches. Le mandat sur
« le mur d'en face » n'a pas été utilisé, et je recommande de ne pas l'utiliser : les 75 murs
recensés au §4 coûteraient chacun un déplacement horizontal, donc de la marge, pour un gain que
la mesure du §5 ne garantit pas.

## 7. Un défaut du banc corrigé au passage

`harness/stubs.js` : le jeu écrit `$('stBar').parentNode.classList` dès que l'enfant se met à
courir, et le stub rendait des éléments **sans parent** — le banc Node mourait sur
« Cannot read properties of null ». Chaque élément créé par `getElementById` a maintenant un
parent, comme dans un vrai document. Sans cela, **aucune** preuve par la marche n'était possible.

## 8. Bancs

Lint **5 ✅**. `traffic.js` **14/14**, `vehicle-contact.js` **6/6**, `city-detail.js` **10/10**,
`strategy.js` 7/0, `empire.js` 15/0, `save-strategy.js` 4/0, `cosmetic-performance.js` vert.
Un test ajouté à la fin de `harness/play.js` (sans numéro en dur) : « aucun trottoir ne mene
dans un mur : le pave s'arrete la ou le passage s'arrete ».
