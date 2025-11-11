import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { zodTextFormat } from "openai/helpers/zod.js";
import { knowledgeGraphSchema, type KnowledgeGraph } from "../share/type";

export interface ExtractionConfig {
  domain: string;
  focusAreas: string[];
  includeTypes?: string[];
  excludeTypes?: string[];
  relevanceThreshold: 'high' | 'medium' | 'low';
  entityTypes?: string[];
}

/**
 * Split text into overlapping chunks for better processing
 */
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
5. ALWAYS keep the infer value as false
6. DO NOT create inferred triplet, all triplets MUST be direct facts from the given source
7. After creating the triplets, go through it again to check the entity names, standardize the entity name if they are the same
</critical_instructions>

Extract all relevant triplets from the user's input. Make sure to populate the attributes field for each entity with relevant information from the text.`;
};

/**
 * Extract knowledge graph from source text with optional configuration
 */
export const extract = async (sourceText: string, config?: Partial<ExtractionConfig>) => {
  try {
    // Check if API key is available
    const apiKey = process.env.OPENAI_API_KEY;

    console.log(`Source text length: ${sourceText.length} characters\n`);

    console.log("Chunking text...");

    const chunkedSourceText = chunking(sourceText, 3000, 500);
    console.log('Chunks: ', chunkedSourceText)
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
    // knowledgeGraph = await disambiguateEntities(knowledgeGraph, client);

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
