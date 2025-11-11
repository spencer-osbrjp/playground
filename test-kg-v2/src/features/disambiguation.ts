import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod.js";
import { knowledgeGraphSchema, type KnowledgeGraph } from "../share/type";

/**
 * Disambiguate entities in a knowledge graph by standardizing entity names.
 * Uses GPT-5 to identify and merge duplicate entities.
 */
export const disambiguateEntities = async (
  knowledgeGraph: KnowledgeGraph,
  client: OpenAI,
): Promise<KnowledgeGraph> => {
  console.log("\nPerforming entity disambiguation...");

  // Extract all unique entities
  const entities = new Map<string, any>();
  knowledgeGraph.triplets.forEach((triplet) => {
    const subjectKey = `${triplet.subject.name}_${triplet.subject.entity_type}`;
    const objectKey = `${triplet.object.name}_${triplet.object.entity_type}`;

    if (!entities.has(subjectKey)) {
      entities.set(subjectKey, triplet.subject);
    }
    if (!entities.has(objectKey)) {
      entities.set(objectKey, triplet.object);
    }
  });

  const entityList = Array.from(entities.values());
  console.log(`Found ${entityList.length} unique entities`);

  // Ask LLM to standardize entity names using GPT-5 by returning updated knowledge graph
  const disambiguationPrompt = `You are an expert entity disambiguation system. Your task is to standardize entity names in a knowledge graph by identifying and merging duplicate entities.

<current_knowledge_graph>
${JSON.stringify(knowledgeGraph.triplets, null, 2)}
</current_knowledge_graph>

<instructions>
1. Analyze each entity's name, type, and attributes carefully across all triplets
2. Identify entities that refer to the same real-world entity
3. For duplicate entities, standardize to the MOST COMPLETE and STANDARD name
4. Return the COMPLETE knowledge graph with standardized entity names
5. Keep all triplets, just update the entity names where needed

Guidelines for standardization:
- "USA", "United States", "U.S." → Use: "United States"
- "Sam Altman", "Altman" (same person) → Use: "Sam Altman"
- "OpenAI", "Open AI" → Use: "OpenAI"

When NOT to merge:
- Different people with similar names but different attributes
- Two entities with same company but clearly different roles/positions
- Similar names but different entity types

Be conservative - only standardize when highly confident they're the same entity.
</instructions>

<output>
Return the complete knowledge graph with standardized entity names.
All triplets must be included with updated entity names where duplicates were found.
</output>`;

  try {
    const response = await client.responses.create({
      model: "gpt-4.1",
      instructions: disambiguationPrompt,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Analyze the knowledge graph and return it with standardized entity names.",
            },
          ],
        },
      ],
      text: {
        format: zodTextFormat(knowledgeGraphSchema, "knowledgeGraph"),
      },
    });

    const standardizedGraph: KnowledgeGraph = JSON.parse(response.output_text);

    if (standardizedGraph && standardizedGraph.triplets) {
      console.log(`Received standardized graph with ${standardizedGraph.triplets.length} triplets`);

      // Use mergeGraphs deduplication logic to remove any duplicate triplets
      const uniqueTriplets = new Map<string, any>();
      standardizedGraph.triplets.forEach((triplet) => {
        // Same key format as mergeGraphs for consistency
        const key = `${triplet.subject.name}_${triplet.subject.entity_type}_${triplet.predicate.name}_${triplet.object.name}_${triplet.object.entity_type}`;
        if (!uniqueTriplets.has(key)) {
          uniqueTriplets.set(key, triplet);
        }
      });

      // Re-assign IDs (same as mergeGraphs)
      const finalTriplets = Array.from(uniqueTriplets.values()).map(
        (t, idx) => ({
          ...t,
          id: idx + 1,
        }),
      );

      console.log(
        `After disambiguation and deduplication: ${knowledgeGraph.triplets.length} → ${finalTriplets.length} triplets`,
      );

      return {
        ...standardizedGraph,
        triplets: finalTriplets,
      };
    }
  } catch (error) {
    console.error("Error during disambiguation:", error);
    console.log("Continuing with original knowledge graph...");
  }

  return knowledgeGraph;
};
