# The Index of Forbidden Books as the source of the Anti-Catholicism rules

Research of 2026-11-26 (part two of that day). The rule author asked, in two messages, that Freemasonry flag its contents and effects and not the Catholic videos against it; that Communism and the other errors condemned by the Church be flagged; that the settings group "Faith and superstition" become "Anti-Catholicism" and hold "all the ideologies and banned books ... by category"; and, when the books were in doubt: "yeah basically videos discussing these kinds of banned book authors".

How to read this file
- "L1234" is a line of `docs/en/holy-office/forbidden.md` as it stood on 2026-11-26 (a line number can move if that file is edited; the names and titles do not).
- "Checked by program" means that a script or a test compared the text word for word, ignoring case and runs of white space. `tests/index-names.test.js` repeats the checks of the Index lists on every run (it is skipped, with its reason, when the file is not on the machine) and checks every quotation marked `Quote (forbidden.md)` in this file and in `rules.md`.
- "Choice of the rule author" is said wherever the sources do not decide. Nothing below was measured on real YouTube titles.
- No tables: bullets and nested bullets.

## 0. Short answer

- The Index names no Communist: its introduction says that Karl Marx, Charles Darwin and Friedrich Nietzsche are not named in it, and there is no heading for Engels, Lenin, Freud, Hegel or Schopenhauer either (checked by program: no heading begins with Marx, Engels, Lenin, Darwin, Charles, Nietzsche, Freud, Hegel, Schopenhauer, Feuerbach, Haeckel). The rule on Communism therefore rests on Church documents, not on the Index. The Index does name five books on socialism and the social question, and the Modernists, the Spiritists, the freethinkers, the philosophers, the historians and the novelists whose books it forbade.
- Eight word lists were made from the Index, each a category of the rule author (the Index is alphabetical and has none): six book categories (anti-religious writers, critical lives of Jesus, Modernists, philosophers, historians, novelists: one rule each) and the names of two doctrines (Spiritism, socialism) that sit inside the rules on Spiritism and on Communism. Every name and title in them is in the file: `tests/index-names.test.js` says by which rule.
- Defaults, a choice of the rule author: the categories that attack the faith directly are on (anti-religious writers, critical lives of Jesus, Modernists); the broad literary and philosophical ones are off (philosophers, historians, novelists). Each is a switch of its own.
- A book rule flags a video ABOUT those authors or their works, whatever it says of them (the rule author: "videos discussing these kinds of banned book authors"), so a Catholic critique of Voltaire is flagged too. The rules on the ideologies (Freemasonry, Communism, Modernism, Spiritism) work the other way: they flag what presents, teaches, promotes or defends, and spare what warns from the Catholic side.

## 1. The source

