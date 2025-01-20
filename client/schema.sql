-- Reset tables
DROP TABLE IF EXISTS counts;
DROP TABLE IF EXISTS personal_counts;

-- For storing a personal counter for each user.
-- user_id references the built-in auth.users table in Supabase
CREATE TABLE personal_counts (
  user_id uuid references auth.users (id) not null primary key,
  value integer default 0
);

-- Insert initial data
INSERT INTO counts (value) VALUES (0); 