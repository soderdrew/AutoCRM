-- Drop existing tables if they exist
DROP TABLE IF EXISTS ticket_comments;
DROP TABLE IF EXISTS ticket_assignments;
DROP TABLE IF EXISTS tickets;
DROP TABLE IF EXISTS team_members;
DROP TABLE IF EXISTS teams;
DROP TABLE IF EXISTS user_roles;

-- Create enum for user roles
CREATE TYPE user_role AS ENUM ('customer', 'employee', 'admin');

-- Create user_roles table to extend auth.users
CREATE TABLE user_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'customer',
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  company TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create teams table
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create team_members table
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  is_team_lead BOOLEAN DEFAULT false,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- Create tickets table
CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Standard fields
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'waiting', 'resolved', 'closed')),
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  
  -- Metadata
  tags TEXT[] DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}',
  
  -- Relationships
  customer_id UUID REFERENCES auth.users(id) NOT NULL,
  team_id UUID REFERENCES teams(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ
);

-- Create ticket assignments table
CREATE TABLE ticket_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES auth.users(id) NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  active BOOLEAN DEFAULT true
);

-- Create unique partial index for active assignments
CREATE UNIQUE INDEX idx_unique_active_assignment 
  ON ticket_assignments (ticket_id)
  WHERE active = true;

-- Create ticket comments table (for both internal notes and customer communications)
CREATE TABLE ticket_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  content TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_tickets_customer_id ON tickets(customer_id);
CREATE INDEX idx_tickets_team_id ON tickets(team_id);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_priority ON tickets(priority);
CREATE INDEX idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);
CREATE INDEX idx_ticket_assignments_ticket_id ON ticket_assignments(ticket_id);
CREATE INDEX idx_ticket_assignments_agent_id ON ticket_assignments(agent_id);
CREATE INDEX idx_user_roles_role ON user_roles(role);
CREATE INDEX idx_team_members_user_id ON team_members(user_id);
CREATE INDEX idx_team_members_team_id ON team_members(team_id);

-- Enable RLS on all tables
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_assignments ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = $1
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is employee
CREATE OR REPLACE FUNCTION is_employee(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = $1
    AND role IN ('employee', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing policies
DROP POLICY IF EXISTS "Allow user role creation during signup" ON user_roles;
DROP POLICY IF EXISTS "Enable insert for authentication service" ON user_roles;

-- Create a single, strict insert policy
CREATE POLICY "Allow role creation only with complete data"
ON user_roles FOR INSERT
WITH CHECK (
  -- Must have a valid user_id
  auth.uid() IS NOT NULL
  -- Must have role specified
  AND role IS NOT NULL
  -- For employees (volunteers), must have first and last name
  AND (
    (role = 'employee' AND first_name IS NOT NULL AND last_name IS NOT NULL)
    OR
    -- For customers (organizations), must have first_name (org name)
    (role = 'customer' AND first_name IS NOT NULL)
    OR
    -- Allow admin role with complete data
    (role = 'admin' AND first_name IS NOT NULL)
  )
);

-- Keep existing select policies
CREATE POLICY "Users can view their own role"
  ON user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON user_roles FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update roles"
  ON user_roles FOR UPDATE
  USING (is_admin(auth.uid()));

-- Teams policies
CREATE POLICY "Employees can view teams"
  ON teams FOR SELECT
  USING (is_employee(auth.uid()));

CREATE POLICY "Admins can manage teams"
  ON teams FOR ALL
  USING (is_admin(auth.uid()));

-- Team Members policies
CREATE POLICY "Employees can view team members"
  ON team_members FOR SELECT
  USING (is_employee(auth.uid()));

CREATE POLICY "Admins can manage team members"
  ON team_members FOR ALL
  USING (is_admin(auth.uid()));

-- Tickets policies
CREATE POLICY "Customers can view their own tickets"
  ON tickets FOR SELECT
  USING (auth.uid() = customer_id);

CREATE POLICY "Employees can view tickets assigned to their team"
  ON tickets FOR SELECT
  USING (
    is_employee(auth.uid()) AND (
      EXISTS (
        SELECT 1 FROM team_members
        WHERE team_members.team_id = tickets.team_id
        AND team_members.user_id = auth.uid()
      ) OR is_admin(auth.uid())
    )
  );

CREATE POLICY "Customers can create tickets"
  ON tickets FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Employees can update assigned tickets"
  ON tickets FOR UPDATE
  USING (
    is_employee(auth.uid()) AND (
      EXISTS (
        SELECT 1 FROM ticket_assignments
        WHERE ticket_assignments.ticket_id = tickets.id
        AND ticket_assignments.agent_id = auth.uid()
        AND ticket_assignments.active = true
      ) OR is_admin(auth.uid())
    )
  );

-- Comments policies
CREATE POLICY "Users can view comments on accessible tickets"
  ON ticket_comments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM tickets
    WHERE tickets.id = ticket_comments.ticket_id
    AND (
      tickets.customer_id = auth.uid()
      OR (is_employee(auth.uid()) AND (
        EXISTS (
          SELECT 1 FROM team_members
          WHERE team_members.team_id = tickets.team_id
          AND team_members.user_id = auth.uid()
        ) OR is_admin(auth.uid())
      ))
    )
  ));

CREATE POLICY "Users can create comments on accessible tickets"
  ON ticket_comments FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM tickets
    WHERE tickets.id = ticket_comments.ticket_id
    AND (
      tickets.customer_id = auth.uid()
      OR (is_employee(auth.uid()) AND (
        EXISTS (
          SELECT 1 FROM team_members
          WHERE team_members.team_id = tickets.team_id
          AND team_members.user_id = auth.uid()
        ) OR is_admin(auth.uid())
      ))
    )
  ));

-- Create functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updating timestamps
CREATE TRIGGER update_user_roles_updated_at
  BEFORE UPDATE ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_ticket_comments_updated_at
  BEFORE UPDATE ON ticket_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Function to ensure only employees can be assigned to teams
CREATE OR REPLACE FUNCTION check_team_member_is_employee()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT is_employee(NEW.user_id) THEN
    RAISE EXCEPTION 'Only employees can be assigned to teams';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_team_member_is_employee
  BEFORE INSERT OR UPDATE ON team_members
  FOR EACH ROW
  EXECUTE FUNCTION check_team_member_is_employee();

-- Function to ensure only employees can be assigned to tickets
CREATE OR REPLACE FUNCTION check_ticket_assignee_is_employee()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT is_employee(NEW.agent_id) THEN
    RAISE EXCEPTION 'Only employees can be assigned to tickets';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_ticket_assignee_is_employee
  BEFORE INSERT OR UPDATE ON ticket_assignments
  FOR EACH ROW
  EXECUTE FUNCTION check_ticket_assignee_is_employee(); 