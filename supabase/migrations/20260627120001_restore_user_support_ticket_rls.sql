-- Restore customer-side support desk writes after the consolidated RLS migration
-- reduced support tables to SELECT-only policies for regular users.

ALTER TABLE IF EXISTS public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ticket_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can update own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can add messages to own tickets" ON public.ticket_messages;
DROP POLICY IF EXISTS "Users can add own ticket attachments" ON public.ticket_attachments;

CREATE POLICY "Users can create own tickets"
ON public.support_tickets
FOR INSERT
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own tickets"
ON public.support_tickets
FOR UPDATE
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can add messages to own tickets"
ON public.ticket_messages
FOR INSERT
WITH CHECK (
  sender_id = (select auth.uid())
  AND COALESCE(is_internal, false) = false
  AND EXISTS (
    SELECT 1
    FROM public.support_tickets st
    WHERE st.id = ticket_messages.ticket_id
      AND st.user_id = (select auth.uid())
  )
);

CREATE POLICY "Users can add own ticket attachments"
ON public.ticket_attachments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.support_tickets st
    WHERE st.id = ticket_attachments.ticket_id
      AND st.user_id = (select auth.uid())
  )
);
