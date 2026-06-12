-- ============================================================
-- CLEANUP: Remove demo account data completely
-- All deletes wrapped in EXCEPTION to skip missing tables
-- ============================================================

DO $$
DECLARE
    demo_uid UUID;
BEGIN
    SELECT id INTO demo_uid FROM auth.users WHERE email = 'dailydemo2026@gmail.com';
    
    IF demo_uid IS NULL THEN
        RAISE NOTICE 'User not found, nothing to delete.';
        RETURN;
    END IF;

    RAISE NOTICE 'Found user: %, deleting all data...', demo_uid;

    -- Each delete wrapped individually — skips if table doesn't exist
    BEGIN DELETE FROM ai_chat_messages WHERE session_id IN (SELECT id FROM ai_chat_sessions WHERE user_id = demo_uid OR professional_id = demo_uid); EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN DELETE FROM ai_chat_sessions WHERE user_id = demo_uid OR professional_id = demo_uid; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN DELETE FROM ai_memories WHERE user_id = demo_uid; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN DELETE FROM professional_memory WHERE professional_id = demo_uid; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN DELETE FROM ai_usage_logs WHERE user_id = demo_uid; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN DELETE FROM ai_action_feedbacks WHERE user_id = demo_uid; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN DELETE FROM content_calendar WHERE professional_id = demo_uid; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN DELETE FROM posts WHERE user_id = demo_uid; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN DELETE FROM appointments WHERE client_id = demo_uid; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN DELETE FROM appointments WHERE service_id IN (SELECT id FROM marketplace_items WHERE seller_id = demo_uid); EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN DELETE FROM marketplace_items WHERE seller_id = demo_uid; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN DELETE FROM profiles WHERE id = demo_uid; EXCEPTION WHEN undefined_table THEN NULL; END;

    -- Delete auth user
    DELETE FROM auth.users WHERE id = demo_uid;

    RAISE NOTICE 'Done! All data deleted.';
END $$;
