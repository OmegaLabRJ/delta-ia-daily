-- Daily AI Architecture: Database Schema subset for AI Core

-- 1. Profiles (Used for Context Injection)
CREATE TABLE profiles (
    id UUID PRIMARY KEY,
    profile_type VARCHAR(20) DEFAULT 'consumer', -- 'professional', 'store', 'consumer'
    display_name VARCHAR(100),
    business_name VARCHAR(100),
    bio TEXT,
    specialty VARCHAR(100),
    offered_services TEXT,
    business_hours TEXT,
    location TEXT,
    whatsapp VARCHAR(20),
    target_audience TEXT,
    differentials TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Marketplace Items (Services & Products available for Booking/Purchasing)
CREATE TABLE marketplace_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    seller_id UUID REFERENCES profiles(id),
    name VARCHAR(100) NOT NULL,
    item_type VARCHAR(20) NOT NULL, -- 'service', 'product'
    price DECIMAL(10, 2) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Appointments (Anti-Double-Booking target)
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES profiles(id),
    service_id UUID REFERENCES marketplace_items(id),
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'confirmed', 'cancelled'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Constraint to prevent strict double booking at DB level (handled logically by AI first)
    UNIQUE(service_id, appointment_date, appointment_time)
);

-- 4. AI Sessions & Messages (Short-term Context)
CREATE TABLE ai_chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id),
    professional_id UUID REFERENCES profiles(id), -- For Delta B2C chats
    session_type VARCHAR(20) DEFAULT 'consultora', -- 'consultora' or 'delta'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE ai_chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(10) NOT NULL, -- 'user', 'model', 'system'
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. AI Memory (Long-term Context & Client Preferences)
CREATE TABLE ai_memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    memory_type VARCHAR(50) NOT NULL, -- 'business_fact', 'client_preference'
    content TEXT NOT NULL,
    relevance_score INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for AI query performance
CREATE INDEX idx_appointments_date_time ON appointments(appointment_date, appointment_time);
CREATE INDEX idx_ai_messages_session ON ai_chat_messages(session_id);
CREATE INDEX idx_ai_memories_user ON ai_memories(user_id);
