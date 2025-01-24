-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user_registration()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create role if email is confirmed and metadata exists
  IF NEW.email_confirmed_at IS NOT NULL AND NEW.raw_user_meta_data->>'intended_role' IS NOT NULL THEN
    INSERT INTO public.user_roles (
      user_id, 
      role, 
      first_name, 
      last_name, 
      is_active
    )
    VALUES (
      NEW.id, 
      NEW.raw_user_meta_data->>'intended_role',
      NEW.raw_user_meta_data->>'first_name',
      NEW.raw_user_meta_data->>'last_name',
      true
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically assign role to new users after email confirmation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_registration(); 