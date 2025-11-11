import type { KnowledgeGraph } from '../share/type';

/**
 * Check if a file is a PDF
 */
export const isPdfFile = (file: File): boolean => {
  return file.type === 'application/pdf' || file.name.endsWith('.pdf');
};

/**
 * Read a file as text
 */
export const readFileAsText = async (file: File): Promise<string> => {
  return await file.text();
};

/**
 * Read a PDF file and convert to base64
 */
export const readPdfAsBase64 = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
  );
  return base64;
};

/**
 * Read and parse a JSON file as KnowledgeGraph
 */
export const readJsonFile = async (file: File): Promise<KnowledgeGraph> => {
  const text = await file.text();
  const graph: KnowledgeGraph = JSON.parse(text);

  if (!graph.triplets || !Array.isArray(graph.triplets)) {
    throw new Error('Invalid knowledge graph format');
  }

  return graph;
};
