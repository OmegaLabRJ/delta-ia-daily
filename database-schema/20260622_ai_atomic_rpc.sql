-- AI Usage Atomic Increment RPCs
-- Solves race conditions under high concurrent load

CREATE OR REPLACE FUNCTION increment_ai_usage(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.user_ai_usage (
        user_id, month, year, requests_count
    )
    VALUES (
        p_user_id,
        EXTRACT(MONTH FROM CURRENT_DATE)::integer,
        EXTRACT(YEAR FROM CURRENT_DATE)::integer,
        1
    )
    ON CONFLICT (user_id, month, year)
    DO UPDATE SET requests_count = public.user_ai_usage.requests_count + 1;
END;
$$;

CREATE OR REPLACE FUNCTION increment_ai_image_usage(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.user_ai_usage (
        user_id, month, year, image_generation_count
    )
    VALUES (
        p_user_id,
        EXTRACT(MONTH FROM CURRENT_DATE)::integer,
        EXTRACT(YEAR FROM CURRENT_DATE)::integer,
        1
    )
    ON CONFLICT (user_id, month, year)
    DO UPDATE SET image_generation_count = public.user_ai_usage.image_generation_count + 1;
END;
$$;
