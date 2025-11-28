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
  useReactFlow,
} from "@xyflow/react";
import { useNodeStore } from "../store/nodeStore";
import { cn } from "../utils";
import { useState, memo } from "react";
import { addNode } from "../features/add-node";

type DefaultNodeState = {
  label: string;
  isEditing: boolean;
};

export type NodeState = DefaultNodeState;

type CustomNode = Node<DefaultNodeState, "node-with-toolbar">;

const NodeWithToolbarComp = ({ data, ...options }: NodeProps<CustomNode>) => {
  const currentNodeId = useNodeId();
  const nodes = useNodeStore((state) => state.nodes);
  const edges = useNodeStore((state) => state.edges);
  const { updateNode } = useReactFlow();

  const [value, setValue] = useState<string>(data.label);

  const isSelected = options.selected;

  const onAddNode = () => {
    if (!currentNodeId) return;
    addNode(nodes, edges, currentNodeId);
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
