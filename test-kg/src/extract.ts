import dotenv from "dotenv";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { KnowledgeGraph } from "./share/type.ts"
import { KnowledgeGraphTextFormat } from "./share/schema.ts";

// Load environment variables from .env file
dotenv.config();

const createKnowledgeGraphPrompt = () => {
  return `You are a knowledge graph extraction system. Your task is to extract structured information from the user's input and return it as a knowledge graph in triplet form.

<instructions>
1. Extract relationships in the form: (subject: entity_type, relation, object: entity_type)
2. DO NOT produce duplicate triplets
3. Be precise and extract only factual relationships present in the text
4. Normalize entity names (e.g., "Apple Inc." and "Apple" should be the same entity)
5. Entity names should be concise and contain all the necessary information to uniquely identify the entity
6. Keep entity names consistent: the same entity should have the same name in all the triplets it appears in
7. Write only the extracted triplets and nothing else
8. DO NOT create new relation that is NOT from the provided source
9. Keep the subject and object name short, create a new triplet if needed when the object name is long
</instructions>

<critical_instructions>
1. All relationships MUST be no more than 3 words maximum. Ideally 1-2 words. This is a hard limit.
</critical_instructions>

<example>
---
<user>{user_instruction} Gold is a chemical element with the chemical symbol Au (from Latin aurum) and atomic number 79. In its pure form, it is a bright, slightly orange-yellow, dense, soft, malleable, and ductile metal. Chemically, gold is a transition metal, a group 11 element, and one of the noble metals. In 2023, the world's largest gold producer was China, followed by Russia and Australia.
{allowed_types_prompt} 'CHEMICAL', 'COUNTRY'</user>
<assistant>(Gold:CHEMICAL, is a, chemical element:CHEMICAL), (Gold:CHEMICAL, chemical symbol, Au:CHEMICAL), (Gold:CHEMICAL, is one of, transition metals:CHEMICAL), (Gold:CHEMICAL, is one of, noble metals:CHEMICAL), (Gold:CHEMICAL, used in, Jewelry: APPLICATION), (China:COUNTRY, largest producer of, GOLD: CHEMICAL), (Russia: COUNTRY, second-largest producer of, Gold: CHEMICAL), (Australia: COUNTRY, third-largest producer of, Gold:CHEMICAL) </assistant>
---
<user>{user_instruction} The lion (Panthera leo) is a large cat of the genus Panthera, native to Africa and India. It is sexually dimorphic; adult male lions are larger than females and have a prominent mane.
{allowed_types_prompt} 'ANIMAL', 'LOCATION'</user>
<assistant>(lion:ANIMAL, scientific name, Panthera leo:ANIMAL), (lion:ANIMAL, belongs to, genus Panthera:ANIMAL), (lion:ANIMAL, native to, Africa:LOCATION), (lion:ANIMAL, native to, India:LOCATION), (male lion:ANIMAL, larger than, female lion:ANIMAL)</assistant>
---
</example>

Extract all relevant triplets from the user's input.`;
};

const main = async () => {
  const args = process.argv.slice(2);

  if (args.length !== 1) {
    console.error("Usage: npm run extract <path-to-source-file>");
    console.error("Example: npm run extract source.txt");
    console.error("Example: npm run extract documents/article.md");
    process.exit(1);
  }

  const sourceFilePath = args[0];

  // Check if source file exists
  if (!fs.existsSync(sourceFilePath)) {
    console.error(`Error: Source file not found at ${sourceFilePath}`);
    process.exit(1);
  }

  try {
    // Read source text from file
    const sourceText = fs.readFileSync(sourceFilePath, "utf-8");

    console.log(`Reading source text from: ${sourceFilePath}`);
    console.log(`Source text length: ${sourceText.length} characters\n`);
    console.log("Extracting knowledge graph...\n");

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    const response = await client.responses.create({
      model: "gpt-5",
      instructions: createKnowledgeGraphPrompt(),
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: sourceText,
            },
          ],
        },
      ],
      text: {
        format: KnowledgeGraphTextFormat
      },
    });

    const knowledgeGraph: KnowledgeGraph = JSON.parse(response.output_text);
    console.log(knowledgeGraph);

    if (knowledgeGraph) {
      console.log("Knowledge Graph Extracted:");
      console.log("Entity Types Found:", knowledgeGraph.entity_types);
      console.log(`\nTriplets (${knowledgeGraph.triplets.length}):\n`);

      knowledgeGraph.triplets.forEach((triplet, idx) => {
        console.log(
          `${idx + 1}. (${triplet.subject}: ${triplet.subject_type}) → ${triplet.relation} → (${triplet.object}: ${triplet.object_type})`,
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
      console.log("✓ Run 'npm run dev' to visualize the graph in browser");
    }
  } catch (error) {
    console.error("Error extracting knowledge graph:", error);
    process.exit(1);
  }
};

// Only run main if this file is executed directly
// In ES modules, we check if import.meta.url matches the process argv
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
