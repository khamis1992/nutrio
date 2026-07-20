BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_care_review_aal2()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.reviewed_by IS NOT NULL
     AND (SELECT auth.uid()) IS NOT NULL
     AND COALESCE(auth.jwt() ->> 'aal', 'aal1') <> 'aal2'
  THEN
    RAISE EXCEPTION 'ADMIN_AAL2_REQUIRED' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_care_review_aal2_trigger ON public.coach_applications;
CREATE TRIGGER enforce_care_review_aal2_trigger
  BEFORE UPDATE OF status, reviewed_by, reviewed_at ON public.coach_applications
  FOR EACH ROW EXECUTE FUNCTION public.enforce_care_review_aal2();

REVOKE ALL ON FUNCTION public.enforce_care_review_aal2() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_care_review_aal2() TO service_role;

DROP POLICY IF EXISTS notifications_authorized_insert ON public.notifications;
CREATE POLICY notifications_authorized_insert
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR public.has_role((SELECT auth.uid()), 'staff'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.coach_client_assignments assignment
      JOIN public.care_professional_credentials credential ON credential.user_id = assignment.coach_id
      WHERE assignment.coach_id = (SELECT auth.uid())
        AND assignment.client_id = notifications.user_id
        AND assignment.status = 'active'
        AND credential.verification_status = 'verified'
        AND credential.license_expires_on >= CURRENT_DATE
    )
    OR EXISTS (
      SELECT 1
      FROM public.delivery_jobs job
      JOIN public.drivers driver ON driver.id = job.driver_id
      JOIN public.restaurants restaurant ON restaurant.id = job.restaurant_id
      WHERE job.id = NULLIF(notifications.data ->> 'delivery_job_id', '')::UUID
        AND driver.user_id = notifications.user_id
        AND restaurant.owner_id = (SELECT auth.uid())
    )
  );

NOTIFY pgrst, 'reload schema';

COMMIT;
