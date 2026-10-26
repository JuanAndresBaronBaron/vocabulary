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
- 2 to 4 lessons per unit. Every item has an `id` unique in its unit: `u03-l1-i1`, `u03-l1-i2` … Questions inside
  a reading/listening set have ids too: `u03-l2-i1-q1` …
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
| `gap` | `text` with exactly one `___`, `answer`: [accepted strings, first is canonical], `limit` (e.g. `"ONE WORD AND/OR A NUMBER"`), `why` |
| `select` | `q` (instruction), `options`: [strings, e.g. `"i  The cost of delay"` or `"A  Dr Patel"`], `rows`: [{`label`, `answer`: index}], `why`? |
| `order` | `q`, `items`: [strings in the correct order, 3-6], `why` |
| `reading` | `title`, `minutes`, `paragraphs`: [{`label`: "A"… or null, `text`}], `sets`: [{`instr`, `items`: [scored items]}] |
| `listening` | `title`, `part`: 1-4, `context` (what the candidate hears first), `speakers`: [{`id`, `name`, `voice`: "f"/"m"}], `script`: [{`s`: speaker id, `t`: text}], `sets`: [{`instr`, `items`: [scored items]}] |
| `writing` | `task`: 1 or 2, `prompt`, `visual`? (Task 1, see below), `minutes`, `minWords`, `plan`?: [strings], `model`: {`text`: [paragraphs], `notes`: [why it is band 9]} |
| `speaking` | `part`: 1-3, `topic`, `questions`? (Part 1 and 3), `cue`? (Part 2: {`task`, `bullets`: [..], `close`}), `prep` (seconds, 60 for Part 2, 0 otherwise), `talk` (seconds per answer: P1 30, P2 120, P3 60), `model`: {`text`: [paragraphs], `notes`: [..]}, `phrases`?: [strings] |
| `say` | `text`, `ipa` (British, in slashes), `tip` — pronunciation drill: listen, record, compare |

`gap` answers are checked case-insensitively, ignoring surrounding spaces and final punctuation. List spelling and
number variants (`["19th", "nineteenth", "19"]`). British spelling is canonical; add the US spelling only if
IELTS accepts it (it does accept US spelling).

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
rect) or `water`. Add a compass note in the title when it matters ("North is at the top").

## Bands

Tests use the official Academic conversion for a 40-question paper and scale shorter tests to 40:
Listening 39-40 = 9, 37-38 = 8.5, 35-36 = 8, 32-34 = 7.5, 30-31 = 7, 26-29 = 6.5, 23-25 = 6, 18-22 = 5.5, 16-17 = 5,
13-15 = 4.5, 10-12 = 4. Academic Reading 39-40 = 9, 37-38 = 8.5, 35-36 = 8, 33-34 = 7.5, 30-32 = 7, 27-29 = 6.5,
23-26 = 6, 19-22 = 5.5, 15-18 = 5, 13-14 = 4.5, 10-12 = 4.
