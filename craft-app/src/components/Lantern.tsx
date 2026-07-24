import React from "react";

type LanternProps = {
  size?: number;
  className?: string;
  /** "accent" = flanks a title (small, sits inline). "divider" = replaces a StitchDivider (line + lantern + line). */
  variant?: "accent" | "divider";
};

export default function Lantern({ size, className = "", variant = "accent" }: LanternProps) {
  const resolvedSize = size ?? (variant === "divider" ? 32 : 45);

  const img = (
    <img
      src="/assets/Lantern.png"
      alt="Lantern decoration"
      className={`lantern-img ${className}`}
      style={{
        width: resolvedSize,
        height: "auto",
        pointerEvents: "none",
      }}
    />
  );

  if (variant === "divider") {
    return (
      <div className="lantern-divider">
        <span className="line" />
        {img}
        <span className="line" />
      </div>
    );
  }

  return img;
}