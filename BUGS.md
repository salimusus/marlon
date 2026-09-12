# BUGS.md — ce que voit un enfant qui joue à SuperObby (round 70, agent Joueur)

Méthode : manette PS5 simulée, images simulées (`__G.step(1/60, true)` + `pollGamepad` + `updateBot`),
captures regardées une à une, en 1280×720 (PC) et en 1920×1080 mode TV. Outils dans
`scratchpad/joueur/` (`joueur.js` pilote, `aide.js` manette simulée, `sN.js` scénarios, `img/sN/` captures).
Rien n'a été corrigé dans `index.html`. Liste classée par gravité, numérotée dans l'ordre de découverte (le n° 1 a été retiré : fausse alerte, le personnage est bien vu de dos au départ — le nom et le numéro sont dans le dos du maillot).

Gravités : BLOQUANT (on ne peut plus jouer) · GRAVE (une fonction promise ne marche pas) ·
GÊNANT (ça se voit, ça agace) · COSMÉTIQUE.

---

## BLOQUANT

### 37. Au garage, « Valider » plante le jeu : l'argent est pris, la voiture reste comme avant
✅ RÉPARÉ — `tuneCible()` prenait le véhicule le plus proche de `city.cars` quel qu'il soit (la dépanneuse garée devant le garage, n° 38) et `tuneApply` lisait `c.parts.ws` que seules les voitures de `makeCar` ont ; seule une voiture préparable est ciblée (`tunable()`), `tuneApply` tolère un véhicule sans vitres, et l'argent n'est pris qu'APRÈS l'application réussie — commit abe9583
- **Gravité** : BLOQUANT (le garage — repeindre, monter un kit — ne marche pas du tout)
- **Reproduire** : voiture du parking, la garer devant le garage custom (−45, 90), △ au comptoir (−53,5, 96,6), onglet 🎨 Peinture : choisir une finition (fluo), onglet 🧰 Kits : choisir « Jupes latérales », « Valider ».
- **On voit** : le chat écrit « ⚠️ Bug détecté : Uncaught TypeError: Cannot read properties of undefined (reading 'ws') at tuneApply », message « ⚠️ Un bug a été détecté (voir le chat), le jeu continue » ; le portefeuille passe de 400 à **190** (210 🪙 payés) ; la voiture reste rouge (#ff5c5c), sans jupes ; la fenêtre de l'atelier reste ouverte.
- **On devrait voir** : la voiture repeinte et équipée, et l'argent pris seulement si ça marche.
- **Capture** : `img/s5/s5-6-apres.png` (l'erreur dans le chat, 190 🪙), `img/s5/s5-7-ressort.png` (voiture toujours rouge).
- **Sonde** : `s5-pc.log` : `valide.wallet 400 → 190`, `remonte.couleur = 16735324` (inchangée), `tuning = {finition: "fluo", kits: ["jupes"]}` mais `PAGEERROR: Cannot read properties of undefined (reading 'ws')` (index.html l. 24745, `tuneApply` lit `c.parts.ws` alors que la cible choisie par `tuneCible()` — « Voiture garée à 9 m » — n'a pas de `parts`).

## GRAVE

### 2. Le message de bienvenue d'une partie NEUVE est « 💾 Partie rechargée : 25 🪙 »
✅ RÉPARÉ — `wallet` vaut 25 par défaut sans clé enregistrée et `rechargeTout()` prenait cette valeur pour une sauvegarde ; on ne dit « rechargée » que si `superobby.wallet` existe, sinon « 👋 Bienvenue en ville ! stick gauche pour marcher · △ agir · ◯ sauter » (vocabulaire de la commande) — commit 3fe8d47
- **Gravité** : GRAVE (première minute — premier message faux)
- **Reproduire** : profil vierge (navigateur neuf), accueil → Jouer → Ville.
- **On voit** : en très gros au centre « 💾 Partie rechargée : 25 🪙 », puis rien qui dise quoi faire. Le message revient à CHAQUE changement de monde, et le montant est faux : en entrant dans la Prairie avec 620 🪙 il affiche encore « 25 » (`img/s15/s15-0-prairie.png`). Le vrai « 🏙️ Bienvenue en ville ! Foot, tennis… » n'apparaît que dans le chat, en petit.
- **On devrait voir** : un accueil (« Bienvenue en ville ! △ pour agir, stick pour marcher… »), et « Partie rechargée » seulement quand il y a vraiment une sauvegarde.
- **Capture** : `img/s1/s1-premier-regard.png`, `img/s1/s1-premier-regard-tv.png`.

### 3. Dès la première seconde, la pastille du haut dit « 🚩 Il te faut un membre de ton gang avec toi »
✅ RÉPARÉ — `captureTick()` écrivait le conseil dès qu'on se tenait dans un quartier tenu par un gang, toutes les 6 s, sans jamais rendre la pastille ; il n'apparaît plus qu'à un joueur entré dans la guerre (écran 🚩 ouvert, respect > 0 ou recrue) et `updateAct()` reprend la main en sortant du quartier — commit a36c5da
- **Gravité** : GRAVE (incompréhensible pour un enfant qui vient d'arriver ; ça reste affiché en permanence)
- **Reproduire** : entrer dans la Ville, attendre 2 s sans rien faire, au point d'apparition (0, 3.5).
- **On voit** : `#act` = « 🚩 Il te faut un membre de ton gang avec toi » (tronqué « 🚩 Il te faut un ... » en 1280) et ça reste pendant les 12 s observées.
- **On devrait voir** : rien de la guerre des gangs tant que l'enfant n'a pas ouvert l'écran 🚩 ; la pastille d'action doit dire l'action possible ici (« △ parler », « △ monter »).
- **Capture** : `img/s1/s1-apres-12s.png`, `img/s1/s1-premier-regard-tv.png`.
- **Sonde** : `J.hud().act` = « 🚩 Il te faut un membre de ton gang avec toi » à t+2 s, zone = null.

### 14. On sort de la ville à pied et on TOMBE DANS LE VIDE (mort, 💀 +1)
✅ RÉPARÉ — le mur invisible d'enceinte était posé 1,5 m DEHORS du plateau (fossé d'un mètre sans sol) et haut de 4 m seulement depuis y = 0 : on tombait dans le fossé puis SOUS le mur ; il colle maintenant au bord et descend sous le plateau, et une haie visible fait le tour de la ville — commit 8d14cd1
- **Gravité** : GRAVE (première marche libre : l'enfant meurt sans comprendre)
- **Reproduire** : Ville, point d'apparition, stick avant 4 s (on part vers le nord), stick gauche 2 s, avant 6 s, droite 2 s, avant ~30 s (direction nord-ouest, vers (-84, -157) puis (-102, -222)).
- **On voit** : d'abord un dallage blanc infini sans rien dessus (`s2-course.png`, position (-55, -124)), puis le personnage tombe sous le sol (`P.pos.y = -100`), message « Oups ! », compteur 💀 passe à 1 et on réapparaît au centre.
- **On devrait voir** : une limite de ville visible (barrière, mer, colline) qu'on ne peut pas franchir, et jamais de chute mortelle en marchant tout droit.
- **Capture** : `scratchpad/joueur/img/s2/s2-course.png` (le désert de dalles), `img/s2/s2-fin.png` (retour au centre, 💀 1).
- **Sonde** : trace `avant10s-apres-cam` : x −102, y **−100,25**, z −222 ; `hud.msg = "Oups !"`.

### 21. Le commissariat n'a pas d'intérieur : pas de plafond, façade vue de l'intérieur, caméra dehors
✅ RÉPARÉ (en partie) — la façade vitrée couvrait les six faces des murs de coque (`coque()`), d'où « façade vue de l'intérieur » : la face intérieure est maintenant peinte (tous les halls `building()`) ; un agent d'accueil en uniforme se tient derrière le guichet PLAINTES (`police.accueil`). Le plafond effacé et la caméra qui sort en fondant le mur sont la « maison de poupée » voulue au round précédent (poste URGENCE) : on ne la défait pas — commit 86b5118
- **Gravité** : GRAVE (bâtiment promis « visitable » : commissariat, prison, guichet des plaintes)
- **Reproduire** : Ville, se placer en (−54, 40) face au nord, stick avant 7 s : on entre par la porte sud du commissariat (−54, 28) ; puis stick droit vers la gauche 0,8 s.
- **On voit** : à l'intérieur, les murs montrent les fenêtres bleues de la FAÇADE extérieure, au-dessus un bloc de toit sombre qui flotte avec le ciel autour ; le guichet « PLAINTES » est vide alors que « L'agent d'accueil : Bonjour, que puis-je pour vous ? » s'écrit dans le chat ; en tournant la caméra on se retrouve DEHORS, à regarder le dos du panneau « AVIS DE RECHERCHE », personnage invisible.
- **On devrait voir** : une pièce fermée (plafond, murs intérieurs), un agent derrière le guichet, une caméra qui reste dedans.
- **Capture** : `img/s3/s3-commissariat-2-dedans.png`, `img/s3/s3-commissariat-3-regard.png`.
- **Sonde** : `cam.interieur = true` mais rien ne bloque la caméra (`cam.dist` 5,0 → 6,8 en tournant).

### 22. Dans les bâtiments, le stick droit envoie la caméra à travers les murs et les meubles
✅ RÉPARÉ — cause mesurée à l'école : la caméra traversait une cloison de classe (0,3×4,2×9 m) en restant DANS l'enceinte, et l'effacement n'était tenté que caméra dehors (`dehors &&` dans `interieurTick`) ; toute paroi traversée s'efface maintenant. L'hôpital n'était enregistré dans aucune liste d'intérieurs (pas de maison de poupée) : ajouté. Mesure après : 0 angle bouché sur 8 dans les 4 bâtiments. Le reste (« personnage invisible » sur tes captures) tient à ton pilote : `interieurTick`/`camPerche`/le fondu vivent dans `frame()` — commit 86b5118
- **Gravité** : GRAVE (dès qu'un enfant regarde autour de lui dedans, il ne voit plus son personnage)
- **Reproduire** : entrer dans l'école (classe (−69, 213)), la banque (guichet (−57, 70)), l'hôpital (hall (14, 212)) ou le concessionnaire (comptoir (−140, 93)), puis pousser le stick droit à gauche 0,8 s.
- **On voit** : école → la caméra est DEHORS, on voit la façade verte et le grillage, personnage invisible ; banque → caméra dans la vitre du guichet, étiquette « guichet » géante, tête du guichetier dans l'objectif ; hôpital → caméra DANS le bureau d'accueil (une planche brune barre l'écran) ; concessionnaire → caméra dans le bras du personnage (aplat couleur peau plein écran).
- **On devrait voir** : la caméra qui s'arrête au mur et se rapproche du personnage, jamais dans un meuble ni dehors.
- **Capture** : `img/s3/s3-ecole-3-regard.png`, `img/s3/s3-banque-3-regard.png`, `img/s3/s3-hopital-3-regard.png`, `img/s3/s3-concessionnaire-3-regard.png`.
- **Sonde** : hôpital `cam.interieur = false` alors que le joueur est en (14, 212) au milieu du hall (l'hôpital n'est pas dans `city.interieurs`).

### 26. Les voitures du parking du centre sont garées face à la terrasse du snack : R2 = on défonce les tables sans avancer
✅ RÉPARÉ — trois causes mesurées : les voitures étaient garées cap au sud (nez sur les bancs et la terrasse posés DANS le parking à z = 13,5), en deux rangées (la rangée du fond démarrait dans le coffre de l'autre : +15 % de dégâts), et la casse du mobilier par un véhicule testait un CARRÉ axé de demi-côté r + demi-longueur + 0,5 → en sortant on cassait le lampadaire à 2,1 m de côté (+9 %). Une rangée cap au nord, mobilier reculé, casse en boîte orientée — commit 65ab948
- **Gravité** : GRAVE (première voiture qu'un enfant prend : elle ne part pas et se casse)
- **Reproduire** : parking (−23…−3, 3…14), voiture en (−15, 11,5). △ pour monter, R2 à fond 5 s.
- **On voit** : la voiture reste sur place (vitesse 2,6 → −2 → 1 m/s, position inchangée), les dégâts montent 🔧 2 % → 10 % en 5 s ; en braquant elle GRIMPE sur la terrasse (`c.y` 0,15 → 0,66, roues 60 cm au-dessus du sol). Le parking est dessiné au milieu des tables et parasols du snack.
- **On devrait voir** : des places de parking dégagées, ouvertes sur la rue, et aucun dégât à 2 km/h.
- **Capture** : `img/s4/s4-0-pres.png` (table et tabourets contre la voiture), `img/s4/s4-2-roule.png`, `img/s4/s4-3-tourne.png`.
- **Sonde** : `s4-pc.log` pas `gaz+1s…+5s` : `dmg` 2,36 → 9,54, `spd` ≤ 2,6, `car.z` 11,5 → 11,53.

### 27. Écraser un piéton : aucune ambulance, et la police TIRE sur l'enfant
✅ RÉPARÉ — la police tirait dès `wanted >= 2` quel que soit le délit (écraser = gravité 2) : elle ne tire plus que pour un crime grave (`policeTire()` : KO/arme/braquage, riposte, alarme, armée) et « tirer sur quelqu'un » passe en gravité 3 ; l'ambulance n'était appelée qu'à ❤️ 0 (`ecraseAuSol`) : elle part aussi au-dessus de 8 m/s et le blessé reste à terre jusqu'au brancard — commit 0b83501
- **Gravité** : GRAVE (fonction promise : ambulance pour les blessés, police proportionnée)
- **Reproduire** : rouler à 50 km/h dans la foule du point d'apparition (0, 3).
- **On voit** : « 🚔 Infraction : écraser Tom_le_ouf ! Niveau ★★★ », deux bots KO (hp 56), aucune ambulance ne part (`city.ambulances[*].etat = null` après 6 s), les bots écrasés se relèvent et disent « plus jamais ça » ; 40 s plus tard « Recherché ★★ · ils tirent ! ». Puis arrestation → écran Prison.
- **On devrait voir** : ambulance + brancard pour le blessé (promis au poste B/E), une police qui arrête sans tirer pour un accident.
- **Capture** : `img/s4/s4-6-mur.png` (★★★, « la police arrive dans 20 s »), `img/s4/s4-8-voiture.png` (« ils tirent ! »).

### 28. La circulation est quasi vide et roule HORS de la ville
✅ RÉPARÉ (nombre) / ❌ PAS UN BUG (hors chaussée) — huit véhicules au lieu de cinq ; mesuré sur 90 s puis 40 s : 0–1 % du temps hors des rectangles de `city.routes`, ta voiture de (−70,−104) devait être poussée par un accident ou une poursuite — commit 0affff2
- **Gravité** : GRAVE (le joueur a demandé une vraie circulation ; « conducteurs hors chaussée » déjà relevé au round 67, toujours là)
- **Reproduire** : prendre une voiture, chercher la voiture de circulation la plus proche (`city.aiCars`).
- **On voit** : 5 voitures de circulation pour toute la ville, la plus proche à 147 m ; celle-là roule sur le dallage blanc à l'extérieur de la ville, en (−75, −105), au nord du Rallye, là où il n'y a aucune route.
- **On devrait voir** : des voitures sur les avenues du centre, jamais hors de la chaussée.
- **Capture** : `img/s4/s4-8-voiture.png` (le dallage blanc, notre voiture et la police, débris de l'autre voiture).
- **Sonde** : `autre.d = 147.74` ; position (−69,9, −104,4) hors de tout `city.routes`.

### 35. Après un accident, la police et la dépanneuse « arrivent » mais ne viennent JAMAIS ; l'amende prend tout l'argent de l'enfant
✅ RÉPARÉ (amende) / ⏸ TROP GROS (trajet) — l'amende prenait tout (`min(wallet, amende)`) : au plus la moitié du porte-monnaie (25 → 13). Mesuré avec la vraie boucle : la police ARRIVE (constat à 40 s) mais par un détour de ~250 m pour 117 m à vol d'oiseau (graphe de voies du poste D : (−43,12)→(−41,48)→(−77,7)→(−88,−95)→(28,−98)) ; la dépanneuse est appelée par la police au constat et porte `mission`, pas `etat` (ta sonde lisait le mauvais champ). Raccourcir l'itinéraire = refonte du graphe de voies, je laisse au chef — commit 0affff2
- **Gravité** : GRAVE (fonction promise au round 67 : accidents, constat, dépanneuse)
- **Reproduire** : voiture du parking, se poser en (30,6, −63) cap nord, R2 : on tape le camion garé du Parking du Sud (30,6, −85) à 62 km/h.
- **On voit** : « 💥 ACCIDENT ! Les deux véhicules sont immobilisés — la police arrive » ; pendant 25 s rien ne vient : la voiture de police reste à 160 m (`pc.constat = true` à 164 m, `debarque = false`), la dépanneuse annoncée « 🚚 Une dépanneuse a été appelée (service payant) » garde `etat = null` et ne bouge pas de 54 m ; puis « 🚓 Constat : 25 🪙 d'amende — payé » : le portefeuille passe de 25 à **0**. La voiture reste bloquée 30 s, même si on la déplace (l'état `accidente` la suit jusqu'au milieu de la pelouse du Parc).
- **On devrait voir** : la voiture de police qui arrive sur place, l'agent qui descend, la dépanneuse qui vient, une amende plafonnée (jamais tout l'argent d'un enfant de 25 🪙).
- **Capture** : `img/s4b/s4b-2-choc-camion.png` (le choc), `img/s4b/s4b-6-accident15s.png`, `img/s4b/s4b-7-accident40s.png` (voiture bloquée dans le Parc, personne ne vient).
- **Sonde** : `s4b-pc.log` `suivi` t = 5…25 s : `pol[0].d` 164 → 158 m, `dep[0].etat = null`, `wallet` 25 → 0.

### 36. Un choc frontal à 62 km/h contre un camion = 3 % de dégâts, aucune secousse, aucune marque
✅ RÉPARÉ — dans `resolveVehicleOverlap`, un choc contre un autre véhicule ne comptait que le frottement (`min(5, imp × 0,15)`) et `chocVehicule()` (capot, phares, pare-brise, marque) n'était appelé que contre un MUR ; au-delà de 7 m/s : dégâts francs aux deux (+24 % / +20 % mesurés à 19 m/s), stade 3, capot −0,55 rad, secousse 0,39, `cam.kick` — commit edf2a72
- **Gravité** : GRAVE (promis : chocs BOOM, dégâts par paliers, marques d'impact)
- **Reproduire** : idem n° 35.
- **On voit** : `dmg` 0 → 2,97, `cam.kick = 0`, `city.marques.length = 0`, aucun bruit noté, la voiture s'arrête net sans rebond ni fumée.
- **On devrait voir** : capot froissé, pare-brise étoilé, secousse de caméra, klaxon/BOOM, marques sur le camion.
- **Capture** : `img/s4b/s4b-2-choc-camion.png`.

### 41. Se battre à mains nues est impossible : l'habitant s'enfuit au premier coup, les suivants frappent le vide
✅ RÉPARÉ — `attack()` tirait « fuite » à 45 % et le fuyard détalait à 5,5 m/s jusqu'à la fin du combat (8 s), puis récupérait 20 ❤️ ; 32 % reculent encore mais reviennent se battre après 3 s (`b.fuiteFin`). Mesuré : fuite tirée au sort → KO en 9 coups (86 72 46 46 32 18 6 6 0) — commit 0affff2
- **Gravité** : GRAVE (fonction promise : direct / crochet / uppercut, KO en six coups, ralenti du coup final)
- **Reproduire** : point d'apparition, s'approcher d'un habitant (Tom_le_ouf) à 1,1 m, ▢ ×3 puis ▢ tenu.
- **On voit** : 1er ▢ = direct, il touche (100 → 86 PV) ; le bot part aussitôt en courant (« laisse-moi ! police !! au secours ! ») : à la 2e frappe il est à 8 m, à la 3e à 14 m, au coup de pied à 20 m, et 16 coups plus tard à 55 m avec **100 PV** (il a tout récupéré). Jamais de KO, donc jamais le ralenti du coup final (`RALENTI.t = 0`), jamais de crochet ni d'uppercut qui touche. Le personnage ne suit pas sa cible (« pas d'attaque » de 16 cm seulement).
- **On devrait voir** : un adversaire qui rend les coups ou tient tête, un enchaînement direct → crochet → uppercut lisible, un KO en six coups, le ralenti.
- **Capture** : `img/s7/s7-1-direct.png` … `img/s7/s7-4-pied.png` (le bot de plus en plus loin), `img/s7/s7-7-ko.png` (pas de KO).
- **Sonde** : `s7-pc.log` `coups[*].d` : 3,41 → 9,33 → 15,11 → 25,01 ; `ko.hp = 100` après 16 coups.

### 42. Armes : ✕ puis L2 = arme RENGAINÉE, et R2 ne tire pas
✅ RÉPARÉ — `braquerVerrouille()` (L2) basculait l'arme comme ✕ : `if (P.drawn) drawWeapon(false)` ; arme sortie, L2 verrouille maintenant la cible la plus proche (« 🎯 Tom_le_ouf · 2 m »), R2 tire, seul ✕ range. Le « ciblesVerrouillables() = 0 » de ta sonde venait de l'arme rengainée par L2 — commit 0affff2
- **Gravité** : GRAVE (le plan de commandes annoncé — ✕ dégainer, L2 braquer, R2 tirer — ne marche pas dans cet ordre)
- **Reproduire** : acheter le pistolet, ✕ (dégainer : « 🔫 Pistolet 8/8 »), puis L2 (braquer), puis R2.
- **On voit** : L2 affiche « 🤚 Arme rangée dans l'étui » (les deux boutons BASCULENT l'arme : `braquerVerrouille()` rengaine si elle est déjà sortie), R2 ne tire pas (8/8, 0 tir), `ciblesVerrouillables() = 0` avec deux habitants à 10 m devant. Même chose avec le couteau : ✕ le sort, L2 le range, R2 ne plante rien.
- **On devrait voir** : ✕ sort l'arme, L2 verrouille la cible (l'arme reste sortie), R2 tire ; L2 relâché = on continue de viser ou on retourne en visée libre, jamais un rengainage silencieux.
- **Capture** : `img/s8/s8-4-braque.png` (après L2 : arme dans l'étui), `img/s8/s8-5-tire.png`.
- **Sonde** : `s8-pc.log` : `degaine.drawn = true` → `braque.msg = "🤚 Arme rangée dans l'étui"`, `tir.shots = 0`, `tir.ammo = 8`.

### 48. Le parachute ne s'ouvre pas : on marche jusqu'au bord du toit, on tombe 13 m et le jeu dit « Bien posé ! »
- **Gravité** : GRAVE (fonction promise : sauter en parachute)
- **Reproduire** : ascenseur du toit (30,9, 19,3) → toit (35,5, 16, y 13) ; △ sur le sac de parachute (38,5, 16) ; stick vers l'est jusqu'au bord, ◯.
- **On voit** : « 🪂 Parachute sur le dos : saute du toit ! » puis, une demi-seconde après avoir quitté le toit, le personnage est au sol (y 0) avec « 🪂 Bien posé ! La voile se replie toute seule » — la voile ne s'est jamais déployée (`P.voileVol = false`, `P.voileMesh = null`), pas de descente. Le deltaplane, lui, marche (vol plané à 14 m/s, −2,6 m/s).
- **On devrait voir** : la voile ronde qui s'ouvre et une descente lente.
- **Capture** : `img/s14/s14-parachute-1-vol.png`, `img/s14/s14-parachute-2-sol.png` (comparer `img/s14/s14-deltaplane-1-vol.png`).
- **Sonde** : `s14-pc.log` `parachute.vol[0] = {t: 0.5, y: 0, vol: false, mesh: false, msg: "Bien posé !"}`.

### 49. Le couteau ne frappe jamais à la manette, et L2 / ✕ se marchent dessus à chaque arme
- **Gravité** : GRAVE
- **Reproduire** : couteau équipé (croix →), à 1,5 m d'un habitant : L2 puis R2 ; ou ✕ puis L2 puis R2.
- **On voit** : « 🤚 Arme rangée dans l'étui », l'habitant garde ses PV (28 → 28 après 4 R2). Le couteau, une fois sélectionné avec l'arme sortie, se retrouve dans un état « sortie/rangée » inversé : chaque L2 bascule, et R2 ne plante que si l'état interne dit « sortie » — l'enfant ne peut pas le deviner.
- **On devrait voir** : L2 = viser (arme sortie quoi qu'il arrive), R2 = frapper.
- **Capture** : `img/s8b/s8b-4-couteau-braque.png`, `img/s8b/s8b-5-couteau-coup.png`.
- **Sonde** : `s8b-pc.log` `couteauL2.drawn = false`, `couteauCoup.touche = false`, `couteau3.hp = 28`.

### 50. Arme braquée, la croix → change d'ARME au lieu de changer de cible
- **Gravité** : GRAVE (le plan annoncé : flèches ← → = changer de cible quand on vise)
- **Reproduire** : pistolet, L2 tenu (🎯 Lucas_2014 · 10 m), deux autres habitants à 15 m, appuyer → puis → puis ←.
- **On voit** : la cible reste Lucas_2014 les trois fois, et le message passe à « 🔫 Couteau » : on a changé d'arme en pleine visée ; la pastille affiche ensuite « 🔪 Couteau de chasse 5/undefined ».
- **On devrait voir** : la cible qui passe à l'habitant suivant, l'arme inchangée ; jamais « undefined » à l'écran.
- **Sonde** : `s8b-pc.log` `cibles = {c0..c3: "Lucas_2014", msg: "🔫 Couteau"}`, `relache.act = "🔪 Couteau de chasse 5/undefined"`.

### 51. Réunion de chef de gang : à la manette, la bague est sur un bouton d'un AUTRE écran
- **Gravité** : GRAVE (à la manette, impossible de choisir Alliance / Tribut / Guerre)
- **Reproduire** : accepter le rendez-vous de Nina la Fouine (place du centre (0, 40)) ; la fenêtre « 🤝 Nina la Fouine » s'ouvre et met le jeu en pause.
- **On voit** : quatre gros boutons (Alliance 98 🪙, Tribut 108 🪙, Déclarer la guerre, Partir) mais `.focustv` est sur `guerreBack:Retour` (le bouton de l'écran 🚩 fermé) : ✕ ne valide rien de visible, ↓ ne bouge pas la bague.
- **On devrait voir** : la bague sur « Alliance », ↓ pour descendre, ✕ pour choisir.
- **Capture** : `img/s10/s10-7-reunion.png`.
- **Sonde** : `s10-pc.log` `reunionUI.focus = "guerreBack:Retour"`.

### 52. Les pompiers ne bougent pas : le feu brûle 2 minutes, le camion reste à la caserne
- **Gravité** : GRAVE (fonction promise : « appeler les pompiers sur un feu »)
- **Reproduire** : `declencheIncendie(0, 60)` (ou attendre le feu spontané « 🔥 AU FEU ! La caserne envoie le camion ») et regarder la caserne (−40, 122).
- **On voit** : les trois pompiers restent en état `route` à 84 m du feu sans avancer d'un centimètre (84,28 → 84,29 en **120 s**), le camion (`kind: pompier`) reste à 81 m ; le feu garde `force = 100`, `city.incendies = 2`. Et à 8 m du point d'allumage (0, 60) on ne voit AUCUNE flamme (le terrain de boules du Parc, rien d'autre).
- **On devrait voir** : le camion qui part, sirène, la lance à eau, le feu qui baisse.
- **Capture** : `img/s12/s12-8-pompiers-20s.png`, `img/s12/s12-9-pompiers-50s.png`, `img/s12/s12-10-feu-fin.png`.
- **Sonde** : `s12-pc.log` `pompiers[*]` : distance constante 84,28 / camion 81,13, `incendies 2` jusqu'au bout.

### 53. L'équipe municipale met plus de deux minutes à venir réparer un lampadaire cassé (1 m/s)
- **Gravité** : GRAVE (fonction promise : « regarder les employés réparer un lampadaire »)
- **Reproduire** : casser le lampadaire (45,5, 13,2) (`breakThing`), regarder les trois employés du dépôt (22…26, 125).
- **On voit** : ils passent en `route` mais avancent de 120 m à 80 m en 40 s (1 m/s à pied, aucun véhicule) ; aucun chantier ouvert (`city.chantiers = []`) ; le lampadaire n'est réparé qu'à 65 s (`retour`) — et pendant ce temps le message central n'a rien dit de la réparation.
- **On devrait voir** : le fourgon qui part avec l'équipe, un chantier balisé, une réparation en moins d'une minute.
- **Capture** : `img/s12/s12-4-reparation-30s.png`, `img/s12/s12-6-reparation-fin.png`.
- **Sonde** : `s12-pc.log` `reparation[*].etats` : « route@120 » → « route@80 » à 40 s.

### 54. (retiré — fausse alerte : le personnage était posé DEHORS, contre la vitre ; en entrant par la cour et en marchant jusqu'à la chaise, △ fait bien s'asseoir et la leçon s'ouvre — scénario 11b)

### 61. Quatre balles dans la rue commerçante : un lampadaire renversé, une voiture DÉTRUITE (en feu) — et zéro étoile, pas un policier
- **Gravité** : GRAVE (le scénario « déclencher la police, fuir, se cacher, se faire arrêter » est impossible : rien de ce que fait l'enfant ne déclenche la police, sauf écraser un piéton — cf. n° 27)
- **Reproduire** : rue des commerces (−13, 14), pistolet, L2 (la visée se verrouille sur le décor), R2 ×4.
- **On voit** : « 💥 Lampadaire renversé ! » ×3 puis « 💥 Véhicule détruit ! » : la voiture jaune garée devant le snack explose et brûle. `police.wanted = 0`, `police.avert = 0`, aucune voiture de patrouille n'approche pendant 30 s, aucun agent. Personne ne vient pendant les 90 s suivantes. La dépanneuse, elle, vient ramasser la carcasse (ça marche). Une vitrine ne peut pas être cassée par le joueur : `city.vitrines[*]` n'a aucun état (clés `x, z, tab, key, label, r`), 3 coups de poing + 4 balles n'y changent rien.
- **On devrait voir** : un tir en ville = recherché ★ (au moins un avertissement visible), une voiture détruite = ★★, vitrine brisée = ★ ; des policiers armés qui arrivent, une traque qui s'arrête quand on est caché.
- **Capture** : `img/s9b/s9b-1-vitrine-tiree.png` (voiture en feu, ⭐ 0), `img/s9b/s9b-3-police-15s.png`, `img/s9b/s9b-4-police-30s.png` (personne), `img/s9/s9-1-vitrine-frappee.png` (le joueur est ENTRÉ dans la vitrine en marchant).
- **Sonde** : `s9b-pc.log` `tirs[*].wanted = 0`, `venue[*].agents = 0`, `arrestation[*].wanted = 0` pendant 90 s.

## GÊNANT

### 4. Sur l'accueil à la manette, ✕ ne fait rien : il faut 9 appuis sur ↓ pour atteindre « Jouer »
✅ RÉPARÉ — l'accueil n'est pas ouvert par `openUI()` (qui pose la bague) : aucune bague, `navValide()` ne trouvait rien ; la bague se pose sur « Jouer » dès que la manette parle (`curseurAccueil`), ✕ sans bague choisit « Jouer » ; et la carte de 800 px se resserre sous 800 px de haut (mode d'emploi replié) : « Jouer » visible en 1280×720 sans défiler — commit 5eac31d
- **Gravité** : GÊNANT (la toute première action)
- **Reproduire** : page chargée, manette branchée, ✕ → rien (aucune bague de sélection). ↓ ×9 : pseudo, 5 couleurs, « Jupe », le champ CODE, puis « Jouer ».
- **On voit** : le bouton « Jouer » est sous le bord de l'écran en 1280×720 (la carte déborde), et aucun élément n'est sélectionné au départ.
- **On devrait voir** : « Jouer » sélectionné d'office (bague jaune) et ✕ qui lance ; « Jouer » visible sans faire défiler.
- **Capture** : `img/s1/s1-accueil.png` (pas de « Jouer » visible), `img/s1/s1-focus-jouer.png`.

### 5. La foule de 12 bots est plantée en plein milieu de la route, autour du point d'apparition
✅ RÉPARÉ — `loadWorld` appelait `resetBot()` (grille du départ d'obby x −5…5, z 0,5…7, sur la rue, attente 2 à 60 s) aussi pour la ville ; `placeBotsVille()` pose les douze sur les trottoirs à < 40 m, attente 0,5–4 s (mesuré : 12/12 sur trottoir, 11/12 en marche en 12 s) — commit f0ca7d7
- **Gravité** : GÊNANT
- **Reproduire** : entrer dans la Ville, regarder autour de soi.
- **On voit** : les 12 habitants debout sur la ligne jaune de la chaussée, immobiles pendant 12 s, deux d'entre eux collés dans la caméra (on voit leur dos en très gros au premier plan, cf. bas gauche des captures).
- **On devrait voir** : les habitants sur les trottoirs, en mouvement, pas un cercle figé autour du joueur.
- **Capture** : `img/s1/s1-premier-regard.png`, `img/s1/s1-apres-12s.png`.

### 6. Le tableau « Joueurs / Pts » (classement d'obby) est affiché dans la Ville, avec 12 zéros
✅ RÉPARÉ — `#lb` n'était jamais caché en ville ; `updateLeaderboard` pose `sansScore` (display none) quand le monde est libre et qu'on n'est pas en multijoueur — commit f0ca7d7
- **Gravité** : GÊNANT (en mode TV il couvre un quart de l'écran et cache les habitants)
- **Reproduire** : entrer dans la Ville.
- **On voit** : à droite, une colonne de 12 pseudos à 0 point. En 1920×1080 TV elle est énorme.
- **On devrait voir** : pas de classement en Ville (il n'y a pas de points), ou repliable.
- **Capture** : `img/s1/s1-premier-regard-tv.png`.

### 7. En mode TV avec une manette PS5 branchée, un bandeau permanent dit « 📺 Manette : ouvre 📺 et scanne le code »
✅ RÉPARÉ — `tvManettesMaj` ne regardait que les téléphones (`tv.conns`) ; avec une DualSense (`padActive()`) elle dit « 🎮 Manette PS5 connectée » et s'efface au bout de 5 s ; rappelée au branchement — commit f0ca7d7
- **Gravité** : GÊNANT
- **Reproduire** : accueil → « Jouer sur la télé » (ou `modeTV(true)`), manette PS5 connectée, entrer dans la Ville.
- **On voit** : bandeau en bas de l'écran, en permanence, qui invite à utiliser le téléphone comme manette alors qu'une DualSense est déjà reconnue (`body.manette`).
- **On devrait voir** : rien, ou « 🎮 Manette PS5 connectée ».
- **Capture** : `img/s1/s1-premier-regard-tv.png`, `img/s1/s1-aide-tv.png`.

### 8. Le pavé tactile affiche une aide illisible pour un enfant
- **Gravité** : GÊNANT
- **Reproduire** : en ville, appuyer sur le pavé tactile.
- **On voit** : en 1280×720, quatre lignes de texte minuscule (11 px) avec des parenthèses imbriquées « (arme équipée : 🎯 braquer / rengainer · volant : freiner · hélico : descendre) », par-dessus le chat et les bots ; en TV le texte est grand mais les parenthèses se cassent sur trois lignes et le bloc cache tout le centre de l'écran.
- **On devrait voir** : une fiche claire, une ligne par bouton avec son icône PS5, et le jeu en pause derrière.
- **Capture** : `img/s1/s1-aide.png`, `img/s1/s1-aide-tv.png`.

### 9. Les étiquettes de nom et les bulles se chevauchent et se coupent
- **Gravité** : GÊNANT
- **Reproduire** : point d'apparition, foule autour du joueur.
- **On voit** : « IneZoe_rider » (Ines_gg + Zoe_rider superposés), bulle « Joueur63 ! trop content de » coupée par le message central, bulle « la lave c chaud » de 40 px qui déborde sous le classement, la pastille de vie du joueur (haut droite, TV) posée SUR une bulle de dialogue, et les bulles passent DERRIÈRE la barre d'icônes du haut (« Joueur79 ! trop content de » sous 📣🚩📺, `img/s2/s2-depart-tv.png`) ; une bulle proche de la caméra devient géante et son texte déborde des deux côtés (« ai repéré un truc dans ce… », `img/s15/s15-4-recharge-ville.png`).
- **On devrait voir** : des étiquettes qui s'écartent ou s'estompent quand elles se recouvrent, une bulle jamais coupée.
- **Capture** : `img/s1/s1-premier-regard-tv.png`, `img/s1/s1-apres-12s.png`.

### 15. Les consignes affichées parlent des touches du CLAVIER à un enfant qui joue à la manette
- **Gravité** : GÊNANT (l'enfant cherche une touche « E » sur sa manette)
- **Reproduire** : manette PS5 branchée, entrer dans la zone Rallye (0, −60) : gros message « 🏜️ Rallye : prends un buggy (E), grimpe les collines… ».
- **On voit** : « (E) » ; l'aide de la zone École dit aussi « assieds-toi a une table (E) » (`hint` de la zone, sans accents).
- **On devrait voir** : « △ » quand la manette est active.
- **Sonde** : `ctrlText()` (index.html l. 15840) ne traduit les touches QUE si `body.touch` (écran tactile) ; à la manette (`body.manette`) il rend le texte tel quel — tous les « E », « Espace », « O », « clic » du jeu restent en clavier.
- **Capture** : `img/s2/s2-avant2.png`.

### 16. Se baisser (L2 à pied) ne se voit pas
❌ PAS UN BUG — artefact du pilote : la pose (genoux, bassin) est appliquée dans `frame()` (rAF), pas dans `step()`. Mesuré avec de vrais rAF : L2 tenu → bassin −0,15 m, genoux −0,81 rad, `P.accroupi = true` ; en marchant −0,19 m, genoux −0,83 rad.
- **Gravité** : GÊNANT
- **Reproduire** : à pied, sans arme, tenir L2 ; puis marcher en tenant L2.
- **On voit** : `pad.baisse = true` mais le personnage a l'air debout, jambes droites, même hauteur de tête ; en marchant accroupi il marche normalement.
- **On devrait voir** : genoux pliés, bassin 20 cm plus bas, démarche accroupie (c'est ce que promettait l'esquive du poste E).
- **Capture** : `img/s2/s2-baisse.png`, `img/s2/s2-baisse-marche.png` (comparer avec `s2-saut.png`).

### 17. À pied, on « glisse » à 6,9 m/s (25 km/h) sans courir
- **Gravité** : GÊNANT
- **Reproduire** : stick avant 4 s depuis le point d'apparition.
- **On voit** : 27,5 m parcourus en 4 s (`vel.z = −6,43`), on traverse tout le centre-ville en 9 s ; les jambes ne suivent pas cette vitesse : impression de patinage. Courir demande de MAINTENIR L3 enfoncé tout en poussant le stick (un appui bref n'enclenche rien : `P.run` retombe à false dès qu'on relâche) — difficile pour une petite main et rien ne le dit.
- **On devrait voir** : une marche à ~3–4 m/s, une course à 6–7 m/s sur un simple appui L3 (bascule), comme dans les jeux de ville.
- **Sonde** : `s2-pc.log` → `deplacementZ: -27.56` en 4 s ; `course.run = false` après un appui L3.

### 18. Dès la première minute, les habitants se battent entre eux et crient « au secours ! police !! »
- **Gravité** : GÊNANT (l'enfant n'a rien fait, la ville hurle)
- **Reproduire** : Ville, marcher 20 s, lire le chat.
- **On voit** : « Momo_king : au secours ! », « Momo_king : aïe ! », « Momo_king : police !! », « 💥 Ines_gg attaque Karim_flash ! », « 🕵️ Lucas_2014 a chapardé 31 🪙 dans une boutique » — sans qu'on voie rien de tout ça.
- **On devrait voir** : une ville calme au départ ; les bagarres de bots seulement quand on est à côté (et visibles).
- **Capture** : `img/s2/s2-avant2.png`, `img/s2/s2-fin-tv.png`.

### 23. Devant un guichet, rien ne dit quoi faire
- **Gravité** : GÊNANT
- **Reproduire** : marcher jusqu'au guichet de la banque (−57, 70) ; jusqu'au comptoir de Blocs Motors (−140, 93).
- **On voit** : le guichetier écrit « Un dépôt ou un retrait ? » dans le chat, mais la pastille d'action affiche « 🚩 Il te faut un membre de ton gang… » (banque) ou « 🚗 Concession… » (tronqué). Aucun « △ » à l'écran.
- **On devrait voir** : « △ Déposer / retirer », « △ Acheter une voiture », comme pour monter en voiture.
- **Capture** : `img/s3/s3-banque-2-dedans.png`, `img/s3/s3-concessionnaire-2-dedans.png`.

### 24. Les habitants fixent des rendez-vous à l'enfant sans qu'il ait rien demandé, et le GPS s'allume tout seul
- **Gravité** : GÊNANT (les chevrons cyan au sol dès la première seconde viennent de là — cf. n° 3)
- **Reproduire** : rester en ville 2 minutes.
- **On voit** : « Sarah_bee : ok Joueur40, je prends un vélo et je te retrouve à Parking du Sud 🚗 », « MaxiBloc : ok Joueur40, je prends une voiture et je te retrouve à Tatouage », gros message central « 🚗 MaxiBloc va chercher une voiture, direction Tatouage », et le radar affiche une destination (297 m, 135 m, 179 m) avec des chevrons cyan au sol — l'enfant n'a jamais parlé à ces bots.
- **On devrait voir** : un rendez-vous seulement après une vraie invitation (△ parler → « on se retrouve où ? »).
- **Capture** : `img/s3/s3-hopital-2-dedans.png` (chevrons + 297 m), `img/s3/s3-hopital-3-regard.png` (message central).

### 29. Reculer du parking donne une étoile « 🚦 Feu rouge grillé ! »
- **Gravité** : GÊNANT
- **Reproduire** : parking du centre, L2 tenu pour reculer sur 8 m vers (−22, 7), puis R2.
- **On voit** : « 🚦 Feu rouge grillé ! » et ★ recherché niveau 1 alors qu'on sort d'un parking en marche arrière à 25 km/h.
- **On devrait voir** : pas d'infraction en manœuvre de parking (ni en marche arrière).
- **Sonde** : `s4-pc.log` pas `recule2+2s` : `wanted 1`, msg « 🚦 Feu rouge grillé ! ».

### 30. Au volant, les messages parlent encore du clavier et proposent de s'asseoir sur un banc
- **Gravité** : GÊNANT
- **Reproduire** : monter dans la voiture du parking (message « 🚗 Appuie sur E pour conduire »), rouler devant le snack.
- **On voit** : à chaque seconde « 🪑 E : s'asseoir » pendant qu'on conduit ; « 🚗 Parking : E (ou 🚗) devant une voiture, une moto… » ; « Boîte automatique · 📯 klaxon · Espace maintenu = frein à main » ; « 🚒 Caserne des pompiers : E pour le camion, O pour déployer la lance à eau » ; « 🔧 E : garage — réparation, peinture… » ; « 🔫 E : voir toutes les armes ».
- **On devrait voir** : « △ » à la place de E, et aucune invitation à s'asseoir au volant.
- **Sonde** : `s4-pc.log` pas `gaz+1s` … `recule+3s` : msg « 🪑 E : s'asseoir ».

### 31. Taper un mur : pas de BOOM, pas de secousse, la voiture glisse le long du mur et s'enfonce dans le sol
- **Gravité** : GÊNANT (promis au round 67 : chocs BOOM, marques d'impact)
- **Reproduire** : viser l'immeuble « Centre-ville » (−35,5, 16) depuis (−22, 7), R2 6 s.
- **On voit** : vitesse 4 km/h collée au mur, la voiture continue de glisser (z 8,9 → 13,3), dégâts +2 % seulement, `cam.kick = 0`, aucun message ; `c.y` tombe de 0,15 à 0,00 et le bas des roues passe à −0,06 / −0,12 (sous la route).
- **On devrait voir** : arrêt net, secousse, bruit, marque sur le mur, roues sur la route.
- **Capture** : `img/s4/s4-6-mur.png` (non probant : la caméra est derrière un feu tricolore, cf. n° 32).

### 32. En voiture, la caméra traîne loin derrière, se cale derrière les poteaux et perd la voiture
- **Gravité** : GÊNANT
- **Reproduire** : rouler à 50 km/h vers l'est depuis (−15, 7) ; sortir de la ville.
- **On voit** : `s4-6-mur.png` : la voiture est un point rouge au loin, le feu tricolore occupe le premier plan ; `s4-7b-apres-pieton.png` : la voiture n'est plus dans l'image du tout (dallage blanc, un arbre, un banc).
- **On devrait voir** : la caméra collée derrière la voiture, qui passe devant les poteaux.

### 33. Sortir de prison = finir un parcours d'obby entier
- **Gravité** : GÊNANT (design, mais bloquant pour un enfant sans pièces)
- **Reproduire** : se faire arrêter avec 25 🪙 et 0 pass.
- **On voit** : « Pour sortir, réussis les épreuves ci-dessous (jusqu'au drapeau final), paie 100 🪙 (tu as 25), ou utilise un pass liberté (2 pour cette partie) » — Prairie ▶ / Volcan ▶. Sans pass ni argent, l'enfant doit finir 8 étapes d'obby pour retourner en ville.
- **On devrait voir** : une peine courte (attendre 30 s, ou une mini-épreuve dans la cellule).
- **Capture** : `img/s4/s4-9-accident.png`.

### 38. La dépanneuse est garée en travers de l'entrée du garage : on la percute en arrivant
- **Gravité** : GÊNANT
- **Reproduire** : arriver au garage (−45, 90) par le sud en voiture.
- **On voit** : la dépanneuse stationnée sur la chaussée en (−45, 105), pile dans l'axe ; à 25 km/h on la tape (🔧 7 % avant même d'être au garage), étoile d'impact sur le capot.
- **Capture** : `img/s5/s5-0-devant-garage.png`, `img/s5/s5-1-dans-garage.png`.

### 39. Au comptoir du garage, la caméra entre dans la tête du personnage
- **Gravité** : GÊNANT
- **Reproduire** : se placer devant le comptoir de l'atelier (−51, 96,6) face à l'ouest.
- **On voit** : l'écran est rempli par l'arrière du crâne et la casquette du personnage (la caméra est repoussée par le comptoir derrière lui).
- **Capture** : `img/s5/s5-2-comptoir.png`.

### 40. Fenêtre de l'atelier, onglet Peinture : la ligne des finitions est coupée
- **Gravité** : GÊNANT
- **Reproduire** : ouvrir l'atelier, onglet 🎨 Peinture, en 1280×720.
- **On voit** : sous les 24 couleurs, une rangée de boutons (finitions) coupée en deux par le bord de la zone, le texte « Rien à payer » passe dessus. À la manette, R1 change d'onglet mais ne pose aucune bague de sélection : ✕ ne fait rien tant qu'on n'a pas appuyé sur une direction.
- **Capture** : `img/s5/s5-4-peinture.png`.

### 43. Dans la boutique, la bague de la manette démarre sur la croix « ✕ » de fermeture, puis parcourt les onglets
- **Gravité** : GÊNANT
- **Reproduire** : △ devant l'armurerie (52, 21), regarder où est la bague jaune, appuyer sur → quatre fois.
- **On voit** : bague sur `storeClose:✕` (un appui ✕ referme la boutique qu'on vient d'ouvrir), puis → parcourt « ⭐ En vedette, 👕 Tenues, 🎨 Couleurs, 🎩 Accessoires » au lieu des armes affichées.
- **On devrait voir** : la bague sur le premier article de l'onglet ouvert (le pistolet).
- **Capture** : `img/s8/s8-1-boutique.png`.
- **Sonde** : `s8-pc.log` `boutique.focus = "storeClose:✕"`, `chemin = [En vedette, Tenues, Couleurs, Accessoires]`.

### 44. Les messages des armes parlent de « clic »
- **Gravité** : GÊNANT (cf. n° 15)
- **On voit** : « 🔫 Pistolet · clic pour tirer : le personnage vise tout seul la cible la plus proche » à la manette.

### 45. La tête du conducteur dépasse du toit de la citadine « Puce »
- **Gravité** : GÊNANT (ça se voit à chaque seconde de conduite)
- **Reproduire** : acheter la citadine chez Blocs Motors, regarder la voiture de derrière.
- **On voit** : la tête (et la casquette) du personnage plantée à travers le toit, le corps à l'intérieur.
- **Capture** : `img/s6/s6-3-achetee.png`, `img/s6/s6-3-achetee-tv.png`, `img/s6/s6-6-villa.png`.

### 46. Chez le concessionnaire, en 1280×720 avec 25 🪙, les boutons « Il te manque 55 » et « Retour » sont sous le bord de l'écran
- **Gravité** : GÊNANT (l'enfant ne voit pas comment refermer la fenêtre)
- **Reproduire** : △ au comptoir de Blocs Motors avec 25 🪙, en 1280×720.
- **On voit** : la fiche des 8 modèles remplit tout l'écran, la ligne de boutons est coupée en bas (en 1920×1080 elle tient).
- **Capture** : `img/s6/s6-1-conces-25.png` (comparer `img/s6/s6-1-conces-25-tv.png`).

### 55. Mettre KO un gangster demande plus de 15 coups de poing
- **Gravité** : GÊNANT (la garde de l'adversaire divise chaque coup par quatre : 100 → 50 PV en 15 coups, `peutKidnapper = false`)
- **Reproduire** : membre des Frelons Jaunes, ▢ ×15 à 1,2 m.
- **On devrait voir** : six coups (14 + 14 + 26 ×2) comme annoncé.
- **Sonde** : `s10-pc.log` `koGangster = {n: 15, ko: false, hp: 50}`.

### 56. Villa : le portail et la porte du garage s'ouvrent trop tard, la voiture les percute (16 % de dégâts en rentrant chez soi)
- **Gravité** : GÊNANT
- **Reproduire** : sa propre voiture, arriver au portail (60, 189) à 45 km/h ; puis entrer dans le garage (48, 185,5).
- **On voit** : le portail s'ouvre à 0,39 quand la voiture est déjà dessus (vitesse 13 → −1 m/s, 🔧 3,8 %), la porte du garage idem (🔧 16 % à l'arrivée). △ fait descendre le personnage alors que la voiture roule encore à 16 km/h.
- **Capture** : `img/s6b/s6b-1-portail.png`, `img/s6b/s6b-3-garage-villa.png`.

### 57. Conduire la grue hors du dépôt = « 💥 ACCIDENT ! — la police arrive »
- **Gravité** : GÊNANT
- **Reproduire** : dépôt municipal, △ sur la grue (24,4, 130,5), R2 2 s, stick gauche 1,5 s.
- **On voit** : accident, véhicule immobilisé, police, amende — les engins sont garés serrés et le moindre contact avec la benne voisine déclenche le constat.
- **Sonde** : `s13-pc.log` `grue.roule.msg = "💥 ACCIDENT ! …"`.

### 58. Tirer sur un habitant : « la police laisse passer (avertissement 1/4) »
- **Gravité** : GÊNANT (jeu pour enfant : trois balles dans un passant sans réaction)
- **Reproduire** : L2 sur un habitant, R2 ×3 (100 → 28 PV).
- **On voit** : « ⚠️ tirer sur Lucas_2014 : la police laisse passer (avertissement 1/4) », `wanted = 0`. Idem trois coups de poing sur une vitrine ou un tir dans la vitrine : rien ne casse, personne ne vient.
- **Sonde** : `s8b-pc.log` `tir.wanted = 0` ; `s9-pc.log` `coupsVitrine.cassee = false`, `coupDeFeu.wanted = 0`.

### 59. Hélicoptère : ▢ pose l'appareil SUR un objet de la rue
- **Gravité** : GÊNANT
- **Reproduire** : héliport (43, −13), △, ◯ 4 s, stick avant 4 s, ▢.
- **On voit** : la descente automatique (« Atterrissage… ») se termine à y 0,21 en (43, 51) sur un solide de 3 × 2,4 × 7 m (abribus / mobilier) ; △ fait descendre le personnage à y 2,3, debout sur l'objet.
- **Capture** : `img/s14/s14-heli-4-au-sol.png`.

### 60. Le facteur fait sa tournée à pied à 25 km/h, le vélo reste au dépôt
- **Gravité** : GÊNANT (promis au round 67 : le facteur, ses sacoches, son vélo)
- **Reproduire** : dépôt municipal (27, 122), suivre « Paulette » (`city.metiers`, `facteur`) 90 s.
- **On voit** : état `tournee`, elle traverse la ville à pied (26 m toutes les 5 s, soit 5 m/s+ sans courir), `b.drive = null` pendant les 90 s alors que le vélo de service (`kind: velo`) est garé en (40, 131) ; on ne voit ni sacoche ni courrier dans les mains. (Dans une autre partie, `img/s9b/s9b-9-fin.png`, on la voit bien à vélo : ce n'est donc pas systématique.)
- **Capture** : `img/s12/s12-0-facteur.png`, `img/s12/s12-1-facteur-40s.png`.
- **Sonde** : `s12-pc.log` `facteur[*].velo = false`.

### 62. Le viseur reste affiché quand l'arme est rangée
- **Gravité** : GÊNANT
- **Reproduire** : pistolet, L2 (viser), L2 (ranger), marcher.
- **On voit** : la petite croix rouge reste au milieu de l'écran avec l'arme dans l'étui (pastille « 🚩 Il te faut… », pas de « Pistolet »).
- **Capture** : `img/s9b/s9b-3-police-15s.png`, `img/s9b/s9b-4-police-30s.png`.

### 63. Le joueur perd 56 PV sans qu'on lui dise pourquoi
- **Gravité** : GÊNANT
- **Reproduire** : après la voiture détruite (n° 61), rester au point d'apparition 40 s.
- **On voit** : `P.hp` 100 → 72 → 44 puis remonte tout seul à 100 ; aucun message, aucun « aïe », la barre verte descend sans raison visible (explosion à distance ? bagarre de bots ?).
- **Sonde** : `s9b-pc.log` `arrestation[3..7].hp` = 72, 44, 46, 66…

### 64. (retiré — fausse alerte : avec de vrais boutons (scénario 11c) les questions s'enchaînent, la maîtresse lit chaque question et dit « C'est gagné ! », la craie s'entend (`craieLit` 0,07), le score monte)

### 65. École : ◯ ferme la leçon mais le personnage reste assis
- **Gravité** : GÊNANT
- **Reproduire** : assis en classe, leçon ouverte, ◯.
- **On voit** : la fenêtre se ferme, `P.sit` reste vrai, le message dit encore « 🪑 Assis (Espace / SAUT pour se lever) » — il faut un second ◯ (confirmé au scénario 11c : `leve1.sit = true`, `leve2.sit = false`), et la consigne parle d'« Espace ». À la manette, depuis les pastilles d'âge, ↓ saute sur la 2e réponse (« 2️⃣ cercle ») et non la 1re.
- **Sonde** : `s11b-pc.log` `leve = {sit: true, ui: null}`.

## COSMÉTIQUE

### 10. Les bots parlent de lave et de tennis dans la Ville
- **Reproduire** : rester 12 s au point d'apparition, lire le chat.
- **On voit** : « Karim_flash : la lave c chaud », « Sarah_bee : qui a déjà fini ? », « Tom_le_ouf : je suis à 🎾 Tennis, on joue jouer au tennis ! » (faute : « on joue jouer »), « 🚩 Les Requins Rouges contrôle maintenant Zone industrielle » (accord : contrôlent).
- **Capture** : `img/s1/s1-apres-12s.png`, `img/s1/s1-premier-regard.png`.

### 11. Sur l'écran d'accueil, un bot du décor est collé contre la caméra
✅ RÉPARÉ — la caméra du salon (`camPerche`, branche `!running`) était à 5,2 m presque à plat : le dernier rang de la foule (z = 6,9) passait à 1 m de l'objectif ; elle recule à 9,5 m, un peu plus haut (habitant le plus proche > 4 m) — commit 5eac31d
- **Reproduire** : charger la page.
- **On voit** : un personnage géant (blond, tenue blanche) qui occupe un tiers de l'écran au premier plan, devant le panneau « 1 · Sauts ».
- **Capture** : `img/s1/s1-accueil.png`, `img/s1/s1-accueil-tv.png`.

### 12. La pastille « ⭐ 0· 🚩 0/8 » a un point médian orphelin
- **On voit** : en TV « ⭐ 0· 🚩 0/8 » (le séparateur « · » colle au 0).
- **Capture** : `img/s1/s1-premier-regard-tv.png`.

### 13. L'accueil : le mode d'emploi PS5 est un pavé de 25 lignes
✅ RÉPARÉ — le paragraphe de 250 mots est réécrit en 7 lignes courtes (à pied / au volant / en hélico / croix / menus), et tout le mode d'emploi est replié derrière « ⌨️ 🎮 Comment jouer » — commit 5eac31d
- **On voit** : sur l'accueil, la ligne « 🎮 PS5 » est un paragraphe compact de ~250 mots en 11 px ; personne ne le lit. En TV il occupe la moitié de la carte.
- **Capture** : `img/s1/s1-focus-jouer.png`, `img/s1/s1-accueil-tv.png`.

### 19. Météo incohérente : « ❄️ Chute de neige » à 10 h en plein soleil, puis « ☀️ Beau temps » deux minutes plus tard
- **Capture** : `img/s2/s2-avant.png` (chat « ❄️ Chute de neige », ciel bleu).

### 20. Un carré de pelouse vert vif déborde sur le trottoir à l'angle sud-est du terrain de foot (vers (8, 10))
- **On voit** : rectangle vert plat posé par-dessus le trottoir gris et la bordure, arête franche (bas droite de `img/s2/s2-fin-tv.png`).

### 25. Petits défauts vus dans les bâtiments
- Banque : écrans d'ordinateur qui flottent sans pied sur le guichet, « pyramide » jaune posée sur le comptoir (`img/s3/s3-banque-1-porte.png`) ; étiquette « Joueur40 » qui recouvre le panneau « COFFRES · 2e ÉTAGE » (`img/s3/s3-banque-escalier-haut.png`).
- Hôpital : bandes de sol cyan et verte de 2 m de large qui ressemblent à des tapis, sans explication (`img/s3/s3-hopital-2-dedans.png`).
- Concessionnaire : le vendeur « Gérard Boulon » porte chapeau melon et lunettes noires derrière son comptoir (`img/s3/s3-concessionnaire-2-dedans.png`).

### 34. Fautes de frappe et d'accent dans les phrases des bots
- « Tu as combien de pieces ? » (pièces), « Tu as deja pilote l'helico ? », « on joue jouer au tennis / au foot », « je te retrouve à Quartier résidentiel » (au), « Les Requins Rouges contrôle » (contrôlent).
- **Capture** : `img/s4/s4-8-voiture.png`, `img/s3/s3-banque-1-porte.png`.

### 47. Après l'achat, en mode TV, tout l'écran est teinté jaune
- **Reproduire** : acheter une voiture (aire de livraison (−125, 121)), mode TV.
- **On voit** : la caméra (plus reculée en TV, `cam.dist` 8,4–9,4) se retrouve sous la verrière jaune du concessionnaire : l'image entière est jaune-sépia.
- **Capture** : `img/s6/s6-3-achetee-tv.png` (comparer `img/s6/s6-3-achetee.png`).

### 66. La maîtresse lit les points de suspension : « Un ballon de football a la forme d'une et ensuite ? »
- **Reproduire** : classe Géométrie, question « Un ballon de football a la forme d'une… ? ».
- **On voit / entend** : la synthèse vocale reçoit « …forme d'une et ensuite ? ... Réponse un : cube… » — le « … » est remplacé par « et ensuite ».
- **Sonde** : `s11c-pc.log` `reps[2].dits[1]`.
