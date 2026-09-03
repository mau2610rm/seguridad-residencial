import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";

export default function Home() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <View style={styles.container}>
      {user?.avatarUrl ? (
        <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
      ) : null}
      <Text style={styles.greeting}>Hola, {user?.name || user?.email}</Text>
      <Text style={styles.role}>Rol: {user?.role}</Text>
      {user?.residencial && (
        <Text style={styles.residencial}>{user.residencial.nombre}</Text>
      )}
      {user?.unit && (
        <Text style={styles.unit}>Unidad: {user.unit.number}</Text>
      )}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
    padding: 24,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "#4a90d9",
  },
  greeting: {
    fontSize: 22,
    color: "#fff",
    fontWeight: "600",
    marginBottom: 8,
  },
  role: {
    fontSize: 16,
    color: "#a0a0a0",
    marginBottom: 4,
  },
  residencial: {
    fontSize: 16,
    color: "#a0a0a0",
    marginBottom: 4,
  },
  unit: {
    fontSize: 16,
    color: "#a0a0a0",
    marginBottom: 32,
  },
  logoutBtn: {
    backgroundColor: "#e74c3c",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  logoutText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
