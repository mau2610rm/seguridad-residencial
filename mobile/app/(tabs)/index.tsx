import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { Theme } from "../../constants/theme";

export default function Home() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case "admin_residencial":
        return "Administrador Residencial";
      case "guardia":
        return "Oficial de Seguridad / Guardia";
      case "residente":
        return "Residente Propietario";
      default:
        return role || "Usuario";
    }
  };

  return (
    <View style={styles.container}>
      {/* Header Security Status Badge */}
      <View style={styles.statusBanner}>
        <View style={styles.statusIndicator}>
          <View style={styles.statusDot} />
          <Ionicons name="shield-checkmark" size={16} color={Theme.colors.secondary} />
          <Text style={styles.statusText}>Sistema Seguro • Monitoreo Activo</Text>
        </View>
        <View style={styles.instantTag}>
          <Ionicons name="flash" size={12} color={Theme.colors.primaryLight} />
          <Text style={styles.instantTagText}>Residia Core</Text>
        </View>
      </View>

      {/* Main Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatarRow}>
          {user?.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={28} color={Theme.colors.primaryLight} />
            </View>
          )}
          <View style={styles.profileMeta}>
            <Text style={styles.greeting}>{user?.name || user?.email?.split("@")[0]}</Text>
            <Text style={styles.emailText}>{user?.email}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{getRoleLabel(user?.role)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Telemetry info chips */}
        <View style={styles.infoRow}>
          <View style={styles.infoTile}>
            <View style={styles.tileIconBadge}>
              <Ionicons name="business" size={16} color={Theme.colors.primary} />
            </View>
            <View>
              <Text style={styles.tileLabel}>Residencial</Text>
              <Text style={styles.tileValue} numberOfLines={1}>
                {user?.residencial?.nombre || "Principal"}
              </Text>
            </View>
          </View>

          <View style={styles.infoTile}>
            <View style={styles.tileIconBadge}>
              <Ionicons name="home" size={16} color={Theme.colors.secondary} />
            </View>
            <View>
              <Text style={styles.tileLabel}>Unidad</Text>
              <Text style={styles.tileValue} numberOfLines={1}>
                {user?.unit ? `Unidad ${user.unit.number}` : "Asignada"}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Security Quick Guarantee Tile */}
      <View style={styles.amenityCard}>
        <View style={styles.amenityIconContainer}>
          <Ionicons name="lock-closed" size={22} color={Theme.colors.secondary} />
        </View>
        <View style={styles.amenityInfo}>
          <View style={styles.amenityHeader}>
            <View style={styles.greenPulseDot} />
            <Text style={styles.amenityTag}>Control Perimetral 24/7</Text>
          </View>
          <Text style={styles.amenityTitle}>Accesos y Pases Cifrados</Text>
          <Text style={styles.amenitySubtitle}>
            Tokens criptográficos de un solo uso para visitantes y personal.
          </Text>
        </View>
      </View>

      {/* Logout Action Button */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
        <Ionicons name="log-out-outline" size={18} color={Theme.colors.errorLight} style={{ marginRight: 8 }} />
        <Text style={styles.logoutText}>Cerrar Sesión</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    padding: Theme.spacing.lg,
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Theme.spacing.md,
  },
  statusIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Theme.colors.secondary,
  },
  statusText: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    fontWeight: "500",
  },
  instantTag: {
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
  instantTagText: {
    fontSize: 11,
    color: Theme.colors.primaryLight,
    fontWeight: "600",
  },
  profileCard: {
    backgroundColor: Theme.colors.surfaceContainer,
    borderRadius: Theme.borderRadius.xl,
    padding: Theme.spacing.lg,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    marginBottom: Theme.spacing.md,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: Theme.colors.primary,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderWidth: 1.5,
    borderColor: Theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  profileMeta: {
    marginLeft: Theme.spacing.md,
    flex: 1,
  },
  greeting: {
    fontSize: 19,
    fontWeight: "700",
    color: Theme.colors.textPrimary,
    letterSpacing: -0.3,
  },
  emailText: {
    fontSize: 12,
    color: Theme.colors.textMuted,
    marginTop: 1,
  },
  roleBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(59, 130, 246, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Theme.borderRadius.sm,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.25)",
  },
  roleText: {
    fontSize: 11,
    fontWeight: "600",
    color: Theme.colors.primaryLight,
  },
  divider: {
    height: 1,
    backgroundColor: Theme.colors.border,
    marginVertical: Theme.spacing.md,
  },
  infoRow: {
    flexDirection: "row",
    gap: Theme.spacing.md,
  },
  infoTile: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.colors.surfaceContainerLow,
    padding: Theme.spacing.md,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  tileIconBadge: {
    width: 32,
    height: 32,
    borderRadius: Theme.borderRadius.sm,
    backgroundColor: Theme.colors.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Theme.spacing.sm,
  },
  tileLabel: {
    fontSize: 11,
    color: Theme.colors.textMuted,
    fontWeight: "500",
  },
  tileValue: {
    fontSize: 13,
    color: Theme.colors.textPrimary,
    fontWeight: "600",
  },
  amenityCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.colors.surfaceContainerLow,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    marginBottom: Theme.spacing.xl,
  },
  amenityIconContainer: {
    width: 44,
    height: 44,
    borderRadius: Theme.borderRadius.md,
    backgroundColor: Theme.colors.secondaryContainer,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Theme.spacing.md,
  },
  amenityInfo: {
    flex: 1,
  },
  amenityHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  greenPulseDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Theme.colors.secondary,
  },
  amenityTag: {
    fontSize: 11,
    fontWeight: "600",
    color: Theme.colors.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  amenityTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Theme.colors.textPrimary,
  },
  amenitySubtitle: {
    fontSize: 12,
    color: Theme.colors.textMuted,
    marginTop: 1,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.colors.surfaceContainer,
    paddingVertical: 14,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    marginTop: "auto",
  },
  logoutText: {
    color: Theme.colors.errorLight,
    fontSize: 14,
    fontWeight: "600",
  },
});
