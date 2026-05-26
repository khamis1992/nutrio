-- Migration: Friends System
-- Date: 2026-05-26
-- Adds: friendships table with request/accept/reject workflow, privacy-preserving friend visibility

CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')) DEFAULT 'pending',
  show_weight BOOLEAN NOT NULL DEFAULT false,
  show_progress BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT different_users CHECK (requester_id <> target_id),
  UNIQUE(requester_id, target_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_target ON friendships(target_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see their own friendships"
  ON friendships FOR SELECT
  USING (requester_id = auth.uid() OR target_id = auth.uid());

CREATE POLICY "Users can create friend requests"
  ON friendships FOR INSERT
  WITH CHECK (requester_id = auth.uid());

CREATE POLICY "Users can update their own friendships"
  ON friendships FOR UPDATE
  USING (target_id = auth.uid())
  WITH CHECK (target_id = auth.uid());

CREATE OR REPLACE FUNCTION send_friend_request(
  p_requester_id UUID,
  p_target_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing RECORD;
  v_new_id UUID;
BEGIN
  IF p_requester_id = p_target_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot friend yourself');
  END IF;

  SELECT id, status INTO v_existing
  FROM friendships
  WHERE (requester_id = p_requester_id AND target_id = p_target_id)
     OR (requester_id = p_target_id AND target_id = p_requester_id);

  IF FOUND THEN
    IF v_existing.status = 'accepted' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Already friends');
    ELSIF v_existing.status = 'pending' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Friend request already sent');
    ELSIF v_existing.status = 'rejected' THEN
      UPDATE friendships SET status = 'pending', updated_at = NOW()
      WHERE id = v_existing.id;
      RETURN jsonb_build_object('success', true, 'id', v_existing.id, 'message', 'Friend request re-sent');
    END IF;
  END IF;

  INSERT INTO friendships (requester_id, target_id, status)
  VALUES (p_requester_id, p_target_id, 'pending')
  RETURNING id INTO v_new_id;

  INSERT INTO notifications (user_id, type, title, message, metadata)
  VALUES (
    p_target_id,
    'friend_request',
    'New Friend Request',
    (SELECT COALESCE(full_name, 'Someone') FROM profiles WHERE user_id = p_requester_id) || ' wants to be friends!',
    jsonb_build_object(
      'friendship_id', v_new_id,
      'requester_id', p_requester_id,
      'requester_name', (SELECT full_name FROM profiles WHERE user_id = p_requester_id)
    )
  );

  RETURN jsonb_build_object('success', true, 'id', v_new_id, 'message', 'Friend request sent');
END;
$$;

CREATE OR REPLACE FUNCTION accept_friend_request(
  p_friendship_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_friendship RECORD;
BEGIN
  SELECT * INTO v_friendship
  FROM friendships
  WHERE id = p_friendship_id
    AND target_id = p_user_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No pending request found');
  END IF;

  UPDATE friendships
  SET status = 'accepted', updated_at = NOW()
  WHERE id = p_friendship_id;

  INSERT INTO notifications (user_id, type, title, message, metadata)
  VALUES (
    v_friendship.requester_id,
    'friend_accepted',
    'Friend Request Accepted',
    (SELECT COALESCE(full_name, 'Someone') FROM profiles WHERE user_id = p_user_id) || ' accepted your friend request!',
    jsonb_build_object(
      'friendship_id', p_friendship_id,
      'friend_id', p_user_id
    )
  );

  RETURN jsonb_build_object('success', true, 'message', 'Friend request accepted');
END;
$$;

CREATE OR REPLACE FUNCTION reject_friend_request(
  p_friendship_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE friendships
  SET status = 'rejected', updated_at = NOW()
  WHERE id = p_friendship_id
    AND target_id = p_user_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No pending request found');
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Friend request rejected');
END;
$$;

CREATE OR REPLACE FUNCTION remove_friend(
  p_friendship_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM friendships
  WHERE id = p_friendship_id
    AND (requester_id = p_user_id OR target_id = p_user_id)
    AND status = 'accepted';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Friendship not found');
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Friend removed');
END;
$$;

CREATE OR REPLACE FUNCTION get_friends(p_user_id UUID)
RETURNS TABLE(
  friendship_id UUID,
  friend_user_id UUID,
  friend_name TEXT,
  friend_email TEXT,
  friend_avatar TEXT,
  current_streak INTEGER,
  show_weight BOOLEAN,
  show_progress BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    f.id,
    CASE WHEN f.requester_id = p_user_id THEN f.target_id ELSE f.requester_id END,
    COALESCE(p.full_name, 'Unknown'),
    u.email,
    p.avatar_url,
    COALESCE(s.current_streak, 0),
    CASE WHEN f.requester_id = p_user_id THEN f.show_weight ELSE false END,
    f.show_progress
  FROM friendships f
  JOIN profiles p ON p.user_id = CASE WHEN f.requester_id = p_user_id THEN f.target_id ELSE f.requester_id END
  JOIN auth.users u ON u.id = CASE WHEN f.requester_id = p_user_id THEN f.target_id ELSE f.requester_id END
  LEFT JOIN user_streaks s ON s.user_id = CASE WHEN f.requester_id = p_user_id THEN f.target_id ELSE f.requester_id END AND s.streak_type = 'logging'
  WHERE f.status = 'accepted'
    AND (f.requester_id = p_user_id OR f.target_id = p_user_id)
  ORDER BY COALESCE(s.current_streak, 0) DESC;
$$;

CREATE OR REPLACE FUNCTION get_friend_requests(p_user_id UUID)
RETURNS TABLE(
  friendship_id UUID,
  requester_name TEXT,
  requester_email TEXT,
  requester_avatar TEXT,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    f.id,
    COALESCE(p.full_name, 'Unknown'),
    u.email,
    p.avatar_url,
    f.created_at
  FROM friendships f
  JOIN profiles p ON p.user_id = f.requester_id
  JOIN auth.users u ON u.id = f.requester_id
  WHERE f.target_id = p_user_id
    AND f.status = 'pending'
  ORDER BY f.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION send_friend_request TO authenticated;
GRANT EXECUTE ON FUNCTION accept_friend_request TO authenticated;
GRANT EXECUTE ON FUNCTION reject_friend_request TO authenticated;
GRANT EXECUTE ON FUNCTION remove_friend TO authenticated;
GRANT EXECUTE ON FUNCTION get_friends TO authenticated;
GRANT EXECUTE ON FUNCTION get_friend_requests TO authenticated;
