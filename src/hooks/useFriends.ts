import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Friend {
  friendship_id: string;
  friend_user_id: string;
  friend_name: string;
  friend_email: string;
  friend_avatar: string | null;
  current_streak: number;
  show_weight: boolean;
  show_progress: boolean;
}

export interface FriendRequest {
  friendship_id: string;
  requester_name: string;
  requester_email: string;
  requester_avatar: string | null;
  created_at: string;
}

export interface FriendSearchResult {
  user_id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

async function fetchFriends(userId: string): Promise<Friend[]> {
  const { data, error } = await supabase.rpc("get_friends", {
    p_user_id: userId,
  });

  if (error) throw error;
  return data || [];
}

async function fetchFriendRequests(userId: string): Promise<FriendRequest[]> {
  const { data, error } = await supabase.rpc("get_friend_requests", {
    p_user_id: userId,
  });

  if (error) throw error;
  return data || [];
}

async function searchUsers(
  userId: string,
  query: string
): Promise<FriendSearchResult[]> {
  if (!query.trim()) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, full_name, email, avatar_url")
    .neq("user_id", userId)
    .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
    .limit(10);

  if (error) throw error;
  return data || [];
}

async function sendFriendRequest(
  requesterId: string,
  targetId: string
): Promise<{ success: boolean; id?: string; message?: string; error?: string }> {
  const { data, error } = await supabase.rpc("send_friend_request", {
    p_requester_id: requesterId,
    p_target_id: targetId,
  });

  if (error) throw error;
  return data;
}

async function acceptFriendRequest(
  friendshipId: string,
  userId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const { data, error } = await supabase.rpc("accept_friend_request", {
    p_friendship_id: friendshipId,
    p_user_id: userId,
  });

  if (error) throw error;
  return data;
}

async function rejectFriendRequest(
  friendshipId: string,
  userId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const { data, error } = await supabase.rpc("reject_friend_request", {
    p_friendship_id: friendshipId,
    p_user_id: userId,
  });

  if (error) throw error;
  return data;
}

async function removeFriendFn(
  friendshipId: string,
  userId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const { data, error } = await supabase.rpc("remove_friend", {
    p_friendship_id: friendshipId,
    p_user_id: userId,
  });

  if (error) throw error;
  return data;
}

export function useFriends(userId: string | undefined) {
  const queryClient = useQueryClient();
  const enabled = !!userId;

  const { data: friends = [], isLoading: loadingFriends } = useQuery({
    queryKey: ["friends", userId],
    queryFn: () => fetchFriends(userId!),
    enabled,
    staleTime: 60 * 1000,
  });

  const { data: requests = [], isLoading: loadingRequests } = useQuery({
    queryKey: ["friend_requests", userId],
    queryFn: () => fetchFriendRequests(userId!),
    enabled,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const sendRequestMutation = useMutation({
    mutationFn: (targetId: string) => sendFriendRequest(userId!, targetId),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message || "Friend request sent!");
        queryClient.invalidateQueries({ queryKey: ["friend_requests", userId] });
      } else {
        toast.error(result.error || "Failed to send friend request");
      }
    },
    onError: (error) => {
      toast.error("Failed to send friend request");
      console.error(error);
    },
  });

  const acceptRequestMutation = useMutation({
    mutationFn: (friendshipId: string) =>
      acceptFriendRequest(friendshipId, userId!),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message || "Friend request accepted!");
        queryClient.invalidateQueries({ queryKey: ["friend_requests", userId] });
        queryClient.invalidateQueries({ queryKey: ["friends", userId] });
      } else {
        toast.error(result.error || "Failed to accept friend request");
      }
    },
    onError: (error) => {
      toast.error("Failed to accept friend request");
      console.error(error);
    },
  });

  const rejectRequestMutation = useMutation({
    mutationFn: (friendshipId: string) =>
      rejectFriendRequest(friendshipId, userId!),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message || "Friend request rejected");
        queryClient.invalidateQueries({ queryKey: ["friend_requests", userId] });
      } else {
        toast.error(result.error || "Failed to reject friend request");
      }
    },
    onError: (error) => {
      toast.error("Failed to reject friend request");
      console.error(error);
    },
  });

  const removeFriendMutation = useMutation({
    mutationFn: (friendshipId: string) => removeFriendFn(friendshipId, userId!),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message || "Friend removed");
        queryClient.invalidateQueries({ queryKey: ["friends", userId] });
      } else {
        toast.error(result.error || "Failed to remove friend");
      }
    },
    onError: (error) => {
      toast.error("Failed to remove friend");
      console.error(error);
    },
  });

  const searchMutation = useMutation({
    mutationFn: (query: string) => searchUsers(userId!, query),
  });

  return {
    friends,
    requests,
    loadingFriends,
    loadingRequests,
    sendFriendRequest: sendRequestMutation.mutate,
    acceptFriendRequest: acceptRequestMutation.mutate,
    rejectFriendRequest: rejectRequestMutation.mutate,
    removeFriend: removeFriendMutation.mutate,
    searchUsers: searchMutation.mutate,
    searchResults: searchMutation.data || [],
    isSearching: searchMutation.isPending,
  };
}