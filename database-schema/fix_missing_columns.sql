-- 1. ADD MISSING COLUMNS TO MARKETPLACE_ITEMS
ALTER TABLE IF EXISTS public.marketplace_items ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 60;
ALTER TABLE IF EXISTS public.marketplace_items ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;
ALTER TABLE IF EXISTS public.marketplace_items ADD COLUMN IF NOT EXISTS whatsapp_clicks INTEGER DEFAULT 0;

-- 2. ADD MISSING COLUMNS TO POSTS
ALTER TABLE IF EXISTS public.posts ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;

-- 3. ENSURE APPOINTMENTS TABLE EXISTS
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    service_id UUID NOT NULL,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Ensure RLS on appointments
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Users can insert appointments"
    ON public.appointments FOR INSERT
    WITH CHECK (auth.uid() = client_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can view appointments for their services"
    ON public.appointments FOR SELECT
    USING (
        auth.uid() = client_id
        OR EXISTS (
            SELECT 1 FROM public.marketplace_items
            WHERE marketplace_items.id = appointments.service_id
            AND marketplace_items.seller_id = auth.uid()
        )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Service owners can update appointments"
    ON public.appointments FOR UPDATE
    USING (
        auth.uid() = client_id
        OR EXISTS (
            SELECT 1 FROM public.marketplace_items
            WHERE marketplace_items.id = appointments.service_id
            AND marketplace_items.seller_id = auth.uid()
        )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. ENSURE SCHEDULES TABLE EXISTS
CREATE TABLE IF NOT EXISTS public.schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    professional_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT true,
    slot_duration_min INTEGER DEFAULT 60,
    break_between_min INTEGER DEFAULT 15,
    auto_approve BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Anyone can view active schedules"
    ON public.schedules FOR SELECT
    USING (is_active = true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Professionals manage own schedules"
    ON public.schedules FOR ALL
    USING (auth.uid() = professional_id)
    WITH CHECK (auth.uid() = professional_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
