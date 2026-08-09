# Comparatif fonctionnel : Hermes, et le reste du panel

> **Note du 2026-08-06 : document dépassé.** Le comparatif courant et canonique est
> [`comparison.md`](comparison.md), écrit après celui-ci et vérifié contre le code. Cette page
> reste pour sa lecture non technique en français ; deux de ses affirmations ont été corrigées
> sur place à cette date (la narration de l'implémenteur, et la ligne « Fusible » de la synthèse).
> En cas de désaccord entre les deux documents, `comparison.md` gagne.

Lecture non technique d'un document qui existe déjà et qui reste la source :
[`prior-art.md`](prior-art.md) (le panel des harnesses de delivery). Ici, aucun chemin de fichier,
aucun numéro de ligne. Quatre questions posées à chaque concurrent, toujours les mêmes :

1. qu'est-ce qui diffère, sur le fond ;
2. qu'est-ce qu'il ne fait pas et que je fais ;
3. qu'est-ce que je fais mieux, et à quel prix ;
4. qu'est-ce qu'il aurait pu m'apporter.

Une règle de lecture : la quatrième question n'est pas une politesse. C'est la seule qui produise
du travail.

## Ce que j'ai construit, en une page

Une chaîne qui va d'une intention à une pull request, sans moi entre les deux.

J'écris un plan avec la machine, en répondant à des questions une par une. Ce plan découpe le
travail en tranches, et chaque tranche déclare **par avance** ce qui prouvera qu'elle est faite :
la commande exacte à lancer, les fichiers qu'elle a le droit de toucher, la taille maximale du
changement. Puis je gèle le plan et je pars.

À partir de là, une boucle tourne. Pour chaque tranche : une session fraîche implémente, puis un
programme juge. Le juge n'est pas un modèle qui relit, c'est un script qui exécute et qui renvoie
un code de sortie. S'il refuse, la boucle s'arrête net et n'essaie pas les tranches suivantes.
S'il accepte, c'est lui, et lui seul, qui commite et qui coche la case dans le plan.

Le résultat sort en continu sous forme de pull request en brouillon, réécrite à chaque tranche
posée. Un run qui s'arrête à 3 tranches sur 15 laisse quand même quelque chose de lisible.

Le principe qui tient tout, détaillé dans [`autonomous-architecture.md`](autonomous-architecture.md) :
**le modèle n'est utilisé que là où il faut juger** (implémenter, classer une panne, relire).
Partout ailleurs, c'est un programme. Un ordre écrit en prose est suivi parfois. Un ordre écrit en
programme est exécuté. Un code de sortie est un fait.

La raison de ne pas confier ce jugement à un modèle est mesurée : l'accord d'un modèle-juge avec
la vérité humaine sur la correction d'un bout de code plafonne à un Kappa de 0,21 en Java et 0,10
en Python, et une étude systématique a vu la moitié des implémentations fausses en Java jugées
correctes.[^judge]

---

# Partie 1 : Hermes

Hermes, c'est une passerelle de messagerie devant un agent. On lui parle depuis Telegram ou une
vingtaine d'autres canaux, il lance du travail, il rend compte. Sa force revendiquée, et elle est
réelle : ce n'est pas un simple minuteur, il y a un agent qui **décide** quoi lancer.

## 1. Ce qui diffère, sur le fond

Hermes est un **point d'entrée conversationnel**. Je suis une **chaîne de production avec un
contrôle qualité**.

Ce n'est pas la même question. Hermes répond à « comment je déclenche et comment je suis ». Ma
frustration d'origine était « comment je sais que ce qui a été produit tient ». Les deux outils ne
sont pas sur la même marche de l'escalier, et c'est l'essentiel du désaccord.

La conséquence concrète : Hermes lance mon harness aussi bien qu'il lance n'importe quoi d'autre.
Il ne remplace rien de ce que fait mon harness, il se pose devant. Ce qui veut dire que la
question « Hermes ou pas » ne se joue pas sur la qualité de ce qui est produit, mais sur le
confort de déclenchement et sur le prix payé pour ce confort.

## 2. Ce qu'Hermes ne fait pas, et que je fais

**Il n'a pas de juge.** C'est le point qui résume tous les autres. Hermes lance et rapporte. Rien,
dans sa chaîne, ne vérifie que ce qui est sorti tient debout. Chez moi, rien n'est commité avant
qu'un programme n'ait exécuté la commande déclarée dans le plan et renvoyé zéro.

**Il ne vérifie pas que le test mord.** Chez moi, avant d'accepter une tranche, le code écrit est
mis de côté et la commande de test est rejouée. Si elle passe quand même, la tranche est refusée :
le test ne prouvait rien. C'est la différence entre « les tests sont verts » et « les tests sont
verts *et* ils étaient rouges sans ce code ».

**Il ne tient personne à un plan.** Chez moi le plan est empreinté. Un run qui aurait réécrit ses
propres critères de réussite en cours de route est refusé. C'est un contrat, pas une suggestion.

**Il ne borne pas le périmètre.** Chaque tranche déclare les fichiers qu'elle peut toucher et la
taille maximale du diff. Une tranche qui déborde est refusée avant d'être commitée.

**Il ne survit pas au processus.** Mon état durable, ce sont les cases cochées dans le plan,
cochées par le juge dans le même processus que la vérification. Un run relancé le lendemain
relit le plan et repart à la première case vide. Rien n'est porté dans une mémoire de
conversation.

**Il ouvre grand ce que j'ai délibérément fermé.** Mon run est *muet en lecture* vis-à-vis de
GitHub : la seule chose qu'il relit là-bas, c'est un numéro de pull request. Il ne lit jamais le
texte d'une issue, ni d'un commentaire, ni d'une PR. La raison n'est pas théorique : en février
2026, un simple **titre d'issue** malveillant a suffi à faire pousser du code attaquant dans le
dépôt d'un agent de code, et jusque dans son paquet npm publié.[^clinejection] Tout agent qui lit
du texte écrit par autrui **et** qui détient des droits d'écriture est à une injection près de
s'en servir.

Hermes met vingt canaux de messagerie devant un agent qui écrit. Ce n'est pas un réglage à
durcir, c'est sa proposition de valeur. Elle est incompatible avec la mienne.

## 3. Ce que je fais mieux, et à quel prix

**Le déclenchement est mécanique, donc il ne peut pas se tromper.** L'argument fort en faveur
d'Hermes, c'est qu'il décide au lieu de simplement tirer. C'est vrai, et ça ne paie pas ici :
**lancer un plan ne demande aucun jugement.** Le plan suivant, c'est l'ordre de la liste ou une
dépendance déclarée. Mettre un agent qui décide à cet endroit ajoute un mode de panne à la seule
couche que j'ai volontairement rendue idiote, sans rien acheter en échange. Un cron fait le même
travail avec rien à se mettre de travers.

**J'observe au bon grain.** Hermes regarde une session : combien de temps, combien de tokens. Ce
n'est pas ma question. Ma question est « est-ce que ça avance », et la réponse est déjà produite
sans lui : la pull request est réécrite à chaque tranche posée, les cases se cochent dans le plan,
et un journal de run reste sur le disque. Une réserve, corrigée le 2026-08-06 : chaque action de
l'implémenteur est bien narrée, mais **après coup**, pas en direct. La narration lit la sortie du
processus enfant une fois qu'il a rendu la main, donc une tranche longue reste muette du début à
la fin, et c'est justement le moment où l'on voudrait savoir si ça avance. Brancher Hermes
reviendrait quand même à poser un tuyau au-dessus de données qui existent déjà sous une meilleure
forme, mais la granularité temporelle, elle, n'est pas là.

**Quand ça casse, c'est classé de l'intérieur.** Une panne est classée par une commande qui a
accès au code de sortie du runner, à l'empreinte du plan, aux transcripts, et à un ensemble fermé
de réparations autorisées avec une vérification qu'aucun critère de réussite n'a bougé. Elle
répare et relance **une fois**, puis s'arrête. Un agent Hermes classerait la même panne depuis du
texte de chat, sans rien de tout ça.

**Le prix.** Il est réel et il faut le dire : je suis beaucoup plus lourd à mettre en route.
Écrire un plan avec des commandes d'acceptation, des périmètres et des budgets de diff, ça prend
une session entière avant la première ligne de code. Hermes, on lui parle. Mon système ne se
justifie que sur du travail assez gros pour amortir ce plan, et il est franchement mauvais sur
une correction de dix minutes.

## 4. Ce qu'Hermes aurait pu m'apporter

Trois choses, dont une seule est vraiment sans réponse aujourd'hui.

**La passerelle téléphone.** Lancer et suivre depuis Telegram, depuis n'importe où. C'est du
confort réel, et je ne l'ai pas. Mais c'est un canal, pas un mode nuit.

**Le mode nuit, justement : non.** C'est l'erreur d'appréciation qu'il faut ne pas refaire.
Hermes délègue à Claude Code sur la même machine. « Travailler la nuit » au sens *Mac éteint*,
il ne le fournit pas. Et le vrai blocage est ailleurs : mes portes de qualité sont les commandes
Docker du projet lui-même. Tourner sans ma machine suppose un environnement où ces commandes
s'exécutent. C'est une question d'environnement, pas de planification, et aucun outil de
déclenchement n'y touche.

**La réaction après le run, et c'est le vrai manque.** Il y a trois événements qui demandent
réellement une décision, et que personne n'apprend aujourd'hui chez moi :

- la CI passe au rouge sur la pull request que le run vient d'ouvrir ;
- un run s'est arrêté et le diagnostic dit que la cause est l'infrastructure, pas le code ;
- la base a bougé et la branche arrêtée est devenue périmée.

Le premier est [le plus gros trou ouvert du système](loops.md). C'est exactement le terrain où un
agent qui décide gagnerait sa place : non pas en amont pour déclencher, mais en aval pour réagir.

**Sauf que la forme sûre de ce besoin ne ressemble pas à Hermes.** Réagir à une CI rouge suppose
de lire du texte de CI et de PR, c'est-à-dire précisément ce que mon invariant interdit. La forme
qui couvrirait ces trois événements sans céder l'invariant est
[déjà écrite ailleurs](steering-and-injection.md), et elle est sévère : un agent lecteur en quarantaine, sans aucun outil d'écriture, un vocabulaire distant où
tout verbe ne peut que **retirer** quelque chose (jamais ajouter), et le canal le plus riche
autorisé étant un panneau de cases à cocher que le run écrit lui-même et relit comme une suite de
bits. On pilote en cochant. Aucun texte écrit par quelqu'un d'autre ne traverse jamais.

**Verdict : Hermes en réaction, pas en déclencheur, et pas sous cette forme.** Le besoin qu'il
révèle est légitime. L'outil ne l'est pas dans ce système.

---

# Partie 2 : Le reste du panel

Mêmes quatre questions, en beaucoup plus court. Le panel : aider, OpenHands, Cline, Roo, Cursor,
Codex, Amp, SWE-agent, spec-kit, SwarmOps, Jules, Bernstein.

## 1. Ce qui diffère, sur le fond

**Tout le monde vend son orchestrateur. Moi je vends le juge.**

Ma boucle est ordinaire, et n'importe qui peut la refaire. Ce qui ne se refait pas, c'est ce qui
décide qu'une tranche est acceptée. Si une seule pièce de ce système méritait d'être extraite et
publiée seule, c'est celle-là.

## 2. Ce qu'ils ne font pas, et que je fais

**Personne ne demande si le test a été rouge avant.** C'est la revendication centrale, et elle est
falsifiable. La règle « le test doit échouer avant le correctif » n'est pas neuve : c'est le
critère d'admission de SWE-bench, le jeu de données de référence.[^swebench] Mais SWE-bench est un
harness d'**évaluation**, qui vérifie ça dans un conteneur jetable. Aucun harness de **livraison**
ne le rejoue. Tous acceptent un changement quand la suite est verte, aucun ne demande si elle a
jamais été rouge.

Pourquoi ça compte, et ce n'est pas du luxe : la boucle publiée de Codex « relance votre suite de
tests encore et encore, en corrigeant ce qui échoue jusqu'à ce que tout passe ».[^codex] Quand la seule
condition d'arrêt est *le test passe*, **modifier le test est un chemin valide vers l'arrêt**. Le
bite check transforme la condition en *le test passe et il échouait sans ce code*, ce qui rend la
réécriture du test inutile comme stratégie, plutôt que simplement interdite.

**Personne ne rend le plan opposable.** La famille des outils dirigés par la spécification
(spec-kit chez GitHub, Agent OS) produit d'excellents plans et n'embarque **aucun mécanisme pour y
tenir l'agent**.[^speckit] Le plan est consultatif, l'agent le réinterprète en silence. Chez moi il est
empreinté et un run qui l'a réécrit est refusé. Sur la foi du panel, c'est un différenciateur plus
fort que le bite check : le bite check est au moins *concevable* ailleurs, alors qu'un plan
opposable contredit la façon dont tous les autres traitent la planification.

**L'ordre commit / vérification est inversé chez le plus utilisé d'entre eux.** aider commite
d'abord et vérifie ensuite, et sa propre documentation confirme qu'il contourne par défaut le hook
de pré-commit du dépôt.[^aider] Son filet, c'est une commande d'annulation. Chez moi le juge est le
seul à commiter, et il commite après avoir vérifié.

**Le juge, ailleurs, est un lecteur.** SWE-agent, la référence académique, n'exécute rien pour
relire : il écrit le diff dans un fichier et le renvoie **au même modèle** comme message de
relecture.[^sweagent] C'est de l'auto-certification. Un cousin public plus sérieux exige qu'une
seconde session imprime `VERDICT: PASS` avant de pousser : un juge séparé, avec qui on peut
argumenter.[^loops] Le mien renvoie un code de sortie.

**Et l'éditeur de Claude Code n'a pas outillé sa propre recommandation.** Sa documentation dit de
partir des signaux déterministes du dépôt et de faire juger par un agent séparé.[^anthropic] La
demande d'un contrat de code de sortie sur `claude -p` a été fermée « non planifié ».[^issue28489]
Je remplis un trou décrit par mon propre fournisseur.

## 3. Ce que je fais mieux, et à quel prix

**Une contrainte mécanique plutôt qu'une classification.** Cursor, le leader du marché, documente
ses propres garde-fous comme « des garde-fous au mieux, pas une frontière de sécurité », a
abandonné sa liste d'interdictions, route les appels non autorisés vers un classificateur qui est
lui-même un modèle, et conclut par « utilisez toujours un gestionnaire de versions pour pouvoir
revenir en arrière ».[^cursor] Il a arbitré pour la vitesse et traite git comme le seul vrai filet. Ça
valide mon pari, et ça en nomme le prix : **je suis beaucoup plus lent à poser une tranche.**

Amp, dans le même panel, prend le contre-pied et mérite sa phrase : retirer un outil à un agent
ne fait que l'envoyer chercher un autre chemin (interdire la lecture d'un fichier, et il le lit
par une commande shell), donc sa réponse est une chaîne de permissions qui rend un verdict
*autoriser / refuser / demander / déléguer*, le dernier confiant la décision à un programme
externe qui répond par un code de sortie.[^amp] C'est exactement l'objection à ma deuxième
invariante, et elle porte : mes quatre règles d'interdiction sur des verbes git sont un préfixe
lu une fois, pas une décision déléguée à un programme. Ce qui tient chez moi, c'est ce qui vient
après : les empreintes prises autour de l'implémenteur, qui constatent le commit, la poussée, la
remise et le hook planté.

