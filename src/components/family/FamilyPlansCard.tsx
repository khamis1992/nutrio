import { Users, Plus, User, Trash2, Calendar, Utensils, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FamilyMember } from "@/hooks/useFamilyMembers";

const CURRENT_YEAR = new Date().getFullYear();
const FAMILY_MEMBER_COST = 99;

function getAge(birthYear: number | null): string {
  if (!birthYear) return "—";
  return `${CURRENT_YEAR - birthYear} yrs`;
}

function formatPreferences(prefs: string[] | null): string {
  if (!prefs || prefs.length === 0) return "No preferences set";
  return prefs
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(", ");
}

interface FamilyPlansCardProps {
  members: FamilyMember[];
  loading: boolean;
  isVip: boolean;
  onAddClick: () => void;
  onRemoveMember: (id: string) => void;
}

export function FamilyPlansCard({
  members,
  loading,
  isVip,
  onAddClick,
  onRemoveMember,
}: FamilyPlansCardProps) {
  if (!isVip) return null;

  return (
    <div className="bg-card rounded-2xl overflow-hidden shadow-sm border border-border/50">
      <div className="p-4 flex items-center justify-between border-b border-border/30">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="font-bold text-foreground text-sm">Family Plan</p>
            <p className="text-xs text-muted-foreground">
              Add a family member for +{FAMILY_MEMBER_COST} QAR/month
            </p>
          </div>
        </div>
        <Button
          size="sm"
          className="rounded-xl h-9 text-xs font-bold"
          onClick={onAddClick}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add
        </Button>
      </div>

      {loading ? (
        <div className="p-4 space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-muted" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-muted rounded w-24" />
                <div className="h-2.5 bg-muted rounded w-36" />
              </div>
            </div>
          ))}
        </div>
      ) : members.length === 0 ? (
        <div className="p-6 text-center">
          <User className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground font-medium">No family members yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Share meals and track nutrition for your whole household.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/30">
          {members.map((member) => (
            <div key={member.id} className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{member.name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {getAge(member.birth_year)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Utensils className="h-3 w-3" />
                    <span className="truncate max-w-[120px]">{formatPreferences(member.dietary_preferences)}</span>
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {}}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  title="Link meal schedule"
                >
                  <Link2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onRemoveMember(member.id)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                  title="Remove member"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
