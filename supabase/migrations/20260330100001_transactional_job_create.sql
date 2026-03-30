-- Transactional job creation: atomic reference generation + insert + activity log
CREATE OR REPLACE FUNCTION public.create_job_with_activity(
  p_company_id uuid,
  p_title text,
  p_customer_id uuid,
  p_customer_snapshot jsonb,
  p_assigned_to uuid[],
  p_scheduled_date bigint,
  p_actor_id uuid,
  p_estimated_duration text DEFAULT NULL,
  p_price numeric DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reference text;
  v_job record;
BEGIN
  -- 1. Atomic reference
  v_reference := public.get_next_job_reference(true, p_company_id);

  -- 2. Insert job
  INSERT INTO public.jobs (
    company_id, reference, title, customer_id, customer_snapshot,
    assigned_to, status, scheduled_date, estimated_duration, price, notes
  ) VALUES (
    p_company_id, v_reference, p_title, p_customer_id, p_customer_snapshot,
    p_assigned_to, 'pending', p_scheduled_date, p_estimated_duration, p_price, p_notes
  ) RETURNING * INTO v_job;

  -- 3. Activity log
  INSERT INTO public.job_activity (job_id, company_id, actor_id, action, details)
  VALUES (
    v_job.id, p_company_id, p_actor_id, 'created',
    jsonb_build_object('title', p_title, 'assigned_to', to_jsonb(p_assigned_to))
  );

  -- Return the created job as JSON
  RETURN to_jsonb(v_job);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_job_with_activity(uuid, text, uuid, jsonb, uuid[], bigint, uuid, text, numeric, text) TO authenticated;
