import { Network } from "vis-network"
import "vis-network/styles/vis-network.css"

// Type definitions
type Triplet = {
  subject: string
  subject_type: string
  relation: string
  object: string
  object_type: string
}

type KnowledgeGraph = {
  triplets: Triplet[]
  entity_types: string[]
}

// Global state
let currentKnowledgeGraph: KnowledgeGraph | null = null
let currentNetwork: Network | null = null
let currentColorMap: Record<string, string> = {}

// Function to generate color for entity type dynamically
const generateColor = (index: number): string => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52BE80',
    '#EC7063', '#5DADE2', '#F39C12', '#AF7AC5', '#48C9B0'
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

  // Store current graph globally
  currentKnowledgeGraph = knowledgeGraph

  // Create dynamic color mapping from entity types
  currentColorMap = {}
  knowledgeGraph.entity_types.forEach((type, index) => {
    currentColorMap[type] = generateColor(index)
  })
  const colorMap = currentColorMap

  // Create nodes and edges from knowledge graph
  const nodes = new Map()
  const edges: any[] = []

  knowledgeGraph.triplets.forEach((triplet) => {
    // Add subject node
    if (!nodes.has(triplet.subject)) {
      nodes.set(triplet.subject, {
        id: triplet.subject,
        label: triplet.subject,
        title: `Type: ${triplet.subject_type}`,
        color: colorMap[triplet.subject_type] || '#95A5A6',
        font: { size: 14 }
      })
    }

    // Add object node
    if (!nodes.has(triplet.object)) {
      nodes.set(triplet.object, {
        id: triplet.object,
        label: triplet.object,
        title: `Type: ${triplet.object_type}`,
        color: colorMap[triplet.object_type] || '#95A5A6',
        font: { size: 14 }
      })
    }

    // Add edge
    edges.push({
      from: triplet.subject,
      to: triplet.object,
      label: triplet.relation,
      arrows: 'to',
      font: { size: 11, align: 'middle' },
      color: { color: '#848484' }
    })
  })

  // Update stats
  const entityCountEl = document.getElementById('entityCount')
  const relationCountEl = document.getElementById('relationCount')
  if (entityCountEl) entityCountEl.textContent = nodes.size.toString()
  if (relationCountEl) relationCountEl.textContent = edges.length.toString()

  // Create legend with dynamic entity types
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

  // Create network visualization
  const data = {
    nodes: Array.from(nodes.values()),
    edges: edges
  }

  const options = {
    nodes: {
      shape: 'dot',
      size: 25,
      borderWidth: 2,
      borderWidthSelected: 3
    },
    edges: {
      smooth: {
        type: 'continuous'
      }
    },
    physics: {
      stabilization: {
        iterations: 200
      },
      barnesHut: {
        gravitationalConstant: -8000,
        springConstant: 0.04,
        springLength: 150
      }
    },
    interaction: {
      hover: true,
      tooltipDelay: 100
    }
  }

  currentNetwork = new Network(container, data, options)

  // Show the network container and query section
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

// Load and visualize button handler
const loadButton = document.getElementById('loadGraph') as HTMLButtonElement

if (loadButton) {
  loadButton.addEventListener('click', async () => {
    try {
      loadButton.disabled = true
      loadButton.textContent = 'Loading...'

      const response = await fetch('/knowledge-graph.json')

      if (!response.ok) {
        throw new Error('Knowledge graph file not found. Please run the extraction first: npm run extract')
      }

      const knowledgeGraph: KnowledgeGraph = await response.json()
      visualizeKnowledgeGraph(knowledgeGraph)
      setupQueryHandlers()

      loadButton.textContent = 'Reload Graph'
      loadButton.disabled = false
    } catch (error) {
      console.error('Error loading knowledge graph:', error)
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to load graph'}`)
      loadButton.textContent = 'Load & Visualize Graph'
      loadButton.disabled = false
    }
  })
}

