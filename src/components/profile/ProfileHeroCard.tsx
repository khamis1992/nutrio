import type { ReactNode } from "react";

import profileCardArtwork from "@/assets/profile/profile-card.webp";
import { cn } from "@/lib/utils";

type ProfileHeroCardProps = {
  avatar: ReactNode;
  displayName: string;
  subtitle: string;
  plan: string;
  points: number;
  achievements: number;
  memberSince: string;
  className?: string;
};

export function ProfileHeroCard({
  avatar,
  displayName,
  subtitle,
  plan,
  points,
  achievements,
  memberSince,
  className,
}: ProfileHeroCardProps) {
  return (
    <section
      className={cn(
        "relative aspect-[1179/506] w-full overflow-hidden rounded-[24px] border border-[#0C1222]/15 bg-[linear-gradient(110deg,#F6F7F8_0%,#F8F7F9_54%,#F0F1F8_100%)] shadow-[0_10px_28px_rgba(12,18,34,0.07)]",
        className,
      )}
      aria-label={`${displayName} profile summary`}
    >
      <img
        src={profileCardArtwork}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 h-full w-full select-none object-contain"
        draggable={false}
      />

      <div className="absolute left-[2.5%] top-[2.2%] z-10 aspect-square w-[21.3%]">
        {avatar}
      </div>

      <div className="absolute left-[31.8%] top-[10%] z-10 flex h-[10.2%] w-[11.2%] items-center justify-center">
        <span className="block max-w-full truncate text-[clamp(7px,2.25vw,10px)] font-extrabold text-[#5C63E8]">
          {plan}
        </span>
      </div>

      <div className="absolute left-[27%] top-[29.5%] z-10 w-[60%]">
        <h2 className="truncate text-[clamp(15px,4.8vw,21px)] font-black leading-none tracking-[-0.03em] text-[#08172E]">
          {displayName}
        </h2>
        <p className="mt-1.5 truncate text-[clamp(8px,2.65vw,11px)] font-semibold text-[#64748B]">
          {subtitle}
        </p>
      </div>

      <ProfileMetricValue
        label="Points"
        value={Math.max(0, points).toLocaleString()}
        className="left-[15.4%] top-[75.2%] w-[13.5%] text-[#F06400]"
      />
      <ProfileMetricValue
        label="Achievements"
        value={Math.max(0, achievements).toLocaleString()}
        className="left-[48.2%] top-[75.2%] w-[15.6%] text-[#655BEF]"
      />
      <ProfileMetricValue
        label="Member since"
        value={memberSince || "-"}
        className="left-[80.6%] top-[75.2%] w-[14.2%] text-[#087FD5]"
        compact
      />
    </section>
  );
}

function ProfileMetricValue({
  label,
  value,
  className,
  compact = false,
}: {
  label: string;
  value: string;
  className: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "absolute z-10 flex h-[10.7%] items-center justify-center text-center font-black leading-none",
        compact
          ? "text-[clamp(7px,2.1vw,9.5px)] tracking-[-0.02em]"
          : "text-[clamp(12px,3.8vw,17px)]",
        className,
      )}
      aria-label={`${label}: ${value}`}
    >
      <span className="block max-w-full truncate">{value}</span>
    </div>
  );
}
