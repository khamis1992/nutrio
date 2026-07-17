import { useState } from "react";
import {
  Check,
  Copy,
  Crown,
  Loader2,
  LogOut,
  ShieldPlus,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useChallengeTeam } from "@/hooks/useChallengeTeam";
import { normalizeTeamCode } from "@/lib/challenge-teams";

type TeamAction = "create" | "join" | "leave" | null;

interface ChallengeTeamSectionProps {
  challengeId: string;
  isJoined: boolean;
  targetValue: number;
}

export function ChallengeTeamSection({
  challengeId,
  isJoined,
  targetValue,
}: ChallengeTeamSectionProps) {
  const [action, setAction] = useState<TeamAction>(null);
  const [teamName, setTeamName] = useState("");
  const [teamCode, setTeamCode] = useState("");
  const [copied, setCopied] = useState(false);
  const { data, isLoading, createTeam, joinTeam, leaveTeam } = useChallengeTeam(
    challengeId,
    isJoined,
  );

  if (!isJoined) {
    return (
      <div className="mt-3 flex items-center gap-3 border-t border-[#E5EAF1] pt-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[17px] bg-[#F4F3FF] text-[#7C83F6]">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[13px] font-black text-[#020617]">Compete as a team</p>
          <p className="mt-0.5 text-[11px] font-semibold text-[#94A3B8]">
            Join the challenge first, then create or join a team.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mt-3 flex h-20 items-center justify-center border-t border-[#E5EAF1] pt-3">
        <Loader2 className="h-5 w-5 animate-spin text-[#7C83F6]" />
      </div>
    );
  }

  const team = data?.team;
  const members = data?.members ?? [];
  const leaderboard = data?.leaderboard ?? [];

  const submit = async () => {
    try {
      if (action === "create") {
        await createTeam.mutateAsync(teamName.trim());
        toast.success("Your team is ready");
      } else if (action === "join") {
        await joinTeam.mutateAsync(teamCode);
        toast.success("You joined the team");
      } else if (action === "leave" && team) {
        await leaveTeam.mutateAsync(team.id);
        toast.success("You left the team");
      }
      setAction(null);
      setTeamName("");
      setTeamCode("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Team action failed");
    }
  };

  const copyCode = async () => {
    if (!team?.join_code) return;
    await navigator.clipboard.writeText(team.join_code);
    setCopied(true);
    toast.success("Team code copied");
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="mt-3 border-t border-[#E5EAF1] pt-4">
      {!team ? (
        <>
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[17px] bg-[#F4F3FF] text-[#7C83F6]">
              <Users className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-black text-[#020617]">Choose your team</p>
              <p className="mt-0.5 text-[11px] font-semibold leading-4 text-[#94A3B8]">
                Your progress counts toward one team in this challenge.
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAction("create")}
              className="flex h-12 items-center justify-center gap-2 rounded-[18px] bg-[#020617] px-3 text-[12px] font-black text-white active:scale-[0.98]"
            >
              <ShieldPlus className="h-4 w-4" />
              Create team
            </button>
            <button
              type="button"
              onClick={() => setAction("join")}
              className="flex h-12 items-center justify-center gap-2 rounded-[18px] bg-[#F6F8FB] px-3 text-[12px] font-black text-[#020617] ring-1 ring-[#E5EAF1] active:scale-[0.98]"
            >
              <UserPlus className="h-4 w-4 text-[#7C83F6]" />
              Join by code
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-[#F4F3FF] text-[#7C83F6]">
              <Crown className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-black text-[#020617]">{team.name}</p>
              <p className="mt-0.5 text-[11px] font-bold text-[#94A3B8]">
                Rank #{team.rank} / {team.member_count}/{data?.team_size ?? 5} members
              </p>
            </div>
            <button
              type="button"
              onClick={copyCode}
              className="flex h-11 items-center gap-1.5 rounded-[16px] bg-[#F6F8FB] px-3 text-[11px] font-black text-[#020617] ring-1 ring-[#E5EAF1] active:scale-95"
              aria-label="Copy team invite code"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-[#22C7A1]" /> : <Copy className="h-3.5 w-3.5 text-[#7C83F6]" />}
              {team.join_code}
            </button>
          </div>

          <div className="mt-3">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">Team progress</p>
                <p className="mt-1 text-[20px] font-black text-[#020617]">{team.progress_percent}%</p>
              </div>
              <p className="text-[11px] font-bold text-[#94A3B8]">
                {team.total_progress} total / {targetValue} each
              </p>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#F6F8FB]">
              <div
                className="h-full rounded-full bg-[#7C83F6] transition-all duration-500"
                style={{ width: `${Math.min(team.progress_percent, 100)}%` }}
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex min-w-0 -space-x-2">
              {members.slice(0, 5).map((member) => (
                member.avatar_url ? (
                  <img key={member.user_id} src={member.avatar_url} alt={member.name} className="h-9 w-9 rounded-full border-2 border-white object-cover" />
                ) : (
                  <div key={member.user_id} title={member.name} className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-[#F6F8FB] text-[10px] font-black text-[#64748B]">
                    {member.name.slice(0, 1).toUpperCase()}
                  </div>
                )
              ))}
            </div>
            <button
              type="button"
              onClick={() => setAction("leave")}
              disabled={leaveTeam.isPending}
              className="flex h-11 items-center gap-2 rounded-[16px] px-3 text-[11px] font-black text-[#FB6B7A] active:scale-95 disabled:opacity-50"
            >
              {leaveTeam.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              Leave
            </button>
          </div>
        </>
      )}

      {leaderboard.length > 0 && (
        <div className="mt-4 border-t border-[#E5EAF1] pt-4">
          <div className="mb-2 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-[#FB6B7A]" />
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#64748B]">Team standings</p>
          </div>
          <div className="space-y-1.5">
            {leaderboard.slice(0, 3).map((entry) => (
              <div key={entry.team_id} className="flex h-10 items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F6F8FB] text-[11px] font-black text-[#020617]">{entry.rank}</span>
                <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-[#64748B]">{entry.name}</span>
                <span className="text-[12px] font-black text-[#020617]">{entry.progress_percent}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Sheet open={action !== null} onOpenChange={(open) => !open && setAction(null)}>
        <SheetContent
          side="bottom"
          className="mx-auto w-full max-w-[480px] rounded-t-[30px] border-0 bg-white px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-7 text-[#020617]"
          closeButtonClassName="right-5 top-5 flex h-11 w-11 items-center justify-center rounded-full bg-[#F6F8FB] opacity-100"
        >
          <SheetHeader className="pr-12 text-left">
            <SheetTitle className="text-[22px] font-black text-[#020617]">
              {action === "create"
                ? "Create your team"
                : action === "join"
                  ? "Join your team"
                  : "Leave this team?"}
            </SheetTitle>
            <SheetDescription className="text-[13px] font-semibold leading-5 text-[#94A3B8]">
              {action === "create"
                ? "Choose a clear name, then share the invite code with your friends."
                : action === "join"
                  ? "Enter the 8-character code shared by your team captain."
                  : "Your challenge progress stays, but it will no longer count toward this team."}
            </SheetDescription>
          </SheetHeader>
          {action !== "leave" && <label className="mt-6 block">
            <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.12em] text-[#64748B]">
              {action === "create" ? "Team name" : "Invite code"}
            </span>
            <input
              autoFocus
              value={action === "create" ? teamName : teamCode}
              onChange={(event) => action === "create" ? setTeamName(event.target.value.slice(0, 40)) : setTeamCode(normalizeTeamCode(event.target.value))}
              placeholder={action === "create" ? "Example: Doha Movers" : "AB12CD34"}
              className="h-14 w-full rounded-[19px] border-0 bg-[#F6F8FB] px-4 text-[16px] font-black text-[#020617] outline-none ring-1 ring-[#E5EAF1] placeholder:text-[#94A3B8] focus:ring-2 focus:ring-[#7C83F6]/40"
            />
          </label>}
          <button
            type="button"
            onClick={submit}
            disabled={createTeam.isPending || joinTeam.isPending || leaveTeam.isPending || (action === "create" ? teamName.trim().length < 2 : action === "join" && teamCode.length !== 8)}
            className={`mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-[19px] px-5 text-[14px] font-black text-white active:scale-[0.98] disabled:opacity-40 ${action === "leave" ? "bg-[#FB6B7A]" : "bg-[#020617]"}`}
          >
            {(createTeam.isPending || joinTeam.isPending || leaveTeam.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
            {action === "create" ? "Create team" : action === "join" ? "Join team" : "Leave team"}
          </button>
        </SheetContent>
      </Sheet>
    </div>
  );
}
