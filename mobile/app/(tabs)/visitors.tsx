import { useState, useEffect, useRef } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";
import { CameraView, useCameraPermissions } from "expo-camera";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { Theme } from "../../constants/theme";

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
  const passCardRef = useRef<any>(null);
  const qrRef = useRef<any>(null);
  const [sharingQr, setSharingQr] = useState(false);

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
    const residencial = user?.residencial?.nombre ? `🏘️ *${user.residencial.nombre}*\n` : "";
    const unit = item.unit?.number || "N/A";
    const dateStr = new Date(item.validUntil).toLocaleString();

    const message =
      `${residencial}` +
      `🛡️ *PASE DIGITAL DE ACCESO*\n` +
      `📍 *Unidad:* ${unit}${visitor}${plate}\n` +
      `🔑 *Código de acceso:* ${item.code}\n` +
      `⏳ *Válido hasta:* ${dateStr}\n\n` +
      `Presenta este código QR al ingresar en la caseta de vigilancia.`;

    try {
      await Share.share({
        title: `Pase de Acceso - Unidad ${unit}`,
        message,
      });
    } catch {
      Alert.alert("Error", "No se pudo compartir la invitación.");
    }
  };

  // Generador de Tarjeta Gráfica Completa para Web y Fallback
  const generatePassCardCanvas = (qrBase64: string, item: VisitorCode, residencialName: string): Promise<string> => {
    return new Promise((resolve) => {
      if (typeof document === "undefined") {
        resolve(`data:image/png;base64,${qrBase64}`);
        return;
      }
      try {
        const canvas = document.createElement("canvas");
        const width = 640;
        const height = 960;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(`data:image/png;base64,${qrBase64}`);
          return;
        }

        // 1. Fondo Obsidian profundo
        ctx.fillStyle = "#051424";
        ctx.fillRect(0, 0, width, height);

        // 2. Tarjeta contenedor con borde Sapphire
        const margin = 24;
        const cardW = width - margin * 2;
        const cardH = height - margin * 2;
        const radius = 24;

        ctx.save();
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(margin, margin, cardW, cardH, radius);
        } else {
          ctx.rect(margin, margin, cardW, cardH);
        }
        ctx.fillStyle = "#122131";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(59, 130, 246, 0.4)";
        ctx.stroke();
        ctx.restore();

        // 3. Encabezado del Residencial
        ctx.fillStyle = "#F8FAFC";
        ctx.font = "bold 24px sans-serif";
        ctx.fillText(residencialName || "Residia Security", margin + 28, margin + 55);

        ctx.fillStyle = "#3B82F6";
        ctx.font = "bold 12px sans-serif";
        ctx.fillText("PASE DIGITAL DE ACCESO", margin + 28, margin + 78);

        // Punto de verificación verde
        ctx.beginPath();
        ctx.arc(margin + cardW - 35, margin + 55, 7, 0, Math.PI * 2);
        ctx.fillStyle = "#10B981";
        ctx.fill();

        // Línea divisoria
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(margin + 24, margin + 98);
        ctx.lineTo(margin + cardW - 24, margin + 98);
        ctx.stroke();

        // 4. Visitante y Unidad
        ctx.fillStyle = "#94A3B8";
        ctx.font = "bold 11px sans-serif";
        ctx.fillText("VISITANTE", margin + 28, margin + 130);

        ctx.fillStyle = "#F8FAFC";
        ctx.font = "bold 20px sans-serif";
        const visitorTitle = item.visitorName || "Visitante Autorizado";
        ctx.fillText(visitorTitle.length > 22 ? visitorTitle.slice(0, 22) + "..." : visitorTitle, margin + 28, margin + 158);

        // Badge Unidad
        const unitText = `Unidad ${item.unit?.number || "N/A"}`;
        ctx.font = "bold 13px sans-serif";
        const unitWidth = ctx.measureText(unitText).width;
        ctx.fillStyle = "#1c2b3c";
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(margin + cardW - unitWidth - 40, margin + 132, unitWidth + 20, 32, 8);
        } else {
          ctx.rect(margin + cardW - unitWidth - 40, margin + 132, unitWidth + 20, 32);
        }
        ctx.fill();
        ctx.strokeStyle = "rgba(59, 130, 246, 0.35)";
        ctx.stroke();
        ctx.fillStyle = "#ADC6FF";
        ctx.fillText(unitText, margin + cardW - unitWidth - 30, margin + 153);

        // Categoría de visita y placas
        const tagY = margin + 198;
        const typeLabel = (item.visitorType || "CASUAL").toUpperCase();
        ctx.fillStyle = "#0d1c2d";
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(margin + 28, tagY - 18, 95, 26, 6);
        } else {
          ctx.rect(margin + 28, tagY - 18, 95, 26);
        }
        ctx.fill();
        ctx.fillStyle = "#3B82F6";
        ctx.font = "bold 11px sans-serif";
        ctx.fillText(typeLabel, margin + 38, tagY);

        if (item.vehiclePlate) {
          const plateText = `🚗 ${item.vehiclePlate}`;
          ctx.fillStyle = "#0d1c2d";
          ctx.beginPath();
          if (typeof ctx.roundRect === "function") {
            ctx.roundRect(margin + 132, tagY - 18, 120, 26, 6);
          } else {
            ctx.rect(margin + 132, tagY - 18, 120, 26);
          }
          ctx.fill();
          ctx.fillStyle = "#94A3B8";
          ctx.fillText(plateText, margin + 142, tagY);
        }

        // 5. Contenedor de Código QR en blanco puro
        const qrBoxSize = 250;
        const qrBoxX = (width - qrBoxSize) / 2;
        const qrBoxY = margin + 235;

        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 18);
        } else {
          ctx.rect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize);
        }
        ctx.fill();

        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, qrBoxX + 15, qrBoxY + 15, qrBoxSize - 30, qrBoxSize - 30);

          // 6. Badge de Código Alfanumérico
          const codeY = qrBoxY + qrBoxSize + 18;
          const codeW = 200;
          const codeX = (width - codeW) / 2;
          ctx.fillStyle = "#0d1c2d";
          ctx.beginPath();
          if (typeof ctx.roundRect === "function") {
            ctx.roundRect(codeX, codeY, codeW, 38, 10);
          } else {
            ctx.rect(codeX, codeY, codeW, 38);
          }
          ctx.fill();
          ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
          ctx.stroke();

          ctx.fillStyle = "#ADC6FF";
          ctx.font = "bold 20px monospace";
          ctx.textAlign = "center";
          ctx.fillText(item.code, width / 2, codeY + 26);
          ctx.textAlign = "left";

          // 7. Caja de Vigencia y Reglas
          const expY = codeY + 54;
          const expW = cardW - 40;
          const expX = margin + 20;
          ctx.fillStyle = "#0d1c2d";
          ctx.beginPath();
          if (typeof ctx.roundRect === "function") {
            ctx.roundRect(expX, expY, expW, 80, 12);
          } else {
            ctx.rect(expX, expY, expW, 80);
          }
          ctx.fill();
          ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
          ctx.stroke();

          const dateStr = new Date(item.validUntil).toLocaleString([], { dateStyle: "short", timeStyle: "short" });
          ctx.fillStyle = "#F59E0B";
          ctx.font = "bold 13px sans-serif";
          ctx.fillText(`⏳ Válido hasta: ${dateStr}`, expX + 16, expY + 30);

          ctx.fillStyle = "#10B981";
          ctx.font = "bold 13px sans-serif";
          ctx.fillText(`🛡️ Usos permitidos: ${item.usesRemaining} de ${item.maxUses}`, expX + 16, expY + 58);

          // 8. Mensaje inferior
          ctx.fillStyle = "#64748B";
          ctx.font = "11px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("Presentar este pase en la caseta de vigilancia para validar el acceso.", width / 2, height - margin - 22);

          resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = () => {
          resolve(`data:image/png;base64,${qrBase64}`);
        };
        img.src = `data:image/png;base64,${qrBase64}`;
      } catch {
        resolve(`data:image/png;base64,${qrBase64}`);
      }
    });
  };

  const shareQrAsImage = async (item: VisitorCode) => {
    setSharingQr(true);
    try {
      const residencialName = user?.residencial?.nombre || "Residencial Seguridad";

      // 1. En aplicaciones móviles nativas (iOS / Android)
      if (Platform.OS !== "web" && passCardRef.current) {
        try {
          const uri = await captureRef(passCardRef, {
            format: "png",
            quality: 1.0,
            result: "tmpfile",
          });

          const isAvailable = await Sharing.isAvailableAsync();
          if (isAvailable) {
            await Sharing.shareAsync(uri, {
              mimeType: "image/png",
              dialogTitle: `Pase de Acceso - ${residencialName} (Unidad ${item.unit?.number})`,
              UTI: "public.png",
            });
            return;
          }
        } catch (captureErr) {
          console.log("captureRef error, fallback to QR canvas:", captureErr);
        }
      }

      // 2. En Web o fallback nativo: generar tarjeta composite de alta fidelidad
      if (qrRef.current) {
        qrRef.current.toDataURL(async (data: string) => {
          try {
            if (Platform.OS === "web") {
              const fullCardDataUrl = await generatePassCardCanvas(data, item, residencialName);
              const link = document.createElement("a");
              link.href = fullCardDataUrl;
              link.download = `pase-${item.visitorName ? item.visitorName.replace(/\s+/g, "_") : "acceso"}-${item.code}.png`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              Alert.alert("✅ Pase Digital Generado", "La tarjeta de invitación completa ha sido descargada con éxito.");
            } else {
              const filename = `${FileSystem.cacheDirectory}pase-${item.code}.png`;
              await FileSystem.writeAsStringAsync(filename, data, {
                encoding: FileSystem.EncodingType.Base64,
              });
              await Sharing.shareAsync(filename, {
                mimeType: "image/png",
                dialogTitle: `Pase de Acceso - Unidad ${item.unit?.number || ""}`,
                UTI: "public.png",
              });
            }
          } catch (err) {
            console.error("Error al procesar tarjeta:", err);
            Alert.alert("Error", "No se pudo procesar la tarjeta digital de invitación.");
          }
        });
      }
    } catch (err) {
      console.error("Error al compartir pase:", err);
      Alert.alert("Error", "No se pudo exportar el pase como imagen.");
    } finally {
      setSharingQr(false);
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

  const getVisitorTypeStyle = (type?: string | null) => {
    switch (type) {
      case "delivery":
        return { color: Theme.colors.tertiary, bg: Theme.colors.tertiaryContainer, icon: "bicycle-outline", label: "DELIVERY" };
      case "servicio":
        return { color: Theme.colors.primaryLight, bg: "rgba(59, 130, 246, 0.15)", icon: "construct-outline", label: "SERVICIO" };
      case "familiar":
        return { color: Theme.colors.secondary, bg: Theme.colors.secondaryContainer, icon: "people-outline", label: "FAMILIAR" };
      default:
        return { color: Theme.colors.textSecondary, bg: Theme.colors.surfaceContainerHigh, icon: "person-outline", label: "CASUAL" };
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
      {/* Sección de Guardia / Validación */}
      {isGuardOrAdmin && (
        <View style={styles.validateSection}>
          <View style={styles.validateHeaderRow}>
            <Ionicons name="shield-checkmark" size={20} color={Theme.colors.secondary} />
            <Text style={styles.sectionTitle}>Validación de Acceso en Caseta</Text>
          </View>

          {doors.length > 0 && (
            <View style={styles.doorPicker}>
              <Text style={styles.inputLabel}>PUERTA DE ENTRADA:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.doorsScroll}>
                {doors.map((d) => (
                  <TouchableOpacity
                    key={d.id}
                    style={[styles.doorChip, validateDoorId === d.id && styles.doorChipActive]}
                    onPress={() => setValidateDoorId(d.id)}
                    activeOpacity={0.8}
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
              placeholder="CÓDIGO (8 DÍGITOS)"
              placeholderTextColor={Theme.colors.textMuted}
              value={validateCode}
              onChangeText={setValidateCode}
              maxLength={8}
              autoCapitalize="characters"
            />
            <TouchableOpacity style={styles.scanCameraBtn} onPress={handleStartScan} activeOpacity={0.85}>
              <Ionicons name="qr-code-outline" size={18} color={Theme.colors.onPrimary} style={{ marginRight: 6 }} />
              <Text style={styles.scanCameraBtnText}>Escanear</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.validateBtn}
            onPress={() => validateVisitor()}
            disabled={validating}
            activeOpacity={0.85}
          >
            {validating ? (
              <ActivityIndicator color={Theme.colors.onPrimary} />
            ) : (
              <View style={styles.btnContent}>
                <Ionicons name="checkmark-done-circle-outline" size={20} color={Theme.colors.onPrimary} style={{ marginRight: 6 }} />
                <Text style={styles.validateBtnText}>Validar Código de Entrada</Text>
              </View>
            )}
          </TouchableOpacity>

          {lastValidation && (
            <View style={styles.lastValidationBox}>
              <View style={styles.lastValidationHeader}>
                <Ionicons name="checkmark-circle" size={16} color={Theme.colors.secondary} />
                <Text style={styles.lastValidationTitle}>Último acceso verificado:</Text>
              </View>
              <Text style={styles.lastValidationText}>
                Unidad: {lastValidation.unit}
                {lastValidation.visitorName ? ` • ${lastValidation.visitorName}` : ""}
                {lastValidation.vehiclePlate ? ` • [${lastValidation.vehiclePlate}]` : ""}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Header y Botón Nuevo Pase */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.screenHeading}>Pases de Acceso</Text>
          <Text style={styles.screenSubheading}>Códigos QR y accesos temporales</Text>
        </View>
        {user?.role !== "guardia" && (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => { setQuickExpiry(0); setModalVisible(true); }}
            activeOpacity={0.85}
          >
            <Ionicons name="add-circle" size={16} color={Theme.colors.onPrimary} style={{ marginRight: 4 }} />
            <Text style={styles.addBtnText}>Nuevo Pase</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Listado de Códigos */}
      <FlatList
        data={codes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={Theme.colors.primary}
            onRefresh={() => { setRefreshing(true); fetchCodes(); }}
          />
        }
        renderItem={({ item }) => {
          const typeStyle = getVisitorTypeStyle(item.visitorType);

          return (
            <View style={styles.card}>
              <View style={styles.cardTopRow}>
                <View style={styles.visitorMetaCol}>
                  <Text style={styles.visitorName}>{item.visitorName || "Visitante general"}</Text>
                  <View style={[styles.visitorTypeBadge, { backgroundColor: typeStyle.bg }]}>
                    <Ionicons name={typeStyle.icon as any} size={12} color={typeStyle.color} style={{ marginRight: 4 }} />
                    <Text style={[styles.visitorTypeText, { color: typeStyle.color }]}>
                      {typeStyle.label}
                    </Text>
                    {item.vehiclePlate ? (
                      <Text style={[styles.visitorTypeText, { color: typeStyle.color }]}>
                        {" "}• 🚗 {item.vehiclePlate}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <View style={styles.codeBadge}>
                  <Text style={styles.codeText}>{item.code}</Text>
                </View>
              </View>

              <View style={styles.metaDivider} />

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Ionicons name="home-outline" size={13} color={Theme.colors.textMuted} />
                  <Text style={styles.metaText}>Unidad {item.unit?.number}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="repeat-outline" size={13} color={Theme.colors.textMuted} />
                  <Text style={styles.metaText}>Usos: {item.usesRemaining}/{item.maxUses}</Text>
                </View>
              </View>

              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={13} color={Theme.colors.textMuted} />
                <Text style={styles.metaText}>
                  Válido: {new Date(item.validUntil).toLocaleDateString()} {new Date(item.validUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.qrActionBtn}
                  onPress={() => {
                    setSelectedCode(item);
                    setQrModalVisible(true);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="eye-outline" size={15} color={Theme.colors.primaryLight} style={{ marginRight: 4 }} />
                  <Text style={styles.qrActionBtnText}>Ver Pase</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.shareImageActionBtn}
                  onPress={() => {
                    setSelectedCode(item);
                    setQrModalVisible(true);
                    setTimeout(() => shareQrAsImage(item), 300);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="image-outline" size={15} color={Theme.colors.onPrimary} style={{ marginRight: 4 }} />
                  <Text style={styles.shareImageActionBtnText}>Compartir Tarjeta</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.shareTextActionBtn}
                  onPress={() => shareInvitation(item)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={15} color="#25D366" style={{ marginRight: 4 }} />
                  <Text style={styles.shareTextActionBtnText}>Texto</Text>
                </TouchableOpacity>

                {user?.role !== "guardia" && (
                  <TouchableOpacity
                    style={styles.delActionBtn}
                    onPress={() => deleteCode(item.id)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="trash-outline" size={16} color={Theme.colors.errorLight} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
      />

      {/* Modal de Creación de Pase */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={styles.modalContent}>
              <View style={styles.modalTopHeader}>
                <Ionicons name="qr-code" size={24} color={Theme.colors.primary} />
                <Text style={styles.modalTitle}>Crear Pase de Visita</Text>
              </View>

              <Text style={styles.inputLabel}>NOMBRE DEL VISITANTE / EMPRESA:</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej. Juan Pérez o Uber Eats"
                placeholderTextColor={Theme.colors.textMuted}
                value={visitorName}
                onChangeText={setVisitorName}
              />

              <Text style={styles.inputLabel}>TIPO DE VISITA:</Text>
              <View style={styles.typeRow}>
                {(["casual", "familiar", "delivery", "servicio"] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeChip, visitorType === t && styles.typeChipActive]}
                    onPress={() => setVisitorType(t)}
                    activeOpacity={0.8}
                  >
                    <Text style={visitorType === t ? styles.typeChipTextActive : styles.typeChipText}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>PLACAS DE VEHÍCULO (OPCIONAL):</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej. ABC-1234"
                placeholderTextColor={Theme.colors.textMuted}
                value={vehiclePlate}
                onChangeText={setVehiclePlate}
                autoCapitalize="characters"
              />

              <Text style={styles.inputLabel}>VIGENCIA RÁPIDA:</Text>
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
                  <Text style={styles.quickDateText}>1 sem</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.input}
                placeholder="Fecha límite (YYYY-MM-DD)"
                placeholderTextColor={Theme.colors.textMuted}
                value={validUntil}
                onChangeText={setValidUntil}
              />

              <Text style={styles.inputLabel}>NÚMERO MÁXIMO DE ACCESOS:</Text>
              <TextInput
                style={styles.input}
                placeholder="Máx. usos"
                placeholderTextColor={Theme.colors.textMuted}
                value={maxUses}
                onChangeText={setMaxUses}
                keyboardType="number-pad"
              />

              <TouchableOpacity
                style={styles.createBtn}
                onPress={createCode}
                disabled={creating}
                activeOpacity={0.85}
              >
                {creating ? (
                  <ActivityIndicator color={Theme.colors.onPrimary} />
                ) : (
                  <View style={styles.btnContent}>
                    <Ionicons name="sparkles-outline" size={18} color={Theme.colors.onPrimary} style={{ marginRight: 6 }} />
                    <Text style={styles.createBtnText}>Generar Pase & Código QR</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal de Pase QR con Tarjeta de Exportación de Alto Nivel */}
      <Modal visible={qrModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.qrModalScroll}>
            {/* Tarjeta Visual de Pase Capturable para Imagen */}
            <View ref={passCardRef} collapsable={false} style={styles.passDesignCard}>
              {/* Encabezado del Residencial */}
              <View style={styles.passHeader}>
                <View style={styles.passLogoBadge}>
                  <Ionicons name="shield-checkmark" size={24} color={Theme.colors.primaryLight} />
                </View>
                <View style={styles.passHeaderMeta}>
                  <View style={styles.passBrandRow}>
                    <Text style={styles.passResidencialName}>
                      {user?.residencial?.nombre || "Residia Security"}
                    </Text>
                    <View style={styles.passVerifiedDot} />
                  </View>
                  <Text style={styles.passSubtitle}>PASE DIGITAL DE ACCESO</Text>
                </View>
              </View>

              <View style={styles.passDivider} />

              {/* Información de Visitante y Unidad */}
              <View style={styles.passInfoSection}>
                <View style={styles.passRow}>
                  <View style={styles.passCol}>
                    <Text style={styles.passInfoLabel}>VISITANTE</Text>
                    <Text style={styles.passVisitorName} numberOfLines={1}>
                      {selectedCode?.visitorName || "Visitante Autorizado"}
                    </Text>
                  </View>
                  <View style={styles.passUnitBadge}>
                    <Ionicons name="home" size={12} color={Theme.colors.primaryLight} style={{ marginRight: 4 }} />
                    <Text style={styles.passUnitText}>Unidad {selectedCode?.unit?.number || "N/A"}</Text>
                  </View>
                </View>

                <View style={styles.passTagsRow}>
                  {selectedCode?.visitorType && (
                    <View style={styles.passTagPill}>
                      <Ionicons
                        name={getVisitorTypeStyle(selectedCode.visitorType).icon as any}
                        size={11}
                        color={getVisitorTypeStyle(selectedCode.visitorType).color}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={[styles.passTagPillText, { color: getVisitorTypeStyle(selectedCode.visitorType).color }]}>
                        {getVisitorTypeStyle(selectedCode.visitorType).label}
                      </Text>
                    </View>
                  )}

                  {selectedCode?.vehiclePlate ? (
                    <View style={styles.passTagPill}>
                      <Ionicons name="car-outline" size={11} color={Theme.colors.textSecondary} style={{ marginRight: 4 }} />
                      <Text style={styles.passTagPillText}>🚗 {selectedCode.vehiclePlate}</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {/* Contenedor del Código QR */}
              {selectedCode?.code && (
                <View style={styles.passQrContainer}>
                  <View style={styles.passQrWrapper}>
                    <QRCode
                      value={selectedCode.code}
                      size={180}
                      color="#051424"
                      backgroundColor="#FFFFFF"
                      getRef={(c) => (qrRef.current = c)}
                    />
                  </View>

                  <View style={styles.passCodeBadge}>
                    <Text style={styles.passCodeDigits}>{selectedCode.code}</Text>
                  </View>
                </View>
              )}

              {/* Detalles de Vigencia y Validación */}
              <View style={styles.passFooterInfo}>
                <View style={styles.passMetaItem}>
                  <Ionicons name="time-outline" size={13} color={Theme.colors.tertiary} />
                  <Text style={styles.passMetaText}>
                    Válido hasta: {selectedCode ? new Date(selectedCode.validUntil).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : ""}
                  </Text>
                </View>

                <View style={styles.passMetaItem}>
                  <Ionicons name="shield-outline" size={13} color={Theme.colors.secondary} />
                  <Text style={styles.passMetaText}>
                    Usos permitidos: {selectedCode?.usesRemaining} de {selectedCode?.maxUses}
                  </Text>
                </View>
              </View>

              <View style={styles.passInstructionBox}>
                <Ionicons name="scan-outline" size={13} color={Theme.colors.textMuted} style={{ marginRight: 6 }} />
                <Text style={styles.passInstructionText}>
                  Presentar este código en la caseta de vigilancia para acceder.
                </Text>
              </View>
            </View>

            {/* Botones de Acción para Compartir */}
            {selectedCode && (
              <View style={styles.qrActionsWrapper}>
                <TouchableOpacity
                  style={styles.qrShareImageBtn}
                  onPress={() => shareQrAsImage(selectedCode)}
                  disabled={sharingQr}
                  activeOpacity={0.85}
                >
                  {sharingQr ? (
                    <ActivityIndicator color={Theme.colors.onPrimary} size="small" />
                  ) : (
                    <View style={styles.btnContent}>
                      <Ionicons name="image" size={18} color={Theme.colors.onPrimary} style={{ marginRight: 8 }} />
                      <Text style={styles.qrShareImageBtnText}>Compartir Tarjeta Digital (PNG)</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.qrShareTextBtn}
                  onPress={() => shareInvitation(selectedCode)}
                  activeOpacity={0.85}
                >
                  <View style={styles.btnContent}>
                    <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.qrShareTextBtnText}>Enviar por WhatsApp / Texto</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity style={styles.qrCloseBtn} onPress={() => setQrModalVisible(false)}>
              <Text style={styles.qrCloseBtnText}>Cerrar Ventana</Text>
            </TouchableOpacity>
          </ScrollView>
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
  validateSection: {
    marginBottom: Theme.spacing.lg,
    padding: Theme.spacing.lg,
    backgroundColor: Theme.colors.surfaceContainer,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
  },
  validateHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: Theme.spacing.md,
  },
  sectionTitle: {
    color: Theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  doorPicker: {
    marginBottom: Theme.spacing.md,
  },
  doorsScroll: {
    flexDirection: "row",
    marginTop: 6,
  },
  doorChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Theme.colors.surfaceContainerLow,
    borderRadius: Theme.borderRadius.full,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  doorChipActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  doorChipText: {
    color: Theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: "500",
  },
  doorChipTextActive: {
    color: Theme.colors.onPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
  validateInputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginBottom: 10,
  },
  scanCameraBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.colors.surfaceContainerHigh,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Theme.colors.borderMedium,
  },
  scanCameraBtnText: {
    color: Theme.colors.textPrimary,
    fontWeight: "600",
    fontSize: 13,
  },
  validateBtn: {
    backgroundColor: Theme.colors.secondary,
    paddingVertical: 13,
    borderRadius: Theme.borderRadius.md,
    alignItems: "center",
    shadowColor: Theme.colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  validateBtnText: {
    color: Theme.colors.onSecondary,
    fontWeight: "700",
    fontSize: 15,
  },
  lastValidationBox: {
    marginTop: Theme.spacing.md,
    padding: Theme.spacing.md,
    backgroundColor: Theme.colors.secondaryContainer,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.4)",
  },
  lastValidationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  lastValidationTitle: {
    color: Theme.colors.secondaryLight,
    fontSize: 12,
    fontWeight: "600",
  },
  lastValidationText: {
    color: Theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Theme.spacing.md,
  },
  screenHeading: {
    fontSize: 18,
    color: Theme.colors.textPrimary,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  screenSubheading: {
    fontSize: 12,
    color: Theme.colors.textMuted,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Theme.borderRadius.md,
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  addBtnText: {
    color: Theme.colors.onPrimary,
    fontWeight: "600",
    fontSize: 13,
  },
  card: {
    backgroundColor: Theme.colors.surfaceContainer,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  visitorMetaCol: {
    flex: 1,
  },
  visitorName: {
    fontSize: 16,
    color: Theme.colors.textPrimary,
    fontWeight: "700",
  },
  visitorTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Theme.borderRadius.sm,
    marginTop: 4,
  },
  visitorTypeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  codeBadge: {
    backgroundColor: Theme.colors.surfaceContainerLow,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Theme.colors.borderMedium,
  },
  codeText: {
    fontSize: 16,
    color: Theme.colors.primaryLight,
    fontWeight: "800",
    letterSpacing: 1.5,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  metaDivider: {
    height: 1,
    backgroundColor: Theme.colors.border,
    marginVertical: Theme.spacing.md,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 6,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  metaText: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: Theme.spacing.md,
    paddingTop: Theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
  },
  qrActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.colors.surfaceContainerLow,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  qrActionBtnText: {
    color: Theme.colors.primaryLight,
    fontWeight: "600",
    fontSize: 12,
  },
  shareImageActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Theme.borderRadius.md,
  },
  shareImageActionBtnText: {
    color: Theme.colors.onPrimary,
    fontWeight: "600",
    fontSize: 12,
  },
  shareTextActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.colors.surfaceContainerLow,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  shareTextActionBtnText: {
    color: "#25D366",
    fontWeight: "600",
    fontSize: 12,
  },
  delActionBtn: {
    marginLeft: "auto",
    padding: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(1, 15, 31, 0.85)",
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
  modalTopHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: Theme.spacing.lg,
  },
  modalTitle: {
    color: Theme.colors.textPrimary,
    fontSize: 19,
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
  typeRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: Theme.spacing.md,
  },
  typeChip: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: Theme.colors.surfaceContainerLow,
    borderRadius: Theme.borderRadius.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  typeChipActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  typeChipText: {
    color: Theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  typeChipTextActive: {
    color: Theme.colors.onPrimary,
    fontSize: 11,
    fontWeight: "700",
  },
  quickDatesRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 8,
  },
  quickDateBtn: {
    flex: 1,
    paddingVertical: 7,
    backgroundColor: Theme.colors.surfaceContainerLow,
    borderRadius: Theme.borderRadius.sm,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  quickDateText: {
    color: Theme.colors.primaryLight,
    fontSize: 11,
    fontWeight: "600",
  },
  createBtn: {
    backgroundColor: Theme.colors.primary,
    paddingVertical: 14,
    borderRadius: Theme.borderRadius.md,
    alignItems: "center",
    marginTop: 8,
  },
  createBtnText: {
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
  qrModalScroll: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Theme.spacing.xl,
  },
  // Diseño de Pase Digital Capturable
  passDesignCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: Theme.colors.surfaceContainer,
    borderRadius: Theme.borderRadius.xl,
    padding: Theme.spacing.xl,
    borderWidth: 1.5,
    borderColor: "rgba(59, 130, 246, 0.35)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  passHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  passLogoBadge: {
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
  passHeaderMeta: {
    flex: 1,
  },
  passBrandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  passResidencialName: {
    color: Theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  passVerifiedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Theme.colors.secondary,
  },
  passSubtitle: {
    color: Theme.colors.primaryLight,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: 2,
  },
  passDivider: {
    height: 1,
    backgroundColor: Theme.colors.border,
    marginVertical: Theme.spacing.md,
  },
  passInfoSection: {
    marginBottom: Theme.spacing.md,
  },
  passRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  passCol: {
    flex: 1,
    marginRight: 8,
  },
  passInfoLabel: {
    fontSize: 9,
    color: Theme.colors.textMuted,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  passVisitorName: {
    fontSize: 17,
    fontWeight: "700",
    color: Theme.colors.textPrimary,
    marginTop: 2,
  },
  passUnitBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.colors.surfaceContainerHigh,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: Theme.colors.borderMedium,
  },
  passUnitText: {
    fontSize: 11,
    fontWeight: "700",
    color: Theme.colors.primaryLight,
  },
  passTagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  passTagPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.colors.surfaceContainerLow,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  passTagPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: Theme.colors.textSecondary,
  },
  passQrContainer: {
    alignItems: "center",
    marginVertical: Theme.spacing.sm,
  },
  passQrWrapper: {
    padding: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: Theme.borderRadius.lg,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  passCodeBadge: {
    backgroundColor: Theme.colors.surfaceContainerLow,
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: Theme.borderRadius.md,
    marginTop: 10,
    borderWidth: 1,
    borderColor: Theme.colors.borderMedium,
  },
  passCodeDigits: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 4,
    color: Theme.colors.primaryLight,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  passFooterInfo: {
    backgroundColor: Theme.colors.surfaceContainerLow,
    borderRadius: Theme.borderRadius.md,
    padding: Theme.spacing.md,
    marginTop: Theme.spacing.md,
    gap: 6,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  passMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  passMetaText: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    fontWeight: "500",
  },
  passInstructionBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Theme.spacing.md,
    paddingTop: Theme.spacing.xs,
  },
  passInstructionText: {
    fontSize: 10,
    color: Theme.colors.textMuted,
    textAlign: "center",
    flex: 1,
  },
  qrActionsWrapper: {
    width: "100%",
    maxWidth: 360,
    marginTop: Theme.spacing.lg,
    gap: 10,
  },
  qrShareImageBtn: {
    backgroundColor: Theme.colors.primary,
    paddingVertical: 14,
    borderRadius: Theme.borderRadius.md,
    width: "100%",
    alignItems: "center",
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  qrShareImageBtnText: {
    color: Theme.colors.onPrimary,
    fontWeight: "700",
    fontSize: 14,
  },
  qrShareTextBtn: {
    backgroundColor: "#25D366",
    paddingVertical: 13,
    borderRadius: Theme.borderRadius.md,
    width: "100%",
    alignItems: "center",
  },
  qrShareTextBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  qrCloseBtn: {
    marginTop: Theme.spacing.md,
    padding: 8,
  },
  qrCloseBtnText: {
    color: Theme.colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: "#000000",
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  cameraFrame: {
    width: 240,
    height: 240,
    borderWidth: 2,
    borderColor: Theme.colors.secondary,
    borderRadius: 20,
    backgroundColor: "transparent",
  },
  cameraInstructions: {
    color: Theme.colors.textPrimary,
    marginTop: 24,
    fontSize: 14,
    fontWeight: "600",
  },
  cameraCloseBtn: {
    marginTop: 32,
    backgroundColor: Theme.colors.error,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: Theme.borderRadius.md,
  },
  cameraCloseBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
