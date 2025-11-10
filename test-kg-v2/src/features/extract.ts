import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { zodTextFormat } from "openai/helpers/zod.js";
import { knowledgeGraphSchema, type KnowledgeGraph } from "../share/type";

export const chunking = (
  sourceText: string,
  maxChunk: number = 300,
  overlap: number = 50,
): string[] => {
  if (!sourceText || sourceText.trim().length === 0) {
    return [];
  }

  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < sourceText.length) {
    // Calculate the end index for this chunk
    let endIndex = Math.min(startIndex + maxChunk, sourceText.length);

    // If we're not at the end of the text, try to find a sentence boundary
    if (endIndex < sourceText.length) {
      // Look for sentence-ending punctuation followed by space or end of text
      const sentenceEndings = /[.!?]\s/g;
      const searchText = sourceText.substring(startIndex, endIndex);

      let lastSentenceEnd = -1;
      let match;

      // Find the last sentence boundary within our chunk
      while ((match = sentenceEndings.exec(searchText)) !== null) {
        lastSentenceEnd = match.index + 1; // +1 to include the punctuation
      }

      // If we found a sentence boundary, use it (unless it's too close to the start)
      if (lastSentenceEnd > maxChunk * 0.3) {
        endIndex = startIndex + lastSentenceEnd;
      }
    }

    // Extract the chunk
    const chunk = sourceText.substring(startIndex, endIndex).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    // Move start index forward, accounting for overlap
    // For the next chunk, go back 'overlap' characters from the end of current chunk
    if (endIndex < sourceText.length) {
      startIndex = Math.max(startIndex + 1, endIndex - overlap);
    } else {
      break; // We've reached the end
    }
  }

  return chunks;
};

export interface ExtractionConfig {
  domain: string;
  focusAreas: string[];
  includeTypes?: string[];
  excludeTypes?: string[];
  relevanceThreshold: 'high' | 'medium' | 'low';
  entityTypes?: string[];
}

const createKnowledgeGraphPrompt = (config: ExtractionConfig) => {
  return `You are a knowledge graph extraction system. Your task is to extract structured information from the user's input and return it as a knowledge graph in triplet form.

<domain>
${config.domain}
</domain>

<focus_areas>
Extract information specifically about:
${config.focusAreas.map((area, i) => `${i + 1}. ${area}`).join('\n')}
</focus_areas>

${config.entityTypes && config.entityTypes.length > 0 ? `<entity_types>
Consider these entity types when relevant:
${config.entityTypes.join(", ")}
</entity_types>` : ''}

${config.includeTypes && config.includeTypes.length > 0 ? `<relationship_types>
Focus on these types of relationships:
${config.includeTypes.join(", ")}
</relationship_types>` : ''}

${config.excludeTypes && config.excludeTypes.length > 0 ? `<exclude>
Do NOT extract information about:
${config.excludeTypes.join(", ")}
</exclude>` : ''}

<relevance_threshold>
${config.relevanceThreshold === 'high'
  ? 'HIGH: Only extract highly relevant, core information directly related to the focus areas. Quality over quantity.'
  : config.relevanceThreshold === 'medium'
  ? 'MEDIUM: Include moderately relevant context and supporting information.'
  : 'LOW: Include all potentially relevant information for comprehensive coverage.'}
</relevance_threshold>

<instructions>
1. Extract relationships in the form: (subject, predicate, object)
2. For each entity (subject and object), extract relevant attributes as key-value pairs (e.g., role, title, date, description, location)
3. ONLY extract triplets that are relevant to the domain and focus areas specified above
4. DO NOT produce duplicate triplets
5. Be precise and extract only factual relationships present in the text
6. Normalize entity names (e.g., "United States" and "USA" should be the same entity)
7. Entity names should be concise and contain all the necessary information to uniquely identify the entity
8. Keep entity names consistent: the same entity should have the same name in all triplets
9. DO NOT create relationships that are NOT explicitly or implicitly stated in the source
10. Keep the subject and object names short and clear
11. Extract meaningful attributes like: role, position, date, year, description, location, etc.
12. Filter out tangential or irrelevant information that doesn't serve the focus areas
</instructions>

<critical_instructions>
1. All relationships MUST be no more than 3 words maximum. Ideally 1-2 words. This is a hard limit.
2. ONLY extract triplets that are directly relevant to the specified focus areas
3. Always include attributes for entities when relevant information is available in the text
4. Prioritize ${config.relevanceThreshold === 'high' ? 'quality and relevance' : config.relevanceThreshold === 'medium' ? 'balanced coverage' : 'comprehensive extraction'}
</critical_instructions>

Extract all relevant triplets from the user's input. Make sure to populate the attributes field for each entity with relevant information from the text.`;
};

