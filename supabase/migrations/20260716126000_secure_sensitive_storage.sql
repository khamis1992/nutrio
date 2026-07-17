-- Make identity, coaching, and progress-photo storage private.

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'fleet-documents',
    'fleet-documents',
    false,
    15728640,
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[]
  ),
  (
    'coach-photos',
    'coach-photos',
    false,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
  ),
  (
    'coach-attachments',
    'coach-attachments',
    false,
    10485760,
    ARRAY[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]::text[]
  )
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.can_access_coach_photo_storage(p_client_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_client_id UUID;
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;
  v_client_id := p_client_id::UUID;
  RETURN v_user_id = v_client_id
    OR public.has_role(v_user_id, 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.coach_client_assignments cca
      WHERE cca.client_id = v_client_id
        AND cca.coach_id = v_user_id
        AND cca.status = 'active'
    );
EXCEPTION WHEN invalid_text_representation THEN
  RETURN false;
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_access_coach_attachment_storage(
  p_coach_id TEXT,
  p_client_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_coach_id UUID;
  v_client_id UUID;
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;
  v_coach_id := p_coach_id::UUID;
  v_client_id := p_client_id::UUID;
  RETURN public.has_role(v_user_id, 'admin'::public.app_role)
    OR (
      v_user_id IN (v_coach_id, v_client_id)
      AND EXISTS (
        SELECT 1
        FROM public.coach_client_assignments cca
        WHERE cca.client_id = v_client_id
          AND cca.coach_id = v_coach_id
          AND cca.status = 'active'
      )
    );
EXCEPTION WHEN invalid_text_representation THEN
  RETURN false;
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_access_fleet_document_storage(p_city_id TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_city_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.has_role(v_user_id, 'admin'::public.app_role) THEN
    RETURN true;
  END IF;

  -- Legacy objects did not include a city in their path. Only a fleet super
  -- administrator may read those until they are migrated to the scoped layout.
  IF p_city_id IS NULL OR btrim(p_city_id) = '' THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.fleet_managers fm
      WHERE fm.auth_user_id = v_user_id
        AND fm.is_active = true
        AND fm.role = 'super_admin'
    );
  END IF;

  v_city_id := p_city_id::UUID;
  RETURN EXISTS (
    SELECT 1
    FROM public.fleet_managers fm
    WHERE fm.auth_user_id = v_user_id
      AND fm.is_active = true
      AND (
        fm.role = 'super_admin'
        OR v_city_id = ANY(COALESCE(fm.assigned_city_ids, ARRAY[]::UUID[]))
      )
  );
EXCEPTION WHEN invalid_text_representation THEN
  RETURN false;
END;
$function$;

REVOKE ALL ON FUNCTION public.can_access_coach_photo_storage(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_coach_attachment_storage(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_fleet_document_storage(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_coach_photo_storage(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_coach_attachment_storage(TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_fleet_document_storage(TEXT) TO authenticated, service_role;

DROP POLICY IF EXISTS "Active coaches can view assigned client measurements"
  ON public.body_measurements;
CREATE POLICY "Active coaches can view assigned client measurements"
ON public.body_measurements FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.coach_client_assignments cca
    WHERE cca.coach_id = auth.uid()
      AND cca.client_id = body_measurements.user_id
      AND cca.status = 'active'
  )
);

ALTER TABLE public.coach_chat_attachments
  DROP CONSTRAINT IF EXISTS coach_chat_attachments_file_size_check,
  DROP CONSTRAINT IF EXISTS coach_chat_attachments_file_type_check,
  DROP CONSTRAINT IF EXISTS coach_chat_attachments_file_name_check;
ALTER TABLE public.coach_chat_attachments
  ADD CONSTRAINT coach_chat_attachments_file_size_check
    CHECK (file_size BETWEEN 1 AND 10485760) NOT VALID,
  ADD CONSTRAINT coach_chat_attachments_file_type_check
    CHECK (file_type IN (
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )) NOT VALID,
  ADD CONSTRAINT coach_chat_attachments_file_name_check
    CHECK (char_length(file_name) BETWEEN 1 AND 255) NOT VALID;

DROP POLICY IF EXISTS "conversation_participants_view_attachments"
  ON public.coach_chat_attachments;
DROP POLICY IF EXISTS "conversation_participants_insert_attachments"
  ON public.coach_chat_attachments;
DROP POLICY IF EXISTS "Authorized participants view coach attachments"
  ON public.coach_chat_attachments;
DROP POLICY IF EXISTS "Active participants add coach attachments"
  ON public.coach_chat_attachments;
DROP POLICY IF EXISTS "Uploaders delete coach attachments"
  ON public.coach_chat_attachments;

CREATE POLICY "Authorized participants view coach attachments"
ON public.coach_chat_attachments FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.coach_messages m
    WHERE m.id = coach_chat_attachments.message_id
      AND (m.coach_id = auth.uid() OR m.client_id = auth.uid())
  )
);

CREATE POLICY "Active participants add coach attachments"
ON public.coach_chat_attachments FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.coach_messages m
    JOIN public.coach_client_assignments cca
      ON cca.coach_id = m.coach_id
     AND cca.client_id = m.client_id
     AND cca.status = 'active'
    WHERE m.id = coach_chat_attachments.message_id
      AND (m.coach_id = auth.uid() OR m.client_id = auth.uid())
      AND coach_chat_attachments.file_path LIKE
        m.coach_id::TEXT || '/' || m.client_id::TEXT || '/%'
  )
);

CREATE POLICY "Uploaders delete coach attachments"
ON public.coach_chat_attachments FOR DELETE TO authenticated
USING (
  uploaded_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Remove any legacy policies mentioning these buckets, regardless of name.
DO $do$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN
    SELECT policyname
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (
        COALESCE(qual, '') || ' ' || COALESCE(with_check, '')
      ) ~ '(fleet-documents|coach-photos|coach-attachments)'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', v_policy.policyname);
  END LOOP;
END;
$do$;

CREATE POLICY "Authorized users read coach progress photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'coach-photos'
  AND public.can_access_coach_photo_storage((storage.foldername(name))[1])
);

CREATE POLICY "Authorized users upload coach progress photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'coach-photos'
  AND owner_id = auth.uid()::TEXT
  AND public.can_access_coach_photo_storage((storage.foldername(name))[1])
);

