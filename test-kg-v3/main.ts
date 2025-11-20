/**
 * A concept is a "node" (from knowledge graph), which consist of concept description and relationship.
 */
type Concept = {
  id: string;
  name: string;
  description: ConceptDescription;
};

/**
 * The meta-definition of a concept. It serves as an auxiliary guideline for the concept
 *
 * @link Concept
 */
type ConceptDescription = string;

/**
 * A relationship act as the "edge" (from knowledge graph) that provides semantic linkage between concepts within assertions.
 * A relationship has attributes such as "relationship description", "assertion", "source node", "target node", "weight", "timestamp", etc
 */
type Relationship = {
  id: string;
  name: string;
  description: RelationshipDescription;
  sourceNode: Concept;
  targetNode: Concept;
  weight: number;
  timestamp: string;
};

/**
 * A meta-definition of relationship.
 * A relationship description is a textual string that describes the nature of relationships between relations.
 *
 * @link Box
 */
type RelationshipDescription = string;

/**
 * “Logic” refers to the rules for forming relationships within an assertion. Major categories include:
 *
 * - Causal logic: forms occurrences or effects
 * - Constitutive logic: forms inclusion or dependency relations
 * - Temporal logic: forms DAG-structured temporal changes of the same concept
 * - Transitive logic: forms non-DAG state transitions of the same concept
 * - Transfer logic: forms transfers of materials or transmission of information
 * - Gradient logic: forms distances, elevation, temperature, etc. between points
 * - Deductive logic: forms Boolean operations
 */
type Logic = {
  type:
    | "causal"
    | "temporal"
    | "transitive"
    | "transfer"
    | "constititive"
    | "gradient"
    | "deductive";
};

/**
 * An assertion is any number of concepts defined on any logic based on the consistent cognition of the interpreting agent.
 */
type Assertion = {
  id: string;
  logic: Logic;
  relationships: Relationship[]
};

/**
 * A “frame” is a rule for forming connections within a thesis.
 * A frame uses formation rules equivalent to logic but differs in that it focuses on relationships between assertions rather than concepts.
 * For example, one may consider a frame that bijectively connects structurally isomorphic constitutive logics—such as Problem → Solution → Verification.
 */
type Frame = Logic

/**
 * “Connection” provides semantic linkage between assertions within an argument.
 */
type Connection = {
  id: string;
  name: string;
  description: string;
  sourceAssertion: Concept;
  targetAssertion: Concept;
  weight: number;
  timestamp: string;
}

/**
 * A “thesis” is a continuous sequence of assertions formed by uniform connectionual rules.
 */
type Thesis = {
  id: string;
  frame: Frame;
  connections: Connection[]
}
