import { z } from "zod";

export const attributeSchema = z.object({
  key: z.string().describe("The attribute name"),
  value: z.string().describe("The attribute value"),
});

export const nodeSchema = z.object({
  id: z.number().describe("Unique identifier for the node"),
  name: z.string().describe("Name of the entity"),
  entity_type: z
    .string()
    .describe("The type of the node. For example: PERSON, COMPANY, CONCEPT"),
  attributes: z
    .array(attributeSchema)
    .describe(
      "Array of key-value attributes for the node, for example: role, description, date, etc",
    ),
});

export type Node = z.infer<typeof nodeSchema>;

export const edgeSchema = z.object({
  id: z.number().describe("Unique identifier for the edge"),
  name: z
    .string()
    .describe(
      "The relationship between the subject and object. For example: works_at, founded, CEO_of",
    ),
});

export type Edge = z.infer<typeof edgeSchema>;

export const tripletSchema = z.object({
  id: z.number().describe("Unique identifier for the triplet"),
  subject: nodeSchema.describe("The subject entity of the relationship"),
  predicate: edgeSchema.describe("The relationship type"),
  object: nodeSchema.describe("The object entity of the relationship"),
  inferred: z
    .boolean()
    .default(false)
    .describe(
      "Whether this triplet was inferred (true) or is original (false). Defaults to false for original triplets.",
    ),
  timeStamp: z
    .string()
    .describe(
      "ISO 8601 timestamp (e.g., '2025-11-11T00:00:00Z') representing when this triplet snapshot was valid or observed.",
    ),
});

export type Triplet = z.infer<typeof tripletSchema>;

export const knowledgeGraphSchema = z.object({
  triplets: z
    .array(tripletSchema)
    .describe("Array of extracted triplets (subject-predicate-object)"),
  entity_types: z
    .array(z.string())
    .describe("List of entity types found in the text"),
});

export type KnowledgeGraph = z.infer<typeof knowledgeGraphSchema>;