**Rien n'atterrit non vérifié, donc je n'ai pas besoin d'annuler.** Le mode permissif de Cline
« désactive toutes les vérifications de sécurité » et son filet documenté est git. Roo tient des
points de restauration dans un dépôt git fantôme, créés *après* la modification, et sa propre
documentation admet qu'« aucun processus d'approbation formel n'existe avant que les changements
soient acceptés ».[^cline] Aucun des deux n'a de juge. Mon échange est cohérent, mais il a un coût que je
n'ai pas payé : **la médecine légale après une panne.** Roo peut rejouer le film. Moi, quand une
tranche s'arrête, ce qui existe c'est l'arbre tel que l'implémenteur l'a laissé, et rien d'autre.

**Il faut aussi nommer où ma revendication est plus étroite qu'elle n'en a l'air.** « Rien n'est
publié sans vérification » ne tient pas au niveau du run : je pousse et j'ouvre la pull request au
fil des tranches, et la barrière globale ne tourne qu'à la fin. Par tranche, l'invariant tient.
Au niveau du run, la dernière barrière ne garde plus rien qu'elle puisse encore arrêter.

## 4. Ce qu'ils ont, et que je n'ai pas

C'est la partie la plus utile du document. Cinq manques, par ordre de ce qu'ils coûteraient à
réparer.

