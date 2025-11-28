import "@xyflow/react/dist/style.css";
import { Background, Panel, ReactFlow } from "@xyflow/react";
import { NodeWithToolbar } from "./node";
import { useNodeStore } from "../store/nodeStore";
import { cn } from "../utils";
import { useShallow } from "zustand/shallow";
import { useEffect } from "react";
import { addNode } from "../features/add-node";
import { sendMessageToRN } from "../features/send-message";

const nodeTypes = {
  "node-with-toolbar": NodeWithToolbar,
};

interface WebViewMessageEvent extends MessageEvent {
  // event.data is typed as 'any' by default in the browser MessageEvent interface.
  // We can refine this if we know the expected shape of our RN messages.
  data: string; // React Native sends data as a string
}

interface RNMessage {
  action: "addNode" | "deleteNode";
}

const Graph = () => {
  const nodes = useNodeStore((state) => state.nodes);
  const edges = useNodeStore((state) => state.edges);
  const direction = useNodeStore((state) => state.direction);

  const onNodesChange = useNodeStore(
    useShallow((state) => state.onNodesChange),
  );
  const onEdgesChange = useNodeStore(
    useShallow((state) => state.onEdgesChange),
  );
  const setDirection = useNodeStore((state) => state.setDirection);

  const onHorizontalClick = () => {
    sendMessageToRN("horizontal")
    setDirection("horizontal");
  };

  const onVerticalClick = () => {
    sendMessageToRN("vertical")
    setDirection("vertical");
  };

  useEffect(() => {
    const handleMessageFromRN = (e: WebViewMessageEvent) => {
      const message: RNMessage = JSON.parse(e.data);

      if (message.action === "addNode") {
        addNode(nodes, edges, "0");
      }
    };
    window.addEventListener("message", handleMessageFromRN);

    return () => {
      window.removeEventListener("message", handleMessageFromRN);
    };
  }, [edges, nodes]);

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
