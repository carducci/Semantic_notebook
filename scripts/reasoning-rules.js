// Hand-authored RDFS + OWL 2 RL (BGP-expressible subset) rules for N3.js's Reasoner.
// Covers RDFS core plus the relational OWL axioms: equivalentClass, equivalentProperty,
// inverseOf, SymmetricProperty, TransitiveProperty, sameAs, and InverseFunctionalProperty.
// See ADR-031 for the full rationale; the short version:
//
// N3.js's Reasoner ships NO ruleset — you supply N3 `{…} => {…}` rules — and it
// supports only Basic Graph Patterns in premise/conclusion: no built-ins, no
// backward chaining, no rdf:List/collection handling. That makes the parts of
// OWL 2 RL that need built-ins or lists (cardinality, hasKey, propertyChainAxiom,
// intersectionOf/unionOf/someValuesFrom class constructors, datatype checks)
// impossible to express here. What remains — and what these rules cover — is the
// BGP-shaped fragment: RDFS core plus the relational OWL axioms. Heavier reasoning
// is the documented EYE JS escalation path (ADR-009).
//
// The reasoner runs to a fixpoint, so rules chain: e.g. owl:equivalentClass expands
// to two rdfs:subClassOf triples, which then drive rdfs9 type propagation in the
// same run.
//
// KNOWN WART (inherent to RDFS materialization, not specific to this engine):
// the rdfs:domain / rdfs:range rules can, if an author declares a domain or range
// on a datatype property, produce a type triple whose subject or object is a
// literal. We accept that rather than adding a literal-guard built-in N3.js can't
// express; the teaching datasets declare domain/range on object properties.

export const RDFS_OWL2RL_RULES = `
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>.
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
@prefix owl: <http://www.w3.org/2002/07/owl#>.

# ── RDFS ──────────────────────────────────────────────────────────────────
# rdfs:subClassOf is transitive
{ ?a rdfs:subClassOf ?b. ?b rdfs:subClassOf ?c. } => { ?a rdfs:subClassOf ?c. }.
# type propagates up the subclass chain (rdfs9)
{ ?x a ?c. ?c rdfs:subClassOf ?d. } => { ?x a ?d. }.
# rdfs:subPropertyOf is transitive
{ ?a rdfs:subPropertyOf ?b. ?b rdfs:subPropertyOf ?c. } => { ?a rdfs:subPropertyOf ?c. }.
# a sub-property's assertions hold for the super-property (rdfs7)
{ ?x ?p ?y. ?p rdfs:subPropertyOf ?q. } => { ?x ?q ?y. }.
# rdfs:domain types the subject (rdfs2)
{ ?x ?p ?y. ?p rdfs:domain ?c. } => { ?x a ?c. }.
# rdfs:range types the object (rdfs3)
{ ?x ?p ?y. ?p rdfs:range ?c. } => { ?y a ?c. }.

# ── OWL 2 RL (BGP-expressible fragment) ───────────────────────────────────
# owl:equivalentClass ≡ subClassOf both ways (chains into rdfs9 above)
{ ?a owl:equivalentClass ?b. } => { ?a rdfs:subClassOf ?b. ?b rdfs:subClassOf ?a. }.
# owl:equivalentProperty ≡ subPropertyOf both ways (chains into rdfs7 above)
{ ?a owl:equivalentProperty ?b. } => { ?a rdfs:subPropertyOf ?b. ?b rdfs:subPropertyOf ?a. }.
# owl:inverseOf (both directions)
{ ?p owl:inverseOf ?q. ?x ?p ?y. } => { ?y ?q ?x. }.
{ ?p owl:inverseOf ?q. ?x ?q ?y. } => { ?y ?p ?x. }.
# owl:SymmetricProperty
{ ?p a owl:SymmetricProperty. ?x ?p ?y. } => { ?y ?p ?x. }.
# owl:TransitiveProperty
{ ?p a owl:TransitiveProperty. ?x ?p ?y. ?y ?p ?z. } => { ?x ?p ?z. }.
# owl:sameAs — symmetry + value replication (partial: individual equality only).
# Reflexive owl:sameAs these can produce (?x sameAs ?x) is dropped in _materialize.
{ ?x owl:sameAs ?y. } => { ?y owl:sameAs ?x. }.
{ ?x owl:sameAs ?y. ?x ?p ?o. } => { ?y ?p ?o. }.
{ ?x owl:sameAs ?y. ?s ?p ?x. } => { ?s ?p ?y. }.
# owl:InverseFunctionalProperty — two subjects sharing a value on an IFP-declared
# property are the same individual. Reflexive/duplicate-subject firings are dropped
# by the same generic owl:sameAs post-filter in _materialize (no special-casing here).
{ ?p a owl:InverseFunctionalProperty. ?x ?p ?v. ?y ?p ?v. } => { ?x owl:sameAs ?y. }.
`;
