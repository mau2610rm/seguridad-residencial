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
  Share,
  Platform,
  ScrollView,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { CameraView, useCameraPermissions } from "expo-camera";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";

interface VisitorCode {
  id: string;
  code: string;
  validFrom: string;
  validUntil: string;
  maxUses: number;
  usesRemaining: number;
  doorIds: string;
  visitorName?: string | null;
  visitorType?: string | null;
  vehiclePlate?: string | null;
  notes?: string | null;
  unit: { number: string };
}

interface Door {
  id: string;
  name: string;
  doorType: string;
}

export default function Visitors() {
  const { user } = useAuth();
  const [codes, setCodes] = useState<VisitorCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal de creación
  const [modalVisible, setModalVisible] = useState(false);
  const [visitorName, setVisitorName] = useState("");
  const [visitorType, setVisitorType] = useState<"casual" | "familiar" | "delivery" | "servicio">("casual");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [maxUses, setMaxUses] = useState("1");
  const [creating, setCreating] = useState(false);

  // Modal de visualización de QR y compartir
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [selectedCode, setSelectedCode] = useState<VisitorCode | null>(null);

  // Validación de guardia
  const [validateCode, setValidateCode] = useState("");
  const [validateDoorId, setValidateDoorId] = useState("");
  const [validating, setValidating] = useState(false);
  const [doors, setDoors] = useState<Door[]>([]);
  const [lastValidation, setLastValidation] = useState<{
    unit: string;
    visitorName?: string | null;
    visitorType?: string | null;
    vehiclePlate?: string | null;
  } | null>(null);

  // Escáner de cámara
  const [cameraVisible, setCameraVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  const isGuardOrAdmin = user?.role === "guardia" || user?.role === "admin_residencial";

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

  useEffect(() => {
    if (isGuardOrAdmin) {
      api.get<Door[]>("/doors").then(({ data }) => {
        setDoors(data);
        if (data.length && !validateDoorId) setValidateDoorId(data[0].id);
      }).catch(() => {});
    }
  }, [isGuardOrAdmin]);

  // Asignar fecha rápida por preset
  const setQuickExpiry = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(23, 59, 59, 999);
    setValidUntil(d.toISOString().slice(0, 10));
  };

  const createCode = async () => {
    const unitId = user?.unitId || selectedUnitId || (units[0]?.id);
    if (!unitId) {
      Alert.alert("Error", "No hay unidad asignada o selecciona una unidad");
      return;
    }
    if (!validUntil.trim()) {
      Alert.alert("Error", "Selecciona una fecha de vigencia");
      return;
    }
    setCreating(true);
    try {
      const validUntilDate = new Date(validUntil);
      validUntilDate.setHours(23, 59, 59, 999);
      const { data } = await api.post<VisitorCode>("/visitors/codes", {
        unitId,
        visitorName: visitorName.trim() || undefined,
        visitorType,
        vehiclePlate: vehiclePlate.trim() || undefined,
        validUntil: validUntilDate.toISOString(),
        maxUses: parseInt(maxUses, 10) || 1,
      });

      setModalVisible(false);
      setVisitorName("");
      setVehiclePlate("");
      setValidUntil("");
      setMaxUses("1");
      setVisitorType("casual");
      fetchCodes();

      // Abrir inmediatamente el QR del nuevo pase para facilitar compartir
      setSelectedCode(data);
      setQrModalVisible(true);
    } catch {
      Alert.alert("Error", "No se pudo crear el código de visita");
    } finally {
      setCreating(false);
    }
  };

  const validateVisitor = async (codeToValidate?: string) => {
    const code = (codeToValidate || validateCode).trim().toUpperCase();
    if (!code || !validateDoorId.trim()) {
      Alert.alert("Error", "Código y puerta requeridos");
      return;
    }
    setValidating(true);
    try {
      const { data } = await api.post("/visitors/validate", {
        code,
        doorId: validateDoorId.trim(),
      });
      setLastValidation({
        unit: data.unit,
        visitorName: data.visitorName,
        visitorType: data.visitorType,
        vehiclePlate: data.vehiclePlate,
      });
      Alert.alert(
        "✅ Acceso Permitido",
        `Unidad: ${data.unit}\n` +
        (data.visitorName ? `Visitante: ${data.visitorName}\n` : "") +
        (data.vehiclePlate ? `Vehículo: ${data.vehiclePlate}\n` : "") +
        `Usos restantes: ${data.usesRemaining}`
      );
      setValidateCode("");
      fetchCodes();
    } catch (err: unknown) {
      const res = err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { error?: string } } }).response
        : null;
      Alert.alert("❌ Acceso Denegado", res?.data?.error || "Código inválido o expirado");
    } finally {
      setValidating(false);
    }
  };

  const handleStartScan = async () => {
    if (Platform.OS === "web") {
      Alert.alert("Cámara no disponible", "En navegador web por favor introduce el código de 8 caracteres.");
      return;
    }
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert("Permiso requerido", "Se requiere permiso de cámara para escanear códigos QR.");
        return;
      }
    }
    setScanned(false);
    setCameraVisible(true);
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    setCameraVisible(false);

    let cleanCode = data.trim().toUpperCase();
    try {
      const parsed = JSON.parse(data);
      if (parsed.code) cleanCode = parsed.code.toUpperCase();
    } catch {}

    setValidateCode(cleanCode);
    validateVisitor(cleanCode);
  };

  const shareInvitation = async (item: VisitorCode) => {
    const visitor = item.visitorName ? `\n👤 Visitante: *${item.visitorName}*` : "";
    const plate = item.vehiclePlate ? `\n🚗 Placas: *${item.vehiclePlate}*` : "";
    const unit = item.unit?.number || "N/A";
    const dateStr = new Date(item.validUntil).toLocaleString();

    const message =
      `🏢 *PASE DE ACCESO RESIDENCIAL*\n` +
      `📍 *Unidad:* ${unit}${visitor}${plate}\n` +
      `🔑 *Código de acceso:* ${item.code}\n` +
      `⏳ *Válido hasta:* ${dateStr}\n\n` +
      `Presenta este código al ingresar en la caseta de vigilancia.`;

    try {
      await Share.share({
        title: "Pase de Acceso Residencial",
        message,
      });
    } catch {
      Alert.alert("Error", "No se pudo compartir la invitación.");
    }
  };

  const deleteCode = (id: string) => {
    Alert.alert("Invalidar pase", "¿Deseas revocar este código de visita?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Invalidar",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/visitors/codes/${id}`);
            fetchCodes();
          } catch {
            Alert.alert("Error", "No se pudo invalidar el código");
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
      {/* Sección de Guardia / Validación */}
      {isGuardOrAdmin && (
        <View style={styles.validateSection}>
          <Text style={styles.sectionTitle}>🛡️ Validación de Visitantes</Text>

          {doors.length > 0 && (
            <View style={styles.doorPicker}>
              <Text style={styles.inputLabel}>Puerta de entrada:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.doorsScroll}>
                {doors.map((d) => (
                  <TouchableOpacity
                    key={d.id}
                    style={[styles.doorChip, validateDoorId === d.id && styles.doorChipActive]}
                    onPress={() => setValidateDoorId(d.id)}
                  >
                    <Text style={validateDoorId === d.id ? styles.doorChipTextActive : styles.doorChipText}>
                      {d.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.validateInputRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Código (8 caracteres)"
              placeholderTextColor="#888"
              value={validateCode}
              onChangeText={setValidateCode}
              maxLength={8}
              autoCapitalize="characters"
            />
            <TouchableOpacity style={styles.scanCameraBtn} onPress={handleStartScan}>
              <Text style={styles.scanCameraBtnText}>📷 Escanear QR</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.validateBtn}
            onPress={() => validateVisitor()}
            disabled={validating}
          >
            {validating ? <ActivityIndicator color="#fff" /> : <Text style={styles.validateBtnText}>Validar Acceso</Text>}
          </TouchableOpacity>

          {lastValidation && (
            <View style={styles.lastValidationBox}>
              <Text style={styles.lastValidationTitle}>Último acceso validado:</Text>
              <Text style={styles.lastValidationText}>
                Unidad: {lastValidation.unit}
                {lastValidation.visitorName ? ` • ${lastValidation.visitorName}` : ""}
                {lastValidation.vehiclePlate ? ` • [${lastValidation.vehiclePlate}]` : ""}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Título de Códigos y Botón de Creación */}
      <View style={styles.row}>
        <Text style={styles.title}>Pases de Visita Activos</Text>
        {user?.role !== "guardia" && (
          <TouchableOpacity style={styles.addBtn} onPress={() => { setQuickExpiry(0); setModalVisible(true); }}>
            <Text style={styles.addBtnText}>+ Nuevo Pase</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Listado de Códigos */}
      <FlatList
        data={codes}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchCodes(); }} />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTopRow}>
              <View>
                <Text style={styles.visitorName}>{item.visitorName || "Visitante general"}</Text>
                <Text style={styles.visitorTypeBadge}>
                  {item.visitorType ? item.visitorType.toUpperCase() : "CASUAL"}
                  {item.vehiclePlate ? ` • 🚗 ${item.vehiclePlate}` : ""}
                </Text>
              </View>
              <Text style={styles.code}>{item.code}</Text>
            </View>

            <Text style={styles.meta}>Unidad {item.unit?.number} • Usos restantes: {item.usesRemaining}/{item.maxUses}</Text>
            <Text style={styles.meta}>Válido hasta: {new Date(item.validUntil).toLocaleString()}</Text>

            <View style={styles.cardActions}>
              <TouchableOpacity
                style={styles.qrBtn}
                onPress={() => {
                  setSelectedCode(item);
                  setQrModalVisible(true);
                }}
              >
                <Text style={styles.qrBtnText}>🔍 Ver QR</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shareBtn}
                onPress={() => shareInvitation(item)}
              >
                <Text style={styles.shareBtnText}>📲 Compartir</Text>
              </TouchableOpacity>

              {user?.role !== "guardia" && (
                <TouchableOpacity style={styles.delBtn} onPress={() => deleteCode(item.id)}>
                  <Text style={styles.delBtnText}>Revocar</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      />

      {/* Modal de Creación de Código */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Crear Pase de Visita</Text>

              <Text style={styles.inputLabel}>Nombre del visitante / Empresa:</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej. Juan Pérez o Uber Eats"
                placeholderTextColor="#888"
                value={visitorName}
                onChangeText={setVisitorName}
              />

              <Text style={styles.inputLabel}>Tipo de visita:</Text>
              <View style={styles.typeRow}>
                {(["casual", "familiar", "delivery", "servicio"] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeChip, visitorType === t && styles.typeChipActive]}
                    onPress={() => setVisitorType(t)}
                  >
                    <Text style={visitorType === t ? styles.typeChipTextActive : styles.typeChipText}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Placas de vehículo (opcional):</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej. ABC-1234"
                placeholderTextColor="#888"
                value={vehiclePlate}
                onChangeText={setVehiclePlate}
                autoCapitalize="characters"
              />

              <Text style={styles.inputLabel}>Vigencia rápida:</Text>
              <View style={styles.quickDatesRow}>
                <TouchableOpacity style={styles.quickDateBtn} onPress={() => setQuickExpiry(0)}>
                  <Text style={styles.quickDateText}>Hoy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickDateBtn} onPress={() => setQuickExpiry(1)}>
                  <Text style={styles.quickDateText}>Mañana</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickDateBtn} onPress={() => setQuickExpiry(3)}>
                  <Text style={styles.quickDateText}>3 días</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickDateBtn} onPress={() => setQuickExpiry(7)}>
                  <Text style={styles.quickDateText}>1 semana</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.input}
                placeholder="Fecha límite (YYYY-MM-DD)"
                placeholderTextColor="#888"
                value={validUntil}
                onChangeText={setValidUntil}
              />

              <Text style={styles.inputLabel}>Número máximo de accesos:</Text>
              <TextInput
                style={styles.input}
                placeholder="Máx. usos"
                placeholderTextColor="#888"
                value={maxUses}
                onChangeText={setMaxUses}
                keyboardType="number-pad"
              />

              <TouchableOpacity style={styles.createBtn} onPress={createCode} disabled={creating}>
                {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.createBtnText}>Generar Pase y QR</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal de Pase QR */}
      <Modal visible={qrModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.qrModalContent}>
            <Text style={styles.qrTitle}>Pase de Entrada</Text>
            <Text style={styles.qrSubtitle}>
              {selectedCode?.visitorName || "Visitante"} • Unidad {selectedCode?.unit?.number}
            </Text>

            {selectedCode?.code && (
              <View style={styles.qrBox}>
                <QRCode
                  value={selectedCode.code}
                  size={200}
                  color="#0f3460"
                  backgroundColor="#ffffff"
                />
              </View>
            )}

            <Text style={styles.qrCodeText}>{selectedCode?.code}</Text>
            {selectedCode?.vehiclePlate ? (
              <Text style={styles.qrMeta}>Vehículo autorizado: {selectedCode.vehiclePlate}</Text>
            ) : null}
            <Text style={styles.qrMeta}>
              Válido hasta: {selectedCode ? new Date(selectedCode.validUntil).toLocaleString() : ""}
            </Text>

            {selectedCode && (
              <TouchableOpacity
                style={styles.qrShareBtn}
                onPress={() => shareInvitation(selectedCode)}
              >
                <Text style={styles.qrShareBtnText}>📲 Enviar por WhatsApp / Compartir</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.qrCloseBtn} onPress={() => setQrModalVisible(false)}>
              <Text style={styles.qrCloseBtnText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de Cámara para el Guardia */}
      <Modal visible={cameraVisible} animationType="slide">
        <View style={styles.cameraContainer}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={handleBarcodeScanned}
          />
          <View style={styles.cameraOverlay}>
            <View style={styles.cameraFrame} />
            <Text style={styles.cameraInstructions}>Apunta la cámara al código QR del visitante</Text>
            <TouchableOpacity style={styles.cameraCloseBtn} onPress={() => setCameraVisible(false)}>
              <Text style={styles.cameraCloseBtnText}>Cerrar Escáner</Text>
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
  validateSection: { marginBottom: 16, padding: 16, backgroundColor: "#16213e", borderRadius: 14, borderWidth: 1, borderColor: "#27ae60" },
  sectionTitle: { color: "#fff", fontSize: 17, fontWeight: "700", marginBottom: 12 },
  doorPicker: { marginBottom: 12 },
  doorsScroll: { flexDirection: "row", marginTop: 6 },
  doorChip: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#0f3460", borderRadius: 20, marginRight: 8 },
  doorChipActive: { backgroundColor: "#4a90d9" },
  doorChipText: { color: "#a0a0a0", fontSize: 13, fontWeight: "500" },
  doorChipTextActive: { color: "#fff", fontSize: 13, fontWeight: "700" },
  validateInputRow: { flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 10 },
  scanCameraBtn: { backgroundColor: "#8e44ad", paddingHorizontal: 12, paddingVertical: 12, borderRadius: 8, justifyContent: "center" },
  scanCameraBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  validateBtn: { backgroundColor: "#27ae60", padding: 14, borderRadius: 8, alignItems: "center" },
  validateBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  lastValidationBox: { marginTop: 12, padding: 10, backgroundColor: "rgba(39, 174, 96, 0.15)", borderRadius: 8, borderWidth: 1, borderColor: "#27ae60" },
  lastValidationTitle: { color: "#2ecc71", fontSize: 12, fontWeight: "600" },
  lastValidationText: { color: "#fff", fontSize: 14, fontWeight: "600", marginTop: 2 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { fontSize: 18, color: "#fff", fontWeight: "700" },
  addBtn: { backgroundColor: "#4a90d9", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  addBtnText: { color: "#fff", fontWeight: "700" },
  card: { backgroundColor: "#16213e", borderRadius: 14, padding: 16, marginBottom: 12 },
  cardTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  visitorName: { fontSize: 18, color: "#fff", fontWeight: "700" },
  visitorTypeBadge: { fontSize: 11, color: "#4a90d9", fontWeight: "700", marginTop: 2 },
  code: { fontSize: 20, color: "#4a90d9", fontWeight: "800", letterSpacing: 2 },
  meta: { fontSize: 13, color: "#a0a0a0", marginBottom: 4 },
  cardActions: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#223154" },
  qrBtn: { backgroundColor: "#0f3460", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  qrBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  shareBtn: { backgroundColor: "#25d366", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  shareBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  delBtn: { marginLeft: "auto" },
  delBtnText: { color: "#e74c3c", fontSize: 13, fontWeight: "600" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", padding: 20 },
  modalScroll: { flexGrow: 1, justifyContent: "center" },
  modalContent: { backgroundColor: "#16213e", borderRadius: 18, padding: 22 },
  modalTitle: { color: "#fff", fontSize: 20, fontWeight: "700", marginBottom: 16 },
  inputLabel: { color: "#a0a0a0", fontSize: 13, fontWeight: "600", marginBottom: 6 },
  input: { backgroundColor: "#0f3460", borderRadius: 8, padding: 12, color: "#fff", marginBottom: 12, fontSize: 15 },
  typeRow: { flexDirection: "row", gap: 6, marginBottom: 14 },
  typeChip: { flex: 1, paddingVertical: 8, backgroundColor: "#0f3460", borderRadius: 8, alignItems: "center" },
  typeChipActive: { backgroundColor: "#4a90d9" },
  typeChipText: { color: "#888", fontSize: 11, fontWeight: "600" },
  typeChipTextActive: { color: "#fff", fontSize: 11, fontWeight: "700" },
  quickDatesRow: { flexDirection: "row", gap: 6, marginBottom: 10 },
  quickDateBtn: { flex: 1, paddingVertical: 8, backgroundColor: "#0f3460", borderRadius: 8, alignItems: "center" },
  quickDateText: { color: "#4a90d9", fontSize: 12, fontWeight: "600" },
  createBtn: { backgroundColor: "#4a90d9", padding: 14, borderRadius: 10, alignItems: "center", marginTop: 10 },
  createBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  cancelBtn: { marginTop: 12, alignItems: "center" },
  cancelBtnText: { color: "#888", fontSize: 14 },
  qrModalContent: { backgroundColor: "#ffffff", borderRadius: 20, padding: 24, alignItems: "center" },
  qrTitle: { color: "#16213e", fontSize: 22, fontWeight: "800", marginBottom: 4 },
  qrSubtitle: { color: "#666", fontSize: 15, marginBottom: 20 },
  qrBox: { padding: 16, backgroundColor: "#fff", borderRadius: 12, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
  qrCodeText: { fontSize: 24, fontWeight: "900", letterSpacing: 4, color: "#0f3460", marginTop: 16 },
  qrMeta: { color: "#666", fontSize: 13, marginTop: 4, textAlign: "center" },
  qrShareBtn: { backgroundColor: "#25d366", paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, marginTop: 20, width: "100%", alignItems: "center" },
  qrShareBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  qrCloseBtn: { marginTop: 14, padding: 8 },
  qrCloseBtnText: { color: "#888", fontSize: 14, fontWeight: "600" },
  cameraContainer: { flex: 1, backgroundColor: "#000" },
  cameraOverlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)" },
  cameraFrame: { width: 240, height: 240, borderWidth: 2, borderColor: "#27ae60", borderRadius: 16, backgroundColor: "transparent" },
  cameraInstructions: { color: "#fff", marginTop: 20, fontSize: 15, fontWeight: "600" },
  cameraCloseBtn: { marginTop: 30, backgroundColor: "#e74c3c", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  cameraCloseBtnText: { color: "#fff", fontWeight: "700" },
});
