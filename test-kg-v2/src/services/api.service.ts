import { API_URL } from '../config/constants';
import type { KnowledgeGraph } from '../share/type';

/**
 * Parse PDF file via backend API
 */
export const parsePdfAPI = async (pdfData: string): Promise<string> => {
  const response = await fetch(`${API_URL}/api/parse-pdf`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ pdfData }),
  });

  const result = await response.json();

  if (!result.success || !result.text) {
    throw new Error('Failed to parse PDF');
  }

  return result.text;
};

/**
 * Extract knowledge graph from source text
 */
export const extractKnowledgeGraphAPI = async (
  sourceText: string,
  config?: any
): Promise<KnowledgeGraph> => {
  const response = await fetch(`${API_URL}/api/extract`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sourceText, config }),
  });

  const result = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Extraction failed');
  }

  return result.data;
};

/**
 * Load existing knowledge graph from server
 */
export const loadExistingGraphAPI = async (): Promise<KnowledgeGraph | null> => {
  try {
    const response = await fetch(`${API_URL}/api/knowledge-graph`);
    const result = await response.json();

    if (result.success && result.data) {
      return result.data;
    }
    return null;
  } catch (error) {
    console.log('No existing graph found');
    return null;
  }
};

/**
 * Merge two knowledge graphs
 */
export const mergeGraphsAPI = async (
  graph1: KnowledgeGraph,
  graph2: KnowledgeGraph
): Promise<KnowledgeGraph> => {
  const response = await fetch(`${API_URL}/api/merge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ graph1, graph2 }),
  });

  const result = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Merge failed');
  }

  return result.data;
};

/**
 * Infer relationships in knowledge graph
 */
export const inferRelationshipsAPI = async (
  graph: KnowledgeGraph
): Promise<KnowledgeGraph> => {
  const response = await fetch(`${API_URL}/api/infer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ graph }),
  });

  const result = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Inference failed');
  }

  return result.data;
};