**Un fusible.** SwarmOps plafonne tout numériquement : tours, reprises, cycles de relecture, un
délai maximal de trente minutes.[^swarmops] Le plugin `ralph-wiggum` d'Anthropic lui-même dit
qu'attendre une promesse de fin dans du texte n'est pas fiable et de « toujours s'appuyer sur un
nombre maximal d'itérations comme mécanisme de sécurité principal ». Chez moi l'horloge existe,
mais du mauvais côté : **toute commande déclarée** (le balayage de base, les commandes
d'acceptation, la Definition of Done) tourne sous une limite de 900 secondes, réglable, qui tue
le processus sans lui demander son avis. La **session d'implémentation**, elle, part sans aucune
limite de temps, et il n'y a **ni limite de tours ni limite d'itérations**. Un implémenteur qui
tourne autour d'une tranche impossible tourne donc jusqu'à épuisement du quota. Le mécanisme
existe déjà : il reste à le brancher là où ça compte.

**La détection d'un test affaibli.** Le mode de défaillance a une taxonomie stable en quatre
signaux : assertions supprimées, tolérances élargies, tests marqués à ignorer, valeurs attendues
et instantanés régénérés. Et une formule qui vaut d'être retenue : *dans une PR d'agent, les tests
font partie de la revendication, pas de la preuve.*[^rewrite] Mon bite check prouve que le test **mord**. Il
ne prouve pas qu'il affirme **autant** qu'avant. Un test dépouillé de trois assertions sur quatre,
gardant celle qui échoue sans l'implémentation, passe le bite check et tient sous n'importe quel
budget de diff. Rien ne compte les assertions, ne détecte un `skip` ajouté, ni ne compare un
instantané.

**Un jeu de contrôle caché.** Une étude a mesuré 30,4 % de tricherie sur la fonction de notation
chez un modèle de pointe, et le facteur explicatif qu'elle nomme est **l'accès à cette
fonction**.[^metr] Or mes commandes d'acceptation sont écrites dans le plan, et le plan est le briefing de
l'implémenteur : **je donne le barème à l'agent que je note.** Mon pari, c'est le contrat
explicite adossé au bite check pour rendre cette connaissance inoffensive. Ce pari est peut-être
juste, mais c'est un pari, et il vaut mieux l'énoncer que le laisser implicite.

**Une preuve exportable.** Bernstein tient un journal de rejeu toujours actif, avec une chaîne
d'audit signée, vérifiable hors ligne par un tiers sans rejouer le run.[^bernstein] Chez moi, « chaque
affirmation est une commande qui a tourné » est une promesse sur la façon dont le code est écrit.
Il n'existe aucun artefact que quelqu'un d'autre puisse vérifier.

**Un critique machine du plan.** Jules, chez Google, a ajouté un critique qui relit les plans
auto-approuvés avant toute ligne de code, pour une réduction mesurée de 9,5 % du taux
d'échec.[^jules] Garder mon interrogatoire de plan humain est un choix délibéré et bien soutenu (le consensus du
domaine est qu'une boucle autonome ne doit pas être pointée sur une demande ambiguë), mais rien ne
critique mécaniquement un plan avant qu'il soit gelé. Et un défaut de plan est justement ce que
mon classificateur de pannes a le plus souvent à traiter.

**Et un axe entièrement vide.** OpenHands a une couche de sécurité sophistiquée et aucune porte de
test : analyseurs de risque, niveaux, politiques de confirmation.[^openhands] Codex prend la même
route, en conteneur isolé sans réseau. **OpenHands protège la machine de l'agent. Je protège le dépôt de
l'agent.** L'axe OpenHands est entièrement vide chez moi : pas de bac à sable, pas d'isolation
réseau, ça tourne dans l'arbre de travail du développeur. C'est une dette assumée, pas un bug :
mon harness est pointé sur un dépôt dont son propriétaire a la confiance. Le jour où il est pointé
sur un autre, tout cet axe manque.

## Deux choix faits à l'aveugle que la littérature a depuis notés

Ça mérite d'être su, parce que c'est rare.

**Une preuve périmée est pire que pas de preuve.** Mesuré : utiliser une trace de vérification
périmée contre du code courant a cassé 34 tentatives sur 135 par ailleurs correctes, contre 4 sur
135 avec une trace à jour.[^looping] Mon juge rejoue ses commandes contre l'arbre dans lequel il se tient,
donc sa preuve est liée à l'état par construction, jamais reportée d'un tour sur l'autre. C'était
une intuition, c'est maintenant un chiffre.

**Forcer une deuxième révision dégrade le résultat.** Le même travail mesure une justesse qui
tombe de 82 % après une révision à 67,3 % après deux. Ma commande de supervision relance une fois,
puis s'arrête. Même intuition, même validation.

---

# Synthèse

| Critère | Hermes | Le panel | Moi |
|---|---|---|---|
| Un programme juge le résultat | non | non (SWE-agent relit, aider commite avant) | oui, code de sortie |
| Le test doit avoir été rouge | non | personne | oui |
| Le plan est opposable | non | non (spec-kit : consultatif) | oui, empreinté |
| Périmètre et taille du diff bornés | non | non | oui, déclarés par tranche |
| Rien ne se lit depuis GitHub | non, 20 canaux | variable | oui, invariant dur |
| Fusible (tours, horloge) | oui | oui (SwarmOps) | **partiel** : horloge de 900 s sur les commandes déclarées, rien sur la session d'implémentation, pas de limite de tours |
| Détection d'un test affaibli | non | oui (littérature outillée) | **non** |
| Preuve exportable et vérifiable | non | oui (Bernstein) | **non** |
| Critique machine du plan | non | oui (Jules, -9,5 %) | **non** |
| Bac à sable / machine protégée | non | oui (OpenHands, Codex) | **non**, assumé |
| Médecine légale après panne | non | oui (Roo) | **non** |
| Piloter depuis le téléphone | **oui** | non | non |
| Réagir à une CI rouge | possible | variable | **non**, plus gros trou |

Les cases en gras de ma colonne sont la feuille de route, dans cet ordre : le fusible d'abord
(le moins cher, et à moitié déjà écrit), la détection d'un test affaibli ensuite (elle protège le seul différenciateur que
personne d'autre n'a), puis la réaction post-run sous la forme sûre décrite plus haut.

