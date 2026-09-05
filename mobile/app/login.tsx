import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { Theme } from "../constants/theme";

WebBrowser.maybeCompleteAuthSession();

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const { login, loginWithGoogle } = useAuth();
  const router = useRouter();

  const GOOGLE_WEB_CLIENT_ID =
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "demo-seguridad-residencial.apps.googleusercontent.com";
  const isRealGoogleConfigured =
    !!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID &&
    !process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.includes("demo-");

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || GOOGLE_WEB_CLIENT_ID,
  });

  const handleGoogleLogin = async (idToken: string) => {
    setGoogleSubmitting(true);
    try {
      await loginWithGoogle(idToken);
      router.replace("/(tabs)");
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : "Error al iniciar sesión con Google";
      Alert.alert("Acceso denegado", message || "No fue posible autenticar con Google.");
    } finally {
      setGoogleSubmitting(false);
    }
  };

  useEffect(() => {
    if (response?.type === "success") {
      const { authentication } = response;
      const idToken = authentication?.idToken;
      if (idToken) {
        handleGoogleLogin(idToken);
      }
    }
  }, [response]);

  const handleGooglePress = async () => {
    if (isRealGoogleConfigured) {
      promptAsync();
    } else {
      Alert.alert(
        "Google Sign-In (Modo Prueba)",
        "Para conectar Google real, define EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID en mobile/.env.\n\nSelecciona una opción para probar la integración:",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Residente registrado (OK)",
            onPress: () => handleGoogleLogin("dev-mock:residente@demo.com"),
          },
          {
            text: "Cuenta desconocida (403)",
            onPress: () => handleGoogleLogin("dev-mock:usuario_ajeno@gmail.com"),
          },
        ]
      );
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Error", "Ingresa email y contraseña");
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace("/(tabs)");
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : "Error al iniciar sesión";
      Alert.alert("Error", message || "Credenciales inválidas");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.card}>
        <View style={styles.logoBadge}>
          <Ionicons name="shield-checkmark" size={32} color={Theme.colors.primary} />
        </View>

        <Text style={styles.title}>Residia</Text>
        <Text style={styles.subtitle}>Seguridad Residencial & Control de Acceso</Text>

        <View style={styles.inputContainer}>
          <Ionicons name="mail-outline" size={20} color={Theme.colors.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Correo electrónico"
            placeholderTextColor={Theme.colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!submitting && !googleSubmitting}
          />
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed-outline" size={20} color={Theme.colors.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Contraseña"
            placeholderTextColor={Theme.colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!submitting && !googleSubmitting}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, submitting && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={submitting || googleSubmitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color={Theme.colors.onPrimary} />
          ) : (
            <View style={styles.buttonContent}>
              <Ionicons name="log-in-outline" size={20} color={Theme.colors.onPrimary} style={{ marginRight: 8 }} />
              <Text style={styles.buttonText}>Iniciar Sesión</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>o autenticar con</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={[styles.googleButton, googleSubmitting && styles.buttonDisabled]}
          onPress={handleGooglePress}
          disabled={submitting || googleSubmitting}
          activeOpacity={0.85}
        >
          {googleSubmitting ? (
            <ActivityIndicator color={Theme.colors.surface} />
          ) : (
            <View style={styles.googleContent}>
              <Ionicons name="logo-google" size={20} color="#EA4335" style={{ marginRight: 10 }} />
              <Text style={styles.googleButtonText}>Continuar con Google</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    justifyContent: "center",
    padding: Theme.spacing.xxl,
  },
  card: {
    backgroundColor: Theme.colors.surfaceContainer,
    borderRadius: Theme.borderRadius.xl,
    padding: Theme.spacing.xxl,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    alignItems: "center",
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: Theme.borderRadius.lg,
    backgroundColor: Theme.colors.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.borderMedium,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: Theme.colors.textPrimary,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: Theme.colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
    marginBottom: Theme.spacing.xxl,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.colors.surfaceContainerLow,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
    width: "100%",
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    color: Theme.colors.textPrimary,
    fontSize: 15,
  },
  button: {
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.borderRadius.md,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginTop: 6,
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    color: Theme.colors.onPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: Theme.spacing.xl,
    width: "100%",
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Theme.colors.border,
  },
  dividerText: {
    color: Theme.colors.textMuted,
    paddingHorizontal: Theme.spacing.md,
    fontSize: 12,
  },
  googleButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: Theme.borderRadius.md,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  googleContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  googleButtonText: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "600",
  },
});
