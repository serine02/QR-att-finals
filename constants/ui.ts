import { COLORS } from "@/constants/colors";

export const UI = {
  radius: {
    small: 10,
    medium: 14,
    large: 18,
    pill: 999,
  },

  space: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },

  typography: {
    page: 24,
    section: 18,
    body: 14,
    caption: 12,
  },

  screen: {
    backgroundColor: COLORS.background,
    flex: 1 as const,
  },

  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 16,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
} as const;
