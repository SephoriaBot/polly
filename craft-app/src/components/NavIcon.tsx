import useTheme from "../hooks/useTheme";

// Bottom nav tab icons that swap black/white based on day/night mode.
// Filenames follow the public/icons/<name>black.png / <name>white.png
// convention (e.g. dashboardblack.png, walletwhite.png).
export type NavIconName =
  | "dashboard"
  | "wallet"
  | "planner"
  | "grocery"
  | "tracker"
  | "decisions"
  | "habitat";

export default function NavIcon({ name, size = 35 }: { name: NavIconName; size?: number }) {
  const theme = useTheme();
  const suffix = theme === "dark" ? "white" : "black";

  return (
    <img
      src={`/icons/${name}${suffix}.png`}
      alt={name}
      width={size}
      height={size}
      style={{
        display: "inline-block",
        verticalAlign: "-0.2em",
        objectFit: "contain",
        maxWidth: "none",
      }}
    />
  );
}