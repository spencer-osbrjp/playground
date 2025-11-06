import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { KnowledgeGraph } from "./share/type";
import { KnowledgeGraphTextFormat } from "./share/schema";

dotenv.config();

const createInferencePrompt = (graph: KnowledgeGraph) => {
  return `
You are a data scientist expert in Knowledge Graph inference. You are tasked to take an existing knowledge graph and add inferred relationships to enrich it.

<existing_knowledge_graph>
${JSON.stringify(graph.triplets)}
</existing_knowledge_graph>

<instructions>
1. Analyze the existing triplets to identify hidden connections and relationships
2. Create NEW triplets for inferred relationships and mark them with \`inferred: true\`
3. DO NOT modify or remove any existing triplets
4. DO NOT create duplicate triplets
5. DO NOT create new nodes

# Inference Techniques:

## Rule-Based Inference:
- **Transitive Relationships**: If A enables B, and B drives C, infer that A influences C
- **Hierarchical Relationships**: If A is part of B, and B is part of C, infer that A is part of C

## Lexical Similarity:
- Entities with similar names might be linked with a generic "related to" relationship
- Example: "animated television series" and "television series" could be related

## Domain Knowledge:
- Use common sense and domain knowledge to infer likely relationships
- Example: If X portrayed Y in a film, and the film is part of a franchise, infer that X appears in the franchise

Mark ALL inferred triplets with \`inferred: true\`
Mark ALL original triplets with \`inferred: false\`
</instructions>

<critical_instructions>
1. All relationships MUST be no more than 3 words maximum. Ideally 1-2 words. This is a hard limit.
</critical_instructions>
`
}

const infer = async () => {
  const args = process.argv.slice(2);

  if (args.length !== 1) {
    console.error("Usage: npm run infer <path-to-graph-file>");
    console.error("Example: npm run infer public/knowledge-graph.json");
    console.error("Example: npm run infer public/knowledge-graph-merged.json");
    process.exit(1);
  }

  const graphFilePath = args[0];

  // Check if graph file exists
  if (!fs.existsSync(graphFilePath)) {
    console.error(`Error: Graph file not found at ${graphFilePath}`);
    process.exit(1);
  }

  try {
    console.log(`Loading knowledge graph from: ${graphFilePath}`);
    const graph: KnowledgeGraph = JSON.parse(
      fs.readFileSync(graphFilePath, "utf-8")
    );
    console.log(`  - Triplets: ${graph.triplets.length}`);
    console.log(`  - Entity types: ${graph.entity_types.join(", ")}`);

    // Infer new relationships
    console.log("\nInferring hidden relationships using AI...\n");

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await client.responses.create({
      model: "gpt-5",
      instructions: createInferencePrompt(graph),
      reasoning: {
        effort: "low"
      },
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
        format: KnowledgeGraphTextFormat
      },
    });

    const inferredGraph: KnowledgeGraph = JSON.parse(response.output_text);

    if (inferredGraph) {
      console.log("Inferred Knowledge Graph:");
      console.log("Entity Types Found:", inferredGraph.entity_types);
      console.log(`\nTriplets (${inferredGraph.triplets.length}):\n`);

      const originalCount = inferredGraph.triplets.filter(t => !t.inferred).length;
      const inferredCount = inferredGraph.triplets.filter(t => t.inferred).length;

      console.log(`Original triplets: ${originalCount}`);
      console.log(`Inferred triplets: ${inferredCount}`);
      console.log(`Total triplets: ${inferredGraph.triplets.length}\n`);

      inferredGraph.triplets.forEach((triplet, idx) => {
        const inferredMark = triplet.inferred ? " [INFERRED]" : "";
        console.log(
          `${idx + 1}. (${triplet.subject}: ${triplet.subject_type}) → ${triplet.relation} → (${triplet.object}: ${triplet.object_type})${inferredMark}`,
        );
      });

      // Save inferred graph to JSON file
      const outputDir = path.dirname(graphFilePath);
      const outputFileName = `knowledge-graph-inferred.json`;
      const filePath = path.join(outputDir, outputFileName);

      fs.writeFileSync(filePath, JSON.stringify(inferredGraph, null, 2));
      console.log(`\n✓ Inferred knowledge graph saved to: ${filePath}`);
      console.log("✓ Run 'npm run dev' to visualize the inferred graph in browser");
    } else {
      console.error("\n✗ Inference failed!");
      process.exit(1);
    }
  } catch (error) {
    console.error("Error during inference:", error);
    process.exit(1);
  }
};

infer();
