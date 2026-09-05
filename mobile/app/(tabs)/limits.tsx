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
import { Ionicons } from "@expo/vector-icons";
import api from "../../services/api";
import { Theme } from "../../constants/theme";

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
    } catch {
      Alert.alert("Error", "No se pudo crear el límite");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteLimit = (id: string) => {
    Alert.alert("Eliminar", "¿Quitar este límite de aperturas?", [
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
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Action Header Button */}
      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="add-circle-outline" size={20} color={Theme.colors.onPrimary} style={{ marginRight: 8 }} />
        <Text style={styles.addBtnText}>Nuevo Límite de Aperturas</Text>
      </TouchableOpacity>

      <FlatList
        data={limits}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={Theme.colors.primary}
            onRefresh={() => {
              setRefreshing(true);
              fetchLimits();
            }}
          />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.ruleIconBadge}>
                <Ionicons name="speedometer-outline" size={22} color={Theme.colors.primaryLight} />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.rule}>
                  Máx. {item.maxOpenings} aperturas por {item.period === "day" ? "día" : "mes"}
                </Text>
                <View style={styles.metaRow}>
                  <Ionicons name="layers-outline" size={13} color={Theme.colors.textMuted} />
                  <Text style={styles.meta}>
                    {item.unitId ? `Unidad ${item.unitId}` : "Todas las unidades"} •{" "}
                    {item.doorId ? `Puerta ${item.doorId}` : "Todas las puertas"}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.cardActions}>
              <TouchableOpacity
                style={styles.delBtn}
                onPress={() => deleteLimit(item.id)}
                activeOpacity={0.8}
              >
                <Ionicons name="trash-outline" size={15} color={Theme.colors.errorLight} style={{ marginRight: 4 }} />
                <Text style={styles.delBtnText}>Eliminar regla</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* Modal Crear Límite */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="options-outline" size={24} color={Theme.colors.primary} />
              <Text style={styles.modalTitle}>Definir Límite de Aperturas</Text>
            </View>

            <Text style={styles.inputLabel}>MÁXIMO DE APERTURAS</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej. 20"
              placeholderTextColor={Theme.colors.textMuted}
              value={maxOpenings}
              onChangeText={setMaxOpenings}
              keyboardType="number-pad"
            />

            <Text style={styles.inputLabel}>PERIODO DE TIEMPO</Text>
            <View style={styles.periodRow}>
              <TouchableOpacity
                style={[styles.periodBtn, period === "day" && styles.periodBtnActive]}
                onPress={() => setPeriod("day")}
                activeOpacity={0.8}
              >
                <Text style={period === "day" ? styles.periodBtnTextActive : styles.periodBtnText}>
                  Por Día
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.periodBtn, period === "month" && styles.periodBtnActive]}
                onPress={() => setPeriod("month")}
                activeOpacity={0.8}
              >
                <Text style={period === "month" ? styles.periodBtnTextActive : styles.periodBtnText}>
                  Por Mes
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={addLimit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color={Theme.colors.onPrimary} />
              ) : (
                <Text style={styles.submitBtnText}>Guardar Regla</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  addBtn: {
    flexDirection: "row",
    backgroundColor: Theme.colors.primary,
    paddingVertical: 14,
    borderRadius: Theme.borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Theme.spacing.lg,
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  addBtnText: {
    color: Theme.colors.onPrimary,
    fontWeight: "600",
    fontSize: 15,
  },
  card: {
    backgroundColor: Theme.colors.surfaceContainer,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  ruleIconBadge: {
    width: 44,
    height: 44,
    borderRadius: Theme.borderRadius.md,
    backgroundColor: Theme.colors.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Theme.colors.borderMedium,
    marginRight: Theme.spacing.md,
  },
  cardContent: {
    flex: 1,
  },
  rule: {
    fontSize: 16,
    color: Theme.colors.textPrimary,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  meta: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
  },
  cardActions: {
    marginTop: Theme.spacing.md,
    paddingTop: Theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
  },
  delBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
  },
  delBtnText: {
    color: Theme.colors.errorLight,
    fontSize: 13,
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(1, 15, 31, 0.75)",
    justifyContent: "center",
    padding: Theme.spacing.xxl,
  },
  modalContent: {
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderRadius: Theme.borderRadius.xl,
    padding: Theme.spacing.xl,
    borderWidth: 1,
    borderColor: Theme.colors.borderMedium,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: Theme.spacing.lg,
  },
  modalTitle: {
    color: Theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  inputLabel: {
    color: Theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Theme.colors.surfaceContainerLow,
    borderRadius: Theme.borderRadius.md,
    padding: 12,
    color: Theme.colors.textPrimary,
    marginBottom: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    fontSize: 15,
  },
  periodRow: {
    flexDirection: "row",
    gap: Theme.spacing.md,
    marginBottom: Theme.spacing.xl,
  },
  periodBtn: {
    flex: 1,
    padding: 12,
    backgroundColor: Theme.colors.surfaceContainerLow,
    borderRadius: Theme.borderRadius.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  periodBtnActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  periodBtnText: {
    color: Theme.colors.textSecondary,
    fontWeight: "500",
  },
  periodBtnTextActive: {
    color: Theme.colors.onPrimary,
    fontWeight: "700",
  },
  submitBtn: {
    backgroundColor: Theme.colors.primary,
    paddingVertical: 14,
    borderRadius: Theme.borderRadius.md,
    alignItems: "center",
  },
  submitBtnText: {
    color: Theme.colors.onPrimary,
    fontWeight: "600",
    fontSize: 15,
  },
  cancelBtn: {
    marginTop: Theme.spacing.md,
    alignItems: "center",
    paddingVertical: 6,
  },
  cancelBtnText: {
    color: Theme.colors.textMuted,
    fontSize: 14,
  },
});
