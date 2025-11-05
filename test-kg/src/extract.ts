import dotenv from "dotenv";
import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import fs from "fs";
import path from "path";

// Load environment variables from .env file
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

const sourceText = `
# How AI is reshaping the career ladder, and other trends in jobs and skills on Labour Day

Are entry-level jobs on the way out?

For decades, entry-level roles have provided essential training grounds for newcomers to step into the world of work. From finance to journalism, junior staff have traditionally handled the ‘grunt work’ as a rite of passage as much as a development opportunity.

But as AI reshapes the career ladder, these early entry points could be increasingly at risk, according to Bloomberg.

International Workers Day, on 1 May, signifies the labour movement’s struggle for the rights of workers. AI stands as one of the most significant challenges – and opportunities – facing the labour market today.

While 170 million new jobs are projected to be created this decade, the rise of AI-powered tools threatens to automate as many roles as it creates, particularly for white collar, entry-level roles. Bloomberg finds that AI could replace more than 50% of the tasks performed by market research analysts (53%) and sales representatives (67%), compared to just 9% and 21% for their managerial counterparts.

Whether by narrowing entry pathways or making roles that once required specialized skills more accessible, estimates suggest that AI could impact nearly 50 million US jobs in the coming years.

## How AI could be closing the door on talent...

The Forum’s Future of Jobs Report 2025 reveals that 40% of employers expect to reduce their workforce where AI can automate tasks.

Technology, overall, is projected to be the most disruptive force in the labour market, with trends in AI and information processing technology expected to create 11 million jobs, while simultaneously displacing 9 million others.

As entry-level roles decline, salary expectations are also shifting, with remaining hires expected to take on roles supported by AI for less money. A recent survey found that 49% of US Gen Z job hunters believe AI has reduced the value of their college education in the job market.

At the same time, US firms are expanding business operations in India, where skilled professionals can be employed at significantly lower costs, Charter points out, further intensifying competition for white-collar roles.

But this can create a talent pipeline problem, with significant implications for social mobility and equal representation, Bloomberg says.

## ...while also opening new doors

Gen AI could democratize access to jobs, making it easier to build the technical knowledge and skills that have historically excluded otherwise qualified workers, according to Charter.

Rather than eliminating entry-level opportunities altogether, companies could harness AI to train the next generation of senior professionals. From law firms saying goodbye to the billable hour to more emphasis on apprenticeships, traditional structures could be redefined.

As Gen AI becomes further embedded in the workplace, companies will need to invest in substantial upskilling efforts to prepare their employees for the AI-driven economy.

Alongside global macroeconomic trends, AI is set to reshape the traditional career ladder, with entry-level jobs at risk. But employers and employees alike can prioritize upskilling, education efforts and levelling the playing field that comes with harnessing AI’s potential.


`

