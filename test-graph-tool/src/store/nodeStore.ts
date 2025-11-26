import {
  type Edge,
  type Node,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
} from "@xyflow/react";
import { addEdge, applyNodeChanges, applyEdgeChanges } from "@xyflow/react";
import type { NodeState as DefaultNodeState } from "../components/node";

import { create } from "zustand";
import { d3Hierarchy } from "../features/layouting";

export type AppNode = Node<DefaultNodeState>;

export type Direction = "horizontal" | "vertical";

export type NodeState = {
  nodes: AppNode[];
  edges: Edge[];
  direction: Direction;
  onNodesChange: OnNodesChange<AppNode>;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setNodes: (nodes: AppNode[]) => void;
  setEdges: (edges: Edge[]) => void;
  setDirection: (direction: Direction) => void;
};

const initialNodes: AppNode[] = [
  {
    id: "0",
    type: "node-with-toolbar",
    data: {
      label: "Root",
      isEditing: false,
    },
    position: { x: 0, y: 50 },
    deletable: false,
    draggable: false,
  },
];

const initialEdges: Edge[] = [];

const useNodeStore = create<NodeState>()((set, get) => ({
  nodes: initialNodes,
  edges: initialEdges,
  direction: "vertical",
  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    });
  },
  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },
  onConnect: (connection) => {
    set({
      edges: addEdge(connection, get().edges),
    });
  },
  setNodes: (nodes) => {
    set({ nodes });
  },
  setEdges: (edges) => {
    set({ edges });
  },
  setDirection: (direction) => {
    const { getLayoutElements } = d3Hierarchy();
    const layout = getLayoutElements(get().nodes, get().edges, {
      direction,
    });

    set({
      direction,
      nodes: [...layout.nodes],
      edges: [...layout.edges],
    });
  },
}));

export { useNodeStore };
