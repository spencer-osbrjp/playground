import "@xyflow/react/dist/style.css";
import {
  Background,
  MiniMap,
  Panel,
  ReactFlow,
} from "@xyflow/react";
import { NodeWithToolbar } from "./node";
import { useNodeStore, type AppNode } from "../store/nodeStore";
import { cn } from "../utils";
import { useShallow } from "zustand/shallow";
import { useState } from "react";

const nodeTypes = {
  "node-with-toolbar": NodeWithToolbar,
};

const Graph = () => {
  const nodes = useNodeStore((state) => state.nodes);
  const edges = useNodeStore((state) => state.edges);
  const direction = useNodeStore((state) => state.direction);
  // const [show, setShow] = useState<boolean>(false);
  // const [selectedNodes, setSelectedNodes] = useState<Node[]>([]);

  const onNodesChange = useNodeStore(
    useShallow((state) => state.onNodesChange),
  );
  const onEdgesChange = useNodeStore(
    useShallow((state) => state.onEdgesChange),
  );
  const setDirection = useNodeStore((state) => state.setDirection);

  const onHorizontalClick = () => {
    setDirection("horizontal");
  };

  const onVerticalClick = () => {
    setDirection("vertical");
  };

  // const onSelectionChange = (params: OnSelectionChangeParams) => {
  //   const { nodes } = params;
  //   if (nodes.length > 0) {
  //     setShow(true);
  //     setSelectedNodes(nodes);
  //   }
  //
  //   setShow(false);
  //   setSelectedNodes([]);
  // };

  return (
    <div className="w-screen h-screen">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        debug
        fitView
        fitViewOptions={{ padding: 2 }}
        // onSelectionChange={(params) => onSelectionChange(params)}
      >
        <Background />
        <Panel>
          <div className="flex flex-col items-start gap-y-4">
            <button
              type="button"
              onClick={onVerticalClick}
              className={cn(
                "px-4 py-2 rounded-md bg-white text-black",
                direction === "vertical" && "bg-amber-400",
              )}
            >
              vertical
            </button>
            <button
              type="button"
              onClick={onHorizontalClick}
              className={cn(
                "px-4 py-2 rounded-md bg-white text-black",
                direction === "horizontal" && "bg-amber-400",
              )}
            >
              horizontal
            </button>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
};

export default Graph;
