import useTheme from "../hooks/useTheme";

const icons = {
  polly: { light: "/icons/polly_black.png", dark: "/icons/polly_white.png" },
  wallet: { light: "/icons/wallet_black.png", dark: "/icons/wallet_white.png" },
  groceries: { light: "/icons/groceries_black.png", dark: "/icons/groceries_white.png" },
  planner: { light: "/icons/planner_black.png", dark: "/icons/planner_white.png" },
  habitat: { light: "/icons/habitat_black.png", dark: "/icons/habitat_white.png" },
  decisions: { light: "/icons/decisions_black.png", dark: "/icons/decisions_white.png" },
  tracker: { light: "/icons/tracker_black.png", dark: "/icons/tracker_white.png" },
} as const;

type IconName = keyof typeof icons;

export default function PageTitleLogo({ name, height = 32 }: { name: IconName; height?: number }) {
  const theme = useTheme();

  return (
    <img
      src={icons[name][theme]}
      alt={name}
      style={{ height, width: "auto", display: "flex" }}
    />
  );
}