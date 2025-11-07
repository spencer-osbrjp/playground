import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = new Hono();

// Enable CORS for local development
app.use('/*', cors());

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'ok', message: 'API server is running' });
});

// Deep research endpoint
app.post('/api/research', async (c) => {
  try {
    const body = await c.req.json();
    const { entity, entityType, context } = body;

    if (!entity) {
      return c.json({ error: 'Entity name is required' }, 400);
    }

    if (!process.env.GOOGLE_API_KEY) {
      return c.json({ error: 'Google API key not configured' }, 500);
    }

    console.log(`\n🔍 Deep Research Request:`);
    console.log(`   Entity: ${entity} (${entityType})`);

    const { outgoingRelationships = [], incomingRelationships = [], knowledgeGraph = null } = context;

    // Extract neighbor entities for logging
    const neighborEntities = new Set<string>();
    outgoingRelationships.forEach((rel: any) => neighborEntities.add(rel.object));
    incomingRelationships.forEach((rel: any) => neighborEntities.add(rel.subject));

    console.log(`   Relationships: ${outgoingRelationships.length} outgoing, ${incomingRelationships.length} incoming`);
    console.log(`   Level 1 Neighbors: ${Array.from(neighborEntities).slice(0, 5).join(', ')}${neighborEntities.size > 5 ? '...' : ''}`);

    // Create the research prompt (includes level 2 neighbor extraction)
    const prompt = createResearchPrompt(entity, entityType, context);

    // Extract level 2 neighbors for logging
    const level2Neighbors = new Set<string>();
    if (knowledgeGraph && knowledgeGraph.triplets) {
      neighborEntities.forEach(neighbor => {
        knowledgeGraph.triplets.forEach((triplet: any) => {
          if (triplet.subject === neighbor && triplet.object !== entity) {
            level2Neighbors.add(triplet.object);
          }
          if (triplet.object === neighbor && triplet.subject !== entity) {
            level2Neighbors.add(triplet.subject);
          }
        });
      });
    }
    console.log(`   Level 2 Neighbors: ${level2Neighbors.size} entities (2-hop connections)`);

    // Call Gemini 2.5 API
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash'
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log(`   ✓ Research completed (${text.length} characters)`);

    // Save research output to public/sourceTexts directory
    const sourceTextsDir = path.join('public', 'sourceTexts');
    if (!fs.existsSync(sourceTextsDir)) {
      fs.mkdirSync(sourceTextsDir, { recursive: true });
    }

    // Create a safe filename from entity name
    const safeFileName = entity
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase()
      .substring(0, 50); // Limit filename length

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const fileName = `${safeFileName}_${timestamp}.txt`;
    const filePath = path.join(sourceTextsDir, fileName);

    // Create file content with metadata including neighbor entities
    const fileContent = `# Deep Research: ${entity} (${entityType})
# Generated: ${new Date().toISOString()}
# Context: ${outgoingRelationships.length} outgoing, ${incomingRelationships.length} incoming relationships
# Level 1 Neighbors (${neighborEntities.size}): ${Array.from(neighborEntities).join(', ')}
# Level 2 Neighbors (${level2Neighbors.size}): ${Array.from(level2Neighbors).slice(0, 20).join(', ')}${level2Neighbors.size > 20 ? '...' : ''}

${text}`;

    fs.writeFileSync(filePath, fileContent);
    console.log(`   ✓ Saved to: ${filePath}\n`);

    return c.json({
      success: true,
      entity,
      entityType,
      research: text,
      savedTo: filePath,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error during research:', error);
    return c.json({
      error: 'Failed to perform deep research',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Create a comprehensive research prompt
function createResearchPrompt(entity: string, entityType: string, context: any): string {
  const { outgoingRelationships = [], incomingRelationships = [], knowledgeGraph = null } = context;

  // Extract level 1 neighbor entities and relationships
  const level1Neighbors = new Set<string>();
  const relationshipTypes = new Set<string>();
  const relationshipPatterns: string[] = [];

  outgoingRelationships.forEach((rel: any) => {
    level1Neighbors.add(rel.object);
    relationshipTypes.add(rel.relation);
    relationshipPatterns.push(`${entity} → ${rel.relation} → ${rel.object}`);
  });

  incomingRelationships.forEach((rel: any) => {
    level1Neighbors.add(rel.subject);
    relationshipTypes.add(rel.relation);
    relationshipPatterns.push(`${rel.subject} → ${rel.relation} → ${entity}`);
  });

  // Extract level 2 neighbors if knowledge graph is provided
  const level2Neighbors = new Set<string>();
  const level2Patterns: string[] = [];

  if (knowledgeGraph && knowledgeGraph.triplets) {
    const allTriplets = knowledgeGraph.triplets;

    // For each level 1 neighbor, find their connections
    level1Neighbors.forEach(neighbor => {
      allTriplets.forEach((triplet: any) => {
        // Outgoing from level 1 neighbor
        if (triplet.subject === neighbor && triplet.object !== entity) {
          level2Neighbors.add(triplet.object);
          level2Patterns.push(`${neighbor} → ${triplet.relation} → ${triplet.object}`);
        }
        // Incoming to level 1 neighbor
        if (triplet.object === neighbor && triplet.subject !== entity) {
          level2Neighbors.add(triplet.subject);
          level2Patterns.push(`${triplet.subject} → ${triplet.relation} → ${neighbor}`);
        }
      });
    });
  }

  const level1Keywords = Array.from(level1Neighbors);
  const level2Keywords = Array.from(level2Neighbors);
  const relationKeywords = Array.from(relationshipTypes);

  let contextInfo = '';
  if (outgoingRelationships.length > 0 || incomingRelationships.length > 0) {
    contextInfo = `\n\nKnown relationships from the knowledge graph:`;

    if (outgoingRelationships.length > 0) {
      contextInfo += `\n\nOutgoing relationships:`;
      outgoingRelationships.forEach((rel: any) => {
        contextInfo += `\n- ${entity} → ${rel.relation} → ${rel.object} (${rel.object_type})`;
      });
    }

    if (incomingRelationships.length > 0) {
      contextInfo += `\n\nIncoming relationships:`;
      incomingRelationships.forEach((rel: any) => {
        contextInfo += `\n- ${rel.subject} (${rel.subject_type}) → ${rel.relation} → ${entity}`;
      });
    }
  }

  // Add level 1 neighbor context section
  let level1Context = '';
  if (level1Keywords.length > 0) {
    level1Context = `\n\n## Level 1 Neighbors (Direct Connections):
${level1Keywords.map(n => `- ${n}`).join('\n')}

Connection Patterns:
${relationshipPatterns.slice(0, 20).map(p => `- ${p}`).join('\n')}${relationshipPatterns.length > 20 ? '\n- ... and more' : ''}`;
  }

  // Add level 2 neighbor context section
  let level2Context = '';
  if (level2Keywords.length > 0) {
    level2Context = `\n\n## Level 2 Neighbors (2-Hop Connections):
${level2Keywords.slice(0, 15).map(n => `- ${n}`).join('\n')}${level2Keywords.length > 15 ? '\n- ... and more' : ''}

Extended Connection Patterns:
${level2Patterns.slice(0, 20).map(p => `- ${p}`).join('\n')}${level2Patterns.length > 20 ? '\n- ... and more' : ''}`;
  }

  let relationContext = '';
  if (relationKeywords.length > 0) {
    relationContext = `\n\n## Relationship Types (focus research around these connections):
${relationKeywords.map(r => `- ${r}`).join('\n')}`;
  }

  return `You are a research assistant specializing in deep analysis and comprehensive research. Perform a detailed research on the following entity:

# Target Entity
Name: ${entity}
Type: ${entityType}

# Knowledge Graph Context
${contextInfo}
${level1Context}
${level2Context}
${relationContext}

# Research Instructions

Provide a brief research report that includes:

1. **Overview**: A brief summary of what this entity is and its significance

2. **Key Facts**: Important facts, characteristics, or attributes

3. **Historical Context**: Relevant historical background or timeline (if applicable)

4. **Direct Relationships (Level 1)**:
   - Research how "${entity}" directly relates to: ${level1Keywords.slice(0, 5).join(', ')}${level1Keywords.length > 5 ? ', and others' : ''}
   - Explain the connection patterns shown above (e.g., ${relationshipPatterns.slice(0, 2).join(', ')})

5. **Extended Network (Level 2)**:
   ${level2Keywords.length > 0 ? `- Explore the broader context through 2-hop connections to: ${level2Keywords.slice(0, 5).join(', ')}${level2Keywords.length > 5 ? ', etc.' : ''}` : '- No level 2 neighbors available'}
   ${level2Patterns.length > 0 ? `- Understand extended patterns like: ${level2Patterns.slice(0, 2).join(', ')}` : ''}

6. **Current Status**: Latest developments or current state (if applicable)

7. **Interesting Insights**: Notable or lesser-known information

# Critical Instructions
- Use ALL the connected entities (both Level 1 and Level 2) and relationship types as supportive keywords
- The connection patterns (A → relation → B) show actual relationships in the knowledge graph - use these as factual anchors
- Focus on understanding the nature of relationships like: ${relationKeywords.slice(0, 3).join(', ')}${relationKeywords.length > 3 ? ', etc.' : ''}
- Provide specific details about how "${entity}" interacts with the Level 1 neighbors and how those connect to Level 2
- The broader network context (Level 2) helps understand the ecosystem around "${entity}"

Format your response in clear, well-structured markdown with appropriate headings and bullet points.
Be factual, comprehensive, and cite specific details where possible.
If the entity is not well-known or you have limited information, clearly state this and provide what you can.
`;
}

// Start the server
const port = 3001;

console.log(`\n🚀 Starting Hono API Server...`);
console.log(`   Port: ${port}`);
console.log(`   Endpoints:`);
console.log(`   - GET  http://localhost:${port}/health`);
console.log(`   - POST http://localhost:${port}/api/research`);
console.log(`\n✓ Server is ready!\n`);

serve({
  fetch: app.fetch,
  port
});
