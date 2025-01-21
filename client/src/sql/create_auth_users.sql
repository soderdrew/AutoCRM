-- Insert test users into auth.users
INSERT INTO auth.users (
  id,
  raw_user_meta_data,
  email,
  phone,
  raw_app_meta_data,
  created_at,
  last_sign_in_at
) VALUES
  -- John Admin
  (
    '00000000-0000-0000-0000-000000000001',
    '{"display_name": "John Admin"}',
    'john.admin@autocrm.com',
    NULL,
    '{"provider": "email", "providers": ["email"]}',
    NOW(),
    NOW()
  ),
  -- Jane Support
  (
    '00000000-0000-0000-0000-000000000002',
    '{"display_name": "Jane Support"}',
    'jane.support@autocrm.com',
    NULL,
    '{"provider": "email", "providers": ["email"]}',
    NOW(),
    NOW()
  ),
  -- Bob Agent
  (
    '00000000-0000-0000-0000-000000000003',
    '{"display_name": "Bob Agent"}',
    'bob.agent@autocrm.com',
    NULL,
    '{"provider": "email", "providers": ["email"]}',
    NOW(),
    NOW()
  ),
  -- Alice Customer
  (
    '00000000-0000-0000-0000-000000000004',
    '{"display_name": "Alice Customer"}',
    'alice.customer@acme.com',
    NULL,
    '{"provider": "email", "providers": ["email"]}',
    NOW(),
    NOW()
  ),
  -- Charlie Client
  (
    '00000000-0000-0000-0000-000000000005',
    '{"display_name": "Charlie Client"}',
    'charlie.client@techcorp.com',
    NULL,
    '{"provider": "email", "providers": ["email"]}',
    NOW(),
    NOW()
  ); 