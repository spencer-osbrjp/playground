import Svg, { G, Path, Rect, Text as SVGText } from "react-native-svg";
import { View, Text, Pressable } from "react-native";
import { hierarchy, tree } from "d3-hierarchy";
import { linkVertical } from "d3-shape";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useState } from "react";

type Data = {
  name: string;
  children?: Data[];
};

const initialData: Data = {
  name: "Eve",
  children: [
    { name: "Cain" },
    { name: "Seth", children: [{ name: "Enos" }, { name: "Noam" }] },
    { name: "Abel" },
    { name: "Awan", children: [{ name: "Enoch" }] },
    { name: "Azura" },
  ],
};

/**
 * Recursively searches for a node by name in the tree structure and adds a new child node to it
 * @param node - The current node to search in
 * @param sourceName - The name of the parent node to add the child to
 * @param newChildName - The name of the new child node to add
 * @returns true if the node was found and child was added, false otherwise
 */
const addNodeToTree = (
  node: Data,
  sourceName: string,
  newChildName: string
): boolean => {
  // Base case: if current node's name matches the source, add the child here
  if (node.name === sourceName) {
    // Initialize children array if it doesn't exist
    if (!node.children) {
      node.children = [];
    }
    // Add the new child node
    node.children.push({ name: newChildName });
    return true; // Return true to indicate we found and modified the node
  }

  // Recursive case: search in children if they exist
  if (node.children) {
    // Loop through each child and recursively search
    for (const child of node.children) {
      // If we found the source in this subtree, return true immediately
      // This stops the search once we've added the node
      if (addNodeToTree(child, sourceName, newChildName)) {
        return true;
      }
    }
  }

  // If we reach here, the source wasn't found in this node or its children
  return false;
};

const NODE_SIZE = {
  width: 100,
  height: 50,
};

