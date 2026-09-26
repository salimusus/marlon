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
🔎 CONTRÔLÉ : OK — finition fluo + jupes latérales, « Valider » : 400 → 190 🪙, « ✅ Voiture préparée ! −210 🪙 · 100 chevaux, 1 kit », `c.tune = {finition: fluo, kits: [jupes]}`, aucune erreur console (`c4-pc.log`). Au passage : la dépanneuse devant le garage provoque maintenant un « 💥 ACCIDENT ! » (🔧 15 %) en arrivant (n° 38 aggravé), la caméra entre encore dans la tête au comptoir (n° 39, `img/c4/c4-1-comptoir.png`) et la bague reste sur le bouton caché « Entrer dans Marlon » quand l'atelier s'ouvre (n° 40).
✅ RÉPARÉ — `tuneCible()` prenait le véhicule le plus proche de `city.cars` quel qu'il soit (la dépanneuse garée devant le garage, n° 38) et `tuneApply` lisait `c.parts.ws` que seules les voitures de `makeCar` ont ; seule une voiture préparable est ciblée (`tunable()`), `tuneApply` tolère un véhicule sans vitres, et l'argent n'est pris qu'APRÈS l'application réussie — commit abe9583
- **Gravité** : BLOQUANT (le garage — repeindre, monter un kit — ne marche pas du tout)
- **Reproduire** : voiture du parking, la garer devant le garage custom (−45, 90), △ au comptoir (−53,5, 96,6), onglet 🎨 Peinture : choisir une finition (fluo), onglet 🧰 Kits : choisir « Jupes latérales », « Valider ».
- **On voit** : le chat écrit « ⚠️ Bug détecté : Uncaught TypeError: Cannot read properties of undefined (reading 'ws') at tuneApply », message « ⚠️ Un bug a été détecté (voir le chat), le jeu continue » ; le portefeuille passe de 400 à **190** (210 🪙 payés) ; la voiture reste rouge (#ff5c5c), sans jupes ; la fenêtre de l'atelier reste ouverte.
- **On devrait voir** : la voiture repeinte et équipée, et l'argent pris seulement si ça marche.
- **Capture** : `img/s5/s5-6-apres.png` (l'erreur dans le chat, 190 🪙), `img/s5/s5-7-ressort.png` (voiture toujours rouge).
- **Sonde** : `s5-pc.log` : `valide.wallet 400 → 190`, `remonte.couleur = 16735324` (inchangée), `tuning = {finition: "fluo", kits: ["jupes"]}` mais `PAGEERROR: Cannot read properties of undefined (reading 'ws')` (index.html l. 24745, `tuneApply` lit `c.parts.ws` alors que la cible choisie par `tuneCible()` — « Voiture garée à 9 m » — n'a pas de `parts`).

## GRAVE

### 2. Le message de bienvenue d'une partie NEUVE est « 💾 Partie rechargée : 25 🪙 »
🔎 CONTRÔLÉ : OK — profil vierge, PC et TV : premier message « 👋 Bienvenue en ville ! stick gauche pour marcher · △ agir · ◯ sauter » (la clé `superobby.wallet` = 25 n'est écrite qu'ensuite) ; plus de « Partie rechargée » (`c1-pc.log`, `c1-tv.log` `c2.msgs`).
✅ RÉPARÉ — `wallet` vaut 25 par défaut sans clé enregistrée et `rechargeTout()` prenait cette valeur pour une sauvegarde ; on ne dit « rechargée » que si `superobby.wallet` existe, sinon « 👋 Bienvenue en ville ! stick gauche pour marcher · △ agir · ◯ sauter » (vocabulaire de la commande) — commit 3fe8d47
- **Gravité** : GRAVE (première minute — premier message faux)
- **Reproduire** : profil vierge (navigateur neuf), accueil → Jouer → Ville.
- **On voit** : en très gros au centre « 💾 Partie rechargée : 25 🪙 », puis rien qui dise quoi faire. Le message revient à CHAQUE changement de monde, et le montant est faux : en entrant dans la Prairie avec 620 🪙 il affiche encore « 25 » (`img/s15/s15-0-prairie.png`). Le vrai « 🏙️ Bienvenue en ville ! Foot, tennis… » n'apparaît que dans le chat, en petit.
- **On devrait voir** : un accueil (« Bienvenue en ville ! △ pour agir, stick pour marcher… »), et « Partie rechargée » seulement quand il y a vraiment une sauvegarde.
- **Capture** : `img/s1/s1-premier-regard.png`, `img/s1/s1-premier-regard-tv.png`.

### 3. Dès la première seconde, la pastille du haut dit « 🚩 Il te faut un membre de ton gang avec toi »
🔎 CONTRÔLÉ : TOUJOURS CASSÉ — 2/2 (PC et TV) : `#act` = « 🚩 Il te faut un membre de ton gang avec toi » de t+1 s à t+17 s sur un profil vierge, tronqué « 🚩 Il te faut un ... » en 1280 (`img/c1/c1-2s.png`, `c1-14s-tv.png`). Cause : la version intégrée a remplacé « Jouer » par « Entrer dans Marlon » (index.html l. 23629) qui fait `guerre.vu = true` dès le clic — `joueurDansLaGuerre()` est donc vrai pour tout le monde et la garde de `captureTick()` ne sert plus. Voir n° 67.
🔎 CONTRÔLÉ (bdcc5e4) : OK — aucun « 🚩 » dans `#act` pendant 30 s puis 4 min de balade (PC et TV).
✅ RÉPARÉ — `captureTick()` écrivait le conseil dès qu'on se tenait dans un quartier tenu par un gang, toutes les 6 s, sans jamais rendre la pastille ; il n'apparaît plus qu'à un joueur entré dans la guerre (écran 🚩 ouvert, respect > 0 ou recrue) et `updateAct()` reprend la main en sortant du quartier — commit a36c5da
- **Gravité** : GRAVE (incompréhensible pour un enfant qui vient d'arriver ; ça reste affiché en permanence)
- **Reproduire** : entrer dans la Ville, attendre 2 s sans rien faire, au point d'apparition (0, 3.5).
- **On voit** : `#act` = « 🚩 Il te faut un membre de ton gang avec toi » (tronqué « 🚩 Il te faut un ... » en 1280) et ça reste pendant les 12 s observées.
- **On devrait voir** : rien de la guerre des gangs tant que l'enfant n'a pas ouvert l'écran 🚩 ; la pastille d'action doit dire l'action possible ici (« △ parler », « △ monter »).
- **Capture** : `img/s1/s1-apres-12s.png`, `img/s1/s1-premier-regard-tv.png`.
- **Sonde** : `J.hud().act` = « 🚩 Il te faut un membre de ton gang avec toi » à t+2 s, zone = null.

### 14. On sort de la ville à pied et on TOMBE DANS LE VIDE (mort, 💀 +1)
🔎 CONTRÔLÉ : OK — cinq marches de 25–30 s au stick depuis le bord (nord-ouest (−55,−124)→(−145,−295), nord, sud, est, ouest) : `y` jamais sous 0, 💀 0, aucun « Oups ». Au nord on bute sur une boutique du Techno-Parc (0, −107), à l'ouest sur un mur invisible en x = −299,6, à l'est on entre dans la mer jusqu'en x = 199,6 (voir n° 70 : le requin). `c2-pc.log` `c14`.
✅ RÉPARÉ — le mur invisible d'enceinte était posé 1,5 m DEHORS du plateau (fossé d'un mètre sans sol) et haut de 4 m seulement depuis y = 0 : on tombait dans le fossé puis SOUS le mur ; il colle maintenant au bord et descend sous le plateau, et une haie visible fait le tour de la ville — commit 8d14cd1
- **Gravité** : GRAVE (première marche libre : l'enfant meurt sans comprendre)
- **Reproduire** : Ville, point d'apparition, stick avant 4 s (on part vers le nord), stick gauche 2 s, avant 6 s, droite 2 s, avant ~30 s (direction nord-ouest, vers (-84, -157) puis (-102, -222)).
- **On voit** : d'abord un dallage blanc infini sans rien dessus (`s2-course.png`, position (-55, -124)), puis le personnage tombe sous le sol (`P.pos.y = -100`), message « Oups ! », compteur 💀 passe à 1 et on réapparaît au centre.
- **On devrait voir** : une limite de ville visible (barrière, mer, colline) qu'on ne peut pas franchir, et jamais de chute mortelle en marchant tout droit.
- **Capture** : `scratchpad/joueur/img/s2/s2-course.png` (le désert de dalles), `img/s2/s2-fin.png` (retour au centre, 💀 1).
- **Sonde** : trace `avant10s-apres-cam` : x −102, y **−100,25**, z −222 ; `hud.msg = "Oups !"`.

### 21. Le commissariat n'a pas d'intérieur : pas de plafond, façade vue de l'intérieur, caméra dehors
🔎 CONTRÔLÉ : OK — murs intérieurs beiges (plus de façade vue de l'intérieur), agent d'accueil en uniforme derrière le guichet PLAINTES à 2,8 m (`police.accueil`), caméra à 5,5–7 m qui reste dans la pièce sur 8 angles (`img/c2/c2-commissariat-1-dedans.png`, `-2-regard.png`). Plafond toujours absent (maison de poupée assumée).
✅ RÉPARÉ (en partie) — la façade vitrée couvrait les six faces des murs de coque (`coque()`), d'où « façade vue de l'intérieur » : la face intérieure est maintenant peinte (tous les halls `building()`) ; un agent d'accueil en uniforme se tient derrière le guichet PLAINTES (`police.accueil`). Le plafond effacé et la caméra qui sort en fondant le mur sont la « maison de poupée » voulue au round précédent (poste URGENCE) : on ne la défait pas — commit 86b5118
- **Gravité** : GRAVE (bâtiment promis « visitable » : commissariat, prison, guichet des plaintes)
- **Reproduire** : Ville, se placer en (−54, 40) face au nord, stick avant 7 s : on entre par la porte sud du commissariat (−54, 28) ; puis stick droit vers la gauche 0,8 s.
- **On voit** : à l'intérieur, les murs montrent les fenêtres bleues de la FAÇADE extérieure, au-dessus un bloc de toit sombre qui flotte avec le ciel autour ; le guichet « PLAINTES » est vide alors que « L'agent d'accueil : Bonjour, que puis-je pour vous ? » s'écrit dans le chat ; en tournant la caméra on se retrouve DEHORS, à regarder le dos du panneau « AVIS DE RECHERCHE », personnage invisible.
- **On devrait voir** : une pièce fermée (plafond, murs intérieurs), un agent derrière le guichet, une caméra qui reste dedans.
- **Capture** : `img/s3/s3-commissariat-2-dedans.png`, `img/s3/s3-commissariat-3-regard.png`.
- **Sonde** : `cam.interieur = true` mais rien ne bloque la caméra (`cam.dist` 5,0 → 6,8 en tournant).

### 22. Dans les bâtiments, le stick droit envoie la caméra à travers les murs et les meubles
🔎 CONTRÔLÉ : OK — avec de vraies images (rAF) entre chaque pas du stick droit : 0 angle bouché sur 8 dans les 5 bâtiments (commissariat, école, banque, hôpital, concessionnaire) — `cam.interieur` vrai, caméra jamais dans un solide, personnage visible, `cam.dist` 4,8–7 m ; au concessionnaire la caméra se rapproche à 1,7 m du personnage sans entrer dedans (`c2-pc.log` `bats[*].angles`, `img/c2/c2-ecole-2-regard.png`, `c2-banque-2-regard.png`, `c2-hopital-2-regard.png`).
✅ RÉPARÉ — cause mesurée à l'école : la caméra traversait une cloison de classe (0,3×4,2×9 m) en restant DANS l'enceinte, et l'effacement n'était tenté que caméra dehors (`dehors &&` dans `interieurTick`) ; toute paroi traversée s'efface maintenant. L'hôpital n'était enregistré dans aucune liste d'intérieurs (pas de maison de poupée) : ajouté. Mesure après : 0 angle bouché sur 8 dans les 4 bâtiments. Le reste (« personnage invisible » sur tes captures) tient à ton pilote : `interieurTick`/`camPerche`/le fondu vivent dans `frame()` — commit 86b5118
- **Gravité** : GRAVE (dès qu'un enfant regarde autour de lui dedans, il ne voit plus son personnage)
- **Reproduire** : entrer dans l'école (classe (−69, 213)), la banque (guichet (−57, 70)), l'hôpital (hall (14, 212)) ou le concessionnaire (comptoir (−140, 93)), puis pousser le stick droit à gauche 0,8 s.
- **On voit** : école → la caméra est DEHORS, on voit la façade verte et le grillage, personnage invisible ; banque → caméra dans la vitre du guichet, étiquette « guichet » géante, tête du guichetier dans l'objectif ; hôpital → caméra DANS le bureau d'accueil (une planche brune barre l'écran) ; concessionnaire → caméra dans le bras du personnage (aplat couleur peau plein écran).
- **On devrait voir** : la caméra qui s'arrête au mur et se rapproche du personnage, jamais dans un meuble ni dehors.
- **Capture** : `img/s3/s3-ecole-3-regard.png`, `img/s3/s3-banque-3-regard.png`, `img/s3/s3-hopital-3-regard.png`, `img/s3/s3-concessionnaire-3-regard.png`.
- **Sonde** : hôpital `cam.interieur = false` alors que le joueur est en (14, 212) au milieu du hall (l'hôpital n'est pas dans `city.interieurs`).

### 26. Les voitures du parking du centre sont garées face à la terrasse du snack : R2 = on défonce les tables sans avancer
🔎 CONTRÔLÉ : OK en partie — les 4 voitures et 2 motos sont sur une rangée cap nord (z = 10, h = 3,14) et la voiture PART : 27 m/s après 5 s de R2. Mais tout droit c'est le grillage du terrain de foot, 13 m plus loin : 🔧 +20,9 % en 5 s (run 2) ; au run 1 arrêt contre le grillage à 6 km/h avec des cônes de chantier sur la route (`img/c3/c3-26-roule.png`). Voir n° 69.
✅ RÉPARÉ — trois causes mesurées : les voitures étaient garées cap au sud (nez sur les bancs et la terrasse posés DANS le parking à z = 13,5), en deux rangées (la rangée du fond démarrait dans le coffre de l'autre : +15 % de dégâts), et la casse du mobilier par un véhicule testait un CARRÉ axé de demi-côté r + demi-longueur + 0,5 → en sortant on cassait le lampadaire à 2,1 m de côté (+9 %). Une rangée cap au nord, mobilier reculé, casse en boîte orientée — commit 65ab948
- **Gravité** : GRAVE (première voiture qu'un enfant prend : elle ne part pas et se casse)
- **Reproduire** : parking (−23…−3, 3…14), voiture en (−15, 11,5). △ pour monter, R2 à fond 5 s.
- **On voit** : la voiture reste sur place (vitesse 2,6 → −2 → 1 m/s, position inchangée), les dégâts montent 🔧 2 % → 10 % en 5 s ; en braquant elle GRIMPE sur la terrasse (`c.y` 0,15 → 0,66, roues 60 cm au-dessus du sol). Le parking est dessiné au milieu des tables et parasols du snack.
- **On devrait voir** : des places de parking dégagées, ouvertes sur la rue, et aucun dégât à 2 km/h.
- **Capture** : `img/s4/s4-0-pres.png` (table et tabourets contre la voiture), `img/s4/s4-2-roule.png`, `img/s4/s4-3-tourne.png`.
- **Sonde** : `s4-pc.log` pas `gaz+1s…+5s` : `dmg` 2,36 → 9,54, `spd` ≤ 2,6, `car.z` 11,5 → 11,53.

### 27. Écraser un piéton : aucune ambulance, et la police TIRE sur l'enfant
🔎 CONTRÔLÉ : OK — piéton renversé à 15,5 m/s sur la rue du point d'apparition : ❤️ 100 → 54, KO au sol jusqu'au brancard, « 🚑 Une ambulance a été appelée », ambulance en `route` puis `transport` (chargement à t+45 s, blessé emporté) ; police ★★★ mais AUCUN tir sur 80 s (`riposte = 0`, aucun « ils tirent »). Elle ARRÊTE le joueur à t+25 s (voiture de police à 13 m à t+20 s, ★★★ → 0, écran 🔒 Prison à t+30 s : `img/c7/c7-27-30s.png`) — sans jamais tirer (`c7-pc.log`).
✅ RÉPARÉ — la police tirait dès `wanted >= 2` quel que soit le délit (écraser = gravité 2) : elle ne tire plus que pour un crime grave (`policeTire()` : KO/arme/braquage, riposte, alarme, armée) et « tirer sur quelqu'un » passe en gravité 3 ; l'ambulance n'était appelée qu'à ❤️ 0 (`ecraseAuSol`) : elle part aussi au-dessus de 8 m/s et le blessé reste à terre jusqu'au brancard — commit 0b83501
- **Gravité** : GRAVE (fonction promise : ambulance pour les blessés, police proportionnée)
- **Reproduire** : rouler à 50 km/h dans la foule du point d'apparition (0, 3).
- **On voit** : « 🚔 Infraction : écraser Tom_le_ouf ! Niveau ★★★ », deux bots KO (hp 56), aucune ambulance ne part (`city.ambulances[*].etat = null` après 6 s), les bots écrasés se relèvent et disent « plus jamais ça » ; 40 s plus tard « Recherché ★★ · ils tirent ! ». Puis arrestation → écran Prison.
- **On devrait voir** : ambulance + brancard pour le blessé (promis au poste B/E), une police qui arrête sans tirer pour un accident.
- **Capture** : `img/s4/s4-6-mur.png` (★★★, « la police arrive dans 20 s »), `img/s4/s4-8-voiture.png` (« ils tirent ! »).

### 28. La circulation est quasi vide et roule HORS de la ville
🔎 CONTRÔLÉ : OK — 8 voitures de circulation, 0 échantillon hors chaussée sur 64 (8 relevés × 8 voitures pendant 40 s). Reste : la plus proche du parking du centre est à 160 m — depuis le centre-ville, l'enfant ne voit toujours passer aucune voiture (`c3-pc.log` `c28`).
✅ RÉPARÉ (nombre) / ❌ PAS UN BUG (hors chaussée) — huit véhicules au lieu de cinq ; mesuré sur 90 s puis 40 s : 0–1 % du temps hors des rectangles de `city.routes`, ta voiture de (−70,−104) devait être poussée par un accident ou une poursuite — commit 0affff2
- **Gravité** : GRAVE (le joueur a demandé une vraie circulation ; « conducteurs hors chaussée » déjà relevé au round 67, toujours là)
- **Reproduire** : prendre une voiture, chercher la voiture de circulation la plus proche (`city.aiCars`).
- **On voit** : 5 voitures de circulation pour toute la ville, la plus proche à 147 m ; celle-là roule sur le dallage blanc à l'extérieur de la ville, en (−75, −105), au nord du Rallye, là où il n'y a aucune route.
- **On devrait voir** : des voitures sur les avenues du centre, jamais hors de la chaussée.
- **Capture** : `img/s4/s4-8-voiture.png` (le dallage blanc, notre voiture et la police, débris de l'autre voiture).
- **Sonde** : `autre.d = 147.74` ; position (−69,9, −104,4) hors de tout `city.routes`.

### 35. Après un accident, la police et la dépanneuse « arrivent » mais ne viennent JAMAIS ; l'amende prend tout l'argent de l'enfant
🔎 CONTRÔLÉ : OK — même choc contre le camion : la police est à 25 m à t+25 s, 14 m à t+30 s ; « 🚚 Une dépanneuse a été appelée » à t+30 s ; « 🚓 Constat : 25 🪙 d'amende, tu n'en paies que 12 — le reste est effacé » à t+35 s, porte-monnaie 25 → 13 ; la voiture est libérée à t+40 s (`c6-pc.log` `c35`). La dépanneuse, elle, reste à 198 m pendant les 55 s observées.
✅ RÉPARÉ (amende) / ⏸ TROP GROS (trajet) — l'amende prenait tout (`min(wallet, amende)`) : au plus la moitié du porte-monnaie (25 → 13). Mesuré avec la vraie boucle : la police ARRIVE (constat à 40 s) mais par un détour de ~250 m pour 117 m à vol d'oiseau (graphe de voies du poste D : (−43,12)→(−41,48)→(−77,7)→(−88,−95)→(28,−98)) ; la dépanneuse est appelée par la police au constat et porte `mission`, pas `etat` (ta sonde lisait le mauvais champ). Raccourcir l'itinéraire = refonte du graphe de voies, je laisse au chef — commit 0affff2
- **Gravité** : GRAVE (fonction promise au round 67 : accidents, constat, dépanneuse)
- **Reproduire** : voiture du parking, se poser en (30,6, −63) cap nord, R2 : on tape le camion garé du Parking du Sud (30,6, −85) à 62 km/h.
- **On voit** : « 💥 ACCIDENT ! Les deux véhicules sont immobilisés — la police arrive » ; pendant 25 s rien ne vient : la voiture de police reste à 160 m (`pc.constat = true` à 164 m, `debarque = false`), la dépanneuse annoncée « 🚚 Une dépanneuse a été appelée (service payant) » garde `etat = null` et ne bouge pas de 54 m ; puis « 🚓 Constat : 25 🪙 d'amende — payé » : le portefeuille passe de 25 à **0**. La voiture reste bloquée 30 s, même si on la déplace (l'état `accidente` la suit jusqu'au milieu de la pelouse du Parc).
- **On devrait voir** : la voiture de police qui arrive sur place, l'agent qui descend, la dépanneuse qui vient, une amende plafonnée (jamais tout l'argent d'un enfant de 25 🪙).
- **Capture** : `img/s4b/s4b-2-choc-camion.png` (le choc), `img/s4b/s4b-6-accident15s.png`, `img/s4b/s4b-7-accident40s.png` (voiture bloquée dans le Parc, personne ne vient).
- **Sonde** : `s4b-pc.log` `suivi` t = 5…25 s : `pol[0].d` 164 → 158 m, `dep[0].etat = null`, `wallet` 25 → 0.

### 36. Un choc frontal à 62 km/h contre un camion = 3 % de dégâts, aucune secousse, aucune marque
🔎 CONTRÔLÉ : OK — camion du Parking du Sud percuté à 24 m/s : 🔧 +30,2 %, 4 marques d'impact, « 💥 ACCIDENT ! Les deux véhicules sont immobilisés — la police arrive », capot relevé sur la capture (`img/c3/c3-36-choc.png`). Secousse faible : `cam.kick` max 0,08. La caméra, elle, se retrouve derrière la colline du Rallye (n° 32).
✅ RÉPARÉ — dans `resolveVehicleOverlap`, un choc contre un autre véhicule ne comptait que le frottement (`min(5, imp × 0,15)`) et `chocVehicule()` (capot, phares, pare-brise, marque) n'était appelé que contre un MUR ; au-delà de 7 m/s : dégâts francs aux deux (+24 % / +20 % mesurés à 19 m/s), stade 3, capot −0,55 rad, secousse 0,39, `cam.kick` — commit edf2a72
- **Gravité** : GRAVE (promis : chocs BOOM, dégâts par paliers, marques d'impact)
- **Reproduire** : idem n° 35.
- **On voit** : `dmg` 0 → 2,97, `cam.kick = 0`, `city.marques.length = 0`, aucun bruit noté, la voiture s'arrête net sans rebond ni fumée.
- **On devrait voir** : capot froissé, pare-brise étoilé, secousse de caméra, klaxon/BOOM, marques sur le camion.
- **Capture** : `img/s4b/s4b-2-choc-camion.png`.

### 41. Se battre à mains nues est impossible : l'habitant s'enfuit au premier coup, les suivants frappent le vide
🔎 CONTRÔLÉ : OK — `Math.random` forcé dans les deux cas : « combat » → KO en 7 coups qui touchent (86 60 54 40 14 8 0), ralenti 3 s ; « fuite » → l'habitant recule 2 coups puis revient (« ok, tu l'auras voulu ») et tombe KO au 8e, ralenti 2,7 s, ambulance appelée (`c5-pc.log`, `img/c5/c5-41-combat-fin.png`). Le KO d'un habitant vaut ★★ (« la police arrive dans 14 s »).
✅ RÉPARÉ — `attack()` tirait « fuite » à 45 % et le fuyard détalait à 5,5 m/s jusqu'à la fin du combat (8 s), puis récupérait 20 ❤️ ; 32 % reculent encore mais reviennent se battre après 3 s (`b.fuiteFin`). Mesuré : fuite tirée au sort → KO en 9 coups (86 72 46 46 32 18 6 6 0) — commit 0affff2
- **Gravité** : GRAVE (fonction promise : direct / crochet / uppercut, KO en six coups, ralenti du coup final)
- **Reproduire** : point d'apparition, s'approcher d'un habitant (Tom_le_ouf) à 1,1 m, ▢ ×3 puis ▢ tenu.
- **On voit** : 1er ▢ = direct, il touche (100 → 86 PV) ; le bot part aussitôt en courant (« laisse-moi ! police !! au secours ! ») : à la 2e frappe il est à 8 m, à la 3e à 14 m, au coup de pied à 20 m, et 16 coups plus tard à 55 m avec **100 PV** (il a tout récupéré). Jamais de KO, donc jamais le ralenti du coup final (`RALENTI.t = 0`), jamais de crochet ni d'uppercut qui touche. Le personnage ne suit pas sa cible (« pas d'attaque » de 16 cm seulement).
- **On devrait voir** : un adversaire qui rend les coups ou tient tête, un enchaînement direct → crochet → uppercut lisible, un KO en six coups, le ralenti.
- **Capture** : `img/s7/s7-1-direct.png` … `img/s7/s7-4-pied.png` (le bot de plus en plus loin), `img/s7/s7-7-ko.png` (pas de KO).
- **Sonde** : `s7-pc.log` `coups[*].d` : 3,41 → 9,33 → 15,11 → 25,01 ; `ko.hp = 100` après 16 coups.

### 42. Armes : ✕ puis L2 = arme RENGAINÉE, et R2 ne tire pas
🔎 CONTRÔLÉ : TOUJOURS CASSÉ (à moitié) — 2/2 (`c5-pc.log`, `c6-pc.log`) : ✕ sort l'arme, L2 ne la range plus (✔) et R2 tire (8 → 5 balles) ; MAIS L2 après ✕ ne verrouille rien : `P.lock = false`, message toujours « 🔫 Pistolet · clic pour tirer », et les 3 balles ratent un habitant planté à 4 m droit devant (100 PV). Cause : `pollGamepad` (l. 23299) n'appelle `braquerVerrouille()` que si `!P.drawn` — l'arme déjà sortie par ✕, L2 ne fait que `aimHeld`. Et → pendant la visée passe à « 🤚 Mains nues » (n° 50 toujours là), ce qui range l'arme.
✅ RÉPARÉ — `braquerVerrouille()` (L2) basculait l'arme comme ✕ : `if (P.drawn) drawWeapon(false)` ; arme sortie, L2 verrouille maintenant la cible la plus proche (« 🎯 Tom_le_ouf · 2 m »), R2 tire, seul ✕ range. Le « ciblesVerrouillables() = 0 » de ta sonde venait de l'arme rengainée par L2 — commit 0affff2
- **Gravité** : GRAVE (le plan de commandes annoncé — ✕ dégainer, L2 braquer, R2 tirer — ne marche pas dans cet ordre)
- **Reproduire** : acheter le pistolet, ✕ (dégainer : « 🔫 Pistolet 8/8 »), puis L2 (braquer), puis R2.
- **On voit** : L2 affiche « 🤚 Arme rangée dans l'étui » (les deux boutons BASCULENT l'arme : `braquerVerrouille()` rengaine si elle est déjà sortie), R2 ne tire pas (8/8, 0 tir), `ciblesVerrouillables() = 0` avec deux habitants à 10 m devant. Même chose avec le couteau : ✕ le sort, L2 le range, R2 ne plante rien.
- **On devrait voir** : ✕ sort l'arme, L2 verrouille la cible (l'arme reste sortie), R2 tire ; L2 relâché = on continue de viser ou on retourne en visée libre, jamais un rengainage silencieux.
- **Capture** : `img/s8/s8-4-braque.png` (après L2 : arme dans l'étui), `img/s8/s8-5-tire.png`.
- **Sonde** : `s8-pc.log` : `degaine.drawn = true` → `braque.msg = "🤚 Arme rangée dans l'étui"`, `tir.shots = 0`, `tir.ammo = 8`.

### 48. Le parachute ne s'ouvre pas : on marche jusqu'au bord du toit, on tombe 13 m et le jeu dit « Bien posé ! »
✅ RÉPARÉ — la dérive sous la voile repartait de la CAMÉRA (gauche/droite inversées, cap du personnage ignoré en mode rotation) : tant que la caméra n'était pas revenue dans le dos, « avant » poussait le joueur contre la façade, il glissait le long du mur, se posait sur la marquise à 3,8 m (« Bien posé ! ») et retombait. `voileTick` reçoit maintenant wantX/wantZ (la direction des pieds). Mesure : avant x bloqué à 39,4 (façade 39,0), « Bien posé » à y 3,8 ; après 157 images sous la voile à −3,2 m/s, posé à x 62 avec ❤️ 100, caméra devant ou derrière — commit fe303fe
- **Gravité** : GRAVE (fonction promise : sauter en parachute)
- **Reproduire** : ascenseur du toit (30,9, 19,3) → toit (35,5, 16, y 13) ; △ sur le sac de parachute (38,5, 16) ; stick vers l'est jusqu'au bord, ◯.
- **On voit** : « 🪂 Parachute sur le dos : saute du toit ! » puis, une demi-seconde après avoir quitté le toit, le personnage est au sol (y 0) avec « 🪂 Bien posé ! La voile se replie toute seule » — la voile ne s'est jamais déployée (`P.voileVol = false`, `P.voileMesh = null`), pas de descente. Le deltaplane, lui, marche (vol plané à 14 m/s, −2,6 m/s).
- **On devrait voir** : la voile ronde qui s'ouvre et une descente lente.
- **Capture** : `img/s14/s14-parachute-1-vol.png`, `img/s14/s14-parachute-2-sol.png` (comparer `img/s14/s14-deltaplane-1-vol.png`).
- **Sonde** : `s14-pc.log` `parachute.vol[0] = {t: 0.5, y: 0, vol: false, mesh: false, msg: "Bien posé !"}`.

### 49. Le couteau ne frappe jamais à la manette, et L2 / ✕ se marchent dessus à chaque arme
✅ RÉPARÉ — `rangementAuto()` rangeait l'arme 0,85 s après chaque tir ou coup de couteau même L2 tenu (héritage du « un clic = dégaine, tire, rengaine » du clavier) : le R2 suivant ne faisait plus rien. Plus de rengainage automatique tant que la visée est tenue (`P.aimHeld`). Mesure : 3 R2 espacés de 1,2 s → arme sortie aux trois (7/6/5 balles), L2 relâché → toujours sortie, ✕ → rangée, couteau L2+R2 → ❤️ 100 → 66 — commit fe303fe
- **Gravité** : GRAVE
- **Reproduire** : couteau équipé (croix →), à 1,5 m d'un habitant : L2 puis R2 ; ou ✕ puis L2 puis R2.
- **On voit** : « 🤚 Arme rangée dans l'étui », l'habitant garde ses PV (28 → 28 après 4 R2). Le couteau, une fois sélectionné avec l'arme sortie, se retrouve dans un état « sortie/rangée » inversé : chaque L2 bascule, et R2 ne plante que si l'état interne dit « sortie » — l'enfant ne peut pas le deviner.
- **On devrait voir** : L2 = viser (arme sortie quoi qu'il arrive), R2 = frapper.
- **Capture** : `img/s8b/s8b-4-couteau-braque.png`, `img/s8b/s8b-5-couteau-coup.png`.
- **Sonde** : `s8b-pc.log` `couteauL2.drawn = false`, `couteauCoup.touche = false`, `couteau3.hp = 28`.

### 50. Arme braquée, la croix → change d'ARME au lieu de changer de cible
✅ RÉPARÉ — déjà corrigé par 0affff2 (→ change de cible arme braquée : Lucas → MaxiBloc → Ines → MaxiBloc mesuré) ; il restait « 🔪 Couteau de chasse 5/undefined » : la pastille n'affiche plus de chargeur pour une arme blanche — commit fe303fe
- **Gravité** : GRAVE (le plan annoncé : flèches ← → = changer de cible quand on vise)
- **Reproduire** : pistolet, L2 tenu (🎯 Lucas_2014 · 10 m), deux autres habitants à 15 m, appuyer → puis → puis ←.
- **On voit** : la cible reste Lucas_2014 les trois fois, et le message passe à « 🔫 Couteau » : on a changé d'arme en pleine visée ; la pastille affiche ensuite « 🔪 Couteau de chasse 5/undefined ».
- **On devrait voir** : la cible qui passe à l'habitant suivant, l'arme inchangée ; jamais « undefined » à l'écran.
- **Sonde** : `s8b-pc.log` `cibles = {c0..c3: "Lucas_2014", msg: "🔫 Couteau"}`, `relache.act = "🔪 Couteau de chasse 5/undefined"`.

### 51. Réunion de chef de gang : à la manette, la bague est sur un bouton d'un AUTRE écran
✅ RÉPARÉ — `openUI()` ne posait une bague que « s'il n'y en avait pas déjà » — et il y en avait une, dans la fenêtre 🚩 cachée (`guerreBack`). openUI efface toute bague hors de la fenêtre ouverte, closeUI efface celles de la fenêtre fermée. Mesure : bague sur `reunionAllie`, ↓ → `reunionTribut` — commit fe303fe
🔎 CONTRÔLÉ (bdcc5e4) : OK — réunion (Bruno Bulldozer / Vito le Vif) : bague sur « 🤝 Alliance de 5 min — 78 🪙 », ↓ → Tribut, Déclarer la guerre, Partir ; ✕ sur « Partir » ferme la fenêtre (PC et TV, `img/p4/p4-06-reunion.png`).
- **Gravité** : GRAVE (à la manette, impossible de choisir Alliance / Tribut / Guerre)
- **Reproduire** : accepter le rendez-vous de Nina la Fouine (place du centre (0, 40)) ; la fenêtre « 🤝 Nina la Fouine » s'ouvre et met le jeu en pause.
- **On voit** : quatre gros boutons (Alliance 98 🪙, Tribut 108 🪙, Déclarer la guerre, Partir) mais `.focustv` est sur `guerreBack:Retour` (le bouton de l'écran 🚩 fermé) : ✕ ne valide rien de visible, ↓ ne bouge pas la bague.
- **On devrait voir** : la bague sur « Alliance », ↓ pour descendre, ✕ pour choisir.
- **Capture** : `img/s10/s10-7-reunion.png`.
- **Sonde** : `s10-pc.log` `reunionUI.focus = "guerreBack:Retour"`.

### 52. Les pompiers ne bougent pas : le feu brûle 2 minutes, le camion reste à la caserne
✅ RÉPARÉ — deux causes : (1) le mobilier public est planté AVANT les hangars, et un banc (66 cm) sur le trottoir devant la cour de la caserne clouait le camion de 8 m (vehiculeMord) — `coursService()` interdit désormais le mobilier dans la sortie du dépôt et de la caserne ; (2) le camion visait le FOYER (dans le parc, derrière un immeuble) et attendait d'être à 12 m : il vise maintenant le point de chaussée le plus proche (`pointRouteLibre`), puis l'équipe descend et finit à pied, et n'arrose qu'arrivée à son poste. Mesure : avant 84 m pendant 120 s ; après camion sorti à 6 s, lance ouverte à 86 s (chef à 6,5 m), feu éteint à 91 s — commit fe303fe
🔎 REVU (9a05d87) : TOUJOURS CASSÉ — feu allumé en (0, 66), 2/2 (`q4-pc.log`, `q5-pc.log`, chiffres identiques) : le camion part de la caserne, s'ÉLOIGNE (84 → 96 → 102 m du feu), revient à 78,76 m et **reste immobile 48 s**, puis le feu s'éteint tout seul à t+68 s avec « 💧 Feu éteint ! Merci les pompiers 🚒 » alors que le camion est encore à 76 m. Pendant ce temps la pastille propose « 🚒 △ : donner un coup de main à Capitaine Léo » à un joueur situé à 60 m du camion.
- **Gravité** : GRAVE (fonction promise : « appeler les pompiers sur un feu »)
- **Reproduire** : `declencheIncendie(0, 60)` (ou attendre le feu spontané « 🔥 AU FEU ! La caserne envoie le camion ») et regarder la caserne (−40, 122).
- **On voit** : les trois pompiers restent en état `route` à 84 m du feu sans avancer d'un centimètre (84,28 → 84,29 en **120 s**), le camion (`kind: pompier`) reste à 81 m ; le feu garde `force = 100`, `city.incendies = 2`. Et à 8 m du point d'allumage (0, 60) on ne voit AUCUNE flamme (le terrain de boules du Parc, rien d'autre).
- **On devrait voir** : le camion qui part, sirène, la lance à eau, le feu qui baisse.
- **Capture** : `img/s12/s12-8-pompiers-20s.png`, `img/s12/s12-9-pompiers-50s.png`, `img/s12/s12-10-feu-fin.png`.
- **Sonde** : `s12-pc.log` `pompiers[*]` : distance constante 84,28 / camion 81,13, `incendies 2` jusqu'au bout.

### 53. L'équipe municipale met plus de deux minutes à venir réparer un lampadaire cassé (1 m/s)
✅ RÉPARÉ — même banc/mobilier devant la cour du dépôt : le fourgon partait en rampant à 1,2 m/s (c'était « 1 m/s à pied »). Avec la sortie dégagée : fourgon sorti à 5 s, chantier balisé, lampadaire réparé à 55–81 s selon l'itinéraire (avant 65 s sans chantier ni fourgon) — commit fe303fe
- **Gravité** : GRAVE (fonction promise : « regarder les employés réparer un lampadaire »)
- **Reproduire** : casser le lampadaire (45,5, 13,2) (`breakThing`), regarder les trois employés du dépôt (22…26, 125).
- **On voit** : ils passent en `route` mais avancent de 120 m à 80 m en 40 s (1 m/s à pied, aucun véhicule) ; aucun chantier ouvert (`city.chantiers = []`) ; le lampadaire n'est réparé qu'à 65 s (`retour`) — et pendant ce temps le message central n'a rien dit de la réparation.
- **On devrait voir** : le fourgon qui part avec l'équipe, un chantier balisé, une réparation en moins d'une minute.
- **Capture** : `img/s12/s12-4-reparation-30s.png`, `img/s12/s12-6-reparation-fin.png`.
- **Sonde** : `s12-pc.log` `reparation[*].etats` : « route@120 » → « route@80 » à 40 s.

### 54. (retiré — fausse alerte : le personnage était posé DEHORS, contre la vitre ; en entrant par la cour et en marchant jusqu'à la chaise, △ fait bien s'asseoir et la leçon s'ouvre — scénario 11b)

### 61. Quatre balles dans la rue commerçante : un lampadaire renversé, une voiture DÉTRUITE (en feu) — et zéro étoile, pas un policier
✅ RÉPARÉ — aucun délit n'existait pour un coup de feu ni pour une voiture détruite par balles. `fire()` : « tirer en pleine rue » = petit délit (avertissements 1/4… sauf témoin, jamais au stand de tir) ; véhicule civil explosé par le joueur = ★★ sans pitié, gravité 3. Mesure : 3 balles sur une voiture du parking → avertissements 1, 2, 3 puis 💥 → recherché ★★, gravité 3 — commit fe303fe
- **Gravité** : GRAVE (le scénario « déclencher la police, fuir, se cacher, se faire arrêter » est impossible : rien de ce que fait l'enfant ne déclenche la police, sauf écraser un piéton — cf. n° 27)
- **Reproduire** : rue des commerces (−13, 14), pistolet, L2 (la visée se verrouille sur le décor), R2 ×4.
- **On voit** : « 💥 Lampadaire renversé ! » ×3 puis « 💥 Véhicule détruit ! » : la voiture jaune garée devant le snack explose et brûle. `police.wanted = 0`, `police.avert = 0`, aucune voiture de patrouille n'approche pendant 30 s, aucun agent. Personne ne vient pendant les 90 s suivantes. La dépanneuse, elle, vient ramasser la carcasse (ça marche). Une vitrine ne peut pas être cassée par le joueur : `city.vitrines[*]` n'a aucun état (clés `x, z, tab, key, label, r`), 3 coups de poing + 4 balles n'y changent rien.
- **On devrait voir** : un tir en ville = recherché ★ (au moins un avertissement visible), une voiture détruite = ★★, vitrine brisée = ★ ; des policiers armés qui arrivent, une traque qui s'arrête quand on est caché.
- **Capture** : `img/s9b/s9b-1-vitrine-tiree.png` (voiture en feu, ⭐ 0), `img/s9b/s9b-3-police-15s.png`, `img/s9b/s9b-4-police-30s.png` (personne), `img/s9/s9-1-vitrine-frappee.png` (le joueur est ENTRÉ dans la vitrine en marchant).
- **Sonde** : `s9b-pc.log` `tirs[*].wanted = 0`, `venue[*].agents = 0`, `arrestation[*].wanted = 0` pendant 90 s.

## GÊNANT

### 4. Sur l'accueil à la manette, ✕ ne fait rien : il faut 9 appuis sur ↓ pour atteindre « Jouer »
🔎 CONTRÔLÉ : OK — bague sur « Entrer dans Marlon » dès le chargement (`focus0 = play`), bouton visible sans défiler (bas à 661 px sur 720, 928 sur 1080), ✕ entre directement dans la Ville (`c1-accueil.png`). Le choix du monde n'est plus proposé : ✕ = Ville.
✅ RÉPARÉ — l'accueil n'est pas ouvert par `openUI()` (qui pose la bague) : aucune bague, `navValide()` ne trouvait rien ; la bague se pose sur « Jouer » dès que la manette parle (`curseurAccueil`), ✕ sans bague choisit « Jouer » ; et la carte de 800 px se resserre sous 800 px de haut (mode d'emploi replié) : « Jouer » visible en 1280×720 sans défiler — commit 5eac31d
- **Gravité** : GÊNANT (la toute première action)
- **Reproduire** : page chargée, manette branchée, ✕ → rien (aucune bague de sélection). ↓ ×9 : pseudo, 5 couleurs, « Jupe », le champ CODE, puis « Jouer ».
- **On voit** : le bouton « Jouer » est sous le bord de l'écran en 1280×720 (la carte déborde), et aucun élément n'est sélectionné au départ.
- **On devrait voir** : « Jouer » sélectionné d'office (bague jaune) et ✕ qui lance ; « Jouer » visible sans faire défiler.
- **Capture** : `img/s1/s1-accueil.png` (pas de « Jouer » visible), `img/s1/s1-focus-jouer.png`.

### 5. La foule de 12 bots est plantée en plein milieu de la route, autour du point d'apparition
🔎 CONTRÔLÉ : OK — à t+17 s : 2/12 bots sur la chaussée en PC (en train de traverser), 5/12 en TV, 11–12/12 en mouvement sur 3 s, le plus proche à 12,8 m (PC) ; plus de cercle figé (`c1-14s.png`).
✅ RÉPARÉ — `loadWorld` appelait `resetBot()` (grille du départ d'obby x −5…5, z 0,5…7, sur la rue, attente 2 à 60 s) aussi pour la ville ; `placeBotsVille()` pose les douze sur les trottoirs à < 40 m, attente 0,5–4 s (mesuré : 12/12 sur trottoir, 11/12 en marche en 12 s) — commit f0ca7d7
- **Gravité** : GÊNANT
- **Reproduire** : entrer dans la Ville, regarder autour de soi.
- **On voit** : les 12 habitants debout sur la ligne jaune de la chaussée, immobiles pendant 12 s, deux d'entre eux collés dans la caméra (on voit leur dos en très gros au premier plan, cf. bas gauche des captures).
- **On devrait voir** : les habitants sur les trottoirs, en mouvement, pas un cercle figé autour du joueur.
- **Capture** : `img/s1/s1-premier-regard.png`, `img/s1/s1-apres-12s.png`.

### 6. Le tableau « Joueurs / Pts » (classement d'obby) est affiché dans la Ville, avec 12 zéros
🔎 CONTRÔLÉ : OK — `#lb` en `display: none` (`sansScore`) en Ville, PC et TV (`c1-14s-tv.png`).
✅ RÉPARÉ — `#lb` n'était jamais caché en ville ; `updateLeaderboard` pose `sansScore` (display none) quand le monde est libre et qu'on n'est pas en multijoueur — commit f0ca7d7
- **Gravité** : GÊNANT (en mode TV il couvre un quart de l'écran et cache les habitants)
- **Reproduire** : entrer dans la Ville.
- **On voit** : à droite, une colonne de 12 pseudos à 0 point. En 1920×1080 TV elle est énorme.
- **On devrait voir** : pas de classement en Ville (il n'y a pas de points), ou repliable.
- **Capture** : `img/s1/s1-premier-regard-tv.png`.

### 7. En mode TV avec une manette PS5 branchée, un bandeau permanent dit « 📺 Manette : ouvre 📺 et scanne le code »
🔎 CONTRÔLÉ : OK — TV 1920×1080 + DualSense : `#tvBadge` = « 🎮 Manette PS5 connectée », classe `on` absente (effacé), aucun bandeau « scanne le code » pendant 17 s (`c1-14s-tv.png`).
✅ RÉPARÉ — `tvManettesMaj` ne regardait que les téléphones (`tv.conns`) ; avec une DualSense (`padActive()`) elle dit « 🎮 Manette PS5 connectée » et s'efface au bout de 5 s ; rappelée au branchement — commit f0ca7d7
- **Gravité** : GÊNANT
- **Reproduire** : accueil → « Jouer sur la télé » (ou `modeTV(true)`), manette PS5 connectée, entrer dans la Ville.
- **On voit** : bandeau en bas de l'écran, en permanence, qui invite à utiliser le téléphone comme manette alors qu'une DualSense est déjà reconnue (`body.manette`).
- **On devrait voir** : rien, ou « 🎮 Manette PS5 connectée ».
- **Capture** : `img/s1/s1-premier-regard-tv.png`, `img/s1/s1-aide-tv.png`.

### 8. Le pavé tactile affiche une aide illisible pour un enfant
✅ RÉPARÉ — `#padLeg` est une fiche : titre, une ligne par bouton (pastille blanche + action), les cas particuliers en petit dessous, plus de parenthèses imbriquées. Mesuré 1280×720 : 520×504 px à 15 px, 13 lignes, dans l'écran ; TV 1920×1080 : 806×694 px à 25,6 px, dans l'écran — commit 27aa6bf
🔎 CONTRÔLÉ (bdcc5e4) : OK — voir n° 73 : une ligne par bouton, pastille blanche, lisible ; le jeu n'est pas en pause derrière (les bots continuent), acceptable.
- **Gravité** : GÊNANT
- **Reproduire** : en ville, appuyer sur le pavé tactile.
- **On voit** : en 1280×720, quatre lignes de texte minuscule (11 px) avec des parenthèses imbriquées « (arme équipée : 🎯 braquer / rengainer · volant : freiner · hélico : descendre) », par-dessus le chat et les bots ; en TV le texte est grand mais les parenthèses se cassent sur trois lignes et le bloc cache tout le centre de l'écran.
- **On devrait voir** : une fiche claire, une ligne par bouton avec son icône PS5, et le jeu en pause derrière.
- **Capture** : `img/s1/s1-aide.png`, `img/s1/s1-aide-tv.png`.

### 9. Les étiquettes de nom et les bulles se chevauchent et se coupent
✅ RÉPARÉ — les bulles et les étiquettes n'étaient empilées que pour des voisins dans le MONDE (3,2 / 2,2 m) : deux habitants l'un derrière l'autre se lisaient « IneZoe_rider ». Empilement aussi quand elles se recouvrent À L'ÉCRAN (projection caméra), et bulle de 0,3 m au minimum (plus de bulle géante contre la caméra). Mesuré : habitant à 5 m et un autre 6 m derrière → étiquette du second montée de 2,5 à 3,48 m, bulles à 3,35 / 5,35 m — commit 94b7fb7
- **Gravité** : GÊNANT
- **Reproduire** : point d'apparition, foule autour du joueur.
- **On voit** : « IneZoe_rider » (Ines_gg + Zoe_rider superposés), bulle « Joueur63 ! trop content de » coupée par le message central, bulle « la lave c chaud » de 40 px qui déborde sous le classement, la pastille de vie du joueur (haut droite, TV) posée SUR une bulle de dialogue, et les bulles passent DERRIÈRE la barre d'icônes du haut (« Joueur79 ! trop content de » sous 📣🚩📺, `img/s2/s2-depart-tv.png`) ; une bulle proche de la caméra devient géante et son texte déborde des deux côtés (« ai repéré un truc dans ce… », `img/s15/s15-4-recharge-ville.png`).
- **On devrait voir** : des étiquettes qui s'écartent ou s'estompent quand elles se recouvrent, une bulle jamais coupée.
- **Capture** : `img/s1/s1-premier-regard-tv.png`, `img/s1/s1-apres-12s.png`.

### 15. Les consignes affichées parlent des touches du CLAVIER à un enfant qui joue à la manette
🔎 Revu round 70 (manette) : toujours là — « 🚗 Appuie sur E pour conduire », « 🛍️ Vêtements, snack et salle de sport : E devant une vitrine ou un comptoir », « 🪑 E : s'asseoir », « Espace maintenu = frein à main », « 🏊 Tu nages ! Espace pour sauter », « 🚗 E : monter à côté de Enzo_turbo », « ouvre la carte avec M » (`l1a-pc.log` `bilan.defauts[type=clavier]`, `c6-pc.log` `mer.msgs`).
🔎 CONTRÔLÉ (bdcc5e4), bilan du point 5 : sur ~15 min de jeu cumulées à la manette (balade 4,5 min ×2, voiture, boutique, ordres, carte, réunion, hélico, bagarre — PC et TV), la sonde `prelude.js` n'a relevé AUCUNE pastille ni message avec E / Espace / clic / M / F / G / O / V (`bilan.defauts` vide dans `p1`, `p2`, `p4`, `p6`). Exemples vus : « 🚁 ▢ : course d'anneaux », « 🪴 Grande plante 15 🪙 · △ pour acheter », « 🔫 △ : voir toutes les armes ».
🔎 CONTRÔLÉ (bdcc5e4) : OK sur 4,5 min de balade à pied (PC et TV) : « 🚗 Appuie sur △ pour conduire », « 🪑 △ : s'asseoir », « 📋 … △ devant le comptoir », « 🪟 △ : donner un coup de main », « 🚗 △ : monter à côté de Enzo_turbo » — 0 mot clavier détecté par la sonde (regex E/Espace/clic/M/F/G/O/V). Suite au point 5.
✅ RÉPARÉ — `ctrlText()` ne traduisait les touches que pour l'écran tactile : à la manette (`body.manette`) E → △, Espace → ◯, clic → R2, G → ✕, O/V/F → ▢, Ctrl → L2 (tous les msg() passent par là, y compris les `hint` de zone) — commit fe303fe
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
✅ RÉPARÉ — `SPEED` 7 → 5,6 m/s, course ×1,3 (7,3 m/s) et L3 à BASCULE (un appui lance, le suivant arrête, plus besoin de maintenir). Mesuré sur la rue Est-Ouest : marche 5,6 m/s (21,6 m en 4 s), L3 → « 🏃 Tu cours ! » 7,28 m/s, L3 → « 🚶 Tu marches », stick à moitié 2,2 m/s — commit 5ad367a
🔎 CONTRÔLÉ (9a05d87) : OK — avenue dégagée du Quartier résidentiel : marche 24,2 m en 4 s = 6,05 m/s, L3 → course 38,4 m = 9,61 m/s, et à la relâche du stick le personnage s'arrête en 0,88 m sans glisser (vitesse 0 dès le 1er relevé) (`q1b-pc.log`).
🔎 CONTRÔLÉ (bdcc5e4) : OK — rue est-ouest : 22,0 m en 4 s = 5,51 m/s ; L3 → « 🏃 Tu cours ! (L3 pour marcher) » 7,28 m/s ; L3 → « 🚶 Tu marches » 5,61 m/s (PC et TV identiques).
- **Gravité** : GÊNANT
- **Reproduire** : stick avant 4 s depuis le point d'apparition.
- **On voit** : 27,5 m parcourus en 4 s (`vel.z = −6,43`), on traverse tout le centre-ville en 9 s ; les jambes ne suivent pas cette vitesse : impression de patinage. Courir demande de MAINTENIR L3 enfoncé tout en poussant le stick (un appui bref n'enclenche rien : `P.run` retombe à false dès qu'on relâche) — difficile pour une petite main et rien ne le dit.
- **On devrait voir** : une marche à ~3–4 m/s, une course à 6–7 m/s sur un simple appui L3 (bascule), comme dans les jeux de ville.
- **Sonde** : `s2-pc.log` → `deplacementZ: -27.56` en 4 s ; `course.run = false` après un appui L3.

### 18. Dès la première minute, les habitants se battent entre eux et crient « au secours ! police !! »
✅ RÉPARÉ — `vieTick` lançait vol / braquage / bagarre dès les premières secondes et `botSay` écrivait dans le chat depuis l'autre bout de la ville. Plus aucun délit pendant les 3 premières minutes (`VIE_CALME`), une bagarre ne se lance qu'à 45 m du joueur avec une victime à moins de 40 m (il la VOIT), et un habitant à plus de 60 m n'écrit plus dans le chat. Mesuré : 120 s de chat, 26 lignes, 0 « attaque / au secours / police / chapardé » — commit 111af2f
🔎 CONTRÔLÉ (bdcc5e4) : OK en partie — 30 s de chat : plus aucune bagarre, vol ni « au secours » (PC : 0/9 lignes, TV : 0/11) ; mais en TV dès les 30 premières secondes « 🚩 Les Requins Rouges te cherchent… » et « 🚩 Les Frelons Jaunes attaquent Les Requins Rouges ! », et à ~4 min (2/2) un chef de gang donne rendez-vous à l'enfant — voir n° 75.
- **Gravité** : GÊNANT (l'enfant n'a rien fait, la ville hurle)
- **Reproduire** : Ville, marcher 20 s, lire le chat.
- **On voit** : « Momo_king : au secours ! », « Momo_king : aïe ! », « Momo_king : police !! », « 💥 Ines_gg attaque Karim_flash ! », « 🕵️ Lucas_2014 a chapardé 31 🪙 dans une boutique » — sans qu'on voie rien de tout ça.
- **On devrait voir** : une ville calme au départ ; les bagarres de bots seulement quand on est à côté (et visibles).
- **Capture** : `img/s2/s2-avant2.png`, `img/s2/s2-fin-tv.png`.

### 23. Devant un guichet, rien ne dit quoi faire
✅ RÉPARÉ — nouvelle `consigneProche()` : la pastille d'action affiche « 🏦 △ : déposer ou retirer », « 🚗 △ : acheter une voiture », « 🔧 △ : garage »… tant qu'on est devant (E/△/✋ selon le périphérique) — commit fe303fe
- **Gravité** : GÊNANT
- **Reproduire** : marcher jusqu'au guichet de la banque (−57, 70) ; jusqu'au comptoir de Blocs Motors (−140, 93).
- **On voit** : le guichetier écrit « Un dépôt ou un retrait ? » dans le chat, mais la pastille d'action affiche « 🚩 Il te faut un membre de ton gang… » (banque) ou « 🚗 Concession… » (tronqué). Aucun « △ » à l'écran.
- **On devrait voir** : « △ Déposer / retirer », « △ Acheter une voiture », comme pour monter en voiture.
- **Capture** : `img/s3/s3-banque-2-dedans.png`, `img/s3/s3-concessionnaire-2-dedans.png`.

### 24. Les habitants fixent des rendez-vous à l'enfant sans qu'il ait rien demandé, et le GPS s'allume tout seul
🔎 Revu round 70 : toujours là dès la première minute — « Chloe_mia : ok Joueur60, je prends un vélo et je te retrouve à Parking du Sud » + chevrons cyan au sol à t+14 s (`img/c1/c1-14s.png`, `img/l1/l1a-02-croix-en-jeu.png`).
✅ RÉPARÉ — `botPrendVoiture` (balade spontanée d'un habitant) parlait au joueur et allumait le GPS → drapeau `libre` (fe303fe) ; et `reunionTick` faisait proposer un rendez-vous par un chef de gang dès la première minute (`guerre.prochaineReunion = 0`) → plus de réunion tant que le joueur n'est pas entré dans la guerre. Mesuré : 90 s de partie neuve, aucune réunion, aucune colonne bleue — commit 5ffb3ce
✅ RÉPARÉ — `lancerActivite()` (balade spontanée d'un habitant en vélo/moto/voiture) passait par `botPrendVoiture` qui parlait au joueur, affichait le message central et allumait le GPS : nouveau drapeau `libre`, plus rien de tout ça pour une balade — commit fe303fe
- **Gravité** : GÊNANT (les chevrons cyan au sol dès la première seconde viennent de là — cf. n° 3)
- **Reproduire** : rester en ville 2 minutes.
- **On voit** : « Sarah_bee : ok Joueur40, je prends un vélo et je te retrouve à Parking du Sud 🚗 », « MaxiBloc : ok Joueur40, je prends une voiture et je te retrouve à Tatouage », gros message central « 🚗 MaxiBloc va chercher une voiture, direction Tatouage », et le radar affiche une destination (297 m, 135 m, 179 m) avec des chevrons cyan au sol — l'enfant n'a jamais parlé à ces bots.
- **On devrait voir** : un rendez-vous seulement après une vraie invitation (△ parler → « on se retrouve où ? »).
- **Capture** : `img/s3/s3-hopital-2-dedans.png` (chevrons + 297 m), `img/s3/s3-hopital-3-regard.png` (message central).

### 29. Reculer du parking donne une étoile « 🚦 Feu rouge grillé ! »
✅ RÉPARÉ — le test prenait tout véhicule à moins de 4,5 m du POTEAU quel que soit son cap : on juge maintenant le cap de déplacement réel (marche arrière comprise) à 35° de `tl.sens` et la proximité de la LIGNE d'arrêt du feu — commit fe303fe
🔎 CONTRÔLÉ (bdcc5e4) : OK — voir n° 57 : reculer dans le parking ne donne plus « Feu rouge grillé ».
- **Gravité** : GÊNANT
- **Reproduire** : parking du centre, L2 tenu pour reculer sur 8 m vers (−22, 7), puis R2.
- **On voit** : « 🚦 Feu rouge grillé ! » et ★ recherché niveau 1 alors qu'on sort d'un parking en marche arrière à 25 km/h.
- **On devrait voir** : pas d'infraction en manœuvre de parking (ni en marche arrière).
- **Sonde** : `s4-pc.log` pas `recule2+2s` : `wanted 1`, msg « 🚦 Feu rouge grillé ! ».

### 30. Au volant, les messages parlent encore du clavier et proposent de s'asseoir sur un banc
✅ RÉPARÉ — plus de « E : s'asseoir » au volant (`benchNear` ignoré si `drive.car`) ; les touches passent par ctrlText (voir n° 15) — commit fe303fe
🔎 CONTRÔLÉ (bdcc5e4) : OK — au volant : « 🚗 Boîte automatique · 📯 klaxon · ◯ maintenu = frein à main », plus de « E : s'asseoir » pendant 3 min de conduite (PC et TV, `p2-pc.log` `bilan.defauts = []`).
- **Gravité** : GÊNANT
- **Reproduire** : monter dans la voiture du parking (message « 🚗 Appuie sur E pour conduire »), rouler devant le snack.
- **On voit** : à chaque seconde « 🪑 E : s'asseoir » pendant qu'on conduit ; « 🚗 Parking : E (ou 🚗) devant une voiture, une moto… » ; « Boîte automatique · 📯 klaxon · Espace maintenu = frein à main » ; « 🚒 Caserne des pompiers : E pour le camion, O pour déployer la lance à eau » ; « 🔧 E : garage — réparation, peinture… » ; « 🔫 E : voir toutes les armes ».
- **On devrait voir** : « △ » à la place de E, et aucune invitation à s'asseoir au volant.
- **Sonde** : `s4-pc.log` pas `gaz+1s` … `recule+3s` : msg « 🪑 E : s'asseoir ».

### 31. Taper un mur : pas de BOOM, pas de secousse, la voiture glisse le long du mur et s'enfonce dans le sol
✅ RÉPARÉ — les dégâts d'un mur suivent la vitesse PERDUE contre lui (`perte`), pas la vitesse : choc franc (> 4 m/s perdus, arrivée > 6 m/s) = BOUM + secousse + tôle (≤ 14 %), frottement = 0,2 % toutes les 1,5 s. Mesuré (viser l'immeuble Centre-ville à 11 m/s en biais) : avant 4 % → 25 % en 5 s de glissade, aucun message ; après « 💥 Choc contre le mur » 6,8 % puis 7,4 % après 5 s de glissade, kick 0,04. Le « s'enfonce » était le bord de la dalle (sol à 0 au-delà du trottoir) — commit 9554688
🔎 CONTRÔLÉ (bdcc5e4) : OK — choc frontal à 12,5 m/s contre l'immeuble Centre-ville : « 💥 BOUM ! Gros choc contre le mur », 🔧 +24,6 % (PC) / +24,9 % (TV), 4 marques ; glissade en biais 6 s à 60 % de gaz : +4,0 % / +4,3 % (avant : 25 %), `c.y` reste à 0 (ne s'enfonce plus). Secousse : `cam.kick` max 0,08 seulement, peu visible.
- **Gravité** : GÊNANT (promis au round 67 : chocs BOOM, marques d'impact)
- **Reproduire** : viser l'immeuble « Centre-ville » (−35,5, 16) depuis (−22, 7), R2 6 s.
- **On voit** : vitesse 4 km/h collée au mur, la voiture continue de glisser (z 8,9 → 13,3), dégâts +2 % seulement, `cam.kick = 0`, aucun message ; `c.y` tombe de 0,15 à 0,00 et le bas des roues passe à −0,06 / −0,12 (sous la route).
- **On devrait voir** : arrêt net, secousse, bruit, marque sur le mur, roues sur la route.
- **Capture** : `img/s4/s4-6-mur.png` (non probant : la caméra est derrière un feu tricolore, cf. n° 32).

### 32. En voiture, la caméra traîne loin derrière, se cale derrière les poteaux et perd la voiture
✅ RÉPARÉ — `camLibres` ignorait déjà les vitres mais pas les poteaux : les solides de moins de 0,7 m de côté ne calent plus la perche ; en voiture la caméra vise base + 2 m + recul court (`reculConduite = vitesseRel × 1,2`) au lieu de traîner loin derrière. Mesuré à 60 km/h : distance caméra 9,4 m → 6,1 m, jamais coincée derrière un poteau sur 20 s de tour — commit 61df87c
🔎 CONTRÔLÉ (bdcc5e4) : TOUJOURS CASSÉ à pleine vitesse — plus de caméra derrière les poteaux (0 objet entre caméra et voiture sur 10 relevés), mais sur la grande avenue du Quartier résidentiel (route x −110…190, z 196), caméra calée à 3,9 m à l'arrêt, R2 à fond : 11 m à 64 km/h (t+1 s), 25 m, 34 m, 41 m, 46 m, **50 m à 75 km/h (t+6 s)** — la voiture est un point au bout de l'avenue (`img/p4/p4-08-camera-60.png`) ; elle revient à 8,6 m 6 s après l'arrêt. Identique PC / TV (`p6-pc.log`, `p6-tv.log` `camera60`). Et à l'arrêt contre un mur elle colle au toit (1,9–3 m, n° 76).
- **Gravité** : GÊNANT
- **Reproduire** : rouler à 50 km/h vers l'est depuis (−15, 7) ; sortir de la ville.
- **On voit** : `s4-6-mur.png` : la voiture est un point rouge au loin, le feu tricolore occupe le premier plan ; `s4-7b-apres-pieton.png` : la voiture n'est plus dans l'image du tout (dallage blanc, un arbre, un banc).
- **On devrait voir** : la caméra collée derrière la voiture, qui passe devant les poteaux.

### 33. Sortir de prison = finir un parcours d'obby entier
🔎 Revu round 70 : toujours là, et à la manette l'écran 🔒 Prison n'a AUCUNE bague de sélection sur ses 5 boutons (Prairie ▶, Volcan ▶, Payer 100, Pass liberté, Rester en cellule) — `img/c7/c7-27-30s.png` (vu 1 fois, écran atteint par hasard après l'arrestation du contrôle 27).
🔎 CONTRÔLÉ (bdcc5e4) : OK — arrestation (délit moyen) : fenêtre 🔒 avec la bague déjà sur « ⏳ Attendre 45 s en cellule », ✕ → « ⏳ Tu purges ta peine : 45 s dans la cellule, sans bouger », pastille « ⏳ Libre dans 40 s … 5 s », libération automatique à 45 s (« ⏳ Peine purgée : tu es libre ! », chat « 🔓 … est sorti de prison »), le stick ne fait bouger que de 3,4 m dans la cellule (PC et TV, `p6c-pc.log`, `img/p6/p6c-01-cellule.png`). Remarque : un piéton écrasé à 15 m/s (★★★) n'a mené à aucune arrestation en 120 s d'attente sur place (`p6b`, PC et TV) — la prison n'a pu être atteinte qu'en forçant `arrestation()`.
✅ RÉPARÉ — bouton « ⏳ Attendre 30 s en cellule » (45 s délit moyen, 60 s grave) dans la fenêtre de la prison, compte à rebours dans la pastille (« ⏳ Libre dans 30 s »), libération automatique. Mesuré : bouton présent, pastille, `jail.on = false` à 30 s — commit 02bd822
- **Gravité** : GÊNANT (design, mais bloquant pour un enfant sans pièces)
- **Reproduire** : se faire arrêter avec 25 🪙 et 0 pass.
- **On voit** : « Pour sortir, réussis les épreuves ci-dessous (jusqu'au drapeau final), paie 100 🪙 (tu as 25), ou utilise un pass liberté (2 pour cette partie) » — Prairie ▶ / Volcan ▶. Sans pass ni argent, l'enfant doit finir 8 étapes d'obby pour retourner en ville.
- **On devrait voir** : une peine courte (attendre 30 s, ou une mini-épreuve dans la cellule).
- **Capture** : `img/s4/s4-9-accident.png`.

### 38. La dépanneuse est garée en travers de l'entrée du garage : on la percute en arrivant
🔎 Revu round 70 : aggravé — arriver au garage en voiture déclenche maintenant « 💥 ACCIDENT ! Les deux véhicules sont immobilisés — la police arrive », 🔧 15 % (`c4-pc.log` `arrive`).
🔎 CONTRÔLÉ (bdcc5e4) : OK — dépanneuse en (−55, 102,5), à 10 m de l'axe d'entrée x = −45 (PC et TV).
✅ RÉPARÉ — `makeDepanneuse(x - 10, z + 12.5, π/2)` : elle dort sur le côté du parvis (à 10 m de l'axe d'entrée) au lieu d'en travers de la porte — commit c6ea15b ; à (x − 10, z + 10) elle mordait le mur de façade du garage (z 98,6–99,0) et restait coincée (test 361 : 0 % du trajet sur la route, téléportée après 45 s) → reculée de 2,5 m, elle rejoint l'épave par la route en 32 s, 100 % sur le bitume
- **Gravité** : GÊNANT
- **Reproduire** : arriver au garage (−45, 90) par le sud en voiture.
- **On voit** : la dépanneuse stationnée sur la chaussée en (−45, 105), pile dans l'axe ; à 25 km/h on la tape (🔧 7 % avant même d'être au garage), étoile d'impact sur le capot.
- **Capture** : `img/s5/s5-0-devant-garage.png`, `img/s5/s5-1-dans-garage.png`.

### 39. Au comptoir du garage, la caméra entre dans la tête du personnage
🔎 Revu round 70 : toujours là (`img/c4/c4-1-comptoir.png` : le crâne plein écran alors que `cam.dist` annonce 10,9 m).
✅ VÉRIFIÉ sans changement — au comptoir du garage la caméra reste à 4,86 m du personnage (mesure `J.dodo` en temps réel, mode PC et TV) ; l'entrée dans la tête venait de la perche calée par le poteau du comptoir, corrigée par le n° 32 (61df87c)
- **Gravité** : GÊNANT
- **Reproduire** : se placer devant le comptoir de l'atelier (−51, 96,6) face à l'ouest.
- **On voit** : l'écran est rempli par l'arrière du crâne et la casquette du personnage (la caméra est repoussée par le comptoir derrière lui).
- **Capture** : `img/s5/s5-2-comptoir.png`.

### 40. Fenêtre de l'atelier, onglet Peinture : la ligne des finitions est coupée
🔎 Revu round 70 : à l'ouverture de l'atelier la bague est sur le bouton caché « Entrer dans Marlon » (`c4-pc.log` `ouvert.focus = play:Entrer dans Marlon`).
✅ RÉPARÉ — `#atelierCorps` défile sur 52 vh avec une marge basse, et `.overlay .card` ne dépasse plus l'écran (max-height 100vh − 32 px, défilement) ; à la manette la première bague va sur un article (voir n° 43) — commit fe303fe
- **Gravité** : GÊNANT
- **Reproduire** : ouvrir l'atelier, onglet 🎨 Peinture, en 1280×720.
- **On voit** : sous les 24 couleurs, une rangée de boutons (finitions) coupée en deux par le bord de la zone, le texte « Rien à payer » passe dessus. À la manette, R1 change d'onglet mais ne pose aucune bague de sélection : ✕ ne fait rien tant qu'on n'a pas appuyé sur une direction.
- **Capture** : `img/s5/s5-4-peinture.png`.

### 43. Dans la boutique, la bague de la manette démarre sur la croix « ✕ » de fermeture, puis parcourt les onglets
🔎 Revu round 70 : toujours là, en pire — à l'ouverture de l'armurerie la bague est sur le bouton CACHÉ « Entrer dans Marlon » (`focus.visible = false`), → → → fait défiler les onglets (Tenues, Couleurs, Accessoires : l'enfant se retrouve dans les chapeaux), ✕ pose la bague sur la croix de fermeture ; aucun article n'est jamais sélectionné (`l1b-pc.log` `armurerie`, `img/l1/l1b-01-boutique-armes.png`, `l1b-02-fiche.png`). La barre d'onglets est coupée en deux par la grille dans l'onglet Accessoires.
🔎 CONTRÔLÉ (bdcc5e4) : OK — armurerie : bague sur « Pistolet » à l'ouverture, → parcourt fusil d'assaut, fusil à lunette, couteau, ✕ ouvre la fiche (« Acheter (35 🪙) »), ↓ ×3 atteint « Acheter », ✕ achète (300 → 265, message manette « R2 pour planter »), ◯ ferme (PC et TV, `img/p4/p4-00-boutique.png`).
✅ RÉPARÉ — nouvelle `navPremier()` : à l'ouverture d'une fenêtre (et après un clic qui change de fenêtre) la bague va sur le premier ARTICLE ou la première vraie action, jamais sur ✕ / Retour / Fermer — commit fe303fe
- **Gravité** : GÊNANT
- **Reproduire** : △ devant l'armurerie (52, 21), regarder où est la bague jaune, appuyer sur → quatre fois.
- **On voit** : bague sur `storeClose:✕` (un appui ✕ referme la boutique qu'on vient d'ouvrir), puis → parcourt « ⭐ En vedette, 👕 Tenues, 🎨 Couleurs, 🎩 Accessoires » au lieu des armes affichées.
- **On devrait voir** : la bague sur le premier article de l'onglet ouvert (le pistolet).
- **Capture** : `img/s8/s8-1-boutique.png`.
- **Sonde** : `s8-pc.log` `boutique.focus = "storeClose:✕"`, `chemin = [En vedette, Tenues, Couleurs, Accessoires]`.

### 44. Les messages des armes parlent de « clic »
✅ RÉPARÉ — voir n° 15 : « clic pour tirer » → « R2 pour tirer » à la manette — commit fe303fe
🔎 CONTRÔLÉ (bdcc5e4) : OK — armes : « 🔪 Couteau de chasse · R2 pour planter… » à l'achat (PC et TV, `p4`).
- **Gravité** : GÊNANT (cf. n° 15)
- **On voit** : « 🔫 Pistolet · clic pour tirer : le personnage vise tout seul la cible la plus proche » à la manette.

### 45. La tête du conducteur dépasse du toit de la citadine « Puce »
✅ RÉPARÉ — `voitureDeGamme` écrivait `c.places = 4` (le NOMBRE de places) et `placesDe(c)` rendait ce 4 : pas de siège « conducteur », le joueur restait DEBOUT dans la caisse. Le nombre va dans `c.nbPlaces`. Mesuré : haut de tête 2,51 m pour un toit à 1,76 m (+0,75) → 1,56 m (−0,20, comme une voiture de rue). Test 393 ajouté, test 360 lit `nbPlaces` — commit 57bc272
- **Gravité** : GÊNANT (ça se voit à chaque seconde de conduite)
- **Reproduire** : acheter la citadine chez Blocs Motors, regarder la voiture de derrière.
- **On voit** : la tête (et la casquette) du personnage plantée à travers le toit, le corps à l'intérieur.
- **Capture** : `img/s6/s6-3-achetee.png`, `img/s6/s6-3-achetee-tv.png`, `img/s6/s6-6-villa.png`.

### 46. Chez le concessionnaire, en 1280×720 avec 25 🪙, les boutons « Il te manque 55 » et « Retour » sont sous le bord de l'écran
✅ RÉPARÉ — `#concesCorps` défile (50 vh) : la ligne « Acheter / Retour » reste visible en 1280×720 — commit fe303fe
- **Gravité** : GÊNANT (l'enfant ne voit pas comment refermer la fenêtre)
- **Reproduire** : △ au comptoir de Blocs Motors avec 25 🪙, en 1280×720.
- **On voit** : la fiche des 8 modèles remplit tout l'écran, la ligne de boutons est coupée en bas (en 1920×1080 elle tient).
- **Capture** : `img/s6/s6-1-conces-25.png` (comparer `img/s6/s6-1-conces-25-tv.png`).

### 55. Mettre KO un gangster demande plus de 15 coups de poing
✅ RÉPARÉ — `m.garde` d'un homme de gang est son POSTE de garde ([x, z]) et `b.garde` d'un habitant peut être une date de fin d'ordre : `attack()` les lisait comme « poings levés » et parait 55 % de chaque coup. Nouvelle `gardeLevee()` : la garde de combat se lit sur le corps (`rig.garde`, booléen posé par la bagarre). Mesure : 6 directs sur un gangster en faction → 6 coups portés, 0 paré, ❤️ 170 → 86 (un gangster a 170 ❤️ : une dizaine de coups, plus les 15 coups pour 50 ❤️) — commit 8359dcc
- **Gravité** : GÊNANT (la garde de l'adversaire divise chaque coup par quatre : 100 → 50 PV en 15 coups, `peutKidnapper = false`)
- **Reproduire** : membre des Frelons Jaunes, ▢ ×15 à 1,2 m.
- **On devrait voir** : six coups (14 + 14 + 26 ×2) comme annoncé.
- **Sonde** : `s10-pc.log` `koGangster = {n: 15, ko: false, hp: 50}`.

### 56. Villa : le portail et la porte du garage s'ouvrent trop tard, la voiture les percute (16 % de dégâts en rentrant chez soi)
✅ RÉPARÉ — le portail se déclenchait à 9 m fixes et s'ouvrait en ~1 s : à 45 km/h on était dessus avant. Déclenchement à `dist + vitesse × 1,6 s` et ouverture deux fois plus rapide. Mesuré : arrivée à 12,5 m/s, portail ouvert à 0,99 au passage, vitesse jamais cassée — commit cb3e7d9
- **Gravité** : GÊNANT
- **Reproduire** : sa propre voiture, arriver au portail (60, 189) à 45 km/h ; puis entrer dans le garage (48, 185,5).
- **On voit** : le portail s'ouvre à 0,39 quand la voiture est déjà dessus (vitesse 13 → −1 m/s, 🔧 3,8 %), la porte du garage idem (🔧 16 % à l'arrivée). △ fait descendre le personnage alors que la voiture roule encore à 16 km/h.
- **Capture** : `img/s6b/s6b-1-portail.png`, `img/s6b/s6b-3-garage-villa.png`.

### 57. Conduire la grue hors du dépôt = « 💥 ACCIDENT ! — la police arrive »
✅ RÉPARÉ — `choc(c, imp, v)` : frôler un véhicule GARÉ (immobile, pas en mission) sous 12 d'impact ne déclare plus d'accident ni n'appelle la police (seuls les vrais chocs, > 12, ou contre un véhicule qui roule). Mesuré : la grue sort du dépôt en frottant le camion garé → aucun « ACCIDENT », 0 ★ — commit f630b86
🔎 CONTRÔLÉ (bdcc5e4) : OK — marche arrière 4 s dans le parking après le choc du grillage : ★ 0, aucun accident, aucun constat (PC et TV) ; vaut aussi pour le n° 29.
- **Gravité** : GÊNANT
- **Reproduire** : dépôt municipal, △ sur la grue (24,4, 130,5), R2 2 s, stick gauche 1,5 s.
- **On voit** : accident, véhicule immobilisé, police, amende — les engins sont garés serrés et le moindre contact avec la benne voisine déclenche le constat.
- **Sonde** : `s13-pc.log` `grue.roule.msg = "💥 ACCIDENT ! …"`.

### 58. Tirer sur un habitant : « la police laisse passer (avertissement 1/4) »
✅ RÉPARÉ — trois choses : (1) la balle qui touche un habitant était déjà un crime grave (★ immédiate, `infraction(…, 1, 3)`), mais depuis le n° 61 le coup de feu lui-même affichait « tirer en pleine rue : la police laisse passer (1/4) » juste avant l'infraction — avec une PERSONNE verrouillée, seul l'impact est jugé ; (2) `attack()` ne regardait jamais les vitrines : le poing la fissure puis la brise (1,6 m devant soi) ; (3) une balle dans une vitrine vaut une ★ immédiate (`breakThing(…, parBalle)`), au poing ou en voiture les avertissements restent. Mesuré : cible verrouillée, 3 balles (❤️ 100 → 28) → ★1, 0 « laisse passer » ; poing : fissurée puis brisée ; balle : brisée, ★1. Test 395 ajouté
- **Gravité** : GÊNANT (jeu pour enfant : trois balles dans un passant sans réaction)
- **Reproduire** : L2 sur un habitant, R2 ×3 (100 → 28 PV).
- **On voit** : « ⚠️ tirer sur Lucas_2014 : la police laisse passer (avertissement 1/4) », `wanted = 0`. Idem trois coups de poing sur une vitrine ou un tir dans la vitrine : rien ne casse, personne ne vient.
- **Sonde** : `s8b-pc.log` `tir.wanted = 0` ; `s9-pc.log` `coupsVitrine.cassee = false`, `coupDeFeu.wanted = 0`.

### 59. Hélicoptère : ▢ pose l'appareil SUR un objet de la rue
✅ RÉPARÉ — la descente automatique (▢) se posait sur N'IMPORTE QUOI sous l'appareil. `heliPointLibre()` : on ne se pose que sur le sol ou un vrai toit (solide ≥ 8 × 8 m, pas un véhicule) et sinon l'hélico se décale sur la place libre la plus proche (cercles de 3 à 24 m), en restant à 1,5 m au-dessus des obstacles en chemin ; ▢ le dit (« je me décale sur une place libre »). Mesuré avec un objet de 3 × 2,4 × 7 m en (43, 51) : posé à y 2,49 SUR l'objet → posé à (38, 48) y 0,20 au sol, 0 dégât. Test 394 ajouté — commit 2f5d844
🔎 CONTRÔLÉ (bdcc5e4) : OK — hélico au-dessus de la rue commerçante (43, 52,9) à 28 m, ▢ : l'appareil se décale de 2,7 m et se pose au sol en (43, 50,2), y = 0,44, aucun solide dessous (avant : sur l'abribus) ; PC et TV (`img/p6/p6-04-heli-pose.png`).
- **Gravité** : GÊNANT
- **Reproduire** : héliport (43, −13), △, ◯ 4 s, stick avant 4 s, ▢.
- **On voit** : la descente automatique (« Atterrissage… ») se termine à y 0,21 en (43, 51) sur un solide de 3 × 2,4 × 7 m (abribus / mobilier) ; △ fait descendre le personnage à y 2,3, debout sur l'objet.
- **Capture** : `img/s14/s14-heli-4-au-sol.png`.

### 60. Le facteur fait sa tournée à pied à 25 km/h, le vélo reste au dépôt
✅ RÉPARÉ — conséquence du n° 52/53 : le vélo dormait dans la cour du dépôt dont la sortie était bouchée par le mobilier public (`coursService`, fe303fe). Mesuré : tournée à vélo (facteur à 0,2 m de son vélo pendant 60 s, vélo à 240 m du dépôt)
- **Gravité** : GÊNANT (promis au round 67 : le facteur, ses sacoches, son vélo)
- **Reproduire** : dépôt municipal (27, 122), suivre « Paulette » (`city.metiers`, `facteur`) 90 s.
- **On voit** : état `tournee`, elle traverse la ville à pied (26 m toutes les 5 s, soit 5 m/s+ sans courir), `b.drive = null` pendant les 90 s alors que le vélo de service (`kind: velo`) est garé en (40, 131) ; on ne voit ni sacoche ni courrier dans les mains. (Dans une autre partie, `img/s9b/s9b-9-fin.png`, on la voit bien à vélo : ce n'est donc pas systématique.)
- **Capture** : `img/s12/s12-0-facteur.png`, `img/s12/s12-1-facteur-40s.png`.
- **Sonde** : `s12-pc.log` `facteur[*].velo = false`.

### 62. Le viseur reste affiché quand l'arme est rangée
🔎 Revu round 70 : après ✕ (rengainer), `P.drawn = false` mais la pastille dit encore « 🔫 Pistolet 4/8 · 🎯 visée » (`l1b-pc.log` `tir.range`).
✅ RÉPARÉ — `P.lock` (donc le viseur) était calculé dès qu'une arme était ÉQUIPÉE ; il l'est maintenant seulement arme en main (`P.drawn`) — commit fe303fe
- **Gravité** : GÊNANT
- **Reproduire** : pistolet, L2 (viser), L2 (ranger), marcher.
- **On voit** : la petite croix rouge reste au milieu de l'écran avec l'arme dans l'étui (pastille « 🚩 Il te faut… », pas de « Pistolet »).
- **Capture** : `img/s9b/s9b-3-police-15s.png`, `img/s9b/s9b-4-police-30s.png`.

### 63. Le joueur perd 56 PV sans qu'on lui dise pourquoi
✅ RÉPARÉ — `hurt()` affiche « 🤕 −12 ❤️ · Momo_king » (dégâts ≥ 5, avec l'auteur ou « un coup ») ; mesuré sur un coup de bot — commit 5b3e586
🔎 CONTRÔLÉ (bdcc5e4) : OK — coup reçu d'un habitant qui se bat : « 🤕 −9 ❤️ · Karim_flash » à l'instant du coup (PC et TV, `img/p6/p6-00-coup-recu.png`).
- **Gravité** : GÊNANT
- **Reproduire** : après la voiture détruite (n° 61), rester au point d'apparition 40 s.
- **On voit** : `P.hp` 100 → 72 → 44 puis remonte tout seul à 100 ; aucun message, aucun « aïe », la barre verte descend sans raison visible (explosion à distance ? bagarre de bots ?).
- **Sonde** : `s9b-pc.log` `arrestation[3..7].hp` = 72, 44, 46, 66…

### 64. (retiré — fausse alerte : avec de vrais boutons (scénario 11c) les questions s'enchaînent, la maîtresse lit chaque question et dit « C'est gagné ! », la craie s'entend (`craieLit` 0,07), le score monte)

### 65. École : ◯ ferme la leçon mais le personnage reste assis
✅ RÉPARÉ — `fermeUI()` (◯, Échap, ✕ de la leçon) demande le saut qui fait quitter la chaise ; `closeUI()` seul ne lève personne, test 245 (803b82d) (`P.jumpBuf`) : ◯ ferme ET lève ; message du bouton mis à jour — commit fe303fe
- **Gravité** : GÊNANT
- **Reproduire** : assis en classe, leçon ouverte, ◯.
- **On voit** : la fenêtre se ferme, `P.sit` reste vrai, le message dit encore « 🪑 Assis (Espace / SAUT pour se lever) » — il faut un second ◯ (confirmé au scénario 11c : `leve1.sit = true`, `leve2.sit = false`), et la consigne parle d'« Espace ». À la manette, depuis les pastilles d'âge, ↓ saute sur la 2e réponse (« 2️⃣ cercle ») et non la 1re.
- **Sonde** : `s11b-pc.log` `leve = {sit: true, ui: null}`.

## CONTRÔLE DU JOUEUR SUR 541d0e0 (entrées 67 à 74, copiées de r70-joueur 15343e7)

### 67. « Entrer dans Marlon » met d'office l'enfant « dans la guerre » : le conseil 🚩 revient dès la première seconde
✅ RÉPARÉ — `startGame()` posait `guerre.vu = true` et affichait « … ouvre la carte avec M » : retirés ; message « 🏙️ Bienvenue à Marlon ! Balade-toi : △ pour agir… » (passe par ctrlText). Mesuré profil vierge : `guerre.vu = false`, `joueurDansLaGuerre() = false`, pastille « 🏙️ Balade · 0 pts » — commit 5976786
🔎 CONTRÔLÉ (bdcc5e4) : OK — profil vierge, PC et TV : `guerre.vu` faux, `joueurDansLaGuerre() = false`, pastille « 🏙️ Balade · 0 pts » pendant 30 s, plus de « carte avec M » (`p1-pc.log`, `p1-tv.log`, `img/p1/p1-01-3s.png`).
- **Gravité** : GRAVE (défait la réparation n° 3 : la première pastille d'un profil vierge parle d'un gang qu'il n'a pas)
- **Reproduire** : profil vierge, accueil, ✕ (« Entrer dans Marlon »), attendre 2 s au point d'apparition. Reproduit 2/2 (PC 1280×720 et TV 1920×1080).
- **On voit** : `#act` = « 🚩 Il te faut un membre de ton gang avec toi » de t+1 s à t+17 s (tronqué « 🚩 Il te faut un ... » en 1280), et le gros message « MARLON · Recrute un ami via les ordres ↑, puis ouvre la carte avec M ou le pavé PS5 » — la touche « M » à un enfant à la manette.
- **On devrait voir** : l'action du lieu (« 🏙️ Balade »), rien de la guerre tant que l'écran 🚩 n'a pas été ouvert (c'était la règle posée par la réparation n° 3).
- **Capture** : `img/c1/c1-2s.png`, `img/c1/c1-14s-tv.png`.
- **Sonde** : `c1-pc.log` / `c1-tv.log` `c3.acts = ["🚩 Il te faut un membre de ton gang avec toi"]`. Cause : index.html l. 23629 (`chooseWorld(4); guerre.vu = true; msg('MARLON · Recrute…')`) — `guerre.vu` vaut vrai avant même le premier pas, `joueurDansLaGuerre()` répond donc toujours vrai.

### 68. Le panneau « EMPIRE URBAIN » couvre le bas de l'écran en permanence, minuscule en TV, et parle de la touche « M »
✅ RÉPARÉ — `#empireHud` n'apparaît que pendant une opération ou une attaque ET une fois dans la guerre ; règles `body.tv` (largeur 30 vw, texte en unités --uh) ; le bouton dit « CARTE · ↑ tenu » quand une manette pilote. Mesuré profil vierge : `hidden = true`, display none — commit e4ac561
🔎 CONTRÔLÉ (bdcc5e4) : OK — `#empireHud` `hidden` pendant toute la partie d'un profil vierge (PC et TV).
- **Gravité** : GÊNANT (première minute ; en TV le texte fait 12 px sur un écran de 1080 lignes : illisible du canapé)
- **Reproduire** : entrer dans la Ville (profil vierge), regarder le bas de l'écran. Reproduit 2/2 (PC, TV).
- **On voit** : un cadre sombre de 390 px centré en bas : « EMPIRE URBAIN · 0/12 territoires · Centre-ville · objectif à 37 m · CARTE · M / PAVÉ PS5 », jamais effacé (il n'a pas de règle `body.tv`, ni de traduction manette : `#empireMapBtn` est un texte fixe l. 1110). Il se superpose aux chevrons de GPS et au message central quand ils descendent.
- **On devrait voir** : rien de l'empire tant que l'enfant n'a pas ouvert la carte ; sinon un panneau qui grossit en TV et dit « Pavé tactile » à la manette.
- **Capture** : `img/c1/c1-14s.png`, `img/c1/c1-14s-tv.png`.

### 69. La première voiture du parking fonce dans le grillage du terrain de foot : R2 tout droit = 🔧 +21 % en 5 s
✅ RÉPARÉ — voir n° 31 : R2 tout droit depuis la place → un seul « 💥 BOUM ! » contre le grillage (14 %), puis 14,6 % après 5 s gaz enfoncés (avant : 41 %). Les places regardent bien la rue z = 0 (le grillage du foot est juste derrière) — commit 9554688
🔎 CONTRÔLÉ (bdcc5e4) : OK conforme à la réparation, mais le piège reste — R2 5 s depuis la place : un seul « 💥 BOUM ! Gros choc contre le mur », 🔧 14,6 %, la voiture s'arrête dans le grillage du foot à z = 0,2 (PC et TV identiques, `img/p2/p2-00-r2-5s.png`). L'enfant qui appuie sur R2 en sortant du parking prend toujours 15 % de tôle dans les 3 premières secondes.
- **Gravité** : GÊNANT (suite du n° 26 : la voiture part maintenant, mais la sortie du parking est un mur)
- **Reproduire** : parking du centre (voitures en (−17,9…−8, 10), cap nord), △ pour monter, R2 à fond 5 s sans toucher au stick. Reproduit 2/2 (`c3` run 1 et run 2).
- **On voit** : run 1 — la voiture s'arrête contre le grillage du foot à 6 km/h, des cônes de chantier sont plantés sur la chaussée devant elle (`img/c3/c3-26-roule.png`) ; run 2 — 27 m/s atteints, 102 m parcourus en ricochant vers l'est jusqu'à la Zone industrielle, 🔧 +20,9 %. Dans les deux cas l'enfant qui « appuie sur le champignon » est puni dans les 3 premières secondes.
- **On devrait voir** : des places qui donnent sur la rue (cap est ou ouest, ou une sortie marquée) et une accélération plus douce sur les premiers mètres.
- **Sonde** : `c3-pc.log` `c26.gaz5s = {depl: 102.08, dmg: 20.87, spd: 27.12, cap: 1.08}`.

### 70. Au stick, sortir du parking du centre détruit la voiture : 🔧 100 % et incendie en 40 s, la dépanneuse l'emporte avec le conducteur éjecté
✅ RÉPARÉ — voir n° 31 : 40 s de conduite « comme un enfant » dans le parking → 🔧 17,7 %, pas d'incendie (avant 96,6 % et le feu) ; `enterCar` refuse une épave (« 🔥 Cette voiture est une épave… »). L'éjection à l'explosion a déjà un message (« 💥 Le véhicule a explosé ! ») — commit 9554688
🔎 CONTRÔLÉ (bdcc5e4) : OK — 40 s de conduite « comme un enfant » dans le parking : 🔧 +22,4 % (PC) / +18,2 % (TV), pas d'incendie, la voiture reste à l'enfant (cumul 49 % / 45 % avec le R2 du n° 69 : à ce niveau la carrosserie est déjà entièrement brun-noir, elle a l'air brûlée — voir n° 76).
- **Gravité** : GRAVE (la première voiture d'un enfant brûle avant même d'avoir quitté le parking)
- **Reproduire** : parking du centre, △ pour monter, puis conduire « vers le parc » comme un enfant (R2 à 80 %, stick pour viser le nord, frein quand ça part de travers) pendant 40 s. Reproduit 3/3 (`l1a` run 1 et run 2 en PC, `l2a` en TV, mêmes commandes).
- **On voit** : la voiture bute sur le grillage du foot et les tables du snack, les dégâts grimpent 2 % → 30 % → **96,6 %** en 41 s sans jamais dépasser 30 km/h, elle prend feu (run 1 : `img/l1/l1a-11-roule-garage.png`, carcasse en flammes devant la terrasse), le personnage se retrouve à pied à côté (run 2 : `car: false` à t+84 s, position (−12,8, 13,1)), puis « ⛓️ Véhicule chargé sur le plateau : direction le garage » — la dépanneuse emporte l'épave. Aucun message n'a dit à l'enfant pourquoi la voiture chauffait ni qu'elle allait brûler.
- **On devrait voir** : des dégâts proportionnels à la vitesse (rien sous 15 km/h), un avertissement clair (fumée, « 🔧 Ta voiture est abîmée : va au garage ») bien avant l'incendie, et une sortie de parking évidente.
- **Sonde** : `l1a-pc.log` `conduite[0] = {secondes: 41, dmg: 96.63, fin: [−16.2, 9.5]}` ; `bilan.defauts` : « ⚙️ A2 · 0 km/h · 🔧 100% » à t+84 s. En TV (`l2a-tv.log`) : `dmg: 100` à 41 s, le joueur éjecté a perdu 28 ❤️ (100 → 72) sans message, et △ le fait REMONTER dans l'épave (« ⚙️ A1 · 0 km/h · 🔧 100% »).

### 71. En jeu, la bague jaune de la manette reste posée sur le bouton du chat (haut gauche) pendant toute la partie
✅ RÉPARÉ — `navValide()` reposait une bague après un clic même sans fenêtre ouverte (d'où le 💬 encadré) ; plus de bague sans fenêtre, et `startGame()` efface celle de l'accueil — commit 3e84817
🔎 CONTRÔLÉ (bdcc5e4) : OK — `.focustv` = null dès l'entrée en ville et pendant 30 s (PC et TV) ; plus de cadre sur le chat (`img/p1/p1-01-3s.png`).
- **Gravité** : GÊNANT (l'enfant croit qu'il a « sélectionné » quelque chose ; ✕ ne fait rien d'utile)
- **Reproduire** : accueil, ✕ (« Entrer dans Marlon »). Reproduit 3/3 (`c1` PC, `c1` TV, `l1a`).
- **On voit** : `.focustv` passe de « Entrer dans Marlon » à `#chatBtn` dès l'entrée en ville et y reste (t+2 s, t+14 s, t+40 s) : cadre jaune permanent autour de l'icône 💬 en haut à gauche (`img/c1/c1-2s.png`, `img/c1/c1-14s-tv.png`, `img/l1/l1a-08-parking.png`). ✕ en jeu ne l'active pas (`croixEnJeu.ui = null`).
- **On devrait voir** : aucune bague hors des menus.
- **Sonde** : `c1-pc.log` `c4.apresX1.focus = "chatBtn:"`, `l1a-pc.log` `focusEnJeu.el = "chatBtn:"`.

### 72. La villa d'un joueur qui vient d'arriver est cambriolée : tout son porte-monnaie (25 🪙 → 0) disparaît sans qu'il ait rien vu
✅ RÉPARÉ — `declencheCambriolage` ne se lance que si le joueur a un homme (recruté ou libre) ou un quartier ; le butin est plafonné à la moitié du porte-monnaie ; sans alarme, message central « 🏠 Les Frelons Jaunes rôdent autour de ta villa ! Cours-y » + colonne bleue, et le bilan dit qui et pourquoi. Mesuré : profil neuf → rien ; avec un homme → message, beacon, 25 🪙 → 13 — commit 94973ac
🔎 CONTRÔLÉ (bdcc5e4) : OK — 28 🪙 à t+50 s, 28 🪙 à t+262 s après banque, commissariat, parc et rue commerçante, `city.villaMine` présent (PC et TV).
- **Gravité** : GRAVE (première partie : l'enfant perd tout son argent pendant qu'il visite la banque, sans explication visible)
- **Reproduire** : partie neuve, se promener 10 minutes loin de la villa (contrôle 2 : banque, hôpital…). **Dépend de `Math.random`** : à chaque décision d'un gang (`gangTick`, l. 26547), 7 % de chances de tirer une villa, et si c'est celle du joueur (`v.mine`) le cambriolage démarre et réussit 55 s plus tard si personne n'est à moins de 22 m. Vu 1 fois sur 6 parties de contrôle (`img/c2/c2-banque-2-regard.png` : « 💸 Cambriolage réussi : ils sont partis avec 25 🪙 », chat « 💸 La villa de Joueur42 a été cambriolée (−25 🪙) », porte-monnaie 0 dans le HUD) ; la sonde `c8.js` (hasard forcé à 0,8 pendant 200 s) n'a pas retiré la villa du joueur.
- **On voit** : seul avertissement, une ligne de chat « 🏠 Des ombres rôdent autour de ta villa… » (sans alarme achetée), à 175 m de là ; puis `wallet -= min(butin 60–240, wallet)` : un enfant à 25 🪙 perd tout.
- **On devrait voir** : pas de cambriolage tant que le joueur n'a rien mis dans sa villa ni ouvert la guerre des gangs, un plafond (jamais plus de la moitié, comme l'amende du n° 35) et une alerte visible (message central + GPS).

### 73. Le pavé tactile ouvre « EMPIRE · Carte stratégique » : un écran d'adulte, sans bague, coupé en bas en 1280×720
✅ RÉPARÉ — le pavé tactile ouvre l'AIDE des boutons (`PAD_CROIX[17] = 'aide'`, fiche lisible du n° 8) et plus la carte stratégique ; mesuré : pavé → `ui: null, aide: true`, la carte ne s'ouvre que par ↑ tenu et pose la bague sur « Fermer × » — commits 9ec9481, 27aa6bf, e4ac561
🔎 CONTRÔLÉ (bdcc5e4), carte stratégique par ↑ tenu : bague sur « Fermer × », ↓ parcourt les opérations puis les secteurs, ◯ ferme (PC et TV).
🔎 CONTRÔLÉ (bdcc5e4) : OK — le pavé ouvre la fiche « 🎮 Les touches de la manette » (520×504 px à 15 px en 1280×720, 806×694 px à 25,6 px en TV, dans l'écran), un second appui la ferme ; la carte stratégique ne s'ouvre plus (`img/p1/p1-03-aide.png`). Petit défaut : le radar saute du coin en bas à gauche au milieu du bas de l'écran pendant l'aide.
- **Gravité** : GÊNANT (c'est le bouton « aide » de l'enfant : il tombe sur un tableau de bord de stratégie)
- **Reproduire** : en ville à la manette, appuyer sur le pavé tactile. Reproduit 2/2 (PC 1280×720 et TV 1920×1080).
- **On voit** : le jeu en pause sous un grand cadre « EMPIRE · Carte stratégique — Contrôle les 12 secteurs, puis tiens la ville pendant 90 secondes · 🚩 0/12 · difficulté 🔥 palier 1/5 », une carte à 12 numéros, un encart « RENSEIGNEMENTS · SECTEUR », cinq cartes d'opérations (« Reconnaissance du Nord · PREMIÈRE RÉUSSITE · 120 pièces · 25 respect »…). La bague reste sur le bouton du chat derrière (`aide.focus = chatBtn`), il faut un premier ↓ pour qu'elle apparaisse sur « Fermer × ». En 1280×720 la dernière carte (« Tenir la ligne ») passe sous le bord de l'écran (`img/l1/l1a-04-aide.png`) ; en TV ça tient (bas à 1048 px sur 1080, `img/l2/l1a-04-aide-tv.png`). Aucun rappel des boutons de la manette nulle part (l'ancienne aide du n° 8 a disparu).
- **On devrait voir** : sur le pavé, la fiche des boutons PS5 (une ligne par bouton) ; la carte stratégique derrière un bouton nommé, avec la bague posée sur « Fermer » ou le premier choix.
- **Sonde** : `l1a-pc.log` / `l2a-tv.log` `aide = {ui: "guerre", focus: chatBtn, croixBas: [empireClose:Fermer ×, operation:…]}`.

### 74. ↑ (ordres) : l'écran « 📣 À qui donner un ordre ? » n'a pas de bague, dit « Clique sur quelqu'un » et sa liste est coupée
✅ RÉPARÉ — la bague part sur la première carte d'habitant (`navPremier`, n° 43/71) ; à la manette la consigne dit « Choisis quelqu'un avec la croix, puis ✕ » au lieu de « Clique » ; la grille défile (52 vh) et la fenêtre tient en 1280×720 (bas de carte à 641 px). Mesuré : focus `ocard:Karim_flash`, 12 cartes — commit 6dca9df
🔎 CONTRÔLÉ (bdcc5e4) : OK — bague sur la première carte d'habitant (`ocard:Lucas_2014`), consigne « Choisis quelqu'un avec la croix, puis ✕ », bas de fenêtre à 511 px sur 720 (PC) / 732 sur 1080 (TV). Reste : → depuis la première carte saute sur « Fermer » au lieu de la carte suivante.
- **Gravité** : GÊNANT (à la manette, l'enfant ne peut désigner personne ; c'est pourtant l'entrée du recrutement promis par le message d'accueil « Recrute un ami via les ordres ↑ »)
- **Reproduire** : en ville, appui court sur ↑. Reproduit 2/2 (PC 1280×720, TV 1920×1080).
- **On voit** : douze cartes d'habitants (« Momo_king 4 m »…), la bague `.focustv` reste sur le bouton CACHÉ « Fermer × » de la carte stratégique (`focus.visible = false`), la consigne dit « Clique sur quelqu'un… Tu peux aussi écrire son nom dans le chat », et la 4e rangée de cartes passe sous le bord de la fenêtre en 1280×720 (`img/l1/l1c-14-ordres.png`).
- **On devrait voir** : la bague sur la première carte, ↓/→ pour changer, ✕ pour choisir, une fenêtre qui défile ou tient dans l'écran.
- **Sonde** : `l1c-pc.log` / `l2c-tv.log` `ordres.focus = {el: "empireClose:Fermer ×", visible: false}`.

## COSMÉTIQUE

### 10. Les bots parlent de lave et de tennis dans la Ville
✅ RÉPARÉ — en ville les habitants tirent leurs phrases de `CHAT_IDLE_CITY` (plus de lave ni de tennis hors contexte) ; mesuré : 0 « lave » sur 40 phrases au point d'apparition — commit 6a3a769
- **Reproduire** : rester 12 s au point d'apparition, lire le chat.
- **On voit** : « Karim_flash : la lave c chaud », « Sarah_bee : qui a déjà fini ? », « Tom_le_ouf : je suis à 🎾 Tennis, on joue jouer au tennis ! » (faute : « on joue jouer »), « 🚩 Les Requins Rouges contrôle maintenant Zone industrielle » (accord : contrôlent).
- **Capture** : `img/s1/s1-apres-12s.png`, `img/s1/s1-premier-regard.png`.

### 11. Sur l'écran d'accueil, un bot du décor est collé contre la caméra
🔎 CONTRÔLÉ : OK — caméra d'accueil en (0,4, 4,5, 12,1), habitant le plus proche à 7,3 m (PC) / 6,7 m (TV) ; plus de géant au premier plan (`c1-accueil.png`).
✅ RÉPARÉ — la caméra du salon (`camPerche`, branche `!running`) était à 5,2 m presque à plat : le dernier rang de la foule (z = 6,9) passait à 1 m de l'objectif ; elle recule à 9,5 m, un peu plus haut (habitant le plus proche > 4 m) — commit 5eac31d
- **Reproduire** : charger la page.
- **On voit** : un personnage géant (blond, tenue blanche) qui occupe un tiers de l'écran au premier plan, devant le panneau « 1 · Sauts ».
- **Capture** : `img/s1/s1-accueil.png`, `img/s1/s1-accueil-tv.png`.

### 12. La pastille « ⭐ 0· 🚩 0/8 » a un point médian orphelin
✅ RÉPARÉ — `&nbsp;·` dans `#respect` : la pastille lit « ⭐ 0 · 🚩 0/8 » (mesuré en TV) — commit 6a3a769
- **On voit** : en TV « ⭐ 0· 🚩 0/8 » (le séparateur « · » colle au 0).
- **Capture** : `img/s1/s1-premier-regard-tv.png`.

### 13. L'accueil : le mode d'emploi PS5 est un pavé de 25 lignes
🔎 CONTRÔLÉ : OK — `<details>` « ⌨️ 🎮 Comment jouer » replié au chargement, ligne PS5 de 8 mots (`c1-accueil.png`).
✅ RÉPARÉ — le paragraphe de 250 mots est réécrit en 7 lignes courtes (à pied / au volant / en hélico / croix / menus), et tout le mode d'emploi est replié derrière « ⌨️ 🎮 Comment jouer » — commit 5eac31d
- **On voit** : sur l'accueil, la ligne « 🎮 PS5 » est un paragraphe compact de ~250 mots en 11 px ; personne ne le lit. En TV il occupe la moitié de la carte.
- **Capture** : `img/s1/s1-focus-jouer.png`, `img/s1/s1-accueil-tv.png`.

### 19. Météo incohérente : « ❄️ Chute de neige » à 10 h en plein soleil, puis « ☀️ Beau temps » deux minutes plus tard
✅ RÉPARÉ — le chat annonce ce qui ARRIVE (« La pluie arrive sur la ville », « La neige arrive », « Le beau temps revient ») au moment du changement, plus un état déjà passé — commit 12e38c4
- **Capture** : `img/s2/s2-avant.png` (chat « ❄️ Chute de neige », ciel bleu).

### 20. Un carré de pelouse vert vif déborde sur le trottoir à l'angle sud-est du terrain de foot (vers (8, 10))
✅ RÉPARÉ — la pelouse des trampolines (SE) mesurait 20 m et recouvrait les trottoirs (30 cm de haut sur 14 cm) jusqu'à la chaussée ; elle fait 16,4 m et s'arrête au bord du trottoir, le panneau 🤸 recule sur l'herbe. Mesuré en (8, 4) : dessus = pelouse verte y 0,30 → trottoir y 0,14 — commit f6e7672
- **On voit** : rectangle vert plat posé par-dessus le trottoir gris et la bordure, arête franche (bas droite de `img/s2/s2-fin-tv.png`).

### 25. Petits défauts vus dans les bâtiments
✅ RÉPARÉ — banque : les écrans du guichet et du comptoir d'accueil ont un socle et une tige posés sur le comptoir (écran bas 1,73 m sur tablette 1,575 m), la lampe a un pied et une tige sous son abat-jour (plus de cône « pyramide » posé à plat) ; hôpital : lignes de guidage à 0,4 m au lieu de 2 m ; concessionnaire : Gérard Boulon sans chapeau melon ni lunettes (mesuré : 0 chapeau visible, lunettes false). L'étiquette « Joueur40 » sur le panneau COFFRES est la pancarte du joueur lui-même vue depuis l'escalier, pas un défaut du bâtiment — commit 8a3ebc0
- Banque : écrans d'ordinateur qui flottent sans pied sur le guichet, « pyramide » jaune posée sur le comptoir (`img/s3/s3-banque-1-porte.png`) ; étiquette « Joueur40 » qui recouvre le panneau « COFFRES · 2e ÉTAGE » (`img/s3/s3-banque-escalier-haut.png`).
- Hôpital : bandes de sol cyan et verte de 2 m de large qui ressemblent à des tapis, sans explication (`img/s3/s3-hopital-2-dedans.png`).
- Concessionnaire : le vendeur « Gérard Boulon » porte chapeau melon et lunettes noires derrière son comptoir (`img/s3/s3-concessionnaire-2-dedans.png`).

### 34. Fautes de frappe et d'accent dans les phrases des bots
✅ RÉPARÉ — « pièces », « déjà piloté l'hélico », « on va jouer au tennis », `auLieu()` (« au Quartier résidentiel », « à la Zone »), « contrôlent » (le gang est pluriel) — commit 6a3a769
- « Tu as combien de pieces ? » (pièces), « Tu as deja pilote l'helico ? », « on joue jouer au tennis / au foot », « je te retrouve à Quartier résidentiel » (au), « Les Requins Rouges contrôle » (contrôlent).
- **Capture** : `img/s4/s4-8-voiture.png`, `img/s3/s3-banque-1-porte.png`.

### 47. Après l'achat, en mode TV, tout l'écran est teinté jaune
✅ RÉPARÉ — la verrière du concessionnaire (`verre`, `camMur: true`) n'est plus traversée par la caméra : c'est elle qui teignait l'écran en jaune quand la caméra passait dedans — commit 61df87c
- **Reproduire** : acheter une voiture (aire de livraison (−125, 121)), mode TV.
- **On voit** : la caméra (plus reculée en TV, `cam.dist` 8,4–9,4) se retrouve sous la verrière jaune du concessionnaire : l'image entière est jaune-sépia.
- **Capture** : `img/s6/s6-3-achetee-tv.png` (comparer `img/s6/s6-3-achetee.png`).

### 66. La maîtresse lit les points de suspension : « Un ballon de football a la forme d'une et ensuite ? »
✅ RÉPARÉ — `schDire` remplace « …? » par « quoi ? » : la maîtresse lit « Un ballon de football a la forme d'une quoi ? » (mesuré) — commit 6a3a769
- **Reproduire** : classe Géométrie, question « Un ballon de football a la forme d'une… ? ».
- **On voit / entend** : la synthèse vocale reçoit « …forme d'une et ensuite ? ... Réponse un : cube… » — le « … » est remplacé par « et ensuite ».
- **Sonde** : `s11c-pc.log` `reps[2].dits[1]`.

---

## Scénario 15 (sauvegarde et rechargement) — rejoué round 70 sur la version intégrée (`s15.js` + `s15b.js`, `s15-r70-pc.log`)
- Achat d'une citadine (700 → 620 🪙), pistolet, respect 130, Parc conquis ; Prairie → Glace → Ville : tout est conservé (`wallet 621`, `arme:pistol`, voiture `mienne`, `rep 130`, `parc: joueur`).
- Fermeture et réouverture du jeu (rechargement de la page) : accueil avec 621 🪙, puis « 💾 Partie rechargée : 621 🪙 · ta voiture au garage · 1 achat », la citadine est bien dans le garage de la villa (48, 179) sans dégâts, les territoires sont retrouvés. ✅ Rien de cassé.
- Seule remarque : le message « 💾 Partie rechargée : N 🪙 » revient à CHAQUE reconstruction de la ville (retour d'un autre monde) dès qu'une sauvegarde existe — pour un enfant qui revient de la Prairie ce n'est pas un « rechargement ».

### 75. Un chef de gang donne rendez-vous à un enfant qui vient d'arriver (« la colonne bleue t'y emmène ») et son gang « le cherche » dès la première demi-minute
- **Gravité** : GÊNANT (première minute ; contredit la règle du n° 67 : rien de la guerre tant que l'écran 🚩 n'a pas été ouvert)
🔎 REVU (9a05d87) : TOUJOURS LÀ — profil vierge, 2/2 : « 🤝 Rocco le Rouge (Les Requins Rouges) te donne rendez-vous à la fête foraine — la colonne bleue t'y emmène » à ~4 min en TV, et dans les 30 premières secondes le chat annonce « 🚩 Les Requins Rouges attaquent Les Frelons Jaunes ! » (PC et TV). `guerre.vu` est pourtant faux (`q1-pc.log`, `q1-tv.log`).
- **Reproduire** : profil vierge, ✕ sur l'accueil, se balader 4 minutes sans rien faire d'autre. Reproduit 2/2 (PC 1280×720 à t+~250 s : « 🤝 Gina Grelot (Les Requins Rouges) te donne rendez-vous à La Zone — la colonne bleue t'y emmène » ; TV 1920×1080 à t+~250 s : « 🤝 Tonio Turbo (Les Requins Rouges) te donne rendez-vous à la fête foraine… »). En TV, dans les 30 premières secondes de chat : « 🚩 Les Requins Rouges te cherchent… », « 🚩 Les Frelons Jaunes attaquent Les Requins Rouges ! » ; en PC « 🚩 Les Frelons Jaunes te cherchent… » à ~4 min.
- **On voit** : gros message central + colonne bleue GPS vers La Zone / la fête foraine ; `guerre.vu` est pourtant faux et le joueur n'a ni respect ni recrue.
- **On devrait voir** : aucune réunion, aucun « te cherchent » avant que l'enfant soit entré dans la guerre (même garde que `captureTick` / `declencheCambriolage`).
- **Sonde** : `p1-pc.log` / `p1-tv.log` `bilan.msgs[dernier]`, `attente30.chatViolence` (TV).

### 76. Voiture à l'arrêt ou au pas : la caméra est collée au toit (1,9–3 m), l'écran est rempli par la carrosserie — qui a l'air carbonisée dès 45 % de dégâts
- **Gravité** : GÊNANT (après chaque choc, l'enfant ne voit plus que le toit de sa voiture et croit qu'elle a brûlé)
- **Reproduire** : voiture du parking, choc contre l'immeuble Centre-ville, rester à 0–1 km/h. Reproduit 2/2 (PC 1280×720, TV 1920×1080).
- **On voit** : caméra à 2,99 m (PC) / 1,85 m (TV) de la voiture au 1er relevé, le toit et le capot occupent les deux tiers de l'image (`img/p2/p2-02-choc-mur.png`, `p2-02-choc-mur-tv.png`) ; la carrosserie est uniformément brun-noir à 🔧 49–70 % alors qu'il n'y a ni feu ni fumée.
- **On devrait voir** : un recul minimal de ~5 m même à l'arrêt (la réparation n° 32 a réglé « recul = vitesse × 1,2 », donc rien à 0 km/h), et une teinte de dégâts qui reste une voiture cabossée (bosses, phares cassés) et non une carcasse.
- **Sonde** : `p2-pc.log` `p32.releves[0].dist = 2.99`, `p2-tv.log` `p32.releves[0].dist = 1.85`.

### 77. Se faire emmener par un habitant : on n'arrive jamais, la voiture s'arrête en route et l'enfant se retrouve debout sur la chaussée sans un mot
✅ RÉPARÉ — racine : `botDriveTick` fait dire au conducteur qu'il renonce après douze secondes sans avancer, mais le filet de sécurité qui repose le véhicule quelques mètres plus loin remettait `st.bloqueT` À ZÉRO toutes les 3,5 s : le seuil était inatteignable et l'enfant restait assis dans une voiture arrêtée, sans un mot. Le filet retire maintenant les 3,5 s consommées au lieu d'effacer l'ardoise. Mesuré (test 475, quatre promesses sur le même trajet) : distance SUR LE TRACÉ 396,3 m → 6,7 m en 59,3 s simulées (relevés toutes les 12 s : 396 → 282 → 144 → 63 → 43 m), remontée cumulée 1,1 m (la plus forte : 7 cm) là où le relevé du joueur montait de 115 à 146 m ; arrivée annoncée (« voilà, on est arrivés à ta villa ») ; 0 image sur 3 560 où le joueur n'est plus passager et 0 à plus de 4 m de la caisse ; abandon annoncé (« je ne peux pas approcher plus près…, on s'arrête là ») — commit daad0be
- **Gravité** : GRAVE (fonction promise « monte à côté de X » : le trajet n'aboutit pas)
- **Reproduire** : point d'apparition, attendre la proposition « 🚗 △ : monter à côté de <nom> », △, puis ne rien faire. Reproduit 2/2 (`q2-pc.log` Chloe_mia, `q3-pc.log` Nathan_pro).
- **On voit** : run 1 — « 🚗 Chloe_mia conduit vers Caserne · 115 m » puis 124, 127, 127, 127, 128, **141, 146 m** : la distance AUGMENTE pendant 24 s, on s'éloigne du but. Run 2 — « Nathan_pro conduit vers Quartier résidentiel · 225 m » → 217 m, puis la voiture reste immobile en (20,3 ; 1,0) pendant 12 s, repart, descend jusqu'à 116 m, remonte à 124 m, et à t+45 s la pastille repasse à « 🚗 △ : monter » : le joueur a été **débarqué en pleine rue** (voiture arrêtée en (7,9 ; 108,5), qui n'y bouge plus pendant 15 s) sans aucun message.
- **On devrait voir** : une distance qui diminue, une arrivée annoncée (« Arrivés à … »), et si le conducteur abandonne, une phrase qui le dit.
- **Capture** : `img/q3/q3-covoit.png`, `img/q2/q2-covoit-0.png`.

### 78. Un gang tue un enfant qui ne fait RIEN dans les deux premières minutes, et le jeu reste bloqué à 0 ❤️ pendant trois minutes
✅ RÉPARÉ — deux racines. (a) `gangTick` lançait la branche « joueur » et les embuscades sur un profil vierge : même garde `joueurDansLaGuerre()` que les n° 67 / 72 / 75. Mesuré (test 459) : sur 7200 pas de simulation manette posée, 0 image où un gang le cherche, 0 homme lancé sur lui, 0 homme à portée de coup ; et 0 sur 80 décisions à tirage forcé. (b) le retour en jeu pendait à `setTimeout(respawn, 1200)`, un minuteur du navigateur invisible pour la simulation : s'il ne part pas, `dead` reste vrai pour toujours et, comme `frame()` calcule `active = … && !dead`, `step()` ressort aussitôt — plus rien ne peut en sortir. Reproduit sur la version d'avant : ❤️ 0, position et porte-monnaie figés (18 🪙) pendant 200 s de simulation. Maintenant `relevageTick()` (appelé à chaque pas, AVANT la sortie `!active`) passe par une seule fonction `remiseEnJeu()` : lâche volant/siège/brancard, réveil à l'accueil de l'hôpital, 6 s d'invulnérabilité et un message. Mesuré (test 458) : debout à 1,6 s de simulation, 100 ❤️, à 199,8 m de ses trois agresseurs, toujours debout 60 s plus tard — commit 5670006
⚠️ RESTE : l'ambulance appelée pour le joueur met plus de deux minutes à arriver (mesuré : 200 m → 90 m en 60 s de simulation, vitesse instantanée 4–10 m/s mais trajet en lacets). Elle n'est plus BLOQUANTE (l'enfant se relève avant), mais le trajet des véhicules de service relève du poste Conduite.
- **Gravité** : BLOQUANT (profil vierge, manette : on ne joue plus, on regarde son personnage à terre)
- **Reproduire** : profil vierge, ✕ sur l'accueil, poser la manette et ne toucher à rien au point d'apparition. Reproduit 2/2 (`q1-pc.log` : −8 puis −9 ❤️ « Les Requins Rouges » à ~3 min, porte-monnaie 28 → 20 ; `q4-pc.log` : −9 ❤️ « Les Frelons Jaunes » à t+110 s, puis 91 → 41 → 5 → **0 ❤️ à t+125 s**, porte-monnaie 25 → 18).
- **On voit** : trois membres du gang (bonnets jaunes, pistolet à la main) collés au joueur au point d'apparition (`img/q4/q4-agression.png`) ; la pastille dit seulement « 🤕 −9 ❤️ · Les Frelons Jaunes ». À 0 ❤️ : « 🚑 Une ambulance a été appelée », et **plus rien ne change pendant les 175 s suivantes** — `P.hp` reste 0, aucun écran de mort, aucune réapparition, aucun bouton ; le jeu est fini pour l'enfant sans qu'il ait appuyé sur un bouton.
- **On devrait voir** : aucun gang qui s'en prend à un joueur qui n'est pas entré dans la guerre (même règle que les n° 67 / 72 / 75) ; et si le personnage tombe, une remise en jeu rapide et annoncée (hôpital, « tu te relèves… »), jamais trois minutes d'immobilité.
- **Sonde** : `q4-pc.log` `agression.suivi` (t 110 → 300 s, `hp` 0, `wallet` 18), `q1-pc.log` `bilan.msgs`.

### 79. On écrase ses propres passagers en démarrant : trois amis assis dans la voiture, ★★★ et « chauffard ! » au premier mètre
- **Gravité** : GRAVE (la nouveauté « on monte à quatre » se retourne contre l'enfant : il devient recherché en avançant de trois mètres)
- **Reproduire** : parking du centre, ↑ → « ⭐ Devenir ami » puis « 🫡 Suis-moi » sur trois habitants, △ pour monter, attendre qu'ils s'installent (« 🚗 Lucas_2014, Ines_gg, Sarah_bee montent avec toi · 4 places »), puis R2 à 30 % pendant 6 s. Reproduit 2/2 (`q5-pc.log`, `q6-pc.log`).
- **On voit** : les trois passagers sont bien assis dans l'habitacle (mesuré : au-dessus du plancher, à moins de 1,4 m de l'axe), et pourtant le jeu les compte comme des piétons renversés : « 🚔 La police recherche Joueur11 (écraser Lucas_2014) », « (écraser Ines_gg) », « (écraser Sarah_bee) », bulles « aïïïe ! », « tu m'as écrasé ! », « chauffard !! » AU-DESSUS de la voiture, ★★★ « la police arrive dans 21 s », et leurs points de vie tombent de 100 à 40,9 (`img/q6/q6-amis-1-avance.png`).
- **On devrait voir** : les passagers d'un véhicule ne peuvent pas être écrasés par ce véhicule.
- **Sonde** : `q6-pc.log` `amis.apresAvance = {wanted: 3, hpAmis: [Lucas_2014:40.94, Ines_gg:40.94]}` alors que `dedans` les liste toujours dans la voiture.

### 80. Immeuble de La Zone : on monte au 1er étage et on ne peut pas aller plus haut — ou l'on retombe au rez-de-chaussée
✅ RÉPARÉ — deux causes, mesurées. (1) BLOCAGE : toutes les marches étaient franchissables (0,32 m contre 0,60 m au pas du joueur) ; ce qui manquait, c'était la PLACE pour faire demi-tour. Le palier du 1er était fermé au sud par son garde-corps et le couloir entre le bout du limon (z 13,03) et ce garde-corps (z 14,58) ne faisait que 0,75 m — le joueur qui continuait tout droit butait en (−157,10 ; 3,40 ; 14,11), exactement le point du QA. Le palier d'étage se prolonge maintenant dans la coursive (couloir 0,75 → 2,68 m) et le palier de demi-tour est allongé vers le nord (0,68 → 1,78 m) ; la coursive court sur TOUTE la façade (la porte de l'appartement ouest donnait dans le vide). (2) CHUTE : le garde-corps sud du palier est une boîte de 3,50 m de long ; le joueur qui mordait dedans de 9 cm était « au milieu » au sens de l'axe x, et `moveAxis` le renvoyait à la face x la plus proche — 1,48 m plus loin, hors de la cage, d'où il tombait de 3,34 m (mesuré en −156,40 ; 3,45 ; 14,20 → −154,92 ; 0,06, sur 8 directions sur 8). `moveAxis` compare désormais la sortie x ET la sortie z et n'éjecte que sur l'axe le plus court. Mesures après : montée du trottoir au 2ᵉ étage (y 6,60) puis entrée dans l'appartement, 0 blocage ; 22 poussées en marche et en course contre les 41 tronçons de garde-corps : 0 traversée, 0 chute, 0 escalade — tests 459 à 461
- **Gravité** : GÊNANT (l'escalier refait promet le 2ᵉ étage et les appartements)
- **Reproduire** : immeuble (−169, 10), cage d'escalier adossée à la façade est (palier x = −158,4, pied z = 14,8) ; monter la volée nord puis redescendre la volée sud jusqu'au palier du 1er, puis pousser le stick vers le nord pour continuer. Reproduit 2/2 (`q5-pc.log`, `q6-pc.log`).
- **On voit** : run 1 — palier du 1er atteint (y 1,80 puis 3,08), puis en continuant le personnage se retrouve à **y 0,06** (retombé au rez-de-chaussée, x −155,3, hors de la cage) ; run 2 — palier du 1er (y 3,08 → 3,40) puis **bloqué 10 s** en (−156,5 ; 14,1) sans monter d'un centimètre. Dans les deux cas le 2ᵉ étage (y > 6) n'est jamais atteint et aucun appartement n'est visité.
- **On devrait voir** : la deuxième volée accessible depuis le palier du 1er, sans chute ni blocage.
- **Sonde** : `q5-pc.log` `zone.montee.trace`, `q6-pc.log` `zone.suite` (y figé à 3,40 pendant 10 s).

### 81. On monte dans une voiture du parking : l'écran est entièrement bouché par les carrosseries voisines, on ne voit plus rien
✅ RÉPARÉ — ce n'étaient pas les voitures voisines : les deux « aplats rouge vif et gris clair » sont les RAYURES de l'auvent du snack, vu de l'intérieur. Fabriqué à la main dans `shop()` (`new THREE.Mesh`), il n'était ni un solide ni un « toit de caméra » : la perche le traversait. Scène du QA refaite à l'identique — 88,9 % des 144 rayons du champ butaient sur un objet à MOINS DE 1,80 m de l'objectif (l'auvent à 15 cm, 8,2 × 0,6 × 1,4 m en (−9,5 ; 3,5 ; 15,4)) ; maintenant **0 %**, la perche MONTE de 0,32 rad au lieu de reculer et se pose à 3,73 m (2,99 m derrière, 4,19 m de haut), on voit sa voiture et la rue 12 m devant, toutes deux dégagées et dans le cadre. Trois corrections : l'auvent du magasin ET le parasol de la terrasse entrent dans `camToits`, les carrosseries entrent dans `camLibres`/`murEntreVue`/le garde-fou (vers la voisine à 3,3 m : 1,8 m et 2,1 m, contre 6 m et −1 avant), et la montée au volant part sur la PLACE LIBRE derrière et plus seulement sur la distance obtenue. Test « au volant d'une voiture garée entre deux autres, l'écran n'est plus bouché ».
- **Gravité** : GRAVE (première voiture d'un enfant : au moment où il monte, il n'a plus d'image)
- **Reproduire** : parking du centre, se placer derrière une voiture, △ pour monter, ne rien faire. Reproduit 2/2 (`q6` avec trois passagers, `q7` seul au volant).
- **On voit** : 100 % de l'image est occupée par deux aplats (rouge vif et gris clair) — les voitures garées de part et d'autre ; on ne voit ni sa voiture, ni la route, ni les passagers. Seuls le chat, le radar et la barre du haut restent lisibles (`img/q7/q7-cam-0-arret.png`, `img/q6/q6-amis-0-attente.png`). L'image ne se dégage qu'en roulant (à 0,6 km/h la caméra est à 7,3 m, à l'allure la vue redevient normale).
- **Mesure** : à l'arrêt la sonde donne pourtant une caméra à 5,39 m derrière la voiture, 3,73 m de haut, hors de l'habitacle — le problème n'est pas la distance mais la hauteur : la perche passe entre deux voitures garées au lieu de monter au-dessus.
- **On devrait voir** : la voiture et la rue devant, comme dès qu'on roule.

### 82. La police « abandonne les recherches » douze secondes après le coup de feu, sans avoir bougé, à 37 m du joueur immobile
✅ RÉPARÉ — racine mesurée : `PERTE_DELAI(★)` vaut 12 s alors que le délai d'intervention `police.reactT` vaut 14 s — le compteur de perte de vue partait dès l'infraction, la recherche s'arrêtait donc DEUX SECONDES AVANT DE COMMENCER, voitures encore au commissariat (sonde : `act=false` tout du long, 0 agent, ★ → 0 à t+12 s, exactement le relevé du contrôleur). Le compteur ne tourne plus tant que `reactT` court, et il lui faut désormais une vraie raison (`joueurSestCache()` : un toit, un obstacle, ou plus de 38 m parcourus depuis le dernier point connu). Une voiture arrivée sur place dépose enfin des agents sans exiger `police.sait` (sauf s'il s'est planqué sans être vu entrer, pour ne pas tuer la fuite). Mesuré après (test 461) : à découvert et immobile, plus aucun abandon sur 40 s, les voitures s'élancent à t+14 s, la plus proche vient à 13,6 m, 2 agents descendent à t+18,4 s et l'enfant est arrêté à t+25,7 s ; caché dans une planque à 155 m du délit, ils perdent bien sa trace à 26 s — commit 5670006
- **Gravité** : GRAVE (le scénario « je tire, la police me poursuit, je me cache » ne peut pas avoir lieu)
- **Reproduire** : se placer à 45 m du commissariat (−54, 45), dégainer le pistolet, L2, trois fois R2 sur un habitant, puis ne plus bouger. Reproduit 2/2 (`q7-pc.log`, `q7-tv.log`).
- **On voit** : « 🚔 Infraction : tirer sur Lucas_2014 ! Niveau ★ — file, ils arrivent dans 14 s » à t+4 s, puis à **t+12 s** « 🙈 Ils t'ont perdu : la police abandonne les recherches » — alors que le joueur n'a pas fait un pas et qu'une voiture de police est à 38 m. Les deux voitures restent ensuite figées à 37,03 m et 38,30 m pendant 48 s, aucun agent ne descend, ★ retombe à 0.
- **On devrait voir** : une voiture qui vient sur place, un agent qui descend, et une recherche qui ne s'arrête que si l'enfant se cache vraiment.
- **Sonde** : `q7-pc.log` / `q7-tv.log` `police.suivi` (`voitures` constantes, `wanted` 1 → 0 à t+12 s).

### 83. Un membre de gang abattu à l'arme est annoncé « mis KO » alors qu'il meurt et disparaît
✅ RÉPARÉ — `gangeurKO` écrivait « a mis KO » quel que soit le geste, alors que le paramètre `assomme` tranche déjà. Le message suit maintenant la situation : « 😵 X a assommé Y » aux poings (il se relève à 26 s), « 💀 X a tué Y » à l'arme (`m.abattu`, corps effacé, départ définitif) — et un simple homme de main, qui tombait jusqu'ici sans un mot, a droit à la même phrase. Mesuré (test 460) — commit 5670006
- **Gravité** : COSMÉTIQUE (mais l'enfant ne comprend pas ce qui s'est passé : il croit l'avoir seulement assommé)
- **Reproduire** : pistolet, L2 sur le chef d'un gang, R2 jusqu'à ce qu'il tombe. Reproduit 3/3 (`q2-pc.log`, `q7-pc.log`, `q7-tv.log`).
- **On voit** : au 9ᵉ coup, « 💥 Joueur44 a mis KO Marco Cent-Clés, chef des Les Frelons Jaunes » et « 🚩 +30 points de réputation (chef à terre) » ; puis, quinze secondes plus tard, le corps disparaît, l'homme est marqué mort et il a quitté le gang définitivement. Rien n'a dit qu'il était mort.
- **On devrait voir** : un message qui distingue l'assommé (poings) du mort (arme à feu), puisque le jeu, lui, fait bien la différence.
- **Sonde** : `q7-pc.log` `gang.abattu = {ko: true, mort: false, msg: "chef à terre"}` puis `gang.corps` : invisible et `mort: true` à t+15 s.

### 84. Un habitant ordinaire met l'enfant KO alors qu'il ne fait rien — la moitié du n° 78 qui reste
✅ RÉPARÉ — QUI FRAPPAIT : l'activité « bagarre » de la vie de la ville (`lancerActivite`, `ACTIVITES` poids 7). Sa toute première ligne disait « il s'en prend au joueur, ou à un autre bot si le joueur est loin » : à moins de 45 m, six fois sur dix c'était LE JOUEUR, sans aucune condition. Le bot passait en `fight = 'chase'` et `combatTick` lui faisait porter un coup de 9 ❤️ toutes les 1,1 s (`hurt(9, b.name, …)`) jusqu'au KO et au vol de pièces. Mesuré AVANT, profil vierge, manette posée : sur 10 tirages « bagarre » forcés à moins de 45 m, **10 partaient sur le joueur, 0 sur un autre habitant**. Réparé par la même règle que pour les gangs (n° 78) : `joueurAProvoque()` — recherché par la police, délit de moins de 20 s, arme dégainée, ou entré dans la guerre des gangs. Sans ça, la bagarre a bien lieu, mais entre deux habitants. Un filet de sûreté dans `combatTick` coupe en cours de route toute poursuite `'chase'` (le seul état posé par cette activité) dès que l'enfant redevient propre, sauf si le bot a une `rancune` — posée uniquement par un coup DU JOUEUR (poing, lame, sa balle, son chien, sa voiture), 45 s. Mesuré APRÈS (test 467) : 14 400 pas de simulation manette posée, relevés à chaque pas, **0 image où un habitant est lancé sur lui, 0 image à portée de coup, ❤️ au plus bas 100, ★ 0** ; tirage forcé sur 10 habitants : **0 sur le joueur, 10 sur un autre habitant** (la ville vit toujours) ; le même tirage après un coup porté par l'enfant : **10 sur le joueur** — la provocation marche encore
- **Gravité** : BLOQUANT (même scénario que le n° 78 : profil vierge, manette posée, l'enfant ne touche à rien)
- **Reproduire** : profil vierge, point d'apparition, ne rien faire pendant 120 s.
- **On voit** : relevé DANS le test 459 du banc d'essai (celui qui prouve que les gangs, eux, laissent l'enfant tranquille) : « 🤕 −9 ❤️ · Karim_flash | 🚑 Une ambulance a été appelée | 🤕 −9 ❤️ · Karim_flash | **😵 KO par Karim_flash ! −7 🪙** ». Karim_flash n'est pas un homme de gang : c'est un habitant. La garde `joueurDansLaGuerre()` posée pour le n° 78 ne couvre que `gangTick` ; la bagarre ordinaire des habitants n'a aucune garde équivalente.
- **Conséquence mesurée** : dans la suite complète, le test de caméra 463 est tombé pour cette seule raison — l'enfant a été mis KO pendant les 7 s de mesure, le chien de garde du n° 78 l'a réveillé à l'hôpital, et la caméra s'est retrouvée **à 159 m de la voiture** au lieu de 3 m. Lancé seul, le même test est vert.
- **On devrait voir** : aucun habitant ne frappe un enfant qui n'a rien fait. La provocation doit venir du joueur (coup porté, vol, arme dégainée), comme pour les gangs.

### 85. L'enfant est recherché puis emprisonné pour un meurtre commis par un bot sur un autre bot
✅ RÉPARÉ — QUI DÉCLARAIT L'INFRACTION : `botKill(b)`, qui n'avait pas de paramètre « auteur » du tout. Elle écrivait `chat('💀 … éliminé par ${myCfg.name}')` et `infraction('éliminer ' + b.name, 2, 3)` **quel que soit le tueur** — or elle est appelée depuis cinq endroits, dont la bagarre entre deux habitants (`bagarreTick`) et la balle d'un ami armé (`gardeArmeTick`). Reproduit par la mesure : 14 400 pas manette posée → « 💥 Lea_star attaque Karim_flash » puis « 💀 Karim_flash a été éliminé par Joueur58 », « 🚔 Infraction : éliminer Karim_flash ! Niveau ★★ », et la police tirait ensuite sur l'enfant (−8 puis −7 ❤️, ❤️ au plus bas 54). `botKill(b, auteur)` prend maintenant l'auteur réel : absent = le joueur (poing, lame, sa balle, son explosif), sinon le bot qui a cogné — et alors aucune infraction, aucun message de butin, et la pastille ne parle que si la scène est à moins de 40 m. Le joueur n'en répond que s'il a donné l'ordre lui-même (`botTape(b, cible, parJoueur)` : vrai seulement pour « tape X » tapé dans le chat). Au passage, même racine ailleurs : toutes les infractions de `shotsTick` (tirer sur un bot, sur un joueur distant, sur la police, sur un vigile, détruire une voiture de police) exigent désormais `s.mine` ; et `gangeurKO` ne retourne le gang contre l'enfant — ni ne lui donne la réputation du coup — que si c'est lui qui a tiré (elle est aussi appelée pour une bagarre entre deux gangs). Mesuré APRÈS (test 468) : un bot en élimine un autre → **★ 0**, « 💀 MaxiBloc a été éliminé par Lucas_2014 » ; l'enfant en élimine un → **★ 2** (non-régression) ; une bagarre de rue menée au KO en 67 pas → **★ 0** ; un agresseur abattu par la balle de l'ami armé → **★ 0**, « éliminé par Lucas_2014 »
- **Gravité** : BLOQUANT (l'enfant qui pose la manette finit en cellule sans avoir rien fait)
- **Reproduire** : profil vierge, ne rien faire. Reproduit 2/2 (noms différents : Lucas_2014 puis Zoe_rider).
- **On voit** : « 💥 Lucas_2014 s'en prend à Momo_king » **puis** « 🚔 Infraction : éliminer Momo_king ! Niveau ★★ » — l'infraction est mise au compte du joueur alors que l'auteur est un bot. Même racine probable que le n° 83 (l'auteur d'une élimination était attribué au joueur par défaut) ; le n° 83 a été corrigé côté message, pas côté infraction.
- **On devrait voir** : une infraction n'est imputée au joueur que s'il en est l'auteur.

### 86. Le joueur est téléporté de 1,75 m en une seule image en marchant dans la rue
✅ RÉPARÉ — RACINE EXACTE, retrouvée à l'image près. Le trajet du poste Finition est celui du test du petit robot : départ (0 ; 8), 12 s de marche en balayant le cap. À l'**image 669**, arrivé en (−47,36 ; 12,05), le joueur n'effleurait la boîte d'une **voiture garée** en (−46,85 ; 9,19) que de **1,5 cm en z** — mais cette boîte est l'englobante d'un véhicule en biais, **3,73 × 4,95 m**. Sur l'axe **x** il était donc « au milieu » de la boîte : `moveAxis` le classait « déjà dedans », la sortie x la plus proche valait **1,755 m**, et il était éjecté de **1,75 m en une image** (0,103 m autorisés au pas), `P.vel.x` remis à 0, pour finir posé sur la dalle basse de (−49,9 ; 9,2). Le correctif du n° 80 (comparer la sortie x et la sortie z) suffit sur ce cas précis — la sortie z n'y valait que 1,5 cm —, mais il ne compare que les deux sorties ENTRE ELLES : quand la plus courte tombe sur l'axe du pas et mesure quand même un mètre et demi, on la prenait. `moveAxis` **plafonne** désormais la sortie « déjà dedans » à ce que le pas du joueur autorise plus `POUSSEE_IMAGE` (0,30 m, soit 18 m/s — plus vite qu'aucun véhicule de la ville) ; au-delà, le pas est annulé et c'est `desincarcere()` qui garde SEUL le droit au grand saut, une fois, au bout d'une demi-seconde (véhicule qui se gare sur le joueur : test 142). Un premier essai à 5 cm de marge a été **mesuré et retiré** : une voiture qui roulait sur le joueur ne le poussait plus du tout, il s'enfonçait d'un mètre dans la caisse en une demi-seconde et `desincarcere` le rejetait alors de **1,04 m d'un coup** (même trajet, image 583, boîte de véhicule 5,00 × 4,36 m en (−42,82 ; 10,53)). Mesuré après, sur un tour complet de la ville (23 étapes, du port au stade) : **16 045 images de marche et 13 756 images de course, 0 image au-dessus du pas autorisé**, excès maxi **0,000 m** (pas autorisé 0,103 m en marche, 0,160 m en course) — tests 469 et 470. Le MÊME tour lancé sur la version où le défaut a été mesuré (avant le correctif du n° 80) relève, lui, une image à **0,568 m** en course en (−2,2 ; 26,3) pour 0,160 m autorisés : le test a bien des dents.
- **Gravité** : GRAVE (à l'écran c'est un saut du personnage ; c'est aussi ce qui cassait la laisse du petit robot)
- **Reproduire** : marcher vers l'ouest le long de la rue, arriver vers (−47,4 ; 12,1).
- **On voit** : mesuré à la sonde par le poste Finition — le joueur est déplacé de **1,75 m en UNE image**, `P.vel.x` remis à 0, et il se retrouve posé sur une dalle basse en (−49,9 ; 9,2). Aucun test du banc ne le voyait jusqu'ici.
- **Racine probable** : la résolution axe par axe de `moveAxis` — la sortie « face la plus proche » quand on est déjà dans une boîte, ou un enchaînement marche + mur. C'est la même famille que le défaut n° 80 (le garde-corps de La Zone qui éjectait le joueur de 1,48 m hors de la cage) et que l'éjection de 15,8 m trouvée au round 73.
- **On devrait voir** : un déplacement continu. Aucun pas ne doit jamais dépasser ce que la vitesse du joueur autorise dans une image.

## CONTRÔLE DU JOUEUR — round 77 (entrées 87 à 99, jouées à la manette DualSense sur `fa07c93`)
Captures et relevés dans `/tmp/claude-0/-home-user-marlon/d9d8ec84-d68f-5fe0-b4d4-336d04aef788/scratchpad/r77` (scripts `q-*.js`, journaux `q*.log`, images `img/`).

### 87. Mis KO sur une balançoire, l'enfant reste prisonnier de la balançoire : il se balance tout seul et ne peut plus bouger
- **Gravité** : BLOQUANT (l'enfant n'a plus de personnage ; seul un bouton que rien n'annonce le libère)
- **Reproduire** : Plaine des Sports, marcher jusqu'aux balançoires (−172 ; −138), △ pour s'asseoir, puis se faire mettre KO (14 coups de 9 ❤️). Reproduit **2/2** (`q-swing.js` et `q-verif.js`, deux mondes neufs indépendants).
- **On voit** : à t+2 s le relevage du n° 78 fait son travail — ❤️ 100, `P.swing` repasse à faux. **Mais le siège garde son cavalier** : `sw.rider === 'me'` pendant les 30 s suivantes, et `swingTick` repose le joueur sur la planche à chaque image. Le personnage se balance tout seul, y 0,51 → 1,92 → 0,48, cycle de 3,4 s, pendant 28 s. Stick poussé à fond vers une cible à 22 m pendant 400 images : **0 m parcouru**, il est toujours en (−172 ; −137,5). Il n'est pas emmené à l'hôpital, il ne marche pas, il ne court pas, il ne monte pas en voiture. Le seul geste qui le libère est ◯ — et le message qui l'annonçait (« 🎠 ◯ pour sauter de la balançoire ! ») a disparu depuis longtemps, remplacé par la pastille du quartier (« 🏟️ La Plaine des Sports : city-stade… »). Deuxième essai, monde neuf : ❤️ 100, `P.swing` faux, **un siège garde toujours son cavalier**, et 400 images de stick à fond donnent **−0,09 m** de déplacement. Après ◯, tout redevient normal (22 m parcourus, `rider` à zéro).
- **On devrait voir** : la remise en jeu lâche la balançoire comme elle lâche déjà le volant, le siège et le brancard (`remiseEnJeu()`), et `sitSwing` n'est pas le seul endroit du jeu à savoir décrocher un cavalier.
- **Capture** : `img/i2-balancoire-prison-3-4.png` — le chat dit « 😵 Joueur77 a été mis KO par Karim_flash », la barre de vie est pleine, et le personnage est suspendu au-dessus de la poutre du portique.
✅ RÉPARÉ (round 78, poste JEUX & QUARTIERS) — `sitSwing` posait le cavalier et le saut de `swingTick` était le SEUL endroit du jeu qui savait le retirer ; `remiseEnJeu()` remettait bien `P.swing` à null mais laissait `sw.rider === 'me'`, et `swingTick` reposait le joueur sur la planche à chaque image. Tout passe maintenant par **`lacheBalancoire(sw)`** (le saut, la remise en jeu, et les manèges au passage). MESURE avant / après, scénario du contrôleur (Plaine des Sports, siège n° 5, KO assis) : sièges occupés après le relevage **1 → 0**, `sw.rider` **'me' → null**, marche en 400 images de stick à fond **−0,09 m → 11,44 m**. La consigne pour descendre ne dure plus 1,6 s : la pastille d'action affiche « 🎠 Espace : saut » (« 🎠 ◯ : saut » à la manette) **tant que l'enfant est assis**, et pousser le stick assis redonne le message en grand (une fois toutes les 4 s). Le piège du banc est corrigé lui aussi : `__SHOT.go()` rendait `P.swing`/`P.ride` sans décrocher le siège et contaminait les tests voisins (cavaliers hérités après un `go` : **1 → 0**). Test 491.

### 88. Au stand de tir, viser les cibles du jeu rend l'enfant recherché par la police (★★★, « éliminer Momo_king »)
✅ RÉPARÉ (poste VILLE, r78) — le stand a maintenant une **vraie butte de tir** : un talus plein de 15 m de large et 4,60 m de haut entre la dalle (z = 9) et les cibles (z = 11,4), parement de madriers côté tir, couronnement de sacs de sable, deux retours d'angle. ET le verrouillage automatique **ne prend plus que les cibles** quand on est sur la dalle du stand (`STAND_RAYON` = 18 m) : c'était le second mécanisme, aussi méchant que l'absence de butte — l'enfant visait une cible à 8 m, un habitant traversait à 5 m dans le cône et le verrouillage le préférait, le coup partait sur LUI.
  - **Mesure géométrique** : 18 rayons partis de six points de la dalle et prolongés d'un demi-mètre au-delà de chaque cible. AVANT : la cible du milieu ne rencontrait **rien sur 200 m** (les deux seules prises étaient des poteaux de 0,36 m à 2,5 et 29 m). APRÈS : **18/18 arrêtés**, au plus tard **1,60 m** derrière la cible.
  - **Mesure en jeu** (même scénario joué sur les deux versions, tir déterministe, un habitant nommé Momo_king planté derrière les cibles sur la rue z = 0) : 40 coups depuis la ligne de tir. AVANT **★ 3**, Momo_king ❤️ 100 → **0**, son corps repoussé jusqu'à z = −2,5 (en pleine chaussée). APRÈS **★ 0**, Momo_king ❤️ **100**, 27 cibles touchées (l'entraînement marche toujours), 0 balle en vol à la fin.
  - **Capture regardée** : `scratchpad/ville/img/butte-3-4.png` (les cibles sont plaquées contre le parement de la butte, plus de chaussée derrière) et `butte-depuis-la-rue.png` (depuis le passage piéton, on voit le talus, pas le stand). À comparer à `img/d4-stand-large.png`.
  - **Test** : `au stand de tir, la butte arrête toutes les balles : quarante coups, pas une étoile, et l'habitant derrière les cibles est indemne`.
  - **Non-régression** : tests 20, 24, 33, 53, 95, 308, 363 verts ; les douze bancs Node verts.
- **Gravité** : GRAVE (le jeu invite à s'entraîner et punit l'entraînement)
- **Reproduire** : armurerie (67 ; 27), descendre au stand de tir, se placer sur la ligne de tir (67 ; 19), ✕ pour dégainer, L2 pour braquer, R2 sur chacune des trois cibles (8 à 10 balles par cible). Reproduit 2/2 (`qarme.log`, `qq.log`).
- **On voit** : run 1 — « 🎯 Touché ! », « 🔫 Rechargement… », « 🎯 Touché ! », puis **« 🚔 Infraction : tirer sur Momo_king ! Niveau ★ — file, ils arrivent dans 14 s »** et **« 🚔 Infraction : éliminer Momo_king ! Niveau ★★★ — file, ils arrivent dans 13 s »**. Run 2 — 11 cibles touchées, ★ 1 à l'arrivée. Le stand n'a aucune butte : derrière les trois cibles (z = 11,4) le relevé des solides entre x = 60 et x = 74 sur z = 0 → 11 ne donne que **deux poteaux de 0,5 m de large** (x 60,1 et 72,3) et une dalle de 14 cm ; entre les deux, c'est le parking de l'armurerie (16 × 5 m en (67 ; 6,5)) puis la rue z = 0, où passent les habitants et les voitures.
- **On devrait voir** : un mur ou une butte pleine derrière les cibles — ou des balles qui s'arrêtent dans la cible. Jamais une étoile pour avoir fait ce que le panneau demande (« 🎯 Stand de tir : dégaine et vise les cibles »).
- **Capture** : `img/d4-stand-large.png` — on voit à travers les trois cibles la chaussée, son passage piéton et une voiture garée.

### 89. « 🏁 ▢ : lancer la course » — à la manette, ▢ ne lance rien : la course de karts et la course d'anneaux sont injouables
- **Gravité** : GRAVE (deux modes de jeu entiers — le circuit, ses karts, sa grille de départ et ses adversaires ; les anneaux de l'hélicoptère — n'existent pas pour un enfant qui joue à la manette)
- **Reproduire** : manette DualSense, aller au portique du circuit (`RACE_C`), lire le message, appuyer sur ▢. Puis monter dans l'hélicoptère et appuyer sur ▢. Reproduit 2/2 (`q-heli3.js`, `q-mort.js`).
- **On voit** : au circuit, le jeu écrit lui-même **« 🏁 Circuit : △ pour un kart, ▢ pour lancer la course sur l'anneau »**. ▢ → `race.state` reste `idle`. △, ✕, ◯ → `idle` aussi. La touche clavier F, elle, marche : `race.state` passe à `countdown` et l'écran affiche « 🏁 2 ». Dans l'hélicoptère, le message est **« 🚁 ▢ : course d'anneaux »** et ▢ appelle en fait `heliPoser()` : on lit « 🚁 Remise des gaz », l'appareil se pose, la course ne démarre pas.
- **Racine** : `ctrlText()` traduit « F » par « ▢ » (ligne `\bF\b(?= pour| =| :|\))` → ▢), mais `PAD_MAP` ne contient **aucune** entrée qui envoie `KeyF` : `PAD_MAP[2]` vaut `'KeyV'` (frapper). Le seul `KeyF` du jeu vient du clavier ou du téléphone-manette (`TEL_TOUCHES.course_auto`, qui a bien son bouton « 🏁Course » à l'écran).
- **On devrait voir** : un vrai bouton de manette qui lance la course, et un message qui nomme CE bouton.

### 90. La cage à grimper ne se grimpe pas : la première barre est à 0,98 m, on butte dedans
✅ RÉPARÉ — le code écrivait `y = n * 0.9` (barres à 0,98 / 1,88 / 2,78 m) là où son commentaire annonçait 0,55 m, et la dalle pleine de 5 × 5 m du sommet coiffait tout. Les barres passent à 0,55 / 1,10 / 1,65 / 2,20 / 2,75 m (écart maxi mesuré 0,55 m), et la face nord — celle par laquelle on arrive — porte une échelle de cinq barreaux décalés de 0,90 m en z, hors de l'aplomb de la dalle. **Avant : bloqué à (−162 ; −128,98), 275 images stick à fond, 0 cm monté. Après : (−162 ; −136) → plancher du sommet à 3,05 m en 96 images, 0 saut, 0 étape bloquée (0,63 → 1,18 → 2,83 → 3,05 m).** Au passage, la barrière du trottoir était plantée en x = −161, à un mètre du centre de la cage : deux de ses huit panneaux la traversaient (le mur gris de la capture a9). Test : « la cage à grimper se GRIMPE A PIED du gazon au plancher du sommet, sans un seul saut » — commit bb15535
- **Gravité** : GÊNANT (une des sept attractions annoncées de la Plaine des Sports ; de loin on voit une pergola, pas une cage)
- **Reproduire** : Plaine des Sports, partir de (−162 ; −131) et marcher vers la cage (−162 ; −126), stick à fond. Reproduit 2/2 (`qs2.log`, `qtob.log`).
- **On voit** : bloqué à (−162 ; −128,98), **275 images (4,6 s) stick à fond sans monter d'un centimètre**. Relevé des solides autour de (−162 ; −126) : les barres sont à **0,98 m, 1,88 m et 2,78 m**, et le plancher du sommet à 3,05 m. Le pas franchissable du joueur est de **0,56 m**. Le commentaire du code annonce pourtant « trois étages de barres, chacun à 0,55 m du précédent ». En sautant (apogée mesurée 2,30 m) on peut se hisser, mais on ne se pose sur aucune barre de 16 cm de large, et le plancher du sommet (dalle pleine de 5 × 5 m) coiffe tout l'ensemble.
- **On devrait voir** : des barreaux à 0,55 m, comme le dit le commentaire — un enfant doit pouvoir monter au sommet en marchant.
- **Capture** : `img/a9-cage-pres.png` — la première barre arrive à la poitrine du personnage ; `img/a4-sports-aire.png` (vue d'ensemble : le sommet se lit comme une grande table jaune).

### 91. L'escalier du toboggan de la Plaine des Sports monte à l'envers : on n'atteint la plateforme qu'en sautant
✅ RÉPARÉ — les cinq hauteurs sont inversées : 0,50 m pour la marche la plus au nord (celle qu'on rencontre en premier, à 0,34 m du sol), puis 0,90 / 1,30 / 1,70 / 2,10 m contre la tour, et un dernier pas de 0,40 m sur la plateforme à 2,50 m. **Avant : bloqué à z = −120,45, 226 images sans avancer. Après : (−172 ; −123) → plateforme à 2,50 m en 86 images, 0 saut, 0 étape bloquée (0,50 → 1,30 → 2,10 → 2,50 m) — et la glissade redescend à 0 m en 93 images.** Test : « le toboggan de la Plaine des Sports se monte A PIED par son escalier, et la glissade ramène au sol » — commit 7e52624
- **Gravité** : GÊNANT
- **Reproduire** : Plaine des Sports, marcher vers le toboggan (−172 ; −114) en venant du nord, stick à fond, sans sauter. Reproduit 2/2 (`qs2.log`, `qtob.log`).
- **On voit** : bloqué à (−172 ; −120,45), **226 images** sans avancer. Relevé des solides de la tour : les marches vont de **0,50 m en z = −116** (celle qui touche la tour) à **2,10 m en z = −119,6** (la plus éloignée) — l'escalier MONTE EN S'ÉLOIGNANT de la tour. La plateforme est à 2,50 m en z = −114 et le mur de la tour fait 2,40 m de haut : depuis la dernière marche il n'y a aucun chemin, et depuis le nord la première chose qu'on rencontre est une face de 2,10 m. Le même trajet avec un saut toutes les 22 images amène bien à y = 2,50 (le saut du jeu culmine à 2,30 m) — mais un enfant ne devine pas qu'il faut sauter par-dessus son propre escalier.
- **On devrait voir** : un escalier qui monte VERS la tour, comme celui de toutes les autres tours du jeu.
- **Capture** : `img/a6-toboggan-sud.png` (la glissade cyan, côté sud), `img/a4-sports-aire.png` (les marches grises, côté nord).

### 92. Le ballon du city-stade flotte à 36 cm au-dessus du gazon
✅ RÉPARÉ — `ballon.ground` passe de 0,50 à 0,14, le niveau du gazon. **Avant : bas du ballon 0,50 m pour un gazon à 0,14 (36 cm de vide). Après : bas 0,14 m, gazon 0,14 m.** Le marquage peint flottait lui aussi (`fieldLines` à 0,22, donc un plan à 0,24) : il est posé à 0,16 m. Le but marche toujours (0 → 1 en poussant la balle vers la cage ouest). Test : « le ballon du city-stade est posé SUR le gazon, et il rentre toujours dans le but » — commit 40fdec9
- **Gravité** : COSMÉTIQUE (mais c'est la première chose qu'on regarde en entrant dans la cage)
- **Reproduire** : Plaine des Sports, city-stade, aller au rond central (−164 ; −175) et regarder le ballon au repos.
- **On voit** : le ballon repose à y = 1,00 (`ground` = 0,50 + rayon 0,50), donc son bas est à **0,50 m**, alors que le gazon du city-stade est posé à **0,14 m** : **36 cm de vide sous le ballon**. Le ballon du terrain du centre, lui, est juste (`ground` 0,30 + rayon 0,50 = bas à 0,30, pelouse à 0,30).
- **On devrait voir** : `ballon.ground = 0.14`, comme le gazon sur lequel il est posé.
- **Bonne nouvelle mesurée au passage** : le but fonctionne — en poussant le ballon vers la cage ouest, « ⚽ BUT ! 1 » et `city.goals` passe bien de 0 à 1.
- **Capture** : `img/a3-sports-stade.png`.

### 93. Les panneaux des trois quartiers neufs disent « E pour s'asseoir » à un enfant qui joue à la manette
- **Gravité** : GÊNANT (même famille que les n° 15, 30 et 44 ; ici c'est le décor tout neuf qui parle clavier)
- **Reproduire** : manette, Plaine des Sports, s'approcher du panneau des balançoires (−172 ; −132). Reproduit sur les cinq panneaux des trois quartiers.
- **On voit** : gravé sur le panneau, en grand : **« 🎠 Balançoires : E pour s'asseoir »**. Idem « 🎡 Tourniquet : **E** pour monter », « 🐴 Manège à poneys : **E** pour monter », « 🛞 Balançoire-pneu : **E** pour s'asseoir », « 🪺 Balançoires nid d'oiseau : **E** pour s'asseoir » — et six autres en ville (hélico, karts, balançoires du parc, boules, vélos, propulseur), soit onze panneaux. `ctrlText()` traduit bien les messages et la pastille d'action (mesuré : « 🏫 École : … assieds-toi a une table (△) », « 🎠 ◯ pour sauter de la balançoire ! »), mais pas les textures des panneaux, qui sont cuites une fois pour toutes à la construction par `sign()`.
- **On devrait voir** : le panneau dit le bouton que l'enfant a sous le pouce — ou, à défaut, une formule qui ne nomme aucune touche (« monte sur le tourniquet »).
- **Capture** : `img/a8-balancoires.png`.

### 94. Le panneau du manège à poneys bouche complètement le manège : en arrivant par l'est, on ne voit qu'une planche de bois
✅ RÉPARÉ — `sign()` pose un second plan au dos, retourné d'un demi-tour pour que le texte se lise à l'endroit, et QUI PARTAGE LE MÊME MATÉRIAU : une seule texture, un maillage de plus par panneau. **Avant : 22 panneaux posés, 22 faces texturées, 0 lisible depuis l'est. Après : 22 recto + 22 verso texturés, 22 retournés, 22 partageant leur matériau ; debout sur le Chemin de la Grange à 7,48 m du panneau du manège, 1 face lisible tournée vers le joueur.** Capture vérifiée depuis l'est : le toit de chaume, les mâts, la piste ronde et un poney sont visibles. Test : « un panneau se lit des DEUX côtés : son dos ne cache plus le manège à poneys » — commit 0452e89
- **Gravité** : COSMÉTIQUE
- **Reproduire** : Hameau de la Ferme, arriver au manège à poneys par l'est (le Chemin de la Grange, x = −110), s'arrêter à 7 m.
- **On voit** : le panneau « 🐴 Manège à poneys » est posé en (−117,5 ; 310) face à l'ouest ; sa face arrière est un aplat de bois nu de **3,45 × 1,65 m**, de 1,70 m à 3,10 m de haut, et il remplit **tout l'écran**. Le manège, son toit de chaume et ses six poneys sont entièrement cachés. `sign()` ne texture que la face avant ; les dix autres panneaux des trois quartiers ont le même dos.
- **On devrait voir** : le texte des deux côtés, ou le panneau tourné vers le chemin par lequel on arrive.
- **Capture** : `img/b1-hameau-manege.png`.

### 95. Le chien n'est pas déclaré passager mais voyage quand même dans l'habitacle, à 10 cm du genou de l'ami assis devant
- **Gravité** : GÊNANT (la nouveauté « on monte à quatre + le chien + le robot » marche pour tout le monde sauf le chien)
- **Reproduire** : centre, adopter le chien, poser trois amis à côté d'un 4×4 à quatre places, se mettre au volant (△), puis rouler 8 s à R2 40 %. Reproduit 1/1 (`qq.log`).
- **On voit** : le message annonce **« 🚗 Lucas_2014, MaxiBloc, Ines_gg montent avec toi + Bip 🤖 · 4 places »** — le robot est nommé, **le chien non**, et `c.chien` reste faux. Mais le chien est quand même dans la caisse : il est en (−7,48 ; 0,60 ; 9,95) alors que Lucas_2014, place « avant », est en (−7,50 ; 0,60 ; 9,85) — **10 cm d'écart, même hauteur, tous deux à 0,52 m de l'axe du véhicule**. Il y reste en roulant : sur 480 images et 17,1 m parcourus, son écart à la caisse ne bouge pas d'un centimètre (0,52 m). Le commentaire du code promet pourtant « Le CHIEN a sa place à lui : assis sur la banquette, jamais sur les genoux de quelqu'un ».
- **On devrait voir** : soit le chien monte vraiment (place `chien` de la table, annoncée dans le message), soit il reste dehors et attend — pas un chien qui traverse la carrosserie et se pose sur le passager.
- **Le reste est bon, et ça se voit** : les trois amis sont bien assis (avant, arrière gauche, arrière droite), tous visibles, à 0,52 et 0,94 m de l'axe, têtes à 1,24 m, et **le n° 79 est réglé** : 8 s de conduite, ★ 0 et les trois amis toujours à 100 ❤️ (ils étaient écrasés au premier mètre au round précédent).
- **Capture** : `img/e2-quatre-haut.png`.
- **RÉPARÉ (round 78, poste VILLE & VÉHICULES).** Racine : **il y avait DEUX tables de sièges.** `chienTick` portait la sienne, écrite à la main, et pour une voiture fermée elle posait le chien à `lx = −0,52 / lz = +0,05` — très exactement le siège « avant » de la table `PLACES`. `placeOccupants` l'asseyait pourtant correctement (`assiedChien`, place `chien` de la table, au centre de la banquette arrière), mais `poseJoueurAuVolant` tourne AVANT `cityCommon` : chienTick le remettait sur les genoux du passager à chaque image. Il n'y a plus qu'UNE table pour le joueur, les amis, le robot et le chien ; les deux-roues et le jet-ski gardent leur repère à eux (le chien y voyage dans son panier, `panierChien`, et personne ne s'y assied à sa place).
- Deuxième racine, la **déclaration** : `enterCar` n'inscrivait le chien (`c.chien`) que s'il était à moins de 6 m, alors que `chienTick` l'embarque, LUI, sans aucune condition de distance (au-delà de 25 m il se téléporte à son maître). D'où « le chien est dans la caisse mais `c.chien` est faux ». Les deux règles n'en font plus qu'une : il monte s'il a une place et qu'il n'est ni couché dans sa niche ni lancé sur quelqu'un.
- **Mesure avant / après** : écart chien ↔ passager avant **0,10 m → 1,30 m**, stable sur 8 s de conduite ; le chien est à `lx 0 / lz −1,05`, sa place de la table **au centimètre** ; `c.chien` **faux → vrai** ; ses coordonnées `p.x / p.z` suivent enfin son maillage (elles restaient sur le trottoir).
- **Le message le NOMME**, comme le robot : « 🚗 Ines_gg, MaxiBloc, Lucas_2014 montent avec toi + Rex 🐕 · 4 places ». Et quand il monte seul, il y a enfin un message : « 🚗 Rex 🐕 monte avec toi · 4 places » (il n'y en avait aucun).
- **Capture regardée** : `r78v/img/95-cabine-flanc.png` — à travers les vitres, les trois amis à leurs places et l'étiquette « 🐕 Rex » nettement en arrière, sur la banquette ; rien ne dépasse de la carrosserie.
- **Test** : `le chien est déclaré passager et s'assied à SA place, jamais sur les genoux du passager avant`.

### 96. Un contact à 2,5 km/h contre une voiture garée déclenche « ACCIDENT ! », la police, et la voiture ne repart plus jamais
- **Gravité** : GRAVE (c'est le premier geste de l'enfant avec sa première voiture, au parking du centre — le terrain du n° 70)
- **Reproduire** : parking du centre, se mettre au volant de la voiture la plus proche (−8 ; 10) avec △, R2 à fond **en braquant vers la sortie** (cap visé (0 ; −30), donc un quart de tour à gauche dès le départ). Reproduit 1/1 (`qc.log`, section `place`).
- **On voit** : à **t = 0,4 s**, alors que la voiture roule à **0,7 m/s (2,5 km/h)**, « 💥 **ACCIDENT ! Les deux véhicules sont immobilisés — la police arrive** ». Et c'est fini : sur 900 images (15 s de simulation), la voiture n'a parcouru que **3,7 m**, **875 images sur 900** sont sous 0,6 m/s, elle a pris **19 % de dégâts** et elle reste figée en (−8,4 ; 6,4), vitesse 0, pendant les 14 s restantes.
- **Contre-épreuve, à décharge** : la MÊME voiture, R2 à fond **tout droit** sans braquer, fait **46,6 m en 15 s** avec 12 % de dégâts, 80 images lentes sur 900 et aucun accident (`q-verif.js`). Le piège n'est donc pas l'accélérateur, c'est le frôlement de la voisine au moment de sortir de la place — et c'est exactement ce qu'un enfant fait.
- **On devrait voir** : à 2,5 km/h, un bruit de tôle et un pare-chocs qui recule — pas un constat, pas deux véhicules immobilisés à vie, pas la police.
- **RÉPARÉ (round 78, poste VILLE & VÉHICULES).** Deux causes, toutes deux dans `resolveVehicleOverlap()`, le traitement de contact réservé à la voiture CONDUITE.
  1. **La géométrie était l'enveloppe, pas la tôle.** On y lisait la boîte alignée sur les axes (`c.solid`), qui GONFLE dès qu'on braque : une caisse de 2,40 × 4,40 m à 45° présente une boîte de 4,81 m de côté, soit 2,00 m de large en trop. Au parking du centre, voisines à 2,40 m, il suffisait donc de TOURNER LE VOLANT pour « toucher » une voiture jamais approchée. Mesuré sur la manœuvre de l'entrée : **7 contacts en 2,9 s, dont SIX où les deux châssis ne se touchaient pas** — le pire à **1,278 m d'écart** — et le septième, celui du constat, à **0,255 m d'air entre les tôles**. Le calcul orienté `contactVehicules()` existait déjà et servait à TOUTES les autres paires de véhicules ; `separerVehicules()` saute justement la voiture conduite au motif qu'« elle a son propre traitement ». C'est ce traitement-là qui était resté en arrière. Il n'y a plus qu'une seule géométrie de contact pour tout le monde.
  2. **L'impact se mesurait sur le compteur, pas sur le rapprochement.** `imp = Math.abs(drive.speed)` est la vitesse que le MOTEUR réclame : voiture calée contre sa voisine, pied au plancher, **16,62 m/s au compteur alors qu'elle n'avançait plus**. On mesure maintenant la vitesse de rapprochement le long de la normale de contact, en vitesse RELATIVE — c'est l'esprit de la règle que le choc contre un MUR applique déjà (`perte`, « la vitesse que le mur a ÔTÉE »). Un frôlement en longeant une voiture garée a une normale perpendiculaire à la marche : rapprochement quasi nul, donc une rayure et pas un constat. **Les seuils n'ont pas bougé** (`ACCIDENT_VITESSE_MIN` = 10 m/s, 12 m/s contre un véhicule garé) : ils recevaient une valeur fausse, c'est tout.
- **Mesure avant / après**, même manœuvre (R2 à fond, quart de tour à gauche, 900 images) : accidents **1 → 0** · contacts fantômes **6 → 0** · dégâts **58,5 % → 0 %** sur le contact restant · distance parcourue **1,58 m → 29,02 m** · images sous 0,6 m/s **725/900 → 111/900**.
- **Contre-épreuve** : une voiture lancée à 14 m/s dans une voiture garée droit devant ouvre toujours **1 accident**, véhicule immobilisé, 45,7 % de dégâts. Le constat n'a pas été désarmé.
- **Captures regardées** : `r78v/img/96-AVANT-sortie-place.png` (pare-brise éclaté, pare-chocs et panneaux tombés sur le bitume, voiture à l'arrêt au sortir de la place) et `96-APRES-sortie-place.png` (tôle intacte, pare-brise net, ★ 0, la voiture est à 26 m). Plus `96-parking-dessus.png` : la vue de dessus montre l'écart réel entre les voitures garées.
- **Tests** : `sortir d'une place de parking en braquant ne déclenche plus d'accident` et `un vrai encastrement dans une voiture garée reste un accident`.

### 97. Après un KO, l'enfant se réveille à 200 m de là sans que rien ne le lui dise
- **Gravité** : GÊNANT (le relevage du n° 78 marche ; c'est son récit qui manque)
- **Reproduire** : centre, profil vierge, se faire mettre KO (14 coups de 9 ❤️), regarder les messages. Reproduit 2/2 (`qm.log`, `q-swing.js`).
- **On voit** : « 😵 KO par Karim_flash ! −7 🪙 » à t+0, « 🚑 Une ambulance a été appelée » à t+1,2 s, et **1,6 s après le KO** le personnage est déjà debout, 100 ❤️, en (22 ; 0,8 ; 207,9) — l'accueil de l'hôpital, à **200 m** de l'endroit où il est tombé. Le seul message encore à l'écran est **« 🪑 △ : s'asseoir »**. Rien ne dit qu'il a été soigné, ni où il est, ni pourquoi son porte-monnaie est passé de 25 à 18 🪙. Un enfant qui regarde ailleurs une seconde et demie ne saura jamais ce qui s'est passé.
- **On devrait voir** : une phrase qui RESTE (« Tu t'es réveillé à l'hôpital · −7 🪙 »), et assez de temps pour la lire — 1,6 s, c'est plus court qu'un clignement d'attention.

### 98. Une fusillade à cinq morts ajoute 117 maillages à la scène — et ils y restent
- **Gravité** : GÊNANT (pas le gouffre annoncé, mais le coût ne redescend jamais)
- **Reproduire** : centre, rassembler cinq habitants à 5 m, les abattre tous les cinq d'un coup, compter les maillages visibles de la scène avant / au pic / quatre secondes après. Reproduit 1/1 (`qr.log`).
- **On voit** : **31 943** maillages visibles avant, **32 060** au pic, **32 059** quatre secondes plus tard — alors que les cinq avatars, eux, sont devenus invisibles (`visible: false`, une trentaine de maillages chacun, donc environ −150 qui auraient dû être rendus). Le solde net est donc de l'ordre de **+270 maillages créés pour cinq morts, dont +117 encore là après**. Le pas de simulation passe de **14,06 ms à 16,43 ms (+17 %)** pendant la fusillade.
- **Ce que je n'ai PAS pu mesurer** : les appels de dessin. Sous swiftshader le banc ne rend qu'une image par seconde et `renderer.info.render.calls` reste bloqué à 1 ; l'avertissement du poste FIABILITÉ (+455 appels pendant une demi-seconde par mort) n'est donc ni confirmé ni infirmé ici. Ce que je peux dire, c'est que la scène ne rend pas ce qu'elle a pris.
- **On devrait voir** : ce que la scène gagne pendant la fusillade, elle doit le rendre après — un corps effacé doit emporter ses maillages.
- **CORRIGÉ (poste FIABILITÉ, round 78)** — *Les éphémères vieillissent dans la simulation, plus seulement au dessin.* Les morceaux d'explosion et les effets d'impact ne mouraient que dans `frame()`, la boucle d'**affichage** ; tout ce qui fait avancer le jeu sans rendre d'image les gardait pour toujours. Le vieillissement est passé dans `step()` (`ephemeresTick`), avec le reste de la simulation, et **avant** la sortie `!active` pour que les morceaux de la mort du joueur retombent aussi quand il est à terre.
  - **Mesure avant / après**, même sonde, même graine, cinq habitants abattus d'un coup puis quatre secondes de simulation :

    | | maillages visibles avant | au pic | 4 s plus tard | solde | groupe `ephemeres` après |
    |---|---|---|---|---|---|
    | **avant** | 24 588 | 24 983 | **24 983** | **+395, définitifs** | **619** (513 boîtes, 56 cylindres, 50 sphères) |
    | **après** | 24 595 | 24 990 | **24 371** | **−224** | **0** |

    Le solde passe donc de **+395 qui ne redescendent jamais** à **−224** : la scène rend plus qu'elle n'a pris, parce que les cinq corps effacés (≈ 45 maillages chacun) emportent enfin leurs maillages avec eux. Le groupe se vide entre 1,0 s et 1,5 s (durée de vie d'un morceau : 1,4 s), `debris` et `fx` reviennent à 0.
  - **Pourquoi le garde-fou ne voyait rien** : il compte `scene.children`, or les 619 morceaux sont **un cran plus bas**, dans le groupe `ephemeres`.
  - **L'ENFANT LE SUBIT-IL SUR SA TÉLÉ ? NON.** Mesuré, et c'est le point qui compte. Partie longue **avec la boucle d'affichage qui tourne pour de bon** (`frame()` appelé image par image, rendu compris, cadence imposée à 1/60 s pour ne pas dépendre du temps réel du banc) : dix vagues de morts, 150 images de jeu entre chaque. Le groupe des éphémères **revient à zéro après chaque vague, avant comme après le correctif**, et rien ne s'accumule :

    | | tour 0 | tour 5 | tour 10 |
    |---|---|---|---|
    | maillages visibles, **avant** le correctif | 24 601 | 24 111 | 24 123 |
    | maillages visibles, **après** | 24 602 | 24 053 | 24 009 |
    | appels de dessin (image + passe d'ombres, comptés à la main), **avant** | 10 720 | 10 691 | 10 873 |
    | appels de dessin, **après** | 10 720 | 10 729 | 10 753 |

    La courbe **monte une fois puis reste plate** — elle redescend même, les habitants abattus n'étant plus dessinés. Le pas de simulation ne dérive pas non plus (16,1 → 8,0 ms avant, 15,3 → 3,1 ms après ; il baisse parce que les habitants morts ne sont plus simulés). **Le surcoût de 14,06 → 16,43 ms était un effet du banc d'essai**, qui enchaîne des `step()` sans jamais rendre d'image : c'est exactement le cas où le vieillissement, logé dans `frame()`, ne tournait jamais. Dès que la boucle d'affichage tourne — c'est-à-dire tout le temps chez l'enfant — les morceaux mouraient déjà.
  - **Le correctif reste utile** pour les trois cas où le jeu simule sans passer par `frame()` : la cinématique d'introduction et le mode « manette seule » sortent de `loop()` avant `frame()`, et `frame()` lui-même enchaîne jusqu'à huit pas de simulation pour une seule image quand ça rame. Et il rend le banc d'essai honnête.
  - **Garde-fou** : test 497, « une fusillade a cinq morts ne laisse aucun maillage derriere elle, meme sans une seule image rendue ».

### 99. Manette posée, profil vierge : l'enfant est emporté sur 32 m sans avoir touché à rien, et arrive collé à « éjecter le conducteur (gros délit !) »
- **Gravité** : GÊNANT (1 fois sur 3 ; le personnage part tout seul et finit devant une proposition de délit)
- **Reproduire** : profil vierge, manette branchée et posée, ne rien faire pendant 320 s de simulation (relevés toutes les 10 s). Reproduit **1 fois sur 3** (`j1.log` oui, `j2.log` et `j3.log` non : dans les deux autres runs le joueur ne bouge pas d'un millimètre sur 320 s).
- **On voit** : le joueur reste en (0 ; 3,5) de t = 150 s à t = 250 s, puis (1,3 ; 3,5) à 260 s, **(16,3 ; 3,5) à 270 s**, **(31,8 ; 3,7) à 280 s**, et plus rien ensuite — **31,8 m parcourus en 25 s** sans qu'aucune touche ait été pressée ni aucun stick poussé. Juste avant le départ, à t = 250 s : « 🔥 AU FEU ! La caserne envoie le camion ». Pendant le trajet, à t = 275,4 s : **« 🚗 △ : éjecter le conducteur et voler la voiture (gros délit !) »** — l'enfant est déposé contre une voiture conduite, avec un gros délit à portée de pouce.
- **On devrait voir** : un joueur immobile reste immobile. Si un véhicule de service doit passer là, il contourne ou il klaxonne ; il n'emporte pas l'enfant sur trente mètres.
- **Ce qui est ACQUIS et qui se voit, sur les trois mêmes runs** : sur 320 s de simulation manette posée, **❤️ jamais sous 100, ★ 0, porte-monnaie 25 🪙 inchangé, 0 habitant à moins de 6 m à l'arrivée, aucun gang, aucune bagarre, aucune infraction**. Les n° 78, 84 et 85 sont réparés pour de bon — la ville laisse enfin l'enfant tranquille.
- **RÉPARÉ (round 78, poste VILLE & VÉHICULES).** Ce n'est pas le pilote qui est en cause, c'est **la résolution de collision du joueur**, et ça n'a rien de propre au camion de pompiers : **n'importe quel véhicule qui avance emportait l'enfant immobile.**
  Racine : quand le joueur est DÉJÀ dans la boîte d'un solide (le cas d'un véhicule qui arrive sur lui), `moveAxis` le repose sur **la face la plus proche**. C'est la bonne réponse pour un portail qui se referme ou une dalle qui apparaît. Face à un véhicule qui roule, c'est la mécanique du **chasse-neige** : collé au pare-chocs, la face la plus proche est la face AVANT, donc on le repose DEVANT la caisse — à chaque image, aussi longtemps que le véhicule roule.
  Le piège vient de l'allure : un véhicule EN INTERVENTION n'attend que 2,5 s derrière un piéton, puis « avance au pas » (`cap(1.5, 'pieton')`). Un piéton s'écarte ; l'enfant manette posée, non.
- **Mesure avant / après** (véhicule avancé à la main à l'allure exacte du « pas », manette posée, aucune entrée, 30 s) : emporté **33,4 m → 0 m** derrière un camion à 1,5 m/s, **33,4 m → 0 m** derrière une voiture, **20,4 m → 0,37 m** à 0,8 m/s. Avant, l'enfant restait à **4,40 m du centre du camion — pile sur son pare-chocs — tout du long**. Il est maintenant **écarté de 1,72 m** hors de la voie, ❤️ 100, et le véhicule le dépasse. Un véhicule à l'ARRÊT ne pousse toujours personne (0 m).
- **La correction** : sur l'AXE DE MARCHE d'un véhicule qui roule, on annule le pas au lieu de reposer le joueur devant lui, et le dégagement (`desincarcere`, armé sur-le-champ au lieu d'attendre sa demi-seconde) l'écarte **de côté**, du côté LIBRE pour ne pas l'envoyer dans une façade. C'est ce que fait un vrai pare-chocs au pas : il pousse sur le côté, il n'embarque pas.
- **Captures regardées** : `r78v/img/99-AVANT-manette-posee.png` (l'enfant plaqué contre le flanc du camion rouge, emmené avec lui) et `99-APRES-manette-posee.png` (il est seul, debout au bord du trottoir là où il a commencé ; le camion est passé).
- **Test** : `manette posée, un véhicule qui passe au pas écarte l'enfant de sa trajectoire au lieu de l'emporter`.

### 100. Sur l'écran de l'introduction, un bouton « Exporter la vidéo » relance le film depuis le début
- **Gravité** : GÊNANT (c'est le tout premier écran du jeu, et c'est un outil de studio posé à côté du bouton « Passer »)
- **Reproduire** : premier lancement, « Entrer dans Marlon », laisser tourner le film, puis cliquer sur « Exporter la vidéo » (le bouton du milieu des trois). Reproduit 1/1 (`cine3.js`).
- **On voit** : les trois boutons de la cinématique sont « Son : activé », **« Exporter la vidéo »** et « Passer · Entrée / A ». Au clic, le film **repart de zéro** (`elapsed = 0`), le bouton se grise et l'écran affiche **« Enregistrement de l'introduction · 32 secondes »**. L'enfant qui voulait juste appuyer sur un bouton se retrouve à revoir le film en entier pendant qu'un fichier vidéo de 8 Mbit/s s'enregistre. (Heureusement, « Passer » reste actif pendant l'enregistrement.)
- **On devrait voir** : pas ce bouton-là devant un enfant — au mieux derrière un `?capture` d'URL, comme le mode capture l'est déjà.
- **Capture** : `img/j1-export-video.png`, `img/cine-01-t1.png`.

### 101. La « vie » des trois quartiers neufs, ce sont des mannequins de vitrine sur socle blanc — dont quatre plantés sur le terrain de foot
✅ RÉPARÉ — les treize `mannequin()` des trois quartiers deviennent des `habitant()` : un vrai avatar, un NOM au-dessus de la tête, une tournée de points faite à pied avec `npcMove`, la marche animée, une phrase quand on s'approche, et PAS DE SOCLE. Même recette que les médecins de l'hôpital et les employés de la banque. **Avant : 13 immobiles, 0,00 m parcouru, 2 socles solides en plein terrain de foot. Après, sur 60 s de jeu (3 600 images) : 13 habitants, les 10 qui ont une tournée parcourent de 32 à 66 m, 0 immobile, 0 en l'air ou dans le sol, 13/13 nommés, 0 socle dans les trois quartiers.** Deux pièges mesurés en chemin : `groundAt()` posait les trois commerçants DEBOUT SUR LEUR COMPTOIR (d'où `solSousHabitant()`), et la hauteur figée à la pose laissait la bergère 0,68 m en l'air et le forain 1,18 m dans la piste du manège (ils suivent le sol maintenant). Test : « les trois quartiers neufs sont HABITÉS : des gens qui marchent, pas des mannequins sur socle » — commit 9f1629b
- **Gravité** : COSMÉTIQUE
- **Reproduire** : Plaine des Sports, entrer dans le city-stade ; Bois des Aventuriers, aller au feu de camp ; Hameau de la Ferme, aller au marché.
- **On voit** : les « joueurs du city-stade », le « berger », le « fermier », le « forain », le « ranger », les « campeurs » et le « moniteur » sont des `mannequin()` — c'est-à-dire des mannequins de boutique : immobiles, sans nom, bras écartés, **posés sur un socle gris clair de 1,10 × 1,10 × 0,30 m qui est en plus un SOLIDE**. Sur la pelouse du city-stade, cela fait quatre statues sur piédestal au milieu du terrain, dont une dans la surface de but, et le ballon y rebondit. Au total : 4 à la Plaine des Sports, 4 au Hameau, 4 au Bois.
- **On devrait voir** : soit de vrais habitants (`bots`, qui marchent et qui parlent, et les trois quartiers en ont déjà les points de flânerie), soit au moins pas de socle de musée sur un terrain de foot.
- **Capture** : `img/a3-sports-stade.png` (deux socles blancs en plein terrain), `img/c1-bois-parcours.png` (le moniteur sur son socle).

### 102. Le parcours dans les arbres est fermé : on monte l'escalier, on arrive au niveau du plancher, et un garde-corps barre l'entrée
✅ RÉPARÉ — le garde-corps est percé d'une ouverture de 1,80 m du côté de l'escalier ET de chaque passerelle, sur les quatre tours ; les murs de la cabane, qui barraient tout le plancher de la 4ᵉ tour, ont deux portes ; les trois « montées » de passerelle, qui étaient posées SOUS le tablier suivant, reviennent dans l'axe du bout de passerelle ; la première marche du grand toboggan, plantée dans l'escalier de la 4ᵉ tour, part maintenant du sud de la cabane. **Avant : 464 images stick à fond, arrêté à 2,58 m de la plateforme, le parcours entier inatteignable à pied. Après : du sol (0,14 m) au drapeau de la cabane (7,14 m) en 459 images de MARCHE, 0 saut, 0 étape bloquée, 0 image passée sous 1,50 m après être monté ; les 4 escaliers mènent chacun au plancher de SA tour (2,6 / 4,0 / 5,4 / 7,14 m).** Test : « le parcours dans les arbres se PARCOURT A PIED du sol au drapeau de la cabane, sans un seul saut » — commit bab351e
- **Gravité** : BLOQUANT pour le quartier (c'est LE jeu du Bois des Aventuriers : quatre plateformes, trois passerelles, la cabane au sommet, le drapeau d'arrivée et cinq pièces — rien de tout ça n'est atteignable à pied)
- **Reproduire** : Bois des Aventuriers, pied de la première tour (125,1 ; 285), monter l'escalier vers le nord, puis avancer vers la plateforme (128 ; 288). Reproduit 2/2 (`q-bois.js`, `q-arbres.js`).
- **On voit** : l'escalier, lui, est parfait — on monte de 0,14 m à **y = 2,60** en (125,1 ; 289,16), sans une image de blocage, exactement au niveau du plancher de la tour. Et là, plus rien : **464 images (7,7 s) stick à fond vers l'est, arrêté à x = 125,42, à 2,58 m de la plateforme**. La cause est dans `tour()` : le garde-corps est posé sur les QUATRE bords (`[tx, tz−2], [tx, tz+2], [tx−2, tz], [tx+2, tz]`), donc aussi sur le bord **par lequel l'escalier arrive** ; c'est une boîte solide de 2,60 m à 3,70 m, soit 1,10 m au-dessus des pieds du joueur — bien au-delà du pas franchissable de 0,56 m. Le seul moyen d'entrer est de **sauter par-dessus la rambarde** (mesuré : apogée 4,90 m, on retombe à y = 3,90, c'est-à-dire DEBOUT SUR LE GARDE-CORPS).
- **On devrait voir** : une ouverture dans le garde-corps du côté de l'escalier, sur chacune des quatre tours.
- **Capture** : `img/c5-bois-haut.png`, `img/c1-bois-parcours.png`.

### 103. (round 78, poste VILLE & VÉHICULES) Trois relevés de géométrie du poste CONDUITE — deux corrigés, un laissé
- **a) Le camion de pompiers était garé AU TRAVERS de sa caserne — CORRIGÉ.** La « perche de descente » n'était pas une perche : un **panneau de 3 × 6,80 × 0,30 m** planté en (−40 ; 126), au milieu de la travée, que la caisse du camion (2,60 × 8 m en (−40 ; 128), z de 124 à 132) contenait sur toute sa largeur. Et — **vu en capture, pas calculé** — il SORTAIT PAR LE TOIT : le pavillon plafonne à 5,10 m, le panneau montait à 6,80, soit 1,70 m de plaque blanche en l'air au-dessus du toit, coupant en deux l'enseigne « CASERNE DES POMPIERS ». C'est une vraie perche maintenant (0,30 m de section, du sol à 4,50 m, contre le flanc ouest, avec sa trappe de dortoir), à 4,70 m de la caisse du camion. **Solides dans la caisse du camion : 1 → 0 ; solides qui percent le toit : 1 → 0.** On déplace le décor et pas le camion : sa place est calculée par `gare()` / `placeDeService` (le garde-fou qui tient son gabarit hors de la chaussée) et la sortie de la cour est un acquis mesuré du round 77. Captures : `r78v/img/geo1-caserne-face.png` (avant) et `geo1-APRES-caserne-face.png` (après, l'enseigne se lit enfin en entier).
- **b) La rue x = 52 mordue par son propre mobilier — CORRIGÉ.** Six bancs en x = 48,5 : un banc tourné dans l'axe de la rue a une boîte de 0,85 m de large, donc il s'étendait jusqu'à **x = 48,925** alors que le bitume commence à 48,5 — **42,5 cm de banc dans la voie**, six fois. Visible : sur la capture ils débordent de la ligne blanche de rive sur le goudron. Reculés de 60 cm (x = 47,9) : **chevauchement 0,425 m → 0**, et le jeu entre le mobilier et le gabarit de la voie de droite (axe x = 50,25, demi-gabarit 1,20 m) **0,125 m → 0,725 m**. On recule le mobilier plutôt que d'élargir la rue : il ne reste que 10 cm de marge géométrique en ville. `node harness/traffic.js` : **14/14**. Captures : `geo2-rue52.png` / `geo2-APRES-rue52.png`.
  - *Nuance sur le relevé reçu* : les deux poteaux de x = 48,1 (z = 36 et 92) ne mordaient PAS — section 0,15 m, bord est à 48,175, soit 32,5 cm en deçà de la rive. Seuls les six bancs étaient en cause. Et l'itinéraire du centre vers (40 ; 90) passait **déjà** par la rue x = 52 (80,0 m pour 80,9 m à vol d'oiseau) : ce n'était plus le calcul d'itinéraire, c'était la marge.
- **c) La place du centre étroite pour les gros véhicules — LAISSÉ, volontairement.** Sur les 9 chaussées à moins de 30 m du centre, **3 sont sous le seuil de 7,60 m** : (0 ; −4), (−26 ; 0) et (0 ; 26), 6 m chacune, pour un camion de 8,60 m. Ce sont **exactement** les trois déjà documentées au §7 de `NOTES-URBANISME.md` comme laissées sciemment au round 75, avec leur raison chiffrée : la dalle du Parking du centre et ses 16 places pour les deux premières, les trois boutiques de z = 19,5 pour la troisième. Ces trois boutiques sont la **pire valeur de la ville** (+0,30 m contre la rue z = 26) — c'est précisément sur elles que porte l'avertissement des 10 cm. Les élargir demande de déplacer le parking et les intérieurs des boutiques, posés à la main coordonnée par coordonnée : chantier à part, et il mangerait la marge. Le pilotage gère la place aujourd'hui.
- **Test** : `le camion de pompiers n'est plus garé au travers de sa caserne, et les bancs de la rue x = 52 sont sur le trottoir`.

## CONTRÔLE DU JOUEUR — round 81 (entrées 104 et suivantes, jouées à la manette DualSense sur `95ad841`)
Relevés et captures dans `/tmp/claude-0/-home-user-marlon/d9d8ec84-d68f-5fe0-b4d4-336d04aef788/scratchpad/r81`
(scripts `body-*.js`, journaux `*.json`, images `img/`, preuve Node `ctrl.cjs`).

### 104. ✅ RÉPARÉ — À la manette, △ devant une voiture fait monter et descendre l'enfant en boucle : une pression sur deux le laisse à pied
- **Gravité** : GRAVE (△ est LE bouton d'action du jeu, et « monter en voiture » est le geste le plus fréquent de la partie ; ici il répond une fois sur deux, et quand il répond il claque jusqu'à 35 portières en un tiers de seconde)
- **Reproduire** : manette DualSense branchée, Parking du centre, se planter à 2,4 m d'un véhicule jusqu'à lire « 🚗 △ : monter » dans la pastille d'action, puis **appuyer sur △ comme on appuie vraiment — 200 ms, pas un effleurement**. Douze appuis identiques par durée, trois durées, tout en temps RÉEL (la manette est lue par son `setInterval` à 120 Hz sur l'horloge matérielle, exactement comme chez l'enfant) : `body-h.js`, `h.json`.
- **On voit** :

  | durée de l'appui | finit au volant | allers-retours dedans/dehors (pire cas) | réécritures de la bannière (pire cas) |
  |---|---|---|---|
  | 120 ms | **10 / 12** | 16 | 9 |
  | 200 ms | **6 / 12** | 26 | 13 |
  | 350 ms | **5 / 12** | 35 | 18 |

  Pendant l'appui, `drive.car` bascule toutes les **8 ms** — la période de lecture de la manette. Relevé image par image sur un appui de 150 ms (`f.json`) : dedans à 4 ms, dehors à 8, dedans à 17, dehors à 25, dedans à 33… **19 bascules**. Chaque montée rejoue `enterCar` en entier : claquement de portière (`sonPortiere`), démarrage moteur (`engine.start`), le message « 🚗 Boîte automatique · 📯 klaxon · ◯ maintenu = frein à main » et l'embarquement des passagers. L'état final ne dépend que de la PARITÉ du nombre de lectures : à 350 ms, **7 fois sur 12 l'enfant reste debout à côté de sa voiture** alors que le jeu lui dit toujours « △ : monter ».
- **Racine, prouvée hors navigateur** (`ctrl.cjs`, Node pur, déterministe) : dans `controls.js`, `sample()` remet `previous` à zéro dès que `changed` est vrai, et `changed` vaut `current !== context` — donc AUSSI pour `game:foot` → `game:vehicle`, que `changementContexte` écarte pourtant exprès (arbitrage r76, point 2 : « monter en voiture en poussant déjà le stick ne doit pas les rendre muets »). Un bouton TENU est donc réannoncé comme un NOUVEL appui à chaque lecture tant que le contexte fait l'aller-retour. Et `pollGamepad` fait `if (frame.changed) releaseGamepad(false)` avant de relire les boutons : le garde-fou `inputKeys.set()`, qui sait ignorer un second keydown pour une touche déjà tenue, est désarmé juste avant. Mesure du banc Node : bouton tenu, contexte fixe → `pressed` vaut `true` puis **8 fois `false`** (correct) ; bouton tenu, contexte qui alterne foot/vehicle → `pressed` vaut **`true` 8 fois sur 8**.
- **On devrait voir** : un appui, une montée. Un bouton déjà enfoncé à la lecture précédente n'est jamais un nouvel appui, quel que soit le contexte — c'est déjà la règle quand le contexte ne change pas, et le banc `gamepad.js` la vérifie (ligne 17) ; il ne la vérifie simplement jamais À TRAVERS un changement de contexte, et c'est exactement le trou.
- **Capture** : `img/q9-parking-triangle.png` — la pastille dit « 🚗 △ : monter », l'enfant est debout à côté du véhicule, et c'est l'image qu'il a sous les yeux après avoir appuyé.
- **✅ RÉPARÉ (round 81, poste MANETTE) — une ligne de `controls.js`.** `sample()` faisait `previous = Array(COUNT).fill(false)` dès que `changed` était vrai. Or `changed = nouvelleManette || current !== context` est vrai AUSSI pour `game:foot` → `game:vehicle`, que `changementContexte` écarte pourtant exprès (arbitrage r76, point 2). Effacer `previous` là, c'est déclarer « aucun bouton n'était tenu à l'image d'avant » : le △ toujours enfoncé repassait donc par `pressed[3]` — et par l'arête `neuf[3] !== bas[3]` de `PAD_MAP` — **à chaque lecture de la manette**. `previous` ne s'efface plus qu'à une **vraie frontière**, c'est-à-dire exactement là où une quarantaine s'arme : `nouvelleManette || rearmeTout || rearmeTenus`. Entre deux situations de JEU, l'état précédent est conservé : un bouton tenu reste tenu. Les cinq acquis des deux réconciliations sont intacts (quarantaine des boutons à l'entrée d'un menu seulement, pas de quarantaine du stick droit, une seule courbe de visée, appui long en horloge de simulation, curseur de zone morte additif) — `if (entreeMenu) axesBlocked = …` et les trois drapeaux `premierReleve` / `rearmeTout` / `rearmeTenus` n'ont pas bougé d'un caractère.
- **Mesure avant / après**, douze appuis autour de 200 ms devant le véhicule de (−8 ; 10) au Parking du centre, **dans le vrai navigateur** (`harness/play.js`, essai 510). La manette étant lue par son `setInterval` à 120 Hz, on compte en **lectures**, pas au temps du mur (le banc rend 1 image/s) : on balaie **18 à 29 lectures** (150 à 242 ms), soit les **deux parités six fois chacune** — c'était la parité qui décidait de tout.

  | | finit au volant | bascules dedans/dehors pendant l'appui (pire cas) | bascules au total sur les 12 appuis |
  |---|---|---|---|
  | **avant** | **6 / 12** | **29** | 282 |
  | **après** | **12 / 12** | **1** (la montée) | 12 |

  Balayage complet hors navigateur (le jeu entier chargé sous Node, `harness/run.js`), aux trois durées du relevé du contrôleur : **120 ms** 6/12 → **12/12**, 19 bascules → **1** ; **200 ms** 6/12 → **12/12**, 29 → **1** ; **350 ms** 6/12 → **12/12**, 47 → **1**. Une bascule par appui, donc **un claquement de portière et un démarrage moteur**, au lieu de jusqu'à 47 en un tiers de seconde.
- **Le banc de preuve du contrôleur** (`scratchpad/r81/ctrl.cjs`, Node pur) : bouton tenu à contexte qui alterne → `pressed` valait **`true` 8 fois sur 8**, il vaut maintenant **`false` 8 fois sur 8**, exactement comme la contre-épreuve à contexte fixe. Les deux branches disent enfin la même chose.
- **LE TROU DU BANC, COMBLÉ.** `harness/gamepad.js` était 21/21 vert et vérifiait bien « un bouton tenu n'est pas un nouvel appui » (ligne 17) — **mais jamais à travers un changement de contexte**. Deux essais ajoutés, **23/23** :
  - `a held button crossing a game context change is never a new press` : △ tenu pendant que le contexte fait l'aller-retour `game:vehicle` / `game:foot` → **0 réappui sur 8**, le bouton reste `b[3] === true`, son relâchement est vu **une fois**, un vrai nouvel appui après la bascule compte bien, et **la quarantaine des menus n'a pas bougé** (jeu → `menu:pause` avale toujours le bouton tenu).
  - `full game: holding the action button through a vehicle context change toggles the car once` : le jeu entier, la boucle réelle (chaque `KeyE` reçu fait basculer `drive.car`, donc le contexte), balayée sur 18 à 29 lectures → **1 bascule et au volant, pour les douze**.
  - Contre-épreuve : ces deux essais **échouent tous les deux sur l'ancien `controls.js`** (21 passés, 2 échoués), et l'essai 510 de `play.js` y lit **6/12 et 29 bascules**. Ils ne peuvent plus être verts par accident.
- **Non-régression** : `node harness/lint.js` **5 ✅**, les **douze bancs Node verts** (`gamepad.js` 23/23, `controls-tv.js` 16/16), et **13 essais de manette de `play.js`** rejoués verts (101, 212, 216, 224, 231, 232, 265, 372, 377, 444, 476, 493, 510).

### 105. ✅ RÉPARÉ — Après chaque KO en ville, l'enfant se réveille DEBOUT SUR le banc de la salle d'attente de l'hôpital
- **Gravité** : COSMÉTIQUE (mais c'est l'image de fin de TOUS les KO de la ville, et le jeu lui propose alors de « s'asseoir » sur le banc où il est déjà debout)
- **Reproduire** : centre, profil vierge, se faire mettre KO (20 coups de 9 ❤️), attendre les 1,6 s de relevage. Reproduit **5/5** (quatre façons de mourir dans `j.json` : poings, explosion, flammes, gang ; plus `n.json`). Le point est fixe, il ne dépend pas de la mort.
- **On voit** : `pointDeReveil()` rend **(22 ; 207,9)**, c'est-à-dire `city.medDesk` + (1,6 ; 2,4). Or `city.benches` contient un banc en **(22 ; 208)**, assise **0,66 m**, et le relevé des solides qui contiennent ce point donne, du plus haut au plus bas : une boîte de **2,30 × 0,85 × 0,66 m dont le dessus est à 0,66 m** (le banc), puis la dalle de l'accueil (26 × 22 m, dessus à **0,36 m**), puis le terrain. `remiseEnJeu()` appelle `groundUnder()` sur ce point, trouve donc le banc, et repose le joueur à **y = 0,66** — **30 cm au-dessus du carrelage**. Mesuré après KO : `P.pos` = (22 ; **0,66** ; 207,9). La pastille d'action affiche dans la foulée « 🪑 △ : s'asseoir ».
- **On devrait voir** : on se réveille DEVANT le comptoir, les pieds sur le carrelage — le point de réveil doit tomber à côté du banc, pas dessus (le banc est en z = 208, le point en z = 207,9 : 10 cm d'écart).
- **Capture** : `img/q1-hopital-reveil.png` — les deux baskets sont posées sur les lattes du banc, le comptoir « Hôpital » derrière, 🪙 18 et 💀 1 dans le bandeau, et le chat dit « Joueur57 a été mis KO par Karim_flash ».
- **✅ RÉPARÉ (round 81, poste MANETTE) — un seul nombre, dans `pointDeReveil()`.** C'était bien le point de réveil, pas le banc : `medDesk + (1,6 ; 2,4)` tombait à **10 cm du centre** d'un banc de 2,30 × 0,85 m (`bench(hx + 10, hz − 4)`, boîte de z = 207,575 à 208,425), et `groundUnder()` fait son travail en trouvant le dessus de l'assise. Le point passe à **`medDesk + (1,6 ; 0,4)` = (22 ; 205,9)**, c'est-à-dire **devant le comptoir de l'accueil**, face à lui. Relevé des solides de l'accueil : le plus proche est à **1,64 m** (la jardinière de (22 ; 204)), le comptoir à 2,30 m, et le banc à **2,10 m** — donc **au-delà des 1,80 m de `benchNear`**, ce qui supprime aussi l'invitation absurde à « s'asseoir ». On ne touche pas au banc : il est à sa place dans une salle d'attente, et le déplacer casserait les quatre bancs symétriques de l'hôpital.
- **Mesure avant / après**, trois KO d'affilée en ville (`harness/play.js`, essai 511) : sol trouvé sous le point de réveil **0,66 m → 0,36 m** (le carrelage de l'accueil, relevé indépendamment dans le même essai), pieds du joueur **y = 0,66 → y = 0,36** (**30 cm plus bas**, posés), banc le plus proche **0,10 m → 2,10 m**, `city.benchNear` **vrai → faux**, pastille **« 🪑 E : s'asseoir » → « 🏥 E : se faire soigner »** (l'offre juste, au comptoir de l'hôpital où l'on vient de se réveiller). L'essai **échoue sur l'ancien point** : il ne peut pas être vert par accident.
- **Non-régression** : lint **5 ✅**, **douze bancs Node verts**, et les quatre essais voisins de `play.js` rejoués verts — 410 et 411 (les secours, qui exigent le réveil à moins de 8 m de l'accueil et debout), 491 (KO sur la balançoire) et 495 (la phrase du réveil, n° 97 — qui contient justement le « 🪑 E : s'asseoir » comme contre-exemple).

### 106. ✅ RÉPARÉ — Au bout du parcours dans les arbres, la caméra entre dans le dos de l'enfant : il ne voit ni la cabane, ni le drapeau qu'il vient de gagner
- **Gravité** : GÊNANT (c'est la récompense du Bois des Aventuriers — quatre plateformes, trois passerelles, cinq pièces et un drapeau — et on n'en voit rien)
- **Reproduire** : Bois des Aventuriers, monter le parcours à pied jusqu'à la cabane (128 ; 7,14 ; 300), puis tourner la caméra sur les quatre côtés. Reproduit 2/2 (`n.json`, et deux captures indépendantes prises à 10 et 14 m de recul demandés).
- **On voit** : la caméra demande **9 m** de recul ; la distance RÉELLE entre la caméra et la tête du joueur est de **1,15 / 1,33 / 1,43 / 1,48 m** selon le cap — soit, à 1,15 m, l'objectif DANS le personnage. Sur la plateforme de la 4ᵉ tour, juste dehors, ce n'est guère mieux : **1,41 / 1,64 / 1,73 / 3,69 m**. En pleine rue, au même moment et avec le même réglage, elle tient **5,18 à 7,69 m**. Les murs de la cabane (4,4 × 2,4 m, deux portes de 1,80 m) et le garde-corps de la tour ne laissent nulle part où reculer.
- **On devrait voir** : au bout du parcours, la cabane, le drapeau et le panneau « 🏕️ LA CABANE ». À défaut de place pour reculer, la vue passe en première personne (`cam.interieur`), comme elle le fait déjà ailleurs.
- **Capture** : `img/r15-cabane-dedans.png` et `img/q6-arbres-cabane.png` — deux vues, deux reculs demandés différents, la même chose à l'écran : le dos du maillot en plein cadre, « LA CABANE » à moitié caché derrière la tête.
- **↩️ RENDU AU POSTE CAMÉRA (round 81, poste MANETTE) — reproduit et diagnostiqué, pas réparé.** Mesuré en page, joueur épinglé en (128 ; 7,14 ; 300), `cam.dist` forcé à 9 m, les quatre caps, six images chacun (`scratchpad/r81m/cabane2.js`) :

  | cap | recul voulu | recul obtenu (`cam.reel`) | caméra ↔ tête (`cam.dJoueur`) | `cam.libre` | `cam.salle` | `cam.plafond` | `cam.interieur` |
  |---|---|---|---|---|---|---|---|
  | 0 (sud) | 9 m | 2,05 | **1,81** | 2,05 | 5,26 | **0,31** | faux |
  | π/2 (est) | 9 m | 1,85 | **1,50** | 1,85 | 5,26 | 0,31 | faux |
  | π (nord) | 9 m | 1,51 | **1,18** | 1,51 | 5,26 | 0,31 | faux |
  | −π/2 (ouest) | 9 m | 1,75 | **1,41** | 1,75 | 5,26 | 0,31 | faux |
  | *contre-épreuve, en pleine rue (0 ; 8)* | 9 m | 3,25 / 4,75 | 2,89 / 4,53 | 6,02 / 7,88 | 9 | 9 | faux |

  **La racine n'est ni la mesure de la pièce, ni l'inclinaison : c'est que LA CABANE N'EST PAS UN INTÉRIEUR DÉCLARÉ.** `cam.interieur` est **faux** (`interieurDe(128, 300)` ne rend rien), donc **la maison de poupée ne s'arme jamais** : le toit (boîte de 5,4 × 5,4 m à 9,25 m, soit `cam.plafond = 0,31` m au-dessus de la tête) n'est pas effacé et les deux murs de 0,36 m d'épaisseur ne passent pas en `xray`. `camLibres` et `murEntreVue` font alors exactement leur travail — ils arrêtent la perche devant la première paroi — et c'est `cam.libre` (1,51 à 2,05 m) qui commande, pas `want`. Noter au passage que `cam.salle` vaut **5,26 m** : les rayons sortent par le côté sud ouvert, la pièce paraît grande, donc même la piste « un hall pris pour une halle » ne s'applique pas ici. Et `cam.pmax = clamp((0,31 − 1,1) × 0,22 ; 0,04 ; 0,9) = 0,04` écrase l'inclinaison : impossible de passer par-dessus.
- **Pourquoi ce n'est pas une ligne de correctif.** On ne peut pas simplement ajouter la cabane à `city.interieurs` : ce tableau est lu **sans aucune notion de hauteur** (`interieurDe(x, z)` ne prend que x et z) et il sert aussi au **placement du mobilier de rue** (lignes 5619, 5705, 5760, 5792, 5843, 5909, 9938), au **bruit des pas** (ligne 19622 : tout `city.interieurs` sonne « carrelage ») et au nommage des zones. Déclarer un rectangle pour une cabane perchée à 7 m rendrait « intérieur » **le sol sous la tour**, avec des pas de carrelage en pleine forêt et un trou dans le mobilier du bois. Il faut donc, au choix : (1) un volume d'intérieur **borné en hauteur** que seule la caméra consulte (`{ y0, y1 }`, `interieurDe(x, z, y)` — un seul appelant, ligne 19135), ou (2) le **secours en première personne** que demande l'entrée : quand `cam.dJoueur` reste sous ~1,8 m alors qu'on demande 9 m, on masque l'avatar et on passe l'objectif à hauteur d'yeux. Les deux touchent `camPerche` / `interieurEntre`, c'est-à-dire **toutes les pièces de la ville** — mesures à refaire dans la banque, l'école, l'hôpital, les boutiques, le garage, le show-room et la halle. C'est le chantier du poste CAMÉRA, pas une retouche de la manette.
- **✅ RÉPARÉ (round 83, poste r83-b), et c'est la piste (1) de cette entrée qui a été suivie.** Une liste `city.camPieces`, **lue par la seule caméra**, dont chaque volume porte ses DEUX altitudes (`camPieceDe(x, z, y)`). La cabane y déclare `{x:128, z:300, w:4.6, d:4.6, y1:6.7, y2:10.3, tout:true}`. `city.interieurs` n'est pas touché : le sous-bois sept mètres plus bas sonne toujours « herbe » et non « carrelage », et le mobilier du bois n'a pas de trou. Vérifié dans le test.
- **Ce que la mesure a ajouté au diagnostic de cette entrée.** Le diagnostic du round 81 nommait le toit ; il en manquait une moitié. En rejouant le cône de `camLibres` rayon par rayon, **deux** géométries arrêtaient la perche :
  1. le **toit** `box(128 ; 9,70 ; 300)` de 5,4 × 0,9 × 5,4 m — mince et large, donc rangé par `estUnToit()` dans `camToits` ; dessous à 9,25 m pour un objectif à 8,64 m, soit `cam.plafond = 0,31 m`, et la loi « un plafond bas n'interdit que de MONTER » écrasait la visée à 0,04 rad, son minimum ;
  2. les **quatre troncs** de la tour (0,84 m de côté, 10,20 m de haut, aux coins du plancher de 4 × 4 m) : le rayon latéral à +0,4 rad touchait celui de droite à **2,00 m**, d'où une place libre de 2,05 m — exactement la valeur relevée au round 81.
  Le feuillage, lui, n'entrait pas en compte pour la perche (maillages non solides, invisibles de `camLibres`) : il gênait l'image, et `tout: true` l'effface aussi.
- **Mesures après**, milieu du plancher, les quatre caps : **4,86 / 4,87 / 4,86 / 4,87 m** de perche (contre 1,62 / 1,61 / 1,27 / 1,61 m), `cam.plafond` 0,31 → **9 m**, aucun mur entre la caméra et le joueur, objectif jamais dans un solide.
- **Aucune dégradation ailleurs**, ce que cette entrée exigeait expressément — sept lieux témoins, identiques au centimètre avant et après : rue dégagée 9,10 m · petite boutique 4,90 m · salle de classe 5,26 m · petit appartement 5,23 m · étage de la banque 7,54 m · passerelle des arbres 9,10 m · plancher de la tour 1 1,80 m.
- **Le seuil de masquage a dû bouger** : « la tête du joueur » ne suffisait pas (le dessous du toit, 9,25 m, passait SOUS la tête à 9,39 m et ne s'effaçait donc pas). Il est à **1 m au-dessus du plancher**. Et c'est la **capture d'écran** qui a corrigé une première version du correctif : à 1,20 m, l'enseigne « LA CABANE » (vissée dehors, dessous à 7,80 m) restait en place et l'enfant disparaissait derrière son propre panneau.
- **Captures** : `verification/r83b-cabane-camera-avant.png` (l'enfant remplit tout l'écran) et `verification/r83b-cabane-camera-apres.png` (on le voit entier, debout dans sa cabane, avec le plancher, la paroi du fond, les quatre troncs et la forêt autour).
- **Test** : `harness/play.js` n° 513 — exige ≥ 3,50 m de perche dans les quatre caps, aucun mur en travers, caméra hors des solides, **et** que la cabane ne soit PAS dans `city.interieurs`, que son volume ne réponde qu'en hauteur, et que le sol sous l'arbre ne sonne pas « carrelage ».
- **⚠️ CE QUI RESTE** : les trois autres plateformes du parcours (T1, T2, T3) ont **le même défaut** — 1,80 m de perche mesurés sur T1, même cause (les quatre troncs de 84 cm). Elles n'ont ni toit ni murs, donc la maison de poupée y serait une perte en plein air : le correctif juste est de ne pas laisser les rayons latéraux du cône butter sur un poteau mince, comme cela se fait déjà en véhicule. Confié au même poste, mesuré mais pas encore réparé.

### CE QUI EST ACQUIS — round 81 : les seize défauts du round 77, vérifiés un par un dans le jeu
Tout ce qui suit est **mesuré à la manette DualSense sur `95ad841`**, monde neuf à chaque essai.
Les seize défauts du contrôleur du round 77 sont **tous réparés pour de bon** ; je les ai rejoués
un par un, sans relire les correctifs d'abord.

- **n° 87 — la balançoire après un KO : réparé.** △ assied (« 🎠 ◯ pour sauter de la balançoire ! »),
  16 coups de 9 ❤️ mettent KO, et 1,6 s plus tard : ❤️ 100, `P.swing` faux, **0 siège avec cavalier**
  sur les 10 balançoires de la ville, et le personnage est debout à l'hôpital. L'enfant repart.
- **n° 88 — le stand de tir : réparé.** Momo_king planté derrière les cibles sur la rue z = 0,
  **40 coups** depuis la ligne de tir : **★ 0**, Momo_king **❤️ 100**, 8 cibles touchées, **0 balle en vol**
  à la fin. Vu en capture (`img/r7-stand-butte.png`) : les trois cibles sont plaquées contre un
  parement de madriers, on ne voit plus la chaussée à travers.
- **n° 89 — les deux courses à la manette : réparé.** Au portique du circuit, le jeu écrit
  « 🏁 **▢** : lancer la course » et ▢ fait passer `race.state` de `idle` à `countdown`
  (« 🏁 En place sur la grille… départ dans 3 s ! »). Aux commandes de l'hélico, il écrit
  « 🚁 **R1** : course d'anneaux » et R1 lance « 🚁 Passe les 11 anneaux dans l'ordre ! ».
  ▢ continue de poser l'appareil. Les libellés nomment le bon bouton dans les deux cas.
- **n° 90 — la cage à grimper : réparée.** De (−162 ; −136) au plancher du sommet, **stick à fond,
  aucun saut** : y 0,15 → 2,28 → **3,05 m**, **0 image de blocage**. Elle se lit comme une cage
  (`img/r2-cage.png` : les barreaux jaunes de la face nord sont devant l'enfant).
- **n° 91 — l'escalier du toboggan : réparé.** De (−172 ; −123) vers le nord, à pied, sans saut :
  y 0,15 → 0,50 → 1,70 → **2,50 m** sur la plateforme, **0 image de blocage**, et la glissade redescend.
- **n° 92 — le ballon du city-stade : réparé.** `ground` **0,14**, bas du ballon **0,14 m**, gazon 0,14 m —
  plus un centimètre de vide. (Le ballon du terrain du centre est resté à 0,30, c'est le sien.)
- **n° 93 — les panneaux qui disaient « E » : réparés.** Manette branchée, les **23 panneaux gravés**
  de la ville relus un par un : **0 qui nomme encore une touche de clavier**. « 🎠 Balançoires : E pour
  s'asseoir » se lit « 🎠 Balançoires : **△** pour s'asseoir », « 🏀 E : jouer » → « 🏀 **△** : jouer ».
  Vu en capture, gravé sur le bois (`img/q11-panneau-balancoires.png`).
- **n° 94 — le panneau du manège vu de dos : réparé.** Debout sur le Chemin de la Grange à 7,5 m à l'est,
  on voit le toit de chaume, les mâts, la piste ronde et les poneys de part et d'autre du panneau, et son
  dos porte le texte à l'endroit (`img/r5-manege-depuis-est.png`). *Nuance* : à cette distance le texte du
  verso est très pâle, presque une planche blanche — lisible de près, pas de loin.
- **n° 95 — le chien passager : réparé.** « 🚗 Lucas_2014, MaxiBloc, Ines_gg montent avec toi **+ le chien 🐕**
  · 4 places », `c.chien` **vrai**, et après 8 s de conduite (17,1 m) le chien est à `lx 0 / lz −1,05` —
  le centre de la banquette arrière, **sa place de la table au centimètre**. Les trois amis sont à
  (−0,50 ; +0,15), (+0,50 ; −0,80) et (−0,50 ; −0,80), tous à 0,60 m de haut, tous visibles, tous à **100 ❤️**,
  **★ 0**. Plus personne sur les genoux de personne.
- **n° 96 — l'accident à 2,5 km/h : réparé.** Sortie de place au parking du centre, R2 à fond, quart de
  tour à gauche, 900 images : **0 accident**, **32,7 m parcourus**, ★ 1 seulement (un feu grillé plus loin).
  Contre-épreuve : lancée droit dans une voiture garée, la même voiture ouvre toujours **1 accident** et
  reste immobilisée. Le constat n'a pas été désarmé, il a été réglé.
- **n° 97 — le message au réveil : réparé.** « 😵 KO par Karim_flash ! −7 🪙 » → « 🚑 Une ambulance a été
  appelée » → **« 🏥 Tu te réveilles à l'hôpital, remis sur pied · −7 🪙 — repars tranquille ! »**, et la
  phrase TIENT l'écran (priorité 2, 4,6 s) : la pastille du banc ne l'efface plus. Le porte-monnaie
  passe bien de 25 à 18 🪙 et l'enfant sait pourquoi. Idem pour les quatre façons de mourir essayées.
- **n° 98 — le coût d'une fusillade : réparé.** Cinq habitants abattus d'un coup : **31 962 maillages
  avant, 32 009 au pic, 31 987 cinq secondes plus tard** — solde **+25**, pas +117. Le groupe des
  éphémères monte de 1 à 41 et redescend. Le pas de simulation : **20,8 ms avant, 25,2 ms pendant,
  18,2 ms après** — il revient sous sa valeur de départ. Rien ne s'accumule.
- **n° 99 — l'enfant emporté par un véhicule : réparé, et c'est le point qui compte.**
  **Deux parties entières « profil vierge, manette branchée et posée, on ne touche à rien »,
  400 s de simulation chacune** (bien au-delà des 180 s de calme volontaire), à deux endroits
  différents — le centre (0 ; 3,5) et le trottoir de la rue z = 26 (30 ; 26) :
  **0,00 m parcouru, 0 image où le personnage bouge d'un millimètre, ❤️ jamais sous 100, ★ 0,
  25 🪙 inchangés, aucune mort, aucune prison.** Pendant ce temps la ville vit (deux incendies,
  les pompiers qui partent et reviennent, un gang qui casse une vitrine, une bagarre entre bots).
  Contre-épreuve à la main : un véhicule qui roule **à 1,5 m/s** et un autre **à 0,8 m/s** droit sur
  l'enfant immobile l'écartent **de 1,55 m sur le côté** et passent — **0 m emporté** (33,4 m avant).
- **n° 100 — « Exporter la vidéo » : réparé.** Sur le vrai premier écran, le film n'a plus que **deux
  boutons** : « Son : activé » et « Passer · Entrée / A ». Pas de bouton d'export.
- **n° 101 — la vie des trois quartiers neufs : réparée.** **13 habitants**, tous nommés, tous au sol
  (0 en l'air, 0 dans le sol). Sur **90 s de jeu**, les dix qui ont une tournée parcourent de **42,6 à
  91,7 m à pied** ; les trois autres sont les commerçants, à leur comptoir, c'est leur place.
  **0 socle** en vue sur le terrain de foot (`img/r8-habitants-stade.png`).
- **n° 102 — le parcours dans les arbres : réparé.** Du sol au drapeau de la cabane **à pied, sans un
  seul saut** : 0,15 → 2,60 (T1) → 4,00 (T2) → 5,40 (T3) → 6,80 → **7,14 m** (le drapeau), **neuf étapes,
  0 image de blocage**. Le grand toboggan redescend jusqu'au ruisseau. C'est un vrai parcours
  d'accrobranche à l'écran (`img/q12-bois-passerelle.png`).

**Et aussi, mesuré ce round :**
- **Le démarrage tient.** Clic sur « Entrer dans Marlon » → le film part. **Stick poussé à fond + ✕ + △
  tenus pendant 1,5 s : le film n'est PAS sauté** et le jeu ne démarre pas. On relâche, on rappuie sur ✕ :
  le film s'arrête et la partie commence sur « 👋 Bienvenue en ville ! stick gauche pour marcher ·
  △ agir · ◯ sauter ». La clé `marlon.intro.seen = action-v2` est écrite : pas de film au deuxième lancement.
- **La circulation tient les rues.** Huit voitures du trafic suivies pendant **200 s** : **0 bloquée**,
  chemin parcouru de **683 à 1 125 m** (médiane 835 m), écart net au départ de 121 à 363 m. Le réseau
  élargi se parcourt.
- **Le mode TV est propre en 1920 × 1080** (`img/r14-mode-tv-1920.png`) : pseudo entier, « Marlon ·
  Empire urbain », « Balade · 0 pts », chiffres lisibles de loin. (En 1280 × 720 les pastilles se coupent
  en « Jou… » et « Bal… », mais aucune télé ne fait 1280 de large : ce n'est pas le cas d'usage.)
- **Quatre façons de mourir, quatre relevages propres** : poings, explosion, flammes, gang — à chaque
  fois debout en 92 à 96 images, ❤️ 100, une phrase qui dit où l'on est et ce que ça a coûté.
  *Réserve* : une chute de **40 m** ne tue pas (−72 PV, il reste 28 ❤️) et le jeu annonce
  « 🤕 Aïe ! Chute de **15** m » — la hauteur affichée est celle qui correspond à la vitesse d'impact,
  plafonnée. « 💀 Chute mortelle ! » est donc inatteignable en pleine santé.
- **Ce que je n'ai PAS pu juger** : la conduite d'un bout à l'autre de la ville. Mon pilote automatique
  fonce vers le point visé sans suivre les rues ; il renverse des lampadaires et s'encastre, et ce qu'il
  mesure c'est lui, pas la ville. Les deux mesures qui valent quelque chose sont celles ci-dessus :
  la circulation du jeu, qui tourne sans se bloquer, et la ligne droite à la manette sur la rue z = 26
  (31 m/s atteints, puis un accident contre une voiture du trafic — ce qui est la bonne réponse à
  112 km/h dans une rue passante).

### CE QUI EST ACQUIS — ce que j'ai joué au round 77 et qui marche
Le chef a besoin de savoir ce qui est gagné, pas seulement ce qui manque. Tout ce qui suit est mesuré.
- **La ville laisse enfin l'enfant tranquille** (n° 78, 84, 85). Trois parties « profil vierge, manette posée, on ne touche à rien », 320 s de simulation chacune, relevés toutes les 10 s au-delà des 180 s de calme volontaire : **❤️ jamais sous 100, ★ 0, porte-monnaie 25 🪙 inchangé, aucun gang, aucune bagarre, aucune infraction, 0 habitant à portée de coup**. C'était le défaut bloquant du round précédent ; il est mort.
- **On monte vraiment à quatre** (n° 79). Trois amis + le robot + le joueur dans un 4×4 : tous assis à leur place (avant, arrière gauche, arrière droite), tous visibles, à 0,52 et 0,94 m de l'axe, têtes à 1,24 m, rien qui dépasse. Le message les nomme. Et surtout : 8 s de conduite, **★ 0, les trois amis à 100 ❤️** — ils étaient écrasés au premier mètre au round 76.
- **L'introduction est belle et elle se tient.** 32 s, quatre plans, la ville de nuit rose, l'équipe qui traverse, la conquête ; le texte est net et lisible. Un enfant qui tient déjà la croix au moment où le film démarre **ne le saute pas** (il faut relâcher puis rappuyer — bonne règle, mesurée) ; le stick ne le saute pas non plus. Une fois vue, elle ne revient pas au deuxième lancement (`marlon.intro.seen = action-v2`). Le bouton « Voir l'introduction · 32 s » de l'accueil est là pour la revoir.
- **Le mode d'emploi PS5 de l'accueil est enfin plié** en une ligne dépliable (« ▶ Comment jouer (clavier, souris, manette PS5) ») — le pavé de 25 lignes du n° 13 a disparu.
- **La manette est bonne partout ailleurs** : △ monte en voiture, s'assied, ouvre les boutiques et les comptoirs ; ◯ saute et descend des manèges ; ✕ dégaine ; L2 braque et R2 tire (11 cibles touchées au stand) ; R2 accélère et le stick braque au volant ; ◯ fait décoller l'hélicoptère (25,9 m en 4 s) et le stick le déplace ; les messages parlent manette (« assieds-toi à une table (△) », « 🎠 ◯ pour sauter »).
- **Les jeux des quartiers neufs qui marchent** : balançoires (△ pour s'asseoir, ◯ pour sauter, le message le dit), tourniquet (« 🎡 C'est parti ! (◯ pour descendre) »), skatepark (on monte la rampe en marchant, « 🚀 BOOST ! » en haut), city-stade (« ⚽ BUT ! 1 »), buvette du Stade et marché fermier (le comptoir s'ouvre au △), grand toboggan du Bois, manège à poneys, labyrinthe de paille.
- **Le tour des lieux répond** : école (« 🏫 École : entre dans une classe, assieds-toi a une table (△) »), banque et ses coffres au 2ᵉ, commissariat (dépôt de plainte), hôpital (« 🏥 △ : se faire soigner »), casino (la roulette s'ouvre au △), cinéma en plein air, garage custom, villa, rue commerçante, marché, dépôt municipal, caserne, plage, fête foraine. Le mode TV grossit bien la pastille d'action (11 → 20,4 px), les messages (50 → 62,4 px) et les étoiles (15 → 26,4 px).
- **La sortie de la cour de la caserne est dégagée** : camion de pompiers pris au dépôt, 14,1 m parcourus jusqu'à la rue, **1 seule image lente sur 700, 0 % de dégâts**. Des trois points de blocage annoncés par le poste VÉHICULES, celui-là est réglé.
- **Le labyrinthe de paille tient debout** : ses murs de bottes sont continus, on ne passe pas entre deux bottes — 684 images de stick à fond contre un mur, 0 traversée. C'est un vrai labyrinthe : il faut le contourner, pas le traverser (mon pilote automatique, lui, n'a jamais trouvé le cœur).
- **L'escalier de la première tour du Bois** monte impeccablement de 0,14 m à 2,60 m sans une image de blocage — c'est la rambarde d'en haut qui gâche tout (n° 102).
