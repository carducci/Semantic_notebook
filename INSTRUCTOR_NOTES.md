# Instructor Notes — Workshop Labs (notebook1)

Per-lab choreography for the workshop. Each lab lists: seed state, the live arc,
the one discrepancy event the lab exists for, and stage gotchas. Companion to
the deck ("An Engineer's Guide to the Semantic Layer"); deck cue points refer to
slide numbers as of 2026-07-12 and shift as the deck is renumbered.

**Standing rules (apply to every lab):** phenomenon before name; one
discrepancy event per lab; seeds fire zero visible inference before Lab 5;
schema.org stays "some other system's dialect" until the web-scale reveal;
nothing invites "what if triples disagree" before the named-graphs beat.

**Authoring convention (retroactive, 2026-07-12):** any Turtle surface that
mixes instance data and vocabulary axioms labels its sections with boxed
comments — `# ── <whose> data/file ──` vs `# ── <vocab> ontology (excerpt) ──`
— so the data/ontology distinction is visible in every frame before it's ever
taught. Applied to the Lab 4/5/6 seeds and michael-foaf.ttl; JSON-LD datasets
can't carry comments, so there the convention is structural (alignment nodes
grouped last in @graph).

**Runtime behavior worth knowing on stage:**
- Parse is the only commit — nothing updates on keystroke.
- Cumulative panels (Full Graph, Entities "All", Vocabulary) refresh when
  *their own* lab parses, and populate from everything earlier when first
  scrolled into view. Forward flow always looks right; **re-parsing an earlier
  lab does not ripple into a later lab's already-open panels** until that later
  lab's next Parse.
- Reasoning runs on every Parse but sees **only the current lab's graph** —
  type assertions and the axioms that act on them must be asserted in the same
  lab. (Cross-lab reasoning is a pending architecture decision.)
- Unmapped JSON keys are caught by an invisible `@vocab` and minted as
  `urn:sembook:implied:` predicates so they stay visible in the graph — they
  render as "still magic strings" until mapped.

---

## Lab 1 — Identity and Connection (deck 1a–1c)

**Seed:** two plain-JSON islands (GEB book / Hofstadter author), no context.
**Live arc (four states):** raw parse (blank amber nodes, two islands) →
add `@base` + map `id` → `@id` (nodes teal, IRIs appear, still two islands) →
map `author_id` to `{"@type": "@id"}` (THE edge snaps, one graph) → Fetch
`hofstadter-extended.jsonld` into Document B (properties explode, same IRI, no
mapping).
**Discrepancy event:** the edge snap — one line of context connects two systems.
**Gotchas:** the term-mapping pass (deck Lab 1c) maps `title`, `published`,
etc. to `https://example.com/ns#…` — later labs assume those IRIs exist, do
not skip it. Amber → teal is the identity lesson; narrate the color change.

## Lab 2 — Data and Context (deck Lab 2)

**Seed:** Elizabeth biography record, body uses bare `@id`s (slide 130). The
context maps `title` → `ex:title` and demonstrates the nested-context pattern
once (`about.title` → `ex:positionHeld`). `name` and `isbn` are deliberately
unmapped (`implied:` predicates); the author's `title` deliberately inherits
the outer mapping — "Biographer" lands on `ex:title`.
**Live arc:** read the collision (three `title`s), walk the nested-context
resolution for the queen, then let the room fix the author's title and map
`isbn`/`name` themselves.
**Discrepancy event:** same key, different meanings, resolved per-context —
and the leftover collision the room fixes by applying the pattern.
**Tabs:** Local Graph + Vocabulary only.
**Gotchas:** keep everything in `ex:` — no schema.org here; the queen's
DBpedia IRI is a plant for the merging lab, don't dwell on it.

## Lab 3 — Two Syntaxes, One Graph (deck Lab 3; callout moves to after slide 202)

