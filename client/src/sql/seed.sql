-- Insert test users into user_roles (assuming these auth.users already exist)
-- Note: You'll need to replace these UUIDs with actual user IDs from your auth.users table
INSERT INTO user_roles (user_id, role, first_name, last_name, company) VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin', 'John', 'Admin', 'AutoCRM'),
  ('00000000-0000-0000-0000-000000000002', 'employee', 'Jane', 'Support', 'AutoCRM'),
  ('00000000-0000-0000-0000-000000000003', 'employee', 'Bob', 'Agent', 'AutoCRM'),
  ('00000000-0000-0000-0000-000000000004', 'customer', 'Alice', 'Customer', 'ACME Inc'),
  ('00000000-0000-0000-0000-000000000005', 'customer', 'Charlie', 'Client', 'TechCorp');

-- Insert teams
INSERT INTO teams (id, name, description) VALUES
  ('10000000-0000-0000-0000-000000000001', 'General Support', 'Handle general customer inquiries'),
  ('10000000-0000-0000-0000-000000000002', 'Technical Support', 'Handle technical issues');

-- Assign employees to teams
INSERT INTO team_members (team_id, user_id, is_team_lead) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', true),  -- Jane as General Support lead
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', true);  -- Bob as Technical Support lead

-- Insert some test tickets
INSERT INTO tickets (id, title, description, status, priority, customer_id, team_id) VALUES
  ('20000000-0000-0000-0000-000000000001', 
   'Cannot login to account', 
   'I am unable to login to my account since yesterday morning.',
   'open',
   'high',
   '00000000-0000-0000-0000-000000000004',  -- Alice's ticket
   '10000000-0000-0000-0000-000000000001'), -- Assigned to General Support
  
  ('20000000-0000-0000-0000-000000000002',
   'Integration API not working',
   'The API endpoints are returning 500 errors intermittently.',
   'in_progress',
   'urgent',
   '00000000-0000-0000-0000-000000000005',  -- Charlie's ticket
   '10000000-0000-0000-0000-000000000002'); -- Assigned to Technical Support

-- Assign tickets to agents
INSERT INTO ticket_assignments (ticket_id, agent_id, active) VALUES
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', true),  -- Jane assigned to login issue
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', true);  -- Bob assigned to API issue

-- Add some comments to tickets
INSERT INTO ticket_comments (ticket_id, user_id, content, is_internal) VALUES
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 
   'I have tried clearing my cache and cookies but still no luck.', false),
  
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
   'Checking user account status in the admin panel.', true),
  
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005',
   'Error occurs specifically when calling the /users/sync endpoint.', false),
  
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003',
   'Investigating logs for the sync service.', true); 