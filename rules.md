---
title: Rules and sources
description: The 30 text rules of the starter pack, each traced to verbatim passages of the Curé d'Ars, with the reasons behind the defaults, plus the six experimental picture and sound rules.
---
{% raw %}
# Rules and their sources

## What this is

- The English starter pack for the YouTube content filter, built on the lists and categories of the Curé d'Ars (St. Jean-Marie Vianney, 1786-1859). Files in the [repository](https://github.com/drugi-obieg/vianney): `extension/rules/vianney.en.rules` (30 text rules: 10 enabled, 20 disabled) and `extension/lexicon/` (31 word lists: 26 cue lists written with the rules, and five for the Lord's name, curses, blasphemy and coarse words). Six experimental picture and sound rules are in `extension/rules/vianney.media.en.rules`; they are at the end of this page.
- The five word lists coarse_words, lords_name_strong, lords_name_bare, curses_imprecations and blasphemy_terms serve four rules (lords_name, blasphemy, curses_imprecations, coarse_words). The words of the Curé behind them are under "Notes for the lexicon authors".
- Status: draft. The questions, the word lists and the weights are drafts by the project, and whoever uses the pack should correct them. Lexicon weights are the placeholder tiers 0.95, 0.75, 0.50 and 0.15 (0.95 unambiguous in any context, 0.75 usually a violation, 0.50 a cue that needs context, 0.15 a bare ambiguous word for a model to judge). None of this has been tested on a labelled set, and no accuracy claim is made.
- Every rule has at least one verbatim French passage of the Curé with the sermon title and a page URL. A rule without such a passage was not written; those ideas are under "Not included and why".
- `source:` in the rules file names one sermon per rule, the main one. The other sermons behind a rule are listed below.
- Enabled by default (10): lords_name, oaths, blasphemy, renunciation, curses_imprecations, coarse_words, gossip, calumny, impure_words, impure_sights.
- Disabled by default (20): insults, mockery_of_faith, rash_judgment, tale_bearing, curiosity, immodest_dress, familiar_company, bad_books, dances, spectacles, cruel_spectacles, gambling, drunkenness, gluttony, anger, revenge, pranks, malicious_pleasure, divination, denial_of_god.

## The rules

