import { assetPath } from "@/lib/asset-path";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showTagline?: boolean;
  className?: string;
  variant?: "light" | "dark";
  animated?: boolean;
}

const sizeMap: Record<NonNullable<LogoProps["size"]>, string> = {
  sm: "h-8",
  md: "h-12",
  lg: "h-16",
  xl: "h-24",
};

export const Logo = ({
  size = "md",
  className = "",
  animated = false,
}: LogoProps) => {
  return (
    <img
      src={assetPath("/logo.png")}
      alt="Nutrio"
      className={`${sizeMap[size]} w-auto object-contain ${animated ? "animate-in fade-in zoom-in-95 duration-500" : ""} ${className}`}
    />
  );
};

export default Logo;
