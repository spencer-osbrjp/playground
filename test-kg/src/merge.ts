import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";

dotenv.config();

// Define the schema for a triplet (subject, relation, object)
const TripletSchema = z.object({
  subject: z.string().describe("The subject entity"),
  subject_type: z.string().describe("The type/category of the subject entity"),
  relation: z.string().describe("The relationship between subject and object"),
  object: z.string().describe("The object entity"),
  object_type: z.string().describe("The type/category of the object entity"),
});

// Define the schema for the knowledge graph response
const KnowledgeGraphSchema = z.object({
  triplets: z
    .array(TripletSchema)
    .describe("Array of extracted knowledge triplets"),
  entity_types: z
    .array(z.string())
    .describe("List of entity types found in the graph"),
});

type KnowledgeGraph = z.infer<typeof KnowledgeGraphSchema>;

// Merged graph uses the same schema as regular knowledge graph
type MergedKnowledgeGraph = KnowledgeGraph;

const createMergePrompt = (merged: KnowledgeGraph) => {
  return `
You are a data scientist expert in Entity Resolution in Knowledge Graph. You are tasked to identify duplicated triplets and nodes.

<entity_types>
${JSON.stringify(merged.entity_types)}
</entity_types>

<knowledge_graph_dataset>
${JSON.stringify(merged.triplets)}
</knowledge_graph_dataset_1>

<instructions>
1. Standardize nodes name across the data. For example, "AI", "A.I", "Artificial Intelligence" can be standardized as "AI" to avoid fragment or duplicated nodes.
2. Standardize entities name across the data. For example, "ORG", "ORGANISATION" can be standardized as "ORGANISATION"
3. Merge duplicated triplets
4. If the subject OR object is duplicated, merge them into 1 if possible
5. DO NOT create new inferred relationships.
6. If the triplets has similar meaning, merge them. Use the one that is more detailed
7. If the node has similar meaning, merge them. Use the one that is more detailed
</instructions>
`;
};

const merge = async () => {
  const args = process.argv.slice(2);

  if (args.length < 1 || args.length > 2) {
    console.error("Usage: npm run merge <path-to-file>");
    console.error("   or: npm run merge <path-to-file-1> <path-to-file-2>");
    console.error("");
    console.error("Examples:");
    console.error(
      "  npm run merge public/archieve/knowledge-graph(iron_man_1).json",
    );
    console.error("  npm run merge public/graph1.json public/graph2.json");
    process.exit(1);
  }

  let firstGraphPath: string;
  let secondGraphPath: string;

  // Determine which files to merge
  if (args.length === 1) {
    // Merge knowledge-graph.json with provided file
    firstGraphPath = path.join("public", "knowledge-graph.json");
    secondGraphPath = args[0];

    // Check if current graph exists
    if (!fs.existsSync(firstGraphPath)) {
      console.error(`Error: Knowledge graph not found at ${firstGraphPath}`);
      console.error(
        "Please run 'npm run extract' first to generate the knowledge graph.",
      );
      process.exit(1);
    }
  } else {
    // Merge two provided files
    firstGraphPath = args[0];
    secondGraphPath = args[1];
  }

  // Check if both files exist
  if (!fs.existsSync(firstGraphPath)) {
    console.error(`Error: First file not found at ${firstGraphPath}`);
    process.exit(1);
  }

  if (!fs.existsSync(secondGraphPath)) {
    console.error(`Error: Second file not found at ${secondGraphPath}`);
    process.exit(1);
  }

  try {
    console.log(`Loading first knowledge graph from: ${firstGraphPath}`);
    const firstGraph: KnowledgeGraph = JSON.parse(
      fs.readFileSync(firstGraphPath, "utf-8"),
    );
    console.log(`  - Triplets: ${firstGraph.triplets.length}`);
    console.log(`  - Entity types: ${firstGraph.entity_types.join(", ")}`);

    console.log(`\nLoading second knowledge graph from: ${secondGraphPath}`);
    const secondGraph: KnowledgeGraph = JSON.parse(
      fs.readFileSync(secondGraphPath, "utf-8"),
    );
    console.log(`  - Triplets: ${secondGraph.triplets.length}`);
    console.log(`  - Entity types: ${secondGraph.entity_types.join(", ")}`);

    const mergedKnowledgeGraph: KnowledgeGraph = {
      triplets: [...firstGraph.triplets, ...secondGraph.triplets],
      entity_types: [...firstGraph.entity_types, ...secondGraph.entity_types],
    };


    console.log(`\n Merged Knowledge Graph:\n`);
    console.log(`  - Triplets: ${mergedKnowledgeGraph.triplets.length}`);
    console.log(`  - Entity types: ${mergedKnowledgeGraph.entity_types.join(", ")}`);
    // Merge the graphs
    console.log("\nClean up merged knowledge graphs using AI...\n");

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await client.responses.create({
      model: "gpt-5",
      reasoning: {
        effort: "medium"
      },
      instructions: createMergePrompt(mergedKnowledgeGraph),
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Merge the triplets from the knowledge graphs as described in the instructions.",
            },
          ],
        },
      ],
      text: {
        format: zodTextFormat(KnowledgeGraphSchema, "mergedKnowledgeGraph"),
      },
    });

    const mergedKnowledgeGraphResult: MergedKnowledgeGraph = JSON.parse(
      response.output_text,
    );

    if (mergedKnowledgeGraphResult) {
      console.log("Merged Knowledge Graph:");
      console.log("Entity Types Found:", mergedKnowledgeGraph.entity_types);
      console.log(`\nTriplets (${mergedKnowledgeGraph.triplets.length}):\n`);

      mergedKnowledgeGraphResult.triplets.forEach((triplet, idx) => {
        console.log(
          `${idx + 1}. (${triplet.subject}: ${triplet.subject_type}) → ${triplet.relation} → (${triplet.object}: ${triplet.object_type})`,
        );
      });

      // Save merged graph to JSON file
      const outputDir = "public";
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const filePath = path.join(outputDir, "knowledge-graph-merged.json");
      fs.writeFileSync(
        filePath,
        JSON.stringify(mergedKnowledgeGraphResult, null, 2),
      );
      console.log(`\n✓ Merged knowledge graph saved to: ${filePath}`);
      console.log(
        "✓ Run 'npm run dev' to visualize the merged graph in browser",
      );
    } else {
      console.error("\n✗ Merge failed!");
      process.exit(1);
    }
  } catch (error) {
    console.error("Error during merge:", error);
    process.exit(1);
  }
};

merge();
