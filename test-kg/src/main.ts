import Graph from "graphology";
import Sigma from "sigma";
import forceAtlas2 from "graphology-layout-forceatlas2";
import { circular } from "graphology-layout";

// Type definitions
type Triplet = {
  subject: string
  subject_type: string
  relation: string
  object: string
  object_type: string
  inferred?: boolean
}

type KnowledgeGraph = {
  triplets: Triplet[]
  entity_types: string[]
}

// Global state
let currentKnowledgeGraph: KnowledgeGraph | null = null
let currentSigma: Sigma | null = null
let currentGraph: Graph | null = null
let currentColorMap: Record<string, string> = {}
let hoveredNode: string | null = null
let currentSelectedNode: string | null = null

// Function to generate color for entity type dynamically
const generateColor = (index: number): string => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52BE80',
    '#EC7063', '#5DADE2', '#F39C12', '#AF7AC5', '#48C9B0',
    '#E74C3C', '#3498DB', '#9B59B6', '#1ABC9C', '#F39C12',
    '#E67E22', '#2ECC71', '#34495E', '#16A085', '#27AE60',
    '#2980B9', '#8E44AD', '#D35400', '#C0392B', '#BDC3C7',
    '#7F8C8D', '#E84393', '#00B894', '#0984E3', '#6C5CE7',
    '#FDCB6E', '#00CEC9', '#FF7675', '#A29BFE', '#FD79A8',
    '#74B9FF', '#81ECEC', '#FAB1A0', '#DFE6E9', '#636E72',
    '#55EFC4', '#FE9795', '#6C5CE7', '#FFEAA7', '#FAD390'
  ]
  return colors[index % colors.length]
}

