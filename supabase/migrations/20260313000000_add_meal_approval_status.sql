ALTER TABLE meals
  ADD COLUMN IF NOT EXISTS approval_status text
    CHECK (approval_status IN ('pending', 'approved', 'rejected'))
    DEFAULT 'approved';
