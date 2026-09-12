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
- **Gravité** : BLOQUANT (le garage — repeindre, monter un kit — ne marche pas du tout)
- **Reproduire** : voiture du parking, la garer devant le garage custom (−45, 90), △ au comptoir (−53,5, 96,6), onglet 🎨 Peinture : choisir une finition (fluo), onglet 🧰 Kits : choisir « Jupes latérales », « Valider ».
- **On voit** : le chat écrit « ⚠️ Bug détecté : Uncaught TypeError: Cannot read properties of undefined (reading 'ws') at tuneApply », message « ⚠️ Un bug a été détecté (voir le chat), le jeu continue » ; le portefeuille passe de 400 à **190** (210 🪙 payés) ; la voiture reste rouge (#ff5c5c), sans jupes ; la fenêtre de l'atelier reste ouverte.
- **On devrait voir** : la voiture repeinte et équipée, et l'argent pris seulement si ça marche.
- **Capture** : `img/s5/s5-6-apres.png` (l'erreur dans le chat, 190 🪙), `img/s5/s5-7-ressort.png` (voiture toujours rouge).
- **Sonde** : `s5-pc.log` : `valide.wallet 400 → 190`, `remonte.couleur = 16735324` (inchangée), `tuning = {finition: "fluo", kits: ["jupes"]}` mais `PAGEERROR: Cannot read properties of undefined (reading 'ws')` (index.html l. ~24745, `tuneApply`).

## GRAVE

### 2. Le message de bienvenue d'une partie NEUVE est « 💾 Partie rechargée : 25 🪙 »
✅ RÉPARÉ — `wallet` vaut 25 par défaut sans clé enregistrée et `rechargeTout()` prenait cette valeur pour une sauvegarde ; on ne dit « rechargée » que si `superobby.wallet` existe, sinon « 👋 Bienvenue en ville ! stick gauche pour marcher · △ agir · ◯ sauter » (vocabulaire de la commande) — commit 3fe8d47
- **Gravité** : GRAVE (première minute — premier message faux)
- **Reproduire** : profil vierge (navigateur neuf), accueil → Jouer → Ville.
- **On voit** : en très gros au centre « 💾 Partie rechargée : 25 🪙 », puis rien qui dise quoi faire.
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
- **Gravité** : GRAVE (bâtiment promis « visitable » : commissariat, prison, guichet des plaintes)
- **Reproduire** : Ville, se placer en (−54, 40) face au nord, stick avant 7 s : on entre par la porte sud du commissariat (−54, 28) ; puis stick droit vers la gauche 0,8 s.
- **On voit** : à l'intérieur, les murs montrent les fenêtres bleues de la FAÇADE extérieure, au-dessus un bloc de toit sombre qui flotte avec le ciel autour ; le guichet « PLAINTES » est vide alors que « L'agent d'accueil : Bonjour, que puis-je pour vous ? » s'écrit dans le chat ; en tournant la caméra on se retrouve DEHORS, à regarder le dos du panneau « AVIS DE RECHERCHE », personnage invisible.
- **On devrait voir** : une pièce fermée (plafond, murs intérieurs), un agent derrière le guichet, une caméra qui reste dedans.
- **Capture** : `img/s3/s3-commissariat-2-dedans.png`, `img/s3/s3-commissariat-3-regard.png`.
- **Sonde** : `cam.interieur = true` mais rien ne bloque la caméra (`cam.dist` 5,0 → 6,8 en tournant).

### 22. Dans les bâtiments, le stick droit envoie la caméra à travers les murs et les meubles
- **Gravité** : GRAVE (dès qu'un enfant regarde autour de lui dedans, il ne voit plus son personnage)
- **Reproduire** : entrer dans l'école (classe (−69, 213)), la banque (guichet (−57, 70)), l'hôpital (hall (14, 212)) ou le concessionnaire (comptoir (−140, 93)), puis pousser le stick droit à gauche 0,8 s.
- **On voit** : école → la caméra est DEHORS, on voit la façade verte et le grillage, personnage invisible ; banque → caméra dans la vitre du guichet, étiquette « guichet » géante, tête du guichetier dans l'objectif ; hôpital → caméra DANS le bureau d'accueil (une planche brune barre l'écran) ; concessionnaire → caméra dans le bras du personnage (aplat couleur peau plein écran).
- **On devrait voir** : la caméra qui s'arrête au mur et se rapproche du personnage, jamais dans un meuble ni dehors.
- **Capture** : `img/s3/s3-ecole-3-regard.png`, `img/s3/s3-banque-3-regard.png`, `img/s3/s3-hopital-3-regard.png`, `img/s3/s3-concessionnaire-3-regard.png`.
- **Sonde** : hôpital `cam.interieur = false` alors que le joueur est en (14, 212) au milieu du hall (l'hôpital n'est pas dans `city.interieurs`).

### 26. Les voitures du parking du centre sont garées face à la terrasse du snack : R2 = on défonce les tables sans avancer
- **Gravité** : GRAVE (première voiture qu'un enfant prend : elle ne part pas et se casse)
- **Reproduire** : parking (−23…−3, 3…14), voiture en (−15, 11,5). △ pour monter, R2 à fond 5 s.
- **On voit** : la voiture reste sur place (vitesse 2,6 → −2 → 1 m/s, position inchangée), les dégâts montent 🔧 2 % → 10 % en 5 s ; en braquant elle GRIMPE sur la terrasse (`c.y` 0,15 → 0,66, roues 60 cm au-dessus du sol). Le parking est dessiné au milieu des tables et parasols du snack.
- **On devrait voir** : des places de parking dégagées, ouvertes sur la rue, et aucun dégât à 2 km/h.
- **Capture** : `img/s4/s4-0-pres.png` (table et tabourets contre la voiture), `img/s4/s4-2-roule.png`, `img/s4/s4-3-tourne.png`.
- **Sonde** : `s4-pc.log` pas `gaz+1s…+5s` : `dmg` 2,36 → 9,54, `spd` ≤ 2,6, `car.z` 11,5 → 11,53.

### 27. Écraser un piéton : aucune ambulance, et la police TIRE sur l'enfant
- **Gravité** : GRAVE (fonction promise : ambulance pour les blessés, police proportionnée)
- **Reproduire** : rouler à 50 km/h dans la foule du point d'apparition (0, 3).
- **On voit** : « 🚔 Infraction : écraser Tom_le_ouf ! Niveau ★★★ », deux bots KO (hp 56), aucune ambulance ne part (`city.ambulances[*].etat = null` après 6 s), les bots écrasés se relèvent et disent « plus jamais ça » ; 40 s plus tard « Recherché ★★ · ils tirent ! ». Puis arrestation → écran Prison.
- **On devrait voir** : ambulance + brancard pour le blessé (promis au poste B/E), une police qui arrête sans tirer pour un accident.
- **Capture** : `img/s4/s4-6-mur.png` (★★★, « la police arrive dans 20 s »), `img/s4/s4-8-voiture.png` (« ils tirent ! »).

### 28. La circulation est quasi vide et roule HORS de la ville
- **Gravité** : GRAVE (le joueur a demandé une vraie circulation ; « conducteurs hors chaussée » déjà relevé au round 67, toujours là)
- **Reproduire** : prendre une voiture, chercher la voiture de circulation la plus proche (`city.aiCars`).
- **On voit** : 5 voitures de circulation pour toute la ville, la plus proche à 147 m ; celle-là roule sur le dallage blanc à l'extérieur de la ville, en (−75, −105), au nord du Rallye, là où il n'y a aucune route.
- **On devrait voir** : des voitures sur les avenues du centre, jamais hors de la chaussée.
- **Capture** : `img/s4/s4-8-voiture.png` (le dallage blanc, notre voiture et la police, débris de l'autre voiture).
- **Sonde** : `autre.d = 147.74` ; position (−69,9, −104,4) hors de tout `city.routes`.

### 35. Après un accident, la police et la dépanneuse « arrivent » mais ne viennent JAMAIS ; l'amende prend tout l'argent de l'enfant
- **Gravité** : GRAVE (fonction promise au round 67 : accidents, constat, dépanneuse)
- **Reproduire** : voiture du parking, se poser en (30,6, −63) cap nord, R2 : on tape le camion garé du Parking du Sud (30,6, −85) à 62 km/h.
- **On voit** : « 💥 ACCIDENT ! Les deux véhicules sont immobilisés — la police arrive » ; pendant 25 s rien ne vient : la voiture de police reste à 160 m (`pc.constat = true` à 164 m, `debarque = false`), la dépanneuse annoncée « 🚚 Une dépanneuse a été appelée (service payant) » garde `etat = null` et ne bouge pas de 54 m ; puis « 🚓 Constat : 25 🪙 d'amende — payé » : le portefeuille passe de 25 à **0**. La voiture reste bloquée 30 s, même si on la déplace (l'état `accidente` la suit jusqu'au milieu de la pelouse du Parc).
- **On devrait voir** : la voiture de police qui arrive sur place, l'agent qui descend, la dépanneuse qui vient, une amende plafonnée (jamais tout l'argent d'un enfant de 25 🪙).
- **Capture** : `img/s4b/s4b-2-choc-camion.png` (le choc), `img/s4b/s4b-6-accident15s.png`, `img/s4b/s4b-7-accident40s.png` (voiture bloquée dans le Parc, personne ne vient).
- **Sonde** : `s4b-pc.log` `suivi` t = 5…25 s : `pol[0].d` 164 → 158 m, `dep[0].etat = null`, `wallet` 25 → 0.

### 36. Un choc frontal à 62 km/h contre un camion = 3 % de dégâts, aucune secousse, aucune marque
- **Gravité** : GRAVE (promis : chocs BOOM, dégâts par paliers, marques d'impact)
- **Reproduire** : idem n° 35.
- **On voit** : `dmg` 0 → 2,97, `cam.kick = 0`, `city.marques.length = 0`, aucun bruit noté, la voiture s'arrête net sans rebond ni fumée.
- **On devrait voir** : capot froissé, pare-brise étoilé, secousse de caméra, klaxon/BOOM, marques sur le camion.
- **Capture** : `img/s4b/s4b-2-choc-camion.png`.

### 41. Se battre à mains nues est impossible : l'habitant s'enfuit au premier coup, les suivants frappent le vide
- **Gravité** : GRAVE (fonction promise : direct / crochet / uppercut, KO en six coups, ralenti du coup final)
- **Reproduire** : point d'apparition, s'approcher d'un habitant (Tom_le_ouf) à 1,1 m, ▢ ×3 puis ▢ tenu.
- **On voit** : 1er ▢ = direct, il touche (100 → 86 PV) ; le bot part aussitôt en courant (« laisse-moi ! police !! au secours ! ») : à la 2e frappe il est à 8 m, à la 3e à 14 m, au coup de pied à 20 m, et 16 coups plus tard à 55 m avec **100 PV** (il a tout récupéré). Jamais de KO, donc jamais le ralenti du coup final (`RALENTI.t = 0`), jamais de crochet ni d'uppercut qui touche. Le personnage ne suit pas sa cible (« pas d'attaque » de 16 cm seulement).
- **On devrait voir** : un adversaire qui rend les coups ou tient tête, un enchaînement direct → crochet → uppercut lisible, un KO en six coups, le ralenti.
- **Capture** : `img/s7/s7-1-direct.png` … `img/s7/s7-4-pied.png` (le bot de plus en plus loin), `img/s7/s7-7-ko.png` (pas de KO).
- **Sonde** : `s7-pc.log` `coups[*].d` : 3,41 → 9,33 → 15,11 → 25,01 ; `ko.hp = 100` après 16 coups.

### 42. Armes : ✕ puis L2 = arme RENGAINÉE, et R2 ne tire pas
- **Gravité** : GRAVE (le plan de commandes annoncé — ✕ dégainer, L2 braquer, R2 tirer — ne marche pas dans cet ordre)
- **Reproduire** : acheter le pistolet, ✕ (dégainer : « 🔫 Pistolet 8/8 »), puis L2 (braquer), puis R2.
- **On voit** : L2 affiche « 🤚 Arme rangée dans l'étui » (les deux boutons BASCULENT l'arme : `braquerVerrouille()` rengaine si elle est déjà sortie), R2 ne tire pas (8/8, 0 tir), `ciblesVerrouillables() = 0` avec deux habitants à 10 m devant. Même chose avec le couteau : ✕ le sort, L2 le range, R2 ne plante rien.
- **On devrait voir** : ✕ sort l'arme, L2 verrouille la cible (l'arme reste sortie), R2 tire ; L2 relâché = on continue de viser ou on retourne en visée libre, jamais un rengainage silencieux.
- **Capture** : `img/s8/s8-4-braque.png` (après L2 : arme dans l'étui), `img/s8/s8-5-tire.png`.
- **Sonde** : `s8-pc.log` : `degaine.drawn = true` → `braque.msg = "🤚 Arme rangée dans l'étui"`, `tir.shots = 0`, `tir.ammo = 8`.

## GÊNANT

### 4. Sur l'accueil à la manette, ✕ ne fait rien : il faut 9 appuis sur ↓ pour atteindre « Jouer »
- **Gravité** : GÊNANT (la toute première action)
- **Reproduire** : page chargée, manette branchée, ✕ → rien (aucune bague de sélection). ↓ ×9 : pseudo, 5 couleurs, « Jupe », le champ CODE, puis « Jouer ».
- **On voit** : le bouton « Jouer » est sous le bord de l'écran en 1280×720 (la carte déborde), et aucun élément n'est sélectionné au départ.
- **On devrait voir** : « Jouer » sélectionné d'office (bague jaune) et ✕ qui lance ; « Jouer » visible sans faire défiler.
- **Capture** : `img/s1/s1-accueil.png` (pas de « Jouer » visible), `img/s1/s1-focus-jouer.png`.

### 5. La foule de 12 bots est plantée en plein milieu de la route, autour du point d'apparition
- **Gravité** : GÊNANT
- **Reproduire** : entrer dans la Ville, regarder autour de soi.
- **On voit** : les 12 habitants debout sur la ligne jaune de la chaussée, immobiles pendant 12 s, deux d'entre eux collés dans la caméra (on voit leur dos en très gros au premier plan, cf. bas gauche des captures).
- **On devrait voir** : les habitants sur les trottoirs, en mouvement, pas un cercle figé autour du joueur.
- **Capture** : `img/s1/s1-premier-regard.png`, `img/s1/s1-apres-12s.png`.

### 6. Le tableau « Joueurs / Pts » (classement d'obby) est affiché dans la Ville, avec 12 zéros
- **Gravité** : GÊNANT (en mode TV il couvre un quart de l'écran et cache les habitants)
- **Reproduire** : entrer dans la Ville.
- **On voit** : à droite, une colonne de 12 pseudos à 0 point. En 1920×1080 TV elle est énorme.
- **On devrait voir** : pas de classement en Ville (il n'y a pas de points), ou repliable.
- **Capture** : `img/s1/s1-premier-regard-tv.png`.

### 7. En mode TV avec une manette PS5 branchée, un bandeau permanent dit « 📺 Manette : ouvre 📺 et scanne le code »
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
- **On voit** : « IneZoe_rider » (Ines_gg + Zoe_rider superposés), bulle « Joueur63 ! trop content de » coupée par le message central, bulle « la lave c chaud » de 40 px qui déborde sous le classement, la pastille de vie du joueur (haut droite, TV) posée SUR une bulle de dialogue, et les bulles passent DERRIÈRE la barre d'icônes du haut (« Joueur79 ! trop content de » sous 📣🚩📺, `img/s2/s2-depart-tv.png`).
- **On devrait voir** : des étiquettes qui s'écartent ou s'estompent quand elles se recouvrent, une bulle jamais coupée.
- **Capture** : `img/s1/s1-premier-regard-tv.png`, `img/s1/s1-apres-12s.png`.

### 15. Les consignes affichées parlent des touches du CLAVIER à un enfant qui joue à la manette
- **Gravité** : GÊNANT (l'enfant cherche une touche « E » sur sa manette)
- **Reproduire** : manette PS5 branchée, entrer dans la zone Rallye (0, −60) : gros message « 🏜️ Rallye : prends un buggy (E), grimpe les collines… ».
- **On voit** : « (E) » ; l'aide de la zone École dit aussi « assieds-toi a une table (E) » (`hint` de la zone, sans accents).
- **On devrait voir** : « △ » quand la manette est active (`ctrlText` ne convertit pas les « (E) » entre parenthèses).
- **Capture** : `img/s2/s2-avant2.png`.

### 16. Se baisser (L2 à pied) ne se voit pas
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

## COSMÉTIQUE

### 10. Les bots parlent de lave et de tennis dans la Ville
- **Reproduire** : rester 12 s au point d'apparition, lire le chat.
- **On voit** : « Karim_flash : la lave c chaud », « Sarah_bee : qui a déjà fini ? », « Tom_le_ouf : je suis à 🎾 Tennis, on joue jouer au tennis ! » (faute : « on joue jouer »), « 🚩 Les Requins Rouges contrôle maintenant Zone industrielle » (accord : contrôlent).
- **Capture** : `img/s1/s1-apres-12s.png`, `img/s1/s1-premier-regard.png`.

### 11. Sur l'écran d'accueil, un bot du décor est collé contre la caméra
- **Reproduire** : charger la page.
- **On voit** : un personnage géant (blond, tenue blanche) qui occupe un tiers de l'écran au premier plan, devant le panneau « 1 · Sauts ».
- **Capture** : `img/s1/s1-accueil.png`, `img/s1/s1-accueil-tv.png`.

### 12. La pastille « ⭐ 0· 🚩 0/8 » a un point médian orphelin
- **On voit** : en TV « ⭐ 0· 🚩 0/8 » (le séparateur « · » colle au 0).
- **Capture** : `img/s1/s1-premier-regard-tv.png`.

### 13. L'accueil : le mode d'emploi PS5 est un pavé de 25 lignes
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
