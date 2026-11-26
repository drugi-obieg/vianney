---
title: Rules and sources
description: The 49 text rules of the starter pack (31 traced to verbatim passages of the Curé d'Ars, 18 the rule author's choice or resting on texts of the Church and on the Index of Forbidden Books), with the reasons behind the defaults, plus the six experimental image and audio rules.
---
{% raw %}
# Rules and their sources

## What this is

- The English starter pack for the YouTube content filter, built on the lists and categories of the Curé d'Ars (St. Jean-Marie Vianney, 1786-1859). Files in the [repository](https://github.com/drugi-obieg/vianney): `extension/rules/vianney.en.rules` (49 text rules: 27 enabled, 22 disabled) and `extension/lexicon/` (54 word lists: 39 cue lists written with the rules, 8 lists of names and titles read from the Index of Forbidden Books, five for the Lord's name, curses, blasphemy and coarse words, and two that spare a card: `catholic_channels`, the channel names, and `life_words`, the words of a life). Six experimental picture and sound rules are in `extension/rules/vianney.media.en.rules`; they are at the end of this page.
- The five word lists coarse_words, lords_name_strong, lords_name_bare, curses_imprecations and blasphemy_terms serve four rules (lords_name, blasphemy, curses_imprecations, coarse_words). The words of the Curé behind them are under "Notes for the lexicon authors".
- Status: draft. The questions, the word lists and the weights are drafts by the project, and whoever uses the pack should correct them. Lexicon weights are the placeholder tiers 0.95, 0.75, 0.50 and 0.15 (0.95 unambiguous in any context, 0.75 usually a violation, 0.50 a cue that needs context, 0.15 a bare ambiguous word for a model to judge). None of this has been tested on a labelled set, and no accuracy claim is made.
- 31 of the 49 text rules have at least one verbatim French passage of the Curé with the sermon title and a page URL. The other 18 have none, and rest on the rule author's decisions of 2026-11-26. Eight (naturalism, indifferentism, islam, judaism, eastern_religions, sects, anti_catholic, occult) say "Choice of the rule author" in their `source:` line, and "Rules chosen by the rule author (2026-11-26)" below says what each follows. Ten (freemasonry, which moved into the group "Anti-Catholicism", and the nine added in part two of that day: communism, modernism, spiritism, index_freethinkers, index_jesus_critics, index_modernists, index_philosophers, index_historians, index_novelists) name the texts of the Church or the Index of Forbidden Books that they rest on in their `source:` line and say that applying them to videos is the rule author's choice ("Rules chosen by the rule author (2026-11-26, part two)" below). An idea that has neither a passage nor a decision is under "Not included and why".
- `source:` in the rules file names one sermon per rule, the main one, or says "Choice of the rule author", or (Freemasonry and the nine rules of part two) names the texts of the Church and the Index that the rule rests on, and says that applying them to videos is the rule author's choice. The other sermons behind a rule are listed below.
- Enabled by default (27): lords_name, oaths, blasphemy, renunciation, curses_imprecations, coarse_words, gossip, calumny, impure_words, impure_sights, anti_catholic, occult, denial_of_god, naturalism, indifferentism, protestantism, islam, judaism, eastern_religions, sects, freemasonry, communism, modernism, spiritism, index_freethinkers, index_jesus_critics, index_modernists.
- Disabled by default (22): insults, mockery_of_faith, rash_judgment, tale_bearing, curiosity, immodest_dress, familiar_company, bad_books, dances, spectacles, cruel_spectacles, gambling, drunkenness, gluttony, anger, revenge, pranks, malicious_pleasure, divination, index_philosophers, index_historians, index_novelists.

## The rules

