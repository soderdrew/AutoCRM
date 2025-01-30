CREATE OR REPLACE FUNCTION leave_opportunity(p_user_id uuid, p_ticket_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ticket record;
    v_assignment record;
BEGIN
    -- Lock the ticket row for update to prevent concurrent modifications
    SELECT * INTO v_ticket
    FROM tickets
    WHERE id = p_ticket_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Ticket not found'
        );
    END IF;

    -- Check ticket status
    IF v_ticket.status = 'in_progress' THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'You cannot leave an opportunity that is in progress. Please contact the organization if you need to make changes.'
        );
    END IF;

    -- Get and lock the assignment
    SELECT * INTO v_assignment
    FROM ticket_assignments
    WHERE ticket_id = p_ticket_id
    AND agent_id = p_user_id
    AND active = true
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'You are not currently signed up for this opportunity.'
        );
    END IF;

    -- Update volunteer count
    UPDATE tickets
    SET current_volunteers = GREATEST(current_volunteers - 1, 0)
    WHERE id = p_ticket_id;

    -- Deactivate assignment
    UPDATE ticket_assignments
    SET active = false
    WHERE id = v_assignment.id;

    -- Get updated ticket for return
    SELECT * INTO v_ticket
    FROM tickets
    WHERE id = p_ticket_id;

    RETURN jsonb_build_object(
        'success', true,
        'ticket_title', v_ticket.title,
        'ticket', row_to_json(v_ticket)
    );

EXCEPTION WHEN OTHERS THEN
    -- Roll back any changes and return error
    RETURN jsonb_build_object(
        'success', false,
        'message', SQLERRM
    );
END;
$$;

CREATE OR REPLACE FUNCTION sign_up_opportunity(p_user_id uuid, p_ticket_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ticket record;
    v_assignment record;
BEGIN
    -- Lock the ticket row for update to prevent concurrent modifications
    SELECT * INTO v_ticket
    FROM tickets
    WHERE id = p_ticket_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Ticket not found'
        );
    END IF;

    -- Check ticket status
    IF v_ticket.status = 'in_progress' THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'This opportunity is already in progress. Please look for other available opportunities.'
        );
    END IF;

    IF v_ticket.status IN ('closed', 'resolved', 'cancelled') THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'This opportunity is no longer available.'
        );
    END IF;

    -- Check if opportunity is full
    IF v_ticket.current_volunteers >= v_ticket.max_volunteers THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'This opportunity has reached its maximum number of volunteers.'
        );
    END IF;

    -- Check for existing assignment
    SELECT * INTO v_assignment
    FROM ticket_assignments
    WHERE ticket_id = p_ticket_id
    AND agent_id = p_user_id
    FOR UPDATE;

    IF FOUND THEN
        IF v_assignment.active THEN
            RETURN jsonb_build_object(
                'success', false,
                'message', 'You are already signed up for this opportunity.'
            );
        ELSE
            -- Reactivate existing assignment
            UPDATE ticket_assignments
            SET active = true
            WHERE id = v_assignment.id;
        END IF;
    ELSE
        -- Create new assignment
        INSERT INTO ticket_assignments (ticket_id, agent_id, active)
        VALUES (p_ticket_id, p_user_id, true);
    END IF;

    -- Increment volunteer count
    UPDATE tickets
    SET current_volunteers = current_volunteers + 1
    WHERE id = p_ticket_id;

    -- Get updated ticket with team info for return
    SELECT 
        t.*,
        jsonb_build_object(
            'id', tm.id,
            'name', tm.name,
            'description', tm.description
        ) as team
    INTO v_ticket
    FROM tickets t
    LEFT JOIN teams tm ON t.team_id = tm.id
    WHERE t.id = p_ticket_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', format('Successfully signed up for %s with %s!', 
                         v_ticket.title, 
                         (v_ticket.team->>'name')),
        'ticket', row_to_json(v_ticket)
    );

EXCEPTION WHEN OTHERS THEN
    -- Roll back any changes and return error
    RETURN jsonb_build_object(
        'success', false,
        'message', SQLERRM
    );
END;
$$; 