**Seed:** *Mastering Software Architecture* (Apress, 2025) from a fictional
publisher catalog (`https://catalog.example.net/…`), written in the
schema.org dialect; author node is Michael's real IRI
`https://w3id.org/people/michael`.
**Live arc:** Parse; read the Turtle pane out loud — they're sentences. Point
at `@context` prefix ↔ `@prefix` correspondence. Do NOT teach syntax here
(the `a`, semicolons, periods get *named* at slides 234–238 — "you've been
reading this for twenty minutes").
**Discrepancy event:** same document, two costumes — and the JSON was never
the thing; the sentences were.
**Gotchas:** present schema.org as *nothing special* — "my publisher's
vocabulary." Its true identity is a Part-II reveal. The book record and
Michael's IRI stay in the day's graph and pay off at the finale.
Live `@base` change is a good micro-beat (every IRI re-resolves).

## Lab 4 — Defining Terms (deck Lab 4, slide 239)

**Seed (Turtle writer):** full RDFS definition of `ex:title` — `a
rdf:Property; rdfs:label; rdfs:comment; rdfs:range xsd:string` (the slides'
definition in legal Turtle — note the deck's `rdfs:Property` slides are being
corrected to `rdf:Property`).
**Live arc:** open on the Vocabulary tab: every term the morning used sits
there **amber — identity without description**. Parse the seed; `title` turns
teal. The exercise: work down the amber list writing rough RDFS definitions.
Optionally pull back the curtain on `implied:` here (`@vocab` — "the tool has
been catching your unmapped keys all morning").
**Discrepancy event:** the term itself becomes a node with properties —
definitions are data, same graph, same syntax.
**Tabs:** Vocabulary (default) + Local Graph.
**Gotchas:** zero inference fires here by design (range axioms have no data
in this lab's graph). Don't define `subClassOf` yet — that's Lab 5's powder.

## Lab 5 — Classes and Subclasses (deck Labs 5+6, slides 246/250)

**Seed (Turtle writer):** `ex:Book a rdfs:Class` with label/comment (slide
244's definition), plus one claim: GEB `a ex:Book`. Below it, a commented
roster of the classes the day has implied but never declared (`ex:Author`,
`schema:Person`, `ex:Organization`) — unlike properties, undeclared classes
have no amber reference list in any panel, so the seed carries the worklist.
Inference-silent on Parse — no `subClassOf` in the seed.
**Live arc:** declare `ex:Author a rdfs:Class`, then the hierarchy —
`ex:Author rdfs:subClassOf schema:Person` (note: **crossing dialects** — your
class, their class, one hierarchy; quietly the first cross-vocabulary modeling
act of the day). Type the existing cast: Sally, Hofstadter, Michael `a
ex:Author`. **Do NOT type the queen** — this is deliberate. Point at the
Entities tab: "Notice who's missing? The graph has known about Elizabeth
since this morning and still has no idea what she *is*. Remember that." Her
classification arrives in Lab 7, from DBpedia's knowledge, not the room's —
"suddenly the queen is a person, and nobody here said so." (If an eager
attendee types her anyway, nothing breaks — Lab 7's derivation is simply
absorbed and the beat softens.)
**Discrepancy event:** the first dashed edge of the day — Sally's dot appears
*inside the Person container* though nobody typed her there; the reasoner
derived it from the hierarchy (rdfs9). Then it compounds: every Author is a
Person, free, forever.
**Tabs:** Entities (default) + Vocabulary + Local Graph.
**Gotchas:** the typings and the hierarchy must be asserted in THIS lab
(reasoning is per-lab-graph). Type the queen with no other properties in this
lab — with the entity panel's scope on "Mine" she shows bare; flipping to
"All" pulls her Lab-2 properties in, which is its own small accumulation beat.
The seed's comment block doubles as the cheatsheet: the cast's full IRIs are
right there — nobody should be scrolling back through labs to copy an IRI.
Optional stretch: `rdfs:domain ex:isbn ex:Book`, then assert a brand-new
resource with only an `ex:isbn` — it gets typed `ex:Book` out of thin air.

## Lab 6 — Merging Vocabularies (deck Labs 7+8)

Aligning our vocabulary to schema.org's terms and classes, in **pure RDFS** —
no `owl:` yet. The arc inside the lab: one-way containment first (the honest,
common case), then the escalation to both-ways — equivalence built live out
of a part the room already owns.

**Seed (Turtle writer):** the worked example is `title`, the day's running
term — `ex:title rdfs:subPropertyOf schema:name .` **one direction only**,
with the candidates commented as questions (`author`? `Book`? `isbn` —
"careful: is this one-way… or both?").

**Walking the title example — beats and quips:**
- Setup: "Their system doesn't even have a word called *title* for this — they
  say *name*. Do we fight about it? No. We state the relationship."
- The device: "Every title is a name. Not every name is a title — ask anyone
  named Duke." (Beer/beverage carryover: *title is the beer here.*)
- **The prop bit (do this physically):** hold up the book — "What's the *name*
  of this? …You'd hand me the title. Interchangeable — in that direction."
  Point at yourself — "But *Michael* is not the title of a book. Name is the
  broader thing; title is the special case that works anywhere a name is
  wanted, never the reverse. So we're modeling this as a **specialization** —
  and RDFS already has one word for 'the special case of': `subPropertyOf`.
  One line, one direction, and the graph knows a title will serve anywhere a
  name is asked for."
- Parse, then the bloom: two dashed `schema:name` triples appear on the
  *morning's* records. "Nobody edited the publisher's data. Nobody wrote a
  migration. We told the graph one true thing, and it re-read everything it
  already knew."
- Why one-way matters — **the trap: transitive welding through a hub.**
  Equivalence composes: everything declared equivalent to `schema:name`
  becomes equivalent to *each other*, not just to it. Walk it: declare
  `ex:title ≡ schema:name` (both ways), then later someone reasonably adds
  `ex:name ≡ schema:name`. Both look innocent. The chain now runs
  `ex:title ≡ schema:name ≡ ex:name` — *your own two properties just merged*.
  Hofstadter's name "Douglas Hofstadter" is now also his title; every book's
  title is its `ex:name`. Nothing errors — the graph did exactly what you
  said, globally, retroactively, in dashed edges. Rule of thumb for the room:
  **one-way arrows can safely converge on a shared hub; two-way arrows
  through a hub weld everything they touch into one property.** "Is it true
  in both directions?" is the modeling question of this lab — isbn passes,
  title doesn't. Quip: "Careless equivalence is how you end up with a library
  where everybody is named *Moby Dick*."
- The escalation (live): work the worklist. `author`: one-way. Classes: same
  trick one level up, `rdfs:subClassOf`. Then `isbn`: "is every `ex:isbn` a
  `schema:isbn`? Yes. Is every `schema:isbn` an `ex:isbn`? …also yes. So say
  it twice." Two one-way statements, both directions → "How must a reasoner
  evaluate that? The only world where both hold is one where they're *the
  same property*. We just built equivalence out of subproperty." (OWL's
  contribution — *naming* this pattern in one line — stays in the OWL
  section's pocket.)
- If Lab 2's collision was left unfixed, "Biographer" now blooms as Sally's
  `schema:name` — either quietly fix it in Lab 2 beforehand, or use it:
  "alignment propagates your *mistakes* just as faithfully."

**Tabs:** Vocabulary (default) + Local Graph (the Turn's pointing surface:
the bridge itself is an edge among the books and people) + Full Graph (the
bloom across the whole morning).

**Note:** ADR-038 (cumulative reasoning) is what makes all of this real —
axioms parsed here act on the whole morning's data, and the isbn bridge built
here detonates again when the foreign dataset arrives in Lab 7.

### The bridge out of Lab 6 (Pledge / Turn / Prestige)

- **Pledge:** declarative alignment, shown. Classes converged, properties
  deduped, dashed dialect triples across the morning's data.
- **Turn (rapid-fire takahashi):** "You might be thinking 'ok cool, we mapped
  two schemas… in a really weird way…' — That's not what just happened. We
  *learned* something about the semantics. We expressed what we learned as
  individual facts. We added those facts to the knowledge graph. We didn't map
  fields. We made the data, itself, smarter."
- **While saying "individual facts": point at the Local Graph tab** — the
  bridge is ON SCREEN as data: `ex:isbn —subPropertyOf→ schema:isbn`, an edge
  among the books and people. "Your mapping has an IRI. It's queryable. Your
  ETL config never was."
- **Prestige = Lab 7's fetch** ("…let me show you something…"), BEFORE the
  LOD story: the queen's record joins with zero local mapping. Then "how does
  this scale?" → DBpedia → LOD cloud as *recognition* — the world has been
  doing what the room just did, since 2007, at billions of facts.
- **Callback triangle to keep verbally parallel:** slide 154 "the graph grows
  in understanding" (plant) → this Turn "we made the data itself smarter"
  (thesis) → slide 498 "it's a capability of the data itself" (payoff).

## Lab 7 — Integration for Free (deck Lab 9)

**Seed:** empty JSON-LD panel labeled "DBpedia Record (Fetch it)"; the Fetch
IRI input arrives pre-filled (`sembook:fetchUrl`) with
`../datasets/elizabeth-dbpedia.jsonld` — one click fetches (fills the editor,
does NOT parse), a second click commits.
Read it with the room first: dbo: terms nobody has seen, and — scroll down —
**the vocabulary's alignments travel with the data** (`dbo:Person ⊑
schema:Person`, `dbo:birthName ⊑ schema:name`; DBpedia genuinely publishes
these). No comment syntax exists in JSON — the pointing IS the callout.
**Live arc:** Fetch → read → Parse → Full Graph: the foreign record attaches
to the *existing* queen node (same IRI since Lab 2), and the dashed climb
happens — queen and Philip derive `schema:Person` through DBpedia's own
chain, birth name lands on `schema:name` where the morning's data already
converges. Zero local mapping was written.
**Discrepancy event:** data from a system nobody mapped arrives *already
understood* — the room's Lab-6 work and DBpedia's published alignments meet
at the schema.org hub without coordination. **The queen beat:** she was
deliberately left unclassified in Lab 5 (the "notice who's missing" plant) —
now she materializes into the Person container, dashed, classified by
someone else's knowledge: "suddenly the queen is a person — and nobody in
this room said so."
**Tabs:** Local Graph (default) + Entities + Vocabulary.
**Deck:** this is the Prestige — the "…let me show you something…" beat,
BEFORE the LOD story; "how does this scale?" → DBpedia → LOD as recognition.

Design decisions on record:

- **The dataset is doctored, on purpose (pedagogic license, entry due when the
  file lands):** heavily trimmed from real DBpedia output — what's in frame in
  CodeMirror must look *familiar*, not a mountain of every-language labels.
  Buried inside: schema.org assertions that genuinely exist in DBpedia's
  vocabulary alignment, called out quietly in a Turtle comment if the surface
  is Turtle. Authentic `owl:` strays stay (foreshadowing), curated so nothing
  visibly merges before its moment.
- **Fetched IRIs are silently rebased** (existing dereference behavior — CORS
  + offline-capable demos). License note due alongside the dataset.
- Fetch fills the editor and does NOT parse (ADR-019) — read the foreign
  record with the room before committing it.
- **The smuggle (DO NOT FORGET):** the doctored dataset carries extra vocab
  assertions that pay off *later* — a fact surfaces labs afterward and the
  beat is "how did the data know that? …DBpedia told us." That question is
  the bridge into the trust/provenance aside (whose full answer is the
  named-graphs beat in the SPARQL section: every triple knows where it came
  from). Choose the smuggled assertions when the dataset is authored.
- **Quip looking for a home** (candidate spots: after this lab's zero-mapping
  merge, the OWL declare-once section, or the 1000× token-reduction slide):
  *"The smarter we make the graph, the less we need to say."*

### Post-Lab-7 deck sequence (agreed rework)

Wow → stakes → origin → ecosystem → thesis; each beat answers the question
the previous one raises:

1. **Land the Prestige** — the Turn slides, closing "how does this scale?"
2. **Energy Instruments tease** (pulled forward; 1–2 slides, plant not
   payoff): four systems, one business question, zero ETL. "Read and write in
   whichever dialect makes sense to you." Full case study still returns later.
3. **Liz IRI → DBpedia → LOD** (existing 265–271 run): "where did that record
   come from?" — lands distributed-understanding-without-coordination as
   *recognition* of what the room just did.
4. **schema.org reveal + existing vocabularies**: "that hub you aligned to
   this morning? It has a name." Origin capsule with COMPRESSED Google/hotels
   (2–3 slides — the market-coercion beat; designated flex cut if long).
   Then widen: utility vocabs (rdf/rdfs/xsd — how to say) vs domain vocabs
   (schema.org, Dublin Core, industry — what there is). Subclass, don't
   reinvent. Do NOT name foaf — the DESCRIBE sleeper meets it first.
5. **"We don't need a global ontology. We never did."** — thesis restated,
   calling back the morning's 132–136; the EKG/EDW line lands here.
6. **Lab 9 "Merging Graphs" placeholder is DELETED** — its content is Lab 7;
   the callout slide, retitled "Integration for Free," lives at the Prestige.

## Lab 8 — Standing on Shoulders (existing-vocabularies beat)

**Where it sits:** inside the post-Lab-7 deck stretch, right after the
schema.org reveal + utility-vs-domain-vocabularies widening.
**Seed:** Turtle writer, empty, Fetch input pre-filled with
`../datasets/michael-foaf.ttl` — narrated as dereferencing
`https://w3id.org/people/michael` (Michael's real IRI; the fake-out is
licensed, L5).
**Live arc:** Fetch → read (it's Turtle — the "what FOAF already learned"
block is a real comment this time) → Parse. Michael's node — in the graph
since Lab 3 — gains foaf properties by IRI join, `foaf:name` lands on
`schema:name` through FOAF's own bridge, and the beat:
**Hofstadter gets typed `foaf:Person` and `schema:Person`, derived**, purely
for being on the receiving end of `foaf:knows`. FOAF's domain/range axioms
classified him. (Callback to Lab 5's domain/range stretch beat, if used.)
**The punchline (verbatim):** "When we build on an existing ontology, we
don't just get the terms — **we get everything it learned**."
**Quip option** on foaf:knows Hofstadter: "…I wish. Aspirational data."
Swap the object of foaf:knows freely — anyone in the day's cast works and
the inference follows them.
**Tabs:** Entities (default — watch the containers) + Local Graph + Vocabulary.
**Note:** this beat supersedes "don't name foaf before the SPARQL sleeper."
The DESCRIBE sleeper transmutes accordingly (below).

## Lab 9+ — SPARQL section — REMINDERS

- **"Query in whatever language makes sense to you" demo:** run the persons
  query in schema.org terms, then the identical question in `ex:` terms —
  same answers, "but you already understand this…" Then the closer,
  REFRAMED now that foaf was introduced in Standing on Shoulders:
  `DESCRIBE <https://w3id.org/people/michael>` returns **one node speaking
  four dialects** — `ex:`, `schema:`, `dbo:`, `foaf:` — "one thing, four
  vocabularies, one graph. Pick whichever language you think in; the answers
  are the same." Exact sequencing TBD.
- **Tie this demo back to multi-agent systems** when the deck reaches that
  section — an agent that speaks *any* of the aligned dialects can query the
  graph; nobody coordinated. Michael asked to be reminded at that deck beat.
