import { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";

interface Payment {
  id: string;
  concept: string;
  amount: number;
  dueDate: string;
  status: string;
  unit: { number: string };
}

export default function Payments() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

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

  const confirmPayment = async (id: string) => {
    if (user?.role !== "admin_residencial") return;
    setConfirmingId(id);
    try {
      await api.post(`/payments/${id}/confirm`);
      fetchPayments();
    } catch {
      Alert.alert("Error", "No se pudo confirmar el pago");
    } finally {
      setConfirmingId(null);
    }
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
      <FlatList
        data={payments}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPayments(); }} />
        }
        renderItem={({ item }) => (
          <View style={[styles.card, item.status === "pagado" && styles.cardPaid]}>
            <View style={styles.row}>
              <Text style={styles.concept}>{item.concept}</Text>
              <Text style={[styles.status, item.status === "pagado" && styles.statusPaid]}>{item.status}</Text>
            </View>
            <Text style={styles.amount}>${item.amount.toFixed(2)}</Text>
            <Text style={styles.meta}>Unidad {item.unit?.number} · Vence: {new Date(item.dueDate).toLocaleDateString()}</Text>
            {user?.role === "admin_residencial" && item.status === "pendiente" && (
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={() => confirmPayment(item.id)}
                disabled={!!confirmingId}
              >
                {confirmingId === item.id ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.confirmBtnText}>Confirmar pago</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1a1a2e", padding: 16 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#1a1a2e" },
  card: { backgroundColor: "#16213e", borderRadius: 12, padding: 16, marginBottom: 12 },
  cardPaid: { opacity: 0.8 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  concept: { fontSize: 16, color: "#fff", fontWeight: "600" },
  status: { fontSize: 12, color: "#f39c12" },
  statusPaid: { color: "#27ae60" },
  amount: { fontSize: 20, color: "#4a90d9", fontWeight: "700", marginVertical: 4 },
  meta: { fontSize: 12, color: "#888" },
  confirmBtn: { backgroundColor: "#27ae60", padding: 10, borderRadius: 8, alignItems: "center", marginTop: 10 },
  confirmBtnText: { color: "#fff", fontWeight: "600" },
});