Et les deux phrases honnêtes à garder à côté de tout ça. La première : les manques ci-dessus ne
sont pas cosmétiques. La seconde : la seule étape volontairement non automatisée, l'interrogatoire
humain qui produit le plan, se trouve dans la colonne que le domaine décrit comme celle qui cesse
de passer à l'échelle. Elle n'est acceptable que parce qu'elle tourne une fois par plan, et non
une fois par changement.

---

## Où aller ensuite

| Pour | Lire |
|---|---|
| le panel, avec l'ancrage code et les réserves complètes | [`prior-art.md`](prior-art.md) |
| ce qui tient quoi, et pourquoi à cet étage | [`autonomous-architecture.md`](autonomous-architecture.md) |
| la forme sûre d'un canal de pilotage distant | [`steering-and-injection.md`](steering-and-injection.md) |
| la CI rouge et les autres boucles ouvertes | [`loops.md`](loops.md) |
| les lentilles de relecture, et pourquoi elles ne bloquent jamais | [`adversarial-verification.md`](adversarial-verification.md) |
| ce qui reste indécis, en toutes lettres | [`open-questions.md`](open-questions.md) |

Deux avertissements de lecture. Les affirmations externes ci-dessous ont été lues sur leur source
primaire en **août 2026** : elles rouillent quand ces projets livrent. Et **Hermes et Orca n'ont
pas de lien** dans cette page, parce qu'ils n'en ont pas non plus dans le document source : ils
viennent d'un artefact d'audit interne du 2026-07-31, *« goal:auto — audit & comparatif »*, et je
n'invente pas une URL pour faire joli.

