import './style.css'
import Graph from 'graphology';
import Sigma from 'sigma';
import { circular } from 'graphology-layout';
import forceAtlas2 from 'graphology-layout-forceatlas2';

interface KnowledgeGraph {
  triplets: Array<{
    id: number;
    subject: {
      id: number;
      name: string;
      entity_type: string;
      attributes: Array<{ key: string; value: string }>;
    };
    predicate: {
      id: number;
      name: string;
    };
    object: {
      id: number;
      name: string;
      entity_type: string;
      attributes: Array<{ key: string; value: string }>;
    };
  }>;
  entity_types: string[];
}

const API_URL = 'http://localhost:3000';

let sigmaInstance: Sigma | null = null;

const showStatus = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
  const statusEl = document.querySelector('#status') as HTMLElement;
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = 'show ' + type;
  }
};

const hideStatus = () => {
  const statusEl = document.querySelector('#status') as HTMLElement;
  if (statusEl) {
    statusEl.className = '';
  }
};

const getColorForEntityType = (entityType: string): string => {
  const colors: Record<string, string> = {
    'PERSON': '#3498db',
    'COMPANY': '#e74c3c',
    'CONCEPT': '#2ecc71',
    'OPINION': '#f39c12',
    'AI': '#9b59b6',
    'BUBBLE': '#e67e22',
    'NOT BUBBLE': '#1abc9c',
    'SPEAKER': '#34495e',
  };
  return colors[entityType] || '#95a5a6';
};

const showNodeDetails = (nodeKey: string, knowledgeGraph: KnowledgeGraph) => {
  const detailsPanel = document.getElementById('details-panel');
  if (!detailsPanel) return;

  // Find all triplets related to this node
  const relatedTriplets = knowledgeGraph.triplets.filter(
    (t) =>
      `${t.subject.name}_${t.subject.entity_type}` === nodeKey ||
      `${t.object.name}_${t.object.entity_type}` === nodeKey
  );

  if (relatedTriplets.length === 0) return;

  // Get node details from first triplet
  const firstTriplet = relatedTriplets[0];
  const node =
    `${firstTriplet.subject.name}_${firstTriplet.subject.entity_type}` === nodeKey
      ? firstTriplet.subject
      : firstTriplet.object;

  let html = `<h3>${node.name}</h3>`;
  html += `<p><strong>Type:</strong> ${node.entity_type}</p>`;

  // Show attributes if any
  if (node.attributes && node.attributes.length > 0) {
    html += `<p><strong>Attributes:</strong></p>`;
    node.attributes.forEach((attr) => {
      html += `<p style="margin-left: 12px;">• ${attr.key}: ${attr.value}</p>`;
    });
  }

  // Show related triplets
  html += `<p style="margin-top: 16px;"><strong>Relationships (${relatedTriplets.length}):</strong></p>`;
  relatedTriplets.forEach((triplet) => {
    html += `<p style="margin-left: 12px; font-size: 13px;">`;
    html += `${triplet.subject.name} → <em>${triplet.predicate.name}</em> → ${triplet.object.name}`;
    html += `</p>`;
  });

  detailsPanel.innerHTML = html;
  detailsPanel.classList.add('show');
};

const showJsonOutput = (knowledgeGraph: KnowledgeGraph) => {
  const jsonPanel = document.getElementById('json-panel');
  if (!jsonPanel) return;

  const html = `
    <h3>JSON Output</h3>
    <pre>${JSON.stringify(knowledgeGraph, null, 2)}</pre>
  `;

  jsonPanel.innerHTML = html;
  jsonPanel.classList.add('show');
};

const visualizeGraph = (knowledgeGraph: KnowledgeGraph) => {
  const container = document.getElementById('graph-container');
  if (!container) return;

  // Show JSON output
  showJsonOutput(knowledgeGraph);

  // Clear previous graph
  if (sigmaInstance) {
    sigmaInstance.kill();
  }
  container.innerHTML = '';

  // Create a new graph
  const graph = new Graph();

  // Keep track of added nodes to avoid duplicates
  const addedNodes = new Set<string>();

  // Add nodes and edges from triplets
  knowledgeGraph.triplets.forEach((triplet) => {
    const subjectKey = `${triplet.subject.name}_${triplet.subject.entity_type}`;
    const objectKey = `${triplet.object.name}_${triplet.object.entity_type}`;

    // Add subject node if not already added
    if (!addedNodes.has(subjectKey)) {
      graph.addNode(subjectKey, {
        label: triplet.subject.name,
        size: 10,
        color: getColorForEntityType(triplet.subject.entity_type),
        entityType: triplet.subject.entity_type,
      });
      addedNodes.add(subjectKey);
    }

    // Add object node if not already added
    if (!addedNodes.has(objectKey)) {
      graph.addNode(objectKey, {
        label: triplet.object.name,
        size: 10,
        color: getColorForEntityType(triplet.object.entity_type),
        entityType: triplet.object.entity_type,
      });
      addedNodes.add(objectKey);
    }

    // Add edge
    try {
      graph.addEdge(subjectKey, objectKey, {
        label: triplet.predicate.name,
        size: 2,
        color: '#999',
      });
    } catch (e) {
      // Edge might already exist, ignore
    }
  });

  // Apply circular layout first
  circular.assign(graph);

  // Apply force-directed layout
  const settings = forceAtlas2.inferSettings(graph);
  forceAtlas2.assign(graph, { iterations: 100, settings });

  // Create sigma instance
  sigmaInstance = new Sigma(graph, container, {
    renderEdgeLabels: true,
    defaultEdgeType: 'arrow',
  });

  // Add click event listener
  sigmaInstance.on('clickNode', ({ node }) => {
    showNodeDetails(node, knowledgeGraph);
  });

  // Hide details panel when clicking on background
  sigmaInstance.on('clickStage', () => {
    const detailsPanel = document.getElementById('details-panel');
    if (detailsPanel) {
      detailsPanel.classList.remove('show');
    }
  });

  showStatus(`Knowledge graph loaded: ${graph.order} nodes, ${graph.size} edges`, 'success');

  // Hide status after 3 seconds
  setTimeout(hideStatus, 3000);
};

