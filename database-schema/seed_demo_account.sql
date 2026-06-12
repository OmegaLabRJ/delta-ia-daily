-- ============================================================
-- DAILY DEMO ACCOUNT SEED
-- Google for Startups AI Agents Challenge 2026
-- 
-- INSTRUCTIONS:
-- 1. Create the account first by logging into the app with:
--    Email: dailydemo2026@gmail.com / Password: dailychallenge2026
-- 2. Copy the user's UUID from Supabase Auth > Users
-- 3. Replace ALL occurrences of 'DEMO_USER_UUID' below with that UUID
-- 4. Run this script in Supabase SQL Editor
-- ============================================================

-- ── STEP 1: Update Profile ──────────────────────────────────
UPDATE profiles 
SET 
    profile_type = 'professional',
    display_name = 'Maria Santos',
    business_name = 'Studio Maria Beauty',
    bio = 'Nail designer e especialista em beleza há 8 anos no Rio de Janeiro. Apaixonada por transformar a autoestima das minhas clientes com técnicas exclusivas de nail art e cuidados com as unhas. Atendo com hora marcada em espaço climatizado e aconchegante no Méier.',
    specialty = 'Nail Designer & Esteticista',
    offered_services = 'Manicure, Pedicure, Unhas de Gel, Nail Art, Design de Sobrancelha, Alongamento de Cílios, Limpeza de Pele',
    business_hours = 'Segunda a Sexta: 09:00–18:00 | Sábado: 09:00–14:00 | Domingo: Fechado',
    location = 'Rua Dias da Cruz, 320 — Méier, Rio de Janeiro, RJ',
    whatsapp = '5521999887766',
    target_audience = 'Mulheres de 20 a 50 anos da Zona Norte do Rio de Janeiro que buscam serviços de beleza com qualidade e preço justo',
    differentials = 'Ambiente climatizado e higienizado, produtos de primeira linha (Vòlia, Top Beauty), pontualidade no atendimento, pagamento via Pix sem taxa'
WHERE id = 'DEMO_USER_UUID';

-- ── STEP 2: Insert Services ─────────────────────────────────
INSERT INTO marketplace_items (seller_id, name, item_type, price, description, is_active) VALUES
('DEMO_USER_UUID', 'Manicure Tradicional', 'service', 35.00, 'Manicure completa com cutilagem, lixamento e esmaltação. Duração: 40min.', true),
('DEMO_USER_UUID', 'Pedicure Spa', 'service', 50.00, 'Pedicure completa com esfoliação, hidratação e esmaltação. Inclui massagem nos pés. Duração: 50min.', true),
('DEMO_USER_UUID', 'Unhas de Gel — Mão Completa', 'service', 120.00, 'Aplicação de unhas de gel com alongamento e esmaltação em gel. Duração: 1h30min.', true),
('DEMO_USER_UUID', 'Nail Art Premium', 'service', 90.00, 'Decoração artística nas unhas com técnicas de freehand, adesivos e pedrarias. Preço por mão. Duração: 1h.', true),
('DEMO_USER_UUID', 'Manutenção de Gel', 'service', 80.00, 'Retoque e preenchimento de unhas de gel. Recomendado a cada 3 semanas. Duração: 1h.', true),
('DEMO_USER_UUID', 'Design de Sobrancelha', 'service', 45.00, 'Design personalizado com pinça e linha. Inclui aplicação de henna opcional. Duração: 30min.', true),
('DEMO_USER_UUID', 'Alongamento de Cílios Fio a Fio', 'service', 180.00, 'Aplicação de cílios fio a fio com curvatura personalizada. Efeito natural. Duração: 1h30min.', true),
('DEMO_USER_UUID', 'Combo Mani + Pedi', 'service', 75.00, 'Manicure + Pedicure completas com desconto combo. Duração: 1h20min.', true),
('DEMO_USER_UUID', 'Limpeza de Pele Profunda', 'service', 95.00, 'Limpeza facial completa com extração, tonificação e máscara calmante. Duração: 1h.', true),
('DEMO_USER_UUID', 'Hidratação Capilar Express', 'service', 60.00, 'Tratamento capilar intensivo com queratina e óleo de argan. Duração: 45min.', true);

-- ── STEP 3: Insert Sample Appointments ──────────────────────
-- (Using DEMO_USER_UUID as client_id placeholder — V1 limitation documented in code)
DO $$
DECLARE
    service_manicure UUID;
    service_gel UUID;
    service_sobrancelha UUID;
    service_cilios UUID;
    service_combo UUID;
