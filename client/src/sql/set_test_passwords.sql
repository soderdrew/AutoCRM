-- Set passwords for test users
UPDATE auth.users
SET encrypted_password = crypt('testtest', gen_salt('bf')),
    email_confirmed_at = NOW()
WHERE email IN (
    'john.admin@autocrm.com',
    'jane.support@autocrm.com',
    'bob.agent@autocrm.com',
    'alice.customer@acme.com',
    'charlie.client@techcorp.com'
); 