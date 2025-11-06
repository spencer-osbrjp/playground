import dotenv from "dotenv";
import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import fs from "fs";
import path from "path";

// Define the schema for a triplet (subject, relation, object)
export const TripletSchema = z.object({
  subject: z.string().describe("The subject entity"),
  subject_type: z.string().describe("The type/category of the subject entity"),
  relation: z.string().describe("The relationship between subject and object"),
  object: z.string().describe("The object entity"),
  object_type: z.string().describe("The type/category of the object entity"),
  inferred: z.boolean().describe("Is this an inferred connection").default(false)
});

// Define the schema for the knowledge graph response
export const KnowledgeGraphSchema = z.object({
  triplets: z
    .array(TripletSchema)
    .describe("Array of extracted knowledge triplets"),
  entity_types: z
    .array(z.string())
    .describe("List of entity types found in the graph"),
});

export const KnowledgeGraphTextFormat = zodTextFormat(KnowledgeGraphSchema, "knowledgeGraph")
