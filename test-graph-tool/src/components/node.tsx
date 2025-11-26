import { v4 as uuidv4 } from "uuid";
import {
  CheckCircledIcon,
  CrossCircledIcon,
  Pencil2Icon,
  PlusCircledIcon,
} from "@radix-ui/react-icons";
import {
  NodeToolbar,
  type NodeProps,
  type Node,
  Position,
  useNodeId,
  Handle,
  addEdge,
  type Edge,
  useReactFlow,
  MarkerType,
} from "@xyflow/react";
import { useNodeStore, type AppNode } from "../store/nodeStore";
import { cn } from "../utils";
import { d3Hierarchy } from "../features/layouting";
import { useState, memo } from "react";

type DefaultNodeState = {
  label: string;
  isEditing: boolean;
};

export type NodeState = DefaultNodeState;

type CustomNode = Node<DefaultNodeState, "node-with-toolbar">;

const NodeWithToolbarComp = ({ data, ...options }: NodeProps<CustomNode>) => {
  const currentNodeId = useNodeId();
  const direction = useNodeStore((state) => state.direction);
  const nodes = useNodeStore((state) => state.nodes);
  const setNodes = useNodeStore((state) => state.setNodes);
  const edges = useNodeStore((state) => state.edges);
  const setEdges = useNodeStore((state) => state.setEdges);
  const { updateNode } = useReactFlow();

  const [value, setValue] = useState<string>(data.label);

  const isSelected = options.selected;

  const onAddNode = () => {
    if (!currentNodeId) return;

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

  const onSave = () => {
    if (!currentNodeId) return;
    updateNode(currentNodeId, (node) => {
      return {
        ...node,
        data: {
          label: value,
          isEditing: false,
        },
        type: "node-with-toolbar",
      };
    });
  };

  const onEdit = () => {
    if (!currentNodeId) return;
    updateNode(currentNodeId, (node) => {
      return {
        ...node,
        data: {
          ...node.data,
          isEditing: true,
        },
        type: "node-with-toolbar",
      };
    });
  };

  const onCancelEdit = () => {
    if (!currentNodeId) return;
    updateNode(currentNodeId, (node) => {
      return {
        ...node,
        data: {
          ...node.data,
          isEditing: false,
        },
        type: "node-with-toolbar",
      };
    });
  };

  return (
    <>
      <div
        className={cn(
          "px-4 py-2 rounded-md bg-white text-black outline-2 outline-slate-200",
          isSelected && "outline-sky-400 ",
        )}
      >
        {data.isEditing ? (
          <input
            type="text"
            value={value}
            onChange={(v) => setValue(v.target.value)}
            onFocus={(e) => e.target.select()}
            autoFocus={isSelected}
            className="w-fit block"
          />
        ) : (
          data.label
        )}
      </div>
      {data.isEditing ? (
        <NodeToolbar position={Position.Top} isVisible>
          <div className="flex items-center gap-4">
            <button type="button" onClick={onSave}>
              <CheckCircledIcon className="size-6" />
            </button>
            <button type="button" onClick={onCancelEdit}>
              <CrossCircledIcon className="size-6" />
            </button>
          </div>
        </NodeToolbar>
      ) : (
        <NodeToolbar position={Position.Bottom} isVisible={isSelected}>
          <div className="flex items-center gap-4">
            <button type="button" onClick={onAddNode}>
              <PlusCircledIcon className="size-6" />
            </button>
            <button type="button" onClick={onEdit}>
              <Pencil2Icon className="size-6" />
            </button>
          </div>
        </NodeToolbar>
      )}
      <Handle type="source" position={options.sourcePosition || Position.Top} />
      <Handle
        type="target"
        position={options.targetPosition || Position.Bottom}
      />
    </>
  );
};

export const NodeWithToolbar = memo(NodeWithToolbarComp);
