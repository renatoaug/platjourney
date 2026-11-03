# Reviewed journey pilot

The pilot applies only to A Plague Tale: Requiem's PSN list `NPWR22997_00`. It does not activate from a similar title or catalog id. `shared/journey/requiem.ts` contains 36 objective definitions and `shared/journey/model.ts` evaluates them against the supplied trophy list without writes, network access or model calls.

## Evidence and limits

Reviewed on 2026-11-03 against [PowerPyx](https://www.powerpyx.com/a-plague-tale-requiem-trophy-guide-roadmap/) and [PlatGet](https://platget.com/guides/a-plague-tale-requiem-trophy-guide/), plus the app's PSN trophy definitions. Sources are linked per objective. These are reviewed references, not verification by replaying the game or a guarantee for every patch. The English sources and localized PSN names are bound by unique normalized exact matches; the runtime retains the actual list/group/trophy id. Missing or ambiguous mappings do not silently guess.

The sources differ on some details: PlatGet labels the crowns minigame as chapter seven, whereas PowerPyx and the stored chapter-specific guidance place it in chapter eight. This pilot uses chapter eight. Historical bug reports and exact skill-percentage boundary claims are not promoted to current-version guarantees. The upgrade advice deliberately does not rely on closing the game to undo purchases. No claim is made about the player's current inventory, skill bars, New Game+ state or chapter location.

## Evaluation

Completed trophies stay completed only when the input explicitly reports them earned. The highest earned story milestone is a confirmed chapter completion, never a current location. The next chapter is a planning reference: a chapter-specific opportunity comes before its story-ending trophy. Missing earlier story trophies become verification items rather than assumed completions or instructions to replay. Earlier optional objectives remain available for recovery; future opportunities retain their place. Preparation persists independently of the selected trophy and disappears only after confirmation.

At the end of the story, remaining skills are prioritized for checking before advancing further, because recovery can require replay. The advice is conditional on the player's save and does not automatically tell them to start New Game+. Platinum has explicit dependencies on the other 35 objectives, but their completion never fabricates the platinum unlock. An incomplete trophy list withholds the personalized focus. DLC remains outside this model.

Selecting another route stop does not recompute the model or change progress. New input unlocks re-evaluate the recommendation while preserving the path's reference order. The user can preview the same route from the start without altering account data. Hidden guidance remains protected by the existing account preference.

## Integration boundary

The mounted roadmap and `todaysFocus` share this evaluator. Existing Nexo context receives that same focus. The session planner remains a separately generated plan with its existing completion tracking; its full objective constraints and time-budget selection are not integrated yet. No prompt, model routing, stored guide, database field or account state is changed by the pilot. The full legacy guide remains available separately; the reviewed roadmap uses its own safer guidance instead of inheriting every legacy trick.

## Validation cases

Tests cover a new reference route, middle-of-campaign opportunities, later chapters arriving out of order, live progress updates, skills versus upgrades after story completion, missing or duplicate names, hidden guidance, incomplete lists, completion and unchanged input data. Stories expose start, middle, out-of-order and incomplete states with synthetic progress only. Live gameplay validation and a broader editorial audit remain necessary before expanding to other games.

## Objective coverage

The table below inventories the reviewed model. Preparation timing is a planning cue, not a claim that a mechanic is already unlocked in the player's current save.

| Objective | Kind | Chapter / preparation | Recovery |
|---|---|---|---|
| Sob um Novo Sol | story | 1 | Verify PSN / save |
| Recém-chegados | story | 2 | Verify PSN / save |
| Fardo de Sangue | story | 3 | Verify PSN / save |
| Dever da Protetora | story | 4 | Verify PSN / save |
| Em Nosso Encalço | story | 5 | Verify PSN / save |
| Tudo para Trás | story | 6 | Verify PSN / save |
| Malfeitores | story | 7 | Verify PSN / save |
| Mar de Promessas | story | 8 | Verify PSN / save |
| Contos e Revelações | story | 9 | Verify PSN / save |
| Linhagem | story | 10 | Verify PSN / save |
| Berço Secular | story | 11 | Verify PSN / save |
| A Vida que Merecemos | story | 12 | Verify PSN / save |
| Não Sobrou Nada | story | 13 | Verify PSN / save |
| Feridas Curadas | story | 14 | Verify PSN / save |
| Sol Mortiço | story | 15 | Verify PSN / save |
| Rei Hugo | story | 16 | Verify PSN / save |
| Cavaleiros! | story | 17 | Verify PSN / save |
| Mira perfeita | chapter | 1 | Reviewed guidance |
| Piedade | chapter | 4 | Reviewed guidance |
| Arremesso perfeito | chapter | 8 | Reviewed guidance |
| Antiga protetora | chapter | 9 | Reviewed guidance |
| Herbalista | collectible | Prepare from 1 | Reviewed guidance |
| Ornitóloga | collectible | Prepare from 1 | Reviewed guidance |
| Exploradora | collectible | Prepare from 1 | Reviewed guidance |
| Memórias imortais | collectible | Prepare from 1 | Reviewed guidance |
| Brinquedo nada | upgrade | Prepare from 1 | Reviewed guidance |
| Balestra aprimorada | upgrade | Prepare from 1 | Reviewed guidance |
| Bolsos e mais bolsos | upgrade | Prepare from 1 | Reviewed guidance |
| Instrumentos eficazes | upgrade | Prepare from 1 | Reviewed guidance |
| Laboratório de bolso | upgrade | Prepare from 1 | Reviewed guidance |
| Discreta | skill | Prepare from 1 | Reviewed guidance |
| Lutadora | skill | Prepare from 1 | Reviewed guidance |
| Maligna | skill | Prepare from 1 | Reviewed guidance |
| Guarda noturna | counter | Prepare from 3 | Reviewed guidance |
| Alquimista | counter | Prepare from 3 | Reviewed guidance |
| Réquiem | platinum | Other base trophies | Verify PSN / save |
