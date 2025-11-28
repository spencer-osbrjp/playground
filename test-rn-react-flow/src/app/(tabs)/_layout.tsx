import FontAwesome from '@expo/vector-icons/FontAwesome';  
import { Tabs } from 'expo-router';  

export default function TabLayout() {  
  return (  
    <Tabs screenOptions={{ tabBarActiveTintColor: 'red' }}>  
      <Tabs.Screen  
        name="index"  
        options={{  
          title: 'Home',  
          tabBarIcon: ({ color }) => <FontAwesome size={28} name="home" color={color} />,  
        }}  
      />  
      <Tabs.Screen  
        name="react-flow"  
        options={{  
          title: 'React Flow',  
          tabBarIcon: ({ color }) => <FontAwesome size={28} name="area-chart" color={color} />,  
        }}  
      />  
      <Tabs.Screen  
        name="d3-flow"  
        options={{  
          title: 'D3 Flow',  
          tabBarIcon: ({ color }) => <FontAwesome size={28} name="area-chart" color={color} />,  
        }}  
      />  
    </Tabs>  
  );  
}
