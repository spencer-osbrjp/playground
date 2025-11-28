import { d3Hierarchy } from "../features/layouting";
import { v4 as uuidv4 } from "uuid";
import { addEdge, MarkerType, type Edge } from "@xyflow/react";
import { useNodeStore, type AppNode } from "../store/nodeStore";

const addNode = (nodes: AppNode[], edges: Edge[], currentNodeId: string) => {
  const direction = useNodeStore.getState().direction;
  const setNodes = useNodeStore.getState().setNodes
  const setEdges = useNodeStore.getState().setEdges

  const { getLayoutElements } = d3Hierarchy();
  const newNodeId = uuidv4();
  const newEdge: Edge = {
    id: `${currentNodeId}-${newNodeId}`,
    source: currentNodeId,
    target: newNodeId,
    label: "New Edge",
    type: "smoothstep",
    markerEnd: {
      type: MarkerType.ArrowClosed,
    },
  };
  const newEdges = addEdge(newEdge, edges);

  const newNode: AppNode = {
    id: newNodeId,
    position: {
      x: 0, // default to 0, will update to the actual position after transform
      y: 0,
    },
    type: "node-with-toolbar",
    data: {
      label: "New Node",
      isEditing: true,
    },
    selected: true,
    focusable: true,
    draggable: false,
  };

  const newNodes = [...nodes, newNode];

  const layout = getLayoutElements(newNodes, newEdges, {
    direction,
  });

  // Update nodes and edges
  setNodes(
    layout.nodes.map((n) =>
      n.id === currentNodeId ? { ...n, selected: false } : n,
    ),
  );
  setEdges(newEdges);
};

export { addNode };
