import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import useAuth from '../../hooks/use-auth';
import VolunteerProfileForm from './VolunteerProfileForm';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { UserCircle, Pencil, Clock, Calendar, Award } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';

interface VolunteerProfile {
  id?: string;
  user_id?: string;
  bio: string;
  skills: string[];
  availability: string[];
  preferred_hours_per_week: number;
  preferred_total_hours: number;
  causes_of_interest: string[];
}

export function Profile() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<VolunteerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      fetchProfile();
    }
  }, [user, authLoading]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('volunteer_profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // No profile found
          setProfile(null);
        } else {
          throw error;
        }
      } else {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center text-red-600">
          <p className="font-semibold">Error loading profile</p>
          <p className="text-sm">{error}</p>
          <Button 
            variant="outline" 
            onClick={fetchProfile}
            className="mt-4"
          >
            Try Again
          </Button>
        </div>
      </Card>
    );
  }

  if (!profile && !showForm) {
    return (
      <Card className="p-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <UserCircle className="h-20 w-20 text-gray-400" />
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Create Your Volunteer Profile</h2>
            <p className="text-gray-600 mt-2">
              Set up your profile to help us match you with the perfect volunteer opportunities.
            </p>
          </div>
          <Button 
            onClick={() => setShowForm(true)}
            className="mt-4"
          >
            Create Profile
          </Button>
        </div>
      </Card>
    );
  }

  if (showForm) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {profile ? 'Edit Profile' : 'Create Profile'}
          </h1>
          <p className="text-lg text-gray-600">
            {profile 
              ? 'Update your volunteer preferences and information.'
              : 'Tell us about yourself and your volunteering interests.'
            }
          </p>
        </div>

        <VolunteerProfileForm 
          existingProfile={profile} 
          onProfileUpdate={() => {
            fetchProfile();
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      </div>
    );
  }

  // Profile Display View
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Volunteer Profile</h1>
          <p className="text-lg text-gray-600">Your volunteering preferences and information.</p>
        </div>
        <Button 
          onClick={() => setShowForm(true)} 
          variant="outline"
          size="icon"
          className="h-10 w-10"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </div>

      {profile && (
        <Card className="p-6">
          <div className="space-y-6">
            {/* Bio Section */}
            <div>
              <h3 className="font-semibold text-lg mb-2">About Me</h3>
              <p className="text-gray-700 whitespace-pre-wrap">{profile.bio}</p>
            </div>

            <Separator />

            {/* Skills Section */}
            <div>
              <h3 className="font-semibold text-lg mb-3">Skills</h3>
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((skill) => (
                  <Badge key={skill} variant="secondary">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            {/* Availability Section */}
            <div>
              <h3 className="font-semibold text-lg mb-3">Availability</h3>
              <div className="flex flex-wrap gap-2">
                {profile.availability.map((time) => (
                  <Badge key={time} variant="outline" className="capitalize">
                    <Clock className="mr-1 h-3 w-3" />
                    {time}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            {/* Time Commitments */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-lg mb-3">Weekly Commitment</h3>
                <Badge variant="outline">
                  <Calendar className="mr-1 h-3 w-3" />
                  {profile.preferred_hours_per_week} hours per week
                </Badge>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-3">Total Goal</h3>
                <Badge variant="outline">
                  <Award className="mr-1 h-3 w-3" />
                  {profile.preferred_total_hours} total hours
                </Badge>
              </div>
            </div>

            {/* Causes Section */}
            {profile.causes_of_interest.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold text-lg mb-3">Causes of Interest</h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.causes_of_interest.map((cause) => (
                      <Badge key={cause} variant="secondary">
                        {cause}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

export default Profile;