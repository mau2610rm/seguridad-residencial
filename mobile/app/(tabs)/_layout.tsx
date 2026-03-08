import { Tabs } from "expo-router";
import { useAuth } from "../../context/AuthContext";

export default function TabsLayout() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin_residencial";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#4a90d9",
        tabBarInactiveTintColor: "#888",
        tabBarStyle: { backgroundColor: "#16213e" },
        headerStyle: { backgroundColor: "#1a1a2e" },
        headerTintColor: "#fff",
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Inicio", tabBarLabel: "Inicio" }} />
      <Tabs.Screen name="doors" options={{ title: "Puertas", tabBarLabel: "Puertas" }} />
      <Tabs.Screen name="visitors" options={{ title: "Visitantes", tabBarLabel: "Visitantes" }} />
      <Tabs.Screen name="incidents" options={{ title: "Incidentes", tabBarLabel: "Incidentes" }} />
      <Tabs.Screen name="payments" options={{ title: "Pagos", tabBarLabel: "Pagos" }} />
      <Tabs.Screen
        name="limits"
        options={{
          title: "Límites",
          tabBarLabel: "Límites",
          href: isAdmin ? "/limits" : null,
        }}
      />
    </Tabs>
  );
}
