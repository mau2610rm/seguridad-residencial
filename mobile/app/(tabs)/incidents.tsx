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
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { Theme } from "../../constants/theme";

interface Incident {
  id: string;
  type: string;
  description: string;
  location: string | null;
  status: "reportado" | "en_progreso" | "resuelto" | "cancelado" | string;
  resolutionNotes?: string | null;
  resolvedAt?: string | null;
  resolvedById?: string | null;
  createdAt: string;
  reportedBy: { id: string; name: string | null; email: string };
}

type FilterStatus = "all" | "reportado" | "en_progreso" | "resuelto";

export default function Incidents() {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterStatus>("all");

  // Modal de reporte nuevo
  const [modalVisible, setModalVisible] = useState(false);
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Modal de detalle y resolución
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [resolutionInput, setResolutionInput] = useState("");
  const [isResolving, setIsResolving] = useState(false);
  const [updating, setUpdating] = useState(false);

  const fetchIncidents = async () => {
    try {
      const params: Record<string, unknown> = { page: 1, limit: 50 };
      if (activeFilter !== "all") {
        params.status = activeFilter;
      }
      const { data } = await api.get<{ data: Incident[]; total: number }>("/incidents", { params });
      setIncidents(data.data);
    } catch {
      Alert.alert("Error", "No se pudieron cargar los incidentes");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, [activeFilter]);

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
      fetchIncidents();
      Alert.alert("Éxito", "El reporte de incidente ha sido registrado correctamente.");
    } catch {
      Alert.alert("Error", "No se pudo reportar el incidente");
    } finally {
      setSubmitting(false);
    }
  };

  const updateIncidentStatus = async (
    incidentId: string,
    newStatus: "en_progreso" | "resuelto" | "cancelado",
    notes?: string
  ) => {
    setUpdating(true);
    try {
      const { data: updated } = await api.patch<Incident>(`/incidents/${incidentId}`, {
        status: newStatus,
        resolutionNotes: notes || undefined,
      });

      setIncidents((prev) => prev.map((inc) => (inc.id === updated.id ? updated : inc)));
      setSelectedIncident(updated);
      setIsResolving(false);
      setResolutionInput("");
      setDetailModalVisible(false);

      const statusLabels: Record<string, string> = {
        en_progreso: "en atención",
        resuelto: "marcado como resuelto",
        cancelado: "cancelado",
      };
      Alert.alert("Actualizado", `El incidente ha sido ${statusLabels[newStatus] || newStatus}.`);
    } catch {
      Alert.alert("Error", "No se pudo actualizar el estado del incidente");
    } finally {
      setUpdating(false);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "reportado":
        return {
          color: Theme.colors.tertiary,
          bg: Theme.colors.tertiaryContainer,
          label: "Reportado",
          icon: "alert-circle",
        };
      case "en_progreso":
        return {
          color: Theme.colors.primaryLight,
          bg: "rgba(59, 130, 246, 0.15)",
          label: "En Atención",
          icon: "construct",
        };
      case "resuelto":
        return {
          color: Theme.colors.secondary,
          bg: Theme.colors.secondaryContainer,
          label: "Resuelto",
          icon: "checkmark-circle",
        };
      case "cancelado":
        return {
          color: Theme.colors.textMuted,
          bg: Theme.colors.surfaceContainerHigh,
          label: "Cancelado",
          icon: "close-circle",
        };
      default:
        return {
          color: Theme.colors.textSecondary,
          bg: Theme.colors.surfaceContainerHigh,
          label: status,
          icon: "help-circle",
        };
    }
  };

  const isStaff = user?.role === "admin_residencial" || user?.role === "guardia";

  if (loading && incidents.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Botón reportar incidente */}
      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="add-circle" size={18} color={Theme.colors.onPrimary} style={{ marginRight: 6 }} />
        <Text style={styles.addBtnText}>Reportar Incidente</Text>
      </TouchableOpacity>

      {/* Selector de filtros */}
      <View style={styles.filterContainer}>
        {(
          [
            { id: "all", label: "Todos", icon: "apps-outline" },
            { id: "reportado", label: "Reportados", icon: "alert-circle-outline" },
            { id: "en_progreso", label: "En Atención", icon: "hammer-outline" },
            { id: "resuelto", label: "Resueltos", icon: "checkmark-circle-outline" },
          ] as const
        ).map((tab) => {
          const isActive = activeFilter === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => setActiveFilter(tab.id)}
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

      {/* Lista de incidentes */}
      <FlatList
        data={incidents}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={Theme.colors.primary}
            onRefresh={() => {
              setRefreshing(true);
              fetchIncidents();
            }}
          />
        }
        renderItem={({ item }) => {
          const statusCfg = getStatusConfig(item.status);

          return (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => {
                setSelectedIncident(item);
                setIsResolving(false);
                setResolutionInput("");
                setDetailModalVisible(true);
              }}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.type}>{item.type}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
                  <Ionicons name={statusCfg.icon as any} size={12} color={statusCfg.color} style={{ marginRight: 4 }} />
                  <Text style={[styles.statusBadgeText, { color: statusCfg.color }]}>
                    {statusCfg.label}
                  </Text>
                </View>
              </View>

              <Text style={styles.desc} numberOfLines={2}>
                {item.description}
              </Text>

              {item.location ? (
                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={13} color={Theme.colors.primaryLight} />
                  <Text style={styles.locationText}>{item.location}</Text>
                </View>
              ) : null}

              {item.status === "resuelto" && item.resolutionNotes ? (
                <View style={styles.resolvedSnippet}>
                  <View style={styles.resolvedSnippetHeader}>
                    <Ionicons name="shield-checkmark" size={13} color={Theme.colors.secondary} />
                    <Text style={styles.resolvedSnippetTitle}>Solución Aplicada:</Text>
                  </View>
                  <Text style={styles.resolvedSnippetText} numberOfLines={2}>
                    {item.resolutionNotes}
                  </Text>
                </View>
              ) : null}

              <View style={styles.cardFooter}>
                <View style={styles.reporterMeta}>
                  <Ionicons name="person-circle-outline" size={14} color={Theme.colors.textMuted} />
                  <Text style={styles.meta}>
                    {item.reportedBy?.name || item.reportedBy?.email} •{" "}
                    {new Date(item.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.detailLink}>
                  <Text style={styles.viewDetailText}>Detalles</Text>
                  <Ionicons name="chevron-forward" size={12} color={Theme.colors.primaryLight} />
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="folder-open-outline" size={36} color={Theme.colors.textMuted} />
            <Text style={styles.emptyText}>No hay incidentes registrados en esta categoría.</Text>
          </View>
        }
      />

      {/* Modal Reportar Incidente */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Ionicons name="warning-outline" size={22} color={Theme.colors.tertiary} />
              <Text style={styles.modalTitle}>Reportar Incidente</Text>
            </View>

            <Text style={styles.inputLabel}>TIPO DE INCIDENCIA:</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej. Luminaria dañada, Fuga de agua, Ruido"
              placeholderTextColor={Theme.colors.textMuted}
              value={type}
              onChangeText={setType}
            />

            <Text style={styles.inputLabel}>DESCRIPCIÓN DEL SUCESO:</Text>
            <TextInput
              style={[styles.input, styles.inputArea]}
              placeholder="Describe lo sucedido o el daño observado..."
              placeholderTextColor={Theme.colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
            />

            <Text style={styles.inputLabel}>UBICACIÓN ESPECÍFICA:</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej. Torre A, Piso 2 o Pasillo Central"
              placeholderTextColor={Theme.colors.textMuted}
              value={location}
              onChangeText={setLocation}
            />

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={reportIncident}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color={Theme.colors.onPrimary} />
              ) : (
                <View style={styles.btnContent}>
                  <Ionicons name="send" size={16} color={Theme.colors.onPrimary} style={{ marginRight: 6 }} />
                  <Text style={styles.submitBtnText}>Enviar Reporte</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Detalle y Resolución de Incidente */}
      <Modal visible={detailModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.detailModalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedIncident && (
                <>
                  <View style={styles.detailHeaderRow}>
                    <Text style={styles.detailTitle}>{selectedIncident.type}</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: getStatusConfig(selectedIncident.status).bg,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          { color: getStatusConfig(selectedIncident.status).color },
                        ]}
                      >
                        {getStatusConfig(selectedIncident.status).label}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.detailDate}>
                    Reportado: {new Date(selectedIncident.createdAt).toLocaleString()} por{" "}
                    {selectedIncident.reportedBy?.name || selectedIncident.reportedBy?.email}
                  </Text>

                  {selectedIncident.location ? (
                    <View style={styles.detailLocationRow}>
                      <Ionicons name="location-outline" size={14} color={Theme.colors.primaryLight} />
                      <Text style={styles.detailLocation}>{selectedIncident.location}</Text>
                    </View>
                  ) : null}

                  <Text style={styles.sectionHeading}>DESCRIPCIÓN DEL INCIDENTE</Text>
                  <View style={styles.detailBox}>
                    <Text style={styles.detailDesc}>{selectedIncident.description}</Text>
                  </View>

                  {/* Sección de resolución si ya está resuelto */}
                  {selectedIncident.status === "resuelto" && (
                    <View style={styles.resolutionContainer}>
                      <View style={styles.resolutionHeaderRow}>
                        <Ionicons name="checkmark-circle" size={18} color={Theme.colors.secondary} />
                        <Text style={styles.resolutionHeader}>Solución Aplicada</Text>
                      </View>
                      <Text style={styles.resolutionBody}>
                        {selectedIncident.resolutionNotes || "Sin notas adicionales."}
                      </Text>
                      {selectedIncident.resolvedAt ? (
                        <Text style={styles.resolutionDate}>
                          Fecha de resolución: {new Date(selectedIncident.resolvedAt).toLocaleString()}
                        </Text>
                      ) : null}
                    </View>
                  )}

                  {/* Formulario para escribir la solución */}
                  {isResolving && (
                    <View style={styles.resolvingForm}>
                      <Text style={styles.sectionHeading}>MEDIDAS TOMADAS / SOLUCIÓN:</Text>
                      <TextInput
                        style={[styles.input, styles.inputArea]}
                        placeholder="Describe cómo se resolvió (ej. Se reemplazó el foco y se verificó la conexión)..."
                        placeholderTextColor={Theme.colors.textMuted}
                        value={resolutionInput}
                        onChangeText={setResolutionInput}
                        multiline
                      />
                      <TouchableOpacity
                        style={styles.confirmResolveBtn}
                        onPress={() =>
                          updateIncidentStatus(selectedIncident.id, "resuelto", resolutionInput.trim())
                        }
                        disabled={updating}
                        activeOpacity={0.85}
                      >
                        {updating ? (
                          <ActivityIndicator color={Theme.colors.onSecondary} />
                        ) : (
                          <View style={styles.btnContent}>
                            <Ionicons name="checkmark-done" size={16} color={Theme.colors.onSecondary} style={{ marginRight: 6 }} />
                            <Text style={styles.confirmResolveBtnText}>Confirmar Resolución</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Acciones de gestión de estado */}
                  {!isResolving && selectedIncident.status !== "resuelto" && selectedIncident.status !== "cancelado" && (
                    <View style={styles.actionsBox}>
                      <Text style={styles.sectionHeading}>GESTIÓN DE ESTADO</Text>

                      {/* Pasar a en_progreso */}
                      {isStaff && selectedIncident.status === "reportado" && (
                        <TouchableOpacity
                          style={styles.attendBtn}
                          onPress={() => updateIncidentStatus(selectedIncident.id, "en_progreso")}
                          disabled={updating}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="construct-outline" size={16} color={Theme.colors.onPrimary} style={{ marginRight: 6 }} />
                          <Text style={styles.attendBtnText}>Poner en Atención</Text>
                        </TouchableOpacity>
                      )}

                      {/* Abrir formulario para resolver */}
                      {(isStaff || selectedIncident.reportedBy?.id === user?.id) && (
                        <TouchableOpacity
                          style={styles.resolveBtn}
                          onPress={() => setIsResolving(true)}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="checkmark-circle-outline" size={16} color={Theme.colors.onSecondary} style={{ marginRight: 6 }} />
                          <Text style={styles.resolveBtnText}>Marcar como Resuelto</Text>
                        </TouchableOpacity>
                      )}

                      {/* Cancelar incidente */}
                      {(isStaff || selectedIncident.reportedBy?.id === user?.id) && (
                        <TouchableOpacity
                          style={styles.cancelIncidentBtn}
                          onPress={() => {
                            Alert.alert(
                              "Cancelar Incidente",
                              "¿Estás seguro de que deseas cancelar o descartar este incidente?",
                              [
                                { text: "No", style: "cancel" },
                                {
                                  text: "Sí, Cancelar",
                                  style: "destructive",
                                  onPress: () =>
                                    updateIncidentStatus(
                                      selectedIncident.id,
                                      "cancelado",
                                      "Incidente cancelado por el usuario"
                                    ),
                                },
                              ]
                            );
                          }}
                          disabled={updating}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="close-circle-outline" size={15} color={Theme.colors.errorLight} style={{ marginRight: 4 }} />
                          <Text style={styles.cancelIncidentBtnText}>Descartar Incidente</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.closeDetailBtn}
                    onPress={() => setDetailModalVisible(false)}
                  >
                    <Text style={styles.closeDetailBtnText}>Cerrar</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
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
  btnContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
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
  filterContainer: {
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
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  type: {
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
    borderRadius: Theme.borderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  desc: {
    color: Theme.colors.textSecondary,
    fontSize: 13,
    marginBottom: 8,
    lineHeight: 18,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  locationText: {
    color: Theme.colors.primaryLight,
    fontSize: 12,
    fontWeight: "500",
  },
  resolvedSnippet: {
    backgroundColor: Theme.colors.secondaryContainer,
    borderRadius: Theme.borderRadius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
    marginBottom: 8,
  },
  resolvedSnippetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  resolvedSnippetTitle: {
    color: Theme.colors.secondaryLight,
    fontSize: 11,
    fontWeight: "700",
  },
  resolvedSnippetText: {
    color: Theme.colors.textPrimary,
    fontSize: 12,
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    paddingTop: Theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
  },
  reporterMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  meta: {
    fontSize: 11,
    color: Theme.colors.textMuted,
  },
  detailLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  viewDetailText: {
    color: Theme.colors.primaryLight,
    fontSize: 12,
    fontWeight: "600",
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
    gap: 10,
  },
  emptyText: {
    color: Theme.colors.textMuted,
    fontSize: 13,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(1, 15, 31, 0.8)",
    justifyContent: "center",
    padding: Theme.spacing.lg,
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
  inputArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  submitBtn: {
    backgroundColor: Theme.colors.primary,
    paddingVertical: 13,
    borderRadius: Theme.borderRadius.md,
    alignItems: "center",
    marginTop: 4,
  },
  submitBtnText: {
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
  detailModalContent: {
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderRadius: Theme.borderRadius.xl,
    padding: Theme.spacing.xl,
    maxHeight: "85%",
    borderWidth: 1,
    borderColor: Theme.colors.borderMedium,
  },
  detailHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  detailTitle: {
    fontSize: 19,
    color: Theme.colors.textPrimary,
    fontWeight: "700",
    flex: 1,
    marginRight: 8,
  },
  detailDate: {
    color: Theme.colors.textMuted,
    fontSize: 12,
    marginBottom: 6,
  },
  detailLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 10,
  },
  detailLocation: {
    color: Theme.colors.primaryLight,
    fontSize: 13,
    fontWeight: "600",
  },
  sectionHeading: {
    color: Theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 6,
  },
  detailBox: {
    backgroundColor: Theme.colors.surfaceContainerLow,
    borderRadius: Theme.borderRadius.md,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  detailDesc: {
    color: Theme.colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
  },
  resolutionContainer: {
    backgroundColor: Theme.colors.secondaryContainer,
    borderRadius: Theme.borderRadius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.4)",
    marginVertical: 8,
  },
  resolutionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  resolutionHeader: {
    color: Theme.colors.secondaryLight,
    fontSize: 14,
    fontWeight: "700",
  },
  resolutionBody: {
    color: Theme.colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
  },
  resolutionDate: {
    color: Theme.colors.textMuted,
    fontSize: 11,
    marginTop: 6,
  },
  actionsBox: {
    marginTop: 10,
    gap: 8,
  },
  attendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.colors.primary,
    padding: 12,
    borderRadius: Theme.borderRadius.md,
  },
  attendBtnText: {
    color: Theme.colors.onPrimary,
    fontWeight: "700",
    fontSize: 14,
  },
  resolveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.colors.secondary,
    padding: 12,
    borderRadius: Theme.borderRadius.md,
  },
  resolveBtnText: {
    color: Theme.colors.onSecondary,
    fontWeight: "700",
    fontSize: 14,
  },
  cancelIncidentBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
  },
  cancelIncidentBtnText: {
    color: Theme.colors.errorLight,
    fontSize: 13,
    fontWeight: "600",
  },
  resolvingForm: {
    marginTop: 10,
  },
  confirmResolveBtn: {
    backgroundColor: Theme.colors.secondary,
    padding: 12,
    borderRadius: Theme.borderRadius.md,
    alignItems: "center",
    marginTop: 4,
  },
  confirmResolveBtnText: {
    color: Theme.colors.onSecondary,
    fontWeight: "700",
    fontSize: 14,
  },
  closeDetailBtn: {
    marginTop: 16,
    alignItems: "center",
    padding: 8,
  },
  closeDetailBtnText: {
    color: Theme.colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
});