// Function to visualize knowledge graph
const visualizeKnowledgeGraph = (knowledgeGraph: KnowledgeGraph) => {
  const container = document.getElementById('network')
  if (!container) {
    console.error("Network container not found")
    return
  }

  // Clear existing graph
  if (currentSigma) {
    currentSigma.kill()
    currentSigma = null
  }

  // Store current graph globally
  currentKnowledgeGraph = knowledgeGraph

  // Create dynamic color mapping from entity types
  currentColorMap = {}
  knowledgeGraph.entity_types.forEach((type, index) => {
    currentColorMap[type] = generateColor(index)
  })
  const colorMap = currentColorMap

  // Create graph using graphology
  const graph = new Graph({ multi: true })
  currentGraph = graph

  // Track entity types for positioning
  const entityTypeGroups: Record<string, string[]> = {}
  knowledgeGraph.entity_types.forEach(type => {
    entityTypeGroups[type] = []
  })

  // Add nodes
  const nodeSet = new Set<string>()
  knowledgeGraph.triplets.forEach((triplet) => {
    if (!nodeSet.has(triplet.subject)) {
      nodeSet.add(triplet.subject)
      graph.addNode(triplet.subject, {
        label: triplet.subject,
        entityType: triplet.subject_type,
        color: colorMap[triplet.subject_type] || '#95A5A6',
        size: 10,
        x: 0,
        y: 0
      })
      // Initialize array if it doesn't exist
      if (!entityTypeGroups[triplet.subject_type]) {
        entityTypeGroups[triplet.subject_type] = []
      }
      entityTypeGroups[triplet.subject_type].push(triplet.subject)
    }

    if (!nodeSet.has(triplet.object)) {
      nodeSet.add(triplet.object)
      graph.addNode(triplet.object, {
        label: triplet.object,
        entityType: triplet.object_type,
        color: colorMap[triplet.object_type] || '#95A5A6',
        size: 10,
        x: 0,
        y: 0
      })
      // Initialize array if it doesn't exist
      if (!entityTypeGroups[triplet.object_type]) {
        entityTypeGroups[triplet.object_type] = []
      }
      entityTypeGroups[triplet.object_type].push(triplet.object)
    }
  })

  // Position nodes by entity type in circular clusters
  const allEntityTypes = Object.keys(entityTypeGroups)
  const numTypes = allEntityTypes.length
  const clusterRadius = 300
  allEntityTypes.forEach((type, typeIndex) => {
    const angle = (2 * Math.PI * typeIndex) / numTypes
    const centerX = Math.cos(angle) * clusterRadius
    const centerY = Math.sin(angle) * clusterRadius

    const nodesInType = entityTypeGroups[type]
    if (!nodesInType || nodesInType.length === 0) return

    const typeClusterRadius = Math.min(150, 50 + nodesInType.length * 5)

    nodesInType.forEach((nodeId, nodeIndex) => {
      const nodeAngle = (2 * Math.PI * nodeIndex) / nodesInType.length
      const x = centerX + Math.cos(nodeAngle) * typeClusterRadius
      const y = centerY + Math.sin(nodeAngle) * typeClusterRadius

      graph.setNodeAttribute(nodeId, 'x', x)
      graph.setNodeAttribute(nodeId, 'y', y)
    })
  })

  // Add edges with visual distinction for inferred edges
  // Track parallel edges to add different curvatures
  const edgesBetweenNodes: Record<string, number> = {}

  knowledgeGraph.triplets.forEach((triplet, index) => {
    const edgeId = `edge-${index}`
    const nodeKey = `${triplet.subject}->${triplet.object}`
    const reverseKey = `${triplet.object}->${triplet.subject}`

    // Track how many edges exist between these nodes
    if (!edgesBetweenNodes[nodeKey]) edgesBetweenNodes[nodeKey] = 0
    edgesBetweenNodes[nodeKey]++

    // Calculate curvature based on parallel edges
    let curvature = 0.2
    if (edgesBetweenNodes[reverseKey]) {
      // If there's an edge in the opposite direction, increase curvature
      curvature = 0.3 + (edgesBetweenNodes[nodeKey] * 0.1)
    } else if (edgesBetweenNodes[nodeKey] > 1) {
      // Multiple edges in same direction
      curvature = 0.2 + ((edgesBetweenNodes[nodeKey] - 1) * 0.15)
    }

    graph.addEdge(triplet.subject, triplet.object, {
      id: edgeId,
      label: triplet.relation,
      size: triplet.inferred ? 2 : 2.5,
      color: triplet.inferred ? '#9B59B6' : '#2C3E50', // Purple for inferred, dark blue-gray for regular
      inferred: triplet.inferred || false,
      relationLabel: triplet.relation,
      type: 'arrow', // Use arrow type to show direction
      curvature: curvature // Add curvature to avoid edge overlap
    })
  })

  // Apply ForceAtlas2 layout for better positioning
  forceAtlas2.assign(graph, {
    iterations: 500,
    settings: {
      gravity: 1,
      scalingRatio: 10,
      strongGravityMode: true,
      barnesHutOptimize: true,
      slowDown: 5,
      linLogMode: false
    }
  })

  // Update stats
  const entityCountEl = document.getElementById('entityCount')
  const relationCountEl = document.getElementById('relationCount')
  if (entityCountEl) entityCountEl.textContent = nodeSet.size.toString()
  if (relationCountEl) relationCountEl.textContent = knowledgeGraph.triplets.length.toString()

  // Create legend
  const legend = document.getElementById('legend')
  if (legend) {
    legend.innerHTML = ''
    knowledgeGraph.entity_types.forEach(type => {
      const item = document.createElement('div')
      item.className = 'legend-item'
      item.innerHTML = `
        <div class="legend-color" style="background-color: ${colorMap[type]}"></div>
        <span>${type}</span>
      `
      legend.appendChild(item)
    })
  }

  // Initialize Sigma with arrow heads and curved edges
  currentSigma = new Sigma(graph, container, {
    renderEdgeLabels: true,
    defaultNodeColor: '#999',
    defaultEdgeColor: '#ccc',
    defaultEdgeType: 'arrow', // Show arrows on all edges
    labelSize: 12,
    labelWeight: 'normal',
    edgeLabelSize: 10,
    edgeLabelWeight: 'normal',
    enableEdgeEvents: true
  })

  // Click interaction to show node info panel
  currentSigma.on('clickNode', ({ node }) => {
    showNodeInfo(node)
  })

  // Hover interactions
  currentSigma.on('enterNode', ({ node }) => {
    hoveredNode = node
    const nodeData = graph.getNodeAttributes(node)
    container.style.cursor = 'pointer'

    // Highlight connected nodes and edges
    graph.forEachNode((n) => {
      if (n !== node) {
        graph.setNodeAttribute(n, 'highlighted', false)
      } else {
        graph.setNodeAttribute(n, 'highlighted', true)
      }
    })

    graph.forEachEdge((edge) => {
      const source = graph.source(edge)
      const target = graph.target(edge)
      if (source === node || target === node) {
        graph.setEdgeAttribute(edge, 'size', 5)
      } else {
        graph.setEdgeAttribute(edge, 'size', 1)
      }
    })

    currentSigma?.refresh()
  })

  currentSigma.on('leaveNode', () => {
    hoveredNode = null
    container.style.cursor = 'default'

    // Reset highlighting
    graph.forEachNode((n) => {
      graph.setNodeAttribute(n, 'highlighted', false)
    })

    graph.forEachEdge((edge, attributes) => {
      graph.setEdgeAttribute(edge, 'size', attributes.inferred ? 2 : 2.5)
    })

    currentSigma?.refresh()
  })

  // Show sections
  const networkSection = document.getElementById('networkSection')
  if (networkSection) {
    networkSection.style.display = 'block'
  }

  const querySection = document.getElementById('querySection')
  if (querySection) {
    querySection.style.display = 'block'
  }

  // Populate entity type filter
  const filterType = document.getElementById('filterType') as HTMLSelectElement
  if (filterType) {
    filterType.innerHTML = '<option value="">All Types</option>'
    knowledgeGraph.entity_types.forEach(type => {
      const option = document.createElement('option')
      option.value = type
      option.textContent = type
      filterType.appendChild(option)
    })
  }
}

