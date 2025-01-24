-- Add event_date and duration columns to tickets if they don't exist
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS event_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS duration INTEGER;

-- Create volunteer feedback table
CREATE TABLE volunteer_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    volunteer_id UUID REFERENCES auth.users(id),
    organization_id UUID REFERENCES auth.users(id),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    feedback TEXT,
    skills_demonstrated TEXT[],
    areas_of_improvement TEXT,
    would_work_again BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_feedback_ticket_id ON volunteer_feedback(ticket_id);
CREATE INDEX idx_feedback_volunteer_id ON volunteer_feedback(volunteer_id);
CREATE INDEX idx_feedback_organization_id ON volunteer_feedback(organization_id);

-- Enable RLS on the feedback table
ALTER TABLE volunteer_feedback ENABLE ROW LEVEL SECURITY;

-- Create policies for volunteer feedback
CREATE POLICY "Organizations can create feedback for their tickets"
    ON volunteer_feedback
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM tickets
            WHERE tickets.id = ticket_id
            AND tickets.customer_id = auth.uid()
        )
    );

CREATE POLICY "Volunteers can view their own feedback"
    ON volunteer_feedback
    FOR SELECT
    USING (volunteer_id = auth.uid());

CREATE POLICY "Organizations can view feedback they've given"
    ON volunteer_feedback
    FOR SELECT
    USING (organization_id = auth.uid());

CREATE POLICY "Admins can view all feedback"
    ON volunteer_feedback
    FOR ALL
    USING (is_admin(auth.uid()));

-- Function to check if all volunteers have been rated
CREATE OR REPLACE FUNCTION check_all_volunteers_rated()
RETURNS TRIGGER AS $$
BEGIN
    -- If all volunteers have received feedback, mark the ticket as closed
    IF EXISTS (
        SELECT 1 FROM tickets t
        WHERE t.id = NEW.ticket_id
        AND t.status = 'resolved'
        AND NOT EXISTS (
            -- Find any active volunteer without feedback
            SELECT 1 FROM ticket_assignments ta
            LEFT JOIN volunteer_feedback vf 
                ON vf.ticket_id = ta.ticket_id 
                AND vf.volunteer_id = ta.agent_id
            WHERE ta.ticket_id = t.id
            AND ta.active = true
            AND vf.id IS NULL
        )
    ) THEN
        UPDATE tickets
        SET status = 'closed',
            closed_at = NOW()
        WHERE id = NEW.ticket_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to check if all volunteers have been rated after feedback is submitted
CREATE TRIGGER check_volunteers_rated_trigger
    AFTER INSERT ON volunteer_feedback
    FOR EACH ROW
    EXECUTE FUNCTION check_all_volunteers_rated();

-- Function to automatically resolve tickets when event is over
CREATE OR REPLACE FUNCTION check_event_completion()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if event is past its end time
    IF NEW.event_date + (NEW.duration * interval '1 minute') < NOW() 
    AND NEW.status NOT IN ('resolved', 'closed') THEN
        NEW.status := 'resolved';
        NEW.resolved_at := NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to check event completion on ticket updates
CREATE TRIGGER event_completion_check
    BEFORE UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION check_event_completion();

-- Add trigger for updating timestamps
CREATE TRIGGER update_volunteer_feedback_updated_at
    BEFORE UPDATE ON volunteer_feedback
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at(); 