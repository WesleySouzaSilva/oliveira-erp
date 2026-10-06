
-- Drop the overly permissive policy
DROP POLICY "system_insert_audit" ON public.audit_log;

-- The fn_audit_log function is SECURITY DEFINER (runs as postgres owner),
-- so it bypasses RLS. No INSERT policy is needed for the trigger.
-- If we ever need manual inserts, we'd add a restricted policy.
