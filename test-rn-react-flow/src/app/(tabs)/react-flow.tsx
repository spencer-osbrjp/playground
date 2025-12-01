import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";

type Direction = "vertical" | "horizontal";

const ReactFlow = () => {
  const [direction, setDirection] = useState<Direction>("vertical");

  const webviewRef = useRef<WebView | null>(null);

  const sendMessageToWebView = () => {
    if (!webviewRef || !webviewRef.current) return;

    const data = {
      action: "addNode",
    };

    webviewRef.current.postMessage(JSON.stringify(data));
  };

  const handleWebViewMessage = (e: WebViewMessageEvent) => {
    const message: {
      direction: Direction;
    } = JSON.parse(e.nativeEvent.data);

    const d = message.direction;

    setDirection(d);
  };

  return (
    <View className="flex-1 gap-4">
      <Text className="text-2xl font-bold px-4 py-2">React Native Component: </Text>
      <View className="border-4 border-red-400 m-1">
        <View className="px-4 py-2">
          <Text className="text-lg">Current layout in WebView: {direction}</Text>
        </View>
        <View className="flex flex-row gap-4 p-4">
          <Pressable
            onPress={sendMessageToWebView}
            className="bg-sky-400 text-white rounded-md py-2 px-4"
          >
            <Text>Add Node</Text>
          </Pressable>
        </View>
      </View>
      <Text className="text-2xl font-bold px-4 py-2">WebView Component: </Text>
      <View className="flex-1 border-4 border-blue-700 m-1">
        <WebView
          ref={webviewRef}
          source={{
            uri: "http://10.10.198.74:5173/",
          }}
          onMessage={handleWebViewMessage}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
};

export default ReactFlow;
