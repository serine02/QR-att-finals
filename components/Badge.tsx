import { StyleSheet, Text, View } from "react-native";

import { COLORS } from "@/constants/colors";

export type BadgeTone =
  | "confirmed"
  | "pending"
  | "upcoming"
  | "ongoing"
  | "ended"
  | "unscheduled"
  | "info"
  | "neutral";

type Props = {
  label: string;
  tone?: BadgeTone;
};

const TONE_STYLES: Record<
  BadgeTone,
  { background: string; color: string }
> = {
  confirmed: {
    background: COLORS.successSoft,
    color: COLORS.successText,
  },
  pending: {
    background: COLORS.warningSoft,
    color: COLORS.warning,
  },
  upcoming: {
    background: COLORS.infoSoft,
    color: COLORS.info,
  },
  ongoing: {
    background: COLORS.successSoft,
    color: COLORS.successText,
  },
  ended: {
    background: COLORS.surface,
    color: COLORS.textSecondary,
  },
  unscheduled: {
    background: COLORS.warningSoft,
    color: COLORS.warning,
  },
  info: {
    background: COLORS.infoSoft,
    color: COLORS.info,
  },
  neutral: {
    background: COLORS.surface,
    color: COLORS.primary,
  },
};

export default function Badge({ label, tone = "neutral" }: Props) {
  const toneStyle = TONE_STYLES[tone];

  return (
    <View style={[styles.badge, { backgroundColor: toneStyle.background }]}>
      <Text style={[styles.label, { color: toneStyle.color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: "flex-start",
  },

  label: {
    fontSize: 11,
    fontWeight: "700",
  },
});
