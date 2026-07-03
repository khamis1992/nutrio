import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, UserPlus, Users, Bell, Check, X, UserMinus, UserCheck, Flame } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useFriends, Friend, FriendRequest } from "@/hooks/useFriends";
import { AddFriendSheet } from "@/components/friends/AddFriendSheet";
import { FriendsList } from "@/components/friends/FriendsList";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

type Tab = "friends" | "requests";

export default function Friends() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("friends");
  const [showAddFriend, setShowAddFriend] = useState(false);
  
  const {
    friends,
    requests,
    loadingFriends,
    loadingRequests,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,
  } = useFriends(user?.id);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const tabs = [
    { key: "friends" as Tab, label: t("friends_tab_all") || "Friends", icon: Users, count: friends.length },
    { key: "requests" as Tab, label: t("friends_tab_requests") || "Requests", icon: Bell, count: requests.length },
  ];

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#10A86C] to-[#059A5A] px-5 pt-12 pb-6 shadow-[0_8px_24px_rgba(16,185,129,0.2)]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[28px] font-black tracking-[-0.03em] text-white">
              {t("friends_title") || "Friends"}
            </h1>
            <p className="mt-1 text-[15px] font-medium text-white/80">
              {t("friends_subtitle") || "Connect and motivate each other"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => navigate("/friend-leaderboard")}
              className="h-12 w-12 rounded-full bg-white/20 p-0 text-white backdrop-blur-sm hover:bg-white/30"
            >
              <Trophy className="h-5 w-5" />
            </Button>
            <Button
              onClick={() => setShowAddFriend(true)}
              className="h-12 rounded-full bg-white/20 px-5 text-[15px] font-bold text-white backdrop-blur-sm hover:bg-white/30"
            >
              <UserPlus className="mr-2 h-5 w-5" />
              {t("friends_add_button") || "Add"}
            </Button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="mt-5 flex gap-3">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-[15px] font-bold transition-all ${
                  isActive
                    ? "bg-white text-[#10A86C] shadow-[0_4px_12px_rgba(0,0,0,0.1)]"
                    : "bg-white/20 text-white hover:bg-white/30"
                }`}
              >
                <tab.icon className="h-5 w-5" />
                {tab.label}
                {tab.count > 0 && (
                  <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-2 text-[12px] font-bold ${
                    isActive ? "bg-[#10A86C]/20 text-[#10A86C]" : "bg-white/30 text-white"
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6">
        <AnimatePresence mode="wait">
          {activeTab === "friends" && (
            <motion.div
              key="friends"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <FriendsList
                friends={friends}
                loading={loadingFriends}
                onRemoveFriend={removeFriend}
              />
            </motion.div>
          )}

          {activeTab === "requests" && (
            <motion.div
              key="requests"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {loadingRequests ? (
                <div className="flex justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#10A86C] border-t-transparent" />
                </div>
              ) : requests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#F1F3F6]">
                    <UserCheck className="h-10 w-10 text-[#7A869A]" strokeWidth={1.5} />
                  </div>
                  <p className="mt-4 text-[18px] font-bold text-[#111827]">
                    {t("friends_no_requests_title") || "No pending requests"}
                  </p>
                  <p className="mt-2 text-center text-[15px] font-medium text-[#6B7588]">
                    {t("friends_no_requests_subtitle") || "When someone sends you a friend request, it will appear here"}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {requests.map((request) => (
                    <div
                      key={request.friendship_id}
                      className="flex items-center gap-3 rounded-[22px] border border-[#E5EAF0] bg-white p-4 shadow-sm"
                    >
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] text-white shadow-[0_4px_12px_rgba(109,40,217,0.2)]">
                        {request.requester_avatar ? (
                          <img
                            src={request.requester_avatar}
                            alt={request.requester_name}
                            className="h-full w-full rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-[18px] font-bold">{getInitials(request.requester_name)}</span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[17px] font-bold text-[#111827]">
                          {request.requester_name}
                        </p>
                        <p className="truncate text-[13px] text-[#6B7588]">
                          {request.requester_email}
                        </p>
                        <p className="mt-1 text-[12px] text-[#9CA3AF]">
                          {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                        </p>
                      </div>

                      <div className="flex shrink-0 gap-2">
                        <Button
                          size="sm"
                          onClick={() => acceptFriendRequest(request.friendship_id)}
                          className="h-10 w-10 rounded-full bg-[#10A86C] p-0 hover:bg-[#0F9A62]"
                        >
                          <Check className="h-5 w-5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => rejectFriendRequest(request.friendship_id)}
                          className="h-10 w-10 rounded-full border-[#E5EAF0] p-0 hover:bg-[#F5F7FA]"
                        >
                          <X className="h-5 w-5 text-[#6B7588]" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Add Friend Sheet */}
      <AddFriendSheet
        open={showAddFriend}
        onOpenChange={setShowAddFriend}
      />
    </div>
  );
}