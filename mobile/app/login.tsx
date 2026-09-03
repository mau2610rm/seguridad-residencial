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
import { useAuth } from "../context/AuthContext";

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
      // Modo desarrollo asistido: Permite probar la autenticación y el rechazo 403 sin requerir credenciales inmediatas de Google Cloud
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
        <Text style={styles.title}>Seguridad Residencial</Text>
        <Text style={styles.subtitle}>Inicia sesión</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#888"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!submitting && !googleSubmitting}
        />
        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          placeholderTextColor="#888"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!submitting && !googleSubmitting}
        />
        <TouchableOpacity
          style={[styles.button, submitting && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={submitting || googleSubmitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Entrar con Email</Text>
          )}
        </TouchableOpacity>

        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>o bien</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={[styles.googleButton, googleSubmitting && styles.buttonDisabled]}
          onPress={handleGooglePress}
          disabled={submitting || googleSubmitting}
        >
          {googleSubmitting ? (
            <ActivityIndicator color="#1a1a2e" />
          ) : (
            <View style={styles.googleContent}>
              <View style={styles.googleBadge}>
                <Text style={styles.googleBadgeText}>G</Text>
              </View>
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
    backgroundColor: "#1a1a2e",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#16213e",
    borderRadius: 16,
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: "#a0a0a0",
    textAlign: "center",
    marginBottom: 24,
  },
  input: {
    backgroundColor: "#0f3460",
    borderRadius: 12,
    padding: 14,
    color: "#fff",
    fontSize: 16,
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#4a90d9",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#2a3b5c",
  },
  dividerText: {
    color: "#888",
    paddingHorizontal: 12,
    fontSize: 13,
  },
  googleButton: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  googleContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  googleBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#ea4335",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  googleBadgeText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  googleButtonText: {
    color: "#1a1a2e",
    fontSize: 16,
    fontWeight: "600",
  },
});
