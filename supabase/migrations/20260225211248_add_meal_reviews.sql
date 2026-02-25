-- Migration: Meal Reviews & Ratings System
-- Date: 2025-02-25
-- Description: Creates tables and functions for meal reviews with ratings
-- Addresses: P1-004 (Meal Reviews & Ratings)

-- Create meal_reviews table
CREATE TABLE IF NOT EXISTS meal_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    
    -- Rating (1-5 stars)
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    
    -- Review content
    title VARCHAR(200),
    review_text TEXT,
    
    -- Photo upload (stored as array of URLs)
    photo_urls TEXT[] DEFAULT '{}',
    
    -- Review metadata
    is_verified_purchase BOOLEAN DEFAULT false,
    would_recommend BOOLEAN,
    
    -- Review tags (e.g., "tasty", "fresh", "good portion")
    tags TEXT[] DEFAULT '{}',
    
    -- Helpful counts
    helpful_count INTEGER DEFAULT 0,
    
    -- Moderation
    is_approved BOOLEAN DEFAULT true,
    is_flagged BOOLEAN DEFAULT false,
    moderation_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one review per user per meal
    UNIQUE(meal_id, user_id)
);

-- Create indexes for performance
CREATE INDEX idx_meal_reviews_meal_id ON meal_reviews(meal_id);
CREATE INDEX idx_meal_reviews_user_id ON meal_reviews(user_id);
CREATE INDEX idx_meal_reviews_restaurant_id ON meal_reviews(restaurant_id);
CREATE INDEX idx_meal_reviews_rating ON meal_reviews(rating);
CREATE INDEX idx_meal_reviews_created_at ON meal_reviews(created_at DESC);
CREATE INDEX idx_meal_reviews_approved ON meal_reviews(is_approved) WHERE is_approved = true;
CREATE INDEX idx_meal_reviews_verified ON meal_reviews(is_verified_purchase) WHERE is_verified_purchase = true;

-- Create review helpfulness votes table (for future "was this helpful?" feature)
CREATE TABLE IF NOT EXISTS review_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES meal_reviews(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_helpful BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(review_id, user_id)
);

CREATE INDEX idx_review_votes_review_id ON review_votes(review_id);

