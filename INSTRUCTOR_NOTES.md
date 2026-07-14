# Instructor Notes — Workshop Labs (notebook1)

Per-lab choreography for the workshop. Each lab lists: seed state, the live arc,
the one discrepancy event the lab exists for, and stage gotchas. Companion to
the deck ("An Engineer's Guide to the Semantic Layer"); deck cue points refer to
slide numbers as of 2026-07-12 and shift as the deck is renumbered.

**Standing rules (apply to every lab):** phenomenon before name; one
discrepancy event per lab; seeds fire zero visible inference before Lab 5;
schema.org stays "some other system's dialect" until the web-scale reveal;
nothing invites "what if triples disagree" before the named-graphs beat.

**Standing delivery rules (OWL section onward — hammer these):**
- **The SQL strawman, drawn sharply:** yes, a competent analyst could write a
  SQL query that finds Kate's husband or everything in Colorado. But the
  *query writer* carries the semantics in their head — out-of-band knowledge,
  re-supplied per query, per person, forever. Here the knowledge is IN the
  data: the graph *knows*, and anyone (or anything) that asks gets the
  benefit. Navigable data model ≠ knowing data. Query-ability is not
  knowledge.
- **"An LLM doesn't have to guess at this. It's a computable fact. It cannot
  be hallucinated."** Use verbatim, repeatedly.
- **PUNCTUATION RULE: every single time you say "the graph got smarter,"
  immediately translate: "— which means YOUR AI just got smarter."** No
  exceptions. The room must leave with those two phrases fused.
- **OWL lab setup callback (each lab):** "We didn't map fields. We learned
  something about the data and told the graph. `:marriedTo` is symmetric —
  let's weave that fact into the knowledge fabric."

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

## Lab 9 — The Nature of Relationships (OWL: symmetric / inverse / subproperty)

**Surface:** dueling Turtle writers — **Data** (left) | **Semantics** (right)
— over a single Local Graph tab. Separation of concerns made physical: the
data never changes; you parse *meaning* and the graph grows.
**Seed:** Data holds ONE fact: `<w3id:michael> ex:husbandOf ex:kate .`
Semantics holds only the breadcrumb comments. Follow-along.
**The follow-along Turtle (final state of the Semantics panel):**
```turtle
@prefix ex: <https://example.com/ns#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:husbandOf rdfs:subPropertyOf ex:marriedTo .
ex:marriedTo a owl:SymmetricProperty .
ex:wifeOf owl:inverseOf ex:husbandOf .
```
**Staging:** parse Data first — two nodes, one edge, nothing else. Then add
the semantics one line at a time, parsing after each: subPropertyOf →
*michael marriedTo kate* (dashed); SymmetricProperty → *kate marriedTo
michael*; inverseOf → *kate wifeOf michael*. **One asserted fact, three
derived facts** (verified). "I said one thing. The graph now knows four."
**Do NOT promise `owl:propertyChainAxiom`** (uncle = brother∘parent, etc.) —
the notebook's reasoner is BGP-only and cannot run chains; it's a
slides-only mention.
**Delivery:** SQL strawman + can't-be-hallucinated + punctuation rule, every
beat.

## Lab 10 — Transitivity (the UberConf world)

**Surface:** same dueling-writers + Local Graph shape.
**Seed (Data):** UberConf `a schema:EducationalEvent`, `schema:performer` →
Michael's w3id IRI, `schema:location` → Westin Westminster (`schema:Hotel`);
`ex:locatedIn` chain: michael → Westin → Westminster → Colorado, plus
Westminster → `ex:DenverMetro` (label: "Denver"). Semantics: breadcrumbs
only ("…where am I? The graph does not know yet.").
**The follow-along Turtle:** one line —
```turtle
ex:locatedIn a owl:TransitiveProperty .
```
**Payoff (verified):** five derived edges bloom at once — michael is in
Westminster, in "Denver," in Colorado; the Westin too. One line of
semantics; the graph closes the whole chain.
**The Denver aside (lean, keep):** the conference ads say "Denver, CO" —
Westminster isn't in Denver proper. `ex:DenverMetro` is a *different
resource* that happens to carry the label "Denver," and it's the one the ad
means. Nobody lied; two contexts, two resources, one label. Lab 2's
title-collision lesson, grown up — 30 seconds, then move on.

## OWL suite — remaining (IFP; FP punted)

**FunctionalProperty — PUNTED as a lab (2026-07-12).** Every candidate
breaks: spouse (stale data welds your ex to your current), bornIn
(granularity — "Rock Springs" and "USA" are both true, FP welds a city to a
country). The underlying principle, worth one slide breath at most: **FP
claims uniqueness about the world; IFP claims uniqueness about an
identifier — and identifiers are the one thing humans design to be
unique.** That's why IFP demos sing and FP demos blow up. If the stale-data
question arises anyway (someone will invent FP in their head), it's a gift
with a scheduled answer: "you've just discovered why provenance matters —
hold that thought for the last lab."