const sourceText3 = `
# OpenAI’s Sam Altman sees AI bubble forming as industry spending surges

OpenAI CEO Sam Altman thinks the artificial intelligence market is in a bubble, according to a report from The Verge published Friday. 

“When bubbles happen, smart people get overexcited about a kernel of truth,” Altman told a small group of reporters last week.

“Are we in a phase where investors as a whole are overexcited about AI? My opinion is yes. Is AI the most important thing to happen in a very long time? My opinion is also yes,” he was quoted as saying. 

Altman appeared to compare this dynamic to the infamous dot-com bubble, a stock market crash centered on internet-based companies that led to massive investor enthusiasm during the late 1990s. Between March 2000 and October 2002, the Nasdaq lost nearly 80% of its value after many of these companies failed to generate revenue or profits. 

His comments add to growing concern among experts and analysts that investment in AI is moving too fast. Alibaba co-founder Joe Tsai, Bridgewater Associates’ Ray Dalio and Apollo Global Management chief economist Torsten Slok have all raised similar warnings.

Last month, Slok stated in a report that he believed the AI bubble of today was, in fact, bigger than the internet bubble, with the top 10 companies in the S&P 500 more overvalued than they were in the 1990s. 

In a Monday email to CNBC, Ray Wang, research director for semiconductors, supply chain and emerging technology at Futurum Group, said that he thought Altman’s comments carry some validity, but that the risks are company-dependent.

“From the perspective of broader investment in AI and semiconductors... I don’t see it as a bubble. The fundamentals across the supply chain remain strong, and the long-term trajectory of the AI trend supports continued investment,” he said. 

However, he added that there is an increasing amount of speculative capital chasing companies with weaker fundamentals and only perceived potential, which could create pockets of overvaluation. 

Many Fears of an AI bubble had hit a fever pitch at the start of this year when Chinese start-up DeepSeek released a competitive reasoning model. The company claimed one version of its advanced large language models had been trained for under $6 million, a fraction of the billions being spent by U.S. AI market leaders like OpenAI, though these claims were also been met with some skepticism.

Earlier this month, Altman told CNBC that OpenAI’s annual recurring revenue is on track to pass $20 billion this year, but that despite that, it remains unprofitable. 

The release of OpenAI’s latest GPT-5 AI model earlier this month had also been rocky, with some critics complaining that it had a less intuitive feel. This resulted in the company restoring access to legacy GPT-4 models for paying customers.

Following the release of the model, Altman has also signaled more caution about some of the AI industry’s more bullish predictions.

Speaking to CNBC, he said that he thought the term artificial general intelligence, or “AGI,” is losing relevance, when asked whether the GPT-5 model moves the world any closer to achieving AGI.
`
const sourceText2 = `
---
We point out that the share of the economy devoted to AI investment is nearly a third greater than the share of the economy devoted to internet related investments back during the dotcom bubble. So, we think there are enough analogies there to make the call.

Bernstein told CNBC’S “Squawk Box” last week that surging asset prices and extreme valuations indicate that an AI bubble is the “likely outcome.”

He said that bubbles are defined by a vast gap between investment levels and the actual “credible expectations” for future profits.

Bernstein pointed to OpenAI, which has already made around $1 trillion in AI deals, including a $500 billion data center buildout project, despite being set to generate only $13 billion in revenue.

“You’ve got to account for future earnings,” Bernstein said. “But to us and many others, that divergence between credibly, plausible, expected future earnings and this level of investment certainly looks bubbly.”

Despite the Magnificent Seven’s spending spree on AI, Bernstein said that their profits are mostly coming from other areas like advertisements and cloud services.

“If you actually look at the AI investments, they tend to be a small share of [the profits],” Bernstein said. “So that actually contributes to the bubble hypothesis.”
---

---
I think some of the investments that we’ve seen so far is not on AI, it’s more on cloud and the power of cloud. So I don’t believe this is a bubble, but I believe this is capital that in most cases is going to be well spent.

Fink said on CNBC’s “Squawk on the Street” last week that there is definitely a “skyrocketing amount of capital” being funneled into AI, which he believes is not a sign of a bubble but rather a necessary investment for the U.S. to remain a global leader in AI technology.

“Investing in AI does not just mean investing in GPUs and chips, it means investing in HVAC and IT, investing in power grids and power supplies,” Fink said.

The BlackRock CEO said that these massive stakes will ultimately lead to some failures, but he is confident that major hyperscalers like Meta
, Microsoft
, and Alphabet
 are in a “really good position” to be winners.

“That is capitalism,” Fink said. “We’re going to have some big winners and we’re going to have some big losers ... but if you have a diversified portfolio, you’re going to be fine.”
---

`

