import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { zodTextFormat } from "openai/helpers/zod.js";
import { knowledgeGraphSchema, type KnowledgeGraph } from "../share/type";

export const chunking = (sourceText: string, maxChunk: number = 300, overlap: number = 50): string[] => {
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
}

const createKnowledgeGraphPrompt = (entity_types: string[]) => {
  return `You are a knowledge graph extraction system. Your task is to extract structured information from the user's input and return it as a knowledge graph in triplet form.

<entity_types>
${entity_types.join(", ")}
</entity_types>

<instructions>
1. Extract relationships in the form: (subject, predicate, object)
2. For each entity (subject and object), extract relevant attributes as key-value pairs (e.g., role, title, date, description)
3. DO NOT produce duplicate triplets
4. Be precise and extract only factual relationships present in the text
5. Normalize entity names (e.g., "Apple Inc." and "Apple" should be the same entity)
6. Entity names should be concise and contain all the necessary information to uniquely identify the entity
7. Keep entity names consistent: the same entity should have the same name in all the triplets it appears in
8. DO NOT create new relation that is NOT from the provided source
9. Keep the subject and object name short, create a new triplet if needed when the object name is long
10. Extract meaningful attributes like: role, position, date, year, description, location, etc.
</instructions>

<critical_instructions>
1. All relationships MUST be no more than 3 words maximum. Ideally 1-2 words. This is a hard limit.
2. ONLY Extract triplets that are related to the given entities
3. Always include attributes for entities when relevant information is available in the text
</critical_instructions>

Extract all relevant triplets from the user's input. Make sure to populate the attributes field for each entity with relevant information from the text.`;
};

const disambiguateEntities = async (knowledgeGraph: KnowledgeGraph, client: OpenAI): Promise<KnowledgeGraph> => {
  console.log("\nPerforming entity disambiguation...");

  // Extract all unique entities
  const entities = new Map<string, any>();
  knowledgeGraph.triplets.forEach(triplet => {
    const subjectKey = `${triplet.subject.name}_${triplet.subject.entity_type}`;
    const objectKey = `${triplet.object.name}_${triplet.object.entity_type}`;

    if (!entities.has(subjectKey)) {
      entities.set(subjectKey, triplet.subject);
    }
    if (!entities.has(objectKey)) {
      entities.set(objectKey, triplet.object);
    }
  });

  const entityList = Array.from(entities.values()).map(e => ({
    name: e.name,
    type: e.entity_type
  }));

  console.log(`Found ${entityList.length} unique entities`);

  // Ask LLM to identify duplicates
  const disambiguationPrompt = `You are an entity disambiguation system. Analyze the following list of entities and identify which ones refer to the same real-world entity.

Entities:
${JSON.stringify(entityList, null, 2)}

Return a JSON object with this structure:
{
  "duplicates": [
    {
      "canonical": "The preferred name to use",
      "aliases": ["variant 1", "variant 2"],
      "entity_type": "The entity type"
    }
  ]
}

Only include groups where you're confident the entities are duplicates (e.g., "Sam Altman", "Altman", "OpenAI CEO" might refer to the same person).
If no duplicates are found, return an empty duplicates array.`;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "user", content: disambiguationPrompt }
      ],
      response_format: { type: "json_object" }
    });

    const disambiguation = JSON.parse(response.choices[0].message.content || '{"duplicates":[]}');

    if (disambiguation.duplicates && disambiguation.duplicates.length > 0) {
      console.log(`Found ${disambiguation.duplicates.length} duplicate groups`);

      // Create mapping from aliases to canonical names
      const aliasMap = new Map<string, { canonical: string, type: string }>();
      disambiguation.duplicates.forEach((group: any) => {
        group.aliases.forEach((alias: string) => {
          aliasMap.set(
            `${alias}_${group.entity_type}`,
            { canonical: group.canonical, type: group.entity_type }
          );
        });
      });

      // Update all triplets with canonical names
      const updatedTriplets = knowledgeGraph.triplets.map(triplet => {
        const subjectKey = `${triplet.subject.name}_${triplet.subject.entity_type}`;
        const objectKey = `${triplet.object.name}_${triplet.object.entity_type}`;

        const newSubject = aliasMap.get(subjectKey);
        const newObject = aliasMap.get(objectKey);

        return {
          ...triplet,
          subject: newSubject ? { ...triplet.subject, name: newSubject.canonical } : triplet.subject,
          object: newObject ? { ...triplet.object, name: newObject.canonical } : triplet.object
        };
      });

      // Remove duplicate triplets
      const uniqueTriplets = new Map<string, any>();
      updatedTriplets.forEach(triplet => {
        const key = `${triplet.subject.name}_${triplet.predicate.name}_${triplet.object.name}`;
        if (!uniqueTriplets.has(key)) {
          uniqueTriplets.set(key, triplet);
        }
      });

      const finalTriplets = Array.from(uniqueTriplets.values()).map((t, idx) => ({
        ...t,
        id: idx + 1
      }));

      console.log(`Reduced from ${knowledgeGraph.triplets.length} to ${finalTriplets.length} triplets after deduplication`);

      return {
        ...knowledgeGraph,
        triplets: finalTriplets
      };
    }
  } catch (error) {
    console.error("Error during disambiguation:", error);
    console.log("Continuing with original knowledge graph...");
  }

  return knowledgeGraph;
};

