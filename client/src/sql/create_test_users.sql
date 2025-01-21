-- First, clean up existing data in the correct order
DELETE FROM ticket_comments;
DELETE FROM ticket_assignments;
DELETE FROM tickets;
DELETE FROM team_members;
DELETE FROM teams;
DELETE FROM user_roles;

-- Now clean up auth users
DELETE FROM auth.users 
WHERE email IN (
    'john.admin@autocrm.com',
    'jane.support@autocrm.com',
    'bob.agent@autocrm.com',
    'alice.customer@acme.com',
    'charlie.client@techcorp.com'
);

-- Create users using Supabase's auth function
INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    raw_app_meta_data,
    created_at,
    updated_at,
    last_sign_in_at,
    aud,
    role,
    instance_id,
    confirmation_token,
    recovery_token,
    email_change_token_current,
    email_change_token_new,
    phone,
    phone_change_token,
    phone_confirmed_at,
    banned_until,
    reauthentication_token,
    is_super_admin,
    is_sso_user
) VALUES
-- John Admin
(
    '00000000-0000-0000-0000-000000000001',
    'john.admin@autocrm.com',
    crypt('testtest', gen_salt('bf')),
    NOW(),
    '{"display_name": "John Admin"}'::jsonb,
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    NOW(),
    NOW(),
    NOW(),
    'authenticated',
    'authenticated',
    '00000000-0000-0000-0000-000000000000',
    '',
    '',
    '',
    '',
    NULL,
    '',
    NULL,
    NULL,
    '',
    false,
    false
),
-- Jane Support
(
    '00000000-0000-0000-0000-000000000002',
    'jane.support@autocrm.com',
    crypt('testtest', gen_salt('bf')),
    NOW(),
    '{"display_name": "Jane Support"}'::jsonb,
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    NOW(),
    NOW(),
    NOW(),
    'authenticated',
    'authenticated',
    '00000000-0000-0000-0000-000000000000',
    '',
    '',
    '',
    '',
    NULL,
    '',
    NULL,
    NULL,
    '',
    false,
    false
),
-- Bob Agent
(
    '00000000-0000-0000-0000-000000000003',
    'bob.agent@autocrm.com',
    crypt('testtest', gen_salt('bf')),
    NOW(),
    '{"display_name": "Bob Agent"}'::jsonb,
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    NOW(),
    NOW(),
    NOW(),
    'authenticated',
    'authenticated',
    '00000000-0000-0000-0000-000000000000',
    '',
    '',
    '',
    '',
    NULL,
    '',
    NULL,
    NULL,
    '',
    false,
    false
),
-- Alice Customer
(
    '00000000-0000-0000-0000-000000000004',
    'alice.customer@acme.com',
    crypt('testtest', gen_salt('bf')),
    NOW(),
    '{"display_name": "Alice Customer"}'::jsonb,
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    NOW(),
    NOW(),
    NOW(),
    'authenticated',
    'authenticated',
    '00000000-0000-0000-0000-000000000000',
    '',
    '',
    '',
    '',
    NULL,
    '',
    NULL,
    NULL,
    '',
    false,
    false
),
-- Charlie Client
(
    '00000000-0000-0000-0000-000000000005',
    'charlie.client@techcorp.com',
    crypt('testtest', gen_salt('bf')),
    NOW(),
    '{"display_name": "Charlie Client"}'::jsonb,
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    NOW(),
    NOW(),
    NOW(),
    'authenticated',
    'authenticated',
    '00000000-0000-0000-0000-000000000000',
    '',
    '',
    '',
    '',
    NULL,
    '',
    NULL,
    NULL,
    '',
    false,
    false
); 