const sourceText1 = `
---
Are we in an AI bubble? Of course! ... Of course we are. I mean, we’re hyped, we’re accelerating, we’re putting enormous leverage into the system.
Gelsinger said that although the AI-driven market is already in a bubble, it would be “several years” before he sees it ending.

“We’re displacing all of the internet and the service provider industries as we think about it today,” Gelsinger said on “Squawk Box” last week. “We have a long way to go.”

The ex-Intel CEO believes that major disruptive technologies will develop in the latter end of this decade, when companies might begin to materially benefit from them, giving the bubble plenty of time before it pops.

“That being said, it will change,” Gelsinger said. “These are radical improvements in AI efficiency that occurred this year.”
---

---
We’re certainly seeing lots of evidence of bubble-like behavior in the AI space. We see the kind of circular revenue deals, we see a lot of very aggressive price behavior.

Inker said on CNBC’s “Money Movers” last week that firm investments are shifting from being financed by free cash flow to relying on debts and massive stakes from Nvidia.

“It’s one thing if Microsoft or Meta wants to invest a whole bunch of money in data centers where they’ve got the cash flow for it,” Inker said. “OpenAI doesn’t, xAI doesn’t, even Oracle is issuing a lot of debt to be doing this.”

Last year, OpenAI expected about $5 billion in operating losses on $3.7 billion in revenue, and is still losing money. Inker said this makes Nvidia’s $100 billion investment in OpenAI — for building data centers backed by Nvidia chips — concerning.

“It is that this entire ecosystem has kind of run out of the capital from the cash flow of the hyperscalers, who have been funding things so far, and now needs to be funded by debt and these very strange deals between Nvidia and AMD and some of these money-losing firms that have huge capital needs,” Inker said.
---
`

const sourceTextIronMan = `
Iron Man is a superhero appearing in American comic books published by Marvel Comics. Co-created by writer and editor Stan Lee, developed by scripter Larry Lieber, and designed by artists Don Heck and Jack Kirby, the character first appeared in Tales of Suspense #39 in 1962 (cover dated March 1963) and received his own title with Iron Man #1 in 1968. Shortly after his creation, Iron Man became a founding member of the superhero team, the Avengers, alongside Thor, Ant-Man, the Wasp, and the Hulk. Iron Man stories, individually and with the Avengers, have been published consistently since the character's creation.

Iron Man is the superhero persona of Anthony Edward "Tony" Stark, a businessman and engineer who runs the weapons manufacturing company Stark Industries. When Stark was captured in a war zone and sustained a severe heart wound, he built his Iron Man armor and escaped his captors. Iron Man's suits of armor grant him superhuman strength, flight, energy projection, and other abilities. The character was created in response to the Vietnam War as Lee's attempt to create a likeable pro-war character. Since his creation, Iron Man has been used to explore political themes, with early Iron Man stories being set in the Cold War. The character's role as a weapons manufacturer proved controversial, and Marvel moved away from geopolitics by the 1970s. Instead, the stories began exploring themes such as civil unrest, technological advancement, corporate espionage, alcoholism, and governmental authority.

Major Iron Man stories include "Demon in a Bottle" (1979), "Armor Wars" (1987–1988), "Extremis" (2005), and "Iron Man 2020" (2020). He is also a leading character in the company-wide stories Civil War (2006–2007), Dark Reign (2008–2009), and Civil War II (2016). Additional superhero characters have emerged from Iron Man's supporting cast, including James Rhodes as War Machine and Riri Williams as Ironheart, as well as reformed villains, Natasha Romanova as Black Widow and Clint Barton as Hawkeye. Iron Man's list of enemies includes his archenemy, the Mandarin, various supervillains of communist origin, and many of Stark's business rivals.

Robert Downey Jr. portrayed Tony Stark in Iron Man (2008), the first film of the Marvel Cinematic Universe, and continued to portray the character until his final live-action appearance in Avengers: Endgame (2019). Downey's portrayal popularized the character, elevating Iron Man into one of Marvel's most recognizable superheroes. Other adaptations of the character appear in animated direct-to-video films, television series, and video games.
`;
const sourceTextMarvelComics = `
The Avengers are a superhero/antihero team appearing in American comic books published by Marvel Comics, created by writer-editor Stan Lee and artist/co-plotter Jack Kirby. The team made its debut in The Avengers #1 (cover-dated September 1963). Labeled "Earth's Mightiest Heroes", the original Avengers consisted of Iron Man, Ant-Man, Hulk, Thor, and Wasp. Captain America was discovered trapped in ice in issue #4, and joined the group after they revived him. The Avengers are an all-star ensemble cast of established superhero characters from the Marvel Comics portfolio.

Diegetically, these superheroes usually operate independently but occasionally assemble as a team to tackle especially formidable villains. This in contrast to certain other superhero teams such as the X-Men, whose characters were created specifically to be part of their team, with the team being central to their identity. The Avengers were created to create a new line of books to sell and to cross-promote Marvel Comics characters.

An Iron Man fan might buy an Avengers book because Iron Man appears in them, and perhaps in turn take an interest in Thor, who appears in the same book as Iron Man's friend and comrade.[2] The cast usually features a few highly popular characters who have their own solo books, such as Iron Man, alongside a number of lesser-known characters who benefit from exposure, such as Quicksilver, Wonder Man, and Tigra.[3]

The Avengers have appeared in a wide variety of media outside of comic books, including several different animated television series and direct-to-video films. Beginning in 2008, the group were adapted in a film series from Marvel Studios, known as the Marvel Cinematic Universe, culminating with The Avengers in 2012, with more appearances of the team in subsequent films.
`;
const sourceTextNasiLemak = `
Nasi lemak (Jawi: ناسي لمق‎; Malay pronunciation: [ˌnasi ləˈmaʔ]) is a dish originating in Malay cuisine that consists of rice cooked in coconut milk and pandan leaf. It is commonly found in Malaysia, where it is considered the national dish.[5][6][7] It is also a native dish in neighbouring areas with significant ethnic Malay populations, such as Singapore[8][9] and Southern Thailand. In Indonesia, it can be found in parts of Sumatra, especially the Malay regions of Riau, Riau Islands, and Medan.[10] It is considered an essential dish for a typical Malay-style breakfast.[11]

Nasi lemak can also be found in the Bangsamoro region of Mindanao, prepared by Filipino Moros, as well as in Australia's external territories of Christmas Island and the Cocos (Keeling) Islands.
`;
const main = async () => {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // // Example entity types and source text
  // const entityTypes = ["Person", "Organization", "Location", "Technology", "Product"]
  //
  // console.log("Entity Types:", entityTypes)
  console.log("Source Text:", sourceText);
  console.log("\nExtracting knowledge graph...\n");

  try {
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
        format: zodTextFormat(KnowledgeGraphSchema, "knowledgeGraph"),
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
      console.log("✓ Run 'npm run dev:vite' to visualize the graph in browser");
    }
  } catch (error) {
    console.error("Error extracting knowledge graph:", error);
  }
};