const extractKnowledgeGraph = async () => {
  const button = document.querySelector('#extract') as HTMLButtonElement;
  const fileInput = document.querySelector('#fileInput') as HTMLInputElement;

  if (!button || !fileInput) return;

  // Check if a file is selected
  if (!fileInput.files || fileInput.files.length === 0) {
    showStatus('Please select a file first', 'error');
    return;
  }

  const file = fileInput.files[0];

  button.disabled = true;
  button.textContent = 'Extracting...';
  showStatus('Reading file...', 'info');

  try {
    // Read file content
    const sourceText = await file.text();

    if (!sourceText || sourceText.trim().length === 0) {
      showStatus('File is empty', 'error');
      button.disabled = false;
      button.textContent = 'Extract Knowledge Graph';
      return;
    }

    showStatus('Starting extraction... This may take a minute.', 'info');

    const response = await fetch(`${API_URL}/api/extract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sourceText }),
    });

    const result = await response.json();

    console.log('API Response:', result);

    if (result.success && result.data) {
      showStatus('Extraction complete! Rendering graph...', 'success');
      visualizeGraph(result.data);
    } else {
      const errorMsg = result.error || 'Unknown error';
      console.error('Extraction failed:', errorMsg);
      showStatus(`Error: ${errorMsg}`, 'error');
    }
  } catch (error) {
    console.error('Request failed:', error);
    showStatus(`Error: ${error instanceof Error ? error.message : 'Network error'}`, 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'Extract Knowledge Graph';
  }
};

const loadExistingGraph = async () => {
  try {
    const response = await fetch(`${API_URL}/api/knowledge-graph`);
    const result = await response.json();

    if (result.success && result.data) {
      showStatus('Loading existing knowledge graph...', 'info');
      visualizeGraph(result.data);
    }
  } catch (error) {
    // No existing graph, that's okay
    console.log('No existing graph found');
  }
};

const mergeKnowledgeGraphs = async () => {
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
    // Read both JSON files
    const graph1Text = await jsonFile1Input.files[0].text();
    const graph2Text = await jsonFile2Input.files[0].text();

    const graph1: KnowledgeGraph = JSON.parse(graph1Text);
    const graph2: KnowledgeGraph = JSON.parse(graph2Text);

    // Call API to merge graphs
    const response = await fetch(`${API_URL}/api/merge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ graph1, graph2 }),
    });

    const result = await response.json();

    if (result.success && result.data) {
      showStatus('Graphs merged successfully!', 'success');

      // Reuse existing visualization function
      visualizeGraph(result.data);

      // Close modal
      modal?.classList.remove('show');

      // Reset file inputs
      jsonFile1Input.value = '';
      jsonFile2Input.value = '';
    } else {
      showStatus(`Error: ${result.error || 'Merge failed'}`, 'error');
    }
  } catch (error) {
    console.error('Merge failed:', error);
    showStatus(`Error: ${error instanceof Error ? error.message : 'Failed to merge graphs'}`, 'error');
  }
};

const loadGraphFromFile = async () => {
  const loadGraphInput = document.querySelector('#loadGraphInput') as HTMLInputElement;

  if (!loadGraphInput.files || loadGraphInput.files.length === 0) {
    showStatus('No file selected', 'error');
    return;
  }

  const file = loadGraphInput.files[0];
  showStatus('Loading knowledge graph...', 'info');

  try {
    const graphText = await file.text();
    const graph: KnowledgeGraph = JSON.parse(graphText);

    if (!graph.triplets || !Array.isArray(graph.triplets)) {
      showStatus('Invalid knowledge graph format', 'error');
      return;
    }

    showStatus('Knowledge graph loaded successfully!', 'success');
    visualizeGraph(graph);

    // Reset file input
    loadGraphInput.value = '';
  } catch (error) {
    console.error('Failed to load graph:', error);
    showStatus(`Error: ${error instanceof Error ? error.message : 'Failed to load graph'}`, 'error');
  }
};

const main = () => {
  const extractButton = document.querySelector("button#extract");
  const loadBtn = document.querySelector("#loadBtn");
  const loadGraphInput = document.querySelector("#loadGraphInput") as HTMLInputElement;
  const mergeBtn = document.querySelector("#mergeBtn");
  const mergeModal = document.querySelector("#mergeModal");
  const cancelMerge = document.querySelector("#cancelMerge");
  const confirmMerge = document.querySelector("#confirmMerge");

  extractButton?.addEventListener("click", extractKnowledgeGraph);

  // Load graph button handlers
  loadBtn?.addEventListener("click", () => {
    loadGraphInput?.click(); // Trigger file input
  });

  loadGraphInput?.addEventListener("change", loadGraphFromFile);

  // Merge button handlers
  mergeBtn?.addEventListener("click", () => {
    mergeModal?.classList.add('show');
  });

  cancelMerge?.addEventListener("click", () => {
    mergeModal?.classList.remove('show');
  });

  confirmMerge?.addEventListener("click", mergeKnowledgeGraphs);

  // Close modal when clicking outside
  mergeModal?.addEventListener("click", (e) => {
    if (e.target === mergeModal) {
      mergeModal.classList.remove('show');
    }
  });

  // Try to load existing graph on startup
  loadExistingGraph();
};

main();