export const mergeGraphs = (graph1: KnowledgeGraph, graph2: KnowledgeGraph): KnowledgeGraph => {
  console.log('Merging knowledge graphs...');
  console.log(`Graph 1: ${graph1.triplets.length} triplets`);
  console.log(`Graph 2: ${graph2.triplets.length} triplets`);

  // Combine all triplets
  const allTriplets = [...graph1.triplets, ...graph2.triplets];

  // Deduplicate based on subject-predicate-object combination
  const uniqueTriplets = new Map();
  allTriplets.forEach(triplet => {
    const key = `${triplet.subject.name}_${triplet.subject.entity_type}_${triplet.predicate.name}_${triplet.object.name}_${triplet.object.entity_type}`;
    if (!uniqueTriplets.has(key)) {
      uniqueTriplets.set(key, triplet);
    }
  });

  // Re-assign IDs
  const mergedTriplets = Array.from(uniqueTriplets.values()).map((t, idx) => ({
    ...t,
    id: idx + 1
  }));

  // Combine and deduplicate entity types
  const entityTypes = Array.from(new Set([
    ...graph1.entity_types,
    ...graph2.entity_types
  ]));

  const mergedGraph: KnowledgeGraph = {
    triplets: mergedTriplets,
    entity_types: entityTypes
  };

  console.log(`Merged: ${mergedGraph.triplets.length} triplets (removed ${allTriplets.length - mergedGraph.triplets.length} duplicates)`);

  return mergedGraph;
};

export const extract = async (sourceText: string) => {
  try {
    // Check if API key is available
    const apiKey = process.env.OPENAI_API_KEY;
    console.log('API Key exists:', !!apiKey);
    console.log('API Key length:', apiKey?.length || 0);

    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set in environment variables');
    }

    console.log(`Source text length: ${sourceText.length} characters\n`);

    console.log('Chunking text...')

    const chunkedSourceText = chunking(sourceText, 800, 100);
    console.log(`Created ${chunkedSourceText.length} chunks\n`);

    console.log("Extracting knowledge graph...\n");

    const client = new OpenAI({
      apiKey,
    });

    const response = await client.responses.create({
      model: "gpt-4o",
      instructions: createKnowledgeGraphPrompt(["PERSON", "COMPANY", "CONCEPT", "OPINION"]),
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
        format: zodTextFormat(knowledgeGraphSchema, "knowledgeGraph")
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
}
