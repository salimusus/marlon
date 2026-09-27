# MARLON — état mesuré de la livraison (round 83)

Ce document dit ce qui a été **mesuré**, pas ce qui a été espéré. Chaque ligne porte
son chiffre. Ce qui reste ouvert est écrit noir sur blanc à la fin.

Commit de référence : la pointe de `claude/bonjou-igzkfi`, qui est **la branche par
défaut du dépôt** — le site publié se sert donc directement des pousses, il n'y a rien
à fusionner ailleurs.

## Comment jouer

Avec Node.js 18 ou plus : `npm start`, puis ouvrir `http://127.0.0.1:8080`. Aucune
dépendance à télécharger. Garder ensemble `index.html`, `city-detail.js`,
`cinematic.js`, `controls.js`, `cinematic.css` et `vendor/`. Le solo tourne en local ;
le multijoueur et le téléphone-manette demandent le réseau.

`sunshine.html` est une autre version historique du projet et n'est pas concernée.

## Ce que le round 83 a réparé, avec les mesures

### La chute mentait, et ne tuait jamais

La vitesse de descente est bornée à −30 m/s, et la hauteur annoncée **comme les
dégâts** en étaient déduits. Donc toute chute de plus de 15 m annonçait
« Chute de 15 m · −72 PV » et laissait 28 points de vie — **même à 60 m**.