- [lords_name](#lords_name): Taking the Lord's name in vain (enabled)
- [oaths](#oaths): Oaths, calling God to witness (enabled)
- [blasphemy](#blasphemy): Blasphemy (enabled)
- [renunciation](#renunciation): Renouncing God in anger (enabled)
- [curses_imprecations](#curses_imprecations): Curses and imprecations (enabled)
- [coarse_words](#coarse_words): Coarse words (enabled)
- [insults](#insults): Insults (disabled)
- [mockery_of_faith](#mockery_of_faith): Mocking religion and holy things (disabled)
- [anti_catholic](#anti_catholic): Anti-Catholicism (enabled)
- [gossip](#gossip): Detraction and gossip (enabled)
- [calumny](#calumny): Calumny (enabled)
- [rash_judgment](#rash_judgment): Rash judgment (disabled)
- [tale_bearing](#tale_bearing): Tale-bearing (disabled)
- [curiosity](#curiosity): Curiosity about other people's affairs (disabled)
- [impure_words](#impure_words): Impure words and songs (enabled)
- [impure_sights](#impure_sights): Impure sights (enabled)
- [immodest_dress](#immodest_dress): Immodest dress (disabled)
- [familiar_company](#familiar_company): Too-familiar company between the sexes (disabled)
- [bad_books](#bad_books): Bad books (disabled)
- [dances](#dances): Balls and dances (disabled)
- [spectacles](#spectacles): Stage shows and comedies (disabled)
- [cruel_spectacles](#cruel_spectacles): Cruel spectacles (disabled)
- [gambling](#gambling): Games played for money (disabled)
- [drunkenness](#drunkenness): Drunkenness and the tavern (disabled)
- [gluttony](#gluttony): Gluttony (disabled)
- [anger](#anger): Anger (disabled)
- [revenge](#revenge): Revenge (disabled)
- [pranks](#pranks): Lies told to trick or amuse (disabled)
- [malicious_pleasure](#malicious_pleasure): Malicious pleasure in another's misfortune (disabled)
- [divination](#divination): Consulting diviners (disabled)
- [occult](#occult): Witchcraft, magic and the occult (enabled)
- [denial_of_god](#denial_of_god): Denying that there is a God (enabled)
- [naturalism](#naturalism): Naturalism and rationalism (enabled)
- [indifferentism](#indifferentism): Indifferentism (enabled)
- [protestantism](#protestantism): Protestant and evangelical teaching (enabled)
- [islam](#islam): Islamic teaching and worship (enabled)
- [judaism](#judaism): Jewish religious teaching and worship (enabled)
- [eastern_religions](#eastern_religions): Buddhism, Hinduism and other Eastern religions (enabled)
- [sects](#sects): Sects and new religious movements (enabled)
- [freemasonry](#freemasonry): Freemasonry and secret societies (enabled)
- [communism](#communism): Socialism and Communism (enabled)
- [modernism](#modernism): Modernism, the synthesis of all heresies (enabled)
- [spiritism](#spiritism): Spiritism and the calling up of spirits (enabled)
- [index_freethinkers](#index_freethinkers): Books that attack religion or insult the clergy (enabled)
- [index_jesus_critics](#index_jesus_critics): Rationalist lives of Jesus (enabled)
- [index_modernists](#index_modernists): Authors and books of the Modernist movement (enabled)
- [index_philosophers](#index_philosophers): Philosophers who undermine the foundations of religion (disabled)
- [index_historians](#index_historians): Historians whose books were forbidden (disabled)
- [index_novelists](#index_novelists): Novels forbidden by name (disabled)

## Texts, checks and limits

- Edition: *Sermons du Saint Curé d'Ars* (Lyon; the text read carries the archbishop's approval of 26 September 1893). The French is public domain. All 85 sermons of the four volumes were searched; the prefaces were not.
- Two copies were used. livres-mystiques.com (volumes 1, 2 and 4, with accents) and apotre.org, 56 pages, which says it copies jesusmarie.free.fr (all four volumes). In volume 3 the livres-mystiques copy lost its accented letters at the source, so volume-3 passages are quoted from apotre.org. Page numbers below are apotre.org pages ("page N sur 56"); page 1 has no number in its URL, and no quote is on it.
- The volume-3 sermons used, as they stand on livres-mystiques (accents lost there; the quotes come from apotre.org): Sur l'Absolution https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/Tome3/sermon4.htm; Sur l'Envie https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/Tome3/sermon13.htm; Sur l'Impureté https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/Tome3/sermon14.htm; Sur l'Ivrognerie https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/Tome3/sermon16.htm; Sur la colère https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/Tome3/sermon17.htm; Sur la pureté https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/Tome3/sermon11.htm; Sur la restitution https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/Tome3/sermon18.htm; Sur le Monde https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/Tome3/sermon6.htm; Sur le service de Dieu https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/Tome3/sermon5.htm.
- How the quotes were checked: each quote was found by program in the apotre.org page text (ignoring case, whitespace and the line-break hyphens of that copy, such as "ex-trême"; accents were compared as well) and the page number was taken from that match. For volumes 1, 2 and 4 each quote also matches the livres-mystiques text exactly, whitespace aside (one footnote quote exists there only, and is marked). In volume 3 the line-break hyphens were removed from the quotes and nothing else was changed. No quote is longer than 40 words.
- The English glosses are literal working translations made for this project, as on the sermons page; the French is the authoritative wording.
- Method: these terms were searched across all 85 sermons (accents and hyphen artifacts ignored), and the hits in lists, definitions and examples were read in context: jurements, blasphèmes, reniements, imprécations, malédictions, obscénités, injures, paroles sales and grossières, chansons, conversations, veillées, mauvais livres, romans, comédies, théâtres, spectacles, bals, danses, jeux (au jeu, joueur, jeux défendus), cabarets, tableaux and peintures, immodesties and habits, curieux and curiosité, vengeance, superstition, devins, sorciers, magiciens, horoscopes, protestants, hérétiques, francs-maçons, libres penseurs, athées, incrédules, impies, Voltaire, toutes les religions, mauvaises compagnies. The search on "yeux" and "oreilles" is the one recorded on the sermons page and was not repeated. The sermons read as sermons are listed in the next point.
- Read in full or in large part: Sur le deuxième Commandement, Sur la Médisance, Sur le jugement téméraire, Sur la pureté, Sur l'Impureté, Sur l'Ivrognerie (first two thirds), Sur l'orgueil (parts I and II). Read in the relevant parts only: Sur la Pénitence (the passage on the senses), Sur les ennemis de notre salut (the means of defence), Sur la colère (about half: the opening and the passages on oaths, blasphemy and renunciation), the sermon on the examination of conscience (the first part, on the faults), Sur l'Absolution (the occasions of sin and habitual sinners), Sur la Contrition (occasions), Sur le Monde (the amphitheatre story and every hit), Sur le Mensonge (the list of lies), Sur l'Envie (opening), Sur la religion (opening and hits), the two sermons on the first Commandment (openings and word search), the Dédicace sermon (opening and hits).
- Limit: where a sermon was not read in full, the word search is the only evidence that it holds nothing more on a subject. Other editions and the catechism instructions were not searched (the same limit as the sermons page).
- Church texts (added 2026-11-26, for the rules chosen by the rule author): these were read on 2026-11-26. The Catechism of the Catholic Church, as the page of each paragraph gives it ("Second Edition"), at https://www.scborromeo.org/ccc/para/NNNN.htm (NNNN is the paragraph; the English is the Catechism's own). The Syllabus of Errors of Pius IX (1864), in the English of https://www.papalencyclicals.net/pius09/p9syll.htm. From vatican.va: the Declaration on Masonic Associations of the Congregation for the Doctrine of the Faith (26 November 1983; the English page and the Latin page, which gives the incipit "Quaesitum est" and the reference AAS 76 [1984], 300), Leo XIII's encyclical Humanum genus (1884, English), and the Second Vatican Council's declaration Nostra aetate (1965, English). The Vatican's own pages of the Catechism and of the Syllabus were not read. Each quote below was found by program in the text of the page named, ignoring case and whitespace, and no quote is longer than 40 words. A Church text is cited only where it was read this way; where none was read, the rule says "choice of the rule author" and nothing more.
- Texts of part two (read on 2026-11-26; each quotation below was compared by program with the text of the page or the file named, ignoring case and white space): from vatican.va, in English, Quod apostolici muneris, Quadragesimo anno, Divini Redemptoris, Pascendi dominici gregis, the Message of Fatima and paragraph 2425 of the Catechism (https://www.vatican.va/archive/ENG0015/__P8C.HTM); in Latin, Quanta cura with the Syllabus of Errors; and two decrees of the Holy Office in the OCR text of the volumes of the Acta Apostolicae Sedis that vatican.va keeps (AAS 41 of 1949 and AAS 9 of 1917; a hyphen at the end of a printed line was joined and a space before a mark of punctuation ignored). The English of Qui pluribus and of the Syllabus is that of papalencyclicals.net, as in the first round. From the folder `docs/en`: the Catechism of St. Pius X and the Index of Forbidden Books (`forbidden.md`). The twelve classes of canon 1399 are quoted whole from that file and are longer than 40 words in places; `tests/index-names.test.js` checks every quotation marked `Quote (forbidden.md)` or `Quote (catechism.md)` in this file and in the research file. The other folders of `docs/en` were searched for communism, socialism, freemasonry, liberalism and modernism: they hold talks and essays, not documents of the Church, and none is cited. Lamentabili sane exitu was read in English on papalencyclicals.net and not on vatican.va, and is not cited.

## His own lists, and where each one went

- The six categories of the second Commandment sermon:
  - Quote, Sur le deuxième Commandement de Dieu (volume 2): « la différence qu'il y a entre les jurements, les blasphèmes, les reniements, les imprécations, les malédictions et les paroles grossières. »
    - English (working, literal): the difference there is between oaths, blasphemies, renunciations, imprecations, curses and coarse words.
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/commande12.html; apotre.org page 23 https://www.apotre.org/livres/vianney-sermons/23
  - Oaths, blasphemies, renunciations, imprecations and curses, coarse words became oaths, blasphemy, renunciation, curses_imprecations (imprecation and curse share one rule because he defines them together) and coarse_words. lords_name is the Name used as an exclamation, from his list of the most ordinary oaths in Sur la colère. insults ("injures") is a seventh item he separates from oaths in the same sermon.
- Detraction "in several manners" (Sur la Médisance, numbered): calumny, exaggeration, making known a hidden fault, reading bad motives into good deeds, saying nothing with a smile or a glance, and tale-bearing. They became calumny, gossip (hidden faults), tale_bearing and rash_judgment (the related sermon). Exaggeration, bad-faith reading and insinuation have no rule of their own (see "Not included").
- The senses (Sur la Pénitence, part III): eyes (curiosity, objects that lead to evil thoughts, bad books) became curiosity, impure_sights and bad_books; ears (songs and talk that lead nowhere, listening to detraction and slander) became impure_words and gossip; tongue (bad talk, bad songs, detraction, slander, oaths, coarse words) became the tongue rules above.
- The most common disorders (Sur la Sanctification du Chrétien): "les veilles, les jurements, les paroles et les chansons déshonnêtes", and tales against persons consecrated to God. They fed oaths, impure_words and mockery_of_faith.
- Examination of conscience (unpublished sermon, volume 4): the faults people remember because they are the most ordinary are "les blasphèmes, les jurements et les colères", and one of his questions asks whether you flee "la danse, le cabaret et les jeux". They support oaths, blasphemy, anger, dances, gambling and drunkenness.
- His examination of conscience on the tongue and on influence (Sur la Satisfaction): bad songs, bad books, bad counsel such as telling someone to take revenge. They fed impure_words, bad_books and revenge.
- Six ways to sin against purity (Sur l'Impureté):
  - Quote, Sur l'Impureté (volume 3): « L'on pèche en six manières : par pensées, par désirs, par regards, par paroles, par actions et par occasions. »
    - English (working, literal): One sins in six ways: by thoughts, by desires, by looks, by words, by actions and by occasions.
    - Read: apotre.org page 40 https://www.apotre.org/livres/vianney-sermons/40 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
  - Looks became impure_sights, words became impure_words, occasion (given or taken) became immodest_dress. Thoughts, desires and actions are not content and are not rules.
- What leads to impurity, in the answer he gives for a child of the catechism (Sur l'Impureté; quoted under impure_words, quote 5): dances and balls (dances), too-familiar dealings between the sexes (familiar_company), songs and free words (impure_words), immodesty in dress (immodest_dress), excess in drinking and eating (drunkenness, gluttony).
- Occasions of sin (Sur l'Absolution; Sur la Contrition): shows and comedies (spectacles), balls and dances (dances), bad books (bad_books), dishonest conversations (impure_words), indecent pictures (impure_sights), dishonest ways of dressing (immodest_dress), bad company (the four kinds below), the company of the other sex (familiar_company). He splits them in two kinds:
  - Quote, Sur la Contrition (volume 1): « les autres ne sont une occasion de péché que par les mauvaises dispositions de ceux qui y sont : comme les cabaretiers, les marchands qui trompent ou qui vendent les dimanches »
    - English (working, literal): the others are an occasion of sin only through the bad dispositions of those who are in them: such as tavern-keepers, dealers who cheat or who sell on Sundays
    - Read: livres-mystiques https://livres-mystiques.com/partieTEXTES/Ars/Sermons/tome1/passion21.html; apotre.org page 16 https://www.apotre.org/livres/vianney-sermons/16
  - The first kind is what the Contrition sermon lists "par elles-mêmes" (books, comedies, balls, dances, pictures, songs, the other sex); the second kind depends on the dispositions of the person (tavern-keepers, cheating dealers). See "Notes on defaults".
- Four kinds of "mauvaise compagnie" (Sur les ennemis de notre salut, each opened by "J'appelle mauvaise compagnie"): the man without religion who ridicules piety (mockery_of_faith), the foul-mouthed (coarse_words), the gambler and the drunkard (gambling, drunkenness), the curious, restless slanderer (curiosity, gossip).
- Six kinds of lie (Sur le Mensonge): the fifth, lying to catch someone out or to amuse the company, became pranks.
- Envy (Sur l'Envie, from St. Thomas): sadness at the neighbour's good and a malicious pleasure at his loss; the second became malicious_pleasure.
- Three excuses of drinkers (Sur l'Ivrognerie) are reflected in the wording of the drunkenness question.

## Rules chosen by the rule author (2026-11-26)

- What was decided: the rule author looked at the one thin rule on belief ("Saying there is no God") and asked for it to be broken down: atheism, naturalism, Protestantism, Islamic content and more, with more options, because he calls it the most important part of the pack and because it is difficult for a small local model to get right. The word lists therefore come first and the on-device model second.
  - The settings page has two groups for them: "Unbelief and other religions" (group `belief`) and "Faith and superstition" (group `faith`; renamed "Anti-Catholicism", group `anticatholic`, later the same day: see part two below). The order of the groups on the page is the rule author's: lewdness and immodesty, swearing, talk about others, then these two, then games and excess, then images and audio (see `RULE_GROUPS` in `options.js`).
  - belief: denial_of_god (shown as "Atheism"; the old rule, now enabled, with more cues), naturalism, indifferentism, protestantism, islam, judaism, eastern_religions, sects, freemasonry (moved to anticatholic in part two).
  - faith (now anticatholic): mockery_of_faith (unchanged, disabled), anti_catholic (new), divination (unchanged, disabled), occult (new).
  - Ten rules are new: naturalism, indifferentism, protestantism, islam, judaism, eastern_religions, sects, freemasonry, anti_catholic and occult. The eleven on belief, the Church and the occult are enabled by default. Judaism and Freemasonry were left out of the first round of that day and added later the same day, when the rule author said that he had left them out on purpose and wanted them in: "it's targeted towards traditional Catholics, they'd understand".
  - Protestantism was widened the same day: the rule author wants it to keep out the "spiritual" American preaching content that fills a feed, and named the pastors ("Pastor" and "Reverend" are common keywords) and the televangelists. See the rule.
- Settings of the new rules (choices of the rule author; none of them was measured):
  - where: lists and search results, recommended videos, the video page (feed-card, related, watch-meta). Atheism keeps comments and subtitles as well.
  - flag at 0.80, gate lexicon, action feed-card=blank and watch-meta=warn-overlay. "blank" is the choice made for gambling and divination: the grid does not shift when a model decides late.
  - The tiers of the word lists: 0.95 only for what is by itself content of that kind or an explicit statement, so that a word list alone may flag it (a recitation, a sermon of a named denomination, an altar call, "all religions are the same"); 0.75 for topic words that Catholic apologetics, news and history also use (they wait for the on-device model, or for the user to move the slider down: the pack's policy that wrongly hiding a sermon costs more than missing a cue); 0.50 for broader words; 0.15 for a bare word that is also everyday speech. With flag at 0.80 the model is asked only about the 0.75 tier.
  - A question ("Are all religions the same?"), a denial ("Not all religions are the same") and a Catholic reply ("Has science disproved God?") are spared in the 0.95 tier on purpose, by word order or by a lookbehind. A title that quotes a flat statement to answer it is still flagged; that cost is accepted.
  - No word list names a person, and none uses a derogatory name for a religion or a group. The lists on Judaism and Freemasonry have, besides, no word for a people, a state, politics, an ethnicity or a conspiracy; the bare word "Jewish" is not a cue (it also names a people), and neither are "mason" and "masonry" (stone masonry). The one entry that comes near it is "prophet muhammad" in islam_cues, at 0.75, which the rule author asked for as a religious title; the bare name is left out, and so is every other name of a person.
  - Each question is one yes/no question with the exclusion that spares a small model a known false alarm (news, history, a Catholic discussion, fantasy, a game).
  - The example and "spared" titles of every rule are run through the real rules and word lists by the tests: an example is flagged by the words alone or, when its cue is at 0.75, is flagged when the model says yes; a spared title is not flagged by the words and not when the model says no.
- Sources: only protestantism rests on a sermon (the Curé's aside in Sur la colère, the one sentence that names the Protestants). Atheism keeps its sermon (Sur la religion). The other nine rules say "Choice of the rule author" in their `source:` line and, in their section below, that they are not traced to a sermon. Each section names the Church text that the rule follows, or that it describes, quoted from the page that was read (see "Texts, checks and limits"); where no text names the subject, the section says so.
  - The general ground, for all of them, as the Catechism puts it:
    - Quote, CCC 2088: « The first commandment requires us to nourish and protect our faith with prudence and vigilance, and to reject everything that is opposed to it. »
      - Read: https://www.scborromeo.org/ccc/para/2088.htm
- Both added rules, judaism and freemasonry, are the rule author's choice for traditional Catholics. They look at religious content (Torah and Talmud study, a rabbi's lecture, a synagogue service; a lodge, its rites and degrees) and not at people, and a Catholic talk about the Old Testament, about the Jewish roots of the Mass or about Freemasonry is outside their questions. What they will not hold is said under "Not included and why".

## Rules chosen by the rule author (2026-11-26, part two)

- What was asked, in his words (two messages): "Freemasonry should not block Catholic videos warning AGAINST freemasonry, but rather the contents / effects. Also should block anything to do with Communism and other heresies condemned by the Church" and "'Faith and superstition' - make this 'Anti-Catholicism' and put all the ideologies and banned books in there by category". On the books, when it was asked what a rule on them should flag: "yeah basically videos discussing these kinds of banned book authors".
- What was done:
  - The group `faith` ("Faith and superstition") is now the group `anticatholic` ("Anti-Catholicism"). The order of the groups on the page did not change: purity, speech, people, belief, anticatholic, leisure, pictures, sound. Freemasonry left `belief` for it: an ideology and a society, not a religion.
  - Freemasonry was reworked (its section says how), and nine rules were added. The group holds 14 rules, in the order the settings page shows: mockery_of_faith, anti_catholic, divination, occult, freemasonry, communism, modernism, spiritism, index_freethinkers, index_jesus_critics, index_modernists, index_philosophers, index_historians, index_novelists. The order is a choice of mine, since the rule author gave none: the four older rules keep their places, then Freemasonry and the other ideologies, then the categories of books that are on, then the ones that are off.
  - Eight word lists of names and titles were read from the Index of Forbidden Books (`docs/en/holy-office/forbidden.md`), and the evidence is in `research/index-of-forbidden-books.md`: the twelve classes of canon 1399, the counts, the names with the lines they come from, what was left out and why.
- The interpretation of the rule author, which the four rules on an ideology (Freemasonry, Communism, Modernism, Spiritism) follow: a rule flags content that PRESENTS, TEACHES, PROMOTES or DEFENDS the ideology (its propaganda, its rites and doctrine, praise of it, its effects when they are shown as good) and spares content that WARNS AGAINST it from the Catholic side (a Catholic talk, an encyclical, a history of its persecutions of the Church, the Fatima "errors of Russia", a sermon, a refutation). This is the line that canon 1399 draws, in the words of the Index:
  - Quote (forbidden.md): “Books that hold duelling, suicide or divorce to be lawful, or that present the Masonic and similar sects as useful and harmless to the Church and to civil society.”
  - Quote (forbidden.md): “Books that attack or ridicule a Catholic dogma, defend errors condemned by the Holy See, disparage divine worship, try to overthrow the discipline of the Church, or of set purpose insult the hierarchy, the clerical or the religious state.”
  - The canon forbids books that present the sects as harmless and books that defend condemned errors; it does not forbid books against them. The decree of the Holy Office on Communism (1949; see the section "communism" below) puts it the same way: what is forbidden is what champions the doctrine or the action of the Communists.
  - The questions of the four rules say it: each holds "and not warn against it from a Catholic viewpoint" (Modernism: "and not explain or warn against them from a Catholic viewpoint") and names the Catholic cases (the Church's condemnation, a history, a documentary, the victims, a ghost story as fiction, the genuine development of doctrine).
  - In the word lists, a flat cue at 0.95 (a slogan, an invitation, a rite, a statement of the doctrine) is a pattern with a guard that stands after the cue: a title that holds, besides the cue, a Catholic marker ("Catholic", "Church", "pope", "priest"...) or a word of warning or condemnation ("condemned", "forbidden", "warning", "beware", "danger", "heresy", "errors", "victims"...) falls to the weight of the bare words, 0.75, so that the on-device model decides; for Communism, Modernism and Spiritism a 0.75 sibling of the same cues without the guard sees to it that the demoted title still reaches the model. Without a model such a title is not flagged: wrongly hiding a talk costs more than missing a cue, the policy of the pack.
- The book categories work differently, by the rule author's own words ("videos discussing these kinds of banned book authors"). A book rule flags a video ABOUT those authors or their works: an analysis, a summary, a reading or an audiobook, an adaptation, a biography, a recommendation, a debate. It does not matter what the video says: a Catholic critique of Voltaire is a video about Voltaire and is flagged. The rule spares only namesakes and unrelated uses: a street, a school, a hotel, a station, a cathedral, a pet, a band, another person of the same name. The question of each book rule has the form "Is this video about <the authors or works of the category>, and not about a place, a school, a street or something else of the same name?"
- Settings (choices of the rule author; none of them was measured):
  - Communism, Modernism and Spiritism look at lists and search results, recommended videos, comments and the video page (feed-card, related, comment, watch-meta): a comment is blurred, with a Show button, so a false alarm costs one click. Freemasonry keeps its three surfaces (no comments): only its question and its lists were to be corrected. The book rules look at lists, recommended videos and the video page.
  - flag at 0.80, gate lexicon, band as usual. Actions: feed-card=blank and watch-meta=warn-overlay for the rules that are on, as for the rules of the first round; feed-card=dim and watch-meta=label for the three book rules that ship off, the softer actions of the other disabled rules. A comment takes the default, blur.
  - On by default: Freemasonry, Communism, Modernism, Spiritism, and the book categories that attack the faith directly: anti-religious writers, critical lives of Jesus, Modernists. Off by default: the broad literary and philosophical categories (philosophers, historians, novelists), which would flag many videos that are not an attack on the faith. The rule author can switch them on; each is a switch of its own on the settings page.
  - The tiers of the lists are those of the first round: 0.95 only for what is by itself content of that kind (a full name or a title of the Index; a slogan or a flat statement of the doctrine), 0.75 for a bare name or a word that both sides use (the on-device model decides), 0.50 for the name of the thing, 0.15 for an ambiguous bare word. With flag at 0.80 only the 0.95 tier flags from the word lists alone.
- The names in the book lists. The categories are the rule author's choice; the names are the Index's: every name and every title in the eight lists is under an author heading of the file, as the Index prints it, and `tests/index-names.test.js` checks that on every run (it says exactly what "is in the file" means). Titles are not translated: an English title that the Index does not print ("The Last Temptation of Christ", "The Social Contract") is not a cue, though the author's name catches most such titles. How the names were chosen is the rule author's choice as I understood it, and is said in the research file: only authors whom a viewer may type, not Catholic priests or laymen of good standing (Pascal, Descartes, Malebranche, Montaigne, Rosmini, Lord Acton and others), and none whose Index lines are "donec corrigatur".
- Names that a street, a school or an animal also bears: a full name at 0.95 is a pattern that falls to the plain 0.75 entry when a word of a street, school, hotel, station, restaurant, house or the like stands next to it ("Hotel Victor Hugo", "Rue Voltaire", "Victor Hugo metro station"); the guard is looked at only after the name has matched. A bare surname that is also such a word or name is at 0.75 or lower (the model decides); a name that is also a country, a cathedral, a place or an everyday word is not a cue at all (Hugo, Dumas, Sand, Sue, France, Casanova, Pamela, Gentile, Croce, Comte, Hobbes, Locke, Berkeley, Fourier, the cathedral Notre-Dame de Paris).
- What was looked at and not made (Jansenism, Gallicanism, the Bible editions, anti-papal pamphlets, Action Française, liberalism and laicism, Nazism and others) is in "Not included and why" and in the research file, with the counts of the Index and the reasons.

## Rules chosen by the rule author (2026-11-26, part three): the model decides what the words cannot

- What was said, in his words (five messages): "yeah just make sure that Catholic content warning about freemasonry is not flagged, thats the difficulty where we need AI for", "I think the Kev model can handle it once downloaded", "with some positive / negative examples maybe", "maybe some examples from the index and then some counter examples I can give you from some YT channels I know that are talking about these ideologies".
- The problem: a Catholic warning about Freemasonry and an invitation to join it use the same words. The word lists cannot tell them apart; the guards in the lists (a marker word such as "Catholic" or "condemned" falls a cue to 0.75) catch the warnings that carry a marker, and no more.
- What was done:
  - A rule key `confirm: model` (core/rules.js, core/engine.js). For such a rule a strong word-list hit (at or above `flag at`) is shown to the model as well, when one is there: an answer below VETO_BELOW (0.35, core/sensitivity.js, a choice, the same bound as UNSURE_LOW in core/layered.js) overrules the hit, any other answer lets it stand, no answer (or no model) leaves the decision to the word list alone, as before. The four rules on an ideology have it: freemasonry, communism, modernism, spiritism. The book rules do not: they flag a video about an author whatever it says.
  - The cards that the words flag are hidden at once and put back if the model overrules them: the page never paints what the words flag while the model thinks, and a warning is shown again a moment later.
  - The examples are in the question (core/shots.js): the rule's own `example:` lines (what counts) and `spared:` lines (what does not), the nearest ones to the text, `settings.ai.shots` per side (default 3, a choice; 0 = none), so that a warning meets the other warnings. This is the owner's "positive / negative examples". Nothing learns: the same rule, text and settings give the same question. Whether examples help Kev-0.6B, and how many, is measured by `tools/eval-kev.mjs` (research/kev-accuracy-smoke.md); the default follows the measurement.
- The books are the BOOKS (2026-11-26, later): on seeing "David Hume's Influence on John Henry Newman" from a Catholic channel flagged by the rule on philosophers of the Index, the owner said: "discussing a banned author -> yeah, well in this case its about the life of the person David Hume (historical), not 'operes omnia' (his works), that's the difficulty". The six rules on authors of the Index (anti-religious writers, critical lives of Jesus, Modernists, philosophers, historians, novelists) were reworded: they flag a video about the books and ideas of the author (a reading, a summary, an analysis, an explanation, an adaptation, a debate), and spare a video about the life of the person or the history of his influence. Two mechanisms: `spare words: life_words` (a list of words of a life, a choice of the rule author: biography, born, died, exile, "influence on", ...; "life" alone is not one of them, Renan's and Strauss's books are called "Life of Jesus") lowers a strong hit of the author's full name into the band where the model decides; and `confirm: model` lets a model that is there overrule a strong hit that carries no such word (a title such as "Ernesto Buonaiuti: an excommunicated priest"). Their questions say it ("and not about the life of the person"). The real title is a `spared:` line of the philosophers' rule, with constructed titles about lives on the other rules. Without a model only the words of a life tell the two apart.
- Still to come, from the owner: positive examples from the Index and real counter examples (titles of channels that warn against these ideologies). They go into the rules as `example:` and `spared:` lines; every line is also a test case of the check on the rule examples in the On-device AI pane.
- The owner's channels (2026-11-26, research/owner-channels.md): he named four Catholic YouTube channels (Apostolic Majesty, Ascent of Mount Carmel, Apostolado Glórias de Maria, Annulment Proof) as counter examples and said that a Catholic-related channel name on a video about the topic of an "against" rule is "a strong indicator that this is a warning-type video, not a video spreading bad content". 1,066 titles were fetched. The rules on an error got `spare channel: catholic_channels`: when the CHANNEL name of a card hits that word list, a strong hit is lowered to just under the flag level, so the model decides and, with none, nothing is flagged (a choice: SPARE_DROP 0.05 in core/sensitivity.js; the list is a choice too). The six book rules do not have it ("videos discussing these authors" stay flagged from any channel). 24 of the titles are `spared:` lines now, each with its channel (" @ channel" at the end of a line). With the shipped rules on by default none of the 1,066 titles is flagged by the word lists, and 29 are asked of a model.
- What this cannot do: without a model nothing overrules a strong hit, so a warning with no marker word and a strong cue is flagged. The model is what is meant to catch it; whether Kev-0.6B does is not known until it is downloaded and measured.

## Rules

- Each rule below gives its settings, its question, the verbatim passages, what the English rule takes from them, and why it is on or off.

### lords_name: Taking the Lord's name in vain (enabled) {#lords_name}

- Rule (as shipped): where feed-card, watch-meta, subtitles; flag at 0.80; gate lexicon; lexicon lords_name_strong, lords_name_bare; action feed-card=hide, watch-meta=warn-overlay, subtitles=mute-word.
- Question: Is the name of God, Jesus or Christ used here as an exclamation or a curse, and not in prayer, worship, quotation or talk about religion?
- Passages:
  - Quote 1, Sur le deuxième Commandement de Dieu (volume 2): « Il est bien étonnant, M.F., que le bon Dieu soit obligé de nous faire un commandement pour nous défendre de profaner son saint nom. »
    - English (working, literal): It is astonishing, my brethren, that the good God should be obliged to give us a commandment to forbid us to profane his holy name.
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/commande12.html; apotre.org page 23 https://www.apotre.org/livres/vianney-sermons/23
  - Quote 2, Sur la colère (volume 3): « Les jurements les plus ordinaires sont ceux-ci : Ma foi ! Ma conscience ! – Mon Dieu ! oui ; – Mon Dieu ! non ; parbleu ! – morbleu ! – mâtin ! »
    - English (working, literal): The most ordinary oaths are these: My faith! My conscience! My God, yes; my God, no; parbleu! morbleu! mâtin!
    - Read: apotre.org page 42 https://www.apotre.org/livres/vianney-sermons/42 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
  - Quote 3, Sur l'Absolution (volume 3): « Mon Dieu, oui ; mon Dieu, non ; ma foi ; pardi, parbleu, mâtin, le J... F..., B..., F..., S... N... F..., et autres choses semblables »
    - English (working, literal): My God, yes; my God, no; my faith; pardi, parbleu, mâtin, the J... F..., B..., F..., S... N... F..., and other such things. (In the sentence it opens, the Curé calls them "ces petits jurements", these small oaths.)
    - Read: apotre.org page 34 https://www.apotre.org/livres/vianney-sermons/34 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
  - Quote 4, Sur la colère (volume 3): « Dans les jurements, plus la matière est légère, plus le péché est grand ; puisque c'est un plus grand mépris, et une plus grande profanation du saint nom de Dieu. »
    - English (working, literal): In oaths, the lighter the matter, the greater the sin; for it is a greater contempt and a greater profanation of the holy name of God.
    - Read: apotre.org page 42 https://www.apotre.org/livres/vianney-sermons/42 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
  - Quote 5, Sur le deuxième Commandement de Dieu (volume 2): « La raison en est que, plus la matière est légère, plus le mépris est grand »
    - English (working, literal): The reason is that the lighter the matter, the greater the contempt. (On swearing by God over a trifle.)
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/commande12.html; apotre.org page 24 https://www.apotre.org/livres/vianney-sermons/24
  - Quote 6, Sur le deuxième Commandement de Dieu (volume 2): « Il y encore ces jurements déguisés en disant : S….di, c’est comme si vous disiez S…..Dieu. »
    - English (working, literal): There are also these disguised oaths, in saying: S….di, it is as if you said S…..Dieu. (Footnote of the Curé, signed "Note du Saint".)
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/commande12.html (a footnote of the Curé, signed "Note du Saint"; it is in the livres-mystiques copy only, not in the apotre.org copy)
- Why the English rule matches:
  - His list of "the most ordinary oaths" opens with "Ma foi" and "Ma conscience" and goes on to "Mon Dieu ! oui ; Mon Dieu ! non": the Name used as a filler in everyday speech. The English counterparts are "oh my God", "my God", "Jesus!" and "Jesus Christ!" used as exclamations.
  - In the Absolution sermon he names such forms "ces petits jurements" and puts those who say them by habit among the sinners whose absolution is to be deferred; he does not treat them as harmless.
  - His footnote says a disguised form counts as the full word ("S….di" for "S…..Dieu"). The question does not exclude minced oaths; whether "gosh", "jeez" and the like belong in lords_name_bare is for the lexicon author.
  - "In oaths, the lighter the matter, the greater the sin" (Sur la colère; the second Commandment sermon says the same of contempt) is why a throwaway use is in scope and not excused. The sermons page calls this a judgment for the rule author; the pack takes the strict reading and leaves the choice in "flag at" (0.60), which the author or the user can raise.
  - The exclusions in the question (prayer, worship, quotation, talk about religion) come from the plan (section 7: a homily or a hymn title is not a violation), not from the Curé.
- Default: Enabled. It is the first of the six categories the plan starts from (plan, section 5), and each lexicon hit is checked by a context question before anything is hidden or muted.
- Lexicon: lords_name_strong and lords_name_bare.

### oaths: Oaths, calling God to witness (enabled) {#oaths}

- Rule (as shipped): where feed-card, watch-meta, subtitles; flag at 0.80; gate lexicon; lexicon oath_cues; action feed-card=dim, watch-meta=warn-overlay, subtitles=mute-word.
- Question: Does the speaker swear by God or by something sacred to vouch for a claim or promise (for example 'I swear to God', 'so help me God'), and not as a formal oath in court, a wedding vow or a prayer?
- Passages:
  - Quote 1, Sur le deuxième Commandement de Dieu (volume 2): « Voici, M.F., ce que c'est que jurer : c'est prendre le bon Dieu à témoin de ce que l'on dit ou promet »
    - English (working, literal): Here, my brethren, is what swearing is: it is to take the good God as witness of what one says or promises
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/commande12.html; apotre.org page 23 https://www.apotre.org/livres/vianney-sermons/23
  - Quote 2, Sur le deuxième Commandement de Dieu (volume 2): « Notre-Seigneur Jésus-Christ nous dit, dans l'Évangile, de ne point jurer ni par le ciel, ni par la terre, parce que ni l'un ni l'autre ne nous appartiennent. »
    - English (working, literal): Our Lord Jesus Christ tells us in the Gospel not to swear, neither by heaven nor by earth, because neither the one nor the other belongs to us.
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/commande12.html; apotre.org page 24 https://www.apotre.org/livres/vianney-sermons/24
  - Quote 3, Sur le deuxième Commandement de Dieu (volume 2): « Il y en a souvent qui ne savent pas vendre la moindre chose sans jurer, comme si leur jurement bonifiait leur marchandise. »
    - English (working, literal): There are often those who cannot sell the smallest thing without swearing, as if their oath improved their goods.
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/commande12.html; apotre.org page 24 https://www.apotre.org/livres/vianney-sermons/24
  - Quote 4, Sur le deuxième Commandement de Dieu (volume 2): « Le deuxième commandement, qui nous défend de faire des serments faux, inutiles et de se parjurer »
    - English (working, literal): The second commandment, which forbids us to take false or useless oaths and to perjure ourselves
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/commande12.html; apotre.org page 23 https://www.apotre.org/livres/vianney-sermons/23
  - Quote 5, Sur la Sanctification du Chrétien (volume 1): « les péchés, les désordres les plus communs sont les veilles, les jurements, les paroles et les chansons déshonnêtes »
    - English (working, literal): the most common sins, the most common disorders, are the night gatherings ("veillées"), oaths, dishonest words and songs
    - Read: livres-mystiques https://livres-mystiques.com/partieTEXTES/Ars/Sermons/tome1/sanctif8.html; apotre.org page 7 https://www.apotre.org/livres/vianney-sermons/7
  - Quote 6, Sermons inédits : SERMON SUR L'EXAMEN DE CONSCIENCE (volume 4): « comme sont les blasphèmes, les jurements et les colères »
    - English (working, literal): as are the blasphemies, the oaths and the fits of anger (the faults he says people remember in their examination of conscience because they are the most ordinary)
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome4/17conscience.htm; apotre.org page 52 https://www.apotre.org/livres/vianney-sermons/52
- Why the English rule matches:
  - He defines swearing as taking God as witness of what one says or promises. The question is that definition in English: God, or something sacred, called on to vouch for a claim or a promise.
  - He quotes Christ forbidding oaths by heaven or by earth. That is why oath_cues also has "I swear on my life" and "on my mother's grave" at the middle tier. "Cross my heart" and "hope to die" are the project's extension of the same idea; the author should check them.
  - In his examination of conscience (an unpublished sermon) the faults people remember because they are the most ordinary are blasphemies, oaths and fits of anger.
  - In the Sanctification sermon oaths are one of the most common disorders (with evening gatherings and dishonest words and songs), which is why the rule is one of the starter set and not a footnote.
  - Traders who cannot sell without swearing are in scope: "I swear this is the best" is an oath over a trifle.
  - The Commandment forbids false and useless oaths and perjury. The exclusions in the question (a formal oath in court, a wedding vow, a prayer) are the project's reading of that sentence; the quoted passages do not discuss lawful oaths.
- Default: Enabled, as one of the six categories. "I swear to God" is common in ordinary speech, so this is the first of the tongue rules to raise or switch off if it flags too much.
- Lexicon: oath_cues (31 entries): fixed oath phrases at 0.75, swear-on-X phrases at 0.50, bare "swear" at 0.15.

### blasphemy: Blasphemy (enabled) {#blasphemy}

- Rule (as shipped): where feed-card, watch-meta, subtitles; flag at 0.80; gate lexicon; lexicon blasphemy_terms; action feed-card=hide, watch-meta=warn-overlay, subtitles=mute-word.
- Question: Is God, Jesus, the Virgin Mary or a saint insulted or mocked here (for example called cruel, unjust or powerless), and not just quoted, discussed or prayed to?
- Passages:
  - Quote 1, Sur le deuxième Commandement de Dieu (volume 2): « Saint Thomas nous dit encore que le blasphème est une parole injurieuse, outrageuse contre le bon Dieu ou contre les saints »
    - English (working, literal): St. Thomas tells us further that blasphemy is an injurious, outrageous word against the good God or against the saints
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/commande12.html; apotre.org page 24 https://www.apotre.org/livres/vianney-sermons/24
  - Quote 2, Sur le deuxième Commandement de Dieu (volume 2): « C'est aussi un blasphème que de se moquer de la sainte Vierge et des saints, en disant : « En voilà un qui n'a pas grand pouvoir : j'ai fait tant de prières, je n'ai jamais rien obtenu. » »
    - English (working, literal): It is also blasphemy to mock the Blessed Virgin and the saints, saying: "Here is one who has no great power: I have said so many prayers, I have never obtained anything."
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/commande12.html; apotre.org page 24 https://www.apotre.org/livres/vianney-sermons/24
  - Quote 3, Sur le deuxième Commandement de Dieu (volume 2): « Nous pouvons dire que le blasphème est vraiment le langage de l'enfer. »
    - English (working, literal): We may say that blasphemy is truly the language of hell.
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/commande12.html; apotre.org page 24 https://www.apotre.org/livres/vianney-sermons/24
  - Quote 4, Sur le deuxième Commandement de Dieu (volume 2): « Le blasphème est un mot qui veut dire maudire et détester une beauté infinie, ce qui indique que ce péché s'attaque directement au bon Dieu. »
    - English (working, literal): Blasphemy is a word that means to curse and detest an infinite beauty, which shows that this sin attacks the good God directly.
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/commande12.html; apotre.org page 24 https://www.apotre.org/livres/vianney-sermons/24
  - Quote 5, Sur le deuxième Commandement de Dieu (volume 2): « « Le bon Dieu est un cruel et un injuste de permettre que je souffre tant de maux, que l'on me calomnie de la sorte »
    - English (working, literal): "The good God is a cruel and unjust being to allow me to suffer so many ills, to let people slander me like this" (St. Thomas's first way of blaspheming, "par affirmation".)
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/commande12.html; apotre.org page 24 https://www.apotre.org/livres/vianney-sermons/24
  - Quote 6, Sur le deuxième Commandement de Dieu (volume 2): « On blasphème en disant que le bon Dieu n'est pas tout-puissant, et que l'on peut faire quelque chose sans lui. »
    - English (working, literal): One blasphemes in saying that the good God is not almighty, and that one can do something without him. (St. Thomas's second way.)
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/commande12.html; apotre.org page 24 https://www.apotre.org/livres/vianney-sermons/24
  - Quote 7, Sermons inédits : SERMON SUR L'EXAMEN DE CONSCIENCE (volume 4): « comme sont les blasphèmes, les jurements et les colères »
    - English (working, literal): as are the blasphemies, the oaths and the fits of anger (the faults he says people remember in their examination of conscience because they are the most ordinary)
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome4/17conscience.htm; apotre.org page 52 https://www.apotre.org/livres/vianney-sermons/52
- Why the English rule matches:
  - St. Thomas's definition, an injurious and outrageous word against God or the saints, is the core of the question: insult or mockery.
  - His examples become the parenthesis of the question: calling God cruel or unjust (the first of the four ways he gives) and saying he is not almighty (the second). Mocking the Virgin and the saints is named separately in his text and in the question.
  - He keeps blasphemy apart from the oath: a man who says that the good God is not just has uttered a blasphemy and not an oath (his own example). So lords_name and blasphemy are two rules with two questions.
  - Blasphemies, oaths and fits of anger are the three faults he says people remember in their examination because they are the most ordinary.
  - "Jesus" is added beside God in the question as the same Person; that is the project's wording.
  - He also calls the sentence "there is no God" a blasphemy (Sur la religion); that case is in the separate rule denial_of_god (shown as "Atheism"), and whether blasphemy_terms should hold it is left open.
- Default: Enabled. Clearly in his text, and the question is narrow (insult or mockery of God, the Virgin or a saint, not mere mention).
- Lexicon: blasphemy_terms.

### renunciation: Renouncing God in anger (enabled) {#renunciation}

- Rule (as shipped): where feed-card, watch-meta, subtitles; flag at 0.85; gate lexicon; lexicon renunciation_cues; action feed-card=dim, watch-meta=warn-overlay, subtitles=mute-word.
- Question: Does the speaker rage against God or disown Him in anger over a loss or misfortune (for example 'God has abandoned me', 'to hell with God'), and not calmly explain why he does not believe?
- Passages:
  - Quote 1, Sur le deuxième Commandement de Dieu (volume 2): « ont cette maudite habitude, par colère et par emportement, de renier le saint nom de Dieu : comme une personne qui perdra dans un marché qu'elle fera, ou au jeu, elle s'emporte contre Dieu »
    - English (working, literal): have this cursed habit, in anger and in a fit of temper, of renouncing the holy name of God: like a person who loses in a bargain she makes, or at play, and rages against God
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/commande12.html; apotre.org page 24 https://www.apotre.org/livres/vianney-sermons/24
  - Quote 2, Sur la colère (volume 3): « Il s'agit ici de ceux qui, à la suite de quelque perte ou de quelque disgrâce, ont la maudite habitude de s'emporter en paroles de colère contre Dieu. »
    - English (working, literal): This concerns those who, after some loss or some misfortune, have the cursed habit of bursting out in angry words against God.
    - Read: apotre.org page 42 https://www.apotre.org/livres/vianney-sermons/42 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
  - Quote 3, Sur le deuxième Commandement de Dieu (volume 2): « En parlant de reniement, je ne veux pas parler de ceux qui renient le bon Dieu en quittant la véritable religion : nous appelons ces personnes-là des renégats, ou des apostats. »
    - English (working, literal): In speaking of renunciation, I do not mean those who renounce the good God by leaving the true religion: we call such people renegades, or apostates.
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/commande12.html; apotre.org page 24 https://www.apotre.org/livres/vianney-sermons/24
  - Quote 4, Sur le deuxième Commandement de Dieu (volume 2): « Il y a, M.F., une grande différence entre les blasphèmes et les reniements de Dieu. »
    - English (working, literal): There is, my brethren, a great difference between blasphemies and the renunciations of God.
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/commande12.html; apotre.org page 24 https://www.apotre.org/livres/vianney-sermons/24
- Why the English rule matches:
  - A "reniement" is the outburst of someone who has just lost something (his examples: a bargain, play) and rages against God as though God were the cause. The question asks for exactly that: rage or disowning, in anger, over a loss or misfortune.
  - He sets apart those who leave the true religion ("renégats", "apostats"). That is why the question excludes a calm account of why someone does not believe.
  - He says there is "une grande différence" between blasphemies and renunciations, so the pack keeps two rules.
- Default: Enabled, as one of the six categories. It overlaps blasphemy; if the two flag the same items in practice the author can merge them.
- Lexicon: renunciation_cues (36 entries): the "God hates me / God has abandoned me" family at 0.75; "where was God / why would God let" at 0.50 (often sincere questions, so the model must decide); bare "blame God" at 0.15.

### curses_imprecations: Curses and imprecations (enabled) {#curses_imprecations}

- Rule (as shipped): where feed-card, watch-meta, subtitles; flag at 0.80; gate lexicon; lexicon curses_imprecations; action feed-card=hide, watch-meta=warn-overlay, subtitles=mute-word.
- Question: Does the speaker, in anger or despair, call down harm, damnation or death on a person, an animal, a thing or himself (for example 'damn you', 'I hope you die', 'may I be struck dead if I lie'), and not in a joke, a story or a quoted lyric?
- Passages:
  - Quote 1, Sur le deuxième Commandement de Dieu (volume 2): « ce que l'on entend par malédiction et par imprécation ; c'est, M.F., dans un moment de colère ou de désespoir, maudire une personne, une chose ou une bête ; c'est vouloir l'anéantir ou la rendre malheureuse. »
    - English (working, literal): what is meant by curse and imprecation; it is, my brethren, in a moment of anger or despair, to curse a person, a thing or an animal; it is to wish to annihilate it or make it unhappy.
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/commande12.html; apotre.org page 24 https://www.apotre.org/livres/vianney-sermons/24
  - Quote 2, Sur le deuxième Commandement de Dieu (volume 2): « elle dira pour se justifier : « Si j'ai fait cela, je ne veux jamais voir la face de Dieu ! » Ce n'est pas un jurement, mais une horrible imprécation. »
    - English (working, literal): she will say to justify herself: "If I did that, I never want to see the face of God!" That is not an oath, but a horrible imprecation.
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/commande12.html; apotre.org page 23 https://www.apotre.org/livres/vianney-sermons/23
  - Quote 3, Sur le deuxième Commandement de Dieu (volume 2): « Il y en a qui, quand le temps est mauvais, disent : « Maudit temps ! maudite pluie ! ah ! maudit froid ! ah ! maudits enfants ! ... » »
    - English (working, literal): There are those who, when the weather is bad, say: "Cursed weather! cursed rain! ah, cursed cold! ah, cursed children! ..."
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/commande12.html; apotre.org page 24 https://www.apotre.org/livres/vianney-sermons/24
  - Quote 4, Sur le deuxième Commandement de Dieu (volume 2): « N'oubliez jamais que le Saint-Esprit nous dit qu'une malédiction prononcée en vain et légèrement, tombera sur quelqu'un. »
    - English (working, literal): Never forget that the Holy Spirit tells us that a curse pronounced in vain and lightly will fall on someone.
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/commande12.html; apotre.org page 24 https://www.apotre.org/livres/vianney-sermons/24
- Why the English rule matches:
  - He defines malédiction and imprécation together: in a moment of anger or despair, to curse a person, a thing or an animal and wish it ruin. One question covers both. It adds "or himself" for his second example, the imprecation that goes with an oath ("if I did that, I never want to see the face of God").
  - His examples reach beyond people: the weather, tools, children. That is why the question says "a person, an animal, a thing".
  - He says a curse pronounced lightly "tombera sur quelqu'un": there is no exception for casual use. The exclusions in the question (joke, story, quoted lyric) are the project's, to spare the model a known false alarm.
- Default: Enabled. Clearly in his text.
- Lexicon: curses_imprecations. His own examples: "que le bon Dieu me damne", "que le démon m'emporte", "que tu crèves", "maudit temps".

### coarse_words: Coarse words (enabled) {#coarse_words}

- Rule (as shipped): where feed-card, watch-meta, subtitles; flag at 0.70; gate lexicon; lexicon coarse_words; action feed-card=hide, watch-meta=warn-overlay, subtitles=mute-word.
- Question: Is a vulgar or obscene word used here crudely, and not as a medical or educational term, a place name or a quotation under discussion?
- Passages:
  - Quote 1, Sur la Pénitence (volume 1): « Nous devons surtout mortifier notre langue lorsque le démon nous inspire de dire de mauvaises raisons, de mauvaises chansons, des médisances et des calomnies contre le prochain ; de même, ne pas dire des jurements, des paroles grossières. »
    - English (working, literal): We must above all mortify our tongue when the devil inspires us to say bad talk, bad songs, detractions and slanders against our neighbour; likewise, not to say oaths or coarse words. ("Mauvaises raisons" is old usage for improper talk: in the second Commandment sermon it stands for "paroles sales et déshonnêtes".)
    - Read: livres-mystiques https://livres-mystiques.com/partieTEXTES/Ars/Sermons/tome1/penite15.html; apotre.org page 12 https://www.apotre.org/livres/vianney-sermons/12
  - Quote 2, Sur les ennemis de notre salut (volume 1): « J'appelle mauvaise compagnie, M. F., ce jeune ou ce vieux mal-embouché qui n'a que de sales paroles à la bouche. »
    - English (working, literal): I call bad company, my brethren, that young or old foul-mouthed man who has nothing but dirty words in his mouth.
    - Read: livres-mystiques https://livres-mystiques.com/partieTEXTES/Ars/Sermons/tome1/ennemi13.html; apotre.org page 10 https://www.apotre.org/livres/vianney-sermons/10
  - Quote 3, Sur le deuxième Commandement de Dieu (volume 2): « Un autre dira des paroles sales et déshonnêtes, et s'accusera d'avoir dit de mauvaises raisons. » Vous vous trompez, il faut dire que vous avez dit des obscénités. »
    - English (working, literal): Another will say dirty and dishonest words, and will accuse himself of having said "bad talk". You are mistaken: you must say that you said obscenities.
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/commande12.html; apotre.org page 23 https://www.apotre.org/livres/vianney-sermons/23
  - Quote 4, Sur le deuxième Commandement de Dieu (volume 2): « et en prononçant le b... et le f..., ceci a rapport aux malédictions »
    - English (working, literal): and in pronouncing the b... and the f..., this relates to curses
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/commande12.html; apotre.org page 24 https://www.apotre.org/livres/vianney-sermons/24
- Why the English rule matches:
  - "Paroles grossières" are the sixth category of the second Commandment sermon and are listed with oaths in the Pénitence passage on the tongue. "Sales paroles" and "obscénités" are his other words for the same thing.
  - He prints two such words with the letters blanked ("le b... et le f...") and says they belong with the curses. A coarse word used in anger is a curse.
  - The question ("used crudely, not as a medical or educational term, a place name or a quotation") follows the plan (section 7: lexicon first, ambiguous cases to a context question).
- Default: Enabled. Named in his list of six categories ("paroles grossières") and in his list for the tongue. The lexicon does most of the work; the question only removes medical, educational and quoted uses.
- Lexicon: coarse_words.

### insults: Insults (disabled) {#insults}

- Rule (as shipped): where feed-card, watch-meta, subtitles; flag at 0.75; gate lexicon; lexicon insult_cues; action feed-card=dim, watch-meta=label, subtitles=mute-word.
- Question: Is a person being called insulting names here (for example 'thief', 'scoundrel', 'idiot') as an attack, and not as friendly teasing or a quotation?
- Passages:
  - Quote 1, Sur le deuxième Commandement de Dieu (volume 2): « Un autre, qui aura dit à son voisin qu'il est un voleur, un coquin, s'accusera « d'avoir juré après son voisin. Ce n'est pas jurer, mais c'est lui dire des injures. »
    - English (working, literal): Another, who has told his neighbour that he is a thief, a rascal, will accuse himself "of having sworn at his neighbour." That is not swearing, but it is insulting him.
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/commande12.html; apotre.org page 23 https://www.apotre.org/livres/vianney-sermons/23
- Why the English rule matches:
  - His example is a man who calls his neighbour a thief and a rascal: "ce n'est pas jurer, mais c'est lui dire des injures". The question asks for name-calling used as an attack.
  - Strong insults are left to coarse_words (the coarse_words list); insult_cues holds the plain ones.
- Default: Disabled. He names insults ("injures") as a sin of speech separate from oaths, but friendly teasing, roasts and heated debate would make it over-flag, and most of the lexicon is weak words.
- Lexicon: insult_cues (34 entries): second-person forms at 0.75 and 0.50, bare words ("idiot", "loser") at 0.15.

### mockery_of_faith: Mocking religion and holy things (disabled) {#mockery_of_faith}

- Rule (as shipped): where feed-card, watch-meta, subtitles; flag at 0.75; gate lexicon; lexicon mockery_of_faith_cues; action feed-card=dim, watch-meta=label, subtitles=skip-segment.
- Question: Does this make fun of religion, prayer, believers, sacred things or clergy, rather than discuss them seriously?
- Passages:
  - Quote 1, Sur les ennemis de notre salut (volume 1): « Il commencera à tourner en ridicule votre piété, à faire quelque plaisanterie sur la religion et sur ses ministres »
    - English (working, literal): He will begin to ridicule your piety, to make some joke about religion and its ministers
    - Read: livres-mystiques https://livres-mystiques.com/partieTEXTES/Ars/Sermons/tome1/ennemi13.html; apotre.org page 10 https://www.apotre.org/livres/vianney-sermons/10
  - Quote 2, Sur l'Absolution (volume 3): « tels sont ces mauvais chrétiens qui tournent en dérision la parole de Dieu et ceux qui l'annoncent, qu'ils soient leurs pasteurs ou d'autres prêtres ; qui se moquent de la religion, de la piété et des choses saintes »
    - English (working, literal): such are those bad Christians who hold in derision the word of God and those who proclaim it, whether their pastors or other priests; who mock religion, piety and holy things
    - Read: apotre.org page 34 https://www.apotre.org/livres/vianney-sermons/34 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
  - Quote 3, Sur la Médisance (volume 2): « Parler mal des personnes consacrées et des ministres de l'Église, c'est encore un plus grand péché »
    - English (working, literal): To speak ill of consecrated persons and of the ministers of the Church is a still greater sin
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/medisance21.html; apotre.org page 30 https://www.apotre.org/livres/vianney-sermons/30
  - Quote 4, Sur la Sanctification du Chrétien (volume 1): « ainsi que tous ces contes qui ne sont que des mensonges, et qui, le plus ordinairement, sont contre des personnes consacrées à Dieu »
    - English (working, literal): as well as all those tales that are nothing but lies, and which, most commonly, are against persons consecrated to God
    - Read: livres-mystiques https://livres-mystiques.com/partieTEXTES/Ars/Sermons/tome1/sanctif8.html; apotre.org page 7 https://www.apotre.org/livres/vianney-sermons/7
- Why the English rule matches:
  - Ridiculing piety and religion is the first of the four kinds of "mauvaise compagnie" he names (Sur les ennemis de notre salut) and one of the marks of the scandalous in the Absolution sermon. Speaking ill of consecrated persons and clergy he calls a greater detraction.
  - In the Sanctification sermon the tales against consecrated persons (priests, religious) are a vice of the evening gatherings: the modern form is the priest or nun joke.
  - The question says "religion", not "the Catholic religion" (project's wording; the Curé speaks of his own Church). An author who wants only Catholic subjects must change the question.
  - The question asks for fun made of religion, prayer, believers, sacred things or clergy; a serious critique or a report on a named person's crimes is not covered.
- Default: Disabled. The rule author turned on the belief rules and two new rules of this group on 2026-11-26 (see "Rules chosen by the rule author") and left this one off. Enable for a stricter profile.
- Lexicon: mockery_of_faith_cues (21 entries): mostly derogatory phrases at 0.50; generic nouns (priest, pope, nun) are left out on purpose so that every religious video does not reach the model.

### anti_catholic: Anti-Catholicism (enabled) {#anti_catholic}

- Rule (as shipped): where feed-card, related, watch-meta; flag at 0.80; gate lexicon; lexicon anti_catholic_cues; action feed-card=blank, watch-meta=warn-overlay.
- Question: Does this attack the Catholic Church, the pope or Catholic teaching as false, evil or a fraud, and not report a real scandal, discuss the Church's history fairly or defend the Church?
- Source: choice of the rule author (2026-11-26); not traced to a sermon. The rules file says "Choice of the rule author". The nearest text of the Curé is quote 3 of mockery_of_faith (Sur la Médisance, on speaking ill of consecrated persons and the ministers of the Church); it is about detraction of persons, and the pack does not use it as the source of this rule.
- Church text it follows:
  - CCC 2088: « The first commandment requires us to nourish and protect our faith with prudence and vigilance, and to reject everything that is opposed to it. »
    - Read: https://www.scborromeo.org/ccc/para/2088.htm
  - No Church text read names attacks on the Church as a kind of video. The Catechism line is the general ground for a viewer who chooses to keep what is opposed to the faith out of his feed.
- Why the English rule matches:
  - The 0.95 tier holds only explicit charges: "the Catholic Church is evil" (also "a cult", "false", "satanic", "a fraud"), "the pope is the antichrist", "Rome is the whore of Babylon", "papal lies", "lies of the Catholic Church". The same words as a question ("Is the Catholic Church evil?") are not matched.
  - What attackers say but news, Catholic replies and church history also say is at 0.75, so it waits for the on-device model: "exposing the Catholic Church", "why I left the Catholic Church", "ex-catholic", "anti-catholic", "Vatican cover-up", "Catholics worship Mary", "the Catholic Church is corrupt", "whore of babylon" on its own. The question excludes a real scandal reported as news, fair history and a defence of the Church.
  - Bare words ("pope", "priest", "Vatican", "Rome") are not cues, no cue is a name of a person, and none is a derogatory name for Catholics.
  - Whether a Catholic's own criticism of a pope or a bishop falls under the question is left to the model and to the rule author; no cue was written for it.
- Default: Enabled, by the decision of the rule author (2026-11-26).
- Lexicon: anti_catholic_cues (26 entries): 5 at 0.95, 15 at 0.75, 5 at 0.50, 1 at 0.15.

### gossip: Detraction and gossip (enabled) {#gossip}

- Rule (as shipped): where feed-card, watch-meta, subtitles; flag at heavy; gate lexicon; lexicon gossip_cues; action feed-card=hide, watch-meta=warn-overlay, subtitles=skip-segment.
- Question: How much of this talks about the private faults or misdeeds of a named real person, living or dead? Levels: none, mild, heavy.
- Passages:
  - Quote 1, Sur la Médisance (volume 2): « c'est faire connaître un défaut ou une faute du prochain d'une manière capable de nuire, plus ou moins, à sa réputation, et cela se fait en plusieurs manières. »
    - English (working, literal): it is to make known a defect or a fault of one's neighbour in a manner capable of harming his reputation, more or less, and this is done in several ways.
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/medisance21.html; apotre.org page 30 https://www.apotre.org/livres/vianney-sermons/30
  - Quote 2, Sur la Médisance (volume 2): « l'on médit quand on fait connaître, sans raison légitime, un défaut caché du prochain, ou une faute qui n'est pas connue. »
    - English (working, literal): one speaks ill when one makes known, without legitimate reason, a hidden defect of one's neighbour, or a fault that is not known.
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/medisance21.html; apotre.org page 30 https://www.apotre.org/livres/vianney-sermons/30
  - Quote 3, Sur la Médisance (volume 2): « Si la chose est publique, vous devez au contraire avoir de la compassion de ce pauvre malheureux, cacher, et diminuer sa faute autant que vous pouvez. »
    - English (working, literal): If the thing is public, you must on the contrary have compassion for this poor unfortunate, hide his fault and lessen it as much as you can.
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/medisance21.html; apotre.org page 30 https://www.apotre.org/livres/vianney-sermons/30
  - Quote 4, Sur la Médisance (volume 2): « Il faut cependant comprendre que tout n'est pas médisance, lorsqu'on fait connaître les défauts d'un enfant à ses parents, d'un domestique à son maître, pourvu que ce soit dans la pensée qu'ils s'en corrigeront »
    - English (working, literal): One must however understand that not everything is detraction when one makes known the faults of a child to his parents, of a servant to his master, provided that it is in the thought that they will correct themselves
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/medisance21.html; apotre.org page 30 https://www.apotre.org/livres/vianney-sermons/30
  - Quote 5, Sur la Médisance (volume 2): « non seulement, il est mal fait de médire et de calomnier, mais encore d'écouter la médisance et la calomnie avec plaisir ; car si personne n'écoutait, il n'y aurait pas de médisants. »
    - English (working, literal): it is not only wrong to detract and to slander, but also to listen to detraction and slander with pleasure; for if no one listened, there would be no detractors.
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/medisance21.html; apotre.org page 30 https://www.apotre.org/livres/vianney-sermons/30
  - Quote 6, Sur la Médisance (volume 2): « La langue médisante va même fouiller jusque dans le tombeau des morts »
    - English (working, literal): The detracting tongue goes even to rummage in the tomb of the dead
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/medisance21.html; apotre.org page 30 https://www.apotre.org/livres/vianney-sermons/30
  - Quote 7, Sur l'Absolution (volume 3): « comme ceux qui ont l'habitude de médire du prochain, qui ont toujours quelque chose à dire sur son compte »
    - English (working, literal): like those who are in the habit of speaking ill of their neighbour, who always have something to say about him
    - Read: apotre.org page 34 https://www.apotre.org/livres/vianney-sermons/34 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
- Why the English rule matches:
  - His definition (making known a fault of the neighbour in a way capable of harming his reputation) is the question, with "named real person" so that talk about types of people is not counted.
  - "Un défaut caché ... sans raison légitime" is why the question is about private faults. The word "private" is kept from the plan's draft as a choice: he would not accept "it is already public" as an excuse (he says to hide and lessen a public fault), so an author who wants the strict reading can drop the word.
  - "Living or dead": he says the detracting tongue even rummages in the tomb of the dead.
  - He allows telling a child's faults to his parents, or a servant's to his master, when the aim is correction. A title or a caption window cannot show that, so the question does not try; it is a known source of false alarms.
  - The listener is an accomplice ("si personne n'écoutait, il n'y aurait pas de médisants"). That is the basis for acting on the card (hide) and on the audio (skip-segment) and not only for a warning (plan, section 7).
  - "Qui ont toujours quelque chose à dire sur son compte" (Absolution) describes habit; it fits channels built on talk about other people, which the plan's per-channel tally can count.
- Default: Enabled. Detraction is the best-developed subject in his text (a whole sermon). The rule only flags the heaviest level ("flag at: heavy") to keep false alarms down. The plan expects mediocre accuracy from a small model here (section 7): calibrate before trusting it.
- Lexicon: gossip_cues (41 entries): "gossip" and "spill the tea" at 0.75; "exposed", "scandal", "leaked" at 0.50; everyday words (drama, secret, tea) at 0.15.

### calumny: Calumny (enabled) {#calumny}

- Rule (as shipped): where feed-card, watch-meta, subtitles; flag at 0.85; gate lexicon; lexicon calumny_cues; action feed-card=hide, watch-meta=warn-overlay, subtitles=skip-segment.
- Question: Does this accuse a named real person of a crime or a serious fault as if it were certain, without giving any source or proof?
- Passages:
  - Quote 1, Sur la Médisance (volume 2): « On médit lorsqu'on impute au prochain un mal qu'il n'a pas fait ou un défaut qu'il n'a pas, c'est ce qui s'appelle calomnie »
    - English (working, literal): One speaks ill when one imputes to one's neighbour an evil he has not done or a defect he does not have; this is called calumny
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/medisance21.html; apotre.org page 30 https://www.apotre.org/livres/vianney-sermons/30
  - Quote 2, Sur le jugement téméraire (volume 2): « sur quoi sont fondés tous ces jugements et ces sentences ? Hélas ! c'est sur de faibles apparences, et, le plus souvent, sur un on dit. »
    - English (working, literal): on what are all these judgments and sentences founded? Alas, on weak appearances and, most often, on hearsay ("un on dit").
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/temeraire20.html; apotre.org page 29 https://www.apotre.org/livres/vianney-sermons/29
- Why the English rule matches:
  - Calumny is the first kind of detraction in his list: imputing to the neighbour an evil he has not done. The question can only see the pattern: a crime or serious fault stated as certain, with no source or proof.
  - He says such verdicts rest on "un on dit", on hearsay. "Without giving any source or proof" in the question is that point.
- Default: Enabled (detraction and calumny on the project's starter list). It is the weakest of the enabled questions: a small model cannot know whether an accusation is false.
- Lexicon: calumny_cues (26 entries): words such as "accused of" and "smear" are also used in honest reporting, hence 0.50.

### rash_judgment: Rash judgment (disabled) {#rash_judgment}

- Rule (as shipped): where feed-card, watch-meta, subtitles; flag at 0.80; gate lexicon; lexicon rash_judgment_cues; action feed-card=dim, watch-meta=label, subtitles=skip-segment.
- Question: Does this suggest that a named real person is guilty, lying or acting from bad motives on thin evidence (guesswork, rumour, 'body language')?
- Passages:
  - Quote 1, Sur le jugement téméraire (volume 2): « le jugement téméraire est une pensée ou une parole désavantageuse sur le compte du prochain et sur de légères apparences »
    - English (working, literal): rash judgment is a disadvantageous thought or word about one's neighbour, on slight appearances
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/temeraire20.html; apotre.org page 29 https://www.apotre.org/livres/vianney-sermons/29
  - Quote 2, Sur le jugement téméraire (volume 2): « A-t-on volé quelqu'un ? A-t-on perdu quelque chose ? De suite, nous pensons que c'est peut-être bien un tel qui a fait cela, et nous le pensons sans même en avoir la moindre connaissance. »
    - English (working, literal): Has someone been robbed? Has something been lost? At once we think it may well be so-and-so who did it, and we think so without having the slightest knowledge.
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/temeraire20.html; apotre.org page 29 https://www.apotre.org/livres/vianney-sermons/29
  - Quote 3, Sur le jugement téméraire (volume 2): « Il ne portait son jugement que par conjecture : voilà, M.F., le premier caractère du jugement téméraire. »
    - English (working, literal): He passed judgment only by conjecture: that, my brethren, is the first mark of rash judgment.
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/temeraire20.html; apotre.org page 29 https://www.apotre.org/livres/vianney-sermons/29
- Why the English rule matches:
  - His definition is a disadvantageous thought or word about the neighbour on slight appearances. The question keeps the words ("guilty, lying or bad motives") and the thin evidence.
  - His example of the whodunit ("it is probably so-and-so", with no knowledge) is the media form of "is he lying?" and "body language" titles.
- Default: Disabled. Speculation about guilt and motives is the whole of true-crime and commentary content, so the rule would over-flag. His definition also includes a private thought, which no filter can see.
- Lexicon: rash_judgment_cues (25 entries).

### tale_bearing: Tale-bearing (disabled) {#tale_bearing}

- Rule (as shipped): where feed-card, watch-meta, subtitles; flag at 0.80; gate lexicon; lexicon tale_bearing_cues; action feed-card=dim, watch-meta=label, subtitles=skip-segment.
- Question: Does this pass on what one person said or did against another (for example 'what X said about you', leaked messages, talk behind someone's back)?
- Passages:
  - Quote 1, Sur la Médisance (volume 2): « la médisance la plus noire et la plus funeste dans ses suites, c'est de rapporter à quelqu'un ce qu'un autre a dit de lui ou fait contre lui »
    - English (working, literal): the blackest detraction, and the most baneful in its consequences, is to report to someone what another has said of him or done against him
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/medisance21.html; apotre.org page 30 https://www.apotre.org/livres/vianney-sermons/30
  - Quote 2, Sur la Médisance (volume 2): « Il y a six choses que Dieu hait, mais il déteste la septième, cette septième ce sont les rapports »
    - English (working, literal): There are six things that God hates, but he detests the seventh; this seventh is tale-bearing ("les rapports")
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/medisance21.html; apotre.org page 30 https://www.apotre.org/livres/vianney-sermons/30
- Why the English rule matches:
  - Tale-bearing ("les rapports") is the blackest kind of detraction in his list: repeating to a person what another said or did against him. He cites Proverbs on the seven things God hates.
- Default: Disabled. The nearest media forms (reactions, responses, leaked messages) are hard to tell from a title; low precision is expected.
- Lexicon: tale_bearing_cues (29 entries).

### curiosity: Curiosity about other people's affairs (disabled) {#curiosity}

- Rule (as shipped): where feed-card, watch-meta; flag at 0.80; gate lexicon; lexicon curiosity_cues; action feed-card=dim, watch-meta=label.
- Question: Is this title or description written to make us curious about someone's private affairs (what he said or did, what goes on inside his home or life)?
- Passages:
  - Quote 1, Sur la Pénitence (volume 1): « ne pas être du nombre de ces personnes curieuses qui veulent savoir tout ce que l'on a dit, ce que l'on a fait, d'où l'on vient, ce que l'on veut, ce que l'on nous a dit »
    - English (working, literal): not to be among those curious people who want to know all that has been said, what has been done, where one comes from, what one wants, what was said to us
    - Read: livres-mystiques https://livres-mystiques.com/partieTEXTES/Ars/Sermons/tome1/penite15.html; apotre.org page 12 https://www.apotre.org/livres/vianney-sermons/12
  - Quote 2, Sur les ennemis de notre salut (volume 1): « J'appelle mauvaise compagnie, M. F., cette personne curieuse, inquiète et médisante, qui veut savoir tout ce qui se passe dans les maisons, qui est toujours prête à juger ce qui ne la regarde pas. »
    - English (working, literal): I call bad company, my brethren, this curious, restless and slanderous person, who wants to know all that goes on in the houses, who is always ready to judge what is none of her business.
    - Read: livres-mystiques https://livres-mystiques.com/partieTEXTES/Ars/Sermons/tome1/ennemi13.html; apotre.org page 10 https://www.apotre.org/livres/vianney-sermons/10
  - Quote 3, Sur le jugement téméraire (volume 2): « il faut éviter cette curiosité, ce désir de trop savoir, et ne point nous informer de ce que fait l'un et dit l'autre, ni de ce qui se passe dans l'intérieur des maisons »
    - English (working, literal): one must avoid this curiosity, this desire to know too much, and not inquire about what one does and another says, nor about what goes on inside houses
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/temeraire20.html; apotre.org page 30 https://www.apotre.org/livres/vianney-sermons/30
  - Quote 4, Sur la Pénitence (volume 1): « ne rien regarder par curiosité »
    - English (working, literal): look at nothing out of curiosity
    - Read: livres-mystiques https://livres-mystiques.com/partieTEXTES/Ars/Sermons/tome1/penite15.html; apotre.org page 12 https://www.apotre.org/livres/vianney-sermons/12
- Why the English rule matches:
  - The eyes passage starts with curiosity ("ne rien regarder par curiosité"), and the next sentence names the curious who want to know everything said and done. The sermons page makes curiosity the first thing a feed is judged on.
  - He names the same type in two more sermons: the curious, restless slanderer is one of his four kinds of bad company, and (quoting St. Bernard) the remedy is not to inquire about what goes on inside houses.
  - The question is limited to people's private affairs (what he said or did, what goes on inside his home or life), which is the object in all four passages. Curiosity about news, science or places is not in scope.
- Default: Disabled. It is the broadest rule in the pack: the whole click-driven feed is written to make us curious about other people. The attention-calming module (plan, section 4.5) already deals with clickbait titles; turn this on for a strict profile only.
- Lexicon: curiosity_cues (30 entries).

### impure_words: Impure words and songs (enabled) {#impure_words}

- Rule (as shipped): where feed-card, watch-meta, subtitles; flag at 0.75; gate lexicon; lexicon impurity_cues; action feed-card=hide, watch-meta=warn-overlay, subtitles=mute-word.
- Question: Is this lewd talk or lewd song lyrics (sexual innuendo, sex jokes, explicit lyrics), and not sex education, medical information or news?
- Passages:
  - Quote 1, Sur la pureté (volume 3): « Il faut mortifier nos oreilles, ne jamais prendre plaisir à entendre des paroles ou chansons sales. »
    - English (working, literal): We must mortify our ears, never taking pleasure in hearing filthy words or songs.
    - Read: apotre.org page 38 https://www.apotre.org/livres/vianney-sermons/38 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
  - Quote 2, Sur l'Impureté (volume 3): « Vous devez vous accuser de toutes les paroles impures que vous avez dites »
    - English (working, literal): You must accuse yourself of all the impure words you have said
    - Read: apotre.org page 40 https://www.apotre.org/livres/vianney-sermons/40 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
  - Quote 3, Sur l'Impureté (volume 3): « L'on se rend encore coupable, en lisant et prêtant de mauvais livres ou des chansons licencieuses »
    - English (working, literal): One also makes oneself guilty by reading and lending bad books or licentious songs
    - Read: apotre.org page 40 https://www.apotre.org/livres/vianney-sermons/40 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
  - Quote 4, Sur les devoirs des parents (volume 4): « Combien de fois que vos enfants vous entendent dire des paroles sales ou indécentes, qui portent le poison dans leur pauvre âme ! »
    - English (working, literal): How many times your children hear you say dirty or indecent words, which carry poison into their poor souls!
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome4/21parents.htm; apotre.org page 55 https://www.apotre.org/livres/vianney-sermons/55
  - Quote 5, Sur l'Impureté (volume 3): « ce sont les danses, les bals, les fréquentations trop familières avec des personnes de différent sexe ; les chansons, les paroles libres, les immodesties dans les habits, les excès dans le boire et le manger »
    - English (working, literal): it is dances, balls, too-familiar dealings with persons of a different sex; songs, free words, immodesty in dress, excess in drinking and eating. (The answer he says a child of the catechism gives to "what ordinarily leads us to this shameful vice?")
    - Read: apotre.org page 40 https://www.apotre.org/livres/vianney-sermons/40 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
  - Quote 6, Sur la Sanctification du Chrétien (volume 1): « les péchés, les désordres les plus communs sont les veilles, les jurements, les paroles et les chansons déshonnêtes »
    - English (working, literal): the most common sins, the most common disorders, are the night gatherings ("veillées"), oaths, dishonest words and songs
    - Read: livres-mystiques https://livres-mystiques.com/partieTEXTES/Ars/Sermons/tome1/sanctif8.html; apotre.org page 7 https://www.apotre.org/livres/vianney-sermons/7
- Why the English rule matches:
  - Of his six ways to sin against purity, "par paroles" is the fourth, and the Pureté sermon ends with the ears: never take pleasure in hearing filthy words or songs. The question covers words and songs in one idea, as he pairs them.
  - He names licentious songs (Impureté) and "paroles libres" in his catechism answer on what leads to this vice, and in the Sanctification sermon "les paroles et les chansons déshonnêtes" are among the most common disorders.
  - He says children who hear dirty or indecent words from their parents take poison into their souls. Hearing is enough; that is the project's reading and the reason captions are checked and not only titles.
- Default: Enabled (impure words on the project's starter list). The question removes sex education, medical information and news.
- Lexicon: impurity_cues (40 entries): cue words only. No explicit vocabulary is written here; that belongs to coarse_words.

### impure_sights: Impure sights (enabled) {#impure_sights}

- Rule (as shipped): where feed-card, watch-meta; flag at 0.75; gate lexicon; lexicon sexual_imagery_cues; action feed-card=hide, watch-meta=warn-overlay.
- Question: Does this title or description offer nude or sexually suggestive images or scenes (for example nudity, lingerie, a 'thirst trap', an erotic dance), and not art history, medicine or news?
- Passages:
  - Quote 1, Sur l'Impureté (volume 3): « L'on pèche par regards, lorsqu'on porte ses yeux sur des objets impurs, ou quelque chose qui peut nous y conduire. »
    - English (working, literal): One sins by looks when one turns one's eyes to impure objects, or to something that can lead us to them.
    - Read: apotre.org page 40 https://www.apotre.org/livres/vianney-sermons/40 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
  - Quote 2, Sur la Pénitence (volume 1): « Nous devons mortifier nos yeux : ne rien regarder par curiosité, ni différents objets qui pourraient nous porter à avoir quelques mauvaises pensées »
    - English (working, literal): We must mortify our eyes: look at nothing out of curiosity, nor at various objects that could lead us to some evil thoughts
    - Read: livres-mystiques https://livres-mystiques.com/partieTEXTES/Ars/Sermons/tome1/penite15.html; apotre.org page 12 https://www.apotre.org/livres/vianney-sermons/12
  - Quote 3, Sur la pureté (volume 3): « Si nous en apercevons quelqu'une mal arrangée, il faut bien vite nous en détourner, et non pas faire comme ceux qui ont des yeux impudiques, qui s'y arrêtent autant que le démon le veut. »
    - English (working, literal): If we catch sight of someone improperly dressed, we must turn away from it quickly, and not do as those who have shameless eyes, which linger as long as the devil wishes.
    - Read: apotre.org page 38 https://www.apotre.org/livres/vianney-sermons/38 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
- Why the English rule matches:
  - "L'on pèche par regards, lorsqu'on porte ses yeux sur des objets impurs" is the object of the question; the Pénitence passage adds objects that could lead to evil thoughts.
  - "Il faut bien vite nous en détourner": the speed is why the action is hide, which removes the card before the eye lingers (sermons page, section 5).
  - The exclusions (art history, medicine, news) are the project's.
- Default: Enabled. This is the "eyes" half of the project (sermons page, section 5), and its action is the quick turn-away (hide). It sees text only (titles and descriptions), so images that the title does not describe are missed, and fashion or fitness titles will cause some false alarms. It is the first of the enabled rules to raise if it flags too much.
- Lexicon: sexual_imagery_cues (34 entries).

### immodest_dress: Immodest dress (disabled) {#immodest_dress}

- Rule (as shipped): where feed-card, watch-meta; flag at 0.80; gate lexicon; lexicon immodest_dress_cues; action feed-card=dim, watch-meta=label.
- Question: Is revealing or very tight clothing the attraction of this item (for example a swimwear or lingerie try-on, 'see-through', 'barely there')?
- Passages:
  - Quote 1, Sur l'Impureté (volume 3): « Je dis que les immodesties dans les habits nous conduisent à ce vice honteux. »
    - English (working, literal): I say that immodesty in dress leads us to this shameful vice.
    - Read: apotre.org page 40 https://www.apotre.org/livres/vianney-sermons/40 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
  - Quote 2, Sur la pureté (volume 3): « prendre garde de n'être pas un sujet de péché aux autres, soit par nos paroles, soit par notre manière de nous habiller »
    - English (working, literal): take care not to be an occasion of sin to others, whether by our words or by our manner of dressing
    - Read: apotre.org page 38 https://www.apotre.org/livres/vianney-sermons/38 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
  - Quote 3, Sur l'Impureté (volume 3): « une personne qui ne s'habille pas décemment est la cause de beaucoup de péchés : de mauvais regards, de mauvaises pensées, de paroles déshonnêtes »
    - English (working, literal): a person who does not dress decently is the cause of many sins: evil looks, evil thoughts, dishonest words
    - Read: apotre.org page 40 https://www.apotre.org/livres/vianney-sermons/40 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
  - Quote 4, Sur l'Impureté (volume 3): « L'on pèche par occasion, soit en la donnant, soit en la prenant. »
    - English (working, literal): One sins by occasion, either in giving it or in taking it.
    - Read: apotre.org page 40 https://www.apotre.org/livres/vianney-sermons/40 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
  - Quote 5, Sur l'Impureté (volume 3): « ce sont les danses, les bals, les fréquentations trop familières avec des personnes de différent sexe ; les chansons, les paroles libres, les immodesties dans les habits, les excès dans le boire et le manger »
    - English (working, literal): it is dances, balls, too-familiar dealings with persons of a different sex; songs, free words, immodesty in dress, excess in drinking and eating. (The answer he says a child of the catechism gives to "what ordinarily leads us to this shameful vice?")
    - Read: apotre.org page 40 https://www.apotre.org/livres/vianney-sermons/40 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
- Why the English rule matches:
  - He names immodesty in dress in many places: in the catechism answer and in a paragraph of its own in the Impureté sermon, in the closing paragraph of Sur la pureté ("notre manière de nous habiller"), where he says it concerns mostly women ("surtout les personnes du sexe"), and in the lists of the Absolution sermon. The rule is worded without a sex, like his general statement.
  - He frames it as an occasion given to others ("l'on pèche par occasion, soit en la donnant, soit en la prenant"), so what is flagged is the content that offers it, not the viewer.
- Default: Disabled. Judging dress from a title is unreliable (swimwear, sport, fashion), and what he names is visible in the image, which this text-only pipeline does not see.
- Lexicon: immodest_dress_cues (26 entries).

### familiar_company: Too-familiar company between the sexes (disabled) {#familiar_company}

- Rule (as shipped): where feed-card, watch-meta; flag at 0.80; gate lexicon; lexicon courtship_cues; action feed-card=dim, watch-meta=label.
- Question: Does this present flirting, dating or casual hookups as entertainment or advice (a dating show, pick-up tips, 'situationship' drama)?
- Passages:
  - Quote 1, Sur la Contrition (volume 1): « la fréquentation des personnes de sexe différent »
    - English (working, literal): frequenting persons of the other sex
    - Read: livres-mystiques https://livres-mystiques.com/partieTEXTES/Ars/Sermons/tome1/passion21.html; apotre.org page 16 https://www.apotre.org/livres/vianney-sermons/16
  - Quote 2, Sur l'Impureté (volume 3): « Une fille est encore coupable de quantité de péchés impurs, qui sont presque tous des péchés mortels, toutes les fois qu'elle est trop facile et trop familière avec les jeunes gens. »
    - English (working, literal): A girl is also guilty of a quantity of impure sins, almost all of them mortal sins, every time she is too easy and too familiar with young men.
    - Read: apotre.org page 40 https://www.apotre.org/livres/vianney-sermons/40 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
  - Quote 3, Sur l'Impureté (volume 3): « ce sont les danses, les bals, les fréquentations trop familières avec des personnes de différent sexe ; les chansons, les paroles libres, les immodesties dans les habits, les excès dans le boire et le manger »
    - English (working, literal): it is dances, balls, too-familiar dealings with persons of a different sex; songs, free words, immodesty in dress, excess in drinking and eating. (The answer he says a child of the catechism gives to "what ordinarily leads us to this shameful vice?")
    - Read: apotre.org page 40 https://www.apotre.org/livres/vianney-sermons/40 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
- Why the English rule matches:
  - He lists "la fréquentation des personnes de sexe différent" among the occasions that lead to sin "par elles-mêmes", and "les fréquentations trop familières" in his catechism answer.
  - The question is limited to flirting, dating and hookups presented as entertainment or advice, the media forms of his "too familiar" dealings. It does not cover marriage, family or ordinary friendship.
- Default: Disabled. It would flag romance and dating content widely, and what he worries about (unmarried people too familiar with each other) is rarely visible in a title.
- Lexicon: courtship_cues (29 entries).

### bad_books: Bad books (disabled) {#bad_books}

- Rule (as shipped): where feed-card, watch-meta; flag at 0.80; gate lexicon; lexicon bad_books_cues; action feed-card=dim, watch-meta=label.
- Question: Is this a reading, review or promotion of a book whose selling point is lewdness or contempt for religion (erotica, 'spicy' romance, anti-religious polemic)?
- Passages:
  - Quote 1, Sur la Pénitence (volume 1): « ne point lire de livres qui ne sont pas capables de nous porter à la vertu, qui, au contraire, ne peuvent que nous en détourner et éteindre le peu de foi que nous avons »
    - English (working, literal): read no books that are not able to lead us to virtue, that on the contrary can only turn us away from it and extinguish the little faith we have
    - Read: livres-mystiques https://livres-mystiques.com/partieTEXTES/Ars/Sermons/tome1/penite15.html; apotre.org page 12 https://www.apotre.org/livres/vianney-sermons/12
  - Quote 2, Sur le service de Dieu (volume 3): « vous lirez quelques mauvais livres, qui ne respireront que le mépris de la religion et le libertinage »
    - English (working, literal): you will read some bad books, which will breathe nothing but contempt for religion and libertinism
    - Read: apotre.org page 34 https://www.apotre.org/livres/vianney-sermons/34 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
  - Quote 3, Sur les ennemis de notre salut (volume 1): « Il ne faut souvent que la lecture d'un mauvais livre pour perdre une personne. »
    - English (working, literal): Often the reading of one bad book is enough to ruin a person.
    - Read: livres-mystiques https://livres-mystiques.com/partieTEXTES/Ars/Sermons/tome1/ennemi13.html; apotre.org page 10 https://www.apotre.org/livres/vianney-sermons/10
- Why the English rule matches:
  - The eyes passage forbids books that cannot lead to virtue and "can only turn us away from it and extinguish the little faith we have". The pack narrows this to the two kinds he describes elsewhere: books of libertinism and books of contempt for religion.
  - The Absolution and Impureté sermons list bad books among the occasions of sin, and Sur les ennemis de notre salut says one bad book can be enough to ruin a person.
- Default: Disabled. A book can only be judged here from a title or a description, and the pack can only recognise two kinds: lewd books and books of contempt for religion.
- Lexicon: bad_books_cues (20 entries).

### dances: Balls and dances (disabled) {#dances}

- Rule (as shipped): where feed-card, watch-meta; flag at 0.80; gate lexicon; lexicon dance_cues; action feed-card=dim, watch-meta=label.
- Question: Is this a dance party, ball or club night, or a viral dance video made for fun?
- Passages:
  - Quote 1, Sur l'Impureté (volume 3): « Je dis que les bals et les danses nous conduisent à ce vice infâme. »
    - English (working, literal): I say that balls and dances lead us to this infamous vice.
    - Read: apotre.org page 40 https://www.apotre.org/livres/vianney-sermons/40 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
  - Quote 2, Sur l'Impureté (volume 3): « ce sont les danses, les bals, les fréquentations trop familières avec des personnes de différent sexe ; les chansons, les paroles libres, les immodesties dans les habits, les excès dans le boire et le manger »
    - English (working, literal): it is dances, balls, too-familiar dealings with persons of a different sex; songs, free words, immodesty in dress, excess in drinking and eating. (The answer he says a child of the catechism gives to "what ordinarily leads us to this shameful vice?")
    - Read: apotre.org page 40 https://www.apotre.org/livres/vianney-sermons/40 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
  - Quote 3, Sermons inédits : SERMON SUR L'EXAMEN DE CONSCIENCE (volume 4): « Êtes-vous fidèles à fuir les occasions de péché, telles que la danse, le cabaret et les jeux ? »
    - English (working, literal): Are you faithful in fleeing the occasions of sin, such as the dance, the tavern and games? (One of his questions for the examination of conscience.)
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome4/17conscience.htm; apotre.org page 53 https://www.apotre.org/livres/vianney-sermons/53
- Why the English rule matches:
  - "Les bals et les danses nous conduisent à ce vice infâme" is a short, explicit statement, and balls and dances appear in all his lists of occasions (Absolution, Contrition, Impureté, and Sur le Mariage).
  - In his examination of conscience one question names the dance, the tavern and games together as the occasions to flee.
  - The question is for dancing as amusement (a ball, a club or party, a viral dance video). It does not try to separate sacred or folk dance from the rest; that is the author's call.
- Default: Disabled (dances are on the project's starter list of broad rules): ballroom, folk and school dancing and dance trends all produce the same lexicon hits.
- Lexicon: dance_cues (28 entries).

### spectacles: Stage shows and comedies (disabled) {#spectacles}

- Rule (as shipped): where feed-card, watch-meta; flag at 0.80; gate lexicon; lexicon spectacle_cues; action feed-card=dim, watch-meta=label.
- Question: Is this a staged show for amusement (a theatre play, comedy show, musical or circus act)?
- Passages:
  - Quote 1, Sur l'Absolution (volume 3): « comme les spectacles, les bals, les danses, les mauvais livres, les conversations déshonnêtes, les chansons profanes, les tableaux indécents, les manières déshonnêtes de s'habiller, les mauvaises compagnies »
    - English (working, literal): such as shows, balls, dances, bad books, dishonest conversations, profane songs, indecent pictures, dishonest ways of dressing, bad company
    - Read: apotre.org page 34 https://www.apotre.org/livres/vianney-sermons/34 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
  - Quote 2, Sur la Contrition (volume 1): « les unes nous y portent par elles-mêmes, comme sont les mauvais livres, les comédies, les bals, les danses, les peintures, les tableaux et chansons déshonnêtes et la fréquentation des personnes de sexe différent »
    - English (working, literal): some lead us to it by themselves, such as bad books, comedies, balls, dances, paintings, dishonest pictures and songs, and frequenting persons of the other sex
    - Read: livres-mystiques https://livres-mystiques.com/partieTEXTES/Ars/Sermons/tome1/passion21.html; apotre.org page 16 https://www.apotre.org/livres/vianney-sermons/16
- Why the English rule matches:
  - "Les spectacles" and "les comédies" appear in his lists of occasions; he never defines them. In his time they were stage shows.
  - The English rule is therefore limited to stage shows (theatre, comedy show, musical, circus act). Film, television and streaming drama are not included: extending his "spectacles" to them would be the project's choice and would flag most of YouTube. The author can widen the question.
  - His own split of occasions (Sur la Contrition) puts books, comedies, balls, dances, pictures, songs and the company of the other sex among those that lead to sin "par elles-mêmes"; see the notes on defaults.
- Default: Disabled (spectacles on the project's starter list).
- Lexicon: spectacle_cues (26 entries).

### cruel_spectacles: Cruel spectacles (disabled) {#cruel_spectacles}

- Rule (as shipped): where feed-card, watch-meta; flag at 0.75; gate lexicon; lexicon violence_spectacle_cues; action feed-card=hide, watch-meta=warn-overlay.
- Question: Does this show or advertise people being killed, maimed or beaten for entertainment (death matches, gore, real-fight compilations)?
- Passages:
  - Quote 1, Sur le Monde (volume 3): « C'était un jour que l'on y faisait égorger des hommes par d'autres hommes. »
    - English (working, literal): It was a day when men were being slaughtered there by other men.
    - Read: apotre.org page 35 https://www.apotre.org/livres/vianney-sermons/35 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
  - Quote 2, Sur le Monde (volume 3): « pendant que tout l'amphithéâtre était dans les transports de ces barbares plaisirs »
    - English (working, literal): while the whole amphitheatre was in transports of these barbarous pleasures
    - Read: apotre.org page 35 https://www.apotre.org/livres/vianney-sermons/35 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
  - Quote 3, Sur le Monde (volume 3): « qui, assurément, ne prendront jamais part à un spectacle si horrible »
    - English (working, literal): which will surely never take part in so horrible a spectacle (Alypius, as the Curé retells St. Augustine's story)
    - Read: apotre.org page 35 https://www.apotre.org/livres/vianney-sermons/35 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
- Why the English rule matches:
  - The one spectacle he describes is the amphitheatre in the story of Alypius: men made to kill each other, "ces barbares plaisirs", "un spectacle si horrible", and the lesson that closing the eyes was not enough. The question is the modern form: people killed, maimed or beaten for entertainment.
  - The sermons page draws the consequence for the extension (once a video plays, its audio is the harder door); that is the project's reading, not his words.
- Default: Disabled (spectacles on the project's starter list), but it is the spectacle rule most worth enabling: its cues (gore, death matches, fight to the death) are specific.
- Lexicon: violence_spectacle_cues (39 entries): the 0.95 tier holds the words that name the arena itself ("gladiator", "death match", "fight to the death").

### gambling: Games played for money (disabled) {#gambling}

- Rule (as shipped): where feed-card, watch-meta; flag at 0.75; gate lexicon; lexicon gambling_cues; action feed-card=blank, watch-meta=warn-overlay.
- Question: Is this about gambling or betting for money (casino, poker, slots, sports betting, lottery), including tips or promotion?
- Passages:
  - Quote 1, Sur les ennemis de notre salut (volume 1): « ce joueur ou cet ivrogne de profession : quelque sobre et bien rangé que vous soyez, il vous aura bientôt perdu en vous faisant manger votre argent dans les jeux et les cabarets »
    - English (working, literal): this gambler or professional drunkard: however sober and orderly you may be, he will soon have ruined you by making you eat up your money in games and taverns
    - Read: livres-mystiques https://livres-mystiques.com/partieTEXTES/Ars/Sermons/tome1/ennemi13.html; apotre.org page 10 https://www.apotre.org/livres/vianney-sermons/10
  - Quote 2, Sur la restitution (volume 3): « il vole les pauvres toutes les fois qu'il dépense son argent au jeu, au cabaret ou à d'autres inutilités »
    - English (working, literal): he robs the poor every time he spends his money on gaming, at the tavern, or on other useless things
    - Read: apotre.org page 43 https://www.apotre.org/livres/vianney-sermons/43 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
  - Quote 3, Sur l'Absolution (volume 3): « ceux qui tiennent dans leurs maisons les veillées, les danses profanes, des jeux défendus »
    - English (working, literal): those who hold in their houses evening gatherings, profane dances, forbidden games
    - Read: apotre.org page 34 https://www.apotre.org/livres/vianney-sermons/34 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
  - Quote 4, Sermons inédits : SERMON SUR L'EXAMEN DE CONSCIENCE (volume 4): « Êtes-vous fidèles à fuir les occasions de péché, telles que la danse, le cabaret et les jeux ? »
    - English (working, literal): Are you faithful in fleeing the occasions of sin, such as the dance, the tavern and games? (One of his questions for the examination of conscience.)
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome4/17conscience.htm; apotre.org page 53 https://www.apotre.org/livres/vianney-sermons/53
- Why the English rule matches:
  - He never defines "jeux". Where he shows what he means, money is lost: the gambler who makes you "manger votre argent dans les jeux et les cabarets", and the servant who spends his wages "au jeu, au cabaret". The English rule is therefore limited to games played for money. Video games, board games and sport are not covered (a choice).
  - The examination question that names the dance, the tavern and games together is quoted last.
  - "Jeux défendus" (forbidden games) appear among the scandals of a household (Absolution): another reason not to widen the rule to all games.
- Default: Disabled (games on the project's starter list).
- Lexicon: gambling_cues (34 entries).

### drunkenness: Drunkenness and the tavern (disabled) {#drunkenness}

- Rule (as shipped): where feed-card, watch-meta; flag at 0.75; gate lexicon; lexicon drunkenness_cues; action feed-card=dim, watch-meta=label.
- Question: Does this show or promote heavy drinking or getting drunk (drinking games, binge drinking, bar crawls)?
- Passages:
  - Quote 1, Sur l'Ivrognerie (volume 3): « Ne vous laissez pas aller à l'ivrognerie, qui conduit à l'impureté. »
    - English (working, literal): Do not give yourselves up to drunkenness, which leads to impurity. (St. Paul, Eph. V, 18, in the French that heads the sermon.)
    - Read: apotre.org page 41 https://www.apotre.org/livres/vianney-sermons/41 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
  - Quote 2, Sur l'Ivrognerie (volume 3): « Qu'y entend-on ? Vous le savez bien mieux que moi : blasphèmes, jurements, imprécations, paroles sales. »
    - English (working, literal): What does one hear there? You know it far better than I: blasphemies, oaths, imprecations, dirty words. (Of the tavern.)
    - Read: apotre.org page 42 https://www.apotre.org/livres/vianney-sermons/42 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
  - Quote 3, Sur l’orgueil (volume 2): « il a voulu se prendre avec moi à celui qui boirait le plus sans s'enivrer »
    - English (working, literal): he wanted to take me on to see who could drink the most without getting drunk (drunkards boasting, in the sermon on pride)
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/orgeuil19.html; apotre.org page 29 https://www.apotre.org/livres/vianney-sermons/29
  - Quote 4, Sur l'Ivrognerie (volume 3): « les autres pensent que pourvu qu'ils ne perdent pas la raison, ils ne commettent pas un bien grand péché »
    - English (working, literal): others think that, provided they do not lose their reason, they commit no very great sin (one of the three excuses of drunkards he sets out to refute)
    - Read: apotre.org page 41 https://www.apotre.org/livres/vianney-sermons/41 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
  - Quote 5, Sur l'Impureté (volume 3): « ce sont les danses, les bals, les fréquentations trop familières avec des personnes de différent sexe ; les chansons, les paroles libres, les immodesties dans les habits, les excès dans le boire et le manger »
    - English (working, literal): it is dances, balls, too-familiar dealings with persons of a different sex; songs, free words, immodesty in dress, excess in drinking and eating. (The answer he says a child of the catechism gives to "what ordinarily leads us to this shameful vice?")
    - Read: apotre.org page 40 https://www.apotre.org/livres/vianney-sermons/40 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
  - Quote 6, Sermons inédits : SERMON SUR L'EXAMEN DE CONSCIENCE (volume 4): « Êtes-vous fidèles à fuir les occasions de péché, telles que la danse, le cabaret et les jeux ? »
    - English (working, literal): Are you faithful in fleeing the occasions of sin, such as the dance, the tavern and games? (One of his questions for the examination of conscience.)
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome4/17conscience.htm; apotre.org page 53 https://www.apotre.org/livres/vianney-sermons/53
- Why the English rule matches:
  - A whole sermon on drunkenness, and "les excès dans le boire" in his catechism answer. The question is limited to heavy drinking and getting drunk (drinking games, binge drinking, bar crawls), not to the presence of alcohol.
  - He lists three excuses of drinkers and calls them errors: that there is no harm in drinking on every occasion, that it is no great sin as long as one keeps one's reason, and that company drags one along. The question therefore says "heavy drinking" and not only "getting drunk".
  - Drinking contests are in his text (the boast of who drank the most without getting drunk, in the sermon on pride), so "drinking challenge" is a cue.
  - The tavern is also one of the occasions to flee in his examination question (quoted last, with the dance and games).
  - He names the tavern as the place of "blasphèmes, jurements, imprécations, paroles sales"; the rule title keeps "the tavern" for that reason.
- Default: Disabled (drunkenness on the project's starter list). Alcohol content is common and the lexicon hits are broad.
- Lexicon: drunkenness_cues (38 entries).

### gluttony: Gluttony (disabled) {#gluttony}

- Rule (as shipped): where feed-card, watch-meta; flag at 0.80; gate lexicon; lexicon gluttony_cues; action feed-card=dim, watch-meta=label.
- Question: Does this show or promote eating far beyond need (eating challenges, mukbang, giant-portion contests)?
- Passages:
  - Quote 1, Sur la Pénitence (volume 1): « il ne faut pas manger par gourmandise, ni au-delà du nécessaire »
    - English (working, literal): one must not eat out of gluttony, nor beyond what is necessary
    - Read: livres-mystiques https://livres-mystiques.com/partieTEXTES/Ars/Sermons/tome1/penite15.html; apotre.org page 12 https://www.apotre.org/livres/vianney-sermons/12
  - Quote 2, Sur le deuxième Commandement de Dieu (volume 2): « La colère et la gourmandise sont des péchés mortels ; mais une petite colère, une petite gourmandise ne sont plus que des péchés véniels. »
    - English (working, literal): Anger and gluttony are mortal sins; but a small anger, a small gluttony are only venial sins.
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/commande12.html; apotre.org page 24 https://www.apotre.org/livres/vianney-sermons/24
  - Quote 3, Sur l'Impureté (volume 3): « ce sont les danses, les bals, les fréquentations trop familières avec des personnes de différent sexe ; les chansons, les paroles libres, les immodesties dans les habits, les excès dans le boire et le manger »
    - English (working, literal): it is dances, balls, too-familiar dealings with persons of a different sex; songs, free words, immodesty in dress, excess in drinking and eating. (The answer he says a child of the catechism gives to "what ordinarily leads us to this shameful vice?")
    - Read: apotre.org page 40 https://www.apotre.org/livres/vianney-sermons/40 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
- Why the English rule matches:
  - He asks to eat neither out of gluttony nor beyond what is necessary (Pénitence), lists "les excès dans le boire et le manger" in his catechism answer, and calls gluttony a mortal sin when grave (second Commandment).
  - Mukbang and eating challenges are the modern form of eating beyond need. The question is limited to that; it does not cover cooking, restaurants or recipes.
- Default: Disabled. It is not on the project's starter list, and food content is a very large genre.
- Lexicon: gluttony_cues (28 entries).

### anger: Anger (disabled) {#anger}

- Rule (as shipped): where feed-card, watch-meta; flag at 0.80; gate lexicon; lexicon anger_cues; action feed-card=dim, watch-meta=label.
- Question: Does this feature a person in a violent fit of rage (screaming, raging, meltdown), and not a calm protest or a staged scene?
- Passages:
  - Quote 1, Sur la colère (volume 3): « Si vous me demandez ce que c'est que la colère, je vous répondrai que c'est un mouvement violent, impétueux de l'âme, qui repousse avec instance ce qui lui déplaît. »
    - English (working, literal): If you ask me what anger is, I will answer that it is a violent, impetuous movement of the soul, which pushes away with insistence whatever displeases it.
    - Read: apotre.org page 42 https://www.apotre.org/livres/vianney-sermons/42 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
  - Quote 2, Sur la colère (volume 3): « La colère entraîne avec elle les jurements, les blasphèmes, les reniements de Dieu, les malédictions, les imprécations »
    - English (working, literal): Anger brings with it oaths, blasphemies, renunciations of God, curses, imprecations
    - Read: apotre.org page 42 https://www.apotre.org/livres/vianney-sermons/42 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
  - Quote 3, Sur la colère (volume 3): « Il y a donc une colère juste et raisonnable, que l'on peut plutôt appeler zèle que colère. »
    - English (working, literal): There is therefore a just and reasonable anger, which one may rather call zeal than anger.
    - Read: apotre.org page 42 https://www.apotre.org/livres/vianney-sermons/42 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
  - Quote 4, Sermons inédits : SERMON SUR L'EXAMEN DE CONSCIENCE (volume 4): « comme sont les blasphèmes, les jurements et les colères »
    - English (working, literal): as are the blasphemies, the oaths and the fits of anger (the faults he says people remember in their examination of conscience because they are the most ordinary)
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome4/17conscience.htm; apotre.org page 52 https://www.apotre.org/livres/vianney-sermons/52
- Why the English rule matches:
  - His definition (a violent, impetuous movement of the soul) is what the question tests: screaming, raging, meltdown.
  - He says anger brings with it oaths, blasphemies, renunciations of God, curses and imprecations: the same categories as the tongue rules. That is why those rules are on and this one is off: the words are what the filter can catch.
  - In his examination of conscience the fits of anger stand beside blasphemies and oaths among the most ordinary faults.
  - The exclusion "not a calm protest" comes from his "colère juste et raisonnable", better called zeal.
- Default: Disabled (anger on the project's starter list). The Curé allows a just anger he would call zeal; the question excludes calm protest, but a small model will confuse the two.
- Lexicon: anger_cues (43 entries): most verbs are at 0.15 because they are everyday words.

### revenge: Revenge (disabled) {#revenge}

- Rule (as shipped): where feed-card, watch-meta, subtitles; flag at 0.80; gate lexicon; lexicon revenge_cues; action feed-card=dim, watch-meta=label, subtitles=skip-segment.
- Question: Does this present taking revenge as satisfying, or urge someone to get even (revenge stories, 'petty revenge', 'make them pay')?
- Passages:
  - Quote 1, Sur la Satisfaction (volume 1): « si vous avez donné de mauvais conseils, comme en disant à quelqu'un de se venger »
    - English (working, literal): if you have given bad counsel, as in telling someone to take revenge
    - Read: livres-mystiques https://livres-mystiques.com/partieTEXTES/Ars/Sermons/tome1/satisfa5.html; apotre.org page 5 https://www.apotre.org/livres/vianney-sermons/5
  - Quote 2, Sur l’orgueil (volume 2): « Un vindicatif qui se venge des injures qu'on lui a faites, fait un mépris sanglant à Jésus-Christ »
    - English (working, literal): A vengeful man who avenges the insults done to him shows a bloody contempt for Jesus Christ
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/orgeuil19.html; apotre.org page 28 https://www.apotre.org/livres/vianney-sermons/28
  - Quote 3, Sur le deuxième Commandement de Dieu (volume 2): « Si, par exemple, vous avez, dans un accès de colère, promis de vous venger, il est bien certain qu'il ne faudrait pas le faire »
    - English (working, literal): If, for example, you have, in a fit of anger, promised to avenge yourself, it is quite certain that you should not do it
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/commande12.html; apotre.org page 24 https://www.apotre.org/livres/vianney-sermons/24
- Why the English rule matches:
  - In his examination of the tongue (Sur la Satisfaction), bad counsel follows bad songs and bad books, and telling someone to take revenge is his example of it. The question is the media form: urging or relishing getting even.
  - Vengeance appears in many sermons as what anger and envy lead to, and he says a promise of revenge made in anger should not be kept. No sermon lists its forms, so the rule rests on the three passages quoted and on no list; that is why it is off.
- Default: Disabled. Revenge stories are a genre of their own, and the question needs a model that can tell urging or relishing revenge from reporting what happened.
- Lexicon: revenge_cues (26 entries): "revenge" and "payback" at 0.75, "get even" and "make them pay" at 0.50, "grudge" and "enemy" at 0.15.

### pranks: Lies told to trick or amuse (disabled) {#pranks}

- Rule (as shipped): where feed-card, watch-meta; flag at 0.80; gate lexicon; lexicon prank_cues; action feed-card=dim, watch-meta=label.
- Question: Is this a prank, hoax or trick in which someone is deceived for laughs?
- Passages:
  - Quote 1, Sur le Mensonge (volume 2): « nous mentons pour attraper quelqu'un, ou pour faire rire et amuser la compagnie »
    - English (working, literal): we lie to catch someone out, or to make the company laugh and amuse it (the fifth of six kinds of lies)
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/mensonge15.html; apotre.org page 26 https://www.apotre.org/livres/vianney-sermons/26
  - Quote 2, Sur l'Absolution (volume 3): « qui prendront plaisir à dire des mensonges pour faire rire les autres »
    - English (working, literal): who will take pleasure in telling lies to make others laugh
    - Read: apotre.org page 34 https://www.apotre.org/livres/vianney-sermons/34 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
- Why the English rule matches:
  - Of the six kinds of lie in Sur le Mensonge the fifth is lying to catch someone out or to amuse the company; the Absolution sermon adds the habit of telling lies to make others laugh. The question is the media form: deceiving someone for laughs (prank, hoax, trick).
  - The other five kinds (pride, harm to the neighbour, pleasing, selling dearer, in confession) cannot be seen in a title and are not rules.
- Default: Disabled. It is one item in a list of six kinds of lie, and "prank" covers many harmless things.
- Lexicon: prank_cues (23 entries): "prank" itself is at 0.95.

### malicious_pleasure: Malicious pleasure in another's misfortune (disabled) {#malicious_pleasure}

- Rule (as shipped): where feed-card, watch-meta; flag at 0.80; gate lexicon; lexicon malicious_pleasure_cues; action feed-card=dim, watch-meta=label.
- Question: Is this made to be enjoyed as someone else's misfortune or humiliation (fails, 'karma', 'gets what he deserves')?
- Passages:
  - Quote 1, Sur l'Envie (volume 3): « C'est encore, nous dit-il, un malin plaisir que nous éprouvons quand notre prochain essuie quelque perte ou quelque disgrâce. »
    - English (working, literal): It is also, he tells us, a malicious pleasure that we feel when our neighbour suffers some loss or misfortune. ("He" is St. Thomas, on envy.)
    - Read: apotre.org page 39 https://www.apotre.org/livres/vianney-sermons/39 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
  - Quote 2, Sur l'Envie (volume 3): « D'autres fois, au contraire, vous vous réjouissez quand votre prochain éprouve quelque perte de biens, ou que l'on flétrit un peu sa réputation »
    - English (working, literal): At other times, on the contrary, you rejoice when your neighbour suffers some loss of goods, or when his reputation is somewhat tarnished
    - Read: apotre.org page 39 https://www.apotre.org/livres/vianney-sermons/39 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
- Why the English rule matches:
  - Envy has two parts in his definition, taken from St. Thomas: sadness at the neighbour's good and "un malin plaisir" at his loss or disgrace. Only the second can be a kind of content, so the question is limited to it (fails, "karma", humiliation made to be enjoyed).
  - He says the envious rejoice when the neighbour loses goods or when his reputation is tarnished; that is why public shaming is among the cues.
- Default: Disabled. Fail and humiliation compilations are a vast genre, and the question needs a model that can tell enjoyment of misfortune from reporting it.
- Lexicon: malicious_pleasure_cues (38 entries).

### divination: Consulting diviners (disabled) {#divination}

- Rule (as shipped): where feed-card, watch-meta; flag at 0.75; gate lexicon; lexicon divination_cues; action feed-card=blank, watch-meta=label.
- Question: Does this offer or advertise fortune-telling or divination for guidance (tarot, horoscopes, psychics, mediums)?
- Passages:
  - Quote 1, Sur la Satisfaction (volume 1): « Pour avoir consulté les devins, sept ans de pénitence. »
    - English (working, literal): For having consulted diviners, seven years of penance. (Among the penances of the early Church, which he lists.)
    - Read: livres-mystiques https://livres-mystiques.com/partieTEXTES/Ars/Sermons/tome1/satisfa5.html; apotre.org page 4 https://www.apotre.org/livres/vianney-sermons/4
  - Quote 2, Sur l'Ivrognerie (volume 3): « Alors il ordonna de faire venir tous ses devins, c'est-à-dire ses faux prophètes. »
    - English (working, literal): Then he ordered all his diviners, that is to say his false prophets, to be brought. (King Belshazzar, in the sermon on drunkenness.)
    - Read: apotre.org page 42 https://www.apotre.org/livres/vianney-sermons/42 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
- Why the English rule matches:
  - The only text is a line in his list of early penances (seven years for consulting diviners) and his gloss of "devins" as false prophets. The two sermons on the first Commandment contain nothing on superstition (see "Not included"). The question is limited to what the line names: fortune-telling and divination offered to the viewer for guidance.
  - Witchcraft and magic are not in the question (the rule occult covers them since 2026-11-26): he names magicians only in passing (as slanders against Christ in Sur le Mystère, and in a martyr's reply in the Maccabees sermon).
- Default: Disabled (superstition on the project's starter list). One line of the Curé is all there is to go on.
- Lexicon: divination_cues (33 entries): "tarot", "horoscope" and "fortune teller" are at 0.95.

### occult: Witchcraft, magic and the occult (enabled) {#occult}

- Rule (as shipped): where feed-card, related, watch-meta; flag at 0.80; gate lexicon; lexicon occult_cues; action feed-card=blank, watch-meta=warn-overlay.
- Question: Does this teach or promote witchcraft, spells, satanism, crystal or energy healing, the law of attraction or another New Age or occult practice as real, and not fantasy fiction, a game, a history lecture or a Catholic warning against it?
- Source: choice of the rule author (2026-11-26); not traced to a sermon. The only line of the Curé on this field is the one quoted under divination (« Pour avoir consulté les devins, sept ans de pénitence. »), and it is about diviners (the sermons were searched for "devins", "sorciers", "magiciens" and "horoscopes", see "Method"; the divination section records what was found). Tarot, horoscopes, psychics and mediums stay in divination (disabled) and are not repeated in the word list; only "spirit guide" is in both lists, at 0.50.
- Church texts it follows (read on the pages named):
  - CCC 2117: « All practices of magic or sorcery, by which one attempts to tame occult powers, so as to place them at one's service and have a supernatural power over others [...] are gravely contrary to the virtue of religion. »
    - Read: https://www.scborromeo.org/ccc/para/2117.htm
  - CCC 2113, on idolatry: « whether this be gods or demons (for example, satanism) »
    - Read: https://www.scborromeo.org/ccc/para/2113.htm
  - CCC 2116 (read for divination, cited here because the practices are next to it): « All forms of divination are to be rejected »
    - Read: https://www.scborromeo.org/ccc/para/2116.htm
- Why the English rule matches:
  - Magic and sorcery (2117) and satanism (2113) are the Catechism's words; the word list adds modern forms: witchcraft and Wicca, spell casting, Satanism, crystal healing, Reiki, energy healing, astral projection, the law of attraction, "manifesting", New Age. These are the rule author's choice; the Catechism does not name them.
  - The 0.95 tier holds a practice that is offered or taught: "crystal healing for beginners", "Reiki healing session", "astral projection tutorial", "healing crystals", "full moon ritual", "love spells that work", "witchcraft spells", "starseed". A bare "Reiki", "crystal healing" or "witchcraft" is at 0.75, because Catholic warnings and history talks use the same words ("Is Reiki compatible with the Catholic faith?").
  - Fantasy fiction and games ("D&D spellcasting", "summon spirit ashes", "Love Spell (official video)") also hold cues at 0.75, so the model is asked, and the question names them. Words such as "witch", "crystals" and "manifestation" are at 0.15 and "manifesting", "third eye" and "sorcery" at 0.50, so they only matter when the slider is moved down.
  - Exorcism is not a cue: it is Catholic.
- Default: Enabled, by the decision of the rule author (2026-11-26).
- Lexicon: occult_cues (44 entries): 10 at 0.95, 24 at 0.75, 7 at 0.50, 3 at 0.15.

### denial_of_god: Denying that there is a God (enabled) {#denial_of_god}

- Rule (as shipped): where feed-card, related, comment, watch-meta, subtitles; flag at 0.80; gate lexicon; lexicon denial_of_god_cues; action feed-card=blank, watch-meta=warn-overlay, subtitles=skip-segment. The settings page shows it as "Atheism", the first rule of the group "Unbelief and other religions".
- Question: Does this say that there is no God, or argue for atheism (for example 'why I am an atheist'), and not just discuss atheism, report on it or answer it from a believer's side?
- Passages:
  - Quote 1, Sur la religion (volume 4): « je parle à de bons chrétiens et non à des athées, c'est-à-dire à des personnes qui ne croient à rien, et qui nient tout »
    - English (working, literal): I speak to good Christians and not to atheists, that is, to people who believe in nothing and who deny everything
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome4/14religion.htm; apotre.org page 50 https://www.apotre.org/livres/vianney-sermons/50
  - Quote 2, Sur la religion (volume 4): « L'impie a dit dans son cœur : Non, il n'y a point de Dieu. »
    - English (working, literal): The impious man has said in his heart: No, there is no God. (Psalm text that heads the sermon.)
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome4/14religion.htm; apotre.org page 50 https://www.apotre.org/livres/vianney-sermons/50
  - Quote 3, Sur la religion (volume 4): « un tel blasphème peut-il bien sortir de la bouche d'un chrétien »
    - English (working, literal): can such a blasphemy come out of the mouth of a Christian (the blasphemy is "il n'y a point de Dieu")
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome4/14religion.htm; apotre.org page 50 https://www.apotre.org/livres/vianney-sermons/50
- Why the English rule matches:
  - Sur la religion starts from "L'impie a dit dans son cœur : Non, il n'y a point de Dieu" and addresses atheists, "des personnes qui ne croient à rien, et qui nient tout". He calls the sentence "il n'y a point de Dieu" a blasphemy.
  - The question, as first written, was limited to a flat statement that there is no God. On 2026-11-26 the rule author renamed the rule "Atheism" and widened the question to arguing for atheism, so that a title such as "Why I am an atheist" is in. Discussion of atheism or of whether God exists, a report on atheism and an answer from a believer's side are still excluded: the sermon itself argues the question and does not forbid the subject.
  - He names the writers of his time who attacked religion (Voltaire and others). The pack does not name people.
  - The word list gained 14 entries on 2026-11-26 (25 to 39). At 0.95: "why I am an atheist", "I am an atheist", "why I don't believe in God", "God is a lie" (and "a fiction", "a delusion", "imaginary"). At 0.75, because Catholic replies and debates use the same words: "I don't believe in God", "new atheism", "atheist debate", "atheist vs Christian", "arguments for atheism", "arguments against God", "no evidence for God", "I am agnostic", "becoming an atheist". At 0.50: "antitheism". The old entries are unchanged.
- Church text read (added 2026-11-26; not the source of the rule, which stays the sermon):
  - CCC 2125: « Since it rejects or denies the existence of God, atheism is a sin against the virtue of religion. »
    - Read: https://www.scborromeo.org/ccc/para/2125.htm
  - CCC 2127, on agnosticism: « In other cases, the agnostic makes no judgment about God's existence, declaring it impossible to prove, or even to affirm or deny. » CCC 2128 adds: « Agnosticism is all too often equivalent to practical atheism. »
    - Read: https://www.scborromeo.org/ccc/para/2127.htm and https://www.scborromeo.org/ccc/para/2128.htm
- Default: Enabled (changed on 2026-11-26 by the rule author, who calls the rules on belief the most important part; it was disabled because it would flag debate, philosophy and apologetics). The cost is known: the 0.95 tier flags a flat statement even in a title that quotes it to answer it, for example a reply to "there is no God" arguments; the 0.75 tier waits for the model.
- Lexicon: denial_of_god_cues (39 entries): 10 at 0.95, 15 at 0.75, 9 at 0.50, 5 at 0.15. The flat statements ("there is no God") are at 0.95; "atheist" is at 0.50 because it also names a discussion.

### naturalism: Naturalism and rationalism (enabled) {#naturalism}

- Rule (as shipped): where feed-card, related, watch-meta; flag at 0.80; gate lexicon; lexicon naturalism_cues; action feed-card=blank, watch-meta=warn-overlay.
- Question: Does this argue that nature or matter is all there is, or that science rules out God, miracles or the soul, rather than explain science neutrally or answer such claims from a believer's side?
- Source: choice of the rule author (2026-11-26); not traced to a sermon. The Curé's sermon Sur la religion (see denial_of_god) is about those who deny God, and no sermon was found on naturalism as a doctrine (the word search under "Method" included "athées", "incrédules", "impies", "libres penseurs" and Voltaire).
- Church texts it follows (read on the pages named):
  - Syllabus of Errors (Pius IX, 1864), section I, "Pantheism, naturalism and absolute rationalism", proposition 3 (a proposition the Syllabus lists as an error): « Human reason, without any reference whatsoever to God, is the sole arbiter of truth and falsehood, and of good and evil »
    - Read: https://www.papalencyclicals.net/pius09/p9syll.htm
  - The same section, proposition 7 (listed as an error): « The prophecies and miracles set forth and recorded in the Sacred Scriptures are the fiction of poets, and the mysteries of the Christian faith the result of philosophical investigations. »
    - Read: https://www.papalencyclicals.net/pius09/p9syll.htm
  - CCC 2124, on the forms of atheism: « One common form is the practical materialism which restricts its needs and aspirations to space and time. » and « Atheistic humanism falsely considers man to be "an end to himself, and the sole maker, with supreme control, of his own history." »
    - Read: https://www.scborromeo.org/ccc/para/2124.htm
- Why the English rule matches:
  - The Syllabus names the doctrine (section I, propositions 1 to 7): reason as the only judge of truth, and prophecies and miracles as fictions. The 0.95 tier turns the claim into its modern flat statements: "miracles are impossible", "science disproves God", "there is no such thing as the supernatural", "the soul is an illusion", "matter is all there is", "nothing exists but matter", "Jesus never existed", "the resurrection is a myth" (the last two follow the end of proposition 7: « Jesus Christ is Himself a myth »). The question forms ("Has science disproved God?", "Are miracles impossible?") are not matched at 0.95: a lookbehind and the word order spare them.
  - "Practical materialism" and "atheistic humanism" are the Catechism's words for two forms of atheism; they are why "materialism" and "humanism" are in the list. Both are also everyday or historical words ("Renaissance humanism", materialism as love of money), so they are at 0.50 and only matter when the slider is moved down. "Scientism", "secular humanism", "methodological naturalism" and "science vs religion" are at 0.75 and wait for the model.
  - The question separates arguing the claim from explaining science and from a believer's answer; a Catholic physicist on the Big Bang is the spared example. "Skeptic" and "secular" are at 0.15.
- Default: Enabled, by the decision of the rule author (2026-11-26).
- Lexicon: naturalism_cues (35 entries): 10 at 0.95, 12 at 0.75, 10 at 0.50, 3 at 0.15.

### indifferentism: Indifferentism (enabled) {#indifferentism}

- Rule (as shipped): where feed-card, related, watch-meta; flag at 0.80; gate lexicon; lexicon indifferentism_cues; action feed-card=blank, watch-meta=warn-overlay.
- Question: Does this say that all religions are equally true or equally good ways to God, or that it does not matter which religion a person follows, and not just describe or compare religions or answer that claim?
- Source: choice of the rule author (2026-11-26); not traced to a sermon. It is the example rule of plan section 5 ("all religions are equally true"); the sermons have no passage for it (see "Not included and why").
- Church texts it follows (read on the pages named):
  - Syllabus of Errors (Pius IX, 1864), section III, "Indifferentism, latitudinarianism", proposition 15 (listed as an error): « Every man is free to embrace and profess that religion which, guided by the light of reason, he shall consider true. »
    - Read: https://www.papalencyclicals.net/pius09/p9syll.htm
  - The same section, proposition 16 (listed as an error): « Man may, in the observance of any religion whatever, find the way of eternal salvation, and arrive at eternal salvation. »
    - Read: https://www.papalencyclicals.net/pius09/p9syll.htm
  - CCC 846: « the one Christ is the mediator and the way of salvation »
    - Read: https://www.scborromeo.org/ccc/para/846.htm
- Why the English rule matches:
  - The rule takes propositions 15 and 16: that every religion is as true or as good a way as any other, and that it does not matter which one follows. The 0.95 tier holds the flat statements: "all religions are the same" (or "equal", "equally true", "valid"), "every religion is valid", "no religion is better than another", "it doesn't matter what you believe", "any religion will do". "Not all religions are the same" and "Are all religions the same?" are not matched (a lookbehind and the word order).
  - "All paths lead to God", "many paths to God", "the same God by different names", "spiritual but not religious", "religious pluralism" and "unitarian universalist" are at 0.75 and wait for the model; "interfaith", "interreligious" and "all religions" are at 0.50; "coexist", "world religions", "relativism" and "pluralism" are at 0.15.
  - Proposition 17 (« Good hope at least is to be entertained of the eternal salvation of all those who are not at all in the true Church of Christ. ») is not used. The Catechism says: « Those who, through no fault of their own, do not know the Gospel of Christ or his Church [...] those too may achieve eternal salvation » (CCC 847, https://www.scborromeo.org/ccc/para/847.htm), so a cue built on 17 would flag Catholic teaching. The question asks about the claim that religions are equal, not about who may be saved.
- Default: Enabled, by the decision of the rule author (2026-11-26).
- Lexicon: indifferentism_cues (30 entries): 5 at 0.95, 11 at 0.75, 10 at 0.50, 4 at 0.15.

### protestantism: Protestant and evangelical teaching (enabled) {#protestantism}

- Rule (as shipped): where feed-card, related, watch-meta; flag at 0.80; gate lexicon; lexicon protestantism_cues; action feed-card=blank, watch-meta=warn-overlay.
- Question: Is this Protestant or evangelical religious content (a pastor's sermon or message, a worship service, prosperity or prophecy preaching, evangelical teaching, an argument against Catholic doctrine), and not a Catholic talk about Protestants or neutral history?
- Passages (the only sermon text; `source:` is Sur la colère):
  - Quote 1, Sur la colère (volume 3): « Je ne veux pas vous parler de ceux qui renient Dieu en quittant la religion catholique pour en embrasser une fausse : tels sont les protestants, les jansénistes et tant d'autres. »
    - English (working, literal): I do not want to speak to you of those who renounce God by leaving the Catholic religion to embrace a false one: such are the Protestants, the Jansenists and many others.
    - Read: apotre.org page 42 https://www.apotre.org/livres/vianney-sermons/42 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
  - Quote 2, the next sentence of the same sermon: « Nous appelons ces personnes des renégats et des apostats. »
    - English (working, literal): We call these persons renegades and apostates.
    - Read: apotre.org page 42 https://www.apotre.org/livres/vianney-sermons/42
- Church texts read (not the source; they are why the rule is about content and not about persons):
  - Syllabus of Errors (Pius IX, 1864), section III, proposition 18 (listed as an error): « Protestantism is nothing more than another form of the same true Christian religion, in which form it is given to please God equally as in the Catholic Church. »
    - Read: https://www.papalencyclicals.net/pius09/p9syll.htm
  - CCC 817: « here we must distinguish heresy, apostasy, and schism »
    - Read: https://www.scborromeo.org/ccc/para/817.htm
  - CCC 818, of those who are born into the separated communities: « the Catholic Church accepts them with respect and affection as brothers »
    - Read: https://www.scborromeo.org/ccc/para/818.htm
  - CCC 819: « many elements of sanctification and of truth » are found outside the visible confines of the Catholic Church
    - Read: https://www.scborromeo.org/ccc/para/819.htm
- Why the English rule matches:
  - The Curé sets Protestants aside in order to define "reniement" (see "Not included and why"); he names them with the Jansenists as people who leave the Catholic religion for a false one and calls them renegades and apostates. The passage names a category of persons, not a kind of content. The rule author decided to turn it into a filter on Protestant and evangelical teaching and worship; every cue of the word list beyond the words "Protestant" and "Protestantism" is his choice, and the sermon says nothing of sermons, altar calls or doctrines.
  - The Catechism passages (818, 819) are why the question and the word list are about teaching, worship and arguments against Catholic doctrine, and not about the people: the Church accepts those born into these communities "with respect and affection as brothers".
  - Widened on 2026-11-26. The rule author wants the rule to keep out the "spiritual" American preaching content that fills a feed: pastors, reverends, televangelists, prosperity and prophecy preaching, worship nights. He gave "Pastor" and "Reverend" as common keywords and decided that they flag a title by themselves (a Catholic priest is called Father). Every cue beyond the words "Protestant" and "Protestantism" is his choice or the list author's, and no cue names a person: no pastor, no preacher, no reformer.
  - The 0.95 tier holds what flags by itself: "pastor" and "reverend" as title words (guarded, see below); a denomination next to its own kind of content ("Baptist sermon", "Pentecostal worship", "Lutheran preaching", "Reformed revival", "megachurch worship", for Baptist, Pentecostal, Lutheran, Methodist, Presbyterian, Calvinist, Reformed and non-denominational); "altar call"; "accept Jesus as your personal Lord and Savior"; "tent revival", "revival service", "healing crusade", "miracle service"; "a prophetic word for ..." ("prophetic word for", "prophetic word about"); and prosperity, "word of faith" or "health and wealth" followed by preaching, preacher or sermon. "Protestant sermon" and "evangelical sermon" are not at 0.95, because Catholic comparisons use them. "John the Baptist" is spared by a lookbehind (so is the baptistery, which is a different word), and "Pentecost" is not "Pentecostal".
  - "Pastor" and "reverend" are spared where the Church itself uses them: "parish pastor", "Catholic pastor" and "monsignor pastor" (the word before), "Pastor aeternus", "Pastor bonus", "Pastor angelicus", "pastor of souls" ("animarum"), and the Spanish dog breeds ("Pastor alemán", "belga", "australiano", "vasco", "catalán"); "Most Reverend", "Right Reverend", "Very Reverend", "Reverend Mother", "Reverend Father", "Reverend Sister", "Reverend Monsignor", "Reverend Canon", "Reverend Abbot" and the like. The tests run these through the real list. "Pastoral" is a different word and is not matched.
  - Known false alarms of "pastor" and "reverend" (the rule author accepts them): a Catholic priest called "pastor" in a title without "parish", "Catholic" or "monsignor" right before the word (for example "Fr. John, pastor of St. Mary's: a homily", "Pastor's message for the Fourth Sunday of Lent", "Our pastor on the Eucharist"); a person or a band named Pastor or Reverend ("Reverend Horton Heat"). An Anglican or Lutheran "Reverend" is flagged on purpose: it is not Catholic content.
  - The abbreviation "Rev." is not a cue. The pattern `\brev\.? [a-z]+` matches "Rev up your engine", "Rev counter explained" and "Rev. Fr. Smith on the Mass", and the text the lists see is lower-cased and has no full stops, so nothing tells "Rev. Smith" from "rev up". ("Revenue" is no collision; "Rev. 21:4" is spared because a number follows.) Only "Rev. Dr." is a cue, at 0.75.
  - The denomination words (Protestant, Lutheran, Calvinist, evangelical, Pentecostal, Methodist, Presbyterian, Anglican, Baptist), "televangelist", "megachurch", the prosperity words ("prosperity gospel", "word of faith", "name it and claim it", "seed faith", "health and wealth gospel"), "prophetic word" and "prophetic ministry", "speaking in tongues", "slain in the Spirit", "praise and worship", "worship team", "worship night", "worship session", "God told me", "non-denominational", "bible-believing", "born again", "gospel preacher", "street preacher", the sinner's prayer and the doctrine words (sola scriptura, sola fide, faith alone, bible only, the Reformation, once saved always saved) are at 0.75: Catholic apologetics, history and news (hospital names, elections, the Catholic charismatic movement) use them, so they wait for the model.
  - At 0.50, below the model band: "personal relationship with Jesus" (Catholic evangelisation uses it), "anointing" and "anointed" (not "anointing of the sick" or "anointing oil"), "Sunday sermon" (traditional Catholics also say sermon), "rapture", "eternal security", "reformation". At 0.15: "church service", "bible study", "Sunday school", "reformed", "health and wealth" alone (finance), and "apostle" (the Apostles are in every Catholic title; the rule author suggested 0.50, but at the "lenient" slider position that would flag Catholic homilies).
  - The word list has no word of contempt for the genre or for anyone (the tests check it).
- Default: Enabled, by the decision of the rule author (2026-11-26).
- Lexicon: protestantism_cues (42 entries): 8 at 0.95, 26 at 0.75, 4 at 0.50, 4 at 0.15.

### islam: Islamic teaching and worship (enabled) {#islam}

- Rule (as shipped): where feed-card, related, watch-meta; flag at 0.80; gate lexicon; lexicon islam_cues; action feed-card=blank, watch-meta=warn-overlay.
- Question: Is this Islamic religious content (Quran recitation, an Islamic lecture or sermon, a call to convert), and not news, history or a Catholic or scholarly discussion of Islam?
- Source: choice of the rule author (2026-11-26); not traced to a sermon. The word search of the sermons (see "Method") did not include Islam or Muslims, so the pack makes no claim about what the Curé said of them.
- Church texts read (not a ground for filtering; they describe Islam with respect):
  - CCC 841: « these profess to hold the faith of Abraham, and together with us they adore the one, merciful God, mankind's judge on the last day »
    - Read: https://www.scborromeo.org/ccc/para/841.htm
  - CCC 843: « The Catholic Church recognizes in other religions that search, among shadows and images, for the God who is unknown yet near »
    - Read: https://www.scborromeo.org/ccc/para/843.htm
- Why the English rule matches:
  - The rule is the rule author's choice to keep Islamic religious teaching and worship out of the feed, as it does for the other non-Catholic religions. It is not a statement that Muslims are enemies, and the Catechism passages above say the opposite. The question is therefore limited to religious content (a recitation, a lecture, a sermon, a call to convert) and excludes news, history and a Catholic or scholarly discussion.
  - The 0.95 tier holds what only Islamic religious content says: "Quran recitation", "recitation of the Holy Quran", "tafsir", "khutbah", "dawah", "Islamic lecture" (or sermon, reminder, lesson, talk, class, course), "how to convert to Islam", "why you should convert to Islam", "Ramadan reminder", "taraweeh", "Ayatul Kursi".
  - Terms that news, history and Catholic replies also use are at 0.75 and wait for the model: Quran, Hadith, Sunnah, Sharia, Allah, "Allahu Akbar", imam, Hajj, Umrah, Kaaba, surah, adhan, "Prophet Muhammad", "peace be upon him", "why Islam", "converted to Islam", "Islam vs Christianity". Islam, Islamic, Muslim, mosque, Ramadan and Sufi are at 0.50, so a news item, a recipe or a travel film does not reach the model at the default setting.
  - The list is neutral and descriptive. No cue names a person ("Prophet Muhammad" is a religious title the rule author asked for; the bare name is left out because it is also a common given name), and none is a derogatory name.
- Default: Enabled, by the decision of the rule author (2026-11-26).
- Lexicon: islam_cues (43 entries): 12 at 0.95, 22 at 0.75, 8 at 0.50, 1 at 0.15.

### judaism: Jewish religious teaching and worship (enabled) {#judaism}

- Rule (as shipped): where feed-card, related, watch-meta; flag at 0.80; gate lexicon; lexicon judaism_cues; action feed-card=blank, watch-meta=warn-overlay.
- Question: Is this Jewish religious content (Torah or Talmud study, a rabbi's lecture or sermon, a synagogue service), and not history, news or a Catholic talk about the Old Testament or the Jewish roots of Christianity?
- Source: choice of the rule author (2026-11-26); not traced to a sermon. The word search of the sermons (see "Method") did not include the Jews or Judaism, so the pack makes no claim about what the Curé said of them. The rule was left out of the first round of 2026-11-26 and added later that day, when the rule author said that he had left it out on purpose and wanted it in: "it's targeted towards traditional Catholics, they'd understand".
- Church texts read (they say how the Church speaks of the Jewish faith and of the Jewish people; they do not ask for this rule):
  - CCC 839: « The Jewish faith, unlike other non-Christian religions, is already a response to God's revelation in the Old Covenant. »
    - Read: https://www.scborromeo.org/ccc/para/839.htm
  - CCC 840, on the Jewish expectation of a Messiah: « the latter waiting is accompanied by the drama of not knowing or of misunderstanding Christ Jesus »
    - Read: https://www.scborromeo.org/ccc/para/840.htm
  - Nostra aetate 4 (Second Vatican Council, 1965): « The Church, therefore, cannot forget that she received the revelation of the Old Testament through the people with whom God in His inexpressible mercy concluded the Ancient Covenant. »
    - Read: https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_decl_19651028_nostra-aetate_en.html
  - The same section: « the Jews should not be presented as rejected or accursed by God, as if this followed from the Holy Scriptures »; and the Church « decries hatred, persecutions, displays of anti-Semitism, directed against Jews at any time and by anyone »
    - Read: https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_decl_19651028_nostra-aetate_en.html
  - CCC 597, quoting the Council: « ... all Jews indiscriminately at that time, nor Jews today, can be charged with the crimes committed during his Passion »
    - Read: https://www.scborromeo.org/ccc/para/597.htm
- Why the English rule matches:
  - The rule is the rule author's choice for traditional Catholics. It looks at Jewish religious content (Torah and Talmud study, a rabbi's lecture or sermon, a synagogue service, observance taught as practice), as the rules on Islam and on the Eastern religions look at theirs, and not at people. The texts above are quoted so that it is not read as anything else: the Church holds that it received the Old Testament through this people, that the Jewish faith is already a response to God's revelation, and that the Jews are not to be blamed, rejected or hated. The question excludes history, news and a Catholic talk about the Old Testament or about the Jewish roots of Christianity.
  - The 0.95 tier holds what is by itself Jewish religious content: "Torah portion", "Torah study", "Talmud study" (also class, lecture, lesson, page), "Mishnah study", "Tanakh study", "rabbi explains" (also teaches, answers, lecture, sermon, class, talk), "Shabbat service", "synagogue service", "Jewish worship service", a holiday followed by service, sermon or prayers ("Yom Kippur service", "Rosh Hashanah sermon"), "Kabbalah course", "Chabad lecture", "yeshiva shiur", "daf yomi", "shiur", "farbrengen", "parsha", "chassidus", "Kabbalat Shabbat".
  - Guards. Five of the 0.95 entries (study of the Torah, Talmud, Mishnah and Tanakh; "rabbi explains" and its kin; synagogue and Shabbat services; holiday services; Kabbalah, Chabad and yeshiva courses) are guarded against a Catholic title: if the title says "Old Testament", "New Testament", "Last Supper", "Jewish roots", "roots of the Mass", "Jesus the Jew", "Holy Week", "Catholic", "Eucharist" or "the Mass", the cue falls to the 0.75 of its bare word (rabbi, Torah, Talmud) or lower, and the title waits for the model. So "A rabbi explains the Last Supper to a Catholic priest" and "Torah portion and the Gospel: a Catholic homily on the Old Testament reading" are not flagged by the words. The entries that only a Jewish study session would use ("daf yomi", "shiur", "farbrengen", "parsha", "chassidus", "Kabbalat Shabbat") are not guarded. The tests run these titles.
  - The bare word "Jewish" is not a cue, because it also names a people; "Jews", "Israel" and anything about politics are not cues either. The list holds the words of the religion. "Jewish prayer", "Jewish worship", "Jewish law", "Jewish liturgy" and the like are at 0.75 together with Judaism, Torah, Talmud, rabbi, rabbinic, yeshiva, Kabbalah, Chabad, Hasidic, Mishnah, Gemara, halakha, Tanakh, siddur and "Passover seder": Catholic talks, history and news use these words, so they wait for the model. A title about Jewish history, Jewish comedians or an Israeli election has no cue at all (the tests check it).
  - At 0.50, below the model band: synagogue, Passover, Hanukkah, Rosh Hashanah, Yom Kippur, Sukkot, Purim, Shavuot, Shabbat, seder, bar and bat mitzvah, mitzvah, tefillin, tallit, mezuzah, shofar, kiddush, minyan (a tour, a holiday greeting, a news item or a Catholic talk on the Last Supper uses them); at 0.15: kosher.
  - No cue names a person, and none is derogatory, conspiratorial or about an ethnicity; the tests check the list for these words.
  - A known cost of the flat cues: a title that begins "Rabbi explains ..." is flagged even when the subject is news; the question cannot be asked at 0.95.
- Default: Enabled, by the decision of the rule author (2026-11-26).
- Lexicon: judaism_cues (36 entries): 11 at 0.95, 15 at 0.75, 9 at 0.50, 1 at 0.15.

### eastern_religions: Buddhism, Hinduism and other Eastern religions (enabled) {#eastern_religions}

- Rule (as shipped): where feed-card, related, watch-meta; flag at 0.80; gate lexicon; lexicon eastern_religions_cues; action feed-card=blank, watch-meta=warn-overlay.
- Question: Is this Buddhist, Hindu, Sikh, Taoist or similar religious teaching or practice (a talk, chanting, a mantra, a meditation retreat), and not news, history, travel or a Catholic discussion of those religions?
- Source: choice of the rule author (2026-11-26); not traced to a sermon. The word search of the sermons (see "Method") did not include these religions, so the pack makes no claim about what the Curé said of them.
- Church texts read:
  - CCC 2112, on the first commandment: « The first commandment condemns polytheism. It requires man neither to believe in, nor to venerate, other divinities than the one true God. »
    - Read: https://www.scborromeo.org/ccc/para/2112.htm
  - CCC 843, which says what the Church also holds of other religions: « The Catholic Church recognizes in other religions that search, among shadows and images, for the God who is unknown yet near »
    - Read: https://www.scborromeo.org/ccc/para/843.htm
- Why the English rule matches:
  - The rule keeps teaching and practice of these religions out of the feed (2112 is the Catechism's text on divinities other than the one God; it does not name these religions, and 843 shows that the Church does not reject everything in them). It is the rule author's choice; the question excludes news, history, travel and a Catholic discussion.
  - The 0.95 tier holds chants, hymns, retreats and talks that are the practice itself: "Om Mani Padme Hum", "Om Namah Shivaya", "Hanuman Chalisa", "Waheguru", "Gurbani", "bhajan", "Vipassana", "dharma talk", "Buddhist meditation" (or chanting, sutras, mantras), "Hindu mantras", "Bhagavad Gita lecture", "chakra healing", "kundalini yoga".
  - The names of the religions and their scriptures (Buddhism, Hinduism, Hindu, Sikh, Taoism, dharma, Vedas, the Bhagavad Gita, "transcendental meditation", "meditation retreat", ashram) are at 0.75 and wait for the model, because travel films, news and Catholic replies use them. "Buddha", "chakra" (also Naruto), "mantra" (also "my mantra"), "nirvana", "reincarnation" (also anime) and "Krishna" are at 0.50. "Zen" (also a processor), "guru", "karma", "enlightenment" and "yoga" are at 0.15, as the rule author asked ("karma" only at 0.15, because it is common slang).
  - No cue names a person, and none is a derogatory name.
- Default: Enabled, by the decision of the rule author (2026-11-26).
- Lexicon: eastern_religions_cues (44 entries): 10 at 0.95, 23 at 0.75, 6 at 0.50, 5 at 0.15.

### sects: Sects and new religious movements (enabled) {#sects}

- Rule (as shipped): where feed-card, related, watch-meta; flag at 0.80; gate lexicon; lexicon sects_cues; action feed-card=blank, watch-meta=warn-overlay.
- Question: Is this teaching, worship or promotion by a sect or new religious movement (for example Mormons, Jehovah's Witnesses, Scientology), and not news, a documentary about it or a Catholic reply to it?
- Source: choice of the rule author (2026-11-26); not traced to a sermon. The word search of the sermons (see "Method") did not include these groups, so the pack makes no claim about what the Curé said of them.
- Church text read (general; it names none of these groups):
  - CCC 2089: « Heresy is the obstinate post-baptismal denial of some truth which must be believed with divine and catholic faith »
    - Read: https://www.scborromeo.org/ccc/para/2089.htm
  - CCC 2088: « The first commandment requires us to nourish and protect our faith with prudence and vigilance, and to reject everything that is opposed to it. »
    - Read: https://www.scborromeo.org/ccc/para/2088.htm
- Why the English rule matches:
  - The pack does not decide which group falls under which word of the Catechism ("heresy", "apostasy", "schism"); the rule author chose to keep the teaching and promotion of these groups out of the feed. The list uses the names the groups give themselves; no word such as "cult" and no nickname is a cue, and no cue names a person.
  - The 0.95 tier holds what only the group itself speaks of: "Kingdom Hall", "jw.org", "Jehovah's Witnesses convention (or meeting)", "Mormon (or Latter-day Saints) general conference, testimony, sacrament meeting".
  - The names of the groups (Mormon, Latter-day Saints, Jehovah's Witnesses, the Watchtower Society, Scientology, Christian Science, Seventh-day Adventist, the Unification Church, Unitarian, Baha'i, Christadelphian, Rosicrucian, Theosophy, "new religious movement") are at 0.75 and wait for the model, because news, documentaries, travel and Catholic replies use them; the question names those cases. "Adventist" (also a hospital name), "LDS" and "Watchtower" (also a song and a game) are at 0.50, "Jehovah" at 0.15.
- Default: Enabled, by the decision of the rule author (2026-11-26).
- Lexicon: sects_cues (32 entries): 4 at 0.95, 24 at 0.75, 3 at 0.50, 1 at 0.15.

### freemasonry: Freemasonry and secret societies (enabled) {#freemasonry}

- Rule (as shipped): where feed-card, related, watch-meta; flag at 0.80; gate lexicon; lexicon freemasonry_cues; action feed-card=blank, watch-meta=warn-overlay. Group anticatholic (it was in belief until part two of 2026-11-26).
- Question: Does this present Freemasonry as good, harmless or true (its lodges, rites, degrees, symbols or teaching, praise of it, or an invitation to join), and not warn against it from a Catholic viewpoint, report the Church's condemnation, tell its history neutrally or concern stone masonry?
- Source: canon 1399, 8 and two documents of the Church, quoted below; not traced to a sermon. The sermons were searched for "francs-maçons": the word does not occur (see "Not included and why"), so there is no passage. The rule was left out of the first round of 2026-11-26 and added later that day, at the rule author's instruction (see "Rules chosen by the rule author (2026-11-26)"); in part two he asked that it flag the contents and effects of Freemasonry and not the Catholic videos against it. The question of the first round ended "and not about stone masonry or a neutral history"; "or a Catholic talk about it" was added the same day, and in part two the question became the one above. The `source:` line of the rules file: `Canon 1399, 8 (the Index of Forbidden Books); Leo XIII, Humanum genus (1884); CDF Declaration of 26 November 1983. Applying them to videos is a choice of the rule author`
- Church texts it follows (read on the pages named; the first is the file of the Index, the others are those of the first round):
  - Canon 1399, class 8, in the words of the Index. Quote (forbidden.md): “Books that hold duelling, suicide or divorce to be lawful, or that present the Masonic and similar sects as useful and harmless to the Church and to civil society.” The class is about books that PRESENT the sects as useful and harmless.
  - Congregation for the Doctrine of the Faith, Declaration on Masonic Associations, 26 November 1983 (Latin title "Declaratio de associationibus massonicis", incipit "Quaesitum est"; AAS 76 [1984], 300; approved and ordered published by John Paul II): « the Church's negative judgment in regard to Masonic association remains unchanged since their principles have always been considered irreconcilable with the doctrine of the Church and therefore membership in them remains forbidden »
    - Read: https://www.vatican.va/roman_curia/congregations/cfaith/documents/rc_con_cfaith_doc_19831126_declaration-masonic_en.html (the Latin: https://www.vatican.va/roman_curia/congregations/cfaith/documents/rc_con_cfaith_doc_19831126_declaration-masonic_lt.html)
  - The same declaration: « The faithful who enrol in Masonic associations are in a state of grave sin and may not receive Holy Communion. »
    - Read: https://www.vatican.va/roman_curia/congregations/cfaith/documents/rc_con_cfaith_doc_19831126_declaration-masonic_en.html
  - Leo XIII, Humanum genus (1884), 6: « this apostolic see denounced the sect of the Freemasons [...] and it forbade any one to enter the society »
    - Read: https://www.vatican.va/content/leo-xiii/en/encyclicals/documents/hf_l-xiii_enc_18840420_humanum-genus.html
  - The same encyclical, 11: « must be understood of the sect of the Freemasons taken generically [...] but not of the individual members of them »; and 16, on the error that the rule indifferentism also names: « a regard for religion should be held as an indifferent matter, and that all religions are alike »
    - Read: https://www.vatican.va/content/leo-xiii/en/encyclicals/documents/hf_l-xiii_enc_18840420_humanum-genus.html
  - The Catechism of St. Pius X (the file `docs/en/st-pius-x/catechism.md`), on the First Commandment. Quote (catechism.md): “The First Commandment also forbids all dealings with the devil, and all association with anti-Christian sects.” It names no sect; the pack does not claim that it means the Masons, and uses it only as the general ground.
  - The Index itself prints nine lines that name Freemasonry in their title (L120, L4570, L7303, L7304, L9671, L9717, L9734, L9954, L10118 of the file; the list is in the research file): among them "Relation apologétique et historique de la société des franc-maçons" (1739), "Examen critico de las causas de la persecucion que han experimentado los francmasones" (1820) and "Die Johannis-Freimaurerei. Versuch einer Einführung" (decree of 16 January 1954). By their titles they are writings of Masons or on their behalf, which is what the class forbids; the file gives only the titles.
- Why the English rule matches:
  - The rule is the rule author's choice for traditional Catholics. The Church's judgment is on the associations and their principles; Leo XIII says himself that it is "not of the individual members of them". So the rule looks at Masonic content (a lodge, its rites and degrees, its teaching, praise of it, an invitation to join) and not at people. In part two the rule author drew the line that canon 1399 draws: what presents Freemasonry as good, harmless or true is flagged, and what warns against it from the Catholic side (a talk, the Church's declarations, an exposé from a Catholic viewpoint, the history of the condemnations) is spared.
  - The 0.95 tier holds a lodge, a rite, a degree, a ritual, an invitation, a praise or a defence: "Masonic lodge" and "Masonic ritual" (also degree, initiation, oath, ceremony, rite, obligation), "Freemasonry lodge" (also degree, ritual, initiation), "Worshipful Master", "York Rite", "Scottish Rite degrees" (also ritual, Masons, temple, lodge, Valley), "Entered Apprentice", "Fellowcraft", "third degree Mason" (also first, second, 32nd, 33rd), "Master Mason degree" (also ceremony, ritual, lodge, oath), "Masonic Grand Lodge", "Masonic Knights Templar", "Knights Templar degrees", "Ancient Free and Accepted Masons"; and, added in part two, "join (or become) a Freemason" and "join the Masonic lodge", "why you should join (why I joined, why we joined) the Freemasons", "I am a Freemason", "proud (to be a) Freemason", "benefits of being a Freemason", "Masonic charity" (also charities, brotherhood, benevolence), and the defence "Freemasonry is not a religion (a cult)", "is a force for good", "is misunderstood", "is harmless".
  - Every 0.95 entry is guarded. The guard of the first round named a Catholic marker ("Catholic", "Church", "pope", "papal", "Vatican", "priest", "bishop", "cardinal", "encyclical", "Christian"). It did not know a Catholic warning that carries none of them: "Beware the Masonic lodge: initiation rites" was flagged at 0.95, and so was every title like it. In part two the guard also takes the plural markers ("popes", "bishops", "cardinals", "churches") and the words of warning and condemnation: "condemned", "forbidden", "excommunication", "warning", "beware", "danger", "heresy", "heretical", "sinful", "evil", "satanic", "occult", "anti-Masonic", "Humanum genus". A title that holds one of them falls to what the bare words give (0.75 for "Masonic" or "Freemasonry") and waits for the model. So "Why a Catholic cannot join the Masonic lodge", "A priest warns Catholics about the dangers of Freemasonry", "The Church and Masonic rituals" and "Beware the Masonic lodge" are not flagged by the words; "Join the Freemasons today", "Why you should join the Freemasons: the benefits of being a Mason" and "Masonic charity: how the lodge helps your community" are. The tests run these titles (tests/belief-rules.test.js, tests/anticatholic-rules.test.js).
  - At 0.75, topic words that Catholic talks, history and news also use: Freemason, Freemasonry, "free mason", Masonic, "Grand Lodge", "Scottish Rite" alone (also a children's hospital), "Blue Lodge", "Royal Arch Masons", "Order of the Eastern Star", and, added in part two, "join (or become) a mason" and "benefits of being a mason" (stone masonry: the model is asked, and the question excludes it). "Masonic symbols", "Masonic teaching" and "Masonic philosophy" are covered by the bare "Masonic" at 0.75: the model decides whether a video presents them as good. At 0.50: "Masonic Temple" (also a concert hall), "Master Mason" alone (also a skilled stonemason), "square and compasses". At 0.15: "secret society".
  - Not cues, on purpose: "mason" and "masonry" (stone masonry: "stone mason", "masonry wall", "mason jar"), the medieval Knights Templar (only the Masonic degrees are), and any word of conspiracy theory; no cue names a person and none is derogatory. The tests check the list for these words and run stone-masonry titles through it.
  - What did not change: the ten cues of lodge, rite and degree, the bare names at 0.75, and the surfaces (lists, recommended videos, video page).
- Known false alarms (the rule author accepts them, as he asked for the contents):
  - A video that shows a rite, a degree or a lodge without any word of warning or any Catholic marker is flagged at 0.95 whoever made it: "Masonic rituals revealed", an exposé by an ex-Mason, is content of the Craft and is flagged.
  - "Masonic charity" in a news item about a donation is flagged: the class forbids presenting the sects as useful.
  - A Mason's own video that holds a guard word ("danger", "evil", "Catholic") falls to the model, which may let it pass.
  - "Join the masons" and "benefits of being a mason" in a video about the building trade wait for the model.
- Default: Enabled, by the decision of the rule author (2026-11-26).
- Lexicon: freemasonry_cues (31 entries): 17 at 0.95, 10 at 0.75, 3 at 0.5, 1 at 0.15.

### communism: Socialism and Communism (enabled) {#communism}

- Rule (as shipped): where feed-card, related, comment, watch-meta; flag at 0.80; gate lexicon; lexicon communism_cues, index_socialists; action feed-card=blank, watch-meta=warn-overlay (a comment is blurred). Group anticatholic. The settings page shows it as "Communism and socialism".
- Question: Does this teach, praise or promote Communism, Marxism or socialism (the class struggle, the dictatorship of the proletariat, the Party or the Soviet state) as good or true, and not warn against it from a Catholic viewpoint, tell its history, document its crimes or honour its victims?
- Source: the texts of the Church below, and the rule author's decision of 2026-11-26 (part two) to apply them to videos ("anything to do with Communism"); not traced to a sermon. The `source:` line: `Holy Office decree of 1 July 1949 (AAS 41, p. 334); Syllabus of Errors, section IV (1864); Leo XIII, Quod apostolici muneris (1878); Pius XI, Divini Redemptoris 58 (1937); Catechism 2425. Applying them to videos is a choice of the rule author`
- Texts of the Church (read on 2026-11-26 on the pages named; each quotation was found by program in the text of the page, ignoring case and white space, and no quotation is longer than 40 words):
  - Holy Office, decree of 1 July 1949 (Acta Apostolicae Sedis 41, p. 334; Latin; the OCR text of https://www.vatican.va/archive/aas/documents/AAS-41-1949-ocr.pdf; a hyphen at the end of a printed line was joined). The second question asks: « utrum licitum sit edere, propagare vel legere libros, periodica, diaria vel folia, quae doctrinae vel actioni communistarum patrocinantur, vel in eis scribere » (English, working, literal: whether it is lawful to publish, spread or read books, periodicals, newspapers or leaflets that champion the doctrine or the action of the Communists, or to write in them). The answer: « Negative: prohibentur enim ipso iure (cfr. can. 1399 C. I. C.) » (No: they are forbidden by the law itself, see canon 1399). The reason, in the answer to the first question: « communismus enim est materialisticus et antichristianus » (for Communism is materialistic and anti-Christian).
    - The fourth question concerns the faithful « qui communistarum doctrinam materialisticam et antichristianam profitentur, et in primis qui eam defendunt vel propagant » (who profess the materialistic and anti-Christian doctrine of the Communists, and above all those who defend or spread it); the answer is « Affirmative » (an excommunication reserved to the Holy See). The decree is dated « Datum Romae, die 1 Iulii 1949 ». This is the text that ties Communism to canon 1399, and its word is "patrocinantur": what champions the doctrine. The penalty is no longer law (the Index file says that canons 1399 and 2318 lost their force on 15 November 1966); the rule does not depend on the penalty.
  - Syllabus of Errors (Pius IX, 1864), section IV. The Latin heading, in the text of Quanta cura on vatican.va (https://www.vatican.va/content/pius-ix/la/documents/encyclica-quanta-cura-8-decembris-1864.html): « § IV. Socialismus, Communismus, Societates clandestinae, Societates biblicae, Societates clerico-liberales »; and in the encyclical itself: « funestissimum Communismi et socialismi docentes ac profitentes errorem » (the most deadly error of those who teach and profess Communism and socialism). The English of the Syllabus is that of https://www.papalencyclicals.net/pius09/p9syll.htm (the page that this file already uses; the Vatican's own page of it was not read in English): « IV. SOCIALISM, COMMUNISM, SECRET SOCIETIES, BIBLICAL SOCIETIES, CLERICO-LIBERAL SOCIETIES. Pests of this kind are frequently reprobated in the severest terms in the Encyclical "Qui pluribus," Nov. 9, 1846 ». Qui pluribus (English, https://www.papalencyclicals.net/pius09/p9quiplu.htm): « the unspeakable doctrine of Communism, as it is called, a doctrine most opposed to the very natural law ».
  - Leo XIII, Quod apostolici muneris (28 December 1878), vatican.va (https://www.vatican.va/content/leo-xiii/en/encyclicals/documents/hf_l-xiii_enc_28121878_quod-apostolici-muneris.html), the opening: « that sect of men who, under various and almost barbarous names, are called socialists, communists, or nihilists »
  - Pius XI, Quadragesimo anno (15 May 1931), 120, vatican.va (https://www.vatican.va/content/pius-xi/en/encyclicals/documents/hf_p-xi_enc_19310515_quadragesimo-anno.html): « Religious socialism, Christian socialism, are contradictory terms; no one can be at the same time a good Catholic and a true socialist. »
  - Pius XI, Divini Redemptoris (19 March 1937), vatican.va (https://www.vatican.va/content/pius-xi/en/encyclicals/documents/hf_p-xi_enc_19370319_divini-redemptoris.html), 58: « Communism is intrinsically wrong, and no one who would save Christian civilization may collaborate with it in any undertaking whatsoever. » The words that the encyclical itself uses for the doctrine: « bolshevistic and atheistic Communism » (3), « dialectical and historical materialism previously advocated by Marx » (9), « the class struggle » (9), « this Utopia of a really classless society » (13).
  - Catechism of the Catholic Church 2425 (vatican.va, https://www.vatican.va/archive/ENG0015/__P8C.HTM): « The Church has rejected the totalitarian and atheistic ideologies associated in modem times with "communism" or "socialism." » (the page prints "modem" for "modern").
  - The Message of Fatima (Congregation for the Doctrine of the Faith, 26 June 2000, https://www.vatican.va/roman_curia/congregations/cfaith/documents/rc_con_cfaith_doc_20000626_message-fatima_en.html), Sister Lucia's account of the apparition of 13 July 1917: « If my requests are heeded, Russia will be converted, and there will be peace; if not, she will spread her errors throughout the world, causing wars and persecutions of the Church. »
- Why the English rule matches:
  - The rule author's reading, the one of the decree: what champions, teaches or defends Communism or socialism is flagged; what warns against it from the Catholic side is not. Fatima's "errors of Russia", Divini Redemptoris, a history of the Cold War, a documentary on the martyrs under Communism wait for the model or the slider and never reach 0.95.
  - The 0.95 tier holds slogans and flat statements: "workers of the world unite" (also "proletarians of all countries unite"), "long live communism" (also socialism, Marxism, the Communist Party, the revolution), "communism works" (also will win, is the answer, is the solution, is the future, is inevitable, is right; for socialism and Marxism too), "why communism works" (also is right, is good, is better, will win, is the answer, is the future), "the case for communism", "in defence of communism", "why I am a communist", "join the Communist Party" (also become a communist or a Marxist), "seize the means of production". Each is guarded as the Freemasonry cues are (a Catholic marker, a martyr, persecution, a condemnation, a warning, "victims", "crimes", "gulag", "failed" and the like), and has a 0.75 sibling without the guard.
  - At 0.75 (the model decides): Marxism, Marxist, Leninism, Leninist, Maoism, Maoist, Trotskyism, dialectical materialism, historical materialism, class struggle, class war, classless society, dictatorship of the proletariat, the Communist Manifesto, Das Kapital, scientific socialism, democratic socialism, socialist (communist, proletarian) revolution, revolutionary socialism, abolition (abolish) of private property, "Christian socialism", "religious socialism", "Catholic socialism", "Karl Marx". At 0.50, below the model band, so that a news item, a history or a Catholic talk does not reach the model at the default setting: communism, communist, socialism, socialist, the Communist Party, bolshevism, Stalinism, proletariat, bourgeoisie, "means of production", "Friedrich Engels". At 0.15: comrade, soviet.
  - The words that the Church texts above use are cues because they are the Church's own names for the doctrine (dialectical and historical materialism, class struggle, classless society, proletariat, bolshevism, atheistic Communism, socialists and communists); the slogans and the wording of the 0.95 tier are the list author's choice. No cue is a derogatory name. Only two persons are named, Marx and Engels, the authors of the doctrine, whom the Index does not name (its introduction: "Karl Marx, Charles Darwin and Friedrich Nietzsche are not named in it"); no private person is named.
  - The list index_socialists holds the five socialists that the Index names (Proudhon, Fourier, Cabet, Considerant, Enfantin), all at 0.75, so that a Catholic refutation is judged by the model and not flagged by the name. The Index prints five lines that name socialism or the social question in their title and none that names Communism.
  - A question ("Does communism work?") is not matched by the 0.95 tier; a title that quotes a slogan to answer it is flagged unless it holds a guard word.
- Known false alarms: a news item or a lecture that quotes a slogan without a guard word ("Workers of the world, unite! the history of a slogan") is flagged; "socialism" in the title of a Catholic social teaching lecture waits at 0.50 and is not flagged; "means of production" in an economics course is below the band; a comment that quotes the slogan is blurred.
- Default: Enabled, by the decision of the rule author (2026-11-26, part two).
- Lexicon: communism_cues (52 entries): 10 at 0.95, 28 at 0.75, 12 at 0.5, 2 at 0.15.
  - index_socialists (9 entries): 9 at 0.75.

### modernism: Modernism, the synthesis of all heresies (enabled) {#modernism}

- Rule (as shipped): where feed-card, related, comment, watch-meta; flag at 0.80; gate lexicon; lexicon modernism_cues; action feed-card=blank, watch-meta=warn-overlay (a comment is blurred). Group anticatholic. The settings page shows it as "Modernism".
- Question: Does this teach or defend the errors that Pius X condemned as Modernism (that dogma evolves and changes its meaning, that faith is only a feeling, that the Church must change its teaching with the times), and not explain or warn against them from a Catholic viewpoint, or discuss the genuine development of doctrine?
- Source: Pius X, Pascendi dominici gregis (1907), and the rule author's decision of 2026-11-26 (part two) to apply it to videos; not traced to a sermon. The `source:` line: `Pius X, Pascendi dominici gregis (1907); canon 1399, 6. Applying them to videos is a choice of the rule author`. Canon 1399, class 6, in the words of the Index. Quote (forbidden.md): “Books that attack or ridicule a Catholic dogma, defend errors condemned by the Holy See, disparage divine worship, try to overthrow the discipline of the Church, or of set purpose insult the hierarchy, the clerical or the religious state.”
- Church text it follows (English, vatican.va, https://www.vatican.va/content/pius-x/en/encyclicals/documents/hf_p-x_enc_19070908_pascendi-dominici-gregis.html; read on 2026-11-26, each quotation found by program ignoring case and white space; the number is the paragraph):
  - 39: « can anybody who takes a survey of the whole system be surprised that We should define it as the synthesis of all heresies? »
  - 6: « Modernists place the foundation of religious philosophy in that doctrine which is usually called Agnosticism »; 7: « the positive side of it consists in what they call vital immanence »; 10: « the religious sentiment , which through the agency of vital immanence emerges from the lurking places of the subconsciousness, is the germ of all religion » (the page prints a space before the comma).
  - 13: « Thus the way is open to the intrinsic evolution of dogma. » and « Dogma is not only able, but ought to evolve and to be changed. »
  - 28: « for the Modernists, both as authors and propagandists, there is to be nothing stable, nothing immutable in the Church »; 23: « It is for the ecclesiastical authority, therefore, to shape itself to democratic forms »; 30: « between the Christ of history and the Christ of faith ».
  - Lamentabili sane exitu (the decree of the Holy Office of 1907) was read in English on papalencyclicals.net only, not on vatican.va, and is not cited.
- Why the English rule matches:
  - The rule looks for the doctrine that Pius X named: that dogma evolves and changes its meaning, that faith is a feeling that rises from within, that the Church must change its teaching with the times. The cue words that the encyclical itself uses are "vital immanence", "religious sentiment", "evolution of dogma", "the Christ of history and the Christ of faith", "agnosticism" and "democratic forms"; the 0.95 tier is the list author's wording of the same claims in the words of today. The authors of the movement are in the rule index_modernists.
  - The 0.95 tier holds four patterns: "dogma (doctrine) evolves" (also keeps evolving, must evolve, should evolve), "evolution of dogma (of doctrine)", "the Church must (needs to, has to, should) change (evolve, move, keep up, catch up) with the times", and "the Church must change (update, revise, rewrite, drop, abandon) its teaching (doctrine, dogma, position)". A question is not matched: "Does doctrine evolve?", "Can the Church change its teaching?" and "How doctrine evolves" are spared by a short lookbehind in front of the first pattern and by the verbs of the others. The guard drops to the bare words any title that holds "modernism", "modernist", "Pascendi", "Lamentabili", "Pius X", "condemned", "heresy", "errors", "warning", "tradition", "development" or "Newman": a Catholic warning against Modernism is not Modernism, and the Catholic idea of the development of doctrine (Newman, Vincent of Lerins) is not a cue.
  - At 0.75 (the model decides): "vital immanence", "the Christ of faith", "the Jesus of history", "Catholic modernism", "the modernist crisis", "neo-modernism", "liberal Catholicism", "non-dogmatic Christianity", "democratize the Church", "dogma is not fixed (final, absolute, immutable)", "dogma is a symbol (a human construct)", "faith is a feeling (an experience, a sentiment)", and "the Church must adapt (change, evolve) to the modern world (modern times, today's world)", which an orthodox title about methods can also use. At 0.50: modernism, modernist, "religious sentiment", "the historical Jesus", "higher criticism", "biblical criticism", "progressive Catholic" (art, architecture and literature use "modernism" too, and Catholic critics use it constantly). At 0.15: agnosticism, "religious experience".
  - A sibling at 0.75 without the guard sees to it that a title with a Catholic marker still reaches the model.
- Known false alarms: "Dogma evolves, says the cardinal: reaction" (a news item) is flagged; "the Church needs to adapt to the modern world" waits for the model; a talk on "evolution of doctrine" without a guard word is flagged.
- Default: Enabled, by the decision of the rule author (2026-11-26, part two).
- Lexicon: modernism_cues (29 entries): 4 at 0.95, 16 at 0.75, 7 at 0.5, 2 at 0.15.

### spiritism: Spiritism and the calling up of spirits (enabled) {#spiritism}

- Rule (as shipped): where feed-card, related, comment, watch-meta; flag at 0.80; gate lexicon; lexicon spiritism_cues, index_spiritists; action feed-card=blank, watch-meta=warn-overlay (a comment is blurred). Group anticatholic. The settings page shows it as "Spiritism".
- Question: Does this teach, practise or promote Spiritism, mediumship or contact with the dead as real or good, and not warn against it from a Catholic viewpoint, tell its history or tell a ghost story as fiction?
- Source: the Holy Office, the Catechism of St. Pius X and canon 1399, 7, and the rule author's decision of 2026-11-26 (part two) to apply them to videos; not traced to a sermon. The `source:` line: `Holy Office, De spiritismo, 24 April 1917 (AAS 9, p. 268); Catechism of St. Pius X (First Commandment); canon 1399, 7; the Index (Kardec, 1864). Applying them to videos is a choice of the rule author`
- Texts (read on 2026-11-26 on the pages or in the files named):
  - Holy Office, decision De spiritismo (plenary session of 24 April 1917, approved by Benedict XV, « Datum Romae, ex aedibus Sancti Officii, die 27 aprilis 1917 »; Acta Apostolicae Sedis 9, p. 268; Latin; the OCR text of https://www.vatican.va/archive/aas/documents/AAS-09-I-1917-ocr.pdf). Asked: « An liceat per Medium, ut vocant, vel sine Medio, adhibito vel non hypnotismo, locutionibus aut manifestationibus spiritisticis quibuscumque adsistere, etiam speciem honestatis vel pietatis praeseferentibus, sive interrogando animas aut spiritus, sive audiendo responsa, sive tantum aspiciendo » (English, working, literal: whether it is lawful to be present at any spiritistic talk or manifestation, with a medium or without, with hypnotism or without, even when it has the look of honesty or piety, whether by questioning souls or spirits, by listening to the answers, or only by looking on). The answer: « Negative in omnibus » (No, in everything).
  - The Catechism of St. Pius X, First Commandment (the file `docs/en/st-pius-x/catechism.md`):
    - Quote (catechism.md): “Is it lawful to put questions to speaking or writing tables or in any way to consult the souls of the dead by means of spiritism?”
    - Quote (catechism.md): “All the practices of spiritism are unlawful, because they are superstitious; and often they are not free from diabolical intervention; and hence they are rightly condemned by the Church.”
  - Canon 1399, class 7, in the words of the Index. Quote (forbidden.md): “Books that teach or recommend superstition, fortune-telling, divination, magic, the calling up of spirits and the like.”
  - The Index prints Allan Kardec: « Le livre des esprits contenant les principes de la doctrine spirite » (1864, under the heading "Denizart-Rivail, Hippolyte-Léon", with the pseudonym "Kardec, Allan"; L2636 to L2640 of the file), « Le livre des médiums, ou guide des médiums et des évocateurs », « Le spiritisme à sa plus simple expression », and the periodicals « Revue spirite, journal d’études psychologiques publie sous la direction de m. Allan Kardec » and « Revue spiritualiste » (both 1864), « Le magnétiseur spiritualiste » (1851), and books on the same subject by Guldenstubbe (1874), Cahagnet (1851), Coreni (1890) and Jésupret (1892).
- Why the English rule matches:
  - The decision of 1917 forbids even to be present, "or only to look on"; the rule looks at what teaches, practises or promotes Spiritism and spares what warns against it. The question ends with the Catholic cases (a warning, a history, a ghost story as fiction).
  - Spiritism is its own rule and not a part of `occult`: it is a codified doctrine with books named by the Index, the occult list has 44 entries (a test caps the lists of the first round at 45), and a separate switch lets a viewer keep the occult filter and drop this one or the other way round. It is not a part of `divination` either, which is off: seances, Ouija, psychics, spirit mediums and channeling stay in divination_cues (disabled) and spirit guides in occult_cues; nothing of them is repeated here. To filter séances too, switch divination on.
  - The 0.95 tier holds a spiritist or spiritualist centre, church, society, meeting or doctrine ("Spiritist center in Sao Paulo", "Spiritualist church service") and a lesson in speaking with the dead ("how to communicate with the dead"), guarded by a Catholic marker, a priest, a warning, a condemnation, or a word of fiction ("film", "movie", "game", "novel", "horror"), with a 0.75 sibling. At 0.75 (the model decides): Spiritism, Spiritist, mediumship, mediumistic, "spirit communication", "spirit contact", table turning, table tipping, "speaking tables" (the Catechism's word), planchette, and the phrases "talk (speak, communicate) with the dead (the departed, spirits)", "contact (consult) the dead" and "call up (conjure, evoke, invoke) the dead (spirits)". At 0.50: spiritualism, spiritualist (philosophy and the Fox sisters use them), "spirit world", "automatic writing" (surrealism), necromancy (games). At 0.15: necromancer.
  - index_spiritists: the names and titles of the Index in the paragraph above, all at 0.75, so that a Catholic refutation of Kardec is judged by the model and the name alone does not flag it.
- Known false alarms: a priest's warning without any Catholic marker or word of warning ("Spiritist center visit: what I saw") is flagged; praying for the dead is not matched (no cue); a grief video that says "talking to the dead" waits for the model; fiction without the guard words is flagged.
- Default: Enabled, by the decision of the rule author (2026-11-26, part two).
- Lexicon: spiritism_cues (23 entries): 3 at 0.95, 14 at 0.75, 5 at 0.5, 1 at 0.15.
  - index_spiritists (12 entries): 12 at 0.75.

### index_freethinkers: Books that attack religion or insult the clergy (enabled) {#index_freethinkers}

- Rule (as shipped): where feed-card, related, watch-meta; flag at 0.80; gate lexicon; lexicon index_freethinkers; action feed-card=blank, watch-meta=warn-overlay. Group anticatholic. The settings page shows it as "Anti-religious writers".
- Question: Is this video about the books or ideas of writers who attacked religion and the clergy and were put on the Index of Forbidden Books (for example Voltaire, d'Holbach, Michelet or Draper): a reading, a summary, an analysis or an explanation of what they wrote, and not about the life of the person or the history of his time, nor about a place, a school, a street or something else of the same name?
  gate: lexicon
  confirm: model
  spare words: life_words
  flag at: 0.80
  action: feed-card=blank, watch-meta=warn-overlay
  enabled: true

rule index_jesus_critics
  title: Rationalist lives of Jesus
  name: Critical lives of Jesus
  plain: Flags videos about rationalist lives of Jesus and the books of their authors, such as Renan and Strauss. Not the life of the author.
  group: anticatholic
  example: Ernest Renan's Life of Jesus: a summary
  example: David Friedrich Strauss and the myth of the Gospels
  example: Kazantzakis and the Last Temptation of Christ: the novel behind the film
  spared: Renan vs Neymar: football highlights of the week
  spared: Strauss: Also sprach Zarathustra with the Vienna Philharmonic
  spared: Ernest Renan: his life, from the seminary to the Collège de France
  source: Index of Forbidden Books (1948 and the decrees to 1961), canon 1399, 2, 3 and 6. The categories are a choice of the rule author
  where: feed-card, related, watch-meta
  lexicon: index_jesus_critics
  ask noul: Is this video about a rationalist or critical life of Jesus that the Index named (for example by Renan, Strauss, Steinmann or Kazantzakis): its text, its argument or its story, and not about the life of its author or the history of his time, nor about something else of the same name?
  gate: lexicon
  confirm: model
  spare words: life_words
  flag at: 0.80
  action: feed-card=blank, watch-meta=warn-overlay
  enabled: true

rule index_modernists
  title: Authors and books of the Modernist movement
  name: Modernists on the Index
  plain: Flags videos about the books and ideas of the authors of the Modernist movement whom the Index named, such as Loisy and Fogazzaro. Not their lives.
  group: anticatholic
  example: Alfred Loisy and the Gospel and the Church: a modernist priest
  example: Fogazzaro's The Saint: the novel the Church forbade
  example: George Tyrrell's modernist theology: a lecture on his books
  spared: Pascendi dominici gregis: Pius X on the errors of Modernism
  spared: The Murri people of Queensland: history and culture
  spared: Alfred Loisy: his life and his excommunication
  source: Index of Forbidden Books (1948 and the decrees to 1961), canon 1399, 2 and 6. The categories are a choice of the rule author
  where: feed-card, related, watch-meta
  lexicon: index_modernists
  ask noul: Is this video about the books or ideas of an author of the Modernist movement whom the Index of Forbidden Books named (for example Loisy, Murri, Buonaiuti, Fogazzaro or Tyrrell), and not about the life of the person or the history of the crisis, nor about a place, a person of the same name or an unrelated work?
  gate: lexicon
  confirm: model
  spare words: life_words
  flag at: 0.80
  action: feed-card=blank, watch-meta=warn-overlay
  enabled: true

rule index_philosophers
  title: Philosophers who undermine the foundations of religion
  name: Philosophers on the Index
  plain: Flags videos about the ideas and books of philosophers whom the Index named, such as Kant, Hume and Spinoza. Not their lives.
  group: anticatholic
  example: Immanuel Kant explained in ten minutes
  example: Spinoza's Ethics: a beginner's guide
  example: Hume on miracles: a lecture
  spared: Calvin and Hobbes: the best strips of the year
  spared: Hume Highway road trip: Sydney to Melbourne
  spared: David Hume's Influence on John Henry Newman @ Ascent of Mount Carmel
  spared: The life of David Hume: a short biography
  source: Index of Forbidden Books (1948 and the decrees to 1961), canon 1399, 2 and 3. The categories are a choice of the rule author
  where: feed-card, related, watch-meta
  lexicon: index_philosophers
  ask noul: Is this video about the ideas or books of a philosopher whom the Index of Forbidden Books named (for example Kant, Hume, Spinoza, Locke, Rousseau or Sartre): a reading, an explanation, an analysis or a debate of what he wrote, and not about the life of the person or the history of his influence on others, nor about a place, a school, a street or something else of the same name?
  gate: lexicon
  confirm: model
  spare words: life_words
  flag at: 0.80
  action: feed-card=dim, watch-meta=label
  enabled: false

rule index_historians
  title: Historians whose books were forbidden
  name: Historians on the Index
  plain: Flags videos about the history books of historians whom the Index named, such as Gibbon and Ranke. Not their lives.
  group: anticatholic
  example: Edward Gibbon and the fall of Rome: a lecture
  example: Gibbon's Decline and Fall: the audiobook
  example: Leopold von Ranke and the history of the popes
  spared: The decline and fall of the Roman Empire: a documentary
  spared: Gibbons at the zoo: how the apes swing
  spared: Edward Gibbon: his life, from Magdalen College to Lausanne
  source: Index of Forbidden Books (1948 and the decrees to 1961), canon 1399, 2, 3 and 6. The categories are a choice of the rule author
  where: feed-card, related, watch-meta
  lexicon: index_historians
  ask noul: Is this video about the history books of a historian whom the Index of Forbidden Books named (for example Gibbon or Ranke), or about the history as he tells it, and not about the life of the historian, nor about a place, a school, an animal or something else of the same name?
  gate: lexicon
  confirm: model
  spare words: life_words
  flag at: 0.80
  action: feed-card=dim, watch-meta=label
  enabled: false

rule index_novelists
  title: Novels forbidden by name
  name: Novelists on the Index
  plain: Flags videos about the novels, plays and poems of writers whom the Index named, such as Hugo, Balzac and Flaubert, and their adaptations. Not their lives.
  group: anticatholic
  example: Victor Hugo's Les Misérables: the full audiobook
  example: Madame Bovary: summary and analysis
  example: Honoré de Balzac and the human comedy
  spared: Notre-Dame de Paris: the fire and the rebuilding of the cathedral
  spared: George Sanders: the actor's best roles
  spared: Zola Budd: the runner's story
  spared: Victor Hugo in exile on Guernsey: his years in the Channel Islands
  spared: Honoré de Balzac was born in Tours: his early life
  source: Index of Forbidden Books (1948 and the decrees to 1961), canon 1399, 3 and 9. The categories are a choice of the rule author
  where: feed-card, related, watch-meta
  lexicon: index_novelists
  ask noul: Is this video about the novels, plays or poems of a writer whom the Index of Forbidden Books named (for example Hugo, Balzac, Flaubert, Zola, Gide or Sartre), or about adaptations of them, and not about the life of the writer, nor about a place, a street, a school or something else of the same name?
  gate: lexicon
  confirm: model
  spare words: life_words
  flag at: 0.80
  action: feed-card=dim, watch-meta=label
  enabled: false

- Source: the Index of Forbidden Books and canon 1399, classes 3 and 6 (books that of set purpose attack religion; books that of set purpose insult the hierarchy, the clerical or the religious state); the categories are the rule author's own (the Index is alphabetical). The `source:` line: `Index of Forbidden Books (1948 and the decrees to 1961), canon 1399, 3 and 6. The categories are a choice of the rule author`
- What it flags: a video ABOUT writers whose books attack religion or the clergy (a reading, a summary, an analysis, an explanation, an adaptation or a debate of what they wrote), not their lives: the rule author's words, "videos discussing these kinds of banned book authors". A Catholic critique of one of them is flagged too; a namesake is not, and neither is a video about the LIFE of the person or the history of his influence: the owner, on seeing "David Hume's Influence on John Henry Newman" from a Catholic channel flagged: "it's about the life of the person David Hume (historical), not 'opera omnia' (his works), that's the difficulty". The words of a life (life_words: biography, born, died, exile, "influence on", ...) lower a strong hit so that the model decides, and the rule has `confirm: model`, so that a model that is there also checks the hits that carry no such word.
- The names: Voltaire (heading L9088: "Candide", the "Dictionnaire philosophique", the "Traité sur la tolérance"), the Baron d'Holbach (L2714: "Le christianisme dévoilé", "La contagion sacrée"), Volney, Dupuis ("Origine de tous les cultes"), Michelet, Llorente (the history of the Spanish Inquisition), John William Draper (the "History of the Conflict between Religion and Science"), Bernard Mandeville ("The Fable of the Bees"), Jean Meslier. I put Voltaire here and not among the philosophers, where the rule author's brief listed him, because the Index entries of Voltaire are plainly against religion ("Évangile de la raison", "Catéchisme de l'honnête-homme", "Testament de Jean Meslier"), and the rule author's brief says that the categories that attack the faith directly are on. Every name and every title is under an author heading of `docs/en/holy-office/forbidden.md`, as the Index prints it; `tests/index-names.test.js` checks it, and `research/index-of-forbidden-books.md` gives the heading and the line of each.
- Known false alarms: "Voltaire the French bulldog" and "Rue Voltaire" (bare surname at 0.75: the model decides), "Voltaire Network", a street, a school or a hotel named after an author (the pattern stands down), "Michelet" the street. A video by a Catholic against Voltaire is flagged, by the rule author's reading. "La Pucelle d'Orléans" is not a cue: it is also St. Joan's title in French.
- Default: Enabled, by the decision of the rule author: the writers whose books attack the faith directly are on.
- Lexicon: index_freethinkers (37 entries): 19 at 0.95, 15 at 0.75, 3 at 0.5.

### index_jesus_critics: Rationalist lives of Jesus (enabled) {#index_jesus_critics}

- Rule (as shipped): where feed-card, related, watch-meta; flag at 0.80; gate lexicon; lexicon index_jesus_critics; action feed-card=blank, watch-meta=warn-overlay. Group anticatholic. The settings page shows it as "Critical lives of Jesus".
- Question: Is this video about a rationalist or critical life of Jesus that the Index named (for example by Renan, Strauss, Steinmann or Kazantzakis): its text, its argument or its story, and not about the life of its author or the history of his time, nor about something else of the same name?
  gate: lexicon
  confirm: model
  spare words: life_words
  flag at: 0.80
  action: feed-card=blank, watch-meta=warn-overlay
  enabled: true

rule index_modernists
  title: Authors and books of the Modernist movement
  name: Modernists on the Index
  plain: Flags videos about the books and ideas of the authors of the Modernist movement whom the Index named, such as Loisy and Fogazzaro. Not their lives.
  group: anticatholic
  example: Alfred Loisy and the Gospel and the Church: a modernist priest
  example: Fogazzaro's The Saint: the novel the Church forbade
  example: George Tyrrell's modernist theology: a lecture on his books
  spared: Pascendi dominici gregis: Pius X on the errors of Modernism
  spared: The Murri people of Queensland: history and culture
  spared: Alfred Loisy: his life and his excommunication
  source: Index of Forbidden Books (1948 and the decrees to 1961), canon 1399, 2 and 6. The categories are a choice of the rule author
  where: feed-card, related, watch-meta
  lexicon: index_modernists
  ask noul: Is this video about the books or ideas of an author of the Modernist movement whom the Index of Forbidden Books named (for example Loisy, Murri, Buonaiuti, Fogazzaro or Tyrrell), and not about the life of the person or the history of the crisis, nor about a place, a person of the same name or an unrelated work?
  gate: lexicon
  confirm: model
  spare words: life_words
  flag at: 0.80
  action: feed-card=blank, watch-meta=warn-overlay
  enabled: true

rule index_philosophers
  title: Philosophers who undermine the foundations of religion
  name: Philosophers on the Index
  plain: Flags videos about the ideas and books of philosophers whom the Index named, such as Kant, Hume and Spinoza. Not their lives.
  group: anticatholic
  example: Immanuel Kant explained in ten minutes
  example: Spinoza's Ethics: a beginner's guide
  example: Hume on miracles: a lecture
  spared: Calvin and Hobbes: the best strips of the year
  spared: Hume Highway road trip: Sydney to Melbourne
  spared: David Hume's Influence on John Henry Newman @ Ascent of Mount Carmel
  spared: The life of David Hume: a short biography
  source: Index of Forbidden Books (1948 and the decrees to 1961), canon 1399, 2 and 3. The categories are a choice of the rule author
  where: feed-card, related, watch-meta
  lexicon: index_philosophers
  ask noul: Is this video about the ideas or books of a philosopher whom the Index of Forbidden Books named (for example Kant, Hume, Spinoza, Locke, Rousseau or Sartre): a reading, an explanation, an analysis or a debate of what he wrote, and not about the life of the person or the history of his influence on others, nor about a place, a school, a street or something else of the same name?
  gate: lexicon
  confirm: model
  spare words: life_words
  flag at: 0.80
  action: feed-card=dim, watch-meta=label
  enabled: false

rule index_historians
  title: Historians whose books were forbidden
  name: Historians on the Index
  plain: Flags videos about the history books of historians whom the Index named, such as Gibbon and Ranke. Not their lives.
  group: anticatholic
  example: Edward Gibbon and the fall of Rome: a lecture
  example: Gibbon's Decline and Fall: the audiobook
  example: Leopold von Ranke and the history of the popes
  spared: The decline and fall of the Roman Empire: a documentary
  spared: Gibbons at the zoo: how the apes swing
  spared: Edward Gibbon: his life, from Magdalen College to Lausanne
  source: Index of Forbidden Books (1948 and the decrees to 1961), canon 1399, 2, 3 and 6. The categories are a choice of the rule author
  where: feed-card, related, watch-meta
  lexicon: index_historians
  ask noul: Is this video about the history books of a historian whom the Index of Forbidden Books named (for example Gibbon or Ranke), or about the history as he tells it, and not about the life of the historian, nor about a place, a school, an animal or something else of the same name?
  gate: lexicon
  confirm: model
  spare words: life_words
  flag at: 0.80
  action: feed-card=dim, watch-meta=label
  enabled: false

rule index_novelists
  title: Novels forbidden by name
  name: Novelists on the Index
  plain: Flags videos about the novels, plays and poems of writers whom the Index named, such as Hugo, Balzac and Flaubert, and their adaptations. Not their lives.
  group: anticatholic
  example: Victor Hugo's Les Misérables: the full audiobook
  example: Madame Bovary: summary and analysis
  example: Honoré de Balzac and the human comedy
  spared: Notre-Dame de Paris: the fire and the rebuilding of the cathedral
  spared: George Sanders: the actor's best roles
  spared: Zola Budd: the runner's story
  spared: Victor Hugo in exile on Guernsey: his years in the Channel Islands
  spared: Honoré de Balzac was born in Tours: his early life
  source: Index of Forbidden Books (1948 and the decrees to 1961), canon 1399, 3 and 9. The categories are a choice of the rule author
  where: feed-card, related, watch-meta
  lexicon: index_novelists
  ask noul: Is this video about the novels, plays or poems of a writer whom the Index of Forbidden Books named (for example Hugo, Balzac, Flaubert, Zola, Gide or Sartre), or about adaptations of them, and not about the life of the writer, nor about a place, a street, a school or something else of the same name?
  gate: lexicon
  confirm: model
  spare words: life_words
  flag at: 0.80
  action: feed-card=dim, watch-meta=label
  enabled: false

- Source: the Index of Forbidden Books and canon 1399, classes 2, 3 and 6 (books that defend heresy or undermine the foundations of religion; books that attack religion; books that attack a Catholic dogma); the categories are the rule author's own (the Index is alphabetical). The `source:` line: `Index of Forbidden Books (1948 and the decrees to 1961), canon 1399, 2, 3 and 6. The categories are a choice of the rule author`
- What it flags: a video ABOUT rationalist lives of Jesus and the authors who deny that he lived or was God (a reading, a summary, an analysis, an explanation, an adaptation or a debate of what they wrote), not their lives: the rule author's words, "videos discussing these kinds of banned book authors". A Catholic critique of one of them is flagged too; a namesake is not, and neither is a video about the LIFE of the person or the history of his influence: the owner, on seeing "David Hume's Influence on John Henry Newman" from a Catholic channel flagged: "it's about the life of the person David Hume (historical), not 'opera omnia' (his works), that's the difficulty". The words of a life (life_words: biography, born, died, exile, "influence on", ...) lower a strong hit so that the model decides, and the rule has `confirm: model`, so that a model that is there also checks the hits that carry no such word.
- The names: Ernest Renan (L7351; 19 lines, "Vie de Jésus", 1863), David Friedrich Strauss ("Das Leben Jesu", 1838), Jean Steinmann ("La Vie de Jésus", the last book put on the Index, 26 June 1961, L160), Nikos Kazantzakis (the decree of 12 January 1954, L113: the Index prints the Greek title and the German edition "Die letzte Versuchung"), Charles Guignebert, Paul-Louis Couchoud, Louis Jacolliot ("La Bible dans l'Inde", 1869). Every name and every title is under an author heading of `docs/en/holy-office/forbidden.md`, as the Index prints it; `tests/index-names.test.js` checks it, and `research/index-of-forbidden-books.md` gives the heading and the line of each.
- Known false alarms: "Renan Santos" and "Renan vs Neymar" (the first name; the surname alone is at 0.75 and the model decides), "Strauss: Also sprach Zarathustra" (no bare "Strauss"), the airport of Heraklion that bears Kazantzakis's name (0.75). "The Last Temptation of Christ", the film or the novel, is not matched unless the author's name is in the title: the Index does not print the English title (see the rule author's note on translations above).
- Default: Enabled, by the decision of the rule author: books that deny the divinity of Christ attack the faith directly, so the category is on.
- Lexicon: index_jesus_critics (26 entries): 9 at 0.95, 15 at 0.75, 2 at 0.5.

### index_modernists: Authors and books of the Modernist movement (enabled) {#index_modernists}

- Rule (as shipped): where feed-card, related, watch-meta; flag at 0.80; gate lexicon; lexicon index_modernists; action feed-card=blank, watch-meta=warn-overlay. Group anticatholic. The settings page shows it as "Modernists on the Index".
- Question: Is this video about the books or ideas of an author of the Modernist movement whom the Index of Forbidden Books named (for example Loisy, Murri, Buonaiuti, Fogazzaro or Tyrrell), and not about the life of the person or the history of the crisis, nor about a place, a person of the same name or an unrelated work?
  gate: lexicon
  confirm: model
  spare words: life_words
  flag at: 0.80
  action: feed-card=blank, watch-meta=warn-overlay
  enabled: true

rule index_philosophers
  title: Philosophers who undermine the foundations of religion
  name: Philosophers on the Index
  plain: Flags videos about the ideas and books of philosophers whom the Index named, such as Kant, Hume and Spinoza. Not their lives.
  group: anticatholic
  example: Immanuel Kant explained in ten minutes
  example: Spinoza's Ethics: a beginner's guide
  example: Hume on miracles: a lecture
  spared: Calvin and Hobbes: the best strips of the year
  spared: Hume Highway road trip: Sydney to Melbourne
  spared: David Hume's Influence on John Henry Newman @ Ascent of Mount Carmel
  spared: The life of David Hume: a short biography
  source: Index of Forbidden Books (1948 and the decrees to 1961), canon 1399, 2 and 3. The categories are a choice of the rule author
  where: feed-card, related, watch-meta
  lexicon: index_philosophers
  ask noul: Is this video about the ideas or books of a philosopher whom the Index of Forbidden Books named (for example Kant, Hume, Spinoza, Locke, Rousseau or Sartre): a reading, an explanation, an analysis or a debate of what he wrote, and not about the life of the person or the history of his influence on others, nor about a place, a school, a street or something else of the same name?
  gate: lexicon
  confirm: model
  spare words: life_words
  flag at: 0.80
  action: feed-card=dim, watch-meta=label
  enabled: false

rule index_historians
  title: Historians whose books were forbidden
  name: Historians on the Index
  plain: Flags videos about the history books of historians whom the Index named, such as Gibbon and Ranke. Not their lives.
  group: anticatholic
  example: Edward Gibbon and the fall of Rome: a lecture
  example: Gibbon's Decline and Fall: the audiobook
  example: Leopold von Ranke and the history of the popes
  spared: The decline and fall of the Roman Empire: a documentary
  spared: Gibbons at the zoo: how the apes swing
  spared: Edward Gibbon: his life, from Magdalen College to Lausanne
  source: Index of Forbidden Books (1948 and the decrees to 1961), canon 1399, 2, 3 and 6. The categories are a choice of the rule author
  where: feed-card, related, watch-meta
  lexicon: index_historians
  ask noul: Is this video about the history books of a historian whom the Index of Forbidden Books named (for example Gibbon or Ranke), or about the history as he tells it, and not about the life of the historian, nor about a place, a school, an animal or something else of the same name?
  gate: lexicon
  confirm: model
  spare words: life_words
  flag at: 0.80
  action: feed-card=dim, watch-meta=label
  enabled: false

rule index_novelists
  title: Novels forbidden by name
  name: Novelists on the Index
  plain: Flags videos about the novels, plays and poems of writers whom the Index named, such as Hugo, Balzac and Flaubert, and their adaptations. Not their lives.
  group: anticatholic
  example: Victor Hugo's Les Misérables: the full audiobook
  example: Madame Bovary: summary and analysis
  example: Honoré de Balzac and the human comedy
  spared: Notre-Dame de Paris: the fire and the rebuilding of the cathedral
  spared: George Sanders: the actor's best roles
  spared: Zola Budd: the runner's story
  spared: Victor Hugo in exile on Guernsey: his years in the Channel Islands
  spared: Honoré de Balzac was born in Tours: his early life
  source: Index of Forbidden Books (1948 and the decrees to 1961), canon 1399, 3 and 9. The categories are a choice of the rule author
  where: feed-card, related, watch-meta
  lexicon: index_novelists
  ask noul: Is this video about the novels, plays or poems of a writer whom the Index of Forbidden Books named (for example Hugo, Balzac, Flaubert, Zola, Gide or Sartre), or about adaptations of them, and not about the life of the writer, nor about a place, a street, a school or something else of the same name?
  gate: lexicon
  confirm: model
  spare words: life_words
  flag at: 0.80
  action: feed-card=dim, watch-meta=label
  enabled: false

- Source: the Index of Forbidden Books and canon 1399, classes 2 and 6; the Index itself names Modernism in the titles of eight lines (L528 "Modernismo: romanzo" 1914; L2083 "Der Modernisteneid" 1911; L6303 Murri, "La filosofia nuova e l'enciclica contro il modernismo" 1909; L7140 Prohászka, "Modern katholicizmus" 1911; L8500 "Uditore Heiner und der Antimodernisteneid" 1911; L9786 "Letters to his holiness pope Pius X, by a modernist" 1912; L9918 "The Priest; a tale of modernism in New England" 1912; L9920 "Il programma dei modernisti; risposta all'enciclica di Pio X 'Pascendi dominici gregis'" 1908); the categories are the rule author's own (the Index is alphabetical). The `source:` line: `Index of Forbidden Books (1948 and the decrees to 1961), canon 1399, 2 and 6. The categories are a choice of the rule author`
- What it flags: a video ABOUT the authors of the Modernist movement, as the standard histories count them (a reading, a summary, an analysis, an explanation, an adaptation or a debate of what they wrote), not their lives: the rule author's words, "videos discussing these kinds of banned book authors". A Catholic critique of one of them is flagged too; a namesake is not, and neither is a video about the LIFE of the person or the history of his influence: the owner, on seeing "David Hume's Influence on John Henry Newman" from a Catholic channel flagged: "it's about the life of the person David Hume (historical), not 'opera omnia' (his works), that's the difficulty". The words of a life (life_words: biography, born, died, exile, "influence on", ...) lower a strong hit so that the model decides, and the rule has `confirm: model`, so that a model that is there also checks the hits that carry no such word.
- The names: Alfred Loisy (L5314; 15 lines), Edouard Le Roy ("Dogme et critique"), Romolo Murri, Ernesto Buonaiuti, Lucien Laberthonnière, Antonio Fogazzaro ("Il santo"), Joseph Turmel (21 lines), Albert Houtin, Maude Petre and George Tyrrell (the title "Autobiography and life of George Tyrrell", 1913), and the one title of the Index that names the movement ("Il programma dei modernisti"). That these authors are the Modernists is the list author's judgment, not the Index's: the Index does not use the word for them. Left out because they are Catholic priests or laymen of good standing whom I did not want to flag (my judgment, not verified here): Prohászka, Brémond, Duchesne, Batiffol, Schell, Gallarati Scotti. Every name and every title is under an author heading of `docs/en/holy-office/forbidden.md`, as the Index prints it; `tests/index-names.test.js` checks it, and `research/index-of-forbidden-books.md` gives the heading and the line of each.
- Known false alarms: "The Murri people of Queensland" (0.50 only), "Loisy" the village (0.75), "Tyrrell" alone (0.50). "Pascendi dominici gregis: Pius X on the errors of Modernism" holds no cue of this rule (the rule modernism looks at the doctrine). A Catholic video about Loisy or Fogazzaro is flagged.
- Default: Enabled, by the decision of the rule author: the Modernist authors are on.
- Lexicon: index_modernists (38 entries): 16 at 0.95, 18 at 0.75, 4 at 0.5.

### index_philosophers: Philosophers who undermine the foundations of religion (disabled) {#index_philosophers}

- Rule (as shipped): where feed-card, related, watch-meta; flag at 0.80; gate lexicon; lexicon index_philosophers; action feed-card=dim, watch-meta=label. Group anticatholic. The settings page shows it as "Philosophers on the Index".
- Question: Is this video about the ideas or books of a philosopher whom the Index of Forbidden Books named (for example Kant, Hume, Spinoza, Locke, Rousseau or Sartre): a reading, an explanation, an analysis or a debate of what he wrote, and not about the life of the person or the history of his influence on others, nor about a place, a school, a street or something else of the same name?
  gate: lexicon
  confirm: model
  spare words: life_words
  flag at: 0.80
  action: feed-card=dim, watch-meta=label
  enabled: false

rule index_historians
  title: Historians whose books were forbidden
  name: Historians on the Index
  plain: Flags videos about the history books of historians whom the Index named, such as Gibbon and Ranke. Not their lives.
  group: anticatholic
  example: Edward Gibbon and the fall of Rome: a lecture
  example: Gibbon's Decline and Fall: the audiobook
  example: Leopold von Ranke and the history of the popes
  spared: The decline and fall of the Roman Empire: a documentary
  spared: Gibbons at the zoo: how the apes swing
  spared: Edward Gibbon: his life, from Magdalen College to Lausanne
  source: Index of Forbidden Books (1948 and the decrees to 1961), canon 1399, 2, 3 and 6. The categories are a choice of the rule author
  where: feed-card, related, watch-meta
  lexicon: index_historians
  ask noul: Is this video about the history books of a historian whom the Index of Forbidden Books named (for example Gibbon or Ranke), or about the history as he tells it, and not about the life of the historian, nor about a place, a school, an animal or something else of the same name?
  gate: lexicon
  confirm: model
  spare words: life_words
  flag at: 0.80
  action: feed-card=dim, watch-meta=label
  enabled: false

rule index_novelists
  title: Novels forbidden by name
  name: Novelists on the Index
  plain: Flags videos about the novels, plays and poems of writers whom the Index named, such as Hugo, Balzac and Flaubert, and their adaptations. Not their lives.
  group: anticatholic
  example: Victor Hugo's Les Misérables: the full audiobook
  example: Madame Bovary: summary and analysis
  example: Honoré de Balzac and the human comedy
  spared: Notre-Dame de Paris: the fire and the rebuilding of the cathedral
  spared: George Sanders: the actor's best roles
  spared: Zola Budd: the runner's story
  spared: Victor Hugo in exile on Guernsey: his years in the Channel Islands
  spared: Honoré de Balzac was born in Tours: his early life
  source: Index of Forbidden Books (1948 and the decrees to 1961), canon 1399, 3 and 9. The categories are a choice of the rule author
  where: feed-card, related, watch-meta
  lexicon: index_novelists
  ask noul: Is this video about the novels, plays or poems of a writer whom the Index of Forbidden Books named (for example Hugo, Balzac, Flaubert, Zola, Gide or Sartre), or about adaptations of them, and not about the life of the writer, nor about a place, a street, a school or something else of the same name?
  gate: lexicon
  confirm: model
  spare words: life_words
  flag at: 0.80
  action: feed-card=dim, watch-meta=label
  enabled: false

- Source: the Index of Forbidden Books and canon 1399, classes 2 and 3 (books that defend heresy or undermine the foundations of religion; books that attack religion); the categories are the rule author's own (the Index is alphabetical). The `source:` line: `Index of Forbidden Books (1948 and the decrees to 1961), canon 1399, 2 and 3. The categories are a choice of the rule author`
- What it flags: a video ABOUT philosophers who stood outside the Church or against it (a reading, a summary, an analysis, an explanation, an adaptation or a debate of what they wrote), not their lives: the rule author's words, "videos discussing these kinds of banned book authors". A Catholic critique of one of them is flagged too; a namesake is not, and neither is a video about the LIFE of the person or the history of his influence: the owner, on seeing "David Hume's Influence on John Henry Newman" from a Catholic channel flagged: "it's about the life of the person David Hume (historical), not 'opera omnia' (his works), that's the difficulty". The words of a life (life_words: biography, born, died, exile, "influence on", ...) lower a strong hit so that the model decides, and the rule has `confirm: model`, so that a model that is there also checks the hits that carry no such word.
- The names: Kant ("Kritik der reinen Vernunft", 1827), Hume (Opera omnia, 1761), Spinoza ("Tractatus theologico-politicus"), Locke (the "Essay concerning humane understanding" and "The reasonableness of Christianity"), Hobbes (Opera omnia, 1649), Rousseau ("Julie, ou la nouvelle Héloïse"), Montesquieu, Diderot, Bayle (Opera omnia), Grotius, Giordano Bruno (Opera omnia, 1600), Sartre (Opera omnia, 30 October 1948), Simone de Beauvoir ("Le deuxième sexe", 1956), Unamuno (1957), Bergson (1914), Croce and Gentile (Opera omnia, 1934), Comte, John Stuart Mill, Bentham, Berkeley, Helvétius, La Mettrie, Condorcet, Fontenelle. Left out: Descartes (all his lines are "donec corrigatur"), Bacon (the same), and the Catholic priests and laymen of the Index (Pascal, Malebranche, Fénelon, Montaigne, Condillac, Rosmini, Gioberti), by my judgment. Every name and every title is under an author heading of `docs/en/holy-office/forbidden.md`, as the Index prints it; `tests/index-names.test.js` checks it, and `research/index-of-forbidden-books.md` gives the heading and the line of each.
- Known false alarms: "Calvin and Hobbes" and "Locke & Key" (no bare "Hobbes" or "Locke"), "Hume Highway" and "Henri Rousseau" and "Paris Diderot University" (bare surnames at 0.75: the model decides), "Berkeley campus tour" (only "George Berkeley"), the Croce and Gentile namesakes ("Gentile" is also a word).
- Default: Disabled, a choice of the rule author: the broad philosophical category would flag many videos that are no attack on the faith, so it ships off; he can switch it on.
- Lexicon: index_philosophers (74 entries): 33 at 0.95, 40 at 0.75, 1 at 0.5.

### index_historians: Historians whose books were forbidden (disabled) {#index_historians}

- Rule (as shipped): where feed-card, related, watch-meta; flag at 0.80; gate lexicon; lexicon index_historians; action feed-card=dim, watch-meta=label. Group anticatholic. The settings page shows it as "Historians on the Index".
- Question: Is this video about the history books of a historian whom the Index of Forbidden Books named (for example Gibbon or Ranke), or about the history as he tells it, and not about the life of the historian, nor about a place, a school, an animal or something else of the same name?
  gate: lexicon
  confirm: model
  spare words: life_words
  flag at: 0.80
  action: feed-card=dim, watch-meta=label
  enabled: false

rule index_novelists
  title: Novels forbidden by name
  name: Novelists on the Index
  plain: Flags videos about the novels, plays and poems of writers whom the Index named, such as Hugo, Balzac and Flaubert, and their adaptations. Not their lives.
  group: anticatholic
  example: Victor Hugo's Les Misérables: the full audiobook
  example: Madame Bovary: summary and analysis
  example: Honoré de Balzac and the human comedy
  spared: Notre-Dame de Paris: the fire and the rebuilding of the cathedral
  spared: George Sanders: the actor's best roles
  spared: Zola Budd: the runner's story
  spared: Victor Hugo in exile on Guernsey: his years in the Channel Islands
  spared: Honoré de Balzac was born in Tours: his early life
  source: Index of Forbidden Books (1948 and the decrees to 1961), canon 1399, 3 and 9. The categories are a choice of the rule author
  where: feed-card, related, watch-meta
  lexicon: index_novelists
  ask noul: Is this video about the novels, plays or poems of a writer whom the Index of Forbidden Books named (for example Hugo, Balzac, Flaubert, Zola, Gide or Sartre), or about adaptations of them, and not about the life of the writer, nor about a place, a street, a school or something else of the same name?
  gate: lexicon
  confirm: model
  spare words: life_words
  flag at: 0.80
  action: feed-card=dim, watch-meta=label
  enabled: false

- Source: the Index of Forbidden Books and canon 1399, classes 2, 3 and 6 (books that defend heresy or undermine the foundations of religion; books that attack religion; books that insult the hierarchy); the categories are the rule author's own (the Index is alphabetical). The `source:` line: `Index of Forbidden Books (1948 and the decrees to 1961), canon 1399, 2, 3 and 6. The categories are a choice of the rule author`
- What it flags: a video ABOUT historians whose histories of the Church, of the popes or of the ancient world the Index forbade (a reading, a summary, an analysis, an explanation, an adaptation or a debate of what they wrote), not their lives: the rule author's words, "videos discussing these kinds of banned book authors". A Catholic critique of one of them is flagged too; a namesake is not, and neither is a video about the LIFE of the person or the history of his influence: the owner, on seeing "David Hume's Influence on John Henry Newman" from a Catholic channel flagged: "it's about the life of the person David Hume (historical), not 'opera omnia' (his works), that's the difficulty". The words of a life (life_words: biography, born, died, exile, "influence on", ...) lower a strong hit so that the model decides, and the rule has `confirm: model`, so that a model that is there also checks the hits that carry no such word.
- The names: Edward Gibbon ("The history of the decline and fall of the roman empire", 1783), Leopold von Ranke ("Die römischen Päpste", 1841), Paolo Sarpi ("Historia del concilio tridentino"; the Index prints it under the heading "Sarpi Paolo", L7850, and the other lines under "Sarpi, Paolo", L7854), Gregorovius, Sismondi, William Roscoe ("The life and pontificate of Leo the tenth"), Henry Hallam, Hippolyte Taine, Johann Joseph Ignaz von Döllinger. Left out: Lord Acton, who remained a Catholic and is quoted for one sentence (his two Index lines of 1871 concern the Vatican Council), by my judgment. Every name and every title is under an author heading of `docs/en/holy-office/forbidden.md`, as the Index prints it; `tests/index-names.test.js` checks it, and `research/index-of-forbidden-books.md` gives the heading and the line of each.
- Known false alarms: "Gibbons at the zoo" (no bare "Gibbon"), a documentary titled "The decline and fall of the Roman Empire" (0.50 only: the title is Gibbon's but people use it for every history of Rome), "Ranke" alone (0.75), "Taine" alone (0.75).
- Default: Disabled, a choice of the rule author: the histories are a broad category and ship off; he can switch it on.
- Lexicon: index_historians (35 entries): 16 at 0.95, 18 at 0.75, 1 at 0.5.

### index_novelists: Novels forbidden by name (disabled) {#index_novelists}

- Rule (as shipped): where feed-card, related, watch-meta; flag at 0.80; gate lexicon; lexicon index_novelists; action feed-card=dim, watch-meta=label. Group anticatholic. The settings page shows it as "Novelists on the Index".
- Question: Is this video about the novels, plays or poems of a writer whom the Index of Forbidden Books named (for example Hugo, Balzac, Flaubert, Zola, Gide or Sartre), or about adaptations of them, and not about the life of the writer, nor about a place, a street, a school or something else of the same name?
  gate: lexicon
  confirm: model
  spare words: life_words
  flag at: 0.80
  action: feed-card=dim, watch-meta=label
  enabled: false

- Source: the Index of Forbidden Books and canon 1399, classes 9 and 3 (books that expressly treat of, tell or teach obscene things; books that attack religion or good morals); the Index calls the novels of eleven authors "omnes fabulae amatoriae", all his love stories; the categories are the rule author's own (the Index is alphabetical). The `source:` line: `Index of Forbidden Books (1948 and the decrees to 1961), canon 1399, 3 and 9. The categories are a choice of the rule author`
- What it flags: a video ABOUT novelists, playwrights and poets (a reading, a summary, an analysis, an explanation, an adaptation or a debate of what they wrote), not their lives: the rule author's words, "videos discussing these kinds of banned book authors". A Catholic critique of one of them is flagged too; a namesake is not, and neither is a video about the LIFE of the person or the history of his influence: the owner, on seeing "David Hume's Influence on John Henry Newman" from a Catholic channel flagged: "it's about the life of the person David Hume (historical), not 'opera omnia' (his works), that's the difficulty". The words of a life (life_words: biography, born, died, exile, "influence on", ...) lower a strong hit so that the model decides, and the rule has `confirm: model`, so that a model that is there also checks the hits that carry no such word.
- The names: Victor Hugo ("Notre-Dame de Paris", 1834, and "Les misérables", 1864), Alexandre Dumas (father and son), Balzac, Flaubert ("Madame Bovary", "Salammbô"), Zola (Opera omnia, 1894), Stendhal, George Sand (the Index prints her under the name Dudevant, with "Sand, George" as the name she used), Eugène Sue, André Gide (24 May 1952), Alberto Moravia (20 May 1952), Curzio Malaparte, Anatole France, Maeterlinck, D'Annunzio, Casanova ("de Seingalt"), Sterne, Samuel Richardson ("Pamela"), Heine, Lamartine, Alfieri, Murger. Sartre, Beauvoir and Unamuno are in the philosophers', Kazantzakis in the lives of Jesus, Fogazzaro in the Modernists'. Every name and every title is under an author heading of `docs/en/holy-office/forbidden.md`, as the Index prints it; `tests/index-names.test.js` checks it, and `research/index-of-forbidden-books.md` gives the heading and the line of each.
- Known false alarms: "Notre-Dame de Paris", the cathedral and its fire, and the musical of that name, are not cues (the title is Hugo's but the words are the cathedral's: only "Victor Hugo" is); "Hotel Victor Hugo", "Rue Alexandre Dumas" and the metro station (the pattern stands down to 0.75); "George Sanders" and "sand dunes" (the cue is the exact words "George Sand"); "Casanova" (the 2005 film), "Pamela Anderson", "Heine ketchup", "Dumas, Texas", "Zola Budd" and "Stendhal syndrome" (bare names: not cues or 0.75). Adaptations are flagged: a musical of "Les Misérables" is a video about the work.
- Default: Disabled, a choice of the rule author: the novelists are a broad category and ship off; he can switch it on.
- Lexicon: index_novelists (65 entries): 33 at 0.95, 32 at 0.75.

## Not included and why

- indifferentism (the example rule in plan section 5, "all religions are equally true"): no passage in the 85 sermons. Searched for "toutes les religions", "bonne religion", "peu importe", "honnête homme", "se sauver dans" and similar: no hit says that religions are equal ("peu importe" and "honnête homme" do occur, about other things). The nearest line is below, and it is part of a list of what happens to someone who leaves the service of God, not a teaching about other religions. It cannot carry a sermon-traced rule. The rule author has now decided (2026-11-26) that it is a rule anyway: indifferentism, enabled, with "Choice of the rule author" as its source, and the Syllabus of Errors (propositions 15 and 16) as the Church text it follows (see the rule). The line below stays here as the nearest the sermons come.
  - Quote, Sur le service de Dieu (volume 3): « vous vous ferez une religion à votre mode »
    - English (working, literal): you will make yourselves a religion to your own taste
    - Read: apotre.org page 34 https://www.apotre.org/livres/vianney-sermons/34 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
- False religion, apostasy, Protestants, heretics, freemasons: the only passage is the sentence below, where he sets apostates aside in order to define "reniement". It gives no category of content to filter, and a rule would amount to flagging other Christian bodies by name. "Francs-maçons", "libres penseurs" and "huguenots" do not occur at all; "protestants" occurs three times (this sentence, a verb in Sur la Tiédeur, and an anecdote of a Protestant doctor in the sermon on confession); "hérétiques" occur only in stories of saints and in two rhetorical asides in the sermon on unworthy communion. Since 2026-11-26 the Protestants are a rule (protestantism, enabled): the rule author decided to filter Protestant and evangelical teaching and worship, the rule's `source:` is this sentence, and the rule is about content and not about persons (see the rule). Freemasons are a rule since the same day (freemasonry, enabled; "francs-maçons" does not occur in the sermons, so the rule rests on the Church documents and on the rule author's choice). Heretics in general are not a rule: left to the rule author.
  - Quote, Sur la colère (volume 3): « Je ne veux pas vous parler de ceux qui renient Dieu en quittant la religion catholique pour en embrasser une fausse : tels sont les protestants, les jansénistes et tant d'autres. »
    - English (working, literal): I do not want to speak to you of those who renounce God by leaving the Catholic religion to embrace a false one: such are the Protestants, the Jansenists and many others.
    - Read: apotre.org page 42 https://www.apotre.org/livres/vianney-sermons/42 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
- Part two of 2026-11-26 (the Anti-Catholicism group), looked at and not made; the counts, the examples and the reasons are in `research/index-of-forbidden-books.md`:
  - Action Française: the Index prints 14 lines (Maurras with 7, 1926; Léon Daudet; the review and the pamphlets of 1926 to 1928). It is a political movement with no vocabulary of its own for a title; the file does not say what became of the ban after 10 July 1939, the date it prints for the review. Whether videos about it are to be flagged is for the rule author to say; the names are checked and can be added.
  - Liberalism and laicism: the Syllabus has a section on modern liberalism, but in a YouTube title "liberalism" is the political or economic word, and the Church's sense has no phrase that a title carries.
  - Theosophy: the rule sects already holds "theosophy" (0.75); the Index prints it in two titles only.
  - Nazism: the Index prints two works of Alfred Rosenberg; the Church texts on it were not read, and documentaries would be the main false alarm. A candidate if the rule author asks.
  - Jansenism, Gallicanism and Febronianism, Protestant polemics of the 1600s, the editions and commentaries of the Bible (class 1, 4 and 5), duelling, suicide and divorce (five lines), love and marriage as a subject, rationalism as a word in a title: no recognisable name or no cue that a title carries; the counts are in the research file.
  - Books of private revelations (class 5): the Index prints the decree of 5 January 1960 on "Il Poema di Gesù" and "Il Poema dell'Uomo-Dio"; it is not an attack on the Church, and no list names its author.
  - The notes of the rule author on translations: an English title that the Index does not print is not a cue; if he wants them ("The Last Temptation of Christ", "The Social Contract"), they could be one more list, marked as translations and outside the check of the test.
- Judaism and Freemasonry: left out of the first round of 2026-11-26 and added later the same day, at the rule author's instruction (the rules judaism and freemasonry, enabled; Freemasonry moved to the group Anti-Catholicism in part two). What stays out, and is tested: any cue about the Jewish people (the bare word "Jewish", "Jews", Israel, politics, the Holocaust) or about an ethnicity, and any conspiracy word about Freemasonry or any other group ("Illuminati", "new world order" and the like). Both rules look at religious content, never at people.
- Superstition beyond divination: both sermons on the first Commandment are about loving and adoring God, with nothing on superstition; the word occurs once, in a martyr's mouth (Maccabees). The one usable line is in the rule divination. Witchcraft, magic and New Age practice are the rule occult since 2026-11-26 (the rule author's choice).
- Pride, vanity and boasting (Sur l'orgueil): a vice of the speaker rather than a kind of content. It cannot be seen from a title, and a question about it would flag most personal-brand content.
  - Quote, Sur l’orgueil (volume 2): « chacun se loue et se flatte de ce qu'il n'est pas et de ce qu'il n'a pas fait »
    - English (working, literal): each one praises himself and flatters himself for what he is not and for what he has not done
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/orgeuil19.html; apotre.org page 28 https://www.apotre.org/livres/vianney-sermons/28
- Lying in general (Sur le Mensonge): five of his six kinds (pride, harm to the neighbour, to please, to sell dearer, in confession) cannot be seen in a title or a caption. Only the fifth is a rule (pranks).
  - Quote (the first kind), Sur le Mensonge (volume 2): « par orgueil, quand l'on raconte ce que l'on a fait ou dit et qu'on l'augmente »
    - English (working, literal): out of pride, when one tells what one has done or said and exaggerates it
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/mensonge15.html; apotre.org page 26 https://www.apotre.org/livres/vianney-sermons/26
- Envy as sorrow at the good of others: an inner state. Only the malicious pleasure at misfortune is a rule.
  - Quote, Sur l'Envie (volume 3): « Peut-on trouver une passion plus aveugle que celle qui consiste à s'affliger du bonheur de ses frères, et à se réjouir de leur malheur ? »
    - English (working, literal): Can one find a more blind passion than that which consists in grieving at the happiness of one's brothers and rejoicing at their misfortune?
    - Read: apotre.org page 39 https://www.apotre.org/livres/vianney-sermons/39 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
- Vengeance as a passion: it occurs in many sermons as what anger and envy lead to, but no sermon defines it or lists its forms. The rule revenge rests on three passages only, which is why it is off.
- Time wasted and idle or flattering talk (Sur la Pénitence): "songs and talk that lead nowhere" are lost time. It cannot be told from a title or a caption window; the break reminder (plan, section 4.6) answers time, not content.
  - Quote, Sur la Pénitence (volume 1): « c'est toujours un temps bien mal employé et ravi aux soins que nous devons donner à notre âme »
    - English (working, literal): it is always time badly spent and taken from the care we owe to our soul
    - Read: livres-mystiques https://livres-mystiques.com/partieTEXTES/Ars/Sermons/tome1/penite15.html; apotre.org page 12 https://www.apotre.org/livres/vianney-sermons/12
- Thoughts and desires (two of the six ways to sin against purity): inner acts, not content.
- Profane songs in general ("les chansons profanes", Sur l'Absolution): a rule would flag all secular music. Only lewd songs are covered (impure_words).
- Exaggeration, bad-faith reading and insinuation, three of his manners of detraction: a small model cannot tell exaggeration from accuracy without the facts, and the other two are covered where visible by rash_judgment and gossip.
- Rivals running each other's goods down (Sur la Médisance): no separate rule; it falls under calumny or gossip when a named person is accused.
- Hasty generalisation about a group ("all priests are the same", Sur le jugement téméraire): not a content category in his lists, and a rule on it would become a stereotype filter, beyond what the quote supports.
  - Quote, Sur le jugement téméraire (volume 2): « Si, parmi les prêtres, il y en a qui, peut-être, ne sont pas aussi saints qu'ils devraient l'être, tous les autres prêtres sont de même, ils ne valent tous rien »
    - English (working, literal): If, among priests, there are some who perhaps are not as holy as they should be, all the other priests are the same, they are all worthless
    - Read: livres-mystiques https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/tome2/temeraire20.html; apotre.org page 29 https://www.apotre.org/livres/vianney-sermons/29
- Respect in church (Sur la Dédicace): about how people behave before and during the offices; no media category and no cue for titles.
- Vows, Sunday work and trade, fasting and abstinence: not media.
- Evening gatherings ("veillées"): the gathering is not media; what is said and sung there is covered by gossip and impure_words (he describes them in Sur les ennemis de notre salut).
  - Quote, Sur les ennemis de notre salut (volume 1): « Vous allez dans une veillée, où presque toute la soirée se passe à médire, à calomnier le prochain, à dire de mauvaises raisons, à chanter de mauvaises chansons. »
    - English (working, literal): You go to an evening gathering where nearly the whole evening is spent in speaking ill, in slandering one's neighbour, in saying bad talk, in singing bad songs.
    - Read: livres-mystiques https://livres-mystiques.com/partieTEXTES/Ars/Sermons/tome1/ennemi13.html; apotre.org page 10 https://www.apotre.org/livres/vianney-sermons/10

## Notes on defaults

- On: categories that are clearly in his text and recognisable with few false alarms. That is the project's starter list (the Lord's name family, curses, coarse words, detraction and calumny, impure words) plus impure_sights, which the sermons page ties to the hide action ("se détourner", quickly).
- Also on, since 2026-11-26: the eleven rules on unbelief, other religions, Freemasonry, attacks on the Church and the occult (denial_of_god, naturalism, indifferentism, protestantism, islam, judaism, eastern_religions, sects, freemasonry, anti_catholic, occult). That is the decision of the rule author, who calls them the most important part; it is not a judgment that they are recognisable with few false alarms. The 0.95 tier of their word lists is kept small for that reason (see "Rules chosen by the rule author (2026-11-26)").
- Also on, since part two of 2026-11-26: six rules of the group Anti-Catholicism, the ones that attack the faith directly: communism, modernism, spiritism, and the categories of books index_freethinkers, index_jesus_critics, index_modernists. Off: the three broad categories of books, index_philosophers, index_historians and index_novelists, which would flag many videos that are no attack on the faith; each is a switch the rule author can turn on. That the broad categories ship off is a choice of the rule author's brief, not a result of measuring.
- Off: the broad or over-flagging ones named in the project's plan (dances, games, spectacles, drunkenness, anger, superstition) and the ones I judged to over-flag or to need more than a title (insults, rash_judgment, tale_bearing, curiosity, immodest_dress, familiar_company, bad_books, pranks, malicious_pleasure, gluttony, revenge), and mockery_of_faith, which the rule author left off. They ship in the pack so that a user can switch them on.
- Off does not mean he rates them lower. His own split of occasions (Sur la Contrition, quoted above and under spectacles, quote 2) puts books, comedies, balls, dances, pictures, songs and the company of the other sex among the occasions that lead to sin "par elles-mêmes". A user who wants to follow him strictly would switch most of the disabled occasion rules on; they ship off for false alarms.
- He also says the occasion depends on the person:
  - Quote, Sur les ennemis de notre salut (volume 1): « Il est vrai que souvent, ce qui est une occasion de péché pour les uns ne l'est pas pour les autres ; c'est à chacun de nous à examiner nos dispositions particulières »
    - English (working, literal): It is true that often what is an occasion of sin for some is not so for others; it is for each of us to examine our particular dispositions
    - Read: livres-mystiques https://livres-mystiques.com/partieTEXTES/Ars/Sermons/tome1/ennemi13.html; apotre.org page 10 https://www.apotre.org/livres/vianney-sermons/10
  - That is the textual basis for the per-rule sensitivity control (plan, section 7) and for shipping rules off rather than leaving them out.
- flag at, as shipped: 0.80 for the Lord's name, oaths, blasphemy and curses; 0.85 for renunciation and calumny; 0.70 for coarse words; 0.75 for impure words and impure sights; "heavy" for gossip; 0.75 to 0.80 for the disabled rules; 0.80 for the eleven belief and faith rules turned on on 2026-11-26 and for the nine rules of part two. The first group is above the 0.75 tier on purpose: those cue words also occur in prayer, preaching and quotation, so from the word lists alone only the unambiguous 0.95-tier cues flag, and the 0.75 tier waits for the on-device model or for the user to move the slider down. Wrongly hiding a sermon costs more than missing a cue. All are placeholders until the offline fit (plan, section 8).
- Actions: hide for clear violations on a feed card (lords_name, blasphemy, curses, coarse words, gossip, calumny, impure words, impure sights, cruel spectacles); dim for softer ones (oaths, renunciation and most disabled rules); blank for the topic rules (gambling, divination and, since 2026-11-26, denial_of_god, the ten new rules on belief, Freemasonry, the Church and the occult, and the six on the Anti-Catholicism group that ship on); dim for the three broad book categories that ship off so that the grid does not shift. These are choices. On the watch page the enabled rules warn and the disabled ones label. In subtitles, words are muted and spoken passages (gossip, calumny, mockery, rash judgment, tale-bearing, denial of God) are skipped; mute-word needs word-level timing, which only auto-generated captions have (plan, section 6).
- gate: every rule is gated by its lexicon, so the model is asked only after a cue. No rule uses "always", because that would run a model on every card. The cost is that spoken gossip or calumny without a cue word is never asked about. An author who accepts the cost can set gossip to gate always on the watch page.
- The exclusions in several questions (not in prayer, not a court oath, not sex education, not a joke or a quoted lyric) are the project's and are not in the Curé's text; they are there to spare a small model known false alarms.

## Notes for the lexicon authors

- The five word lists for the Lord's name, curses, blasphemy and coarse words, and the words of the Curé behind them:
  - lords_name_bare and lords_name_strong: his ordinary oaths are "Mon Dieu ! oui ; Mon Dieu ! non", "ma foi", "ma conscience", "parbleu", "morbleu", "mâtin", "pardi" (lords_name, quote 2; lords_name, quote 3). His footnote treats a disguised oath as the full one (lords_name, quote 6), so minced oaths ("gosh", "jeez", "gee") are a decision to make for lords_name_bare, probably at 0.15.
  - curses_imprecations: "que le bon Dieu me damne", "que le démon m'emporte", "que tu crèves", "je voudrais que le bras te séchât", "Maudit temps !", "maudits enfants", "je ne veux jamais voir la face de Dieu" (all in Sur le deuxième Commandement, apotre.org pages 23 and 24; two of them are quoted above: curses_imprecations, quote 2; curses_imprecations, quote 3).
  - blasphemy_terms: the four ways of St. Thomas (calling God cruel or unjust, saying he is not almighty, giving a creature what is due to God, and the printed "S... N... de D...") and mockery of the Virgin and the saints (quoted: blasphemy, quote 2; blasphemy, quote 5; blasphemy, quote 6; the other two ways are in the same passage, apotre.org page 24). He also calls "il n'y a point de Dieu" a blasphemy (denial_of_god, quote 3); whether blasphemy_terms should include it is left open (the pack keeps it in denial_of_god).
  - coarse_words: he prints the words with the letters blanked ("le b... et le f...", "le J... F..., B..., F..."; lords_name, quote 3; coarse_words, quote 4), and uses "sales paroles" and "obscénités" (coarse_words, quote 2; coarse_words, quote 3).
- Tier convention in the lexicons written here: 0.95 only for words that name the topic itself ("prank", "tarot", "mukbang", "there is no God"); 0.75 for phrases that are usually a violation; 0.50 for cues that need context; 0.15 for bare everyday words that only a lenient setting should act on. Entries are lower-case, without accents; entries with an apostrophe or a hyphen are written as regular expressions (an apostrophe is matched by `\W?`, so straight and curly apostrophes both work, and so does a missing one). The lists written first hold no comments.
- The ten lists added on 2026-11-26 (naturalism, indifferentism, protestantism, islam, judaism, eastern_religions, sects, freemasonry, anti_catholic, occult) keep the four tiers but read 0.95 more strictly, because those rules are on by default: 0.95 only for a flat statement ("all religions are the same") or for content of that kind by itself (a recitation, a sermon of a named denomination, a practice offered), not for the name of a topic; the name of a religion, a doctrine or a practice is at 0.75 and waits for the on-device model. Each of those lists begins with a few comment lines that say so (the parser skips every line that starts with "#"). No list names a person or uses a derogatory name; the tests check both. The lists on Judaism and Freemasonry are also tested for words of a people, a state, an ethnicity or a conspiracy.
- The regular expressions of the first lists were checked for syntax with Python's `re`. They use only `\b`, `\w`, `\s`, groups, alternation and optional parts; the app's regular-expression engine should be tested on them. The lists of 2026-11-26 also use a lookbehind, `(?<!...)`, to spare "not all religions are the same", "has science disproved God?", "John the Baptist", "Most Reverend" and "parish pastor", and, in the lists on Judaism and Freemasonry, a lookbehind and a lookahead that reach over the whole title (`(?<!\b(?:catholic|...)\b.*)` and `(?!.*\b(?:catholic|...)\b)`), so that a title with a Catholic marker word falls from 0.95 to the bare word. V8, the engine of Chrome and of Node, allows both; they were run in Node and by the tests. The guard stands after the cue, so that it is looked at only where a cue has matched: put in front of the cue it made a text of 6,000 characters (a long description) cost about 20 ms per list and one of 119,000 characters cost 6 seconds (measured in Node); behind the cue the same texts cost 1 to 11 ms, and a test keeps it so.

- The lists of part two (2026-11-26): freemasonry_cues (rewritten), communism_cues, modernism_cues and spiritism_cues are written by hand with the four tiers; the eight lists named index_*.txt are read from the Index. A hand list keeps its flat 0.95 cues as patterns with a guard that stands after the cue (a lookbehind and a lookahead over the whole title, looked at only where the cue has matched), plus a sibling at 0.75 without the guard for Communism, Modernism and Spiritism. The one lookbehind that stands in front of a cue is the short fixed list of question words in the first Modernism pattern. An Index list is a set of groups, each introduced by a comment line `# @ <the author's heading as the Index prints it>`; its entries are plain phrases (a trailing * is a prefix, which also catches a possessive) or a guarded name (`/\bvictor hugo(?:'s)?\b` followed by the guard of street, school, hotel, station and the like), and the plain 0.75 entry that follows it is the fallback. `tests/index-names.test.js` says how an entry is checked against the file.
- A guard word must not be a word of the cue: the defence "Freemasonry is not evil" cannot be a guarded 0.95 pattern if "evil" is a guard word (the guard would find it in the cue itself), and "spiritist church" cannot be one if "church" is a guard word of that list. The lists of part two were written with that in mind, and the tests run a title for each.

## Things to check first

- The weakest questions are calumny, gossip and rash_judgment (a small model cannot know whether a claim is true) and impure_sights (it sees titles, not images; the experimental image rules at the end of this page look at the thumbnail itself).
- gossip keeps the word "private" from the plan's draft; he would not exempt public faults. calumny and gossip are enabled with hide on the feed card, as the plan says the listener is an accomplice; if they hide too much, lower the action to dim before lowering the sensitivity.
- oaths and renunciation are enabled because the plan names six categories as the starter set; if they over-flag, switch off oaths first.
- mockery_of_faith is written for "religion" in general, not for one Church.
- protestantism: "pastor" and "reverend" flag a title by themselves, by the rule author's decision. Their known false alarms are listed under the rule (a Catholic priest called "pastor" in a title, a band called Reverend). If they hide Catholic parish content, widen the lookbehind in front of the word (`parish`, `catholic`, `monsignor`), do not weaken the cue.
- judaism and freemasonry: the 0.95 entries that a Catholic talk could use carry a guard that looks at the whole title. A Catholic title that holds none of the guard words is flagged like any other; add the word to the guard if such titles turn up.
- denial_of_god was widened on 2026-11-26 from a flat statement to arguing for atheism. Its 0.95 tier still flags a title that quotes "there is no God" in order to answer it; that is the cost of letting the word list decide alone.
- Part two of 2026-11-26 has been run only against titles written by the author of the lists too (about 250: promotion and warning for each ideology, a hundred names and namesakes for the books, plus the examples of each rule). The weakest places: Modernism (the doctrine is rarely named in a YouTube title, and its cues are the list author's wording), Communism (the 0.50 tier holds the words that most news and history use, so they never reach the model at the default setting), the book rules without the model (only full names and titles flag; a bare surname waits), and the rule index_modernists (the label "Modernist" is the list author's, not the Index's).
- The eleven belief and faith rules turned on on 2026-11-26 have been run only against titles written by the author of the lists: about 370 (Catholic sermons and replies, news and ordinary titles, and statements each list should catch), plus the examples of each rule. That is not a labelled set and no accuracy claim is made. With flag at 0.80, only the 0.95 tier flags from the word lists alone; a viewer who has not downloaded the on-device model sees those flat statements and offered practices flagged, and a title such as "Buddhism explained" or "Sola scriptura explained" passes until the slider is moved down to 0.75 or the model is on.

## Image and audio rules (experimental)

- Six more rules are in `extension/rules/vianney.media.en.rules`. They analyze a thumbnail, or a few seconds of audio, with Chrome's on-device model. They do nothing until Images & Audio is switched on in the settings, and the plan describes them in section 3.10.
- They apply the passages above to what is seen and heard, and have no verbatim quotes of their own:
  - explicit_images and immodest_images follow impure_sights and immodest_dress (quotes 1 to 3 of impure_sights: Sur l'Impureté, Sur la Pénitence on the eyes, Sur la pureté). It is the same sin by looks, now judged from the thumbnail and not from the title.
  - violent_images follows cruel_spectacles.
  - audio_explicit follows impure_words, audio_coarse follows coarse_words, and audio_lords_name follows lords_name.
- Their questions, their "flag at" values and their actions are the project's choices, and none has been measured. A score is the share of 1 to 3 differently worded prompts that said yes, so "flag at 0.30" (explicit images) means that one prompt saying yes is enough, 0.60 means most agree, and 0.80 (the Lord's name in sound, off by default) means that nearly all agree.
- A refusal by the browser's own safety filter counts as a flag for explicit_images and audio_explicit only, and only while the setting allows it.
{% endraw %}