// Load and visualize button handlers
const loadButton = document.getElementById('loadGraph') as HTMLButtonElement
const loadMergedButton = document.getElementById('loadMergedGraph') as HTMLButtonElement
const loadInferredButton = document.getElementById('loadInferredGraph') as HTMLButtonElement

const loadGraphFromFile = async (filePath: string, buttonElement: HTMLButtonElement, buttonOriginalText: string) => {
  try {
    buttonElement.disabled = true
    buttonElement.textContent = 'Loading...'

    const response = await fetch(filePath)

    if (!response.ok) {
      throw new Error(`File not found: ${filePath}`)
    }

    const knowledgeGraph: KnowledgeGraph = await response.json()
    visualizeKnowledgeGraph(knowledgeGraph)
    setupQueryHandlers()

    buttonElement.textContent = buttonOriginalText.replace('Load', 'Reload')
    buttonElement.disabled = false
  } catch (error) {
    console.error('Error loading knowledge graph:', error)
    alert(`Error: ${error instanceof Error ? error.message : 'Failed to load graph'}`)
    buttonElement.textContent = buttonOriginalText
    buttonElement.disabled = false
  }
}

if (loadButton) {
  loadButton.addEventListener('click', async () => {
    await loadGraphFromFile('/knowledge-graph.json', loadButton, 'Load & Visualize Graph')
  })
}

if (loadMergedButton) {
  loadMergedButton.addEventListener('click', async () => {
    await loadGraphFromFile('/knowledge-graph-merged.json', loadMergedButton, 'Load Merged Graph')
  })
}

if (loadInferredButton) {
  loadInferredButton.addEventListener('click', async () => {
    await loadGraphFromFile('/knowledge-graph-inferred.json', loadInferredButton, 'Load Inferred Graph')
  })
}

