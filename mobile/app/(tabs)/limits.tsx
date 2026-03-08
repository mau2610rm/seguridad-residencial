import { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from "react-native";
import api from "../../services/api";

interface OpeningLimit {
  id: string;
  unitId: string | null;
  doorId: string | null;
  maxOpenings: number;
  period: string;
}

export default function Limits() {
  const [limits, setLimits] = useState<OpeningLimit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [maxOpenings, setMaxOpenings] = useState("20");
  const [period, setPeriod] = useState<"day" | "month">("day");
  const [submitting, setSubmitting] = useState(false);

  const fetchLimits = async () => {
    try {
      const { data } = await api.get<OpeningLimit[]>("/limits");
      setLimits(data);
    } catch {
      Alert.alert("Error", "No se pudieron cargar los límites");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLimits();
  }, []);

  const addLimit = async () => {
    const max = parseInt(maxOpenings, 10);
    if (isNaN(max) || max < 1) {
      Alert.alert("Error", "Máximo de aperturas debe ser un número mayor a 0");
      return;
    }
    setSubmitting(true);
    try {
      await api.put("/limits", { maxOpenings: max, period });
      setModalVisible(false);
      setMaxOpenings("20");
      setPeriod("day");
      fetchLimits();
    } catch (e) {
      Alert.alert("Error", "No se pudo crear el límite");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteLimit = (id: string) => {
    Alert.alert("Eliminar", "¿Quitar este límite?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/limits/${id}`);
            fetchLimits();
          } catch {
            Alert.alert("Error", "No se pudo eliminar");
          }
        },
      },
    ]);
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
      <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
        <Text style={styles.addBtnText}>+ Nuevo límite</Text>
      </TouchableOpacity>
      <FlatList
        data={limits}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchLimits(); }} />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.rule}>
              Máx. {item.maxOpenings} aperturas por {item.period === "day" ? "día" : "mes"}
            </Text>
            <Text style={styles.meta}>
              {item.unitId ? `Unidad ${item.unitId}` : "Todas las unidades"} · {item.doorId ? `Puerta ${item.doorId}` : "Todas las puertas"}
            </Text>
            <TouchableOpacity style={styles.delBtn} onPress={() => deleteLimit(item.id)}>
              <Text style={styles.delBtnText}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nuevo límite de aperturas</Text>
            <TextInput
              style={styles.input}
              placeholder="Máximo de aperturas"
              placeholderTextColor="#888"
              value={maxOpenings}
              onChangeText={setMaxOpenings}
              keyboardType="number-pad"
            />
            <View style={styles.periodRow}>
              <TouchableOpacity
                style={[styles.periodBtn, period === "day" && styles.periodBtnActive]}
                onPress={() => setPeriod("day")}
              >
                <Text style={period === "day" ? styles.periodBtnTextActive : styles.periodBtnText}>Por día</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.periodBtn, period === "month" && styles.periodBtnActive]}
                onPress={() => setPeriod("month")}
              >
                <Text style={period === "month" ? styles.periodBtnTextActive : styles.periodBtnText}>Por mes</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.submitBtn} onPress={addLimit} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Crear</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1a1a2e", padding: 16 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#1a1a2e" },
  addBtn: { backgroundColor: "#4a90d9", padding: 14, borderRadius: 12, alignItems: "center", marginBottom: 16 },
  addBtnText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  card: { backgroundColor: "#16213e", borderRadius: 12, padding: 16, marginBottom: 12 },
  rule: { fontSize: 16, color: "#fff", fontWeight: "600", marginBottom: 4 },
  meta: { fontSize: 12, color: "#888", marginBottom: 8 },
  delBtn: { alignSelf: "flex-start" },
  delBtnText: { color: "#e74c3c", fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 24 },
  modalContent: { backgroundColor: "#16213e", borderRadius: 16, padding: 24 },
  modalTitle: { color: "#fff", fontSize: 20, fontWeight: "700", marginBottom: 16 },
  input: { backgroundColor: "#0f3460", borderRadius: 8, padding: 12, color: "#fff", marginBottom: 12 },
  periodRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  periodBtn: { flex: 1, padding: 12, backgroundColor: "#0f3460", borderRadius: 8, alignItems: "center" },
  periodBtnActive: { backgroundColor: "#4a90d9" },
  periodBtnText: { color: "#888" },
  periodBtnTextActive: { color: "#fff", fontWeight: "600" },
  submitBtn: { backgroundColor: "#4a90d9", padding: 14, borderRadius: 8, alignItems: "center" },
  submitBtnText: { color: "#fff", fontWeight: "600" },
  cancelBtn: { marginTop: 12, alignItems: "center" },
  cancelBtnText: { color: "#888" },
});
