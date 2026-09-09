import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
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
import { useAuth } from "../../context/AuthContext";
import { Theme } from "../../constants/theme";

interface ResidencialItem {
  id: string;
  nombre: string;
  direccion?: string | null;
  status: "activa" | "inactiva" | "suspendida";
  statusReason?: string | null;
  maxDoors: number;
  planType: "basic" | "pro" | "enterprise";
  monthlyFee: number;
  billingCycleDay: number;
  billingStatus: "al_dia" | "vencido" | "gracia";
  billingNotes?: string | null;
  hardwareGatewayId?: string | null;
  hardwareApiKey?: string | null;
  hardwareBrokerUrl?: string | null;
  hardwareStatus: "online" | "offline" | "unconfigured";
  lastHardwarePing?: string | null;
  doors: DoorItem[];
  users?: { id: string; name: string; email: string }[];
  _count: {
    doors: number;
    units: number;
    users: number;
    incidents: number;
  };
}

interface DoorItem {
  id: string;
  name: string;
  doorType: string;
  relayChannel?: string | null;
  controllerId?: string | null;
  openPulseMs?: number;
  cameraRtspUrl?: string | null;
}

interface AdminItem {
  id: string;
  email: string;
  name: string | null;
  role: string;
  residencialId: string | null;
  residencial?: { id: string; nombre: string; status: string } | null;
  createdAt: string;
}

interface Metrics {
  totalResidenciales: number;
  activeResidenciales: number;
  inactiveResidenciales: number;
  totalAdmins: number;
  totalDoors: number;
  onlineHardware: number;
  projectedMRR: number;
}

