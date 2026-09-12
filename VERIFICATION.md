# Vérification de MARLON — Empire urbain

## Corrections ciblées

- Touches et gâchettes bloquées après déconnexion de la manette.
- Rejet asynchrone des vibrations non pris en charge.
- Joystick générique pris à tort pour une manette Sony HID.
- Double bascule de l'arme sur L2 au lieu d'une visée maintenue.
- Conflit entre la nouvelle carte M et le raccourci historique des missions.
- Recrues KO / captives comptées comme soutien à la capture.
- Progression de capture et texte d'action périmés en changeant de secteur.
- Vols instantanés de territoires sans délai de défense.
- Portefeuille sauvegardé à zéro restauré arbitrairement à 25.
- Magot rival égal à zéro remplacé par un nouveau magot aléatoire.
- Victoire à huit secteurs conservée à tort après agrandissement de la carte.
- Reconstruction des gangs en double lors d'une nouvelle campagne.
- Faux libellé « DLSS 5 » pour un simple rendu en résolution réduite.
- Tests liés à des chemins absolus et script de captures exécuté au simple import.

## Essais

Le rapport final des tests navigateur est dans `verification/browser-results.json`.
Les captures sont prises dans Chromium en rendu logiciel, avec le préréglage bas
pour les scénarios fonctionnels. Elles ne mesurent pas les performances d'un GPU
réel ni le rendu 4K matériel.

- Analyse de syntaxe de tous les scripts et du code injecté par les tests.
- Chargement du jeu et construction de la ville avec le banc de simulation.
- 15 tests ciblés : géométrie des rendez-vous, graphes de frontières, capture
  complète avec une recrue valide, coût des défenses, unités invalides, attaque, récompenses,
  validation de sauvegarde, profils DualSense, déconnexion, absence de manette,
  changement de monde et portefeuille nul.
- 5 tests de régression existants en vrai Chromium : objet porté, changement de
  monde en véhicule, fermeture par Échap, bot bloqué contre un mur et mission
  Livraison express. Résultat : 5 réussis, aucune erreur console.
- Essais interactifs additionnels : accueil, nouveaux secteurs, carte au clavier,
  sélection d'objectif, reconnaissance, pavé DualSense simulé, déconnexion et
  affichage mobile. Voir le rapport JSON pour le résultat final.

## Limites

Pas de test matériel DualSense / téléviseur / téléphone, pas de mesure de débit
sur carte graphique, pas de test multijoueur distant. La grande suite historique
n'a pas été exécutée intégralement. Les personnages conservent leur modèle
stylisé et les véhicules conservent leur architecture de base et leurs animations.
Les graphismes ne sont pas photoréalistes.

## Résultat final

**29 scénarios réussis** : 15 tests ciblés, 5 régressions historiques et 9
contrôles dans Chromium. Aucune exception JavaScript ni erreur shader relevée
dans les parcours navigateur exécutés. Les captures ordinateur et mobile ont
été inspectées visuellement.
