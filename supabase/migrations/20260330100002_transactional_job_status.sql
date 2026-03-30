-- Transactional job status update + activity log in one call
CREATE OR REPLACE FUNCTION public.update_job_status_with_activity(
  p_job_id uuid,
  p_company_id uuid,
  p_actor_id uuid,
  p_new_status text,
  p_payment_status text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_update jsonb;
BEGIN
  -- Build update payload
  v_update := jsonb_build_object('status', p_new_status);
  IF p_payment_status IS NOT NULL THEN
    v_update := v_update || jsonb_build_object('payment_status', p_payment_status);
  END IF;

  -- Update job
  UPDATE public.jobs
  SET status = p_new_status,
      payment_status = COALESCE(p_payment_status, payment_status)
  WHERE id = p_job_id;

  -- Log activity
  INSERT INTO public.job_activity (job_id, company_id, actor_id, action, details)
  VALUES (p_job_id, p_company_id, p_actor_id, 'status_change',
          jsonb_build_object('new_status', p_new_status));
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_job_status_with_activity(uuid, uuid, uuid, text, text) TO authenticated;