// Node Info Panel Functions
const showNodeInfo = (nodeId: string) => {
  if (!currentGraph || !currentKnowledgeGraph) return

  currentSelectedNode = nodeId

  const nodeData = currentGraph.getNodeAttributes(nodeId)
  const panel = document.getElementById('nodeInfoPanel')
  const title = document.getElementById('nodeInfoTitle')
  const type = document.getElementById('nodeInfoType')
  const stats = document.getElementById('nodeStats')
  const outgoing = document.getElementById('outgoingRelationships')
  const incoming = document.getElementById('incomingRelationships')

  if (!panel || !title || !type || !stats || !outgoing || !incoming) return

  // Reset research results
  const researchResults = document.getElementById('researchResults')
  if (researchResults) {
    researchResults.style.display = 'none'
  }

  // Set node title and type
  title.textContent = nodeData.label
  type.textContent = nodeData.entityType
  type.style.backgroundColor = nodeData.color

  // Find all relationships for this node
  const outgoingRels: Triplet[] = []
  const incomingRels: Triplet[] = []

  currentKnowledgeGraph.triplets.forEach(triplet => {
    if (triplet.subject === nodeId) {
      outgoingRels.push(triplet)
    }
    if (triplet.object === nodeId) {
      incomingRels.push(triplet)
    }
  })

  // Update stats
  stats.innerHTML = `
    <div class="stat-box">
      <span class="stat-number">${outgoingRels.length}</span>
      <span class="stat-label">Outgoing</span>
    </div>
    <div class="stat-box">
      <span class="stat-number">${incomingRels.length}</span>
      <span class="stat-label">Incoming</span>
    </div>
  `

  // Render outgoing relationships
  if (outgoingRels.length > 0) {
    outgoing.innerHTML = outgoingRels.map(rel => `
      <div class="relationship-item ${rel.inferred ? 'inferred' : ''}" onclick="highlightRelationship('${rel.subject}', '${rel.object}')">
        <div class="relationship-arrow">
          <span class="relationship-entity">${nodeData.label}</span>
          <span class="relationship-direction">→</span>
          <span class="relationship-relation">${rel.relation}</span>
          <span class="relationship-direction">→</span>
          <span class="relationship-entity">${rel.object}</span>
          ${rel.inferred ? '<span class="relationship-badge">INFERRED</span>' : ''}
        </div>
      </div>
    `).join('')
  } else {
    outgoing.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">→</div>
        <div class="empty-state-text">No outgoing relationships</div>
      </div>
    `
  }

  // Render incoming relationships
  if (incomingRels.length > 0) {
    incoming.innerHTML = incomingRels.map(rel => `
      <div class="relationship-item ${rel.inferred ? 'inferred' : ''}" onclick="highlightRelationship('${rel.subject}', '${rel.object}')">
        <div class="relationship-arrow">
          <span class="relationship-entity">${rel.subject}</span>
          <span class="relationship-direction">→</span>
          <span class="relationship-relation">${rel.relation}</span>
          <span class="relationship-direction">→</span>
          <span class="relationship-entity">${nodeData.label}</span>
          ${rel.inferred ? '<span class="relationship-badge">INFERRED</span>' : ''}
        </div>
      </div>
    `).join('')
  } else {
    incoming.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">←</div>
        <div class="empty-state-text">No incoming relationships</div>
      </div>
    `
  }

  // Show panel
  panel.classList.add('visible')
}

const hideNodeInfo = () => {
  const panel = document.getElementById('nodeInfoPanel')
  if (panel) {
    panel.classList.remove('visible')
  }
}

