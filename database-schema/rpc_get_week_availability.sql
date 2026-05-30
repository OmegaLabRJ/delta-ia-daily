CREATE OR REPLACE FUNCTION public.get_week_availability(
  p_professional_id UUID,
  p_date_start DATE,
  p_date_end DATE,
  p_current_time TIME
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_date DATE;
  v_day_of_week INTEGER;
  v_schedule RECORD;
  v_items RECORD;
  v_start_time TIME;
  v_end_time TIME;
  v_duration INTEGER;
  v_break INTEGER;
  v_current_minutes INTEGER;
  v_end_minutes INTEGER;
  v_slot TIME;
  v_appointments TIME[];
  v_available_slots TEXT[];
  v_day_result JSONB;
  v_result JSONB := '[]'::JSONB;
BEGIN
  v_current_date := p_date_start;
  
  -- Loop através de todos os dias do range
  WHILE v_current_date <= p_date_end LOOP
    v_day_of_week := EXTRACT(DOW FROM v_current_date);
    v_day_result := '[]'::JSONB;

    -- 1. Busca expediente para o dia da semana atual
    SELECT * INTO v_schedule 
    FROM public.schedules 
    WHERE professional_id = p_professional_id 
      AND day_of_week = v_day_of_week 
      AND is_active = true 
    LIMIT 1;

    -- Se tem expediente neste dia, processa os serviços
    IF FOUND THEN
      -- Loop através de cada serviço ativo
      FOR v_items IN 
        SELECT id, name, price, duration_minutes 
        FROM public.marketplace_items 
        WHERE seller_id = p_professional_id AND is_active = true AND item_type = 'service'
      LOOP
        v_available_slots := ARRAY[]::TEXT[];
        v_start_time := v_schedule.start_time;
        v_end_time := v_schedule.end_time;
        
        -- Duração baseada no serviço ou no expediente
        v_duration := COALESCE(v_items.duration_minutes, v_schedule.slot_duration_min, 60);
        v_break := COALESCE(v_schedule.break_between_min, 15);

        -- Pega todos os horários agendados para este serviço nesta data
        SELECT array_agg(appointment_time) INTO v_appointments
        FROM public.appointments
        WHERE service_id = v_items.id 
          AND appointment_date = v_current_date 
          AND status != 'cancelled';

        IF v_appointments IS NULL THEN
          v_appointments := ARRAY[]::TIME[];
        END IF;

        -- Gera os blocos de horário livres
        v_current_minutes := (EXTRACT(HOUR FROM v_start_time) * 60) + EXTRACT(MINUTE FROM v_start_time);
        v_end_minutes := (EXTRACT(HOUR FROM v_end_time) * 60) + EXTRACT(MINUTE FROM v_end_time);

        WHILE (v_current_minutes + v_duration) <= v_end_minutes LOOP
          v_slot := make_time(v_current_minutes / 60, v_current_minutes % 60, 0);
          
          -- Se for HOJE, ignora os horários que já passaram
          IF NOT (v_current_date = p_date_start AND v_slot <= p_current_time) THEN
            -- Se o horário não estiver agendado, adiciona aos livres
            IF NOT (v_slot = ANY(v_appointments)) THEN
              v_available_slots := array_append(v_available_slots, to_char(v_slot, 'HH24:MI'));
            END IF;
          END IF;
          
          v_current_minutes := v_current_minutes + v_duration + v_break;
        END LOOP;

        -- Acumula os dados deste serviço
        v_day_result := v_day_result || jsonb_build_object(
          'service_id', v_items.id,
          'service_name', v_items.name,
          'price', v_items.price,
          'duration_minutes', v_duration,
          'available_times', v_available_slots
        );
      END LOOP;
    END IF;

    -- Adiciona os serviços no JSON principal mapeados pela data
    v_result := v_result || jsonb_build_object(
      'date', to_char(v_current_date, 'YYYY-MM-DD'),
      'services', v_day_result
    );

    -- Avança para o próximo dia
    v_current_date := v_current_date + interval '1 day';
  END LOOP;

  RETURN v_result;
END;
$$;