**Lab 9 coda — the Philip payoff (QUICK BONUS FACT, instructor-only beat):**
after Kate's cascade: "…and remember Philip?" Add to the Semantics panel —
`@prefix dbo: <https://dbpedia.org/ontology/> .` then
`dbo:spouse a owl:SymmetricProperty .` and, for the cross-ontology kick,
`dbo:spouse rdfs:subPropertyOf ex:marriedTo .` → parse → **switch to the
Entity viewer**: Philip now carries an inferred `marriedTo` — DBpedia's
fact, expressed in OUR vocabulary, derived by a rule typed seconds ago.
**The significance to hit (needs its own vibrant slide):**
**MULTIPLE DATASETS GOT SMARTER.** Not our data enriched by theirs — every
dataset in the graph now knows more, in every dialect, simultaneously.
Script: "The graph knows more than you told it. The AI consuming this knows
more than you told it. These are new facts in the dataset — and they cannot
be hallucinated."
## Lab 11 — Semantic Alignment (IFP — the identity climax) — BUILT

**Surface:** left = JSON-LD panel, Fetch pre-filled with
`../datasets/elizabeth-catalog-record.jsonld`; right = Turtle writer
(breadcrumbs only); below = Local Graph, Full Graph, Entities, Vocabulary.
**The dataset:** a fictional library system (`lib:` —
catalog.worldlib.example): its own record IRI, `lib:mainTitle`,
`lib:author` ("Smith, Sally Bedell", literal, library-style), `lib:isbn`
`"0812979796"`, `lib:format` — and its vocabulary's own schema.org
alignments in-band (`lib:Book ⊑ schema:Book`, `lib:isbn ⊑ schema:isbn`,
`lib:mainTitle ⊑ schema:name`). **No identifier shared** with the Lab 2
record.
**The follow-along Turtle (one line):**
```turtle
schema:isbn a owl:InverseFunctionalProperty .
```
**Chain (verified end-to-end):** Lab 2's isbn mapping (`isbn` → `ex:isbn`,
done live at 9:45) + Lab 6's alignment (`ex:isbn` ↔ `schema:isbn`, done
live mid-morning) + the fetched record's own `lib:isbn ⊑ schema:isbn` +
this one line → both records derive `schema:isbn "0812979796"` → IFP fires
→ `owl:sameAs`, both directions. **16 derived triples.** In the Entity
explorer: two book dots become ONE, and the merged record's **properties
double** — it gains `mainTitle`/`author`/`format` from the library AND the
room's `title`, Sally's IRI, and the `about` → Elizabeth link, which
connects the merged book into the queen's whole cluster.
**LIVE-WORK DEPENDENCIES (do not skip):** the merge requires Lab 2's isbn
mapping and Lab 6's isbn alignment to have actually happened. If either was
skipped, add them quietly before this lab.
**Delivery:** "Two systems. No shared key. Nobody wrote a crosswalk. We
told the graph one true thing about what an ISBN *is* — and identity
emerged." Then the pause — the denouement — before the KG reveal and
SPARQL: look at Full Graph. That thing on screen is a knowledge graph. It
was never built. It *emerged*.

**Slide asset delivered:** `C:\Users\micha\OneDrive\Documents\talks\lab9-local-graph.svg`
— Lab 9's local-graph end state in the tool's exact visual grammar (teal
IRI nodes, solid gray asserted edges, dashed violet inferred), laid out
clean: michael/kate with 1 solid + 3 dashed edges, semantics cluster to the
right. (Live Cytoscape export was unusable — layout doesn't settle in the
headless env.)

## SPARQL section — AGREED PROGRESSION (Michael, 2026-07-12)

**Act 1 — familiar ground** ("…you're safe and sound here, now…"). It's a
query language. Preset sample queries in the dropdown, run in order:
1. `SELECT ?s ?p ?o` — remember, it's all triples.
2. Books, in OUR vocabulary (`ex:`).
3. `DESCRIBE <https://w3id.org/people/michael>` — introduce the keyword;
   four dialects come back off one node.
4. The books query again — in schema.org terms, then dbo:/foaf-flavored —
   same answers, different language.
**Takeaway slide/speech:** "Your AI doesn't care what your info silo calls
things — because it knows what you MEAN. And so does every other system
that consumes it. So why are you still writing ETLs, and mapping files, and
anti-corruption layers, and SDKs, and… Just make data make sense to
machines."

**Act 2 — the rug pull** ("…at the McFly farm."). This isn't a database —
it's a knowledge graph. Direct questions. Wikidata tangent for endless
examples. Then: how does this plug into AI? Toggle the SPARQL endpoint on,
advertise it in Hydra, back to the generic client, ask the big question,
get the answer.
**The drumbeat:** Zero-shot. Self-discovering. Explainable. Grounded.
Provable. *Justified.*
**Value prop, verbatim arc with callback slides:** language is vague; SPARQL
is precise. "Remember the Q&A example from the very beginning (slide) — and
I said (slide) there's no mechanism in the architecture for truth, only
probability. (slide) SPARQL gives you truth. (slide) Your knowledge graph is
the architecture for truth your AI has been missing all along. Stop thinking
it's something you *build*. It's not an artifact. It's not a neo4j database.
It's an emergent behavior — born from making your data mean something."
**"Emergent" means, concretely:** a bare LLM, generic prompt, generic
client, connected via the API and KG — instantly understood the landscape.
No prior knowledge. No custom prompt. No MCP. No custom tools. No generated
SDK.

