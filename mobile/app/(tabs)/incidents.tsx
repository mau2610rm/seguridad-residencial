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

interface Incident {
  id: string;
  type: string;
  description: string;
  location: string | null;
  status: string;
  createdAt: string;
  reportedBy: { name: string | null; email: string };
}

export default function Incidents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchIncidents = async (pageNum = 1) => {
    try {
      const { data } = await api.get<{ data: Incident[]; total: number }>("/incidents", {
        params: { page: pageNum, limit: 20 },
      });
      if (pageNum === 1) {
        setIncidents(data.data);
      } else {
        setIncidents((prev) => [...prev, ...data.data]);
      }
      setTotal(data.total);
    } catch {
      Alert.alert("Error", "No se pudieron cargar los incidentes");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchIncidents(1);
  }, []);

  const reportIncident = async () => {
    if (!type.trim() || !description.trim()) {
      Alert.alert("Error", "Tipo y descripción son requeridos");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/incidents", {
        type: type.trim(),
        description: description.trim(),
        location: location.trim() || undefined,
      });
      setModalVisible(false);
      setType("");
      setDescription("");
      setLocation("");
      fetchIncidents(1);
    } catch {
      Alert.alert("Error", "No se pudo reportar el incidente");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && incidents.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4a90d9" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
        <Text style={styles.addBtnText}>+ Reportar incidente</Text>
      </TouchableOpacity>
      <FlatList
        data={incidents}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchIncidents(1); }} />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.type}>{item.type}</Text>
              <Text style={[styles.status, item.status !== "reportado" && styles.statusResolved]}>{item.status}</Text>
            </View>
            <Text style={styles.desc}>{item.description}</Text>
            {item.location ? <Text style={styles.meta}>Ubicación: {item.location}</Text> : null}
            <Text style={styles.meta}>{item.reportedBy?.name || item.reportedBy?.email} · {new Date(item.createdAt).toLocaleString()}</Text>
          </View>
        )}
      />

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reportar incidente</Text>
            <TextInput
              style={styles.input}
              placeholder="Tipo (ej. Falla eléctrica)"
              placeholderTextColor="#888"
              value={type}
              onChangeText={setType}
            />
            <TextInput
              style={[styles.input, styles.inputArea]}
              placeholder="Descripción"
              placeholderTextColor="#888"
              value={description}
              onChangeText={setDescription}
              multiline
            />
            <TextInput
              style={styles.input}
              placeholder="Ubicación (opcional)"
              placeholderTextColor="#888"
              value={location}
              onChangeText={setLocation}
            />
            <TouchableOpacity style={styles.submitBtn} onPress={reportIncident} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Enviar</Text>}
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
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  type: { fontSize: 16, color: "#fff", fontWeight: "600" },
  status: { fontSize: 12, color: "#f39c12" },
  statusResolved: { color: "#27ae60" },
  desc: { color: "#e0e0e0", marginBottom: 4 },
  meta: { fontSize: 12, color: "#888", marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 24 },
  modalContent: { backgroundColor: "#16213e", borderRadius: 16, padding: 24 },
  modalTitle: { color: "#fff", fontSize: 20, fontWeight: "700", marginBottom: 16 },
  input: { backgroundColor: "#0f3460", borderRadius: 8, padding: 12, color: "#fff", marginBottom: 12 },
  inputArea: { minHeight: 80 },
  submitBtn: { backgroundColor: "#4a90d9", padding: 14, borderRadius: 8, alignItems: "center", marginTop: 8 },
  submitBtnText: { color: "#fff", fontWeight: "600" },
  cancelBtn: { marginTop: 12, alignItems: "center" },
  cancelBtnText: { color: "#888" },
});
