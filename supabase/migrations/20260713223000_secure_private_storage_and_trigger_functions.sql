-- Keep sensitive documents private and remove broad object listing/mutation policies.

UPDATE storage.buckets
SET public = false
WHERE id IN ('blood-reports', 'ticket-attachments');

CREATE OR REPLACE FUNCTION public.can_access_support_ticket_storage(p_ticket_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $function$
DECLARE
  v_ticket_id uuid;
BEGIN
  v_ticket_id := p_ticket_id::uuid;
  RETURN public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.support_tickets st
      WHERE st.id = v_ticket_id
        AND st.user_id = auth.uid()
    );
EXCEPTION
  WHEN invalid_text_representation THEN
    RETURN false;
END;
$function$;

REVOKE ALL ON FUNCTION public.can_access_support_ticket_storage(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_support_ticket_storage(text) TO authenticated, service_role;

DROP POLICY IF EXISTS "Public read access for blood reports" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own blood reports" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own blood reports" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own blood reports" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own blood reports" ON storage.objects;

CREATE POLICY "Owners can read blood reports"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'blood-reports'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );
CREATE POLICY "Owners can upload blood reports"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'blood-reports' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Owners can update blood reports"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'blood-reports' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'blood-reports' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Owners can delete blood reports"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'blood-reports'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );

DROP POLICY IF EXISTS "ticket-attachments select" ON storage.objects;
DROP POLICY IF EXISTS "ticket-attachments insert" ON storage.objects;
DROP POLICY IF EXISTS "ticket-attachments update" ON storage.objects;
DROP POLICY IF EXISTS "ticket-attachments delete" ON storage.objects;

CREATE POLICY "Ticket participants can read attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'ticket-attachments'
    AND public.can_access_support_ticket_storage((storage.foldername(name))[1])
  );
CREATE POLICY "Ticket participants can upload attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'ticket-attachments'
    AND public.can_access_support_ticket_storage((storage.foldername(name))[1])
  );
CREATE POLICY "Ticket participants can update attachments"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'ticket-attachments'
    AND public.can_access_support_ticket_storage((storage.foldername(name))[1])
  )
  WITH CHECK (
    bucket_id = 'ticket-attachments'
    AND public.can_access_support_ticket_storage((storage.foldername(name))[1])
  );
CREATE POLICY "Ticket participants can delete attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'ticket-attachments'
    AND public.can_access_support_ticket_storage((storage.foldername(name))[1])
  );

-- Public buckets serve known URLs directly and do not require list policies.
DROP POLICY IF EXISTS "Public read access for avatars" ON storage.objects;
DROP POLICY IF EXISTS "meal-images select policy" ON storage.objects;
DROP POLICY IF EXISTS "restaurant-logos select" ON storage.objects;
DROP POLICY IF EXISTS "restaurant-photos select" ON storage.objects;

-- Uploaded catalog media can only be changed by its uploader or an administrator.
DROP POLICY IF EXISTS "meal-images insert policy" ON storage.objects;
DROP POLICY IF EXISTS "meal-images update policy" ON storage.objects;
DROP POLICY IF EXISTS "meal-images delete policy" ON storage.objects;
CREATE POLICY "Authenticated users can upload owned meal images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'meal-images' AND owner_id = auth.uid()::text);
CREATE POLICY "Owners can update meal images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'meal-images' AND (owner_id = auth.uid()::text OR public.has_role(auth.uid(), 'admin'::public.app_role)))
  WITH CHECK (bucket_id = 'meal-images' AND (owner_id = auth.uid()::text OR public.has_role(auth.uid(), 'admin'::public.app_role)));
CREATE POLICY "Owners can delete meal images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'meal-images' AND (owner_id = auth.uid()::text OR public.has_role(auth.uid(), 'admin'::public.app_role)));

DROP POLICY IF EXISTS "restaurant-logos insert" ON storage.objects;
DROP POLICY IF EXISTS "restaurant-logos update" ON storage.objects;
DROP POLICY IF EXISTS "restaurant-logos delete" ON storage.objects;
CREATE POLICY "Authenticated users can upload owned restaurant logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'restaurant-logos' AND owner_id = auth.uid()::text);
CREATE POLICY "Owners can update restaurant logos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'restaurant-logos' AND (owner_id = auth.uid()::text OR public.has_role(auth.uid(), 'admin'::public.app_role)))
  WITH CHECK (bucket_id = 'restaurant-logos' AND (owner_id = auth.uid()::text OR public.has_role(auth.uid(), 'admin'::public.app_role)));
CREATE POLICY "Owners can delete restaurant logos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'restaurant-logos' AND (owner_id = auth.uid()::text OR public.has_role(auth.uid(), 'admin'::public.app_role)));

DROP POLICY IF EXISTS "restaurant-photos insert" ON storage.objects;
DROP POLICY IF EXISTS "restaurant-photos update" ON storage.objects;
DROP POLICY IF EXISTS "restaurant-photos delete" ON storage.objects;
CREATE POLICY "Authenticated users can upload owned restaurant photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'restaurant-photos' AND owner_id = auth.uid()::text);
CREATE POLICY "Owners can update restaurant photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'restaurant-photos' AND (owner_id = auth.uid()::text OR public.has_role(auth.uid(), 'admin'::public.app_role)))
  WITH CHECK (bucket_id = 'restaurant-photos' AND (owner_id = auth.uid()::text OR public.has_role(auth.uid(), 'admin'::public.app_role)));
CREATE POLICY "Owners can delete restaurant photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'restaurant-photos' AND (owner_id = auth.uid()::text OR public.has_role(auth.uid(), 'admin'::public.app_role)));

-- Trigger functions are invoked by their triggers and must not be callable as RPCs.
DO $do$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    LEFT JOIN pg_depend d
      ON d.classid = 'pg_proc'::regclass
     AND d.objid = p.oid
     AND d.deptype = 'e'
    WHERE n.nspname = 'public'
      AND p.prorettype = 'trigger'::regtype
      AND d.objid IS NULL
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated', fn.nspname, fn.proname, fn.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role', fn.nspname, fn.proname, fn.args);
  END LOOP;
END;
$do$;