// Make highlightRelationship globally accessible
(window as any).highlightRelationship = (source: string, target: string) => {
  if (!currentGraph || !currentSigma) return

  // Highlight the specific relationship
  currentGraph.forEachNode((node) => {
    if (node === source || node === target) {
      currentGraph!.setNodeAttribute(node, 'size', 15)
    } else {
      currentGraph!.setNodeAttribute(node, 'size', 5)
      currentGraph!.setNodeAttribute(node, 'color', '#CCCCCC')
    }
  })

  currentGraph.forEachEdge((edge) => {
    const edgeSource = currentGraph!.source(edge)
    const edgeTarget = currentGraph!.target(edge)
    if (edgeSource === source && edgeTarget === target) {
      currentGraph!.setEdgeAttribute(edge, 'size', 6)
      currentGraph!.setEdgeAttribute(edge, 'color', '#667eea')
    } else {
      currentGraph!.setEdgeAttribute(edge, 'size', 1)
      currentGraph!.setEdgeAttribute(edge, 'color', '#DDDDDD')
    }
  })

  currentSigma.refresh()

  // Auto-reset after 2 seconds
  setTimeout(() => {
    if (currentGraph && currentSigma) {
      currentGraph.forEachNode((node) => {
        currentGraph!.setNodeAttribute(node, 'size', 10)
        const nodeData = currentGraph!.getNodeAttributes(node)
        currentGraph!.setNodeAttribute(node, 'color', currentColorMap[nodeData.entityType])
      })

      currentGraph.forEachEdge((edge, attributes) => {
        currentGraph!.setEdgeAttribute(edge, 'size', attributes.inferred ? 2 : 2.5)
        currentGraph!.setEdgeAttribute(edge, 'color', attributes.inferred ? '#9B59B6' : '#2C3E50')
      })

      currentSigma.refresh()
    }
  }, 2000)
}

// Setup close button handler
document.getElementById('closeNodeInfo')?.addEventListener('click', hideNodeInfo)

// Deep Research with Gemini API
const performDeepResearch = async () => {
  if (!currentSelectedNode || !currentGraph || !currentKnowledgeGraph) return

  const nodeData = currentGraph.getNodeAttributes(currentSelectedNode)
  const researchResults = document.getElementById('researchResults')
  const researchLoading = document.getElementById('researchLoading')
  const researchContent = document.getElementById('researchContent')
  const deepResearchBtn = document.getElementById('deepResearchBtn') as HTMLButtonElement

  if (!researchResults || !researchLoading || !researchContent || !deepResearchBtn) return

  // Show loading state
  researchResults.style.display = 'block'
  researchLoading.style.display = 'flex'
  researchContent.style.display = 'none'
  deepResearchBtn.disabled = true
  deepResearchBtn.textContent = 'Researching...'

  // Gather context from relationships
  const outgoingRels: Triplet[] = []
  const incomingRels: Triplet[] = []

  currentKnowledgeGraph.triplets.forEach(triplet => {
    if (triplet.subject === currentSelectedNode) {
      outgoingRels.push(triplet)
    }
    if (triplet.object === currentSelectedNode) {
      incomingRels.push(triplet)
    }
  })

  try {
    const response = await fetch('http://localhost:3001/api/research', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        entity: nodeData.label,
        entityType: nodeData.entityType,
        context: {
          outgoingRelationships: outgoingRels,
          incomingRelationships: incomingRels,
          knowledgeGraph: currentKnowledgeGraph // Pass full graph for level 2 neighbors
        }
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to perform research')
    }

    const data = await response.json()

    // Convert markdown to HTML (simple conversion)
    const htmlContent = markdownToHtml(data.research)

    // Add save notification if file was saved
    let saveNotification = ''
    if (data.savedTo) {
      saveNotification = `
        <div style="background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 10px; border-radius: 5px; margin-bottom: 15px; font-size: 0.85rem;">
          ✓ Research saved to: <code style="background: #fff; padding: 2px 6px; border-radius: 3px;">${data.savedTo}</code>
          <br/><small>You can now run: <code style="background: #fff; padding: 2px 6px; border-radius: 3px;">npm run extract ${data.savedTo}</code></small>
        </div>
      `
    }

    // Show results
    researchLoading.style.display = 'none'
    researchContent.innerHTML = saveNotification + htmlContent
    researchContent.style.display = 'block'
    deepResearchBtn.textContent = '🔍 Deep Research with AI'
    deepResearchBtn.disabled = false

  } catch (error) {
    console.error('Deep research error:', error)
    researchLoading.style.display = 'none'
    researchContent.innerHTML = `
      <div style="color: #dc3545; padding: 20px; text-align: center;">
        <strong>Error:</strong> ${error instanceof Error ? error.message : 'Failed to perform research'}
        <br/><br/>
        <small>Make sure the API server is running: <code>npm run api</code></small>
      </div>
    `
    researchContent.style.display = 'block'
    deepResearchBtn.textContent = '🔍 Deep Research with AI'
    deepResearchBtn.disabled = false
  }
}

