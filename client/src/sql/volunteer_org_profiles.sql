-- Create enum for availability preferences
CREATE TYPE availability_preference AS ENUM ('morning', 'afternoon', 'evening', 'weekend', 'weekday');

-- Create volunteer profiles table
CREATE TABLE volunteer_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    bio TEXT,
    skills TEXT[], -- Array of skills
    availability availability_preference[],
    preferred_hours_per_week INTEGER,
    preferred_total_hours INTEGER,
    max_distance_miles INTEGER, -- For future location-based matching
    causes_of_interest TEXT[], -- Areas they're interested in helping with
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create organization profiles table
CREATE TABLE organization_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    description TEXT,
    website_url TEXT,
    social_media_links JSONB, -- Store social media links
    focus_areas TEXT[], -- Main areas of charitable work
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for both tables
CREATE TRIGGER update_volunteer_profiles_updated_at
    BEFORE UPDATE ON volunteer_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organization_profiles_updated_at
    BEFORE UPDATE ON organization_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies
ALTER TABLE volunteer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to read all profiles
CREATE POLICY "Profiles are viewable by all authenticated users" 
ON volunteer_profiles FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Profiles are viewable by all authenticated users" 
ON organization_profiles FOR SELECT 
TO authenticated 
USING (true);

-- Allow users to update only their own profile
CREATE POLICY "Users can update own volunteer profile" 
ON volunteer_profiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own organization profile" 
ON organization_profiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id);

-- Allow users to insert their own profile
CREATE POLICY "Users can insert own volunteer profile" 
ON volunteer_profiles FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own organization profile" 
ON organization_profiles FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Create indexes for better query performance
CREATE INDEX volunteer_profiles_user_id_idx ON volunteer_profiles(user_id);
CREATE INDEX organization_profiles_user_id_idx ON organization_profiles(user_id); 