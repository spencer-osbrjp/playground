import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { zodTextFormat } from "openai/helpers/zod.js";
import { knowledgeGraphSchema, type KnowledgeGraph } from "../share/type";

export interface InferredTriplet {
  id: number;
  subject: {
    id: number;
    name: string;
    entity_type: string;
    attributes: Array<{ key: string; value: string }>;
  };
  predicate: {
    id: number;
    name: string;
  };
  object: {
    id: number;
    name: string;
    entity_type: string;
    attributes: Array<{ key: string; value: string }>;
  };
  inferred?: boolean;
}

export interface InferredKnowledgeGraph {
  triplets: InferredTriplet[];
  entity_types: string[];
}

const createInferencePrompt = (graph: KnowledgeGraph) => {
  return `You are a data scientist expert in Knowledge Graph inference. Your task is to analyze an existing knowledge graph and thoughtfully add inferred relationships ONLY when they make logical sense.

<existing_knowledge_graph>
${JSON.stringify(graph.triplets, null, 2)}
</existing_knowledge_graph>

<instructions>
1. Return ALL ${graph.triplets.length} original triplets unchanged with \`inferred: false\`
2. Carefully analyze entity attributes (company, role, date, etc.) to discover meaningful hidden connections
3. Create NEW inferred triplets ONLY IF:
   - There is strong evidence from attributes or existing relationships
   - The inference adds valuable information not already captured
   - The relationship makes logical sense in the domain context
4. DO NOT create inferred relationships just for the sake of it
5. DO NOT create duplicate or redundant relationships
6. DO NOT create new nodes - only connect existing entities
7. Mark all new inferred triplets with \`inferred: true\`

# When to Infer (Quality over Quantity):

## Attribute-Based Inference (HIGH CONFIDENCE):
- **Same Organization**: If two people have the same "company" attribute, they may be "colleagues" or "works_with"
- **Organizational Leadership**: If person has "role: CEO" and "company: X", and company entity "X" exists, infer person "leads" company
- **Related Roles**: If attributes suggest direct working relationship (e.g., "CEO" and "CTO" at same company)

## Transitive Relationships (MEDIUM CONFIDENCE):
- **Only infer if logically sound**: If A "leads" B and B "released" C, you MAY infer A "oversees" C
- **Avoid weak chains**: Don't create inferences from vague connections

## Domain Knowledge (USE SPARINGLY):
- Only infer relationships that are very likely based on common knowledge
- Example: If person is CEO of a company, and the company is discussing a topic, the CEO may be "represents" that company's view

# When NOT to Infer:
- Don't infer just because entities appear in the same graph
- Don't create generic "related_to" relationships without strong justification
- Don't infer relationships that are already implicit or redundant
- Don't make assumptions without attribute or relationship evidence
</instructions>

<critical_instructions>
1. All relationships MUST be no more than 3 words maximum. Ideally 1-2 words. This is a hard limit.
2. QUALITY OVER QUANTITY: It's better to infer 2-3 meaningful relationships than 10 weak ones
3. Every triplet MUST have the "inferred" field (false for original, true for inferred)
4. Carefully examine attributes - they are the primary source for valid inferences
</critical_instructions>
`;
};

/**
 * Infer hidden relationships in a knowledge graph based on attributes and existing connections.
 */
export const infer = async (
  graph: KnowledgeGraph,
): Promise<InferredKnowledgeGraph> => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set in environment variables");
    }

    console.log("Starting inference on knowledge graph...");
    console.log(`Input graph has ${graph.triplets.length} triplets`);

    const client = new OpenAI({
      apiKey,
    });

    const response = await client.responses.create({
      model: "gpt-5",
      reasoning: {
        effort: "low",
      },
      instructions: createInferencePrompt(graph),
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Analyze the knowledge graph and add inferred relationships as described in the instructions.",
            },
          ],
        },
      ],
      text: {
        format: zodTextFormat(knowledgeGraphSchema, "knowledgeGraph"),
      },
    });

    const inferredGraph: InferredKnowledgeGraph = JSON.parse(
      response.output_text,
    );

    if (inferredGraph) {
      const originalCount = inferredGraph.triplets.filter(
        (t) => !t.inferred,
      ).length;
      const inferredCount = inferredGraph.triplets.filter(
        (t) => t.inferred,
      ).length;

      console.log(`Original triplets: ${originalCount}`);
      console.log(`Inferred triplets: ${inferredCount}`);
      console.log(`Total triplets: ${inferredGraph.triplets.length}`);

      // Save inferred graph
      const outputDir = "public";
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const filePath = path.join(outputDir, "knowledge-graph-inferred.json");
      fs.writeFileSync(filePath, JSON.stringify(inferredGraph, null, 2));
      console.log(`\n✓ Inferred knowledge graph saved to: ${filePath}`);

      return inferredGraph;
    }

    throw new Error("Inference failed - no graph returned");
  } catch (error) {
    console.error("Error during inference:", error);
    throw error;
  }
};
