import { useState, useCallback } from "react";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

import AppButton from "@/components/AppButton";
import Header from "@/components/Header";
import { COLORS } from "@/constants/colors";
import { UI } from "@/constants/ui";

export default function Index() {
  const [now, setNow] = useState(new Date());

  useFocusEffect(
    useCallback(() => {
      setNow(new Date());
    }, []),
  );

  const hour = now.getHours();

  const greeting =
    hour < 12
      ? "Good Morning!"
      : hour < 18
        ? "Good Afternoon!"
        : "Good Evening!";

  const currentDate = now.toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerContainer}>
          <Header title="QR Attendance" />
        </View>

        <View style={styles.welcomeSection}>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.date}>{currentDate}</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>School Event Attendance</Text>

          <Text style={styles.cardDescription}>
            Easily record your attendance during school activities by scanning
            the event QR code.
          </Text>
        </View>

        <View style={styles.actionSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>

          <AppButton
            theme="primary"
            title="Scan QR Code"
            icon="qr-code-outline"
            onPress={() => router.push("/scan")}
          />

          <AppButton
            title="Attendance History"
            icon="time-outline"
            onPress={() => router.push("/history")}
          />

          <AppButton
            title="My Profile"
            icon="person-outline"
            onPress={() => router.push("/profile")}
          />
        </View>

        <View style={styles.tipCard}>
          <View style={styles.tipIconRow}>
            <Text style={styles.tipTitle}>Attendance Reminder</Text>
          </View>

          <Text style={styles.tipText}>
            Make sure to scan the correct event QR code during the scheduled
            attendance period.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: UI.space.xl,
    paddingBottom: UI.space.xl + 16,
  },

  headerContainer: {
    alignItems: "center",
    marginTop: UI.space.lg,
    marginBottom: UI.space.xl,
  },

  welcomeSection: {
    marginBottom: UI.space.xl,
  },

  greeting: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },

  date: {
    fontSize: UI.typography.body,
    color: COLORS.textSecondary,
    marginTop: 6,
  },

  infoCard: {
    ...UI.card,
    padding: UI.space.lg,
    marginBottom: UI.space.xl,
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.primary,
    marginBottom: UI.space.sm,
  },

  cardDescription: {
    fontSize: UI.typography.body,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },

  actionSection: {
    gap: UI.space.md,
    marginBottom: UI.space.xl,
  },

  sectionTitle: {
    fontSize: UI.typography.section,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 4,
  },

  tipCard: {
    backgroundColor: COLORS.surface,
    borderRadius: UI.radius.large,
    padding: UI.space.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  tipIconRow: {
    marginBottom: UI.space.sm,
  },

  tipTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.primary,
  },

  tipText: {
    fontSize: UI.typography.caption + 1,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
});
