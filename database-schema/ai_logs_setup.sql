-- ==========================================
-- AI USAGE LOGS & ANALYTICS
-- ==========================================

-- 1. Create the table
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    latency_ms INTEGER,
    status TEXT DEFAULT 'success',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- 2. Add an index for faster count/usage queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_id ON public.ai_usage_logs(user_id);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies (Users can only see and insert their own logs)
CREATE POLICY "Users can insert their own AI logs" 
ON public.ai_usage_logs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own AI logs" 
ON public.ai_usage_logs 
FOR SELECT 
USING (auth.uid() = user_id);

-- ==========================================
-- 5. AI ACTION FEEDBACKS (Telemetria KPIs)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.ai_action_feedbacks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    feedback TEXT NOT NULL, -- 'edited', 'cancelled', 'accepted'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

ALTER TABLE public.ai_action_feedbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own AI feedbacks" 
ON public.ai_action_feedbacks 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own AI feedbacks" 
ON public.ai_action_feedbacks 
FOR SELECT 
USING (auth.uid() = user_id);

-- ==========================================
-- (Opcional) Script rápido pra testar
-- ==========================================
-- INSERT INTO ai_usage_logs (user_id, action_type, latency_ms) VALUES ('seu-id-aqui', 'create_appointment', 1200);