CREATE POLICY "Owners manage coach progress photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'coach-photos'
  AND public.can_access_coach_photo_storage((storage.foldername(name))[1])
  AND (owner_id = auth.uid()::TEXT OR public.has_role(auth.uid(), 'admin'::public.app_role))
)
WITH CHECK (
  bucket_id = 'coach-photos'
  AND public.can_access_coach_photo_storage((storage.foldername(name))[1])
  AND (owner_id = auth.uid()::TEXT OR public.has_role(auth.uid(), 'admin'::public.app_role))
);

CREATE POLICY "Owners delete coach progress photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'coach-photos'
  AND public.can_access_coach_photo_storage((storage.foldername(name))[1])
  AND (owner_id = auth.uid()::TEXT OR public.has_role(auth.uid(), 'admin'::public.app_role))
);

CREATE POLICY "Conversation participants read coach attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'coach-attachments'
  AND public.can_access_coach_attachment_storage(
    (storage.foldername(name))[1],
    (storage.foldername(name))[2]
  )
);

CREATE POLICY "Conversation participants upload coach attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'coach-attachments'
  AND owner_id = auth.uid()::TEXT
  AND public.can_access_coach_attachment_storage(
    (storage.foldername(name))[1],
    (storage.foldername(name))[2]
  )
);

CREATE POLICY "Attachment owners update coach attachments"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'coach-attachments'
  AND owner_id = auth.uid()::TEXT
  AND public.can_access_coach_attachment_storage(
    (storage.foldername(name))[1],
    (storage.foldername(name))[2]
  )
)
WITH CHECK (
  bucket_id = 'coach-attachments'
  AND owner_id = auth.uid()::TEXT
  AND public.can_access_coach_attachment_storage(
    (storage.foldername(name))[1],
    (storage.foldername(name))[2]
  )
);

CREATE POLICY "Attachment owners delete coach attachments"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'coach-attachments'
  AND (
    owner_id = auth.uid()::TEXT
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  AND public.can_access_coach_attachment_storage(
    (storage.foldername(name))[1],
    (storage.foldername(name))[2]
  )
);

CREATE POLICY "Active fleet managers read private documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'fleet-documents'
  AND (
    (
      (storage.foldername(name))[1] = 'cities'
      AND public.can_access_fleet_document_storage((storage.foldername(name))[2])
    )
    OR (
      (storage.foldername(name))[1] <> 'cities'
      AND public.can_access_fleet_document_storage(NULL)
    )
  )
);

CREATE POLICY "Active fleet managers upload private documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'fleet-documents'
  AND (storage.foldername(name))[1] = 'cities'
  AND (storage.foldername(name))[3] IN ('drivers', 'vehicles')
  AND owner_id = auth.uid()::TEXT
  AND public.can_access_fleet_document_storage((storage.foldername(name))[2])
);

CREATE POLICY "Active fleet managers update private documents"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'fleet-documents'
  AND (storage.foldername(name))[1] = 'cities'
  AND (storage.foldername(name))[3] IN ('drivers', 'vehicles')
  AND public.can_access_fleet_document_storage((storage.foldername(name))[2])
)
WITH CHECK (
  bucket_id = 'fleet-documents'
  AND (storage.foldername(name))[1] = 'cities'
  AND (storage.foldername(name))[3] IN ('drivers', 'vehicles')
  AND public.can_access_fleet_document_storage((storage.foldername(name))[2])
);

CREATE POLICY "Active fleet managers delete private documents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'fleet-documents'
  AND (storage.foldername(name))[1] = 'cities'
  AND (storage.foldername(name))[3] IN ('drivers', 'vehicles')
  AND public.can_access_fleet_document_storage((storage.foldername(name))[2])
);

COMMIT;
