import Graph from 'graphology';
import Sigma from 'sigma';
import { circular } from 'graphology-layout';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import type { KnowledgeGraph } from '../share/type';
import { appState } from '../state/app.state';
import { showNodeDetails, hideDetailsPanel, showJsonOutput } from '../ui/panels.ui';
import { showStatusWithTimeout } from '../ui/status.ui';
import { getColorForEntityType, getEdgeColor, getEdgeSize, getEdgeType } from './graph.styles';

/**
 * Visualize a knowledge graph using Sigma.js
 */
export const visualizeGraph = (knowledgeGraph: KnowledgeGraph): void => {
  const container = document.getElementById('graph-container');
  if (!container) return;

  // Store current graph for inference
  appState.currentGraph = knowledgeGraph;

  // Show JSON output
  showJsonOutput(knowledgeGraph);

  // Clear previous graph
  if (appState.sigmaInstance) {
    appState.sigmaInstance.kill();
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
        color: getColorForEntityType(triplet.subject.entity_type),
        entityType: triplet.subject.entity_type,
      });
      addedNodes.add(subjectKey);
    }

    // Add object node if not already added
    if (!addedNodes.has(objectKey)) {
      graph.addNode(objectKey, {
        label: triplet.object.name,
        color: getColorForEntityType(triplet.object.entity_type),
        entityType: triplet.object.entity_type,
      });
      addedNodes.add(objectKey);
    }

    // Add edge - use different styling for inferred relationships
    const tripletAny = triplet as any;
    const isInferred = tripletAny.inferred === true;

    try {
      graph.addEdge(subjectKey, objectKey, {
        label: triplet.predicate.name,
        size: getEdgeSize(isInferred),
        color: getEdgeColor(isInferred),
        type: getEdgeType(isInferred),
      });
    } catch (e) {
      // Edge might already exist, ignore
    }
  });

  // Calculate node sizes based on degree (number of connections)
  const degrees = graph.nodes().map((node) => graph.degree(node));
  const minDegree = Math.min(...degrees);
  const maxDegree = Math.max(...degrees);
  const MIN_NODE_SIZE = 5;
  const MAX_NODE_SIZE = 30;

  graph.forEachNode((node) => {
    const degree = graph.degree(node);
    const normalizedSize = maxDegree > minDegree
      ? ((degree - minDegree) / (maxDegree - minDegree)) * (MAX_NODE_SIZE - MIN_NODE_SIZE) + MIN_NODE_SIZE
      : MIN_NODE_SIZE;

    graph.setNodeAttribute(node, 'size', normalizedSize);
  });

  // Apply circular layout first
  circular.assign(graph);

  // Apply force-directed layout
  const settings = forceAtlas2.inferSettings(graph);
  forceAtlas2.assign(graph, { iterations: 100, settings });

  // Create sigma instance
  appState.sigmaInstance = new Sigma(graph, container, {
    renderEdgeLabels: true,
    defaultEdgeType: 'arrow',
  });

  // Add click event listener
  appState.sigmaInstance.on('clickNode', ({ node }) => {
    showNodeDetails(node, knowledgeGraph);
  });

  // Hide details panel when clicking on background
  appState.sigmaInstance.on('clickStage', () => {
    hideDetailsPanel();
  });

  showStatusWithTimeout(`Knowledge graph loaded: ${graph.order} nodes, ${graph.size} edges`, 'success');
};