// Simple markdown to HTML converter
const markdownToHtml = (markdown: string): string => {
  let html = markdown

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>')
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>')
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>')

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')

  // Italic
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>')

  // Code blocks
  html = html.replace(/```(.*?)```/gs, '<pre><code>$1</code></pre>')

  // Inline code
  html = html.replace(/`(.*?)`/g, '<code>$1</code>')

  // Links
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>')

  // Unordered lists
  html = html.replace(/^\* (.*$)/gim, '<li>$1</li>')
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')

  // Ordered lists
  html = html.replace(/^\d+\. (.*$)/gim, '<li>$1</li>')

  // Line breaks
  html = html.replace(/\n\n/g, '</p><p>')
  html = '<p>' + html + '</p>'

  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, '')
  html = html.replace(/<p>(<h[1-3]>)/g, '$1')
  html = html.replace(/(<\/h[1-3]>)<\/p>/g, '$1')
  html = html.replace(/<p>(<ul>)/g, '$1')
  html = html.replace(/(<\/ul>)<\/p>/g, '$1')
  html = html.replace(/<p>(<pre>)/g, '$1')
  html = html.replace(/(<\/pre>)<\/p>/g, '$1')

  return html
}

// Setup deep research button handler
document.getElementById('deepResearchBtn')?.addEventListener('click', performDeepResearch)

// Query Functions
const setupQueryHandlers = () => {
  const executeQueryBtn = document.getElementById('executeQuery')
  if (executeQueryBtn) {
    executeQueryBtn.addEventListener('click', executeQuery)
  }

  const findNeighborsBtn = document.getElementById('findNeighbors')
  if (findNeighborsBtn) {
    findNeighborsBtn.addEventListener('click', findConnectedEntities)
  }

  const clearFiltersBtn = document.getElementById('clearFilters')
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', clearFilters)
  }
}

const executeQuery = () => {
  if (!currentKnowledgeGraph) return

  const searchEntity = (document.getElementById('searchEntity') as HTMLInputElement).value.toLowerCase()
  const filterType = (document.getElementById('filterType') as HTMLSelectElement).value
  const searchRelation = (document.getElementById('searchRelation') as HTMLInputElement).value.toLowerCase()

  let results = currentKnowledgeGraph.triplets

  if (searchEntity) {
    results = results.filter(t =>
      t.subject.toLowerCase().includes(searchEntity) ||
      t.object.toLowerCase().includes(searchEntity)
    )
  }

  if (filterType) {
    results = results.filter(t =>
      t.subject_type === filterType ||
      t.object_type === filterType
    )
  }

  if (searchRelation) {
    results = results.filter(t =>
      t.relation.toLowerCase().includes(searchRelation)
    )
  }

  displayResults(results)
  highlightNodes(results)
}

const findConnectedEntities = () => {
  if (!currentKnowledgeGraph) return

  const searchEntity = (document.getElementById('searchEntity') as HTMLInputElement).value.trim()

  if (!searchEntity) {
    alert('Please enter an entity name to find connected entities')
    return
  }

  const connectedTriplets = currentKnowledgeGraph.triplets.filter(t =>
    t.subject.toLowerCase().includes(searchEntity.toLowerCase()) ||
    t.object.toLowerCase().includes(searchEntity.toLowerCase())
  )

  displayResults(connectedTriplets)
  highlightNodes(connectedTriplets)
}

