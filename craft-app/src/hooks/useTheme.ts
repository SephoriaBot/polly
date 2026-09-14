import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

function readTheme(): Theme {
  return (document.documentElement.getAttribute("data-theme") as Theme) || "light";
}

// Tracks the app's day/night mode by watching the data-theme attribute
// on <html>. Shared by anything that needs to swap a black/white asset
// based on theme (page title logos, bottom nav icons, etc).
export default function useTheme(): Theme {
  const [theme, setTheme] = useState<Theme>(readTheme());

  useEffect(() => {
    const el = document.documentElement;
    const observer = new MutationObserver(() => setTheme(readTheme()));
    observer.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return theme;
}