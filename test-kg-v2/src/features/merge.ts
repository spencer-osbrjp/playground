import OpenAI from "openai";
import { type KnowledgeGraph } from "../share/type";
import { disambiguateEntities } from "./disambiguation";

/**
 * Merge two knowledge graphs with entity disambiguation.
 * Combines triplets, removes duplicates, and standardizes entity names.
 */
export const mergeGraphs = async (
  graph1: KnowledgeGraph,
  graph2: KnowledgeGraph,
): Promise<KnowledgeGraph> => {
  console.log("Merging knowledge graphs...");
  console.log(`Graph 1: ${graph1.triplets.length} triplets`);
  console.log(`Graph 2: ${graph2.triplets.length} triplets`);

  // Combine all triplets
  const allTriplets = [...graph1.triplets, ...graph2.triplets];

  // Deduplicate based on subject-predicate-object combination
  const uniqueTriplets = new Map();
  allTriplets.forEach((triplet) => {
    const key = `${triplet.subject.name}_${triplet.subject.entity_type}_${triplet.predicate.name}_${triplet.object.name}_${triplet.object.entity_type}`;
    if (!uniqueTriplets.has(key)) {
      uniqueTriplets.set(key, triplet);
    }
  });

  // Re-assign IDs
  const mergedTriplets = Array.from(uniqueTriplets.values()).map((t, idx) => ({
    ...t,
    id: idx + 1,
  }));

  // Combine and deduplicate entity types
  const entityTypes = Array.from(
    new Set([...graph1.entity_types, ...graph2.entity_types]),
  );

  let mergedGraph: KnowledgeGraph = {
    triplets: mergedTriplets,
    entity_types: entityTypes,
  };

  console.log(
    `Initial merge: ${mergedGraph.triplets.length} triplets (removed ${allTriplets.length - mergedGraph.triplets.length} exact duplicates)`,
  );

  // Perform entity disambiguation to standardize entity names across both graphs
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    try {
      const client = new OpenAI({ apiKey });
      mergedGraph = await disambiguateEntities(mergedGraph, client);
    } catch (error) {
      console.error("Error during merge disambiguation:", error);
      console.log("Continuing with basic merged graph...");
    }
  } else {
    console.log("Skipping disambiguation - no API key available");
  }

  return mergedGraph;
};
