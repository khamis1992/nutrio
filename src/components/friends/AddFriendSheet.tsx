import { useState } from "react";
import { Search, UserPlus, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useFriends } from "@/hooks/useFriends";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";

interface AddFriendSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddFriendSheet({ open, onOpenChange }: AddFriendSheetProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  
  const { searchUsers, searchResults, isSearching, sendFriendRequest } = useFriends(user?.id);
  
  const [pendingRequests, setPendingRequests] = useState<Set<string>>(new Set());

  const handleSearch = (query: string) => {
    setSearch(query);
    if (query.trim().length >= 2) {
      searchUsers(query.trim());
    }
  };

  const handleSendRequest = (targetId: string) => {
    setPendingRequests((prev) => new Set(prev).add(targetId));
    sendFriendRequest(targetId, {
      onSuccess: () => {
        setPendingRequests((prev) => {
          const next = new Set(prev);
          next.delete(targetId);
          return next;
        });
      },
      onError: () => {
        setPendingRequests((prev) => {
          const next = new Set(prev);
          next.delete(targetId);
          return next;
        });
      },
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="inset-x-2 bottom-2 mx-auto flex h-[60vh] w-auto max-w-[430px] flex-col overflow-hidden rounded-[34px] border border-[#E2ECE8] bg-[#FFFEFC] p-0 shadow-[0_24px_80px_rgba(15,23,42,0.18)]"
        closeButtonClassName="right-5 top-6 flex h-14 w-14 items-center justify-center rounded-full border-0 bg-[#F1F3F6] text-[#52627A] opacity-100 shadow-none ring-offset-0 hover:opacity-100 hover:bg-[#ECEFF3] focus:ring-2 focus:ring-[#D8E1EA] [&>svg]:h-7 [&>svg]:w-7"
      >
        <div className="shrink-0 bg-[#FFFEFC] px-5 pb-4 pt-8">
          <SheetHeader className="space-y-0 text-left">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#10A86C] to-[#059A5A] text-white shadow-[0_8px_20px_rgba(16,185,129,0.22)]">
                <UserPlus className="h-7 w-7" strokeWidth={2.2} />
              </div>
              <div className="min-w-0 pt-1">
                <SheetTitle className="text-left text-[28px] font-black leading-[1.1] tracking-[-0.03em] text-[#111827]">
                  {t("add_friend_title") || "Add Friend"}
                </SheetTitle>
                <p className="mt-2 text-[15px] font-medium text-[#6B7588]">
                  {t("add_friend_subtitle") || "Search by name or email"}
                </p>
              </div>
            </div>
          </SheetHeader>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-8">
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#53637A]" strokeWidth={2} />
            <Input
              placeholder={t("add_friend_search_placeholder") || "Search users..."}
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="h-14 rounded-[22px] border-[#DDE5EC] bg-white pl-12 pr-4 text-[16px] font-medium text-[#111827] shadow-none placeholder:text-[#7A869A] focus-visible:ring-[#BFECDC]"
            />
          </div>

          {isSearching && (
            <div className="mt-6 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-[#10A86C]" />
            </div>
          )}

          {!isSearching && search.trim().length >= 2 && searchResults.length === 0 && (
            <div className="mt-6 rounded-[22px] border border-[#E5EAF0] bg-white p-6 text-center shadow-sm">
              <p className="text-[15px] font-medium text-[#6B7588]">
                {t("add_friend_no_results") || "No users found"}
              </p>
              <p className="mt-2 text-[13px] text-[#9CA3AF]">
                {t("add_friend_try_different") || "Try a different search term"}
              </p>
            </div>
          )}

          {!isSearching && searchResults.length > 0 && (
            <div className="mt-4 space-y-3">
              {searchResults.map((user) => (
                <div
                  key={user.user_id}
                  className="flex items-center gap-3 rounded-[22px] border border-[#E5EAF0] bg-white p-4 shadow-sm transition-transform hover:-translate-y-0.5"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] text-white shadow-[0_4px_12px_rgba(109,40,217,0.2)]">
                    <span className="text-[18px] font-bold">
                      {(user.full_name || user.email)?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] font-bold text-[#111827]">
                      {user.full_name || "Unknown"}
                    </p>
                    <p className="truncate text-[13px] text-[#6B7588]">
                      {user.email}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleSendRequest(user.user_id)}
                    disabled={pendingRequests.has(user.user_id)}
                    className="h-10 shrink-0 rounded-full px-5 text-[14px] font-bold"
                  >
                    {pendingRequests.has(user.user_id) ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </>
                    ) : (
                      <>
                        <UserPlus className="mr-1.5 h-4 w-4" />
                        {t("add_friend_button") || "Add"}
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {search.trim().length < 2 && (
            <div className="mt-6 rounded-[22px] border border-[#E5EAF0] bg-white p-6 text-center shadow-sm">
              <p className="text-[15px] font-medium text-[#6B7588]">
                {t("add_friend_type_hint") || "Type at least 2 characters to search"}
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