-- Create function to calculate meal average rating
CREATE OR REPLACE FUNCTION calculate_meal_rating(p_meal_id UUID)
RETURNS TABLE (
    average_rating DECIMAL(2,1),
    total_reviews INTEGER,
    five_star_count INTEGER,
    four_star_count INTEGER,
    three_star_count INTEGER,
    two_star_count INTEGER,
    one_star_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(ROUND(AVG(rating)::DECIMAL, 1), 0) as average_rating,
        COUNT(*)::INTEGER as total_reviews,
        COUNT(*) FILTER (WHERE rating = 5)::INTEGER as five_star_count,
        COUNT(*) FILTER (WHERE rating = 4)::INTEGER as four_star_count,
        COUNT(*) FILTER (WHERE rating = 3)::INTEGER as three_star_count,
        COUNT(*) FILTER (WHERE rating = 2)::INTEGER as two_star_count,
        COUNT(*) FILTER (WHERE rating = 1)::INTEGER as one_star_count
    FROM meal_reviews
    WHERE meal_id = p_meal_id
    AND is_approved = true;
END;
$$;

-- Create function to calculate restaurant average rating
CREATE OR REPLACE FUNCTION calculate_restaurant_rating(p_restaurant_id UUID)
RETURNS TABLE (
    average_rating DECIMAL(2,1),
    total_reviews INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(ROUND(AVG(rating)::DECIMAL, 1), 0) as average_rating,
        COUNT(*)::INTEGER as total_reviews
    FROM meal_reviews
    WHERE restaurant_id = p_restaurant_id
    AND is_approved = true;
END;
$$;

-- Create function to get reviews with user info
CREATE OR REPLACE FUNCTION get_meal_reviews(
    p_meal_id UUID,
    p_limit INTEGER DEFAULT 10,
    p_offset INTEGER DEFAULT 0,
    p_sort_by TEXT DEFAULT 'newest' -- 'newest', 'highest', 'lowest', 'helpful'
)
RETURNS TABLE (
    review_id UUID,
    user_id UUID,
    user_name TEXT,
    user_avatar TEXT,
    rating INTEGER,
    title TEXT,
    review_text TEXT,
    photo_urls TEXT[],
    is_verified_purchase BOOLEAN,
    would_recommend BOOLEAN,
    tags TEXT[],
    helpful_count INTEGER,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mr.id as review_id,
        mr.user_id,
        COALESCE(p.full_name, 'Anonymous') as user_name,
        p.avatar_url as user_avatar,
        mr.rating,
        mr.title,
        mr.review_text,
        mr.photo_urls,
        mr.is_verified_purchase,
        mr.would_recommend,
        mr.tags,
        mr.helpful_count,
        mr.created_at
    FROM meal_reviews mr
    LEFT JOIN profiles p ON mr.user_id = p.id
    WHERE mr.meal_id = p_meal_id
    AND mr.is_approved = true
    ORDER BY 
        CASE 
            WHEN p_sort_by = 'newest' THEN mr.created_at
        END DESC,
        CASE 
            WHEN p_sort_by = 'highest' THEN mr.rating
        END DESC,
        CASE 
            WHEN p_sort_by = 'lowest' THEN mr.rating
        END ASC,
        CASE 
            WHEN p_sort_by = 'helpful' THEN mr.helpful_count
        END DESC,
        mr.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- Create function to submit a review
CREATE OR REPLACE FUNCTION submit_meal_review(
    p_meal_id UUID,
    p_user_id UUID,
    p_rating INTEGER,
    p_title TEXT DEFAULT NULL,
    p_review_text TEXT DEFAULT NULL,
    p_photo_urls TEXT[] DEFAULT '{}',
    p_would_recommend BOOLEAN DEFAULT NULL,
    p_tags TEXT[] DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_restaurant_id UUID;
    v_order_id UUID;
    v_is_verified BOOLEAN;
    v_review_id UUID;
    v_result JSONB;
BEGIN
    -- Get meal's restaurant
    SELECT restaurant_id INTO v_restaurant_id
    FROM meals
    WHERE id = p_meal_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Meal not found',
            'code', 'MEAL_NOT_FOUND'
        );
    END IF;
    
    -- Check if user has ordered this meal (verified purchase)
    SELECT o.id INTO v_order_id
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    WHERE o.user_id = p_user_id
    AND oi.meal_id = p_meal_id
    AND o.status IN ('delivered', 'completed')
    ORDER BY o.created_at DESC
    LIMIT 1;
    
    v_is_verified := v_order_id IS NOT NULL;
    
    -- Check if user already reviewed this meal
    IF EXISTS (
        SELECT 1 FROM meal_reviews 
        WHERE meal_id = p_meal_id AND user_id = p_user_id
    ) THEN
        -- Update existing review
        UPDATE meal_reviews
        SET 
            rating = p_rating,
            title = p_title,
            review_text = p_review_text,
            photo_urls = p_photo_urls,
            would_recommend = p_would_recommend,
            tags = p_tags,
            is_verified_purchase = v_is_verified,
            order_id = v_order_id,
            updated_at = NOW()
        WHERE meal_id = p_meal_id AND user_id = p_user_id
        RETURNING id INTO v_review_id;
        
        v_result := jsonb_build_object(
            'success', true,
            'action', 'updated',
            'review_id', v_review_id,
            'is_verified', v_is_verified
        );
    ELSE
        -- Insert new review
        INSERT INTO meal_reviews (
            meal_id,
            user_id,
            restaurant_id,
            order_id,
            rating,
            title,
            review_text,
            photo_urls,
            is_verified_purchase,
            would_recommend,
            tags
        ) VALUES (
            p_meal_id,
            p_user_id,
            v_restaurant_id,
            v_order_id,
            p_rating,
            p_title,
            p_review_text,
            p_photo_urls,
            v_is_verified,
            p_would_recommend,
            p_tags
        )
        RETURNING id INTO v_review_id;
        
        v_result := jsonb_build_object(
            'success', true,
            'action', 'created',
            'review_id', v_review_id,
            'is_verified', v_is_verified
        );
    END IF;
    
    RETURN v_result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'code', SQLSTATE
    );
END;
$$;

-- Create function to delete own review
CREATE OR REPLACE FUNCTION delete_meal_review(
    p_review_id UUID,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verify ownership
    IF NOT EXISTS (
        SELECT 1 FROM meal_reviews 
        WHERE id = p_review_id AND user_id = p_user_id
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Review not found or not authorized',
            'code', 'NOT_AUTHORIZED'
        );
    END IF;
    
    DELETE FROM meal_reviews WHERE id = p_review_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Review deleted successfully'
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'code', SQLSTATE
    );
END;
$$;

-- Add trigger to update meal rating on insert/update/delete
CREATE OR REPLACE FUNCTION update_meal_rating_cache()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Update the cached rating on the meals table
    UPDATE meals
    SET 
        avg_rating = (SELECT average_rating FROM calculate_meal_rating(COALESCE(NEW.meal_id, OLD.meal_id))),
        review_count = (SELECT total_reviews FROM calculate_meal_rating(COALESCE(NEW.meal_id, OLD.meal_id))),
        updated_at = NOW()
    WHERE id = COALESCE(NEW.meal_id, OLD.meal_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trg_update_meal_rating ON meal_reviews;

-- Create trigger
CREATE TRIGGER trg_update_meal_rating
AFTER INSERT OR UPDATE OR DELETE ON meal_reviews
FOR EACH ROW
EXECUTE FUNCTION update_meal_rating_cache();

-- Add rating columns to meals table if not exists
ALTER TABLE meals 
ADD COLUMN IF NOT EXISTS avg_rating DECIMAL(2,1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;

-- Add rating columns to restaurants table if not exists
ALTER TABLE restaurants 
ADD COLUMN IF NOT EXISTS avg_rating DECIMAL(2,1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;

-- Enable RLS
ALTER TABLE meal_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_votes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for meal_reviews
CREATE POLICY "Anyone can view approved reviews"
ON meal_reviews
FOR SELECT
TO authenticated
USING (is_approved = true);

CREATE POLICY "Users can view their own reviews"
ON meal_reviews
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own reviews"
ON meal_reviews
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own reviews"
ON meal_reviews
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own reviews"
ON meal_reviews
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can moderate all reviews"
ON meal_reviews
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid()
        AND role = 'admin'
    )
);

-- RLS Policies for review_votes
CREATE POLICY "Anyone can view review votes"
ON review_votes
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can vote on reviews"
ON review_votes
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can remove their votes"
ON review_votes
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION calculate_meal_rating TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_restaurant_rating TO authenticated;
GRANT EXECUTE ON FUNCTION get_meal_reviews TO authenticated;
GRANT EXECUTE ON FUNCTION submit_meal_review TO authenticated;
GRANT EXECUTE ON FUNCTION delete_meal_review TO authenticated;

-- Comments
COMMENT ON TABLE meal_reviews IS 'User reviews and ratings for meals';
COMMENT ON TABLE review_votes IS 'User votes on review helpfulness';
COMMENT ON FUNCTION calculate_meal_rating IS 'Calculate aggregate rating statistics for a meal';
COMMENT ON FUNCTION submit_meal_review IS 'Submit or update a meal review with verified purchase detection';
