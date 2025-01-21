-- First, clean up any existing roles
DELETE FROM ticket_comments;
DELETE FROM ticket_assignments;
DELETE FROM tickets;
DELETE FROM team_members;
DELETE FROM teams;
DELETE FROM user_roles;

-- Insert roles for existing users
INSERT INTO user_roles (user_id, role, first_name, last_name, is_active)
SELECT id, 'admin', 'Drew', 'Soderquist', true
FROM auth.users 
WHERE email = 'soderdrews@gmail.com';

INSERT INTO user_roles (user_id, role, first_name, last_name, is_active)
SELECT id, 'employee', 'Test', 'Employee', true
FROM auth.users 
WHERE email = 'promomailbox88@gmail.com';

INSERT INTO user_roles (user_id, role, first_name, last_name, is_active)
SELECT id, 'customer', 'Test', 'Customer', true
FROM auth.users 
WHERE email = 'promomailbox87@gmail.com';

-- Create a test team for the employee
INSERT INTO teams (name, description)
VALUES ('General Support', 'Handle general customer inquiries');

-- Assign employee to the team
INSERT INTO team_members (team_id, user_id, is_team_lead)
SELECT teams.id, user_roles.user_id, true
FROM teams, user_roles
WHERE teams.name = 'General Support'
AND user_roles.role = 'employee';

-- Create test tickets
INSERT INTO tickets (
    title,
    description,
    status,
    priority,
    customer_id,
    team_id,
    tags
)
SELECT 
    'Cannot access my account',
    'I am getting an error when trying to log in to my dashboard. The error says "Invalid credentials" but I am sure my password is correct.',
    'open',
    'high',
    user_roles.user_id,
    teams.id,
    ARRAY['login', 'access']
FROM user_roles, teams
WHERE user_roles.role = 'customer'
AND teams.name = 'General Support';

INSERT INTO tickets (
    title,
    description,
    status,
    priority,
    customer_id,
    team_id,
    tags
)
SELECT 
    'Feature request: Dark mode',
    'Would love to have a dark mode option for the dashboard. It would help reduce eye strain during night shifts.',
    'in_progress',
    'medium',
    user_roles.user_id,
    teams.id,
    ARRAY['feature-request', 'ui']
FROM user_roles, teams
WHERE user_roles.role = 'customer'
AND teams.name = 'General Support';

-- Assign tickets to the employee
INSERT INTO ticket_assignments (ticket_id, agent_id)
SELECT tickets.id, user_roles.user_id
FROM tickets, user_roles
WHERE user_roles.role = 'employee';

-- Add some comments to the tickets
INSERT INTO ticket_comments (ticket_id, user_id, content, is_internal)
SELECT 
    tickets.id,
    customer.user_id,
    'I have tried clearing my cache and cookies, but still no luck.',
    false
FROM tickets, user_roles customer
WHERE tickets.title LIKE '%Cannot access%'
AND customer.role = 'customer';

INSERT INTO ticket_comments (ticket_id, user_id, content, is_internal)
SELECT 
    tickets.id,
    employee.user_id,
    'Checking user account settings and permissions. Will update shortly.',
    true
FROM tickets, user_roles employee
WHERE tickets.title LIKE '%Cannot access%'
AND employee.role = 'employee'; 