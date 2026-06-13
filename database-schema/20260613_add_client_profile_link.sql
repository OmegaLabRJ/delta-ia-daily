-- Migração: Adicionar vínculo estruturado entre appointments e client_profiles
-- Isso resolve o Bug 4 da auditoria de subagentes, permitindo que a IA CRM rastreie o histórico.

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS client_profile_id UUID REFERENCES public.client_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_client_profile_id
  ON public.appointments(client_profile_id);

-- A coluna client_id (FK para profiles) permanece inalterada e continuará 
-- recebendo o professionalId temporariamente por compatibilidade com código legado.