La hauteur est maintenant *mesurée* (point le plus haut atteint moins altitude
d'impact), à 0 % d'écart sur onze hauteurs vérifiées. La mort est à **18 m**, une
valeur choisie pour reproduire l'ancienne courbe là où elle était juste :

| hauteur | 8 m | 10 m | 12 m | 15 m | 20 m et plus |
|---|---|---|---|---|---|
| avant | 7 PV | 28 PV | 47 PV | 72 PV | 72 PV (on survit) |
| maintenant | 5 PV | 24 PV | 43 PV | 71 PV | **mortel** |

Le parcours d'accrobranche culmine à 6,80 m et le plongeoir à 6,20 m : les deux
endroits où l'enfant tombe vraiment, souvent, restent gratuits.

### La caméra ne montrait plus l'enfant

| lieu | perche avant | après |
|---|---|---|
| cabane perchée | 1,27 à 1,62 m — l'enfant voyait son propre dos | **4,87 m** |
| les trois plateformes du parcours | 1,80 m | **9,10 m** |
| les trois passerelles | 4,48 à 5,62 m | **9,10 m** |

Deux causes, trouvées rayon par rayon : un toit décoratif classé parmi les
couvertures, qui écrasait la visée à 0,04 rad, et **les quatre troncs de 84 cm** aux
coins du plancher — l'axe du cône de caméra était dégagé à 11 m, ce sont les rayons
de côté qui fermaient tout.

En prime, un défaut que personne n'avait vu : **« un plafond bas n'interdit que de
monter » écrasait la visée et rien ne la relevait jamais.** Seul le stick droit de
l'enfant pouvait réparer le jeu. Elle remonte maintenant toute seule.

Sept lieux témoins vérifiés identiques au centimètre avant et après : rue dégagée
9,10 m, petite boutique 4,90 m, salle de classe 5,26 m, petit appartement 5,23 m,
étage de la banque 7,54 m, passerelle 9,10 m, plancher de tour 1,80 m.

### L'ascenseur se dérobait sous son passager

Il descendait à **28,3 m/s** (0,47 m dès la première image sur une course de
12,85 m) : son plancher fuyait et le passager se retrouvait **jusqu'à 5,108 m
au-dessus, dans la cage**. Prendre l'ascenseur coûtait −36 PV.

Vitesse plafonnée à 4 m/s (celle d'un ascenseur de gratte-ciel réel) **et** la cabine
emmène son passager comme une plate-forme mobile — le plafond seul ne suffisait pas :
il laissait 23,3 cm d'écart, et tenir 5 cm par la seule vitesse aurait coûté 7,27 s de
trajet au lieu de 2,48. Résultat : **écart zéro**, montée comme descente, pour
**+1,89 s** sur la plus longue course du jeu.

### La ville

| défaut | avant | après |
|---|---|---|
| palmiers plantés dans une voie de 5 m | troncs sur la chaussée, et 6 palmes en l'air à 5,10 m | **0**, et la ville a verdi (198 → 209 arbres) |
| mobilier bloquant (chaussée, porte, trottoir) | **245 meubles en faute sur 874** | 245 rangés, **0 supprimé** |
| solides de meuble détruits à chaque chargement | 24 (dont les 4 pieds d'un abribus) | **0** |
| rue de 8 m fermée par deux voitures en vis-à-vis | 2,60 m libres, **5 véhicules de service bloqués** | 3,80 m, **les 5 traversent** |
| trottoirs menant dans un mur | un à **0,00 m de large** | jamais sous 0,90 m, ou interrompu proprement |

Aucune rue élargie, aucun mur, aucun bâtiment déplacé : la marge la plus serrée de la
ville est inchangée.

### Le son

| défaut | avant | après |
|---|---|---|
| sources du monde hors du registre | **54**, à plein volume quelle que soit la distance | **0** |
| `ambiance.stop()` | 11,6 % de rumeur encore là à 900 ms | **−39 dB dès 110 ms** |
| purge des sources | 16 sources mortes tenant les 16 places du budget après 600 s | **0** |

Le grattement d'une poêle s'entendait d'un bout à l'autre de la ville ; le rotor du
drone se fabriquait son volume à la main ; la pluie de pièces d'un coffre tenait neuf
sources à elle seule.

### Une classe entière de défauts : les dates absolues

`horlogeArriere()` existe pour remettre d'aplomb les minuteries écrites « maintenant +
tant de secondes » **quand l'horloge de simulation recule** — et elle recule pour de
vrai : le jeu la rembobine dès qu'il la surprend cassée, ce qu'une synchro réseau
suffit à provoquer. Elle traitait **7 dates sur les 206** du jeu.

Conséquences, toutes des défauts connus du carnet :

- l'enfant **déclaré provocateur** et battu par des habitants ordinaires (défaut 84,
  deux fois qualifié de bloquant) ;
- `P.stunT` resté dans l'avenir : **l'enfant ne peut plus bouger**, et rien ne le lui
  dit ;
- il reste à terre, il dort, il est **prisonnier de la balançoire** (défaut 87) ;
- et une exception trouvée en chemin : une horloge cassée **mettait le feu à un
  immeuble**.

### Trois échecs de longue date, tranchés

Les tests 181, 267 et 470 échouaient depuis plusieurs rounds. Ce n'étaient pas des
défauts du jeu mais des défauts de mesure, chacun établi par un chiffre :

- **470** : l'état du joueur mentait (la date absolue ci-dessus). Instrumentation de
  chaque écriture sur 14 400 pas : **un seul écrivain dans tout le fichier**, la garde
  elle-même. Il n'y avait aucun chemin caché.
- **267** : le test mesurait **le compresseur**, pas la distance. Sa note entrait dans
  la chaîne dix décibels au-dessus du seuil ; selon que l'analyseur attrapait les 4 ms
  d'attaque il lisait 0,563 ou 0,267. Les mesures à 20 m et 45 m, elles, étaient
  identiques au dix-millième d'un lancement à l'autre. Le test est maintenant **plus
  strict** : marge passée de 1,37 à 4,03.
- **181** : la mesure était un tirage au sort (boutique tirée sans graine figée,
  relevé à la 60ᵉ seconde d'une mission qui dure 28 s), et le test précédent laissait
  l'enfant à 37 PV — il mourait et le jeu le téléportait à l'hôpital, 197 m plus loin.

## Le banc d'essai

**526 tests** joués dans un vrai navigateur, plus douze bancs Node et cinq
vérifications de lint. Les douze bancs : `traffic` 14/14, `vehicle-contact` 6/6,
`strategy` 7/0, `gamepad` 23/23, `controls-tv` 16/16, `cinematic` 15, `city-detail`
10/10, `empire` 15/0, `save-strategy` 4/0, `cosmetic-performance`, `garage` (8 accès
libres), `verify`.

## Ce qui reste ouvert

- **~83 appels sonores directs** subsistent : ce sont des notifications émises à la
  position du joueur, où le registre n'apporterait rien (atténuation 1, panoramique 0).
  Non convertis volontairement.
- **37 à 38 trottoirs** restent sous 0,80 m à cause de **murs, clôtures et piliers de
  portail** — pas de mobilier. Le pavé est désormais rétréci ou interrompu là où il
  mentait, mais déplacer ces murs serait un chantier d'architecture.
- **`harness/audit.js` n'est pas semé** : deux lancements donnent des résultats
  différents, une comparaison avant/après y est sans valeur. À savoir avant de s'en
  servir.
- **L'export de `harness/run.js` est un littéral de gabarit** : un seul accent grave
  dans un commentaire le coupe en deux et fait mourir les deux côtés d'une comparaison
  — ce qui rend un diff vide, qui se lit comme une réussite.
