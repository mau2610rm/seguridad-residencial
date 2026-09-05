import { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import api from "../../services/api";
import { Theme } from "../../constants/theme";

interface Door {
  id: string;
  name: string;
  doorType: string;
}

export default function Doors() {
  const [doors, setDoors] = useState<Door[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const fetchDoors = async () => {
    try {
      const { data } = await api.get<Door[]>("/doors");
      setDoors(data);
    } catch {
      Alert.alert("Error", "No se pudieron cargar las puertas");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDoors();
  }, []);

  const openDoor = async (door: Door) => {
    setOpeningId(door.id);
    try {
      await api.post(`/doors/${door.id}/open`);
      Alert.alert("Acceso Concedido", `La puerta "${door.name}" ha sido abierta exitosamente.`);
    } catch (err: unknown) {
      const res =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { status?: number; data?: { error?: string } } }).response
          : null;
      const msg =
        res?.data?.error || (res?.status === 429 ? "Límite de aperturas alcanzado" : "Error al abrir la puerta");
      Alert.alert("Error de Acceso", msg);
    } finally {
      setOpeningId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Telemetry Header */}
      <View style={styles.headerInfo}>
        <View style={styles.telemetryTag}>
          <View style={styles.emeraldDot} />
          <Text style={styles.telemetryText}>Puntos de Acceso Conectados ({doors.length})</Text>
        </View>
        <View style={styles.secureBadge}>
          <Ionicons name="lock-closed" size={12} color={Theme.colors.secondary} />
          <Text style={styles.secureBadgeText}>Token Dinámico</Text>
        </View>
      </View>

      <FlatList
        data={doors}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={Theme.colors.primary}
            onRefresh={() => {
              setRefreshing(true);
              fetchDoors();
            }}
          />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.doorIconContainer}>
                <Ionicons
                  name={item.doorType === "vehicular" ? "car-outline" : "key-outline"}
                  size={22}
                  color={Theme.colors.primaryLight}
                />
              </View>
              <View style={styles.doorMeta}>
                <Text style={styles.doorName}>{item.name}</Text>
                <View style={styles.doorTypePill}>
                  <Text style={styles.doorTypeText}>
                    {item.doorType === "vehicular" ? "Acceso Vehicular" : "Acceso Peatonal"}
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.openBtn, openingId === item.id && styles.openBtnDisabled]}
              onPress={() => openDoor(item)}
              disabled={!!openingId}
              activeOpacity={0.85}
            >
              {openingId === item.id ? (
                <ActivityIndicator color={Theme.colors.onPrimary} size="small" />
              ) : (
                <View style={styles.btnContent}>
                  <Ionicons name="lock-open-outline" size={18} color={Theme.colors.onPrimary} style={{ marginRight: 8 }} />
                  <Text style={styles.openBtnText}>Abrir Puerta</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    padding: Theme.spacing.lg,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Theme.colors.background,
  },
  headerInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Theme.spacing.md,
  },
  telemetryTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  emeraldDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Theme.colors.secondary,
  },
  telemetryText: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    fontWeight: "500",
  },
  secureBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Theme.colors.surfaceContainerHigh,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Theme.borderRadius.full,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  secureBadgeText: {
    fontSize: 11,
    color: Theme.colors.secondary,
    fontWeight: "600",
  },
  card: {
    backgroundColor: Theme.colors.surfaceContainer,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Theme.spacing.lg,
  },
  doorIconContainer: {
    width: 46,
    height: 46,
    borderRadius: Theme.borderRadius.md,
    backgroundColor: Theme.colors.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Theme.colors.borderMedium,
    marginRight: Theme.spacing.md,
  },
  doorMeta: {
    flex: 1,
  },
  doorName: {
    fontSize: 17,
    color: Theme.colors.textPrimary,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  doorTypePill: {
    alignSelf: "flex-start",
    backgroundColor: Theme.colors.surfaceContainerLow,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Theme.borderRadius.sm,
    marginTop: 4,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  doorTypeText: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
    fontWeight: "500",
  },
  openBtn: {
    backgroundColor: Theme.colors.primary,
    paddingVertical: 13,
    borderRadius: Theme.borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  openBtnDisabled: { opacity: 0.6 },
  btnContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  openBtnText: {
    color: Theme.colors.onPrimary,
    fontWeight: "600",
    fontSize: 15,
  },
});
