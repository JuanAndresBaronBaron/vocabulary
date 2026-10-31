# IELTS Prep data (format 1)

All learner-facing text is **British English** (spelling, vocabulary, IPA). Academic module only.
Every file is UTF-8 JSON. Validate with `python3 tests/e2e/ielts_validate.py`.

## index.json

```json
{"format": 1,
 "blocks": [{"id": "start", "title": "Start here", "units": [1, 2]}, ...],
 "units": [{"id": "u01", "n": 1, "block": "start", "title": "The exam and the bands", "available": true}, ...]}
```

Blocks: `start`, `listening`, `reading`, `writing`, `speaking`, `language`, `mock`.

## uNN.json

```json
{"format": 1, "id": "u03", "n": 3, "block": "listening", "title": "Part 1: forms and details",
 "summary": "After this unit you can …",
 "lessons": [{"id": "u03-l1", "title": "…", "kind": "learn", "minutes": 10, "items": [ … ]}]}
```

- `kind`: `learn` (explanations plus instant feedback), `practice` (instant feedback, exam-style), `test`
  (timed, no feedback until the end, scored as a band). A `test` lesson has `"timed": <seconds>`.
- `exam`?: `true` only on a `test` lesson whose scored items are all in `listening` items (cards may sit between
  them): the player runs it as the computer-delivered Listening paper.
- 2 to 5 lessons per unit. Every item has an `id` unique in its unit: `u03-l1-i1`, `u03-l1-i2` … Questions inside
  a reading/listening set have ids too: `u03-l2-i1-q1` …
- **Never renumber an id**: learners' saved runs and review cards use them. A new lesson, item or question takes the
  next free number, even when it appears earlier in a list (`u09-l3-i1-q14` may sit between `q5` and `q10`). The
  number a learner sees comes from the position, not from the id.
- **Reordering the options of an existing `pick`, `multi` or `select` changes what saved answers mean**: a run stores
  the index of the option chosen (`ielts:run:<lid>`.ans). Do it only with a one-time migration that maps each old
  index to the new one in every saved run (guarded by a flag such as `ielts:mig:content1`), and never change the text
  of an option in a way that changes its meaning. The flag must survive "Erase my progress" (`prog.erase()` keeps every
  `ielts:mig:*` key): erasing does not reload the page, so runs saved after an erase already use the new order, and a
  migration that ran again on the next load would map them a second time. Adding options at the end is safe.
- Inline markup in any text: `**bold**`, `*italic*`. Nothing else (no HTML, no links).

## Item types

Scored question types (`pick`, `multi`, `tfng`, `gap`, `select`, `order`) can stand alone or sit inside a
`reading`/`listening` set. Each scored question counts as 1 mark, except `select` and `multi` which count one mark per
row / per correct option (as in the real exam: a "choose TWO" question is 2 marks).

