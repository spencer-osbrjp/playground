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

// Define the schema for a triplet with inferred flag
const TripletSchemaWithInferred = z.object({
  subject: z.string().describe("The subject entity"),
  subject_type: z.string().describe("The type/category of the subject entity"),
  relation: z.string().describe("The relationship between subject and object"),
  object: z.string().describe("The object entity"),
  object_type: z.string().describe("The type/category of the object entity"),
  inferred: z.boolean().describe("Is this an inferred connections")
});

const MergedKnowledgeGraphSchema = z.object({
  triplets: z
    .array(TripletSchemaWithInferred)
    .describe("Array of extracted knowledge triplets"),
  entity_types: z
    .array(z.string())
    .describe("List of entity types found in the graph"),
});

type MergedKnowledgedGraph = z.infer<typeof MergedKnowledgeGraphSchema>

const createMergePrompt = (set1: KnowledgeGraph, set2: KnowledgeGraph) => {
  return `
You are a data scientist expert in Entity Resolution in Knowledge Graph. You are tasked to merge 2 given knowledge graph into 1.

<knowledge_graph_dataset_1>
${JSON.stringify(set1.triplets)}
</knowledge_graph_dataset_1>

<knowledge_graph_dataset_2>
${JSON.stringify(set2.triplets)}
</knowledge_graph_dataset_2>

<instructions>
1. Merge the given data <knowledge_graph_dataset_1> and <knowledge_graph_dataset_2>.
2. DO NOT produce duplicate triplets
3. If the subject OR object is duplicated, merge them into 1 if possible
4. Create new triplets if it is a "Transitive Relationship" or "Lexical Similarity" for inferring hidden connections to enrich graph, refer to <inferred_insctructions> for more details
5. Standardize entities across the data. For example, "AI", "A.I", "Artificial Intelligence" can be standardized as "AI" to avoid fragment or duplicated nodes.
6. If the relation of 2 triplets is difference, choose only 1 of them where the 1 that is easiest to understand.
</instructions>

<inferred_insctructions>
Create a new triplets if there is any hidden connections between each node

# Rule-Based Inference:
- Transitive Relationships: If A enables B, and B drives C, the system can infer A influences C.
- Lexical Similarity: Entities with similar names might be linked with a generic “related to” relationship.

Mark \`inferred\` to \`true\` when it is inferred
</inferred_insctructions>
`
}

const merge = async () => {
  const args = process.argv.slice(2);

  if (args.length !== 1) {
    console.error("Usage: npm run merge <path-to-archive-file>");
    console.error("Example: npm run merge public/archieve/knowledge-graph(iron_man_1).json");
    process.exit(1);
  }

  const archiveFilePath = args[0];
  const currentGraphPath = path.join("public", "knowledge-graph.json");

  // Check if archive file exists
  if (!fs.existsSync(archiveFilePath)) {
    console.error(`Error: Archive file not found at ${archiveFilePath}`);
    process.exit(1);
  }

  // Check if current graph exists
  if (!fs.existsSync(currentGraphPath)) {
    console.error(`Error: Current knowledge graph not found at ${currentGraphPath}`);
    console.error("Please run 'npm run extract' first to generate the current graph.");
    process.exit(1);
  }

  try {
    console.log(`Loading current knowledge graph from: ${currentGraphPath}`);
    const currentGraph: KnowledgeGraph = JSON.parse(
      fs.readFileSync(currentGraphPath, "utf-8")
    );
    console.log(`  - Triplets: ${currentGraph.triplets.length}`);
    console.log(`  - Entity types: ${currentGraph.entity_types.join(", ")}`);

    console.log(`\nLoading archive file from: ${archiveFilePath}`);
    const archiveGraph: KnowledgeGraph = JSON.parse(
      fs.readFileSync(archiveFilePath, "utf-8")
    );
    console.log(`  - Triplets: ${archiveGraph.triplets.length}`);
    console.log(`  - Entity types: ${archiveGraph.entity_types.join(", ")}`);

    // Merge the graphs
    console.log("\nMerging knowledge graphs using AI...\n");

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await client.responses.create({
      model: "gpt-5",
      instructions: createMergePrompt(currentGraph, archiveGraph),
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Merge the two knowledge graphs as described in the instructions.",
            },
          ],
        },
      ],
      text: {
        format: zodTextFormat(MergedKnowledgeGraphSchema, "mergedKnowledgeGraph"),
      },
    });

    const mergedKnowledgeGraph: MergedKnowledgedGraph = JSON.parse(response.output_text);

    if (mergedKnowledgeGraph) {
      console.log("Merged Knowledge Graph:");
      console.log("Entity Types Found:", mergedKnowledgeGraph.entity_types);
      console.log(`\nTriplets (${mergedKnowledgeGraph.triplets.length}):\n`);

      mergedKnowledgeGraph.triplets.forEach((triplet, idx) => {
        const inferredMark = triplet.inferred ? " [INFERRED]" : "";
        console.log(
          `${idx + 1}. (${triplet.subject}: ${triplet.subject_type}) → ${triplet.relation} → (${triplet.object}: ${triplet.object_type})${inferredMark}`,
        );
      });

      // Save merged graph to JSON file
      const outputDir = "public";
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const filePath = path.join(outputDir, "knowledge-graph-merged.json");
      fs.writeFileSync(filePath, JSON.stringify(mergedKnowledgeGraph, null, 2));
      console.log(`\n✓ Merged knowledge graph saved to: ${filePath}`);
      console.log("✓ Run 'npm run dev:vite' to visualize the merged graph in browser");
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
