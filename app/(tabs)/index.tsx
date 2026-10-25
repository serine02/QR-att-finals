import { useState, useCallback } from "react";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

import AppButton from "@/components/AppButton";
import Header from "@/components/Header";
import { COLORS } from "@/constants/colors";

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
          <Text style={styles.tipTitle}>Attendance Reminder</Text>

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
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  headerContainer: {
    alignItems: "center",
    marginTop: 24,
    marginBottom: 30,
  },

  welcomeSection: {
    marginBottom: 24,
  },

  greeting: {
    fontSize: 26,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },

  date: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 6,
  },

  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 28,
  },

  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.primary,
    marginBottom: 10,
  },

  cardDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },

  actionSection: {
    gap: 14,
    marginBottom: 28,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 4,
  },

  tipCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  tipTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.primary,
    marginBottom: 8,
  },

  tipText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
});
