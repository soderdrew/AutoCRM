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