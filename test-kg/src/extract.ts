import dotenv from "dotenv"
import OpenAI from "openai"
import { z } from "zod"
import { zodTextFormat } from "openai/helpers/zod"
import fs from "fs"
import path from "path"

// Load environment variables from .env file
dotenv.config()

// Define the schema for a triplet (subject, relation, object)
const TripletSchema = z.object({
  subject: z.string().describe("The subject entity"),
  subject_type: z.string().describe("The type/category of the subject entity"),
  relation: z.string().describe("The relationship between subject and object"),
  object: z.string().describe("The object entity"),
  object_type: z.string().describe("The type/category of the object entity")
})

// Define the schema for the knowledge graph response
const KnowledgeGraphSchema = z.object({
  triplets: z.array(TripletSchema).describe("Array of extracted knowledge triplets"),
  entity_types: z.array(z.string()).describe("List of entity types found in the graph")
})

type KnowledgeGraph = z.infer<typeof KnowledgeGraphSchema>

const createKnowledgeGraphPrompt = (entityTypes: string[]) => {
  return `You are a knowledge graph extraction system. Your task is to extract structured information from the user's input and return it as a knowledge graph in triplet form.

<instructions>
1. Extract relationships in the form: (subject: entity_type, relation, object: entity_type)
2. Do NOT produce duplicate triplets
3. Be precise and extract only factual relationships present in the text
4. Normalize entity names (e.g., "Apple Inc." and "Apple" should be the same entity)
5. Entity names should be concise and contain all the necessary information to uniquely identify the entity
6. Keep entity names consistent: the same entity should have the same name in all the triplets it appears in
7. Write only the extracted triplets and nothing else
</instructions>

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

Extract all relevant triplets from the user's input.`
}

const sourceText = `
Nasi lemak (Jawi: ناسي لمق‎; Malay pronunciation: [ˌnasi ləˈmaʔ]) is a dish originating in Malay cuisine that consists of rice cooked in coconut milk and pandan leaf. It is commonly found in Malaysia, where it is considered the national dish.[5][6][7] It is also a native dish in neighbouring areas with significant ethnic Malay populations, such as Singapore[8][9] and Southern Thailand. In Indonesia, it can be found in parts of Sumatra, especially the Malay regions of Riau, Riau Islands, and Medan.[10] It is considered an essential dish for a typical Malay-style breakfast.[11]

Nasi lemak can also be found in the Bangsamoro region of Mindanao, prepared by Filipino Moros, as well as in Australia's external territories of Christmas Island and the Cocos (Keeling) Islands.
`
const main = async() => {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  })

  // Example entity types and source text
  const entityTypes = ["Person", "Organization", "Location", "Technology", "Product"]

  console.log("Entity Types:", entityTypes)
  console.log("Source Text:", sourceText)
  console.log("\nExtracting knowledge graph...\n")

  try {
    const response = await client.responses.create({
      model: "gpt-5",
      instructions: createKnowledgeGraphPrompt(entityTypes),
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: sourceText
            }
          ]
        }
      ],
      text: {
        format: zodTextFormat(KnowledgeGraphSchema, "knowledgeGraph")
      }
    })

    const knowledgeGraph: KnowledgeGraph = JSON.parse(response.output_text)
    console.log(knowledgeGraph)

    if (knowledgeGraph) {
      console.log("Knowledge Graph Extracted:")
      console.log("Entity Types Found:", knowledgeGraph.entity_types)
      console.log(`\nTriplets (${knowledgeGraph.triplets.length}):\n`)

      knowledgeGraph.triplets.forEach((triplet, idx) => {
        console.log(`${idx + 1}. (${triplet.subject}: ${triplet.subject_type}) → ${triplet.relation} → (${triplet.object}: ${triplet.object_type})`)
      })

      // Save to JSON file for visualization
      const outputDir = "public"
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
      }

      const filePath = path.join(outputDir, "knowledge-graph.json")
      fs.writeFileSync(filePath, JSON.stringify(knowledgeGraph, null, 2))
      console.log(`\n✓ Knowledge graph saved to: ${filePath}`)
      console.log("✓ Run 'npm run dev:vite' to visualize the graph in browser")
    }

  } catch (error) {
    console.error("Error extracting knowledge graph:", error)
  }
}

main()
