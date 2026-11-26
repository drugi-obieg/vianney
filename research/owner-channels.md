# The four channels the owner named: what their titles do to the rules

Fetched on 2026-11-26 from the public video lists of the four channels the owner named, with a headless Chrome (signed out, English): the titles only, nothing else. They are Catholic channels that talk about the topics of the "against" rules from the Catholic side. The owner's words: "You only really need to fetch the YT title: one indicator is if the Channel name is Catholic-related ("Apostolic", "apostolado", "Ascent of Mount Carmel") but the content is about the topic that is usually in the "against" rule: strong indicator that this a warning-type video, not a video spreading bad content".

## What was fetched
- Apostolic Majesty (@ApostolicMajesty): 51 titles.
- Ascent of Mount Carmel (@ascentofmountcarmel438): 447 titles.
- Apostolado Glórias de Maria (@apostoladogloriasdemaria4063): 406 titles.
- Annulment Proof (@AnnulmentProof): 162 titles.
- In all: 1066 titles. About a third of Apostolado Glórias de Maria's are in Portuguese; the rules and the model are English, so those titles do nothing to them and none was used as an example.

## What the shipped rules do with them (word lists only, as the extension runs without a model; measured with `Engine.evaluateQuick` on the title and the channel name)
- With the rules on by default: no title is flagged, in any of the four channels; 29 sit in the uncertain band (a model would be asked).
- With every rule switched on: 2 titles are flagged: "Ouija Boards" (divination, 0.95) on Ascent of Mount Carmel; "David Hume's Influence on John Henry Newman" (index_philosophers, 0.95) on Ascent of Mount Carmel. The first is a Catholic channel warning about the Ouija board: exactly the false alarm the channel name is for. The second was flagged as a video that discusses a banned author; the owner then said: "discussing a banned author -> yeah, well in this case its about the life of the person David Hume (historical), not 'operes omnia' (his works), that's the difficulty". So the six rules on authors of the Index now flag the BOOKS and ideas and spare a title about the LIFE or the history of the person: `spare words: life_words` (a list of words of a life: biography, born, died, exile, "influence on", ...) lowers a strong hit into the band, and `confirm: model` lets a model that is there overrule the hits that carry no such word. This title is a `spared:` line of index_philosophers now.
- Where the word list sees the topic at all (a hit of weight 0.5 or more), per rule: communism 18, protestantism 10, modernism 8, lords_name 7, judaism 7, naturalism 6, denial_of_god 5, gossip 3, anti_catholic 1, calumny 1, rash_judgment 1, impure_words 1, divination 1, occult 1, indifferentism 1, islam 1, index_philosophers 1. These are the titles on which a model has to say no for a Catholic warning; the ones at 0.75 are asked, the ones at 0.5 are below the band and are never flagged.

## What was done
- A rule key `spare channel: catholic_channels` (core/rules.js, core/engine.js, core/sensitivity.js SPARE_DROP 0.05, a choice): when the channel name of a card hits the list `extension/lexicon/catholic_channels.txt` (65 entries, a choice of the rule author: catholic, apostolic, apostolad*, carmel*, rosary, dominican*, vatican*, ... and their Portuguese, Spanish, Italian and French forms), a strong word-list hit of the rule is lowered to just under the flag level: the model decides, and without a model nothing is flagged. Only the channel is looked at, never the title ("Apostolic" in a title can be a Pentecostal church). Words that a name or another kind of channel also has are left out on purpose (saint, sao = Sword Art Online, monk, priest = Judas Priest, padre, marian, fatima, lourdes, guadalupe, abbey, rosario).
- The 16 rules of the groups "Unbelief and other religions" and "Anti-Catholicism" that are about an error have it (denial_of_god, naturalism, indifferentism, protestantism, islam, judaism, eastern_religions, sects; mockery_of_faith, anti_catholic, divination, occult, freemasonry, communism, modernism, spiritism). The six rules about books on the Index do not have it: the owner wants the books flagged from whichever channel; what they spare is a title about the LIFE of the author (the next lines). The rules of the groups about swearing, people, lewdness and games do not either.
- A line of examples may name its channel after " @ " (`splitLine` in core/rules.js); the tests, the check on the rule examples, the settings page and the examples that are shown to the model use it as the engine does with a card.
- 24 of the titles were added as `spared:` lines to the rules they concern (what a Catholic channel says about the topic of the rule), each with its channel:
  - lords_name: "Jesus Christ: His Life, His Passion, His Triumph #1 @ Apostolado Glórias de Maria"
  - anti_catholic: "The Anti-Catholic Agenda of Parish Hymns @ Apostolado Glórias de Maria"
  - divination: "Ouija Boards @ Ascent of Mount Carmel"
  - occult: "NEW AGE AND PERENNIALISM - THE OUROBOROS OF MODERN HISTORY @ Apostolado Glórias de Maria"; "Gradualism and Demonic Possession @ Ascent of Mount Carmel"
  - denial_of_god: "Atheism is a Stupid Religion @ Ascent of Mount Carmel"; "The Glacier Priest on Atheism @ Ascent of Mount Carmel"
  - naturalism: "Materialism @ Ascent of Mount Carmel"; "Humanistic Personalism and the Inversion of the Common Good #03 @ Apostolado Glórias de Maria"
  - protestantism: "Protestantism: Origins and Impacts - EP 1 @ Apostolado Glórias de Maria"; "Changing Validity of Protestant Baptisms @ Ascent of Mount Carmel"; "The New American Bible is a Bad Protestant Bible - Part Thirteen @ Ascent of Mount Carmel"
  - islam: "Questions Novus Ordo Catholics Can't Answer: Koran Kissing @ Ascent of Mount Carmel"
  - judaism: "Presentation of the book "The Synagogue and the Catholic Church" @ Apostolado Glórias de Maria"; "Tikkun Olam in the Mishnah and in the Aleinu - 1 @ Apostolado Glórias de Maria"; "Evolutionism and Kabbalah @ Apostolado Glórias de Maria"
  - freemasonry: "Questions Novus Ordo Catholics Can't Answer - WHY Can't Catholics be Masons @ Ascent of Mount Carmel"
  - communism: "Leninism and Bolshevism @ Apostolic Majesty"; "Top Reasons to Oppose Communism @ Ascent of Mount Carmel"; "1. Communist Infiltration of the Catholic Church - Bella Dodd @ Ascent of Mount Carmel"
  - modernism: "An Ode to Modernism @ Ascent of Mount Carmel"; "Liberals, Modernists, and the Gospel for the Fourth Sunday of Lent @ Ascent of Mount Carmel"; "New Course: From the Synagogue to Modernism @ Apostolado Glórias de Maria"
  - spiritism: "Ouija Boards @ Ascent of Mount Carmel"

## Not done, and why
- No rule about divorce exists, so the titles of Annulment Proof (162, about divorce and annulment from a Catholic view) do nothing to any rule, and none was added as an example. The Index names divorce in canon 1399, class 8 ("books that hold duelling, suicide or divorce to be lawful"); the first round of this work left it out because the Index itself names few such books. If the owner wants a rule that flags content that presents divorce as acceptable, these titles are its counter examples.
- The titles of the Portuguese kind are not examples: the model (Kev-0.6B) is English only.
- The channels can also be put on the Allow list of the settings (Allow & Block): a channel there passes without any check, which is the sure way for a channel the owner trusts; `spare channel` is for the many he has not listed.
