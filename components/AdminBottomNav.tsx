import Ionicons from "@expo/vector-icons/Ionicons";
import { usePathname, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS } from "@/constants/colors";

const ADMIN_TABS = [
  {
    label: "Dashboard",
    path: "/admin",
    icon: "grid-outline",
    activeIcon: "grid",
  },
  {
    label: "Users",
    path: "/admin/users",
    icon: "people-outline",
    activeIcon: "people",
  },
  {
    label: "Events",
    path: "/admin/events",
    icon: "calendar-outline",
    activeIcon: "calendar",
  },
  {
    label: "Attendance",
    path: "/admin/attendance",
    icon: "clipboard-outline",
    activeIcon: "clipboard",
  },
  {
    label: "Reports",
    path: "/admin/reports",
    icon: "bar-chart-outline",
    activeIcon: "bar-chart",
  },
] as const;

export default function AdminBottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
    >
      <View style={styles.tabRow}>
        {ADMIN_TABS.map((tab) => {
          const active = pathname === tab.path || pathname === tab.path + "/";

          return (
            <Pressable
              key={tab.path}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: active }}
              onPress={() => {
                if (!active) {
                  router.replace(tab.path);
                }
              }}
              style={styles.tab}
            >
              <Ionicons
                name={active ? tab.activeIcon : tab.icon}
                size={22}
                color={active ? COLORS.primary : COLORS.textSecondary}
              />

              <Text
                numberOfLines={1}
                style={[styles.label, active && styles.activeLabel]}
              >
                {tab.label}
              </Text>

              {active && <View style={styles.indicator} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },

  tabRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingTop: 10,
    paddingHorizontal: 4,
    minHeight: 58,
  },

  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    gap: 5,
  },

  label: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },

  activeLabel: {
    color: COLORS.primary,
    fontWeight: "700",
  },

  indicator: {
    position: "absolute",
    top: -10,
    width: 28,
    height: 3,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
});