const createMergePrompt = (set1: KnowledgeGraph, set2: KnowledgeGraph) => {
  return `
You are a data scientist expert in Entity Resolution in Knowledge Graph. You are tasked to merge 2 given knowledge graph into 1.

<knowledge_graph_dataset_1>
${set1.triplets}
</knowledge_graph_dataset_1>

<knowledge_graph_dataset_2>
${set2.triplets}
</knowledge_graph_dataset_2>

<instructions>
1. Merge the given data <knowledge_graph_dataset_1> and <knowledge_graph_dataset_2>.
2. DO NOT produce duplicate triplets
3. If the subject OR object is duplicated, merge them into 1 if possible
4. Perform "Transitive Relationship" or "Lexical Similarity" for inferring hidden connections to enrich graph
5. Standardize entities across the data. For example, "AI", "A.I", "Artificial Intelligence" can be standardized as "AI" to avoid fragment or duplicated nodes.
6. Mark \`inferred\` to \`true\` when it is inferred
7. If the relation of 2 triplets is difference, choose only 1 of them where the 1 that is easiest to understand.
</instructions>
`
}

// Define the schema for a triplet (subject, relation, object)
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

const mergeKnowledgeGraphData = async (
  set1: KnowledgeGraph,
  set2: KnowledgeGraph,
) => {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  console.log("\nMerging knowledge graphs...\n");

  const response = await client.responses.create({
    model: "gpt-5",
    instructions: createMergePrompt(set1, set2),
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

    return mergedKnowledgeGraph;
  }

  return null;
};

// Export for use in merge script
export { mergeKnowledgeGraphData, type KnowledgeGraph, type MergedKnowledgedGraph };

// Only run main if this file is executed directly
// In ES modules, we check if import.meta.url matches the process argv
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
