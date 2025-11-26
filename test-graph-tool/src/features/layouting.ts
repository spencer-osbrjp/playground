import { cluster, stratify, tree } from "d3-hierarchy";
import { Position, type Edge } from "@xyflow/react";
import { type AppNode } from "../store/nodeStore";

export type Direction = "horizontal" | "vertical";

interface LayoutOptions {
  direction?: Direction;
}

interface LayoutElements {
  nodes: AppNode[];
  edges: Edge[];
}

type TreeType = "cluster" | "tidy";
/**
 * Use `d3-hierarchy` for layout algorithm
 */
const d3Hierarchy = (treeType: TreeType = "cluster") => {
  const g = treeType === "tidy" ? tree<AppNode>() : cluster<AppNode>();

  /**
   * Auto convert into `d3-hierarchy` JSON object format
   *
   * @param nodes - Current nodes
   * @param edges - Current edges
   * @returns Object containing laid out nodes and edges
   */
  const getLayoutElements = (
    nodes: AppNode[],
    edges: Edge[],
    options: LayoutOptions = {
      direction: "vertical",
    },
  ): LayoutElements => {
    const WIDTH = 400;
    const HEIGHT = 200;

    if (nodes.length === 0) return { nodes, edges };

    const hierarchy = stratify<AppNode>()
      .id((n) => n.id)
      .parentId((n) => edges.find((e) => e.target === n.id)?.source);

    const root = hierarchy(nodes);
    const layout = g
      .nodeSize([WIDTH, HEIGHT])
      .separation((a, b) => (a.parent === b.parent ? 1 : 1.5))(root);

    return {
      nodes: layout.descendants().map((node) => ({
        ...node.data,
        position: {
          x: options.direction === "horizontal" ? node.y : node.x,
          y: options.direction === "horizontal" ? node.x : node.y,
        },
        sourcePosition:
          options.direction === "vertical" ? Position.Bottom : Position.Right,
        targetPosition:
          options.direction === "vertical" ? Position.Top : Position.Left,
      })),
      edges,
    };
  };

  return {
    getLayoutElements,
  };
};

export { d3Hierarchy };