// Query Functions
const setupQueryHandlers = () => {
  // Execute query button
  const executeQueryBtn = document.getElementById('executeQuery')
  if (executeQueryBtn) {
    executeQueryBtn.addEventListener('click', executeQuery)
  }

  // Find neighbors button
  const findNeighborsBtn = document.getElementById('findNeighbors')
  if (findNeighborsBtn) {
    findNeighborsBtn.addEventListener('click', findConnectedEntities)
  }

  // Clear filters button
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

  // Filter by entity
  if (searchEntity) {
    results = results.filter(t =>
      t.subject.toLowerCase().includes(searchEntity) ||
      t.object.toLowerCase().includes(searchEntity)
    )
  }

  // Filter by type
  if (filterType) {
    results = results.filter(t =>
      t.subject_type === filterType ||
      t.object_type === filterType
    )
  }

  // Filter by relation
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

  // Find all triplets where the entity appears
  const connectedTriplets = currentKnowledgeGraph.triplets.filter(t =>
    t.subject.toLowerCase().includes(searchEntity.toLowerCase()) ||
    t.object.toLowerCase().includes(searchEntity.toLowerCase())
  )

  displayResults(connectedTriplets)
  highlightNodes(connectedTriplets)
}

const clearFilters = () => {
  // Clear input fields
  (document.getElementById('searchEntity') as HTMLInputElement).value = ''
  (document.getElementById('filterType') as HTMLSelectElement).value = ''
  (document.getElementById('searchRelation') as HTMLInputElement).value = ''
  (document.getElementById('pathQuery') as HTMLInputElement).value = ''

  // Hide results
  const resultsSection = document.getElementById('resultsSection')
  if (resultsSection) {
    resultsSection.style.display = 'none'
  }

  // Reset visualization
  if (currentKnowledgeGraph) {
    visualizeKnowledgeGraph(currentKnowledgeGraph)
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
    </div>
  `).join('')
}

const highlightNodes = (triplets: Triplet[]) => {
  if (!currentNetwork || !currentKnowledgeGraph) return

  // Get all entities from filtered triplets
  const highlightedEntities = new Set<string>()
  triplets.forEach(t => {
    highlightedEntities.add(t.subject)
    highlightedEntities.add(t.object)
  })

  // Create new visualization with highlighted nodes
  const container = document.getElementById('network')
  if (!container) return

  const nodes = new Map()
  const edges: any[] = []

  currentKnowledgeGraph.triplets.forEach((triplet) => {
    const isHighlighted = triplets.some(t =>
      (t.subject === triplet.subject && t.object === triplet.object) ||
      (t.subject === triplet.object && t.object === triplet.subject)
    )

    // Add subject node
    if (!nodes.has(triplet.subject)) {
      const isSubjectHighlighted = highlightedEntities.has(triplet.subject)
      nodes.set(triplet.subject, {
        id: triplet.subject,
        label: triplet.subject,
        title: `Type: ${triplet.subject_type}`,
        color: isSubjectHighlighted ? currentColorMap[triplet.subject_type] : '#CCCCCC',
        font: {
          size: isSubjectHighlighted ? 16 : 12,
          color: isSubjectHighlighted ? '#000' : '#999'
        },
        opacity: isSubjectHighlighted ? 1 : 0.3
      })
    }

    // Add object node
    if (!nodes.has(triplet.object)) {
      const isObjectHighlighted = highlightedEntities.has(triplet.object)
      nodes.set(triplet.object, {
        id: triplet.object,
        label: triplet.object,
        title: `Type: ${triplet.object_type}`,
        color: isObjectHighlighted ? currentColorMap[triplet.object_type] : '#CCCCCC',
        font: {
          size: isObjectHighlighted ? 16 : 12,
          color: isObjectHighlighted ? '#000' : '#999'
        },
        opacity: isObjectHighlighted ? 1 : 0.3
      })
    }

    // Add edge
    edges.push({
      from: triplet.subject,
      to: triplet.object,
      label: triplet.relation,
      arrows: 'to',
      font: {
        size: isHighlighted ? 12 : 10,
        align: 'middle',
        color: isHighlighted ? '#000' : '#CCC'
      },
      color: { color: isHighlighted ? '#667eea' : '#DDDDDD' },
      width: isHighlighted ? 2 : 1
    })
  })

  const data = {
    nodes: Array.from(nodes.values()),
    edges: edges
  }

  const options = {
    nodes: {
      shape: 'dot',
      size: 25,
      borderWidth: 2,
      borderWidthSelected: 3
    },
    edges: {
      smooth: {
        type: 'continuous'
      }
    },
    physics: {
      stabilization: {
        iterations: 200
      },
      barnesHut: {
        gravitationalConstant: -8000,
        springConstant: 0.04,
        springLength: 150
      }
    },
    interaction: {
      hover: true,
      tooltipDelay: 100
    }
  }

  currentNetwork = new Network(container, data, options)
}
