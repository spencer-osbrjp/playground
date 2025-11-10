import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { extract, mergeGraphs, infer } from './features/extract';
import fs from 'fs';
import path from 'path';

const app = new Hono();

// Middleware
app.use('/*', cors());

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Extract knowledge graph endpoint
app.post('/api/extract', async (c) => {
  try {
    console.log('Starting knowledge graph extraction...');
    const body = await c.req.json();
    const { sourceText, config } = body;

    if (!sourceText) {
      return c.json({
        success: false,
        error: 'No source text provided'
      }, 400);
    }

    const knowledgeGraph = await extract(sourceText, config);
    return c.json({ success: true, data: knowledgeGraph });
  } catch (error) {
    console.error('Extraction error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Get knowledge graph endpoint (if already extracted)
app.get('/api/knowledge-graph', (c) => {
  try {
    const filePath = path.join(process.cwd(), 'public', 'knowledge-graph.json');
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return c.json({ success: true, data: JSON.parse(data) });
    } else {
      return c.json({ success: false, error: 'Knowledge graph not found. Extract first.' }, 404);
    }
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Merge two knowledge graphs
app.post('/api/merge', async (c) => {
  try {
    console.log('Merge request received');
    const body = await c.req.json();
    const { graph1, graph2 } = body;

    if (!graph1 || !graph2) {
      return c.json({
        success: false,
        error: 'Both graphs are required'
      }, 400);
    }

    // Use reusable merge function with disambiguation
    const mergedGraph = await mergeGraphs(graph1, graph2);

    // Save merged graph
    const outputDir = 'public';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filePath = path.join(outputDir, 'knowledge-graph-merged.json');
    fs.writeFileSync(filePath, JSON.stringify(mergedGraph, null, 2));
    console.log('✓ Merged graph saved to:', filePath);

    return c.json({ success: true, data: mergedGraph });
  } catch (error) {
    console.error('Merge error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Infer hidden relationships in knowledge graph
app.post('/api/infer', async (c) => {
  try {
    console.log('Inference request received');
    const body = await c.req.json();
    const { graph } = body;

    if (!graph) {
      return c.json({
        success: false,
        error: 'Knowledge graph is required'
      }, 400);
    }

    // Perform inference
    const inferredGraph = await infer(graph);

    return c.json({ success: true, data: inferredGraph });
  } catch (error) {
    console.error('Inference error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default app;