- File: `docs/en/holy-office/forbidden.md` (in the owner's docs repository, not in this one), 575,201 bytes, md5 c44ea776e94402ed878cde714be9c0b5, modified 20 November 2026. Its title: "Index of Forbidden Books"; it reproduces the Index as it stood on 14 June 1966, the edition of 1948 and the decrees to 1961.
- Form: an author heading `**Surname, First**`, then one line `- Title (year)` for each work, `see ...` lines for cross references, a section "Added after the edition of 1948" with the date and place of the decree, and a section of works without an author's name.
- My count by program: 4,625 list lines (4,378 works and 247 cross references) under 2,599 named headings, and 604 works without an author. The file itself says 4,313 entries under 2,438 names and 579 works without a name, and adds that its transcription "lists some works under more than one heading and has its share of misprints"; the counts differ because of that and because I count every line.
- The year in brackets is the year of the decree. Of the 4,378 works: 3 from the 1500s, 1,403 from the 1600s, 1,212 from the 1700s, 1,379 from the 1800s, 348 from the 1900s; 1,727 are from 1800 on.
- 181 lines are marked "donec corrigatur" (forbidden until corrected: the printed form only); 123 lines hold a whole corpus ("Opera omnia", "Omnia opera", "Opera et scripta omnia", "Omnes fabulae amatoriae") under 121 headings. "Omnes fabulae amatoriae" is the Index's name for all the love stories (the novels) of 11 authors: Balzac, Dumas (father and son), George Sand (under Dudevant), D'Annunzio, Feydeau, Fleury, Murger, Soulié, Stendhal, Sue.
- What the file does not hold, by its own words:
  - The books condemned before 1600 are not printed. Quote (forbidden.md): “That is why Luther, Calvin, Zwingli, Machiavelli or Boccaccio are not found below.”
  - Quote (forbidden.md): “Karl Marx, Charles Darwin and Friedrich Nietzsche are not named in it.”
  - The warning (monitum) of 1962 on Teilhard de Chardin and the notification of 1959 on the Divine Mercy devotion "do not belong to" the Index, the file says; the file prints no heading for Teilhard or for Faustina Kowalska (checked by program).

## 2. The twelve classes of canon 1399, as the file words them

- Canon 1399 of the Code of 1917 forbade whole classes of books by the law itself; the Index named the books on which Rome passed judgment one by one. The file lists the twelve classes in this order (the numbers are the order of the list):
  - Class 1. Quote (forbidden.md): “Editions of the original text of Holy Scripture and of its ancient Catholic versions published by non-Catholics, and translations of it into any language made or published by them.”
  - Class 2. Quote (forbidden.md): “Books of any writer that defend heresy or schism, or that try in any way to undermine the foundations of religion.”
  - Class 3. Quote (forbidden.md): “Books that of set purpose attack religion or good morals.”
  - Class 4. Quote (forbidden.md): “Books of non-Catholics that treat of religion expressly, unless it is certain that they contain nothing against the Catholic faith.”
  - Class 5. Quote (forbidden.md): “Bibles, notes and commentaries on Scripture published without the approval the law requires; and books that tell of new apparitions, revelations, visions, prophecies and miracles, or bring in new devotions, published without that approval.”
  - Class 6. Quote (forbidden.md): “Books that attack or ridicule a Catholic dogma, defend errors condemned by the Holy See, disparage divine worship, try to overthrow the discipline of the Church, or of set purpose insult the hierarchy, the clerical or the religious state.”
  - Class 7. Quote (forbidden.md): “Books that teach or recommend superstition, fortune-telling, divination, magic, the calling up of spirits and the like.”
  - Class 8. Quote (forbidden.md): “Books that hold duelling, suicide or divorce to be lawful, or that present the Masonic and similar sects as useful and harmless to the Church and to civil society.”
  - Class 9. Quote (forbidden.md): “Books that expressly treat of, tell or teach obscene things.”
  - Class 10. Quote (forbidden.md): “Editions of the liturgical books approved by the Holy See in which something has been changed.”
  - Class 11. Quote (forbidden.md): “Books that spread indulgences that are false, or have been condemned or revoked by the Holy See.”
  - Class 12. Quote (forbidden.md): “Printed images of Our Lord, the Blessed Virgin, the angels, the saints and other servants of God that are foreign to the mind and the decrees of the Church.”
- A book of one of these classes was forbidden without being named; a book that is not on the list "was therefore not thereby permitted" (the file). The classes that the rules rest on:
  - Class 2 and 3 (books that defend heresy or undermine the foundations of religion; books that of set purpose attack religion or good morals): the anti-religious writers, the critical lives of Jesus, the philosophers, the historians.
  - Class 6 (books that defend errors condemned by the Holy See, insult the hierarchy, the clerical or the religious state): the rule on Communism (Syllabus IV), the Modernists, the anti-religious writers.
  - Class 7 (superstition, magic, the calling up of spirits): the rule on Spiritism.
  - Class 8 (duelling, suicide, divorce; the Masonic and similar sects presented as useful and harmless): the rule on Freemasonry. The class forbids books that PRESENT the sects as useful and harmless; it does not forbid books against them.
  - Class 9 (obscene things): the novelists ("omnes fabulae amatoriae").
  - Classes 1, 4, 5, 10, 11 and 12 (Bibles by non-Catholics, books of non-Catholics on religion, unapproved apparitions, altered liturgical books, false indulgences, false images) are not made into rules; see section 5.

## 3. How the categories were worked out

- The names of the file were read with scripts, not by hand: the list lines were parsed (author, title, year, note), the titles were searched by keyword for each topic of the rule author's brief, and the authors with many lines or a whole-corpus ban were listed. Counts of keyword searches are lower bounds and rough: a title that names its topic in another word is not counted, and an everyday word (Latin "communis" is "common") is.
- The categories are the rule author's choice, not the Index's. Each is tied to a class of canon 1399 above, and each holds only names that are under an author heading of the file, as the Index prints them.
- How names were chosen, a choice of the rule author (not measured): an author is in a list if (1) the file prints his heading; (2) he is a person whom a viewer may type (a name still taught or in print in English or with a famous work; this is my judgment, not a count); (3) he is not a Catholic priest, religious or layman of good standing (section 6); (4) his Index lines are not "donec corrigatur"; and (5) his name is not a word that a street, a school or an animal also bears, unless the cue is guarded (section 7). A list is not the whole Index: 2,599 headings, and the eight lists name 89 of them.
- Every list says in its header that the entries are from the Index and that the category is the rule author's choice; its groups begin with the author's heading exactly as the Index prints it (`# @ Voltaire, François-Marie Arouet`), and the test checks each entry against that author's block and no other.

## 4. The categories made, with the names and the lines they come from

- The weights: 0.95 is a full name or a title that only that author wrote; 0.75 is a bare surname that a place, a school or a pet may bear (the on-device model decides); 0.50 is a broader bare word. A name at 0.95 is written as a guarded pattern that falls to the plain 0.75 entry when a word of a street, school, hotel or station stands beside it, so each such name has two lines in the list; the counts below are counts of names and titles, not of lines.

### Anti-religious writers

- List `index_freethinkers` (rule index_freethinkers; default on). Ground: canon 1399, classes 3 and 6 (books that of set purpose attack religion; books that of set purpose insult the hierarchy, the clerical or the religious state). Choice of the rule author: writers whose Index entries are plainly against religion or the clergy.
- 27 names and titles under 9 headings; the Index prints 67 list lines under those headings (the works without an author's name are counted apart).
  - Voltaire, François-Marie Arouet (heading L9088; 38 lines): francois marie arouet 0.95, voltaire* candide 0.95 (L9099), candide by voltaire* 0.95 (L9099), traite sur la tolerance 0.95 (L9108), voltaire* 0.75, dictionnaire philosophique 0.75 (L9102), candide 0.50 (L9099).
  - D’Holbach, Paul Thyry (heading L2714; 8 lines): d'holbach* 0.95, christianisme devoile 0.95 (L2720), la contagion sacree 0.95 (L2719), histoire critique de jesus christ 0.75 (L2718), systeme de la nature 0.50 (L2715).
  - Volney, Constantin-François (heading L9081; 2 lines): constantin francois volney* 0.95, volney* 0.75.
  - Dupuis, Charles-François (heading L2966; 1 line): charles francois dupuis* 0.95, origine de tous les cultes 0.95 (L2967).
  - Michelet, Jules (heading L5963; 6 lines): jules michelet* 0.95, michelet* 0.75.
  - Llorente, Juan Antonio (heading L5287; 8 lines): juan antonio llorente* 0.95, historia critica de la inquisicion de espana 0.95 (L5290).
  - Draper, John William (heading L2827; 1 line): john william draper* 0.95, history of the conflict* between religion and science 0.95 (L2828).
  - Mandeville, Bernard de (heading L5574; 2 lines): bernard mandeville* 0.95, bernard de mandeville* 0.95, fable of the bees 0.95 (L5576), mandeville* 0.50.
  - Meslier, Jean (heading L5922; 1 line): jean meslier* 0.95.

### Critical lives of Jesus

- List `index_jesus_critics` (rule index_jesus_critics; default on). Ground: canon 1399, classes 2, 3 and 6 (books that defend heresy or try to undermine the foundations of religion; books that of set purpose attack religion; books that attack a Catholic dogma). Choice of the rule author: lives of Jesus and critical readings of the Gospels by authors on the Index, and the authors who deny that Jesus existed.
- 20 names and titles under 7 headings; the Index prints 31 list lines under those headings (the works without an author's name are counted apart).
  - Renan, Ernest (heading L7351; 19 lines): ernest renan* 0.95, renan* vie de jesus 0.95 (L7358), renan* 0.75, vie de jesus 0.50 (L7358).
  - Strauss, David Friedrich (heading L8386; 1 line): david friedrich strauss* 0.95, strauss* das leben jesu 0.95 (L8387), david strauss* 0.75, das leben jesu 0.50 (L8387).
  - Steinmann, Jean (heading L159; 1 line): steinmann* la vie de jesus 0.95 (L160), jean steinmann* 0.75.
  - Kazantzakis, Nikos (heading L113; 1 line): nikos kazantzakis* 0.75, kazantzakis* 0.75, die letzte versuchung 0.75 (L114).
  - Guignebert, Charles (heading L3993; 1 line): charles guignebert* 0.95, guignebert* 0.75.
  - Couchoud, Paul-Louis (heading L2299; 2 lines): paul louis couchoud* 0.95, couchoud* 0.75.
  - Jacolliot, Louis (heading L4483; 6 lines): louis jacolliot* 0.95, la bible dans l'inde 0.95 (L4484), jacolliot* 0.75.

### Modernists on the Index

- List `index_modernists` (rule index_modernists; default on). Ground: canon 1399, classes 2 and 6 (books that defend heresy; books that defend errors condemned by the Holy See); the Index itself names modernism in several titles. Choice of the rule author: the authors and titles of the Modernist movement on the Index.
- 22 names and titles under 10 headings; the Index prints 70 list lines under those headings (the works without an author's name are counted apart).
  - Loisy, Alfred (heading L5314; 15 lines): alfred loisy* 0.95, loisy* l'evangile et l'eglise 0.95 (L5319), loisy* 0.75, l'evangile et l'eglise 0.50 (L5319).
  - Le Roy, Edouard (heading L5075; 5 lines): edouard le roy* 0.95, dogme et critique 0.75 (L5076).
  - Murri, Romolo (heading L6299; 5 lines): romolo murri* 0.95, murri* 0.50.
  - Buonaiuti, Ernesto (heading L1495; 9 lines): ernesto buonaiuti* 0.95, buonaiuti* 0.95.
  - Laberthonnière, Lucien (heading L4759; 7 lines): lucien laberthonniere* 0.95, laberthonniere* 0.95.
  - Fogazzaro, Antonio (heading L3281; 2 lines): antonio fogazzaro* 0.95, fogazzaro* 0.95.
  - Turmel, Joseph (heading L8711; 21 lines): joseph turmel* 0.95, turmel* 0.75.
  - Houtin, Albert (heading L4301; 5 lines): albert houtin* 0.95, houtin* 0.95.
  - Petre, Maude D (heading L6833; 1 line): maude petre* 0.95, george tyrrell* 0.95 (L6834), tyrrell* 0.50 (L6834).
  - Works without an author's name: il programma dei modernisti 0.95 (L9920).

### Philosophers on the Index

- List `index_philosophers` (rule index_philosophers; default off). Ground: canon 1399, classes 2 and 3 (books that defend heresy or try to undermine the foundations of religion; books that of set purpose attack religion). Choice of the rule author: philosophers on the Index who stood outside the Church or against it.
- 49 names and titles under 25 headings; the Index prints 57 list lines under those headings (the works without an author's name are counted apart).
  - Kant, Immanuel (heading L4557; 1 line): immanuel kant* 0.95, kritik der reinen vernunft 0.95 (L4558), kant* 0.75.
  - Hume, David (heading L4346; 1 line): david hume* 0.95, hume* 0.75.
  - Spinoza, Benedictus de (heading L8287; 3 lines): spinoza* 0.95, tractatus theologico politicus 0.95 (L8288).
  - Locke, John (heading L5297; 3 lines): essay concerning human* understanding 0.95 (L5298), reasonableness of christianity 0.95 (L5299), john locke* 0.75.
  - Hobbes, Thomas (heading L4245; 1 line): thomas hobbes* 0.95.
  - Rousseau, Jean-Jacques (heading L7626; 5 lines): jean jacques rousseau* 0.95, la nouvelle heloise 0.95 (L7631), rousseau* 0.75.
  - Montesquieu, Charles de Secondat de (heading L6170; 2 lines): montesquieu* 0.75, lettres persanes 0.75 (L6172).
  - Diderot, Denis (heading L2752; 2 lines): denis diderot* 0.95, diderot* 0.75, jacques le fataliste 0.95 (L2753).
  - Bayle, Pierre (heading L774; 5 lines): pierre bayle* 0.95.
  - Grotius, Hugo (heading L3909; 8 lines): hugo grotius* 0.95, grotius* 0.75.
  - Bruno, Giordano (heading L1422; 1 line): giordano bruno* 0.95.
  - Sartre, Jean-Paul (heading L77; 1 line): jean paul sartre* 0.95, sartre* 0.95.
  - Beauvoir, Simone de (heading L142; 2 lines): simone de beauvoir* 0.95, le deuxieme sexe 0.95 (L143), beauvoir* 0.75, les mandarins 0.50 (L144).
  - Unamuno, Miguel de (heading L146; 2 lines): miguel de unamuno* 0.95, unamuno* 0.95, del sentimiento tragico de la vida 0.95 (L147).
  - Bergson, Henri (heading L877; 3 lines): henri bergson* 0.95, l'evolution creatrice 0.95 (L879), bergson* 0.75.
  - Croce, Benedetto (heading L2352; 2 lines): benedetto croce* 0.95.
  - Gentile, Giovanni (heading L3574; 1 line): giovanni gentile* 0.95.
  - Comte, Auguste (heading L2199; 1 line): auguste comte* 0.95, cours de philosophie positive 0.95 (L2200).
  - Mill, John Stuart (heading L6013; 1 line): john stuart mill* 0.95, stuart mill* 0.95, principles of political economy 0.75 (L6014).
  - Bentham, Jérémie (heading L839; 4 lines): jeremie bentham* 0.95, bentham* 0.75.
  - Berkeley, George (heading L885; 1 line): george berkeley* 0.75.
  - Helvétius, Claude-Adrien (heading L4156; 2 lines): helvetius* 0.95.
  - La Mettrie, Julien Offray de (heading L4718; 2 lines): la mettrie* 0.95.
  - Condorcet, Marie-Jean-Antoine-Nicolas de (heading L2208; 1 line): condorcet* 0.75.
  - Fontenelle, Bernard Le Bovier de (heading L3291; 2 lines): fontenelle* 0.75.

### Historians on the Index

- List `index_historians` (rule index_historians; default off). Ground: canon 1399, classes 2, 3 and 6 (books that defend heresy or undermine the foundations of religion; books that attack religion; books that insult the hierarchy). Choice of the rule author: historians whose Index entries are histories of the Church, of the popes or of the ancient world.
- 21 names and titles under 10 headings; the Index prints 20 list lines under those headings (the works without an author's name are counted apart).
  - Gibbon, Edward (heading L3647; 1 line): edward gibbon* 0.95, gibbon* decline and fall 0.95 (L3648), decline and fall of the roman empire 0.50 (L3648).
  - Ranke, Leopold (heading L7237; 1 line): leopold von ranke* 0.95, leopold ranke* 0.95, die romischen papste 0.95 (L7238), ranke* 0.75.
  - Sarpi Paolo (heading L7850; 2 lines): historia del concilio tridentino 0.95 (L7851).
  - Sarpi, Paolo (heading L7854; 4 lines): paolo sarpi* 0.95, sarpi* 0.75.
  - Gregorovius, Ferdinand (heading L3861; 5 lines): ferdinand gregorovius* 0.95, gregorovius* 0.95.
  - Sismondi, Jean-Charles-Léonard Simonde de (heading L8186; 1 line): sismondi* 0.95.
  - Roscoe, William (heading L7577; 2 lines): william roscoe* 0.95, life and pontificate of leo the tenth 0.95 (L7578).
  - Hallam, Henry (heading L4068; 2 lines): henry hallam* 0.95, view of the state of europe during the middle ages 0.95 (L4070).
  - Taine, Hippolyte-Adolphe (heading L8463; 1 line): hippolyte taine* 0.95, taine* 0.75.
  - Döllinger, Johann Joseph Ignaz von (heading L2800; 1 line): ignaz von dollinger* 0.95, dollinger* 0.75.

### Novelists on the Index

- List `index_novelists` (rule index_novelists; default off). Ground: canon 1399, classes 9 and 3 (books that expressly treat of, tell or teach obscene things; books that of set purpose attack religion or good morals); the Index calls the novels of several authors "omnes fabulae amatoriae", all his love stories. Choice of the rule author: novelists, playwrights and poets on the Index.
- 39 names and titles under 21 headings; the Index prints 37 list lines under those headings (the works without an author's name are counted apart).
  - Hugo, Victor (heading L4330; 2 lines): victor hugo* 0.95, les miserables 0.95 (L4332).
  - Dumas, Alexandre (pater) (heading L2943; 1 line): alexandre dumas* 0.95.
  - Balzac, Honoré de (heading L606; 1 line): honore de balzac* 0.95, balzac* 0.75.
  - Flaubert, Gustave (heading L3241; 2 lines): gustave flaubert* 0.95, madame bovary 0.95 (L3242), salammbo 0.95 (L3243), flaubert* 0.75.
  - Zola, Emile (heading L9424; 1 line): emile zola* 0.95, zola* 0.75.
  - Stendhal, Henri Beyle de (heading L8349; 1 line): henri beyle* 0.95, stendhal* 0.75.
  - Dudevant, Amantine-Lucile-Aurore (heading L2912; 1 line): george sand 0.95, george sand's 0.95.
  - Sue, Eugène (heading L8420; 1 line): eugene sue* 0.95.
  - Gide, André (heading L98; 1 line): andre gide* 0.95, gide* 0.75.
  - Moravia, Alberto (Alberto Pincherle) (heading L95; 1 line): alberto moravia* 0.95.
  - Malaparte, Curzio (heading L83; 1 line): curzio malaparte* 0.95, malaparte* 0.95.
  - France, Anatole (heading L3329; 1 line): anatole france* 0.95.
  - Maeterlinck, Maurice (heading L5449; 1 line): maurice maeterlinck* 0.95, maeterlinck* 0.95.
  - D’Annunzio, Gabriele (heading L2458; 6 lines): gabriele d'annunzio* 0.95, d'annunzio* 0.95.
  - Casanova de Seingalt, Jacques (heading L1759; 1 line): casanova de seingalt* 0.95.
  - Sterne, Laurence (heading L8361; 1 line): laurence sterne* 0.95, sentimental journey through france and italy 0.95 (L8362).
  - Richardson, Samuel (heading L7435; 1 line): samuel richardson* 0.95, pamela or virtue rewarded 0.95 (L7436).
  - Heine, Heinrich (heading L4140; 4 lines): heinrich heine* 0.95.
  - Lamartine, Alphonse de (heading L4807; 3 lines): alphonse de lamartine* 0.95, lamartine* 0.75, la chute d'un ange 0.95 (L4810).
  - Alfieri, Vittorio (heading L258; 5 lines): vittorio alfieri* 0.95, della tirannide 0.95 (L259).
  - Murger, Henry (heading L6296; 1 line): henry murger* 0.95, murger* 0.95.

### Spiritism: Kardec and the periodicals (the names of a doctrine)

- List `index_spiritists` (rule spiritism; default on, inside the rule spiritism). Ground: canon 1399, class 7 (books that teach or recommend superstition, fortune-telling, divination, magic, the calling up of spirits and the like). Choice of the rule author: Allan Kardec and the periodicals and books of Spiritism on the Index (the names of a doctrine: the model decides, as in the rule on Spiritism).
- 12 names and titles under 4 headings; the Index prints 7 list lines under those headings (the works without an author's name are counted apart).
  - Denizart-Rivail, Hippolyte-Léon (heading L2636; 4 lines): allan kardec* 0.75, kardec* 0.75, denizart rivail* 0.75, le livre des esprits 0.75 (L2637), le livre des mediums 0.75 (L2638), le spiritisme a sa plus simple expression 0.75 (L2639).
  - Guldenstubbe, Louis de (heading L3999; 1 line): guldenstubbe* 0.75.
  - Cahagnet, Louis-Alphonse (heading L1563; 2 lines): louis alphonse cahagnet* 0.75, cahagnet* 0.75.
  - Works without an author's name: revue spirite 0.75 (L9984), revue spiritualiste 0.75 (L9985), le magnetiseur spiritualiste 0.75 (L9822).

### Socialists named by the Index (the names of a doctrine)

- List `index_socialists` (rule communism; default on, inside the rule communism). Ground: canon 1399, class 6 (books that defend errors condemned by the Holy See); Syllabus of Errors, section IV (Socialism, Communism). Choice of the rule author: the socialists whom the Index names (the Index names no Marx, Engels or Lenin).
- 8 names and titles under 5 headings; the Index prints 7 list lines under those headings (the works without an author's name are counted apart).
  - Proudhon, Pierre-Joseph (heading L7150; 1 line): pierre joseph proudhon* 0.75, proudhon* 0.75.
  - Fourier, Charles (heading L3319; 1 line): charles fourier* 0.75.
  - Cabet, Etienne (heading L1550; 1 line): etienne cabet* 0.75, cabet* 0.75.
  - Considerant, Victor (heading L2226; 2 lines): victor considerant* 0.75.
  - Enfantin, Barthélemy-Prosper (heading L3019; 2 lines): prosper enfantin* 0.75, enfantin* 0.75.

## 5. Categories that were looked at and not made

- Jansenism (Jansenius, Quesnel, Arnauld, Port-Royal, Unigenitus, the appeals): 50 lines under 26 headings by a title-keyword search (examples L444 ; L446 ; L810). Not made: The titles are Latin and French theology of the 1600s and 1700s; no YouTube title carries them except a history talk, and a rule would flag only history. The Curé names the Jansenists once (Sur la colère, quoted in rules.md under protestantism).
- Gallicanism, Febronianism, Josephinism (the state against Rome): 29 lines under 20 headings by a title-keyword search (examples L610 ; L1066 ; L1626). Not made: The same: church-and-state law of the 1700s, no recognisable names, no cue that a title would carry.
- Protestant and Reformation titles: 56 lines under 43 headings by a title-keyword search (examples L775 ; L778 ; L1078). Not made: The rule protestantism already looks at the content that a feed holds (pastors, worship nights); the Index prints no Luther or Calvin (before 1600), and the 56 lines are mostly polemics of the 1600s.
- the Bible, the Gospels and the Psalms (editions, translations, commentaries; classes 1, 4 and 5): 121 lines under 83 headings by a title-keyword search (examples L238 ; L247 ; L403). Not made: A cue would flag every Bible video; the lines are editions and commentaries of obscure authors; class 1 depends on who published the edition, which a title does not say.
- anti-papal and anti-clerical pamphlets (popes, papacy, Antichrist, clergy, priests, celibacy, monks, nuns, Jesuits, the Inquisition): 332 lines under 224 headings by a title-keyword search (examples L192 ; L315 ; L349). Not made: The largest group, and the nearest to the rule author's "anti-clerical" books; but the authors are mostly unknown today (Gregorio Leti alone has 22 lines of the 1600s). The recognisable ones are in the lists: Michelet, Llorente, Voltaire, Draper (anti-religious writers), Sarpi, Gregorovius, Ranke (historians). The rule anti_catholic already holds the phrases that attackers use today.
- duelling, suicide, divorce (class 8, first half): 5 lines under 5 headings by a title-keyword search (examples L2577 ; L2941 ; L3178). Not made: Five lines, none with a recognisable name; "divorce" and "suicide" are everyday words that no list should hold.
- love, marriage and sex as a subject (class 9, outside the novels): 37 lines under 31 headings by a title-keyword search (examples L123 ; L143 ; L515). Not made: The authors of "omnes fabulae amatoriae" are in the novelists; the rest (Mantegazza with 10 lines, Hesnard with 3, Michel, Oraison) are physicians and theologians whom a title would not name; the rules impure_words, impure_sights and bad_books look at the content itself.
- rationalism, deism, free thought, materialism, atheism (as a word in the title): 13 lines under 13 headings by a title-keyword search (examples L846 ; L2161 ; L2386). Not made: 13 lines of the 1700s and 1800s; the rules naturalism and denial_of_god hold the words, and no list of theirs names a person.
- Freemasonry (titles that name it): 9 lines under 4 headings by a title-keyword search (examples L120 ; L4570 ; L7303). Not made: Nine lines (section 8); not a category of names: the rule freemasonry holds the words.

## 6. Names left out, and why

- "donec corrigatur" lines ("forbidden until corrected") are never cues: Descartes (heading L2672), Francis Bacon ("Baco", heading L560), Leopardi (heading L5161), Goldsmith (heading L3756). The rule would flag an edition that a Catholic school uses.
- Catholic priests, religious and laymen of good standing are not in the philosophers', historians' or modernists' lists, by the rule author's choice as I understood his brief: Pascal (L6669: "Les provinciales" and an edition of the "Pensées" with the notes of Voltaire, not the Pensées), Malebranche (L5518), Fénelon (L3145), Montaigne (L6147), Condillac (L2202), Gioberti (L3662), Rosmini (L7591), Lord Acton (L187), Prohászka (L7138), Brémond (L1342), Gallarati Scotti (L3465). That these men were Catholics in good standing is my knowledge, not from the file, and not verified here.
- Maria Valtorta: the file prints the decree of 5 January 1960 on "Il Poema di Gesù and Il Poema dell'Uomo-Dio", and says that the decree calls the work anonymous and that it is by her. It is a book of private revelations (class 5), not an attack on the Church; no list names her.
- Names that are also places, streets, schools or animals, and so stand only in a fuller form or beside a title (section 7): Hugo, Dumas, Sand, Sue, France, Pamela, Casanova, Moravia, Gentile, Croce, Comte, Hobbes, Locke, Berkeley, Fourier, Rousseau (bare, 0.75 only), Strauss (bare), Mill, Gibbon (bare).
- Titles that are also something else: "La Pucelle d'Orléans" is Voltaire's obscene poem and also St. Joan of Arc's title in French (L9096): not a cue. "Notre-Dame de Paris" (Hugo, L4331) is the cathedral: not a cue; "Les Misérables" (L4332) is the novel and its adaptations: a cue at 0.95, because the rule is about the work and its adaptations.
- Titles in English that the Index does not print: not cues, however famous ("The Last Temptation of Christ", "The Social Contract", "Critique of Pure Reason"). The author's name catches most of them. If the rule author wants them, they could be added as a separate list, marked as translations and outside the check.

## 7. False alarms: what is guarded, what is spared, what is known

- Guarded by a pattern: a full name at 0.95 falls to 0.75 (the model decides) when a word of a street, school, hotel, station, restaurant, house or the like stands next to it: "Rue Voltaire", "Hotel Victor Hugo", "Victor Hugo metro station", "Rue Alexandre Dumas". The lists of words are in the pattern; the guard is looked at only after the name has matched, so a long description costs nothing (a test measures it).
- Spared by the cue not being there: "Calvin and Hobbes" (no bare "hobbes"), "Locke & Key" (no bare "locke"), "George Sanders" (the cue is the exact words "george sand" and "george sand's"), "Casanova" (2005 film), "Pamela Anderson", "Heine ketchup" (only "heinrich heine"), "Strauss: Also sprach Zarathustra" (no bare "strauss"), "Gibbons at the zoo" (no bare "gibbon"), "Berkeley campus tour" (only "george berkeley"), the cathedral of Notre-Dame and its fire.
- Left to the model (0.75, bare surnames): "Voltaire the French bulldog", "Voltaire Network", "Hume Highway", "Henri Rousseau", "Zola Budd", "Stendhal syndrome", "Renan Santos", "Loisy" the village, "Diderot" the university, "John Locke" of the television series "Lost", "Kazantzakis" the airport of Heraklion.
- Known and accepted: a video about a banned author by a Catholic who criticises him is flagged (the rule author's reading: it still discusses him); a video about an adaptation (a musical of "Les Misérables", a film of "Madame Bovary") is flagged; "Victor Hugo" in the title of a poetry reading is flagged although the Index prints two novels of his. Streets and hotels that bear no word of the guard list ("Victor Hugo Paris") are flagged.

## 8. The ideologies: which texts, and what each rule takes from them

- Read on 2026-11-26 and compared word for word by program with the text of the page named, ignoring case and white space (a space before a comma in the Vatican's HTML was ignored too):
  - Holy Office, decree of 1 July 1949 on Communism (Acta Apostolicae Sedis 41, p. 334; Latin; the OCR text of https://www.vatican.va/archive/aas/documents/AAS-41-1949-ocr.pdf; the question 4 and the answers were agreed on 28 June and approved by Pius XII on 30 June). The second question asks “utrum licitum sit edere, propagare vel legere libros, periodica, diaria vel folia, quae doctrinae vel actioni communistarum patrocinantur, vel in eis scribere” (whether it is lawful to publish, spread or read books, periodicals, newspapers or leaflets that champion the doctrine or the action of the Communists, or to write in them), and the answer is “Negative: prohibentur enim ipso iure (cfr. can. 1399 C. I. C.)” (No: they are forbidden by the law itself, see canon 1399). The first answer gives the reason: “communismus enim est materialisticus et antichristianus” (for Communism is materialistic and anti-Christian). The fourth question asks whether the faithful “qui communistarum doctrinam materialisticam et antichristianam profitentur, et in primis qui eam defendunt vel propagant” incur an excommunication reserved to the Holy See, and the answer is “Affirmative”. The decree dates from 1 July 1949 (“Datum Romae, die 1 Iulii 1949”). It is the text that ties Communism to canon 1399 and that the rule author's reading follows: what champions, defends or spreads the doctrine, not what warns against it. (The penalty is no longer law: the file says that canons 1399 and 2318 lost their force on 15 November 1966; the rule does not depend on the penalty.)
  - Holy Office, decision De spiritismo (Feria III, loco IV, 24 April 1917; “Datum Romae, ex aedibus Sancti Officii, die 27 aprilis 1917”; Acta Apostolicae Sedis 9, p. 268; Latin; the OCR text of https://www.vatican.va/archive/aas/documents/AAS-09-I-1917-ocr.pdf), approved by Benedict XV: asked “An liceat per Medium, ut vocant, vel sine Medio, adhibito vel non hypnotismo, locutionibus aut manifestationibus spiritisticis quibuscumque adsistere, etiam speciem honestatis vel pietatis praeseferentibus, sive interrogando animas aut spiritus, sive audiendo responsa, sive tantum aspiciendo” (whether it is lawful to be present at any spiritistic talk or manifestation, with a medium or without, even when it has the look of honesty or piety, whether by questioning souls or spirits, by listening to the answers, or only by looking on), the answer is “Negative in omnibus” (No, in everything).
  - Leo XIII, Quod apostolici muneris (28 December 1878), English, vatican.va, the opening: “that sect of men who, under various and almost barbarous names, are called socialists, communists, or nihilists”
  - Pius XI, Divini Redemptoris (19 March 1937), English, vatican.va: 58 “Communism is intrinsically wrong, and no one who would save Christian civilization may collaborate with it in any undertaking whatsoever.” Also 9 (“dialectical and historical materialism previously advocated by Marx”; “the class struggle”), 13 (“this Utopia of a really classless society”) and 3 (“bolshevistic and atheistic Communism”): the words that the Church itself uses for the doctrine, and the source of several cues.
  - Pius XI, Quadragesimo anno (15 May 1931), English, vatican.va, 120: “Religious socialism, Christian socialism, are contradictory terms; no one can be at the same time a good Catholic and a true socialist.”
  - Pius IX, Quanta cura (8 December 1864), Latin, vatican.va, with the Syllabus of Errors appended: “§ IV. Socialismus, Communismus, Societates clandestinae, Societates biblicae, Societates clerico-liberales”, and in the encyclical itself “funestissimum Communismi et socialismi docentes ac profitentes errorem”. The English of the Syllabus is that of papalencyclicals.net (the page that rules.md already uses): “IV. SOCIALISM, COMMUNISM, SECRET SOCIETIES, BIBLICAL SOCIETIES, CLERICO-LIBERAL SOCIETIES. Pests of this kind are frequently reprobated in the severest terms in the Encyclical “Qui pluribus,” Nov. 9, 1846”. Qui pluribus (English, papalencyclicals.net): “the unspeakable doctrine of Communism, as it is called, a doctrine most opposed to the very natural law”. The Vatican's own page of Qui pluribus is in Italian only.
  - Catechism of the Catholic Church 2425 (vatican.va, https://www.vatican.va/archive/ENG0015/__P8C.HTM): “The Church has rejected the totalitarian and atheistic ideologies associated in modem times with "communism" or "socialism."” (the page prints "modem" for "modern").
  - The Message of Fatima (Congregation for the Doctrine of the Faith, 26 June 2000, English, vatican.va), the words of Our Lady on 13 July 1917: “If my requests are heeded, Russia will be converted, and there will be peace; if not, she will spread her errors throughout the world, causing wars and persecutions of the Church.”
  - Pius X, Pascendi dominici gregis (8 September 1907), English, vatican.va: 39 “the synthesis of all heresies”; 7 “vital immanence”; 6 “Agnosticism”; 10 “the religious sentiment”; 13 “the intrinsic evolution of dogma” and “Dogma is not only able, but ought to evolve and to be changed”; 23 “to shape itself to democratic forms”; 28 “there is to be nothing stable, nothing immutable in the Church”; 30 “the Christ of history and the Christ of faith”.
  - Catechism of St. Pius X (the file `docs/en/st-pius-x/catechism.md`, First Commandment; the tests check these three quotations in it):
    - Quote (catechism.md): “Is it lawful to put questions to speaking or writing tables or in any way to consult the souls of the dead by means of spiritism?”
    - The answer. Quote (catechism.md): “All the practices of spiritism are unlawful, because they are superstitious; and often they are not free from diabolical intervention; and hence they are rightly condemned by the Church.”
    - And. Quote (catechism.md): “The First Commandment also forbids all dealings with the devil, and all association with anti-Christian sects.”
  - Humanum genus (Leo XIII, 1884) and the Declaration on Masonic Associations (CDF, 26 November 1983): the quotations of rules.md, read on the pages named there; not repeated here.
- The other folders of `docs/en/` (hesse, kempis, lefebvre, ottaviani, stobnicki, tam, teresa, williamson) were searched for communism, socialism, freemasonry, liberalism, modernism: they hold talks, sermons and essays, not Church documents, so nothing of them is cited. Not cited: Lamentabili sane exitu (1907), whose English text I found on papalencyclicals.net and not on vatican.va (Pascendi, which is on vatican.va, suffices for the vocabulary of Modernism).
- Freemasonry in the Index: canon 1399 class 8 forbids books that "present the Masonic and similar sects as useful and harmless". The file prints nine lines that name Freemasonry in the title: L120 (Scheichelbauer, "Die Johannis-Freimaurerei. Versuch einer Einführung", the decree of 16 January 1954), L4570 (Keller, "Die geistigen Grundlagen der Freimaurerei", 1916), L7303 and L7304 (Reghellini, 1836), L9671 ("Examen critico de las causas de la persecucion que han experimentado los francmasones y explicacion de las bulas de los sumos pontifices", 1820), L9717 ("Historia da franc-maçonaria", 1846), L9734 ("Initiation", a review of 1891 on hypnotism, theosophy, Kabbalah, Freemasonry and the occult sciences), L9954 ("Relation apologétique et historique de la société des franc-maçons", 1739), L10118 (a German pamphlet of 1817 on the Jesuits and the suppression of the Masonic order). By their titles, most are writings of Masons or on their behalf (an apology, an introduction, the foundations of Freemasonry), which is what the class describes; the file gives no more than the titles.
- Cues that are the list author's wording, not a text of the Church: every phrase of the 0.95 tiers ("workers of the world unite", "why communism works", "dogma evolves", "the Church must change with the times", "spiritist centre"), and every 0.75 and 0.50 cue that no document above uses. The words that the documents do use are cues because they are the Church's own names for the thing (dialectical materialism, class struggle, classless society, proletariat, bolshevism; vital immanence, agnosticism, evolution of dogma, the Christ of faith; spiritism, speaking tables).

## 9. Left out, and why

- Action Française. The file prints 14 lines: Maurras with 7 works (decree year 1926, L5818 to L5824), Léon Daudet with 2 (1927 and 1932, L2490 and L2491), the review "Action (L’) Française (Revue Bimensuelle et Diarium usque ad diem 10 iulii anni 1939)" (1926, L9462), "Action (L’) Française et le Vatican (Les Pièces d’un procès)" (1927, L9461), and three pamphlets of 1928 (L2313, L2562, L5914). It is a political movement, not a doctrine: there is no vocabulary to build cues from beyond the name of the movement and two authors; the file prints the review as forbidden "up to the day of 10 July 1939" and does not say what happened then. Whether videos about it should be flagged is for the rule author to decide; the names are checked and can be added as one more list.
- Liberalism and laicism. The Syllabus (Latin, vatican.va, in Quanta cura) has a section “§ X. Errores qui ad liberalismum hodiernum referuntur” (errors that refer to modern liberalism); the later documents on it were not read. But in a YouTube title "liberalism" is overwhelmingly the political or economic word, and the Church's sense (the sovereignty of reason or of the state over the Church) has no phrase that a title carries. Left out.
- Theosophy. The file prints it in two titles (L469, a work of the 1600s; L9734, the review "Initiation", 1891). The rule sects already holds "theosophy" (0.75). No new rule.
- Nazism. The file prints two works of Alfred Rosenberg (L7585 "Der Mythus des 20 Jahr hunderts" 1934, L7586 "An die Dunkelmänner unserer Zeit" 1935); the Church documents on it were not read; documentaries on the Second World War would be the main false alarm. Not made; a candidate if the rule author asks.
- Americanism, Gallicanism, Jansenism: section 5.

## 10. How it is checked

- `tests/index-names.test.js`: the lists are the Index's (every group has its heading and every entry is in that author's block), the check is not vacuous (it refuses a name that the Index prints under another heading), the twelve classes are in the introduction, and every quotation marked `Quote (forbidden.md)` here and in rules.md is in the file word for word.
- `tests/anticatholic-rules.test.js`: the settings of the new rules, the word lists of the ideologies, the guards (Catholic warnings spared, namesakes spared), the speed of the patterns on a very long description.
- `tests/rule-examples.test.js`: every example of every rule is flagged, every spared title is not, by the real rules and lists.
- The quotations of the Church texts in section 8 were compared by a script with the text that was read (kept outside the repository); a reader can repeat them on the pages named.
