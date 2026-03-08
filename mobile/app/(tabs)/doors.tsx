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
import api from "../../services/api";

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
    } catch (e) {
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
      Alert.alert("Listo", "Puerta abierta (simulación)");
    } catch (err: unknown) {
      const res = err && typeof err === "object" && "response" in err
        ? (err as { response?: { status?: number; data?: { error?: string } } }).response
        : null;
      const msg = res?.data?.error || (res?.status === 429 ? "Límite de aperturas alcanzado" : "Error al abrir");
      Alert.alert("Error", msg);
    } finally {
      setOpeningId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4a90d9" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={doors}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDoors(); }} />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.doorName}>{item.name}</Text>
            <Text style={styles.doorType}>{item.doorType}</Text>
            <TouchableOpacity
              style={[styles.openBtn, openingId === item.id && styles.openBtnDisabled]}
              onPress={() => openDoor(item)}
              disabled={!!openingId}
            >
              {openingId === item.id ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.openBtnText}>Abrir puerta</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1a1a2e", padding: 16 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#1a1a2e" },
  card: {
    backgroundColor: "#16213e",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  doorName: { fontSize: 18, color: "#fff", fontWeight: "600", marginBottom: 4 },
  doorType: { fontSize: 14, color: "#888", marginBottom: 12 },
  openBtn: { backgroundColor: "#4a90d9", padding: 12, borderRadius: 8, alignItems: "center" },
  openBtnDisabled: { opacity: 0.7 },
  openBtnText: { color: "#fff", fontWeight: "600" },
});
