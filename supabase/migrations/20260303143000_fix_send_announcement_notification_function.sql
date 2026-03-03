-- Fix announcement notification delivery to match current schema
CREATE OR REPLACE FUNCTION public.send_announcement_notification(p_announcement_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_announcement RECORD;
  v_user RECORD;
  v_count INTEGER := 0;
  v_notification_type public.notification_type;
BEGIN
  SELECT *
  INTO v_announcement
  FROM public.announcements
  WHERE id = p_announcement_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Map announcement severity to existing notification types.
  v_notification_type := CASE v_announcement.type
    WHEN 'warning' THEN 'subscription_alert'::public.notification_type
    WHEN 'success' THEN 'order_update'::public.notification_type
    WHEN 'error' THEN 'subscription_alert'::public.notification_type
    ELSE 'general'::public.notification_type
  END;

  FOR v_user IN
    SELECT u.id
    FROM auth.users u
    WHERE
      CASE v_announcement.target_audience
        WHEN 'all' THEN true
        WHEN 'users' THEN EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.user_id = u.id
        )
        WHEN 'customers' THEN EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.user_id = u.id
        )
        WHEN 'partners' THEN EXISTS (
          SELECT 1
          FROM public.restaurants r
          WHERE r.owner_id = u.id
        )
        WHEN 'admins' THEN public.has_role(u.id, 'admin'::public.app_role)
        ELSE true
      END
      AND NOT EXISTS (
        SELECT 1
        FROM public.notifications n
        WHERE n.user_id = u.id
          AND n.related_entity_type = 'announcement'
          AND n.related_entity_id = p_announcement_id
      )
  LOOP
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      message,
      status,
      data,
      related_entity_type,
      related_entity_id
    )
    VALUES (
      v_user.id,
      v_notification_type,
      v_announcement.title,
      v_announcement.message,
      'unread'::public.notification_status,
      jsonb_build_object(
        'announcement_id', v_announcement.id,
        'announcement_type', v_announcement.type,
        'target_audience', v_announcement.target_audience
      ),
      'announcement',
      v_announcement.id
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
