import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { Theme } from "../../constants/theme";

export default function TabsLayout() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin_residencial";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Theme.colors.primaryLight,
        tabBarInactiveTintColor: Theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: Theme.colors.surfaceContainerLow,
          borderTopColor: Theme.colors.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
        headerStyle: {
          backgroundColor: Theme.colors.surfaceContainerLow,
          borderBottomColor: Theme.colors.border,
          borderBottomWidth: 1,
          shadowOpacity: 0,
          elevation: 0,
        },
        headerTitleStyle: {
          color: Theme.colors.textPrimary,
          fontWeight: "700",
          fontSize: 18,
        },
        headerTintColor: Theme.colors.textPrimary,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Inicio",
          tabBarLabel: "Inicio",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "shield-checkmark" : "shield-checkmark-outline"}
              size={size - 1}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="doors"
        options={{
          title: "Puertas",
          tabBarLabel: "Puertas",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "key" : "key-outline"}
              size={size - 1}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="visitors"
        options={{
          title: "Visitantes",
          tabBarLabel: "Visitantes",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "qr-code" : "qr-code-outline"}
              size={size - 1}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="incidents"
        options={{
          title: "Incidentes",
          tabBarLabel: "Incidentes",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "warning" : "warning-outline"}
              size={size - 1}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          title: "Pagos",
          tabBarLabel: "Pagos",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "card" : "card-outline"}
              size={size - 1}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="limits"
        options={{
          title: "Límites",
          tabBarLabel: "Límites",
          href: isAdmin ? "/limits" : null,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "options" : "options-outline"}
              size={size - 1}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
