-- First, delete all related data in the correct order
DELETE FROM ticket_comments;
DELETE FROM ticket_assignments;
DELETE FROM tickets;
DELETE FROM team_members;
DELETE FROM teams;
DELETE FROM user_roles;

-- Get your personal user ID to exclude from deletion
DO $$
DECLARE
    your_email text := 'soderdrews@gmail.com'; -- Replace with your email
    your_id uuid;
BEGIN
    SELECT id INTO your_id FROM auth.users WHERE email = your_email;

    -- Delete from auth.users except your account
    DELETE FROM auth.users 
    WHERE email IN (
        'john.admin@autocrm.com',
        'jane.support@autocrm.com',
        'bob.agent@autocrm.com',
        'alice.customer@acme.com',
        'charlie.client@techcorp.com'
    )
    AND id != your_id;
END $$; 