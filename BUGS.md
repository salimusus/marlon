# BUGS.md — ce que voit un enfant qui joue à SuperObby (round 70, agent Joueur)

Méthode : manette PS5 simulée, images simulées (`__G.step(1/60, true)` + `pollGamepad` + `updateBot`),
captures regardées une à une, en 1280×720 (PC) et en 1920×1080 mode TV. Outils dans
`scratchpad/joueur/` (`joueur.js` pilote, `aide.js` manette simulée, `sN.js` scénarios, `img/sN/` captures).
Rien n'a été corrigé dans `index.html`. Liste classée par gravité, numérotée dans l'ordre de découverte.

Gravités : BLOQUANT (on ne peut plus jouer) · GRAVE (une fonction promise ne marche pas) ·
GÊNANT (ça se voit, ça agace) · COSMÉTIQUE.

---

## GRAVE

### 1. Au premier pas, le personnage marche VERS la caméra
- **Gravité** : GRAVE (première minute — le premier geste de l'enfant part à l'envers)
- **Reproduire** : accueil → Jouer → Ville. Sans toucher la caméra, pousser le stick gauche vers l'avant.
- **On voit** : le personnage nous regarde (on lit « JOUEUR64 51 » sur sa poitrine : `P.facing = π`, `cam.yaw = 0`),
  il avance vers l'écran et disparaît sous la caméra. Voir mesure dans la section « Scénario 2 » (`s2-avant.png`).
- **On devrait voir** : le personnage de dos, qui part dans le décor quand on pousse vers l'avant (comme dans tous les jeux de ville).
- **Capture** : `scratchpad/joueur/img/s1/s1-premier-regard.png` (le personnage de face au départ).
- **Sonde** : `chooseWorld()` pose `P.facing = Math.PI; cam.yaw = 0` (index.html ~l. 15895).

### 2. Le message de bienvenue d'une partie NEUVE est « 💾 Partie rechargée : 25 🪙 »
- **Gravité** : GRAVE (première minute — premier message faux)
- **Reproduire** : profil vierge (navigateur neuf), accueil → Jouer → Ville.
- **On voit** : en très gros au centre « 💾 Partie rechargée : 25 🪙 », puis rien qui dise quoi faire.
- **On devrait voir** : un accueil (« Bienvenue en ville ! △ pour agir, stick pour marcher… »), et « Partie rechargée » seulement quand il y a vraiment une sauvegarde.
- **Capture** : `img/s1/s1-premier-regard.png`, `img/s1/s1-premier-regard-tv.png`.

### 3. Dès la première seconde, la pastille du haut dit « 🚩 Il te faut un membre de ton gang avec toi »
- **Gravité** : GRAVE (incompréhensible pour un enfant qui vient d'arriver ; ça reste affiché en permanence)
- **Reproduire** : entrer dans la Ville, attendre 2 s sans rien faire, au point d'apparition (0, 3.5).
- **On voit** : `#act` = « 🚩 Il te faut un membre de ton gang avec toi » (tronqué « 🚩 Il te faut un ... » en 1280) et ça reste pendant les 12 s observées.
- **On devrait voir** : rien de la guerre des gangs tant que l'enfant n'a pas ouvert l'écran 🚩 ; la pastille d'action doit dire l'action possible ici (« △ parler », « △ monter »).
- **Capture** : `img/s1/s1-apres-12s.png`, `img/s1/s1-premier-regard-tv.png`.
- **Sonde** : `J.hud().act` = « 🚩 Il te faut un membre de ton gang avec toi » à t+2 s, zone = null.

### 14. On sort de la ville à pied et on TOMBE DANS LE VIDE (mort, 💀 +1)
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
- **Capture** : , .
- **Sonde** :  mais rien ne bloque la caméra ( 5,0 → 6,8 en tournant).

### 22. Dans les bâtiments, le stick droit envoie la caméra à travers les murs et les meubles
- **Gravité** : GRAVE (dès qu'un enfant regarde autour de lui dedans, il ne voit plus son personnage)
- **Reproduire** : entrer dans l'école (classe (−69, 213)), la banque (guichet (−57, 70)), l'hôpital (hall (14, 212)) ou le concessionnaire (comptoir (−140, 93)), puis pousser le stick droit à gauche 0,8 s.
- **On voit** : école → la caméra est DEHORS, on voit la façade verte et le grillage, personnage invisible ; banque → caméra dans la vitre du guichet, étiquette « guichet » géante, tête du guichetier dans l'objectif ; hôpital → caméra DANS le bureau d'accueil (une planche brune barre l'écran) ; concessionnaire → caméra dans le bras du personnage (aplat couleur peau plein écran).
- **On devrait voir** : la caméra qui s'arrête au mur et se rapproche du personnage, jamais dans un meuble ni dehors.
- **Capture** : , , , .
- **Sonde** : hôpital  alors que le joueur est en (14, 212) au milieu du hall (l'hôpital n'est pas dans ).

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
- **Capture** : , .

### 24. Les habitants fixent des rendez-vous à l'enfant sans qu'il ait rien demandé, et le GPS s'allume tout seul
- **Gravité** : GÊNANT (les chevrons cyan au sol dès la première seconde viennent de là — cf. n° 3)
- **Reproduire** : rester en ville 2 minutes.
- **On voit** : « Sarah_bee : ok Joueur40, je prends un vélo et je te retrouve à Parking du Sud 🚗 », « MaxiBloc : ok Joueur40, je prends une voiture et je te retrouve à Tatouage », gros message central « 🚗 MaxiBloc va chercher une voiture, direction Tatouage », et le radar affiche une destination (297 m, 135 m, 179 m) avec des chevrons cyan au sol — l'enfant n'a jamais parlé à ces bots.
- **On devrait voir** : un rendez-vous seulement après une vraie invitation (△ parler → « on se retrouve où ? »).
- **Capture** :  (chevrons + 297 m),  (message central).

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
- Banque : écrans d'ordinateur qui flottent sans pied sur le guichet, « pyramide » jaune posée sur le comptoir () ; étiquette « Joueur40 » qui recouvre le panneau « COFFRES · 2e ÉTAGE » ().
- Hôpital : bandes de sol cyan et verte de 2 m de large qui ressemblent à des tapis, sans explication ().
- Concessionnaire : le vendeur « Gérard Boulon » porte chapeau melon et lunettes noires derrière son comptoir ().