- [lords_name](#lords_name): Taking the Lord's name in vain (enabled)
- [oaths](#oaths): Oaths, calling God to witness (enabled)
- [blasphemy](#blasphemy): Blasphemy (enabled)
- [renunciation](#renunciation): Renouncing God in anger (enabled)
- [curses_imprecations](#curses_imprecations): Curses and imprecations (enabled)
- [coarse_words](#coarse_words): Coarse words (enabled)
- [insults](#insults): Insults (disabled)
- [mockery_of_faith](#mockery_of_faith): Mocking religion and holy things (disabled)
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
- [denial_of_god](#denial_of_god): Denying that there is a God (disabled)

## Texts, checks and limits

- Edition: *Sermons du Saint Curé d'Ars* (Lyon; the text read carries the archbishop's approval of 26 September 1893). The French is public domain. All 85 sermons of the four volumes were searched; the prefaces were not.
- Two copies were used. livres-mystiques.com (volumes 1, 2 and 4, with accents) and apotre.org, 56 pages, which says it copies jesusmarie.free.fr (all four volumes). In volume 3 the livres-mystiques copy lost its accented letters at the source, so volume-3 passages are quoted from apotre.org. Page numbers below are apotre.org pages ("page N sur 56"); page 1 has no number in its URL, and no quote is on it.
- The volume-3 sermons used, as they stand on livres-mystiques (accents lost there; the quotes come from apotre.org): Sur l'Absolution https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/Tome3/sermon4.htm; Sur l'Envie https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/Tome3/sermon13.htm; Sur l'Impureté https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/Tome3/sermon14.htm; Sur l'Ivrognerie https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/Tome3/sermon16.htm; Sur la colère https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/Tome3/sermon17.htm; Sur la pureté https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/Tome3/sermon11.htm; Sur la restitution https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/Tome3/sermon18.htm; Sur le Monde https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/Tome3/sermon6.htm; Sur le service de Dieu https://www.livres-mystiques.com/partieTEXTES/Ars/Sermons/Tome3/sermon5.htm.
- How the quotes were checked: each quote was found by program in the apotre.org page text (ignoring case, whitespace and the line-break hyphens of that copy, such as "ex-trême"; accents were compared as well) and the page number was taken from that match. For volumes 1, 2 and 4 each quote also matches the livres-mystiques text exactly, whitespace aside (one footnote quote exists there only, and is marked). In volume 3 the line-break hyphens were removed from the quotes and nothing else was changed. No quote is longer than 40 words.
- The English glosses are literal working translations made for this project, as on the sermons page; the French is the authoritative wording.
- Method: these terms were searched across all 85 sermons (accents and hyphen artifacts ignored), and the hits in lists, definitions and examples were read in context: jurements, blasphèmes, reniements, imprécations, malédictions, obscénités, injures, paroles sales and grossières, chansons, conversations, veillées, mauvais livres, romans, comédies, théâtres, spectacles, bals, danses, jeux (au jeu, joueur, jeux défendus), cabarets, tableaux and peintures, immodesties and habits, curieux and curiosité, vengeance, superstition, devins, sorciers, magiciens, horoscopes, protestants, hérétiques, francs-maçons, libres penseurs, athées, incrédules, impies, Voltaire, toutes les religions, mauvaises compagnies. The search on "yeux" and "oreilles" is the one recorded on the sermons page and was not repeated. The sermons read as sermons are listed in the next point.
- Read in full or in large part: Sur le deuxième Commandement, Sur la Médisance, Sur le jugement téméraire, Sur la pureté, Sur l'Impureté, Sur l'Ivrognerie (first two thirds), Sur l'orgueil (parts I and II). Read in the relevant parts only: Sur la Pénitence (the passage on the senses), Sur les ennemis de notre salut (the means of defence), Sur la colère (about half: the opening and the passages on oaths, blasphemy and renunciation), the sermon on the examination of conscience (the first part, on the faults), Sur l'Absolution (the occasions of sin and habitual sinners), Sur la Contrition (occasions), Sur le Monde (the amphitheatre story and every hit), Sur le Mensonge (the list of lies), Sur l'Envie (opening), Sur la religion (opening and hits), the two sermons on the first Commandment (openings and word search), the Dédicace sermon (opening and hits).
- Limit: where a sermon was not read in full, the word search is the only evidence that it holds nothing more on a subject. Other editions and the catechism instructions were not searched (the same limit as the sermons page).

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
  - He also calls the sentence "there is no God" a blasphemy (Sur la religion); that case is in the separate, disabled rule denial_of_god, and whether blasphemy_terms should hold it is left open.
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
- Lexicon: insult_cues (31 entries): second-person forms at 0.75 and 0.50, bare words ("idiot", "loser") at 0.15.

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
- Default: Disabled (anything about religions is off by default). Enable for a stricter profile.
- Lexicon: mockery_of_faith_cues (21 entries): mostly derogatory phrases at 0.50; generic nouns (priest, pope, nun) are left out on purpose so that every religious video does not reach the model.

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
  - Witchcraft and magic are not in the question: he names magicians only in passing (as slanders against Christ in Sur le Mystère, and in a martyr's reply in the Maccabees sermon).
- Default: Disabled (superstition on the project's starter list). One line of the Curé is all there is to go on.
- Lexicon: divination_cues (33 entries): "tarot", "horoscope" and "fortune teller" are at 0.95.

### denial_of_god: Denying that there is a God (disabled) {#denial_of_god}

- Rule (as shipped): where feed-card, watch-meta, subtitles; flag at 0.80; gate lexicon; lexicon denial_of_god_cues; action feed-card=blank, watch-meta=label, subtitles=skip-segment.
- Question: Does this state flatly that there is no God, and not just discuss atheism or the question of God's existence?
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
  - The question is limited to a flat statement that there is no God. Discussion of atheism, or of whether God exists, is excluded: the sermon itself argues the question and does not forbid the subject.
  - He names the writers of his time who attacked religion (Voltaire and others). The pack does not name people.
- Default: Disabled (anything about religions is off). It would flag debate, philosophy and apologetics.
- Lexicon: denial_of_god_cues (25 entries): the flat statements ("there is no God") are at 0.95; "atheist" is at 0.50 because it also names a discussion.

## Not included and why

- indifferentism (the example rule in plan section 5, "all religions are equally true"): no passage in the 85 sermons. Searched for "toutes les religions", "bonne religion", "peu importe", "honnête homme", "se sauver dans" and similar: no hit says that religions are equal ("peu importe" and "honnête homme" do occur, about other things). The nearest line is below, and it is part of a list of what happens to someone who leaves the service of God, not a teaching about other religions. It cannot carry a rule. The rule author must source it elsewhere (the catechism instructions are not in this corpus).
  - Quote, Sur le service de Dieu (volume 3): « vous vous ferez une religion à votre mode »
    - English (working, literal): you will make yourselves a religion to your own taste
    - Read: apotre.org page 34 https://www.apotre.org/livres/vianney-sermons/34 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
- False religion, apostasy, Protestants, heretics, freemasons: the only passage is the sentence below, where he sets apostates aside in order to define "reniement". It gives no category of content to filter, and a rule would amount to flagging other Christian bodies by name. "Francs-maçons", "libres penseurs" and "huguenots" do not occur at all; "protestants" occurs three times (this sentence, a verb in Sur la Tiédeur, and an anecdote of a Protestant doctor in the sermon on confession); "hérétiques" occur only in stories of saints and in two rhetorical asides in the sermon on unworthy communion. Left to the rule author.
  - Quote, Sur la colère (volume 3): « Je ne veux pas vous parler de ceux qui renient Dieu en quittant la religion catholique pour en embrasser une fausse : tels sont les protestants, les jansénistes et tant d'autres. »
    - English (working, literal): I do not want to speak to you of those who renounce God by leaving the Catholic religion to embrace a false one: such are the Protestants, the Jansenists and many others.
    - Read: apotre.org page 42 https://www.apotre.org/livres/vianney-sermons/42 (volume 3: accents are lost in the livres-mystiques copy; see the list of volume-3 URLs above)
- Superstition beyond divination: both sermons on the first Commandment are about loving and adoring God, with nothing on superstition; the word occurs once, in a martyr's mouth (Maccabees). The one usable line is in the rule divination.
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
- Off: the broad or over-flagging ones named in the project's plan (dances, games, spectacles, drunkenness, anger, superstition, anything about religions) and the ones I judged to over-flag or to need more than a title (insults, rash_judgment, tale_bearing, curiosity, immodest_dress, familiar_company, bad_books, pranks, malicious_pleasure, gluttony, revenge). They ship in the pack so that a user can switch them on.
- Off does not mean he rates them lower. His own split of occasions (Sur la Contrition, quoted above and under spectacles, quote 2) puts books, comedies, balls, dances, pictures, songs and the company of the other sex among the occasions that lead to sin "par elles-mêmes". A user who wants to follow him strictly would switch most of the disabled occasion rules on; they ship off for false alarms.
- He also says the occasion depends on the person:
  - Quote, Sur les ennemis de notre salut (volume 1): « Il est vrai que souvent, ce qui est une occasion de péché pour les uns ne l'est pas pour les autres ; c'est à chacun de nous à examiner nos dispositions particulières »
    - English (working, literal): It is true that often what is an occasion of sin for some is not so for others; it is for each of us to examine our particular dispositions
    - Read: livres-mystiques https://livres-mystiques.com/partieTEXTES/Ars/Sermons/tome1/ennemi13.html; apotre.org page 10 https://www.apotre.org/livres/vianney-sermons/10
  - That is the textual basis for the per-rule sensitivity control (plan, section 7) and for shipping rules off rather than leaving them out.
- flag at, as shipped: 0.80 for the Lord's name, oaths, blasphemy and curses; 0.85 for renunciation and calumny; 0.70 for coarse words; 0.75 for impure words and impure sights; "heavy" for gossip; 0.75 to 0.80 for the disabled rules. The first group is above the 0.75 tier on purpose: those cue words also occur in prayer, preaching and quotation, so from the word lists alone only the unambiguous 0.95-tier cues flag, and the 0.75 tier waits for the on-device model or for the user to move the slider down. Wrongly hiding a sermon costs more than missing a cue. All are placeholders until the offline fit (plan, section 8).
- Actions: hide for clear violations on a feed card (lords_name, blasphemy, curses, coarse words, gossip, calumny, impure words, impure sights, cruel spectacles); dim for softer ones (oaths, renunciation and most disabled rules); blank for three topic rules (gambling, divination, denial_of_god) so that the grid does not shift. These are choices. On the watch page the enabled rules warn and the disabled ones label. In subtitles, words are muted and spoken passages (gossip, calumny, mockery, rash judgment, tale-bearing, denial) are skipped; mute-word needs word-level timing, which only auto-generated captions have (plan, section 6).
- gate: every rule is gated by its lexicon, so the model is asked only after a cue. No rule uses "always", because that would run a model on every card. The cost is that spoken gossip or calumny without a cue word is never asked about. An author who accepts the cost can set gossip to gate always on the watch page.
- The exclusions in several questions (not in prayer, not a court oath, not sex education, not a joke or a quoted lyric) are the project's and are not in the Curé's text; they are there to spare a small model known false alarms.

## Notes for the lexicon authors

- The five word lists for the Lord's name, curses, blasphemy and coarse words, and the words of the Curé behind them:
  - lords_name_bare and lords_name_strong: his ordinary oaths are "Mon Dieu ! oui ; Mon Dieu ! non", "ma foi", "ma conscience", "parbleu", "morbleu", "mâtin", "pardi" (lords_name, quote 2; lords_name, quote 3). His footnote treats a disguised oath as the full one (lords_name, quote 6), so minced oaths ("gosh", "jeez", "gee") are a decision to make for lords_name_bare, probably at 0.15.
  - curses_imprecations: "que le bon Dieu me damne", "que le démon m'emporte", "que tu crèves", "je voudrais que le bras te séchât", "Maudit temps !", "maudits enfants", "je ne veux jamais voir la face de Dieu" (all in Sur le deuxième Commandement, apotre.org pages 23 and 24; two of them are quoted above: curses_imprecations, quote 2; curses_imprecations, quote 3).
  - blasphemy_terms: the four ways of St. Thomas (calling God cruel or unjust, saying he is not almighty, giving a creature what is due to God, and the printed "S... N... de D...") and mockery of the Virgin and the saints (quoted: blasphemy, quote 2; blasphemy, quote 5; blasphemy, quote 6; the other two ways are in the same passage, apotre.org page 24). He also calls "il n'y a point de Dieu" a blasphemy (denial_of_god, quote 3); whether blasphemy_terms should include it is left open (the pack keeps it in denial_of_god, off).
  - coarse_words: he prints the words with the letters blanked ("le b... et le f...", "le J... F..., B..., F..."; lords_name, quote 3; coarse_words, quote 4), and uses "sales paroles" and "obscénités" (coarse_words, quote 2; coarse_words, quote 3).
- Tier convention in the lexicons written here: 0.95 only for words that name the topic itself ("prank", "tarot", "mukbang", "there is no God"); 0.75 for phrases that are usually a violation; 0.50 for cues that need context; 0.15 for bare everyday words that only a lenient setting should act on. Entries are lower-case, without accents; entries with an apostrophe or a hyphen are written as regular expressions (an apostrophe is matched by `\W?`, so straight and curly apostrophes both work, and so does a missing one). Lexicon files hold no comments.
- The regular expressions were checked for syntax with Python's `re`. They use only `\b`, `\w`, `\s`, groups, alternation and optional parts; the app's regular-expression engine should be tested on them.

## Things to check first

- The weakest questions are calumny, gossip and rash_judgment (a small model cannot know whether a claim is true) and impure_sights (it sees titles, not images; the experimental picture rules at the end of this page look at the thumbnail itself).
- gossip keeps the word "private" from the plan's draft; he would not exempt public faults. calumny and gossip are enabled with hide on the feed card, as the plan says the listener is an accomplice; if they hide too much, lower the action to dim before lowering the sensitivity.
- oaths and renunciation are enabled because the plan names six categories as the starter set; if they over-flag, switch off oaths first.
- denial_of_god and mockery_of_faith are written for "religion" in general, not for one Church.

## Picture and sound rules (experimental)

- Six more rules are in `extension/rules/vianney.media.en.rules`. They judge a thumbnail, or a few seconds of sound, with Chrome's on-device model. They do nothing until the experimental section of the settings is switched on, and the plan describes them in section 3.10.
- They apply the passages above to what is seen and heard, and have no verbatim quotes of their own:
  - explicit_images and immodest_images follow impure_sights and immodest_dress (quotes 1 to 3 of impure_sights: Sur l'Impureté, Sur la Pénitence on the eyes, Sur la pureté). It is the same sin by looks, now judged from the picture and not from the title.
  - violent_images follows cruel_spectacles.
  - audio_explicit follows impure_words, audio_coarse follows coarse_words, and audio_lords_name follows lords_name.
- Their questions, their "flag at" values and their actions are the project's choices, and none has been measured. A score is the share of 1 to 3 differently worded prompts that said yes, so "flag at 0.30" (explicit pictures) means that one prompt saying yes is enough, 0.60 means most agree, and 0.80 (the Lord's name in sound, off by default) means that nearly all agree.
- A refusal by the browser's own safety filter counts as a flag for explicit_images and audio_explicit only, and only while the setting allows it.
{% endraw %}
