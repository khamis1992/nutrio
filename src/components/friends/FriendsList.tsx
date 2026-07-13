import { User, Flame, UserMinus, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Friend } from "@/hooks/useFriends";
import { useLanguage } from "@/contexts/LanguageContext";

interface FriendsListProps {
  friends: Friend[];
  loading: boolean;
  onRemoveFriend: (friendshipId: string) => void;
  onFriendClick?: (friend: Friend) => void;
}

export function FriendsList({ friends, loading, onRemoveFriend, onFriendClick }: FriendsListProps) {
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#10A86C] border-t-transparent" />
      </div>
    );
  }

  if (friends.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#F1F3F6]">
          <User className="h-10 w-10 text-[#7A869A]" strokeWidth={1.5} />
        </div>
        <p className="mt-4 text-[18px] font-bold text-[#111827]">
          {t("friends_none_title") || "No friends yet"}
        </p>
        <p className="mt-2 text-center text-[15px] font-medium text-[#6B7588]">
          {t("friends_none_subtitle") || "Start by adding friends to see their progress"}
        </p>
      </div>
    );
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-3">
      {friends.map((friend) => (
        <div
          key={friend.friendship_id}
          onClick={() => onFriendClick?.(friend)}
          className="flex items-center gap-3 rounded-[22px] border border-[#E5EAF0] bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(15,23,42,0.06)] cursor-pointer"
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#10A86C] to-[#059A5A] text-white shadow-[0_4px_12px_rgba(16,185,129,0.2)]">
            {friend.friend_avatar ? (
              <img
                src={friend.friend_avatar}
                alt={friend.friend_name}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <span className="text-[18px] font-bold">{getInitials(friend.friend_name)}</span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-bold text-[#111827]">
              {friend.friend_name}
            </p>
            {friend.show_progress && friend.current_streak > 0 && (
              <div className="mt-1 flex items-center gap-1.5">
                <Flame className="h-4 w-4 text-[#FF850F]" />
                <span className="text-[14px] font-semibold text-[#FF850F]">
                  {friend.current_streak} {t("day_streak") || "day streak"}
                </span>
              </div>
            )}
            {friend.show_progress && friend.current_streak === 0 && (
              <p className="mt-1 text-[13px] font-medium text-[#7A869A]">
                {t("friends_just_started") || "Just getting started!"}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {friend.show_weight && (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FFF5EC] text-[#E97818]">
                <Flame className="h-5 w-5" />
              </div>
            )}
            <ChevronRight className="h-5 w-5 text-[#9CA3AF]" />
          </div>

          {menuOpen === friend.friendship_id && (
            <div className="fixed inset-0 z-50" onClick={() => setMenuOpen(null)}>
              <div
                className="absolute right-4 top-auto mt-2 w-48 rounded-[16px] border border-[#E5EAF0] bg-white p-1 shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => {
                    onRemoveFriend(friend.friendship_id);
                    setMenuOpen(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-[12px] px-3 py-2.5 text-left text-[15px] font-medium text-[#DC2626] hover:bg-[#FEF2F2]"
                >
                  <UserMinus className="h-4 w-4" />
                  {t("friends_remove") || "Remove friend"}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