export default function SuperAdmin() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [residenciales, setResidenciales] = useState<ResidencialItem[]>([]);
  const [admins, setAdmins] = useState<AdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSection, setActiveSection] = useState<"residenciales" | "admins">("residenciales");

  // Modal Nueva / Editar Residencia
  const [resModalVisible, setResModalVisible] = useState(false);
  const [editingRes, setEditingRes] = useState<ResidencialItem | null>(null);
  const [resTab, setResTab] = useState<"general" | "puertas" | "hardware" | "cargos">("general");

  // Campos formulario Residencia
  const [formNombre, setFormNombre] = useState("");
  const [formDireccion, setFormDireccion] = useState("");
  const [formMaxDoors, setFormMaxDoors] = useState("4");
  const [formPlanType, setFormPlanType] = useState<"basic" | "pro" | "enterprise">("pro");
  const [formMonthlyFee, setFormMonthlyFee] = useState("1500");
  const [formBillingCycleDay, setFormBillingCycleDay] = useState("1");
  const [formBillingStatus, setFormBillingStatus] = useState<"al_dia" | "vencido" | "gracia">("al_dia");
  const [formBillingNotes, setFormBillingNotes] = useState("");
  const [formGatewayId, setFormGatewayId] = useState("");
  const [formBrokerUrl, setFormBrokerUrl] = useState("mqtts://iot.residia.io:8883");
  const [savingRes, setSavingRes] = useState(false);

  // Modal Agregar Puerta Física
  const [doorModalVisible, setDoorModalVisible] = useState(false);
  const [doorName, setDoorName] = useState("");
  const [doorType, setDoorType] = useState<"principal" | "peatonal" | "vehicular" | "servicio">("principal");
  const [doorRelay, setDoorRelay] = useState("Relay 1");
  const [doorPulseMs, setDoorPulseMs] = useState("1500");
  const [doorControllerId, setDoorControllerId] = useState("CTRL-01");
  const [doorRtsp, setDoorRtsp] = useState("");
  const [savingDoor, setSavingDoor] = useState(false);

  // Modal Nuevo Admin Residencial
  const [adminModalVisible, setAdminModalVisible] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminResId, setAdminResId] = useState("");
  const [savingAdmin, setSavingAdmin] = useState(false);

  // Modal Motivo Desactivación / Suspensión
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [targetResId, setTargetResId] = useState<string | null>(null);
  const [targetStatus, setTargetStatus] = useState<"activa" | "inactiva" | "suspendida">("inactiva");
  const [statusReasonInput, setStatusReasonInput] = useState("");

  const fetchData = async () => {
    try {
      const [resMetrics, resResidenciales, resAdmins] = await Promise.all([
        api.get<Metrics>("/superadmin/metrics"),
        api.get<ResidencialItem[]>("/superadmin/residenciales"),
        api.get<AdminItem[]>("/superadmin/admins"),
      ]);
      setMetrics(resMetrics.data);
      setResidenciales(resResidenciales.data);
      setAdmins(resAdmins.data);
    } catch {
      Alert.alert("Error", "No se pudieron sincronizar los datos de Super Admin");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openNewResModal = () => {
    setEditingRes(null);
    setFormNombre("");
    setFormDireccion("");
    setFormMaxDoors("4");
    setFormPlanType("pro");
    setFormMonthlyFee("1500");
    setFormBillingCycleDay("1");
    setFormBillingStatus("al_dia");
    setFormBillingNotes("");
    setFormGatewayId("");
    setFormBrokerUrl("mqtts://iot.residia.io:8883");
    setResTab("general");
    setResModalVisible(true);
  };

  const openEditResModal = (item: ResidencialItem) => {
    setEditingRes(item);
    setFormNombre(item.nombre);
    setFormDireccion(item.direccion || "");
    setFormMaxDoors(item.maxDoors.toString());
    setFormPlanType(item.planType);
    setFormMonthlyFee(item.monthlyFee.toString());
    setFormBillingCycleDay(item.billingCycleDay.toString());
    setFormBillingStatus(item.billingStatus);
    setFormBillingNotes(item.billingNotes || "");
    setFormGatewayId(item.hardwareGatewayId || "");
    setFormBrokerUrl(item.hardwareBrokerUrl || "mqtts://iot.residia.io:8883");
    setResTab("general");
    setResModalVisible(true);
  };

  const saveResidencial = async () => {
    if (!formNombre.trim()) {
      Alert.alert("Error", "El nombre del fraccionamiento es requerido");
      return;
    }
    setSavingRes(true);
    try {
      const payload = {
        nombre: formNombre.trim(),
        direccion: formDireccion.trim() || undefined,
        maxDoors: parseInt(formMaxDoors, 10) || 4,
        planType: formPlanType,
        monthlyFee: parseFloat(formMonthlyFee) || 0,
        billingCycleDay: parseInt(formBillingCycleDay, 10) || 1,
        billingStatus: formBillingStatus,
        billingNotes: formBillingNotes.trim() || undefined,
        hardwareGatewayId: formGatewayId.trim() || undefined,
        hardwareBrokerUrl: formBrokerUrl.trim() || undefined,
      };

      if (editingRes) {
        await api.put(`/superadmin/residenciales/${editingRes.id}`, payload);
        Alert.alert("✅ Actualizado", `Residencia ${formNombre} guardada con éxito.`);
      } else {
        await api.post("/superadmin/residenciales", payload);
        Alert.alert("🎉 Creada", `Nueva residencia ${formNombre} dada de alta con sus puertas base.`);
      }

      setResModalVisible(false);
      fetchData();
    } catch (err: unknown) {
      const res = err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
        : null;
      Alert.alert("Error", res || "No se pudo guardar la residencia");
    } finally {
      setSavingRes(false);
    }
  };

  const confirmToggleStatus = (resId: string, currentStatus: string) => {
    setTargetResId(resId);
    if (currentStatus === "activa") {
      setTargetStatus("inactiva");
      setStatusReasonInput("Suspensión administrativa preventiva o corte de servicio.");
      setStatusModalVisible(true);
    } else {
      // Reactivar directamente
      Alert.alert(
        "Reactivar Residencia",
        "¿Deseas restaurar todas las operaciones (aperturas, pases de visita y accesos) para este residencial?",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Reactivar",
            onPress: async () => {
              try {
                await api.patch(`/superadmin/residenciales/${resId}/status`, {
                  status: "activa",
                  statusReason: null,
                });
                fetchData();
                Alert.alert("✅ Operativo", "El residencial ha sido reactivado.");
              } catch {
                Alert.alert("Error", "No se pudo reactivar el residencial");
              }
            },
          },
        ]
      );
    }
  };

  const executeStatusChange = async () => {
    if (!targetResId) return;
    try {
      await api.patch(`/superadmin/residenciales/${targetResId}/status`, {
        status: targetStatus,
        statusReason: statusReasonInput.trim() || "Corte de servicio administrativo",
      });
      setStatusModalVisible(false);
      fetchData();
      Alert.alert(
        "Residencial Desactivado",
        "Los usuarios y guardias tendrán bloqueadas las aperturas y pases hasta nuevo aviso."
      );
    } catch {
      Alert.alert("Error", "No se pudo actualizar el estado");
    }
  };

  const handlePingHardware = async (resId: string, resNombre: string) => {
    try {
      const { data } = await api.post(`/superadmin/residenciales/${resId}/hardware/ping`);
      Alert.alert(
        `📡 Test IoT OK: ${resNombre}`,
        `${data.message}\n\n• Gateway: ${data.gatewayId}\n• Latencia: ${data.latencyMs}ms\n• Estado: ${data.status.toUpperCase()}`
      );
      fetchData();
    } catch {
      Alert.alert("Falla de Conexión", "El concentrador IoT no respondió al ping.");
    }
  };

  const handleRegenerateKey = async (resId: string) => {
    Alert.alert(
      "Regenerar Hardware API Key",
      "Esto invalidará la llave actual en el dispositivo de caseta hasta que se cargue la nueva. ¿Continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Regenerar",
          style: "destructive",
          onPress: async () => {
            try {
              const { data } = await api.post(`/superadmin/residenciales/${resId}/hardware/regenerate-key`);
              Alert.alert("🔑 Nueva Clave", `Nueva Hardware API Key:\n\n${data.hardwareApiKey}`);
              fetchData();
            } catch {
              Alert.alert("Error", "No se pudo regenerar la clave de hardware");
            }
          },
        },
      ]
    );
  };

  const addDoorToResidencial = async () => {
    if (!editingRes) return;
    if (!doorName.trim()) {
      Alert.alert("Error", "Ingresa el nombre de la puerta o entrada");
      return;
    }
    setSavingDoor(true);
    try {
      await api.post(`/superadmin/residenciales/${editingRes.id}/doors`, {
        name: doorName.trim(),
        doorType,
        relayChannel: doorRelay.trim() || "Relay 1",
        controllerId: doorControllerId.trim() || "CTRL-01",
        openPulseMs: parseInt(doorPulseMs, 10) || 1500,
        cameraRtspUrl: doorRtsp.trim() || undefined,
      });

      // Refrescar residencia actual
      const { data } = await api.get<ResidencialItem>(`/superadmin/residenciales/${editingRes.id}`);
      setEditingRes(data);
      setDoorModalVisible(false);
      setDoorName("");
      setDoorPulseMs("1500");
      setDoorRtsp("");
      fetchData();
      Alert.alert("✅ Entrada Registrada", "La puerta física ha sido configurada con sus actuadores.");
    } catch (err: unknown) {
      const res = err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
        : null;
      Alert.alert("Error al agregar puerta", res || "No se pudo agregar la entrada");
    } finally {
      setSavingDoor(false);
    }
  };

  const deleteDoor = (doorId: string, doorTitle: string) => {
    Alert.alert("Eliminar Puerta", `¿Deseas desvincular la entrada "${doorTitle}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/superadmin/doors/${doorId}`);
            if (editingRes) {
              const { data } = await api.get<ResidencialItem>(`/superadmin/residenciales/${editingRes.id}`);
              setEditingRes(data);
            }
            fetchData();
          } catch {
            Alert.alert("Error", "No se pudo eliminar la puerta");
          }
        },
      },
    ]);
  };

  const saveAdminUser = async () => {
    if (!adminName.trim() || !adminEmail.trim() || !adminPassword.trim() || !adminResId) {
      Alert.alert("Error", "Todos los campos y la selección de fraccionamiento son requeridos");
      return;
    }
    setSavingAdmin(true);
    try {
      await api.post("/superadmin/admins", {
        name: adminName.trim(),
        email: adminEmail.trim(),
        password: adminPassword,
        residencialId: adminResId,
      });

      setAdminModalVisible(false);
      setAdminName("");
      setAdminEmail("");
      setAdminPassword("");
      setAdminResId("");
      fetchData();
      Alert.alert("✅ Administrador Creado", "El usuario ha sido registrado y vinculado a su fraccionamiento.");
    } catch (err: unknown) {
      const res = err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
        : null;
      Alert.alert("Error", res || "No se pudo registrar el administrador");
    } finally {
      setSavingAdmin(false);
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
      {/* Header Maestro de Super Usuario */}
      <View style={styles.masterHeader}>
        <View style={styles.masterBadgeRow}>
          <View style={styles.crownBadge}>
            <Ionicons name="shield-half" size={16} color="#F59E0B" />
          </View>
          <Text style={styles.masterBadgeText}>SUPER USUARIO • RESIDIA PLATFORM</Text>
        </View>
        <Text style={styles.masterTitle}>Panel de Control Global</Text>
        <Text style={styles.masterSubtitle}>
          Administración centralizada de residencias, hardware IoT, cargos y accesos.
        </Text>
      </View>

      {/* KPI Cards Ejecutivas */}
      {metrics && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.kpiScroll}>
          <View style={styles.kpiCard}>
            <View style={styles.kpiIconWrapper}>
              <Ionicons name="business" size={18} color={Theme.colors.primaryLight} />
            </View>
            <Text style={styles.kpiValue}>
              {metrics.activeResidenciales} / {metrics.totalResidenciales}
            </Text>
            <Text style={styles.kpiLabel}>Fraccionamientos Activos</Text>
          </View>

          <View style={styles.kpiCard}>
            <View style={[styles.kpiIconWrapper, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
              <Ionicons name="hardware-chip" size={18} color={Theme.colors.secondary} />
            </View>
            <Text style={styles.kpiValue}>{metrics.onlineHardware} Online</Text>
            <Text style={styles.kpiLabel}>Gateways IoT Enlazados</Text>
          </View>

          <View style={styles.kpiCard}>
            <View style={[styles.kpiIconWrapper, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
              <Ionicons name="key" size={18} color="#F59E0B" />
            </View>
            <Text style={styles.kpiValue}>{metrics.totalDoors}</Text>
            <Text style={styles.kpiLabel}>Puertas / Entradas Físicas</Text>
          </View>

          <View style={styles.kpiCard}>
            <View style={[styles.kpiIconWrapper, { backgroundColor: "rgba(59, 130, 246, 0.15)" }]}>
              <Ionicons name="cash" size={18} color={Theme.colors.primaryLight} />
            </View>
            <Text style={styles.kpiValue}>
              ${metrics.projectedMRR.toLocaleString("es-MX")} MXN
            </Text>
            <Text style={styles.kpiLabel}>MRR Ingresos Recurrentes</Text>
          </View>
        </ScrollView>
      )}

      {/* Switcher de Secciones: Residencias vs Administradores */}
      <View style={styles.sectionSwitcher}>
        <TouchableOpacity
          style={[styles.switchBtn, activeSection === "residenciales" && styles.switchBtnActive]}
          onPress={() => setActiveSection("residenciales")}
          activeOpacity={0.8}
        >
          <Ionicons
            name="business"
            size={16}
            color={activeSection === "residenciales" ? Theme.colors.onPrimary : Theme.colors.textMuted}
            style={{ marginRight: 6 }}
          />
          <Text
            style={
              activeSection === "residenciales" ? styles.switchBtnTextActive : styles.switchBtnText
            }
          >
            Residencias ({residenciales.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.switchBtn, activeSection === "admins" && styles.switchBtnActive]}
          onPress={() => setActiveSection("admins")}
          activeOpacity={0.8}
        >
          <Ionicons
            name="people"
            size={16}
            color={activeSection === "admins" ? Theme.colors.onPrimary : Theme.colors.textMuted}
            style={{ marginRight: 6 }}
          />
          <Text style={activeSection === "admins" ? styles.switchBtnTextActive : styles.switchBtnText}>
            Administradores ({admins.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* CONTENIDO SECCIÓN 1: RESIDENCIALES */}
      {activeSection === "residenciales" && (
        <ScrollView
          style={{ flex: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={Theme.colors.primary}
              onRefresh={() => {
                setRefreshing(true);
                fetchData();
              }}
            />
          }
        >
          <View style={styles.subHeaderRow}>
            <Text style={styles.subHeaderTitle}>Fraccionamientos Conectados</Text>
            <TouchableOpacity style={styles.actionAddBtn} onPress={openNewResModal} activeOpacity={0.85}>
              <Ionicons name="add-circle" size={16} color={Theme.colors.onPrimary} style={{ marginRight: 4 }} />
              <Text style={styles.actionAddBtnText}>Nueva Residencia</Text>
            </TouchableOpacity>
          </View>

          {residenciales.map((item) => {
            const isActiva = item.status === "activa";
            const isOnline = item.hardwareStatus === "online";

            return (
              <View key={item.id} style={[styles.resCard, !isActiva && styles.resCardInactive]}>
                {/* Header de la tarjeta */}
                <View style={styles.resCardHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.resTitleRow}>
                      <Text style={styles.resTitle}>{item.nombre}</Text>
                      <View
                        style={[
                          styles.statusBadge,
                          isActiva ? styles.statusBadgeActive : styles.statusBadgeInactive,
                        ]}
                      >
                        <View
                          style={[
                            styles.statusDot,
                            { backgroundColor: isActiva ? Theme.colors.secondary : Theme.colors.errorLight },
                          ]}
                        />
                        <Text
                          style={[
                            styles.statusBadgeText,
                            { color: isActiva ? Theme.colors.secondary : Theme.colors.errorLight },
                          ]}
                        >
                          {item.status.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    {item.direccion ? <Text style={styles.resAddress}>{item.direccion}</Text> : null}
                    {!isActiva && item.statusReason ? (
                      <View style={styles.reasonNotice}>
                        <Ionicons name="alert-circle" size={13} color={Theme.colors.errorLight} />
                        <Text style={styles.reasonNoticeText}>{item.statusReason}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                <View style={styles.resDivider} />

                {/* Métricas y Hardware */}
                <View style={styles.resSpecsGrid}>
                  <View style={styles.specItem}>
                    <Text style={styles.specLabel}>PUERTAS ENTRADA</Text>
                    <Text style={styles.specValue}>
                      {item.doors?.length || item._count.doors} / {item.maxDoors} máx
                    </Text>
                  </View>

                  <View style={styles.specItem}>
                    <Text style={styles.specLabel}>PLAN & CUOTA</Text>
                    <Text style={styles.specValue}>
                      {item.planType.toUpperCase()} • ${item.monthlyFee.toLocaleString("es-MX")}
                    </Text>
                  </View>

                  <View style={styles.specItem}>
                    <Text style={styles.specLabel}>HARDWARE GATEWAY</Text>
                    <View style={styles.hwStatusRow}>
                      <View
                        style={[
                          styles.hwDot,
                          { backgroundColor: isOnline ? Theme.colors.secondary : "#F59E0B" },
                        ]}
                      />
                      <Text style={styles.specValue}>{item.hardwareGatewayId || "No asignado"}</Text>
                    </View>
                  </View>

                  <View style={styles.specItem}>
                    <Text style={styles.specLabel}>ESTADO DE CUENTA</Text>
                    <Text
                      style={[
                        styles.specValue,
                        { color: item.billingStatus === "al_dia" ? Theme.colors.secondary : Theme.colors.errorLight },
                      ]}
                    >
                      {item.billingStatus.toUpperCase().replace("_", " ")}
                    </Text>
                  </View>
                </View>

                {/* Botones de Operación */}
                <View style={styles.resActionsRow}>
                  <TouchableOpacity
                    style={styles.btnConfigure}
                    onPress={() => openEditResModal(item)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="settings-outline" size={14} color={Theme.colors.primaryLight} style={{ marginRight: 4 }} />
                    <Text style={styles.btnConfigureText}>Configurar & Hardware</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.btnPing}
                    onPress={() => handlePingHardware(item.id, item.nombre)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="pulse" size={14} color={Theme.colors.secondary} style={{ marginRight: 4 }} />
                    <Text style={styles.btnPingText}>Ping IoT</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.btnToggleStatus, isActiva ? styles.btnDeactivate : styles.btnActivate]}
                    onPress={() => confirmToggleStatus(item.id, item.status)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={isActiva ? "power" : "checkmark-circle"}
                      size={14}
                      color={isActiva ? Theme.colors.errorLight : Theme.colors.secondary}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={
                        isActiva ? styles.btnDeactivateText : styles.btnActivateText
                      }
                    >
                      {isActiva ? "Inactivar" : "Reactivar"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* CONTENIDO SECCIÓN 2: ADMINISTRADORES RESIDENCIALES */}
      {activeSection === "admins" && (
        <ScrollView
          style={{ flex: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={Theme.colors.primary}
              onRefresh={() => {
                setRefreshing(true);
                fetchData();
              }}
            />
          }
        >
          <View style={styles.subHeaderRow}>
            <Text style={styles.subHeaderTitle}>Directorio de Administradores</Text>
            <TouchableOpacity
              style={styles.actionAddBtn}
              onPress={() => {
                if (residenciales.length) setAdminResId(residenciales[0].id);
                setAdminModalVisible(true);
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="person-add" size={16} color={Theme.colors.onPrimary} style={{ marginRight: 4 }} />
              <Text style={styles.actionAddBtnText}>Alta Administrador</Text>
            </TouchableOpacity>
          </View>

          {admins.map((adm) => (
            <View key={adm.id} style={styles.adminCard}>
              <View style={styles.adminAvatar}>
                <Ionicons name="person" size={20} color={Theme.colors.primaryLight} />
              </View>
              <View style={styles.adminInfo}>
                <Text style={styles.adminName}>{adm.name || "Administrador Residencial"}</Text>
                <Text style={styles.adminEmail}>{adm.email}</Text>
                <View style={styles.adminResRow}>
                  <Ionicons name="business-outline" size={13} color={Theme.colors.textMuted} />
                  <Text style={styles.adminResText}>
                    {adm.residencial?.nombre || "Sin residencial asignado"}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* ======================================================== */}
      {/* MODAL CONFIGURADOR INTEGRAL DE RESIDENCIA (TABS)         */}
      {/* ======================================================== */}
      <Modal visible={resModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.largeModalContent}>
            {/* Header del Modal */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalHeading}>
                  {editingRes ? `Configurar: ${editingRes.nombre}` : "Nueva Residencia"}
                </Text>
                <Text style={styles.modalSubheading}>
                  Puertas físicas, credenciales IoT de hardware y cuotas mensuales.
                </Text>
              </View>
              <TouchableOpacity onPress={() => setResModalVisible(false)} style={styles.closeModalBtn}>
                <Ionicons name="close" size={20} color={Theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Tabs del Configurador */}
            <View style={styles.modalTabsBar}>
              <TouchableOpacity
                style={[styles.modalTabItem, resTab === "general" && styles.modalTabItemActive]}
                onPress={() => setResTab("general")}
              >
                <Text style={resTab === "general" ? styles.modalTabItemTextActive : styles.modalTabItemText}>
                  1. General
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalTabItem, resTab === "puertas" && styles.modalTabItemActive]}
                onPress={() => setResTab("puertas")}
              >
                <Text style={resTab === "puertas" ? styles.modalTabItemTextActive : styles.modalTabItemText}>
                  2. Entradas & Puertas ({editingRes?.doors?.length || 0})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalTabItem, resTab === "hardware" && styles.modalTabItemActive]}
                onPress={() => setResTab("hardware")}
              >
                <Text style={resTab === "hardware" ? styles.modalTabItemTextActive : styles.modalTabItemText}>
                  3. Hardware IoT
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalTabItem, resTab === "cargos" && styles.modalTabItemActive]}
                onPress={() => setResTab("cargos")}
              >
                <Text style={resTab === "cargos" ? styles.modalTabItemTextActive : styles.modalTabItemText}>
                  4. Cargos & Plan
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tab 1: General */}
            {resTab === "general" && (
              <ScrollView style={styles.tabScroll}>
                <Text style={styles.fieldLabel}>NOMBRE DEL FRACCIONAMIENTO / EDIFICIO:</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Ej. Residencial Las Palmas"
                  placeholderTextColor={Theme.colors.textMuted}
                  value={formNombre}
                  onChangeText={setFormNombre}
                />

                <Text style={styles.fieldLabel}>DIRECCIÓN COMPLETA:</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Ej. Av. De los Pinos 402, Col. Del Valle"
                  placeholderTextColor={Theme.colors.textMuted}
                  value={formDireccion}
                  onChangeText={setFormDireccion}
                />

                <Text style={styles.fieldLabel}>LÍMITE MÁXIMO DE ENTRADAS / PUERTAS AUTORIZADAS:</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Ej. 4"
                  placeholderTextColor={Theme.colors.textMuted}
                  value={formMaxDoors}
                  onChangeText={setFormMaxDoors}
                  keyboardType="number-pad"
                />
              </ScrollView>
            )}

            {/* Tab 2: Puertas & Actuadores Físicos */}
            {resTab === "puertas" && (
              <ScrollView style={styles.tabScroll}>
                <View style={styles.doorsTopHeader}>
                  <Text style={styles.doorsListNotice}>
                    Configura los puertos y canales de relé asignados en la controladora física.
                  </Text>
                  {editingRes && (
                    <TouchableOpacity
                      style={styles.addDoorBtn}
                      onPress={() => setDoorModalVisible(true)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="add" size={16} color={Theme.colors.onPrimary} style={{ marginRight: 4 }} />
                      <Text style={styles.addDoorBtnText}>Agregar Puerta</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {!editingRes && (
                  <View style={styles.noticeBox}>
                    <Ionicons name="information-circle" size={18} color={Theme.colors.primaryLight} />
                    <Text style={styles.noticeBoxText}>
                      Al crear la residencia se generarán automáticamente 2 entradas por defecto (Vehicular y Peatonal). Luego podrás personalizarlas aquí.
                    </Text>
                  </View>
                )}

                {editingRes?.doors?.map((d) => (
                  <View key={d.id} style={styles.doorItemCard}>
                    <View style={styles.doorIconBadge}>
                      <Ionicons name="key" size={18} color={Theme.colors.primaryLight} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.doorTitle}>{d.name}</Text>
                      <Text style={styles.doorMeta}>
                        Canal: <Text style={{ color: Theme.colors.secondary }}>{d.relayChannel || "Relay 1"}</Text> • Pulso: {d.openPulseMs || 1500}ms
                      </Text>
                      {d.cameraRtspUrl ? (
                        <Text style={styles.doorRtsp} numberOfLines={1}>
                          📹 RTSP: {d.cameraRtspUrl}
                        </Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      style={styles.delDoorBtn}
                      onPress={() => deleteDoor(d.id, d.name)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="trash-outline" size={16} color={Theme.colors.errorLight} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            {/* Tab 3: Hardware IoT */}
            {resTab === "hardware" && (
              <ScrollView style={styles.tabScroll}>
                <Text style={styles.fieldLabel}>GATEWAY ID (CONCENTRADOR EN CASETA):</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Ej. GW-PALMAS-01"
                  placeholderTextColor={Theme.colors.textMuted}
                  value={formGatewayId}
                  onChangeText={setFormGatewayId}
                />

                <Text style={styles.fieldLabel}>ENDPOINT BROKER MQTT / WEBSOCKET:</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="mqtts://iot.residia.io:8883"
                  placeholderTextColor={Theme.colors.textMuted}
                  value={formBrokerUrl}
                  onChangeText={setFormBrokerUrl}
                />

                {editingRes?.hardwareApiKey && (
                  <View style={styles.apiKeySection}>
                    <Text style={styles.fieldLabel}>HARDWARE API KEY CRIPTOGRÁFICA:</Text>
                    <View style={styles.apiKeyBox}>
                      <Text style={styles.apiKeyText}>{editingRes.hardwareApiKey}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.regenKeyBtn}
                      onPress={() => handleRegenerateKey(editingRes.id)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="refresh-circle" size={16} color="#F59E0B" style={{ marginRight: 6 }} />
                      <Text style={styles.regenKeyBtnText}>Regenerar Nueva Hardware Key</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            )}

            {/* Tab 4: Cargos & Facturación */}
            {resTab === "cargos" && (
              <ScrollView style={styles.tabScroll}>
                <Text style={styles.fieldLabel}>PLAN CONTRATADO:</Text>
                <View style={styles.planSelectorRow}>
                  {(["basic", "pro", "enterprise"] as const).map((p) => (
                    <TouchableOpacity
                      key={p}
                      style={[styles.planChip, formPlanType === p && styles.planChipActive]}
                      onPress={() => setFormPlanType(p)}
                      activeOpacity={0.8}
                    >
                      <Text style={formPlanType === p ? styles.planChipTextActive : styles.planChipText}>
                        {p.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>CUOTA MENSUAL DE SERVICIO (MXN):</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Ej. 2500"
                  placeholderTextColor={Theme.colors.textMuted}
                  value={formMonthlyFee}
                  onChangeText={setFormMonthlyFee}
                  keyboardType="numeric"
                />

                <Text style={styles.fieldLabel}>DÍA DE CORTE DE FACTURACIÓN (1 - 31):</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Ej. 1 o 15"
                  placeholderTextColor={Theme.colors.textMuted}
                  value={formBillingCycleDay}
                  onChangeText={setFormBillingCycleDay}
                  keyboardType="number-pad"
                />

                <Text style={styles.fieldLabel}>ESTADO DE PAGO / CUENTA:</Text>
                <View style={styles.planSelectorRow}>
                  {(["al_dia", "gracia", "vencido"] as const).map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.planChip, formBillingStatus === s && styles.planChipActive]}
                      onPress={() => setFormBillingStatus(s)}
                      activeOpacity={0.8}
                    >
                      <Text style={formBillingStatus === s ? styles.planChipTextActive : styles.planChipText}>
                        {s.toUpperCase().replace("_", " ")}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>NOTAS FISCALES / RFC / COBRANZA:</Text>
                <TextInput
                  style={[styles.textInput, { height: 70 }]}
                  multiline
                  placeholder="Razón social, RFC o acuerdos comerciales"
                  placeholderTextColor={Theme.colors.textMuted}
                  value={formBillingNotes}
                  onChangeText={setFormBillingNotes}
                />
              </ScrollView>
            )}

            {/* Footer de Guardado */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => setResModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelModalBtnText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.submitModalBtn}
                onPress={saveResidencial}
                disabled={savingRes}
                activeOpacity={0.85}
              >
                {savingRes ? (
                  <ActivityIndicator color={Theme.colors.onPrimary} size="small" />
                ) : (
                  <View style={styles.btnContent}>
                    <Ionicons name="checkmark-circle" size={18} color={Theme.colors.onPrimary} style={{ marginRight: 6 }} />
                    <Text style={styles.submitModalBtnText}>
                      {editingRes ? "Guardar Configuración" : "Dar de Alta Residencia"}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL AGREGAR PUERTA / ENTRADA FÍSICA                    */}
      {/* ======================================================== */}
      <Modal visible={doorModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.smallModalContent}>
            <Text style={styles.modalHeading}>Agregar Entrada Física</Text>
            <Text style={styles.modalSubheading}>
              Define el actuador y el puerto de relé en la controladora de caseta.
            </Text>

            <Text style={styles.fieldLabel}>NOMBRE DE LA PUERTA / BARRERA:</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Ej. Portón Oriente o Acceso Visitas"
              placeholderTextColor={Theme.colors.textMuted}
              value={doorName}
              onChangeText={setDoorName}
            />

            <Text style={styles.fieldLabel}>CANAL DE RELÉ / PUERTO ASIGNADO:</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Ej. Relay 1, GPIO 23, Canal B"
              placeholderTextColor={Theme.colors.textMuted}
              value={doorRelay}
              onChangeText={setDoorRelay}
            />

            <Text style={styles.fieldLabel}>DURACIÓN DEL PULSO DE APERTURA (MS):</Text>
            <TextInput
              style={styles.textInput}
              placeholder="1500"
              placeholderTextColor={Theme.colors.textMuted}
              value={doorPulseMs}
              onChangeText={setDoorPulseMs}
              keyboardType="number-pad"
            />

            <Text style={styles.fieldLabel}>URL DE CÁMARA RTSP / LPR (OPCIONAL):</Text>
            <TextInput
              style={styles.textInput}
              placeholder="rtsp://admin:pass@192.168.1.80:554/ch1"
              placeholderTextColor={Theme.colors.textMuted}
              value={doorRtsp}
              onChangeText={setDoorRtsp}
            />

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => setDoorModalVisible(false)}
              >
                <Text style={styles.cancelModalBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitModalBtn}
                onPress={addDoorToResidencial}
                disabled={savingDoor}
              >
                <Text style={styles.submitModalBtnText}>Guardar Entrada</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL ALTA DE ADMINISTRADOR RESIDENCIAL                  */}
      {/* ======================================================== */}
      <Modal visible={adminModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.smallModalContent}>
            <Text style={styles.modalHeading}>Alta de Administrador</Text>
            <Text style={styles.modalSubheading}>
              Asigna a un encargado de gestionar colonos, vigilantes y avisos.
            </Text>

            <Text style={styles.fieldLabel}>NOMBRE COMPLETO:</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Ej. Lic. Fernando Treviño"
              placeholderTextColor={Theme.colors.textMuted}
              value={adminName}
              onChangeText={setAdminName}
            />

            <Text style={styles.fieldLabel}>CORREO ELECTRÓNICO (LOGIN):</Text>
            <TextInput
              style={styles.textInput}
              placeholder="admin@fraccionamiento.com"
              placeholderTextColor={Theme.colors.textMuted}
              value={adminEmail}
              onChangeText={setAdminEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Text style={styles.fieldLabel}>CONTRASEÑA TEMPORAL:</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Mínimo 6 caracteres"
              placeholderTextColor={Theme.colors.textMuted}
              value={adminPassword}
              onChangeText={setAdminPassword}
              secureTextEntry
            />

            <Text style={styles.fieldLabel}>FRACCIONAMIENTO ASIGNADO:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {residenciales.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.resSelectChip, adminResId === r.id && styles.resSelectChipActive]}
                  onPress={() => setAdminResId(r.id)}
                  activeOpacity={0.8}
                >
                  <Text style={adminResId === r.id ? styles.resSelectChipTextActive : styles.resSelectChipText}>
                    {r.nombre}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => setAdminModalVisible(false)}
              >
                <Text style={styles.cancelModalBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitModalBtn}
                onPress={saveAdminUser}
                disabled={savingAdmin}
              >
                <Text style={styles.submitModalBtnText}>Registrar Admin</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL SUSPENSIÓN / DESACTIVACIÓN DE RESIDENCIA           */}
      {/* ======================================================== */}
      <Modal visible={statusModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.smallModalContent}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Ionicons name="warning" size={24} color={Theme.colors.errorLight} />
              <Text style={styles.modalHeading}>Inactivar Residencia</Text>
            </View>
            <Text style={styles.modalSubheading}>
              Se bloqueará de inmediato el acceso a puertas, la generación de pases QR y la validación en caseta.
            </Text>

            <Text style={styles.fieldLabel}>MOTIVO DE LA INACTIVACIÓN O SUSPENSIÓN:</Text>
            <TextInput
              style={[styles.textInput, { height: 75 }]}
              multiline
              placeholder="Ej. Falta de pago de cuota de plataforma o mantenimiento de caseta"
              placeholderTextColor={Theme.colors.textMuted}
              value={statusReasonInput}
              onChangeText={setStatusReasonInput}
            />

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => setStatusModalVisible(false)}
              >
                <Text style={styles.cancelModalBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitModalBtn, { backgroundColor: Theme.colors.error }]}
                onPress={executeStatusChange}
              >
                <Text style={styles.submitModalBtnText}>Confirmar Inactivación</Text>
              </TouchableOpacity>
            </View>
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
  masterHeader: {
    marginBottom: Theme.spacing.md,
  },
  masterBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  crownBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  masterBadgeText: {
    color: "#F59E0B",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  masterTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: Theme.colors.textPrimary,
    letterSpacing: -0.4,
  },
  masterSubtitle: {
    fontSize: 12,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  kpiScroll: {
    flexDirection: "row",
    marginBottom: Theme.spacing.md,
  },
  kpiCard: {
    backgroundColor: Theme.colors.surfaceContainer,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
    marginRight: 10,
    width: 170,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  kpiIconWrapper: {
    width: 34,
    height: 34,
    borderRadius: Theme.borderRadius.sm,
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: "800",
    color: Theme.colors.textPrimary,
  },
  kpiLabel: {
    fontSize: 11,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  sectionSwitcher: {
    flexDirection: "row",
    backgroundColor: Theme.colors.surfaceContainerLow,
    borderRadius: Theme.borderRadius.md,
    padding: 3,
    marginBottom: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  switchBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    borderRadius: Theme.borderRadius.sm,
  },
  switchBtnActive: {
    backgroundColor: Theme.colors.primary,
  },
  switchBtnText: {
    color: Theme.colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  switchBtnTextActive: {
    color: Theme.colors.onPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
  subHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  subHeaderTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Theme.colors.textPrimary,
  },
  actionAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Theme.borderRadius.md,
  },
  actionAddBtnText: {
    color: Theme.colors.onPrimary,
    fontSize: 12,
    fontWeight: "600",
  },
  resCard: {
    backgroundColor: Theme.colors.surfaceContainer,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  resCardInactive: {
    borderColor: "rgba(239, 68, 68, 0.35)",
    backgroundColor: "#16131b",
  },
  resCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  resTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  resTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Theme.colors.textPrimary,
  },
  resAddress: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    marginBottom: 4,
  },
  reasonNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Theme.borderRadius.sm,
    marginTop: 4,
  },
  reasonNoticeText: {
    fontSize: 11,
    color: Theme.colors.errorLight,
    fontWeight: "500",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Theme.borderRadius.full,
    borderWidth: 1,
  },
  statusBadgeActive: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  statusBadgeInactive: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  resDivider: {
    height: 1,
    backgroundColor: Theme.colors.border,
    marginVertical: 10,
  },
  resSpecsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  specItem: {
    width: "48%",
    backgroundColor: Theme.colors.surfaceContainerLow,
    padding: 8,
    borderRadius: Theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  specLabel: {
    fontSize: 9,
    color: Theme.colors.textMuted,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  specValue: {
    fontSize: 12,
    fontWeight: "600",
    color: Theme.colors.textPrimary,
    marginTop: 2,
  },
  hwStatusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  hwDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  resActionsRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    marginTop: 4,
  },
  btnConfigure: {
    flex: 1.4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.colors.surfaceContainerHigh,
    paddingVertical: 8,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Theme.colors.borderMedium,
  },
  btnConfigureText: {
    color: Theme.colors.primaryLight,
    fontSize: 11,
    fontWeight: "600",
  },
  btnPing: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.colors.surfaceContainerLow,
    paddingVertical: 8,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
  },
  btnPingText: {
    color: Theme.colors.secondary,
    fontSize: 11,
    fontWeight: "600",
  },
  btnToggleStatus: {
    flex: 1.1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
  },
  btnDeactivate: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  btnDeactivateText: {
    color: Theme.colors.errorLight,
    fontSize: 11,
    fontWeight: "700",
  },
  btnActivate: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  btnActivateText: {
    color: Theme.colors.secondary,
    fontSize: 11,
    fontWeight: "700",
  },
  adminCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.colors.surfaceContainer,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  adminAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Theme.colors.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Theme.spacing.md,
  },
  adminInfo: {
    flex: 1,
  },
  adminName: {
    fontSize: 15,
    fontWeight: "700",
    color: Theme.colors.textPrimary,
  },
  adminEmail: {
    fontSize: 12,
    color: Theme.colors.primaryLight,
  },
  adminResRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  adminResText: {
    fontSize: 11,
    color: Theme.colors.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(1, 15, 31, 0.85)",
    justifyContent: "center",
    padding: Theme.spacing.lg,
  },
  largeModalContent: {
    backgroundColor: Theme.colors.surfaceContainer,
    borderRadius: Theme.borderRadius.xl,
    padding: Theme.spacing.lg,
    maxHeight: "85%",
    borderWidth: 1,
    borderColor: Theme.colors.borderMedium,
  },
  smallModalContent: {
    backgroundColor: Theme.colors.surfaceContainer,
    borderRadius: Theme.borderRadius.xl,
    padding: Theme.spacing.lg,
    borderWidth: 1,
    borderColor: Theme.colors.borderMedium,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  modalHeading: {
    fontSize: 17,
    fontWeight: "700",
    color: Theme.colors.textPrimary,
  },
  modalSubheading: {
    fontSize: 11,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  closeModalBtn: {
    padding: 4,
  },
  modalTabsBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
    marginBottom: 12,
  },
  modalTabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  modalTabItemActive: {
    borderBottomColor: Theme.colors.primaryLight,
  },
  modalTabItemText: {
    color: Theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  modalTabItemTextActive: {
    color: Theme.colors.primaryLight,
    fontSize: 11,
    fontWeight: "700",
  },
  tabScroll: {
    maxHeight: 380,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: Theme.colors.textMuted,
    letterSpacing: 0.6,
    marginBottom: 5,
  },
  textInput: {
    backgroundColor: Theme.colors.surfaceContainerLow,
    borderRadius: Theme.borderRadius.md,
    padding: 10,
    color: Theme.colors.textPrimary,
    fontSize: 13,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  doorsTopHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  doorsListNotice: {
    flex: 1,
    fontSize: 11,
    color: Theme.colors.textSecondary,
    marginRight: 8,
  },
  addDoorBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: Theme.borderRadius.sm,
  },
  addDoorBtnText: {
    color: Theme.colors.onPrimary,
    fontSize: 11,
    fontWeight: "600",
  },
  noticeBox: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "rgba(59, 130, 246, 0.12)",
    padding: 10,
    borderRadius: Theme.borderRadius.md,
    marginBottom: 12,
  },
  noticeBoxText: {
    flex: 1,
    color: Theme.colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },
  doorItemCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.colors.surfaceContainerLow,
    padding: 10,
    borderRadius: Theme.borderRadius.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  doorIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Theme.colors.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  doorTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Theme.colors.textPrimary,
  },
  doorMeta: {
    fontSize: 11,
    color: Theme.colors.textMuted,
    marginTop: 1,
  },
  doorRtsp: {
    fontSize: 10,
    color: Theme.colors.textMuted,
    marginTop: 2,
    fontFamily: "monospace",
  },
  delDoorBtn: {
    padding: 6,
  },
  apiKeySection: {
    marginTop: 8,
  },
  apiKeyBox: {
    backgroundColor: Theme.colors.surfaceContainerLow,
    padding: 10,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Theme.colors.borderMedium,
    marginBottom: 8,
  },
  apiKeyText: {
    color: Theme.colors.secondary,
    fontFamily: "monospace",
    fontSize: 12,
    fontWeight: "700",
  },
  regenKeyBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: Theme.colors.surfaceContainerHigh,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.4)",
  },
  regenKeyBtnText: {
    color: "#F59E0B",
    fontSize: 11,
    fontWeight: "600",
  },
  planSelectorRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  planChip: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: Theme.colors.surfaceContainerLow,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  planChipActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  planChipText: {
    color: Theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  planChipTextActive: {
    color: Theme.colors.onPrimary,
    fontSize: 11,
    fontWeight: "700",
  },
  resSelectChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: Theme.colors.surfaceContainerLow,
    borderRadius: Theme.borderRadius.full,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    marginRight: 8,
  },
  resSelectChipActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  resSelectChipText: {
    color: Theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: "600",
  },
  resSelectChipTextActive: {
    color: Theme.colors.onPrimary,
    fontSize: 11,
    fontWeight: "700",
  },
  modalFooter: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
  },
  cancelModalBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  cancelModalBtnText: {
    color: Theme.colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  submitModalBtn: {
    flex: 1.8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.colors.primary,
    paddingVertical: 11,
    borderRadius: Theme.borderRadius.md,
  },
  submitModalBtnText: {
    color: Theme.colors.onPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
});
