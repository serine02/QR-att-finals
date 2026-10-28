import { CameraView, useCameraPermissions } from "expo-camera";
import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import AppButton from "@/components/AppButton";
import { COLORS } from "@/constants/colors";
import { UI } from "@/constants/ui";
import { registerAttendance, syncPendingAttendance } from "@/lib/database";
import { useAuth } from "@/lib/auth";

type ScanStatus = "success" | "error" | "pending" | "loading";

const RESULT_ICONS: Record<
  ScanStatus,
  { icon: keyof typeof Ionicons.glyphMap; color: string; background: string }
> = {
  success: {
    icon: "checkmark-circle",
    color: COLORS.successText,
    background: COLORS.successSoft,
  },
  error: {
    icon: "alert-circle",
    color: COLORS.dangerText,
    background: COLORS.dangerSoft,
  },
  pending: {
    icon: "cloud-upload-outline",
    color: COLORS.warning,
    background: COLORS.warningSoft,
  },
  loading: {
    icon: "hourglass-outline",
    color: COLORS.primary,
    background: COLORS.surface,
  },
};

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
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.centeredText}>Preparing camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <View style={styles.permissionIcon}>
          <Ionicons name="camera-outline" size={30} color={COLORS.primary} />
        </View>

        <Text style={styles.centeredTitle}>Camera Permission Needed</Text>

        <Text style={styles.centeredText}>
          Allow camera access to scan school event QR codes.
        </Text>

        <View style={styles.permissionAction}>
          <AppButton
            theme="primary"
            title="Grant Permission"
            icon="camera"
            onPress={requestPermission}
          />
        </View>
      </View>
    );
  }

  const resultVisual = RESULT_ICONS[status];

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

      {!scanned && (
        <View style={styles.scanFrame} pointerEvents="none">
          <View style={styles.scanFrameInner} />
        </View>
      )}

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
            <View
              style={[
                styles.resultIcon,
                { backgroundColor: resultVisual.background },
              ]}
            >
              {status === "loading" ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Ionicons
                  name={resultVisual.icon}
                  size={26}
                  color={resultVisual.color}
                />
              )}
            </View>

            <Text
              style={[
                styles.resultTitle,
                { color: resultVisual.color },
              ]}
            >
              {title}
            </Text>

            <Text style={styles.resultMessage}>{message}</Text>

            {status !== "loading" && (
              <View style={styles.resultAction}>
                <AppButton
                  theme="primary"
                  title="Scan Again"
                  icon="refresh"
                  onPress={resetScanner}
                />
              </View>
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
    paddingHorizontal: UI.space.xl,
  },

  camera: {
    ...StyleSheet.absoluteFillObject,
  },

  centered: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: UI.space.xl,
  },

  centeredTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textPrimary,
    textAlign: "center",
    marginTop: UI.space.lg,
    marginBottom: UI.space.sm,
  },

  centeredText: {
    fontSize: UI.typography.body,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 21,
    marginTop: UI.space.sm,
  },

  permissionIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
  },

  permissionAction: {
    alignSelf: "stretch",
    marginTop: UI.space.lg,
  },

  scanFrame: {
    position: "absolute",
    top: "12%",
    left: 40,
    right: 40,
    height: 240,
  },

  scanFrameInner: {
    flex: 1,
    borderRadius: UI.radius.large,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.85)",
  },

  overlay: {
    position: "absolute",
    left: UI.space.lg,
    right: UI.space.lg,
    bottom: 60,
    backgroundColor: COLORS.card,
    borderRadius: UI.radius.large,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  title: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textPrimary,
    textAlign: "center",
    marginBottom: UI.space.sm,
  },

  subtitle: {
    fontSize: UI.typography.body,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 21,
    marginTop: UI.space.xs,
  },

  resultIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: UI.space.md,
  },

  resultTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: UI.space.xs,
  },

  resultMessage: {
    fontSize: UI.typography.body,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: UI.space.md,
  },

  resultAction: {
    alignSelf: "stretch",
  },

  signInSection: {
    marginTop: UI.space.md,
    width: "100%",
  },
});
