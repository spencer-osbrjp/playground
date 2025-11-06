import { z } from "zod";
import { KnowledgeGraphSchema } from "./schema.ts"

export type KnowledgeGraph = z.infer<typeof KnowledgeGraphSchema>;
