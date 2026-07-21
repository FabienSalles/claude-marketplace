# Profil d'usage Claude — Fabien (lentille de priorisation)

**Source :** rapport `/insights` du 2026-07-20 (131 sessions, 2026-05 → 2026-07).
**À rafraîchir** quand tu relances `/insights`.
**Rôle :** la commande `/self-audit` pondère chaque gap/force d'un pack avec ce profil.
Un gap qui ferme une friction réelle = P1 ; orthogonal à ma façon de bosser = P3 ou skip.

## Frictions récurrentes (côté Claude) — à FERMER en priorité

1. **Over-engineering / scope creep** (25 « wrong approach », 14 « excessive changes »).
   Claude ajoute validation / garde / abstraction non demandée (table IBAN 80 pays, getters
   inutiles, stratégies sur-généralisées, offres sur-incluses).
   → Priorise ce qui **impose le minimalisme**. Refuse ce qui ajoute de la surface. Défaut : « laisser ».

2. **Actions git / outillage non sanctionnées.**
   `git add -A`, PR avant sync main, rename prématuré, création d'issue/PR sans accord.
   → Priorise les garde-fous rendant git/commit/PR **opt-in**. Une reco qui automatise du git = rejetée.

3. **Détours au lieu de réponses.**
   Sur un « pourquoi », Claude lance des diagnostics au lieu de répondre d'abord.
   → **Answer-first** : verdict d'abord, investigation ensuite et seulement si nécessaire.

## Forces à AMPLIFIER

1. **Cadence spec-driven TDD, gate = tests verts.** Itérations fonctionnelles, handoff propre.
2. **Root-cause + test de régression** reproduisant l'échec exact (500/404), jamais un patch de surface.
3. **Méta-tooling** : traite son setup Claude comme un produit (audit des skills, commandes source-agnostic).

## Préférences dures

- **Français** par défaut.
- **Fix minimal** ; proposer le plus petit changement avant de coder ; lister ce qui NE sera PAS touché.
- Plans / brouillons dans `.claude/plans/`.
- **Staging manuel** ; jamais de commit/PR sans accord explicite.
