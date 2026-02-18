-- Blocked IPs table
CREATE TABLE blocked_ips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address INET NOT NULL UNIQUE,
  reason TEXT,
  blocked_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- User IP logs table
CREATE TABLE user_ip_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address INET NOT NULL,
  country_code TEXT,
  country_name TEXT,
  city TEXT,
  action TEXT NOT NULL CHECK (action IN ('signup', 'login')),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_blocked_ips_ip ON blocked_ips (ip_address);
CREATE INDEX idx_blocked_ips_active ON blocked_ips (is_active);
CREATE INDEX idx_user_ip_logs_user ON user_ip_logs (user_id);
CREATE INDEX idx_user_ip_logs_ip ON user_ip_logs (ip_address);
CREATE INDEX idx_user_ip_logs_created ON user_ip_logs (created_at DESC);

-- RLS Policies
ALTER TABLE blocked_ips ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_ip_logs ENABLE ROW LEVEL SECURITY;

-- Admin-only access to blocked_ips
CREATE POLICY "Admins can manage blocked IPs"
  ON blocked_ips FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Admin-only read access to user_ip_logs
CREATE POLICY "Admins can view IP logs"
  ON user_ip_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- Users can insert their own IP logs
CREATE POLICY "Users can log their IPs"
  ON user_ip_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Function to check if IP is blocked
CREATE OR REPLACE FUNCTION is_ip_blocked(p_ip INET)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM blocked_ips 
    WHERE ip_address = p_ip AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;