const clearFilters = () => {
  (document.getElementById('searchEntity') as HTMLInputElement).value = ''
  (document.getElementById('filterType') as HTMLSelectElement).value = ''
  (document.getElementById('searchRelation') as HTMLInputElement).value = ''
  (document.getElementById('pathQuery') as HTMLInputElement).value = ''

  const resultsSection = document.getElementById('resultsSection')
  if (resultsSection) {
    resultsSection.style.display = 'none'
  }

  if (currentGraph) {
    currentGraph.forEachNode((node) => {
      currentGraph!.setNodeAttribute(node, 'hidden', false)
      const originalColor = currentColorMap[currentGraph!.getNodeAttribute(node, 'entityType')]
      currentGraph!.setNodeAttribute(node, 'color', originalColor)
      currentGraph!.setNodeAttribute(node, 'size', 10)
    })

    currentGraph.forEachEdge((edge, attributes) => {
      currentGraph!.setEdgeAttribute(edge, 'hidden', false)
      currentGraph!.setEdgeAttribute(edge, 'size', attributes.inferred ? 2 : 3)
    })

    currentSigma?.refresh()
  }
}

const displayResults = (results: Triplet[]) => {
  const resultsSection = document.getElementById('resultsSection')
  const resultsList = document.getElementById('resultsList')
  const resultCount = document.getElementById('resultCount')

  if (!resultsSection || !resultsList || !resultCount) return

  resultsSection.style.display = 'block'
  resultCount.textContent = results.length.toString()

  if (results.length === 0) {
    resultsList.innerHTML = '<div class="no-results">No results found</div>'
    return
  }

  resultsList.innerHTML = results.map(triplet => `
    <div class="result-item">
      <strong>${triplet.subject}</strong> (${triplet.subject_type})
      → <em>${triplet.relation}</em> →
      <strong>${triplet.object}</strong> (${triplet.object_type})
      ${triplet.inferred ? '<span style="color: #999; font-style: italic;"> [INFERRED]</span>' : ''}
    </div>
  `).join('')
}

const highlightNodes = (triplets: Triplet[]) => {
  if (!currentGraph || !currentSigma) return

  const highlightedEntities = new Set<string>()
  const highlightedEdges = new Set<string>()

  triplets.forEach((t, index) => {
    highlightedEntities.add(t.subject)
    highlightedEntities.add(t.object)
    highlightedEdges.add(`edge-${currentKnowledgeGraph!.triplets.indexOf(t)}`)
  })

  if (highlightedEntities.size === 0) return

  // Update node visibility and styling
  currentGraph.forEachNode((node) => {
    if (highlightedEntities.has(node)) {
      currentGraph!.setNodeAttribute(node, 'hidden', false)
      currentGraph!.setNodeAttribute(node, 'size', 15)
      const originalColor = currentColorMap[currentGraph!.getNodeAttribute(node, 'entityType')]
      currentGraph!.setNodeAttribute(node, 'color', originalColor)
    } else {
      currentGraph!.setNodeAttribute(node, 'color', '#CCCCCC')
      currentGraph!.setNodeAttribute(node, 'size', 5)
    }
  })

  // Update edge visibility and styling
  currentGraph.forEachEdge((edge) => {
    if (highlightedEdges.has(currentGraph!.getEdgeAttribute(edge, 'id'))) {
      currentGraph!.setEdgeAttribute(edge, 'hidden', false)
      currentGraph!.setEdgeAttribute(edge, 'color', '#667eea')
      currentGraph!.setEdgeAttribute(edge, 'size', 5)
    } else {
      currentGraph!.setEdgeAttribute(edge, 'color', '#DDDDDD')
      currentGraph!.setEdgeAttribute(edge, 'size', 1)
    }
  })

  currentSigma.refresh()
}