| type | fields |
|---|---|
| `card` | `title`, `body`: [paragraph strings], `list`?: [strings], `examples`?: [{`text`, `note`?}] (each has a speaker button), `tip`? |
| `pick` | `q`, `options`: [2-5 strings], `answer`: index, `why` |
| `multi` | `q` ("Choose TWO letters…"), `options`: [5 strings], `answer`: [index, index], `why` |
| `tfng` | `mode`: `"tfng"` (facts: TRUE/FALSE/NOT GIVEN) or `"ynng"` (writer's views: YES/NO/NOT GIVEN), `statement`, `answer`: `"T"`/`"F"`/`"NG"` or `"Y"`/`"N"`/`"NG"`, `why` |
| `gap` | `text` with exactly one `___`, `answer`: [1-16 accepted strings, first is canonical], `limit` (e.g. `"ONE WORD AND/OR A NUMBER"`, see Word limits), `why` |
| `select` | `q` (instruction), `options`: [strings, e.g. `"i  The cost of delay"` or `"A  Dr Patel"`], `rows`: [{`label`, `answer`: index}], `why`? |
| `order` | `q`, `items`: [strings in the correct order, 3-6], `why` |
| `reading` | `title`, `minutes`, `paragraphs`: [{`label`: "A"… or null, `text`}], `sets`: [{`instr`, `visual`?, `items`: [scored items]}] |
| `listening` | `title`, `part`: 1-4, `context` (what the candidate hears first), `speakers`: [{`id`, `name`, `voice`: "f"/"m", `accent`?}], `script`: [{`s`: speaker id, `t`: text, `pause`?}], `sets`: [{`instr`, `visual`?, `items`: [scored items]}] |
| `writing` | `task`: 1 or 2, `prompt`, `visual`? (Task 1, see below), `visual2`? (Task 1 only: a second visual), `minutes`, `minWords`, `plan`?: [strings], `model`: {`text`: [paragraphs], `notes`: [why it is band 9]}, `exemplars`?: [1-3 {`band`, `text`, `notes`}] |
| `speaking` | `part`: 1-3, `topic`, `questions`? (Part 1 and 3), `cue`? (Part 2: {`task`, `bullets`: [..], `close`}), `followups`? (Part 2 only: 1-2 question strings), `prep` (seconds, 60 for Part 2, 0 otherwise), `talk` (seconds per answer: P1 30, P2 120, P3 60), `model`: {`text`: [paragraphs], `notes`: [..]}, `phrases`?: [strings] |
| `say` | `text`, `ipa` (British, in slashes), `tip` — pronunciation drill: listen, record, compare |

`gap` answers are checked case-insensitively, ignoring surrounding spaces and final punctuation. List spelling and
number variants (`["19th", "nineteenth", "19"]`). British spelling is canonical; add the US spelling only if
IELTS accepts it (it does accept US spelling). When a unit is printed beside the gap (`£___`, `every ___ minutes`),
also accept the answer typed with the unit, if it stays within the limit (`"£185"`, `"15 minutes"`).

### Optional fields

| field | where | meaning |
|---|---|---|
| `exam: true` | a `test` lesson | Only when every scored item of the lesson is in a `listening` item: the computer-delivered Listening paper. |
| `pause` | a `listening` script line | A whole number of seconds, 5-60: silence after that line (time to read the next questions or check answers). The line's `s` is a normal speaker, usually `{"id": "nar", "name": "Narrator", "voice": "m"}` listed in `speakers`, saying for example "You now have some time to look at questions 5 to 10." |
| `accent` | a `listening` speaker | One of `gb`, `us`, `ca`, `au`, `nz`, `ie`, `za`: the voice to prefer when the browser has one (British otherwise). The script is still written in British spelling. |
| `visual` | a `reading` or `listening` set | A visual (see Task 1 visuals) drawn above the set's questions: the plan, map or diagram to label, or the table to complete. Any set whose `instr` contains "Label the" must have one. |
| `mark: true` | a map item | A marker: `label` is a letter or number (1-3 characters) drawn bold in a circle at the centre of the item's box, over the item's shape like any map item (`rect` when `shape` is left out): a room or building to label. A marker whose `w` and `h` are both 0 is a callout: only the circle, at (`x`, `y`), on a feature drawn by other items (a layer of a cross-section, a point in a borehole); a callout has no `shape`. Do not label a marked place in words: the learner supplies that. |
| `alt` | a `map` visual | A text alternative for screen readers, read after the drawing (hidden on screen): what the plan or diagram shows and where each marker is, in the words of the drawing (compass points and the drawing's own labels), not of the script or passage, so that it never gives an answer away: "C: a small building in the south-east corner", not "C: on the right, just inside the entrance". Give one to every plan, map or diagram that a set asks the learner to label. |
| `visual2` | a Task 1 `writing` item | A second visual, shown under `visual` (for example pie charts plus a table). Task 1 only. |
| `followups` | a Part 2 `speaking` item | 1-2 short questions the examiner may ask after the long turn ("Do you still...?"). Part 2 only. |
| `exemplars` | a `writing` item | 1-3 sample answers below band 9 for comparison: `{"band": 6.5, "text": [2-8 paragraphs], "notes": [1-6 strings]}`. `band` is 5-9 in half bands; each `text` has at least `minWords` words. |

### Word limits

`limit` is one of these, in capitals: `ONE WORD`, `ONE WORD ONLY`, `TWO WORDS`, `ONE OR TWO WORDS`,
`TWO OR THREE WORDS`, `NO MORE THAN TWO WORDS`, `NO MORE THAN THREE WORDS`, any of these followed by
`AND/OR A NUMBER`, or `A NUMBER`. Words allowed: ONE = 1, TWO = 2, THREE = 3, ONE OR TWO = 2, TWO OR THREE = 3,
`A NUMBER` alone = 0. `AND/OR A NUMBER` (and `A NUMBER`) also allows one number. An unknown limit is an error.

**Every accepted answer must fit its limit** (ielts.org: "You will lose the mark for writing more than the word
limit."). The answer is split on spaces, so a hyphenated word (*check-in*) counts as one word; a run of consecutive
tokens that each contain a digit is one number, so `07700 911483`, `BS7 4QD`, `10:15`, `£85` and `14th` are each one
number; spelled-out numbers are words (`one hundred and fifty` is five words). Prefer figures in the answer list.

### Exam rules the validator enforces

- Every accepted `gap` answer fits its limit (above).
- A set whose `instr` contains "Label the" has a `visual`.
- In a `test` lesson with 4 or more `pick` questions, no answer index holds more than half of their keys.
- In a unit with 3 or more `multi` questions, no answer pair (the same set of letters) holds more than half of them.
- A map marker's box is either 0 × 0 (a callout, with no `shape`) or has both a width and a height; `alt` is a
  non-empty string, on a `map` visual only.
- Listening answers come in script order within a set; Reading answers follow the passage order except in matching
  information, matching headings and diagram labelling. (Checked by reviewers, not by the validator.)

Listening scripts must contain every answer in the order the questions are asked, with realistic distractors
(a corrected figure, "no, sorry, that's wrong…"). Part 1: two speakers, everyday; Part 2: one speaker, everyday;
Part 3: two to four speakers, academic; Part 4: one speaker, academic lecture. Voices are read aloud by the browser's
British voice, so write for the ear: numbers as people say them ("double three", "fifteen pounds fifty").

### Task 1 visuals

```json
{"kind": "line"|"bar", "title": "…", "unit": "%", "x": ["2000", "2005", …], "series": [{"name": "…", "values": [..]}]}
{"kind": "pie", "title": "…", "charts": [{"title": "1990", "slices": [{"label": "…", "value": 40}]}]}
{"kind": "table", "title": "…", "head": ["", "2010", "2020"], "rows": [["Rail", "12", "18"]]}
{"kind": "process", "title": "…", "steps": [{"label": "…", "note": "…"}], "cycle": false}
{"kind": "map", "title": "…", "maps": [{"title": "1990", "items": [{"label": "Car park", "x": 10, "y": 60, "w": 30, "h": 20, "shape": "rect"}]}]}
```

Map coordinates are on a 0-100 grid (x to the right, y downwards); `shape` is `rect`, `circle`, `road` (a long thin
rect) or `water`. Add a compass note in the title when it matters ("North is at the top"). A map item with
`"mark": true` is a marker (see Optional fields): `{"label": "C", "mark": true, "x": 72, "y": 68, "w": 16, "h": 13,
"shape": "rect"}` draws a building with a circled C on it (so does the same item without `shape`);
`{"label": "6", "mark": true, "x": 16, "y": 25, "w": 0, "h": 0}` draws only the circled 6. A map can also be a
labelled diagram (a cross-section, a machine): draw the parts as items and put numbered markers on the parts to label.
Labels are drawn 4.2 units high and wrap to the width of their box; a label that does not fit its box is set smaller,
down to 3.2 units, so give each labelled box room for its words (about 2.5 units per character, 4.7 per line).

A set `visual` uses the same kinds: a `map` for a plan, map or diagram to label (markers A-H or the question
numbers), a `table` for table completion, with each blank written as its question number and a line
(`"(10) ________"`) so that it matches the numbered gap questions below it.

## Bands

Tests use the usual conversion, approximate: cut-offs vary slightly between test versions (ielts.org publishes only the
anchors 16 = 5, 23 = 6, 30 = 7 and 35 = 8 for Listening, and 15 = 5, 23 = 6, 30 = 7 and 35 = 8 for Academic Reading:
https://ielts.org/organisations/ielts-for-organisations/ielts-scoring-in-detail). Shorter tests are scaled to 40:
Listening 39-40 = 9, 37-38 = 8.5, 35-36 = 8, 32-34 = 7.5, 30-31 = 7, 26-29 = 6.5, 23-25 = 6, 18-22 = 5.5, 16-17 = 5,
13-15 = 4.5, 10-12 = 4. Academic Reading 39-40 = 9, 37-38 = 8.5, 35-36 = 8, 33-34 = 7.5, 30-32 = 7, 27-29 = 6.5,
23-26 = 6, 19-22 = 5.5, 15-18 = 5, 13-14 = 4.5, 10-12 = 4.

Band estimates in the app count only first attempts (or a repeat 60+ days later) and pool the newest counted tests up to
40 questions (js/ielts.js, prog.latestInfo).
