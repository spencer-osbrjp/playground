import { appState } from '../state/app.state';
import { showStatus } from '../ui/status.ui';
import { visualizeGraph } from '../visualization/graph.visualizer';
import {
  parsePdfAPI,
  extractKnowledgeGraphAPI,
  loadExistingGraphAPI,
  mergeGraphsAPI,
  inferRelationshipsAPI,
} from '../services/api.service';
import { isPdfFile, readPdfAsBase64, readFileAsText, readJsonFile } from '../services/file.service';

/**
 * Perform knowledge graph extraction from file
 */
const performExtraction = async (config?: any): Promise<void> => {
  const button = document.querySelector('#extract') as HTMLButtonElement;
  const fileInput = document.querySelector('#fileInput') as HTMLInputElement;

  if (!button || !fileInput || !fileInput.files || fileInput.files.length === 0) {
    showStatus('Please select a file first', 'error');
    return;
  }

  const file = fileInput.files[0];

  button.disabled = true;
  button.textContent = 'Extracting...';
  showStatus('Reading file...', 'info');

  try {
    let sourceText: string;

    // Check if it's a PDF file
    if (isPdfFile(file)) {
      showStatus('Reading PDF file...', 'info');
      const base64 = await readPdfAsBase64(file);
      sourceText = await parsePdfAPI(base64);
    } else {
      sourceText = await readFileAsText(file);
    }

    if (!sourceText || sourceText.trim().length === 0) {
      showStatus('File is empty', 'error');
      return;
    }

    showStatus('Starting extraction... This may take a minute.', 'info');

    const knowledgeGraph = await extractKnowledgeGraphAPI(sourceText, config);

    showStatus('Extraction complete! Rendering graph...', 'success');
    visualizeGraph(knowledgeGraph);
  } catch (error) {
    console.error('Request failed:', error);
    showStatus(`Error: ${error instanceof Error ? error.message : 'Network error'}`, 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'Extract Knowledge Graph';
  }
};

/**
 * Show extraction configuration modal
 */
const extractKnowledgeGraph = (): void => {
  const fileInput = document.querySelector('#fileInput') as HTMLInputElement;
  const configModal = document.querySelector('#configModal');

  if (!fileInput.files || fileInput.files.length === 0) {
    showStatus('Please select a file first', 'error');
    return;
  }

  configModal?.classList.add('show');
};

/**
 * Load existing knowledge graph from server
 */
const loadExistingGraph = async (): Promise<void> => {
  const graph = await loadExistingGraphAPI();
  if (graph) {
    showStatus('Loading existing knowledge graph...', 'info');
    visualizeGraph(graph);
  }
};

/**
 * Merge two knowledge graphs
 */
const mergeKnowledgeGraphs = async (): Promise<void> => {
  const jsonFile1Input = document.querySelector('#jsonFile1') as HTMLInputElement;
  const jsonFile2Input = document.querySelector('#jsonFile2') as HTMLInputElement;
  const modal = document.querySelector('#mergeModal');

  if (!jsonFile1Input.files || jsonFile1Input.files.length === 0) {
    showStatus('Please select Knowledge Graph 1', 'error');
    return;
  }

  if (!jsonFile2Input.files || jsonFile2Input.files.length === 0) {
    showStatus('Please select Knowledge Graph 2', 'error');
    return;
  }

  showStatus('Merging knowledge graphs...', 'info');

  try {
    const graph1 = await readJsonFile(jsonFile1Input.files[0]);
    const graph2 = await readJsonFile(jsonFile2Input.files[0]);

    const mergedGraph = await mergeGraphsAPI(graph1, graph2);

    showStatus('Graphs merged successfully!', 'success');
    visualizeGraph(mergedGraph);

    // Close modal
    modal?.classList.remove('show');

    // Reset file inputs
    jsonFile1Input.value = '';
    jsonFile2Input.value = '';
  } catch (error) {
    console.error('Merge failed:', error);
    showStatus(`Error: ${error instanceof Error ? error.message : 'Failed to merge graphs'}`, 'error');
  }
};

/**
 * Load knowledge graph from local file
 */
const loadGraphFromFile = async (): Promise<void> => {
  const loadGraphInput = document.querySelector('#loadGraphInput') as HTMLInputElement;

  if (!loadGraphInput.files || loadGraphInput.files.length === 0) {
    showStatus('No file selected', 'error');
    return;
  }

  const file = loadGraphInput.files[0];
  showStatus('Loading knowledge graph...', 'info');

  try {
    const graph = await readJsonFile(file);

    showStatus('Knowledge graph loaded successfully!', 'success');
    visualizeGraph(graph);

    // Reset file input
    loadGraphInput.value = '';
  } catch (error) {
    console.error('Failed to load graph:', error);
    showStatus(`Error: ${error instanceof Error ? error.message : 'Failed to load graph'}`, 'error');
  }
};

/**
 * Infer relationships in current knowledge graph
 */
const inferRelationships = async (): Promise<void> => {
  if (!appState.currentGraph) {
    showStatus('Please load or extract a knowledge graph first', 'error');
    return;
  }

  const inferBtn = document.querySelector('#inferBtn') as HTMLButtonElement;
  if (!inferBtn) return;

  inferBtn.disabled = true;
  inferBtn.textContent = 'Inferring...';
  showStatus('Analyzing graph and inferring hidden relationships... This may take a minute.', 'info');

  try {
    const inferredGraph = await inferRelationshipsAPI(appState.currentGraph);

    showStatus('Inference complete! Visualizing inferred relationships...', 'success');

    // Update current graph with inferred version
    appState.currentGraph = inferredGraph;
    visualizeGraph(inferredGraph);

    // Count inferred relationships
    const inferredCount = inferredGraph.triplets.filter((t: any) => t.inferred).length;
    setTimeout(() => {
      showStatus(`Added ${inferredCount} inferred relationships!`, 'success');
    }, 1000);
  } catch (error) {
    console.error('Inference request failed:', error);
    showStatus(`Error: ${error instanceof Error ? error.message : 'Network error'}`, 'error');
  } finally {
    inferBtn.disabled = false;
    inferBtn.textContent = 'Infer Relationships';
  }
};

/**
 * Initialize all event handlers
 */
export const initializeApp = (): void => {
  const extractButton = document.querySelector('button#extract');
  const loadBtn = document.querySelector('#loadBtn');
  const loadGraphInput = document.querySelector('#loadGraphInput') as HTMLInputElement;
  const mergeBtn = document.querySelector('#mergeBtn');
  const inferBtn = document.querySelector('#inferBtn');
  const configModal = document.querySelector('#configModal');
  const cancelConfig = document.querySelector('#cancelConfig');
  const useDefaults = document.querySelector('#useDefaults');
  const confirmConfig = document.querySelector('#confirmConfig');
  const mergeModal = document.querySelector('#mergeModal');
  const cancelMerge = document.querySelector('#cancelMerge');
  const confirmMerge = document.querySelector('#confirmMerge');

  // Extract button
  extractButton?.addEventListener('click', extractKnowledgeGraph);

  // Load graph button
  loadBtn?.addEventListener('click', () => {
    loadGraphInput?.click();
  });

  loadGraphInput?.addEventListener('change', loadGraphFromFile);

  // Merge button
  mergeBtn?.addEventListener('click', () => {
    mergeModal?.classList.add('show');
  });

  cancelMerge?.addEventListener('click', () => {
    mergeModal?.classList.remove('show');
  });

  confirmMerge?.addEventListener('click', mergeKnowledgeGraphs);

  // Infer button
  inferBtn?.addEventListener('click', inferRelationships);

  // Config modal handlers
  cancelConfig?.addEventListener('click', () => {
    configModal?.classList.remove('show');
  });

  useDefaults?.addEventListener('click', () => {
    configModal?.classList.remove('show');
    performExtraction();
  });

  confirmConfig?.addEventListener('click', () => {
    const domain = (document.querySelector('#configDomain') as HTMLInputElement).value;
    const focusAreasText = (document.querySelector('#configFocusAreas') as HTMLTextAreaElement).value;
    const includeTypesText = (document.querySelector('#configIncludeTypes') as HTMLInputElement).value;
    const excludeTypesText = (document.querySelector('#configExcludeTypes') as HTMLInputElement).value;
    const threshold = (document.querySelector('#configThreshold') as HTMLSelectElement).value;

    const config: any = {};

    if (domain.trim()) {
      config.domain = domain.trim();
    }

    if (focusAreasText.trim()) {
      config.focusAreas = focusAreasText.split(',').map(s => s.trim()).filter(s => s.length > 0);
    }

    if (includeTypesText.trim()) {
      config.includeTypes = includeTypesText.split(',').map(s => s.trim()).filter(s => s.length > 0);
    }

    if (excludeTypesText.trim()) {
      config.excludeTypes = excludeTypesText.split(',').map(s => s.trim()).filter(s => s.length > 0);
    }

    config.relevanceThreshold = threshold;

    configModal?.classList.remove('show');
    performExtraction(config);
  });

  // Close modals when clicking outside
  mergeModal?.addEventListener('click', (e) => {
    if (e.target === mergeModal) {
      mergeModal.classList.remove('show');
    }
  });

  configModal?.addEventListener('click', (e) => {
    if (e.target === configModal) {
      configModal.classList.remove('show');
    }
  });

  // Load existing graph on startup
  loadExistingGraph();
};
