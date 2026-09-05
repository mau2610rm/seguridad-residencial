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
  Platform,
  ScrollView,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { Theme } from "../../constants/theme";

interface Payment {
  id: string;
  concept: string;
  amount: number;
  dueDate: string;
  status: "pendiente" | "pagado" | string;
  reference?: string | null;
  paidAt?: string | null;
  unit: { id: string; number: string };
}

export default function Payments() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pendiente" | "pagado">("all");

  // Modal para que el admin cree una nueva cuota
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [units, setUnits] = useState<{ id: string; number: string }[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [concept, setConcept] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchPayments = async () => {
    try {
      const { data } = await api.get<Payment[]>("/payments");
      setPayments(data);
    } catch {
      Alert.alert("Error", "No se pudieron cargar los pagos");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  useEffect(() => {
    if (user?.role === "admin_residencial") {
      api.get<{ id: string; number: string }[]>("/units").then(({ data }) => {
        setUnits(data);
        if (data.length && !selectedUnitId) setSelectedUnitId(data[0].id);
      }).catch(() => {});
    }
  }, [user?.role]);

  // Pago de residente con Stripe
  const payWithStripe = async (payment: Payment) => {
    setPayingId(payment.id);
    try {
      const { data } = await api.post<{
        url: string;
        sessionId: string;
        publishableKey?: string;
        isLive: boolean;
      }>(`/payments/${payment.id}/checkout-session`);

      if (!data.url) {
        Alert.alert("Error", "No se pudo generar la sesión de pago de Stripe");
        return;
      }

      if (Platform.OS === "web") {
        window.open(data.url, "_blank");
        Alert.alert(
          "Stripe Checkout",
          "Se abrió la pasarela de pago en una pestaña. Una vez completado, presiona 'Verificar Pago'.",
          [
            { text: "Cerrar" },
            {
              text: "Verificar Pago",
              onPress: async () => {
                await verifyStripePayment(payment.id, data.sessionId);
              },
            },
          ]
        );
      } else {
        await WebBrowser.openBrowserAsync(data.url, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        });
        await verifyStripePayment(payment.id, data.sessionId);
      }
    } catch (err: unknown) {
      console.error("Error iniciando pago Stripe:", err);
      Alert.alert("Error", "Ocurrió un error al contactar con la pasarela de Stripe");
    } finally {
      setPayingId(null);
    }
  };

  const verifyStripePayment = async (paymentId: string, sessionId: string) => {
    try {
      const { data } = await api.post<{ success: boolean; payment?: Payment; message?: string }>(
        `/payments/${paymentId}/verify-session`,
        { sessionId }
      );

      if (data.success) {
        Alert.alert("✅ ¡Pago Confirmado!", "Tu cuota ha sido pagada exitosamente con Stripe.");
        fetchPayments();
      } else {
        Alert.alert("Estado de Pago", data.message || "El pago no se completó o está en proceso.");
        fetchPayments();
      }
    } catch {
      fetchPayments();
    }
  };

  // Confirmación manual por admin
  const confirmPayment = async (id: string) => {
    if (user?.role !== "admin_residencial") return;
    setConfirmingId(id);
    try {
      await api.post(`/payments/${id}/confirm`, { reference: "CONFIRMADO_ADMIN_MANUAL" });
      Alert.alert("Éxito", "Pago confirmado exitosamente");
      fetchPayments();
    } catch {
      Alert.alert("Error", "No se pudo confirmar el pago");
    } finally {
      setConfirmingId(null);
    }
  };

  // Crear cuota por admin
  const createPayment = async () => {
    if (!selectedUnitId || !concept.trim() || !amount.trim() || !dueDate.trim()) {
      Alert.alert("Error", "Todos los campos son obligatorios");
      return;
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert("Error", "Introduce un monto válido");
      return;
    }

    setCreating(true);
    try {
      await api.post("/payments", {
        unitId: selectedUnitId,
        concept: concept.trim(),
        amount: numAmount,
        dueDate: new Date(dueDate).toISOString(),
      });
      setCreateModalVisible(false);
      setConcept("");
      setAmount("");
      setDueDate("");
      fetchPayments();
      Alert.alert("Éxito", "Nueva cuota creada correctamente");
    } catch {
      Alert.alert("Error", "No se pudo crear la cuota de pago");
    } finally {
      setCreating(false);
    }
  };

  const filteredPayments = payments.filter((p) => {
    if (filter === "pendiente") return p.status === "pendiente";
    if (filter === "pagado") return p.status === "pagado";
    return true;
  });

  if (loading && payments.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  const isAdmin = user?.role === "admin_residencial";

  return (
    <View style={styles.container}>
      {/* Stripe SSL & Security Header Badge */}
      <View style={styles.securityHeaderRow}>
        <View style={styles.sslTag}>
          <Ionicons name="shield-checkmark" size={14} color={Theme.colors.secondary} />
          <Text style={styles.sslText}>Pasarela Segura SSL 256-bit</Text>
        </View>
        <View style={styles.stripeTag}>
          <Ionicons name="flash" size={12} color={Theme.colors.primaryLight} />
          <Text style={styles.stripeTagText}>Stripe Checkout</Text>
        </View>
      </View>

      {/* Botón de Administrador para nueva cuota */}
      {isAdmin && (
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            const nextMonth = new Date();
            nextMonth.setDate(nextMonth.getDate() + 15);
            setDueDate(nextMonth.toISOString().slice(0, 10));
            setCreateModalVisible(true);
          }}
          activeOpacity={0.85}
        >
          <Ionicons name="add-circle" size={18} color={Theme.colors.onPrimary} style={{ marginRight: 6 }} />
          <Text style={styles.addBtnText}>Crear Nueva Cuota / Cargo</Text>
        </TouchableOpacity>
      )}

      {/* Pestañas de Filtro */}
      <View style={styles.filterRow}>
        {(
          [
            { id: "all", label: "Todos", icon: "wallet-outline" },
            { id: "pendiente", label: "Pendientes", icon: "time-outline" },
            { id: "pagado", label: "Pagados", icon: "checkmark-done-circle-outline" },
          ] as const
        ).map((tab) => {
          const isActive = filter === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => setFilter(tab.id)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={tab.icon as any}
                size={13}
                color={isActive ? Theme.colors.onPrimary : Theme.colors.textSecondary}
                style={{ marginRight: 4 }}
              />
              <Text style={isActive ? styles.filterTextActive : styles.filterText}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={filteredPayments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={Theme.colors.primary}
            onRefresh={() => {
              setRefreshing(true);
              fetchPayments();
            }}
          />
        }
        renderItem={({ item }) => {
          const isPaid = item.status === "pagado";

          return (
            <View style={[styles.card, isPaid && styles.cardPaid]}>
              <View style={styles.row}>
                <Text style={styles.concept}>{item.concept}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    isPaid ? styles.statusBadgePaid : styles.statusBadgePending,
                  ]}
                >
                  <Ionicons
                    name={isPaid ? "checkmark-circle" : "time"}
                    size={11}
                    color={isPaid ? Theme.colors.secondary : Theme.colors.tertiary}
                    style={{ marginRight: 3 }}
                  />
                  <Text
                    style={[
                      styles.statusBadgeText,
                      isPaid ? styles.statusTextPaid : styles.statusTextPending,
                    ]}
                  >
                    {isPaid ? "PAGADO" : "PENDIENTE"}
                  </Text>
                </View>
              </View>

              <View style={styles.amountRow}>
                <Text style={styles.currencySymbol}>$</Text>
                <Text style={styles.amount}>{item.amount.toFixed(2)}</Text>
                <Text style={styles.currencyLabel}>MXN</Text>
              </View>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Ionicons name="home-outline" size={13} color={Theme.colors.textMuted} />
                  <Text style={styles.meta}>Unidad {item.unit?.number}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="calendar-outline" size={13} color={Theme.colors.textMuted} />
                  <Text style={styles.meta}>
                    Vence: {new Date(item.dueDate).toLocaleDateString()}
                  </Text>
                </View>
              </View>

              {isPaid && item.reference ? (
                <View style={styles.paidInfoBox}>
                  <View style={styles.paidInfoHeader}>
                    <Ionicons name="shield-checkmark" size={14} color={Theme.colors.secondary} />
                    <Text style={styles.paidInfoTitle}>Comprobante Cifrado</Text>
                  </View>
                  <Text style={styles.paidInfoRef}>Ref: {item.reference}</Text>
                  {item.paidAt ? (
                    <Text style={styles.paidInfoDate}>
                      Fecha: {new Date(item.paidAt).toLocaleString()}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {/* Botón de pago con Stripe para el Residente */}
              {!isPaid && (
                <View style={styles.actionsContainer}>
                  <TouchableOpacity
                    style={styles.stripePayBtn}
                    onPress={() => payWithStripe(item)}
                    disabled={payingId === item.id}
                    activeOpacity={0.85}
                  >
                    {payingId === item.id ? (
                      <ActivityIndicator color={Theme.colors.onPrimary} size="small" />
                    ) : (
                      <View style={styles.btnContent}>
                        <Ionicons name="card-outline" size={18} color={Theme.colors.onPrimary} style={{ marginRight: 8 }} />
                        <Text style={styles.stripePayBtnText}>Pagar con Stripe</Text>
                        <Text style={styles.stripeAmountText}>• ${item.amount.toFixed(2)}</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Confirmación administrativa */}
                  {isAdmin && (
                    <TouchableOpacity
                      style={styles.confirmBtn}
                      onPress={() => confirmPayment(item.id)}
                      disabled={confirmingId === item.id}
                      activeOpacity={0.85}
                    >
                      {confirmingId === item.id ? (
                        <ActivityIndicator color={Theme.colors.secondary} size="small" />
                      ) : (
                        <View style={styles.btnContent}>
                          <Ionicons name="checkmark-done" size={15} color={Theme.colors.secondary} style={{ marginRight: 6 }} />
                          <Text style={styles.confirmBtnText}>Confirmar Manualmente</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="receipt-outline" size={36} color={Theme.colors.textMuted} />
            <Text style={styles.emptyText}>No hay cuotas ni pagos registrados.</Text>
          </View>
        }
      />

      {/* Modal para Crear Cuota (Admin) */}
      <Modal visible={createModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeaderRow}>
                <Ionicons name="card" size={22} color={Theme.colors.primary} />
                <Text style={styles.modalTitle}>Crear Nueva Cuota</Text>
              </View>

              <Text style={styles.inputLabel}>UNIDAD A CARGAR:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.unitsScroll}>
                {units.map((u) => (
                  <TouchableOpacity
                    key={u.id}
                    style={[styles.unitChip, selectedUnitId === u.id && styles.unitChipActive]}
                    onPress={() => setSelectedUnitId(u.id)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={
                        selectedUnitId === u.id ? styles.unitChipTextActive : styles.unitChipText
                      }
                    >
                      Unidad {u.number}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.inputLabel}>CONCEPTO DE PAGO:</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej. Cuota Mantenimiento Noviembre"
                placeholderTextColor={Theme.colors.textMuted}
                value={concept}
                onChangeText={setConcept}
              />

              <Text style={styles.inputLabel}>MONTO ($ MXN):</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej. 1250.00"
                placeholderTextColor={Theme.colors.textMuted}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />

              <Text style={styles.inputLabel}>FECHA LÍMITE (YYYY-MM-DD):</Text>
              <TextInput
                style={styles.input}
                placeholder="2026-11-15"
                placeholderTextColor={Theme.colors.textMuted}
                value={dueDate}
                onChangeText={setDueDate}
              />

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={createPayment}
                disabled={creating}
                activeOpacity={0.85}
              >
                {creating ? (
                  <ActivityIndicator color={Theme.colors.onPrimary} />
                ) : (
                  <View style={styles.btnContent}>
                    <Ionicons name="add-circle" size={18} color={Theme.colors.onPrimary} style={{ marginRight: 6 }} />
                    <Text style={styles.saveBtnText}>Registrar Cuota</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelBtn} onPress={() => setCreateModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
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
  btnContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  securityHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Theme.spacing.md,
  },
  sslTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sslText: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
    fontWeight: "500",
  },
  stripeTag: {
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
  stripeTagText: {
    fontSize: 11,
    color: Theme.colors.primaryLight,
    fontWeight: "600",
  },
  addBtn: {
    flexDirection: "row",
    backgroundColor: Theme.colors.primary,
    paddingVertical: 13,
    borderRadius: Theme.borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Theme.spacing.md,
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  addBtnText: {
    color: Theme.colors.onPrimary,
    fontWeight: "700",
    fontSize: 15,
  },
  filterRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: Theme.spacing.md,
  },
  filterChip: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 7,
    paddingHorizontal: 4,
    backgroundColor: Theme.colors.surfaceContainer,
    borderRadius: Theme.borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  filterChipActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  filterText: {
    color: Theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: "600",
  },
  filterTextActive: {
    color: Theme.colors.onPrimary,
    fontSize: 11,
    fontWeight: "700",
  },
  card: {
    backgroundColor: Theme.colors.surfaceContainer,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  cardPaid: {
    borderColor: "rgba(16, 185, 129, 0.35)",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  concept: {
    fontSize: 16,
    color: Theme.colors.textPrimary,
    fontWeight: "700",
    flex: 1,
    marginRight: 8,
    letterSpacing: -0.2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Theme.borderRadius.full,
  },
  statusBadgePending: {
    backgroundColor: Theme.colors.tertiaryContainer,
  },
  statusBadgePaid: {
    backgroundColor: Theme.colors.secondaryContainer,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
  statusTextPending: { color: Theme.colors.tertiary },
  statusTextPaid: { color: Theme.colors.secondary },
  amountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
    marginVertical: 4,
  },
  currencySymbol: {
    fontSize: 16,
    color: Theme.colors.textSecondary,
    fontWeight: "600",
  },
  amount: {
    fontSize: 26,
    color: Theme.colors.textPrimary,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  currencyLabel: {
    fontSize: 12,
    color: Theme.colors.textMuted,
    fontWeight: "600",
    marginLeft: 2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 2,
    marginBottom: 6,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  meta: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
  },
  paidInfoBox: {
    marginTop: Theme.spacing.md,
    padding: 10,
    backgroundColor: Theme.colors.secondaryContainer,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
  },
  paidInfoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  paidInfoTitle: {
    color: Theme.colors.secondaryLight,
    fontSize: 11,
    fontWeight: "700",
  },
  paidInfoRef: {
    color: Theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  paidInfoDate: {
    color: Theme.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  actionsContainer: {
    marginTop: Theme.spacing.md,
    gap: 8,
  },
  stripePayBtn: {
    backgroundColor: Theme.colors.primary,
    paddingVertical: 13,
    borderRadius: Theme.borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  stripePayBtnText: {
    color: Theme.colors.onPrimary,
    fontWeight: "700",
    fontSize: 14,
  },
  stripeAmountText: {
    color: Theme.colors.onPrimary,
    opacity: 0.85,
    fontSize: 13,
    fontWeight: "500",
    marginLeft: 4,
  },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.colors.surfaceContainerLow,
    paddingVertical: 10,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
  },
  confirmBtnText: {
    color: Theme.colors.secondary,
    fontWeight: "600",
    fontSize: 13,
  },
  emptyBox: {
    padding: 40,
    alignItems: "center",
    gap: 10,
  },
  emptyText: {
    color: Theme.colors.textMuted,
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(1, 15, 31, 0.8)",
    justifyContent: "center",
    padding: Theme.spacing.lg,
  },
  modalScroll: {
    flexGrow: 1,
    justifyContent: "center",
  },
  modalContent: {
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderRadius: Theme.borderRadius.xl,
    padding: Theme.spacing.xl,
    borderWidth: 1,
    borderColor: Theme.colors.borderMedium,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
    fontSize: 14,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  unitsScroll: {
    flexDirection: "row",
    marginBottom: Theme.spacing.md,
  },
  unitChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Theme.colors.surfaceContainerLow,
    borderRadius: Theme.borderRadius.full,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  unitChipActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  unitChipText: {
    color: Theme.colors.textMuted,
    fontSize: 12,
  },
  unitChipTextActive: {
    color: Theme.colors.onPrimary,
    fontWeight: "700",
    fontSize: 12,
  },
  saveBtn: {
    backgroundColor: Theme.colors.primary,
    paddingVertical: 13,
    borderRadius: Theme.borderRadius.md,
    alignItems: "center",
    marginTop: 6,
  },
  saveBtnText: {
    color: Theme.colors.onPrimary,
    fontWeight: "700",
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
