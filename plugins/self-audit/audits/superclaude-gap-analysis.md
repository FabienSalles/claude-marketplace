# État des lieux — marketplace Fabien vs `SuperClaude-Org/SuperClaude_Framework`

**Verdict (answer-first).** **Skip intégral : 0 keep, 0 port-technique, 11/11 skip.** SuperClaude
est un framework de commandes (`/sc:brainstorm`, `/sc:implement`, `/sc:analyze`…) bâti sur une
**lourde couche de coordination** — 5-7 serveurs MCP (Sequential, Context7, Magic, Playwright,
Morphllm, Serena) + 7 personas + flags `--strategy/--depth/--parallel` — greffée sur ce que tes
skills font en 2-3 phrases. Sa **substance** (Socratic discovery, review, implement, debug, refactor)
est **déjà couverte, souvent mieux** ; sa **forme** est un cas d'école de ta friction #1
(sur-ingénierie). C'est le premier audit de la salve sans **aucun** apport net. La leçon utile est
donc négative et nette : **ne pas intégrer SuperClaude**, et ce n'est pas un manque — c'est un choix
de design opposé au tien.

> **Confiance :** ✅ = re-greppé fichier-en-main pendant CET audit · Fan-out : **62 agents, 0 erreur, ~3,0 M tokens** ; toutes les forces cibles ✅ CONFIRMED (pass 2).

---

## Méthode & sources

- **Tier `deep`** (Workflow 2 passes) sur les **11 commandes/skills du cœur** : `brainstorm`, `spec-panel`, `implement`, `workflow`, `task`, `analyze`, `improve`, `troubleshoot`, `test`, `design`, `confidence-check`.
- **Couverture mesurée :** `full=3` (implement, workflow, troubleshoot), `partial=7`, `none=1` (test).
- **Phase 2b** : spot-check des citations d'honnêteté (`confidence-check:53`, `spec-panel` panel d'experts, surface MCP/personas de `brainstorm`) — tous ✅.

---

## 1. Points forts validés — à PRÉSERVER

| # | Force marketplace | Où | Face à SuperClaude |
|---|---|---|---|
| 1 | Interview Socratique **une question à la fois + reco par question + ancrage codebase** | `pocock/grill-me` L7, L9, L11 | `/sc:brainstorm` = liste ouverte de « Discovery Questions » coordonnée sur 5 MCP + 7 personas, sans la discipline « une à la fois ». ✅ |
| 2 | Grill adversarial **falsifiable** (état × action, invariants, ASK-jamais-guess) | `goal/skills/grill-adversarial/SKILL.md` L58 | `/sc:spec-panel` = jeu de rôle de personas (Wiegers/Fowler) produisant une prose de critique **non auditable**. ✅ |
| 3 | Anti-sur-planification explicite | `common/skills/crispi-planning/SKILL.md` L75 « One approach, not three. Pick and commit. » | `/sc:brainstorm` a `--strategy/--depth/--parallel` — l'inverse du « une approche ». ✅ |
| 4 | Restraint & consentement **globaux** (CLAUDE.md : staging manuel, ask-rather-than-guess, anti-over-engineering) | CLAUDE.md global | SuperClaude ré-énonce ces gardes **par commande** (`improve`, `design`, `test`, `troubleshoot`) — placement différent, pas une capacité en plus. ✅ |

---

## 2. Manquements réels — BACKLOG

**Aucun.** Les 11 unités sont `skip`. Le seul candidat qui s'approche d'un apport, `confidence-check`
(gate de confiance **pré-implémentation**, `SKILL.md:53` « ❌ Fail if introduces new dependencies
unnecessarily » ✅), vise la même chose que le **gate de simplicité déjà porté depuis spec-kit**
(P1-b de l'audit spec-kit : « justifier toute abstraction/dépendance ajoutée ») et que
`grill-adversarial` + les gates de spec. Il n'ouvre donc **pas** de trou neuf → skip, avec renvoi
vers le backlog spec-kit.

> Si un jour tu veux un axe « confiance pré-implémentation » nommé, il est **déjà couvert** par le combo
> `grill-adversarial` (trous fonctionnels) + gate de simplicité (spec-kit P1-b) + `verification-before-completion`
> (post). Ne rien ajouter.

---

## 3. Motifs README / doc à corriger

**Aucun côté marketplace.** SuperClaude n'est ni vendored ni référencé dans `plugins/`. **Structure (Phase 4) — RAS.**

---

## 4. Divergences ASSUMÉES — NE PAS « corriger »

- **Personas nommés + coordination multi-MCP** (`brainstorm.md:7` personas ; `:40-44` Sequential/Context7/Magic/Playwright/Morphllm) : architecture d'orchestration lourde, opposée à ton anti-sur-ingénierie. Choix.
- **Flags de commande** (`--strategy/--depth/--parallel/--experts/--iterations/--format`) : surface de configuration que tu évites. Choix.
- **Gardes de restraint par-commande** : tu les tiens **globalement** en CLAUDE.md ; les dupliquer par skill serait de la redite. Choix, pas trou.
- **Exécution de tests orchestrée** (`/sc:test` lance suites/coverage/e2e) : c'est du harness/tooling, pas un skill de discipline ; tu exécutes via Bash/`feature-tdd-dev`. Hors axe.

---

## 5. Verdict cherry-pick

- **0 keep, 0 port, 11 skip.** Pack entièrement couvert ou en conflit de forme. Rien n'est assez crisp pour être porté sans traîner la couche MCP/personas/flags.

---

## 6. Sous-axes où la cible garde l'avantage (honnêteté)

- **`spec-panel` — review d'une spec EXISTANTE par lentilles d'experts multiples** (Wiegers/Adzic/Fowler/Nygard) : vrai axe que le marketplace ne fait pas directement (`spec-first-dev` **produit** une spec ; `grill-adversarial` attaque une machine à états, pas la qualité rédactionnelle d'une spec écrite). Mais c'est du jeu de rôle de persona (soft, non falsifiable) → intéressant conceptuellement, pas assez rigoureux pour porter.
- **`confidence-check` — gate de confiance pré-implémentation** (`≥90%`, check de duplication + conformité archi + docs officielles) : axe pré-code explicite. Couvert en pratique par le combo grill-adversarial + gate simplicité (cf. §2).
- **`/sc:implement` — lookup de doc officielle (Context7) AVANT d'écrire du code framework** : bonne discipline « RTFM d'abord » ; tu l'as via `doc:rtfm` (externe) + ta règle « cite les docs officielles ».
- **Neutralité cross-outil + richesse de surface** : industrialisation réelle, non pertinente pour ton usage mono-Claude, minimaliste.

---

## 7. Backlog exécutable (checklist)

```
(vide — rien à porter)
[ ] Aucune action marketplace. Verdict : ne pas intégrer SuperClaude.
[ ] Rappel : l'axe "confiance pré-implémentation" éventuel est déjà couvert par grill-adversarial
    + le gate de simplicité (backlog spec-kit P1-b) + verification-before-completion.
```

**Rappel garde-fou :** cet audit est le **cas de référence du « skip légitime »** — une cible populaire (SuperClaude
est très étoilé) dont la substance est couverte et la forme viole ta friction #1. Ne pas se laisser
impressionner par la popularité : sous anti-sur-ingénierie, « laisser » est ici la bonne et seule réponse.