const disambiguateEntities = async (
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
      model: "gpt-5",
      instructions: disambiguationPrompt,
      reasoning: {
        effort: "low",
      },
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

export const extract = async (sourceText: string, config?: Partial<ExtractionConfig>) => {
  try {
    // Check if API key is available
    const apiKey = process.env.OPENAI_API_KEY;
    console.log("API Key exists:", !!apiKey);
    console.log("API Key length:", apiKey?.length || 0);

    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set in environment variables");
    }

    console.log(`Source text length: ${sourceText.length} characters\n`);

    console.log("Chunking text...");

    const chunkedSourceText = chunking(sourceText, 800, 100);
    console.log(`Created ${chunkedSourceText.length} chunks\n`);

    console.log("Extracting knowledge graph...\n");

    const client = new OpenAI({
      apiKey,
    });

    // Default configuration
    const extractionConfig: ExtractionConfig = {
      domain: config?.domain || "General knowledge extraction",
      focusAreas: config?.focusAreas || ["Key facts", "Important relationships", "Significant events"],
      includeTypes: config?.includeTypes,
      excludeTypes: config?.excludeTypes,
      relevanceThreshold: config?.relevanceThreshold || 'medium',
      entityTypes: config?.entityTypes,
    };

    console.log('Extraction configuration:', JSON.stringify(extractionConfig, null, 2));

    const response = await client.responses.create({
      model: "gpt-5",
      instructions: createKnowledgeGraphPrompt(extractionConfig),
      reasoning: {
        effort: "low",
      },
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: chunkedSourceText.join("\n\n---\n\n"),
            },
          ],
        },
      ],
      text: {
        format: zodTextFormat(knowledgeGraphSchema, "knowledgeGraph"),
      },
    });

    let knowledgeGraph: KnowledgeGraph = JSON.parse(response.output_text);
    console.log("Initial extraction complete");
    console.log(`Extracted ${knowledgeGraph.triplets.length} triplets`);

    // Perform entity disambiguation
    knowledgeGraph = await disambiguateEntities(knowledgeGraph, client);

    if (knowledgeGraph) {
      console.log("\nFinal Knowledge Graph:");
      console.log("Entity Types Found:", knowledgeGraph.entity_types);
      console.log(`\nTriplets (${knowledgeGraph.triplets.length}):\n`);

      knowledgeGraph.triplets.forEach((triplet) => {
        console.log(
          `${triplet.id}. (${triplet.subject.name}: ${triplet.subject.entity_type}) → ${triplet.predicate.name} → (${triplet.object.name}: ${triplet.object.entity_type})`,
        );
      });

      // Save to JSON file for visualization
      const outputDir = "public";
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const filePath = path.join(outputDir, "knowledge-graph.json");
      fs.writeFileSync(filePath, JSON.stringify(knowledgeGraph, null, 2));
      console.log(`\n✓ Knowledge graph saved to: ${filePath}`);

      return knowledgeGraph;
    }
  } catch (error) {
    console.error("Error extracting knowledge graph:", error);
    throw error;
  }
};