const D3Flow = () => {
  const { width: nodeWidth, height: nodeHeight } = NODE_SIZE;

  // State to manage the tree data
  // We need to clone initialData to avoid mutating the original
  const [data, setData] = useState<Data>(() => JSON.parse(JSON.stringify(initialData)));

  // Counter for generating unique node names when adding nodes
  const [nodeCounter, setNodeCounter] = useState(0);

  /**
   * Adds a new child node to a parent node by name
   * @param parentName - The name of the parent node to add the child to
   */
  const addNode = (parentName: string) => {
    // Create a new child name
    const newChildName = `New Node ${nodeCounter}`;

    // Clone the current data to avoid direct state mutation
    const newData = JSON.parse(JSON.stringify(data)) as Data;

    // Attempt to add the node recursively
    const success = addNodeToTree(newData, parentName, newChildName);

    if (success) {
      // Update state with the modified tree
      setData(newData);
      // Increment counter for next node
      setNodeCounter(nodeCounter + 1);
    } else {
      console.warn(`Parent node "${parentName}" not found in tree`);
    }
  };

  const root = hierarchy<Data>(data);
  const treeLayout = tree<Data>()
    .nodeSize([nodeWidth + 20, nodeHeight + 40])
    .separation((a, b) => (a.parent === b.parent ? 1 : 2));

  treeLayout(root);

  // Shared values for gesture state
  // scale: current zoom level (1 = 100%, 2 = 200% zoomed in, 0.5 = 50% zoomed out)
  const scale = useSharedValue(1);
  // savedScale: stores the scale value when a pinch gesture starts
  // This allows cumulative zooming across multiple pinch gestures
  const savedScale = useSharedValue(1);

  // translateX/Y: current pan offset in pixels
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  // savedTranslateX/Y: stores translation when a pan gesture starts
  // This allows cumulative panning across multiple pan gestures
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Pinch gesture for zooming
  // event.scale starts at 1 when gesture begins, increases when spreading fingers, decreases when pinching
  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      // Multiply savedScale by event.scale for cumulative zooming
      // If savedScale is 2 (already zoomed 2x) and event.scale is 1.5, new scale = 3 (2 * 1.5)
      const newScale = savedScale.value * event.scale;
      // Clamp scale between 0.5 (50% zoom out) and 5 (500% zoom in)
      scale.value = Math.max(0.5, Math.min(newScale, 5));
    })
    .onEnd(() => {
      // Save the final scale so next pinch gesture starts from this zoom level
      savedScale.value = scale.value;
    });

  // Pan gesture for moving the view around
  // event.translationX/Y are cumulative offsets from where the gesture started
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      // Add current gesture translation to saved position for cumulative panning
      // If savedTranslateX is 100 and event.translationX is 50, translateX = 150
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    })
    .onEnd(() => {
      // Save the final positions so next pan gesture starts from here
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  // Compose gestures to allow simultaneous pinch and pan
  // This lets users zoom and pan at the same time
  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  // Animated style that applies transformations to the SVG container
  // These transformations update automatically when shared values change
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      // Apply translation first (panning)
      { translateX: translateX.value },
      { translateY: translateY.value },
      // Then apply scale (zooming)
      { scale: scale.value },
    ],
  }));

  // Find bounds of the tree
  const nodes = root.descendants();
  const xs = nodes.map((n) => n.x || 0);
  const ys = nodes.map((n) => n.y || 0);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  // Calculate the total dimensions of the tree with padding
  // (maxX - minX) gives the span of x coordinates
  // + nodeWidth * 2 adds padding: nodeWidth on left and nodeWidth on right
  const treeWidth = maxX - minX + nodeWidth * 2;
  const treeHeight = maxY - minY + nodeHeight * 2;

  // Calculate offsets to shift tree into positive coordinate space with padding
  // -minX: negates the minimum x to shift everything right (e.g., if minX is -100, -(-100) = +100)
  // + nodeWidth: adds left padding so nodes don't sit at the edge (x=0) but start at x=nodeWidth
  // Result: leftmost node (originally at minX) now appears at position nodeWidth
  const offsetX = -minX + nodeWidth;

  // Same logic for Y axis:
  // -minY: shifts everything down to remove negative coordinates
  // + nodeHeight: adds top padding so the topmost node appears at y=nodeHeight instead of y=0
  const offsetY = -minY + nodeHeight;

  // Create link generator for curved paths between nodes
  // linkVertical() creates a generator function that produces SVG path data for vertical curves
  // It generates a cubic Bezier curve where control points are positioned vertically
  // between the source and target, creating a smooth S-shaped curve
  type LinkPoint = { x: number; y: number };
  type LinkData = { source: LinkPoint; target: LinkPoint };
  const linkGenerator = linkVertical<LinkData, LinkPoint>()
    // .x() defines how to extract x coordinate from data points
    // This tells the generator where horizontally to place the start/end of the curve
    .x((d) => d.x)
    // .y() defines how to extract y coordinate from data points
    // This tells the generator where vertically to place the start/end of the curve
    .y((d) => d.y);

  // Get all links (connections between parent and child nodes)
  // root.links() returns an array of {source, target} objects where:
  // - source: the parent node
  // - target: the child node
  const links = root.links();

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 16, flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Text style={{ fontSize: 20, fontWeight: "bold" }}>D3 Flow</Text>
        <Pressable
          onPress={() => addNode("Eve")}
          style={{
            backgroundColor: "#3b82f6",
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 6,
          }}
        >
          <Text style={{ color: "white" }}>Add to Eve</Text>
        </Pressable>
        <Pressable
          onPress={() => addNode("Seth")}
          style={{
            backgroundColor: "#10b981",
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 6,
          }}
        >
          <Text style={{ color: "white" }}>Add to Seth</Text>
        </Pressable>
      </View>
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[{ flex: 1 }, animatedStyle]}>
          <Svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${treeWidth} ${treeHeight}`}
          >
            {/* Render links first so they appear behind nodes (SVG renders in order) */}
            {links.map((link, i) => {
              // Apply the same offsets to link coordinates as we did to node coordinates
              // This ensures the links connect to the correct node positions after translation
              // link.source is the parent node, link.target is the child node
              const pathData = linkGenerator({
                source: {
                  // Parent node x position + horizontal offset for centering
                  x: (link.source.x || 0) + offsetX,
                  // Parent node y position + vertical offset for centering
                  y: (link.source.y || 0) + offsetY,
                },
                target: {
                  // Child node x position + horizontal offset for centering
                  x: (link.target.x || 0) + offsetX,
                  // Child node y position + vertical offset for centering
                  y: (link.target.y || 0) + offsetY,
                },
              });
              return (
                <Path
                  key={`link-${i}`}
                  // d: SVG path data string generated by linkGenerator (e.g., "M100,50 C100,75 150,75 150,100")
                  d={pathData || ""}
                  // stroke: line color (gray for subtle appearance)
                  stroke="#999"
                  // strokeWidth: line thickness in pixels
                  strokeWidth={2}
                  // fill: "none" ensures only the stroke is visible (no filled shape)
                  fill="none"
                />
              );
            })}

            {/* Render nodes on top of links */}
            {nodes.map((n) => (
              <NodeG
                key={n.data.name}
                x={(n.x || 0) + offsetX}
                y={(n.y || 0) + offsetY}
                text={n.data.name}
                onPress={() => addNode(n.data.name)}
              />
            ))}
          </Svg>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

interface NodeGProps {
  x: number;
  y: number;
  text: string;
  nodeWidth?: number;
  nodeHeight?: number;
  onPress?: () => void;
}

const NodeG = ({
  x,
  y,
  text,
  nodeWidth = NODE_SIZE.width,
  nodeHeight = NODE_SIZE.height,
  onPress,
}: NodeGProps) => {
  return (
    <G transform={`translate(${x}, ${y})`}>
      <Rect
        x={-nodeWidth / 2}
        y={-nodeHeight / 2}
        width={nodeWidth}
        height={nodeHeight}
        fill="grey"
        // onPress makes the Rect clickable
        // When clicked, it will add a new child node to this node
        onPress={onPress}
      />
      <SVGText
        x={0}
        y={0}
        textAnchor="middle"
        alignmentBaseline="middle"
        fontSize={16}
        // Prevent text from capturing touch events
        // This ensures the Rect's onPress is triggered
        pointerEvents="none"
      >
        {text}
      </SVGText>
    </G>
  );
};

export default D3Flow;
