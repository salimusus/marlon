# MARLON 0.10 — ville, action et commandes

Cette livraison améliore le jeu de `index.html`, celui de la page principale. `sunshine.html` reste une autre version historique du projet.

## Jouer

Avec Node.js 18 ou plus, lancer `npm start`, puis ouvrir `http://127.0.0.1:8080`. Aucun téléchargement de dépendances n’est nécessaire. Garder ensemble `index.html`, `cinematic.js`, `cinematic.css`, `controls.js`, `city-detail.js` et `vendor/`. Le mode solo utilise le moteur local. Le multijoueur et le téléphone-manette nécessitent une connexion réseau au service PeerJS.

L’introduction de 32 secondes utilise les vrais modèles des personnages du jeu, une mise en scène dédiée et une musique synthétisée originale. Elle peut être passée et revue depuis l’accueil. « Exporter la vidéo » produit un fichier WebM ou MP4 selon les codecs du navigateur. La scène de présentation n’est pas une capture de la ville complète.

## Changements

### Refonte 0.10

- Introduction entièrement remontée en cinq plans : avenue au coucher du soleil, course et saut des personnages, voitures en mouvement, prise progressive des huit quartiers et finale d’équipe. Nouvelle musique originale. La nouvelle introduction est présentée une fois même si l’ancienne avait déjà été vue.
- Voirie : bitume graphite, marquages découpés aux carrefours, flèches par sens de circulation et trottoirs crème. Façades avec relief, corniches, jardinières et devantures structurées. Les ajouts utilisent trois lots géométriques ; les portes et les voies restent dégagées.
- Couleurs : sortie sRGB cohérente avec et sans post-traitement ; textures des routes et des façades revues. L’introduction utilise sa propre palette corrigée pour conserver des couleurs franches.
- PS5/Xbox : gestion des entrées extraite dans `controls.js`, sources clavier/téléphone/manette séparées, gâchettes avec hystérésis, actions bloquées pendant l’introduction et la saisie, retour des menus sans saut ou tir parasite. Pause et changement de monde utilisent le même circuit de menus.
- Stick gauche relatif à la caméra par défaut ; le mode rotation reste disponible. Sensibilité et zone morte réglables. Voir `CONTROLES.md` pour les boutons conservés et les options.
- Contacts des véhicules : rectangles orientés réels, sans collision artificielle des boîtes englobantes dans les virages. Les positions physiques, les colliders et les modèles du trafic sont synchronisés après séparation.

### Améliorations conservées de la version précédente

- Circulation : routes calculées dans le bon sens, destinations derrière le véhicule traitées par une boucle autorisée, anticipation réduite dans les virages, freinage adapté à la longueur, roues liées au déplacement réel, nettoyage de l’état lors d’une reprise.
- Urbanisme : boutique et immeuble reculés ou redimensionnés pour libérer la chaussée et préserver les entrées.
- Commandes : relâchement complet après perte de focus/déconnexion, choix stable du contrôleur, joystick du téléphone à pleine course, paquets réseau complets et arrêt des commandes périmées.
- TV : code de liaison conservé, transfert explicite vers la télévision, gestion des erreurs et fin de présentation. Le mode « lien TV » lance une partie sur cet appareil ; HDMI ou recopie d’écran conserve la partie exacte du PC. Aucune migration de sauvegarde entre appareils n’est promise.
- Rendu : reflets d’ambiance procéduraux sur verre et surfaces brillantes, maçonnerie mate, ombres stabilisées, visages et maillots détaillés. Animation marche/course, respiration et clignements améliorés. Les accessoires non portés évitent leurs calculs de matrices. Le profil Haute qualité devient le défaut des nouveaux profils ; les préférences existantes sont conservées.
- Stratégie : huit territoires actifs. Le plus grand ensemble de quartiers reliés forme le réseau de ravitaillement. Les secteurs isolés rapportent la moitié ; une banque reliée ajoute 25 % aux revenus, une industrie reliée réduit les fortifications de 20 %. La carte annonce les montants. Les revenus arrivent dans la planque toutes les deux minutes de simulation.
- Opérations : le GPS conserve leur objectif malgré les invitations sociales. Les missions du bureau et opérations territoriales ne se remplacent plus. Le panneau de suivi ne chevauche plus la minicarte.
- Sauvegardes : validation des types et bornes des données de campagne ; performance des recrues conservée après rechargement.

## Vérifier

`npm test` contrôle la syntaxe, la stratégie, les commandes, la circulation, les sauvegardes et les invariants visuels dans des simulations CPU. La refonte 0.10 est documentée dans `verification/refonte-0.10.md` ; le rapport de la première livraison reste dans `verification/release-2026-09.md`.

## État de livraison

Version candidate jouable et testée, pas certification commerciale. Les tests simulés ne prouvent pas la fluidité sur toutes les machines. Restent nécessaires : essais manette USB/Bluetooth physique et téléviseur, vraie liaison Wi-Fi à deux appareils, endurance prolongée et campagne complète jouée, contrôle des droits de tous les contenus et habillages hérités du projet. Les reflets sont approximatifs ; aucun ray tracing n’est implémenté.

Les sauvegardes restent locales au navigateur. Les données d’une autre origine (version locale, GitHub Pages, autre appareil) ne sont pas automatiquement partagées.