BEGIN
    SELECT id INTO service_manicure FROM marketplace_items WHERE seller_id = 'DEMO_USER_UUID' AND name = 'Manicure Tradicional' LIMIT 1;
    SELECT id INTO service_gel FROM marketplace_items WHERE seller_id = 'DEMO_USER_UUID' AND name = 'Unhas de Gel — Mão Completa' LIMIT 1;
    SELECT id INTO service_sobrancelha FROM marketplace_items WHERE seller_id = 'DEMO_USER_UUID' AND name = 'Design de Sobrancelha' LIMIT 1;
    SELECT id INTO service_cilios FROM marketplace_items WHERE seller_id = 'DEMO_USER_UUID' AND name = 'Alongamento de Cílios Fio a Fio' LIMIT 1;
    SELECT id INTO service_combo FROM marketplace_items WHERE seller_id = 'DEMO_USER_UUID' AND name = 'Combo Mani + Pedi' LIMIT 1;

    INSERT INTO appointments (client_id, service_id, appointment_date, appointment_time, status, notes) VALUES
    ('DEMO_USER_UUID', service_manicure, CURRENT_DATE + INTERVAL '1 day', '09:00', 'confirmed', '[cliente:Ana Paula] Agendado via IA. Serviço: Manicure Tradicional'),
    ('DEMO_USER_UUID', service_gel, CURRENT_DATE + INTERVAL '1 day', '10:00', 'confirmed', '[cliente:Juliana Costa] Agendado via IA. Serviço: Unhas de Gel'),
    ('DEMO_USER_UUID', service_sobrancelha, CURRENT_DATE + INTERVAL '1 day', '14:00', 'confirmed', '[cliente:Fernanda Lima] Agendado via IA. Serviço: Design de Sobrancelha'),
    ('DEMO_USER_UUID', service_combo, CURRENT_DATE + INTERVAL '2 days', '09:00', 'confirmed', '[cliente:Carla Mendes] Agendado via IA. Serviço: Combo Mani + Pedi'),
    ('DEMO_USER_UUID', service_cilios, CURRENT_DATE + INTERVAL '2 days', '11:00', 'confirmed', '[cliente:Beatriz Oliveira] Agendado via IA. Serviço: Alongamento de Cílios'),
    ('DEMO_USER_UUID', service_manicure, CURRENT_DATE + INTERVAL '3 days', '09:00', 'pending', '[cliente:Roberta Silva] Agendado via IA. Serviço: Manicure Tradicional'),
    ('DEMO_USER_UUID', service_gel, CURRENT_DATE + INTERVAL '3 days', '14:00', 'confirmed', '[cliente:Patrícia Alves] Agendado via IA. Serviço: Unhas de Gel');
END $$;

-- ── STEP 4: Insert AI Memories ──────────────────────────────
INSERT INTO professional_memory (professional_id, memory_type, content) VALUES
('DEMO_USER_UUID', 'preference', 'Profissional prefere posts com tons de rosa e dourado, nunca usa azul nos visuais da marca.'),
('DEMO_USER_UUID', 'preference', 'Profissional não trabalha aos sábados à tarde — apenas das 09h às 14h.'),
('DEMO_USER_UUID', 'preference', 'Profissional prefere receber pagamentos via Pix e aceita cartão apenas no crédito acima de R$100.'),
('DEMO_USER_UUID', 'pattern', 'Posts com fotos de antes/depois geram 3x mais cliques no WhatsApp do que posts com frases motivacionais.'),
('DEMO_USER_UUID', 'pattern', 'Quintas e sextas são os dias com mais agendamentos — evitar promoções nesses dias pois já lotam naturalmente.'),
('DEMO_USER_UUID', 'pattern', 'Clientes da Zona Norte preferem agendar pelo WhatsApp, clientes mais jovens preferem o app.'),
('DEMO_USER_UUID', 'client', 'Ana Paula é cliente fiel há 2 anos, sempre faz manicure toda segunda-feira às 09h. Prefere cores claras.'),
('DEMO_USER_UUID', 'client', 'Juliana Costa é nova, veio por indicação da Ana Paula. Faz gel com nail art elaborada, ticket alto.'),
('DEMO_USER_UUID', 'insight', 'Investir em alongamento de cílios foi a melhor decisão — margem de 70% e alta demanda na região.'),
('DEMO_USER_UUID', 'insight', 'Combo Mani+Pedi com desconto atrai clientes novas que depois voltam para serviços premium como gel.');

-- ── STEP 5: Insert AI Usage Logs (Observability) ────────────
INSERT INTO ai_usage_logs (user_id, action_type, latency_ms, status) VALUES
('DEMO_USER_UUID', 'create_post_draft', 2340, 'success'),
('DEMO_USER_UUID', 'create_post_draft', 1890, 'success'),
('DEMO_USER_UUID', 'get_analytics', 450, 'success'),
('DEMO_USER_UUID', 'save_memory', 320, 'success'),
('DEMO_USER_UUID', 'create_appointment', 680, 'success'),
('DEMO_USER_UUID', 'create_appointment', 720, 'success'),
('DEMO_USER_UUID', 'suggest_price', 1200, 'success'),
('DEMO_USER_UUID', 'generate_content_calendar', 8900, 'success'),
('DEMO_USER_UUID', 'save_memory', 290, 'success'),
('DEMO_USER_UUID', 'create_appointment', 1100, 'success'),
('DEMO_USER_UUID', 'create_post_draft', 2100, 'success'),
('DEMO_USER_UUID', 'get_analytics', 380, 'success'),
('DEMO_USER_UUID', 'save_memory', 310, 'success'),
('DEMO_USER_UUID', 'create_appointment', 650, 'success'),
('DEMO_USER_UUID', 'suggest_price', 1350, 'success');
