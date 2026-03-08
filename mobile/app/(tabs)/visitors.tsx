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
import { useAuth } from "../../context/AuthContext";

interface VisitorCode {
  id: string;
  code: string;
  validFrom: string;
  validUntil: string;
  maxUses: number;
  usesRemaining: number;
  unit: { number: string };
}

export default function Visitors() {
  const { user } = useAuth();
  const [codes, setCodes] = useState<VisitorCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [validUntil, setValidUntil] = useState("");
  const [maxUses, setMaxUses] = useState("1");
  const [creating, setCreating] = useState(false);
  const [validateCode, setValidateCode] = useState("");
  const [validateDoorId, setValidateDoorId] = useState("");
  const [validating, setValidating] = useState(false);

  const fetchCodes = async () => {
    try {
      const { data } = await api.get<VisitorCode[]>("/visitors/codes");
      setCodes(data);
    } catch {
      Alert.alert("Error", "No se pudieron cargar los códigos");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCodes();
  }, []);

  const [units, setUnits] = useState<{ id: string; number: string }[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState("");

  useEffect(() => {
    if (user?.role === "admin_residencial" || user?.role === "residente") {
      api.get<{ id: string; number: string }[]>("/units").then(({ data }) => {
        setUnits(data);
        if (data.length && !selectedUnitId) setSelectedUnitId(user?.unitId || data[0].id);
      }).catch(() => {});
    }
  }, [user?.role, user?.unitId]);

  const createCode = async () => {
    const unitId = user?.unitId || selectedUnitId || (units[0]?.id);
    if (!unitId) {
      Alert.alert("Error", "No hay unidad asignada o selecciona una unidad");
      return;
    }
    if (!validUntil.trim()) {
      Alert.alert("Error", "Indica vigencia hasta (ISO fecha)");
      return;
    }
    setCreating(true);
    try {
      const validUntilDate = new Date(validUntil);
      validUntilDate.setHours(23, 59, 59, 999);
      await api.post("/visitors/codes", {
        unitId,
        validUntil: validUntilDate.toISOString(),
        maxUses: parseInt(maxUses, 10) || 1,
      });
      setModalVisible(false);
      setValidUntil("");
      setMaxUses("1");
      fetchCodes();
    } catch (e) {
      Alert.alert("Error", "No se pudo crear el código");
    } finally {
      setCreating(false);
    }
  };

  const validateVisitor = async () => {
    if (!validateCode.trim() || !validateDoorId.trim()) {
      Alert.alert("Error", "Código y puerta requeridos");
      return;
    }
    setValidating(true);
    try {
      const { data } = await api.post("/visitors/validate", {
        code: validateCode.trim().toUpperCase(),
        doorId: validateDoorId.trim(),
      });
      Alert.alert("Acceso permitido", `Unidad ${data.unit}`);
    } catch (err: unknown) {
      const res = err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { error?: string } } }).response
        : null;
      Alert.alert("Error", res?.data?.error || "Código inválido");
    } finally {
      setValidating(false);
    }
  };

  const deleteCode = (id: string) => {
    Alert.alert("Eliminar", "¿Invalidar este código?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/visitors/codes/${id}`);
            fetchCodes();
          } catch {
            Alert.alert("Error", "No se pudo eliminar");
          }
        },
      },
    ]);
  };

  const isGuardOrAdmin = user?.role === "guardia" || user?.role === "admin_residencial";

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4a90d9" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isGuardOrAdmin && (
        <View style={styles.validateSection}>
          <Text style={styles.sectionTitle}>Validar visitante</Text>
          <TextInput
            style={styles.input}
            placeholder="Código (8 caracteres)"
            placeholderTextColor="#888"
            value={validateCode}
            onChangeText={setValidateCode}
            maxLength={8}
          />
          <TextInput
            style={styles.input}
            placeholder="ID de puerta"
            placeholderTextColor="#888"
            value={validateDoorId}
            onChangeText={setValidateDoorId}
          />
          <TouchableOpacity
            style={styles.validateBtn}
            onPress={validateVisitor}
            disabled={validating}
          >
            {validating ? <ActivityIndicator color="#fff" /> : <Text style={styles.validateBtnText}>Validar</Text>}
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.row}>
        <Text style={styles.title}>Códigos de visitante</Text>
        {user?.role !== "guardia" && (
          <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
            <Text style={styles.addBtnText}>+ Nuevo</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={codes}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchCodes(); }} />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.code}>{item.code}</Text>
            <Text style={styles.meta}>Unidad {item.unit?.number} · Usos: {item.usesRemaining}/{item.maxUses}</Text>
            <Text style={styles.meta}>Válido hasta: {new Date(item.validUntil).toLocaleString()}</Text>
            {user?.role !== "guardia" && (
              <TouchableOpacity style={styles.delBtn} onPress={() => deleteCode(item.id)}>
                <Text style={styles.delBtnText}>Invalidar</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nuevo código</Text>
            {user?.role === "admin_residencial" && units.length > 1 && (
              <View style={styles.unitPicker}>
                <Text style={styles.unitLabel}>Unidad</Text>
                {units.map((u) => (
                  <TouchableOpacity
                    key={u.id}
                    style={[styles.unitOption, selectedUnitId === u.id && styles.unitOptionSelected]}
                    onPress={() => setSelectedUnitId(u.id)}
                  >
                    <Text style={styles.unitOptionText}>{u.number}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <TextInput
              style={styles.input}
              placeholder="Válido hasta (YYYY-MM-DD)"
              placeholderTextColor="#888"
              value={validUntil}
              onChangeText={setValidUntil}
            />
            <TextInput
              style={styles.input}
              placeholder="Máx. usos"
              placeholderTextColor="#888"
              value={maxUses}
              onChangeText={setMaxUses}
              keyboardType="number-pad"
            />
            <TouchableOpacity style={styles.createBtn} onPress={createCode} disabled={creating}>
              {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.createBtnText}>Crear</Text>}
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
  validateSection: { marginBottom: 16, padding: 12, backgroundColor: "#16213e", borderRadius: 12 },
  sectionTitle: { color: "#fff", fontSize: 16, fontWeight: "600", marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { fontSize: 18, color: "#fff", fontWeight: "600" },
  addBtn: { backgroundColor: "#4a90d9", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  addBtnText: { color: "#fff", fontWeight: "600" },
  input: { backgroundColor: "#0f3460", borderRadius: 8, padding: 12, color: "#fff", marginBottom: 8 },
  validateBtn: { backgroundColor: "#27ae60", padding: 12, borderRadius: 8, alignItems: "center", marginTop: 4 },
  validateBtnText: { color: "#fff", fontWeight: "600" },
  card: { backgroundColor: "#16213e", borderRadius: 12, padding: 16, marginBottom: 12 },
  code: { fontSize: 20, color: "#4a90d9", fontWeight: "700", letterSpacing: 2, marginBottom: 4 },
  meta: { fontSize: 14, color: "#a0a0a0", marginBottom: 2 },
  delBtn: { marginTop: 8, alignSelf: "flex-start" },
  delBtnText: { color: "#e74c3c", fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 24 },
  modalContent: { backgroundColor: "#16213e", borderRadius: 16, padding: 24 },
  modalTitle: { color: "#fff", fontSize: 20, fontWeight: "700", marginBottom: 16 },
  createBtn: { backgroundColor: "#4a90d9", padding: 14, borderRadius: 8, alignItems: "center", marginTop: 8 },
  createBtnText: { color: "#fff", fontWeight: "600" },
  cancelBtn: { marginTop: 12, alignItems: "center" },
  cancelBtnText: { color: "#888" },
  unitPicker: { marginBottom: 12 },
  unitLabel: { color: "#a0a0a0", marginBottom: 6 },
  unitOption: { padding: 10, backgroundColor: "#0f3460", borderRadius: 8, marginBottom: 4 },
  unitOptionSelected: { borderWidth: 2, borderColor: "#4a90d9" },
  unitOptionText: { color: "#fff" },
});
