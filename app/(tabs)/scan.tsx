import { CameraView, useCameraPermissions } from "expo-camera";
import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";

import AppButton from "@/components/AppButton";
import { COLORS } from "@/constants/colors";
import { registerAttendance, syncPendingAttendance } from "@/lib/database";
import { useAuth } from "@/lib/auth";

type ScanStatus = "success" | "error" | "pending" | "loading";

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();

  const [scanned, setScanned] = useState(false);
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<ScanStatus>("loading");

  const { user, loading } = useAuth();
  const router = useRouter();

  // Sync offline attendance when this screen opens.
  useFocusEffect(
    useCallback(() => {
      if (!user) return;

      syncPendingAttendance()
        .then((count) => {
          if (count > 0) {
            console.log(`${count} attendance record(s) synced.`);
          }
        })
        .catch((error) => {
          console.log("Offline sync unavailable:", error);
        });
    }, [user]),
  );

  const getResultTitle = (text: string) => {
    const result = text.toLowerCase();

    if (result.includes("saved offline")) {
      return "Pending Sync";
    }

    if (result.includes("already registered")) {
      return "Already Scanned";
    }

    if (result.includes("not started")) {
      return "Event Not Started";
    }

    if (result.includes("already ended")) {
      return "Event Ended";
    }

    if (result.includes("invalid") || result.includes("unknown event")) {
      return "Invalid QR Code";
    }

    if (result.includes("attendance recorded")) {
      return "Attendance Recorded!";
    }

    return "Scan Result";
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;

    setScanned(true);

    if (loading || !user) {
      setTitle("Sign In Required");
      setMessage("Please sign in before scanning an event QR code.");
      setStatus("error");
      return;
    }

    setTitle("Processing QR Code");
    setMessage("Please wait while we check your attendance.");
    setStatus("loading");

    try {
      const result = await registerAttendance(data, user.id);

      setTitle(getResultTitle(result.message));
      setMessage(result.message);

      if (result.message.toLowerCase().includes("saved offline")) {
        setStatus("pending");
      } else {
        setStatus(result.success ? "success" : "error");
      }
    } catch (error) {
      console.error("QR scan error:", error);

      setTitle("Scan Failed");
      setMessage(
        "Something went wrong while processing the QR code. Please try again.",
      );
      setStatus("error");
    }
  };

  const resetScanner = () => {
    setScanned(false);
    setMessage("");
    setTitle("");
    setStatus("loading");
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.subtitle}>Preparing camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Camera Permission Needed</Text>

        <Text style={styles.subtitle}>
          Allow camera access to scan school event QR codes.
        </Text>

        <AppButton
          theme="primary"
          title="Grant Permission"
          icon="camera"
          onPress={requestPermission}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />

      <View style={styles.overlay}>
        {!scanned ? (
          <>
            <Text style={styles.title}>Scan Event QR Code</Text>

            <Text style={styles.subtitle}>
              Point your camera at the QR code provided by your teacher.
            </Text>
          </>
        ) : (
          <>
            <Text
              style={[
                styles.resultTitle,
                status === "success" && styles.success,
                status === "error" && styles.error,
                status === "pending" && styles.pending,
              ]}
            >
              {title}
            </Text>

            {status === "loading" && (
              <ActivityIndicator
                size="large"
                color={COLORS.primary}
                style={styles.loader}
              />
            )}

            <Text style={styles.resultMessage}>{message}</Text>

            {status !== "loading" && (
              <AppButton
                theme="primary"
                title="Scan Again"
                icon="refresh"
                onPress={resetScanner}
              />
            )}
          </>
        )}

        {!user && !loading && (
          <View style={styles.signInSection}>
            <AppButton
              title="Sign In"
              icon="log-in-outline"
              onPress={() => router.push("/login")}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },

  camera: {
    ...StyleSheet.absoluteFillObject,
  },

  overlay: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 60,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  title: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textPrimary,
    textAlign: "center",
    marginBottom: 10,
  },

  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 21,
    marginTop: 8,
  },

  resultTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 10,
    color: COLORS.primary,
  },

  resultMessage: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 18,
  },

  loader: {
    marginVertical: 12,
  },

  success: {
    color: "#2E7D32",
  },

  error: {
    color: "#C62828",
  },

  pending: {
    color: "#B7791F",
  },

  signInSection: {
    marginTop: 14,
    width: "100%",
  },
});