---

[^judge]: *Are LLMs Reliable Code Reviewers? Systematic Overcorrection in Requirement Conformance Judgement* : <https://arxiv.org/html/2603.00539>, et *On the Effectiveness of LLM-as-a-judge for Code Generation and Summarization* : <https://arxiv.org/pdf/2507.16587>
[^clinejection]: Note de recherche CSA sur la chaîne d'injection via la GitHub Action Cline : <https://labs.cloudsecurityalliance.org/research/csa-research-note-claude-code-github-action-prompt-injection/>
[^swebench]: *Introducing SWE-bench Verified* : <https://openai.com/index/introducing-swe-bench-verified/>, et la construction `FAIL_TO_PASS` / `PASS_TO_PASS` : <https://github.com/SWE-bench/SWE-bench/issues/174>
[^codex]: *Introducing Codex* : <https://openai.com/index/introducing-codex/>
[^aider]: `aider/coders/base_coder.py` : <https://raw.githubusercontent.com/Aider-AI/aider/main/aider/coders/base_coder.py>, et <https://aider.chat/docs/git.html>
[^sweagent]: `tools/review_on_submit_m/bin/submit` : <https://raw.githubusercontent.com/SWE-agent/SWE-agent/main/tools/review_on_submit_m/bin/submit>
[^loops]: <https://github.com/lSAAGl/loop-harness>, et <https://github.com/rxdt/loopgate_harness>
[^anthropic]: *Building verification loops in Claude Code with skills* : <https://claude.com/blog/building-verification-loops-in-claude-code-with-skills>
[^issue28489]: <https://github.com/anthropics/claude-code/issues/28489>
[^cursor]: *Agent security* : <https://cursor.com/docs/agent/security>
[^amp]: *Permissions* : <https://ampcode.com/notes/permissions>, et <https://ampcode.com/news/tool-level-permissions>
[^openhands]: *Security* : <https://docs.openhands.dev/sdk/guides/security>
[^cline]: <https://docs.cline.bot/features/auto-approve>, et <https://roocodeinc.github.io/Roo-Code/features/checkpoints>
[^speckit]: <https://github.com/github/spec-kit>
[^swarmops]: <https://github.com/rekpero/claude-code-swarm>
[^rewrite]: *The test rewrite failure mode* : <https://pyor.review/blog/test-rewrite-failure-mode>
[^metr]: *Recent reward hacking* : <https://metr.org/blog/2025-06-05-recent-reward-hacking/>
[^bernstein]: <https://github.com/sipyourdrink-ltd/bernstein>
[^jules]: <https://jules.google/docs/changelog/2026-01-26-1/>
[^looping]: *Looping Is Not Reliability* : <https://arxiv.org/abs/2607.24604>