## The Turn Nobody Expects (provenance / named graphs) — SCRIPT

Set-up (Michael's beats, verbatim):
> "Justified, true, belief. (beat) That's what this whole workshop has been
> about. (beat) Knowledge. (beat) The semantic layer is how machine
> knowledge is justified. You see how it works. (beat) You've seen a lot of
> accuracy. (beat) But accuracy isn't always truth. …
> 'An educated mind is one that can entertain an idea without accepting
> it.'" (attribute as "attributed to Aristotle" — it's actually Lowell
> Thomas; engineers have phones.)

"Accuracy isn't truth" is a CALLBACK to the morning's 90%/one-nine slides —
accuracy unmasked a second time, one level up.

The landing (the quote is a literal spec of the quad store):
> "Your knowledge graph is an educated mind. It's been holding DBpedia's
> claims, and my claims, and YOUR claims — all day. Entertaining every one
> of them. But it never confused *storing* a fact with *accepting* it —
> because every fact in this graph remembers who said it."
> (live: GRAPH clause — exclude a source without deleting it; show asserted
> vs inferred provenance)
> "Acceptance isn't storage. Acceptance is a query-time decision.
> …Belief. Justified. And now — TRUE, with receipts."

This is also the L1/L2 license unwind: "the notebook has been doing this
invisibly since 9am" — the tool confesses its own machinery as the final
lesson in trust. If anyone raised the stale-data question earlier, name
them here — the scheduled answer arrives.

## Lab 12 — Querying the Graph — BUILT & VERIFIED

Seven sample queries in the dropdown, numbered in delivery order:
1. **It's all triples** — `SELECT ?s ?p ?o` (auto-scoped to the whole day,
   asserted + inferred; ~100+ rows).
2. **Books — in our vocabulary** — the LIBRARY record answers `ex:title`,
   a property it never asserted.
3. **DESCRIBE Michael** — one node, four dialects (ex:, schema:, foaf:,
   rdf; dbo: shows on Elizabeth).
4. **Books — in their vocabulary** — same books, schema.org terms. NOTE:
   counts can differ between 2 and 4 — `ex:title ⊑ schema:name` is one-way
   (the Duke!), so a book with only schema:name has no ex:title. If asked,
   that's the answer: direction was a modeling decision.
5. **Everything about Elizabeth — and who said it** — GRAPH ?source; rows
   grouped by origin, including `-inferred` graphs (derivations have
   provenance too).
6. **The same — without trusting DBpedia** — FILTER NOT IN the two
   integration-for-free graphs; only the room's facts remain. "Excluded,
   not deleted." Honest caveat if pressed: derivations that OTHER labs
   computed from excluded data live in those labs' inferred graphs — full
   truth-maintenance is real engineering; this shows the primitive.
7. **Query the notebook itself** — returns all 13 labs from the default
   graph. (Mechanism: the leading comment mentions GRAPH, which switches
   off the automatic lab-scoping — documented in the comment itself.)

## Lab 13 — Contexts on the Fly (CONSTRUCT) — BUILT & VERIFIED

**Bridge in:** "We don't need a global ontology. We just need contextual
definitions… and we can build those on the fly."
**Two sample queries:** (1) *Invent a vocabulary — right now*: CONSTRUCT
mints `reporting#displayName` onto every Person — a vocabulary that did not
exist five seconds ago, populated from three source dialects; the Result
panel's Graph view shows the reshaped world. (2) *Define a new class on the
fly*: CONSTRUCT types every pre-2000 book `reporting#TwentiethCenturyBook`
— a class nobody declared, enumerated by query. (Depends on Lab 1's live
`published` mapping.)
**Bridge out:** straight into the Energy Instruments case study — "one of
these queries saved a million dollars."

### EI slide query (hypothetical, for the case-study slide)
```sparql
PREFIX ei: <https://energyinstruments.example/ns#>

CONSTRUCT {
  ?part a ei:DisposablePart .
}
WHERE {
  ?part a ei:Part ;
        ei:storedIn ?warehouse .

  FILTER NOT EXISTS {
    ?product a ei:Product ;
             ei:status ei:Active ;
             ei:usesPart ?part .
  }
}

# ei:usesPart is transitive — the reasoner has already flattened
# every level of every bill of materials. That's why this query
# never has to mention sub-assemblies.
```
The footnote is the depth-charge: the query is *simple because the
reasoning already happened*. Say the number after the room reads it.

## SPARQL section — REMINDERS

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
