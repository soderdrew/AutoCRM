import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import useAuth from '../../hooks/use-auth';
import { X, Check } from 'lucide-react';
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Card } from "../ui/card";
import { Checkbox } from "../ui/checkbox";
import { useToast } from "../../hooks/use-toast";
import { cn } from "../../lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover"
import { ScrollArea } from "../ui/scroll-area";

// Predefined skills list
const VOLUNTEER_SKILLS = [
  // Education & Support
  "Teaching",
  "Tutoring",
  "Mentoring",
  "Counseling",
  
  // Organization
  "Fundraising",
  "Team Leadership",
  
  // Hands-on Work
  "Food Service",
  "Construction",
  "Gardening",
  "Cleanup",
  
  // Creative
  "Photography",
  "Graphic Design",
  "Writing",
  
  // Skills
  "Language Translation",
  "Public Speaking",
  "Customer Service"
].sort();

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

interface FormErrors {
  bio?: string;
  skills?: string;
  availability?: string;
  preferred_hours_per_week?: string;
}

interface VolunteerProfileFormProps {
  existingProfile: VolunteerProfile | null;
  onProfileUpdate: () => void;
  onCancel?: () => void;
}

export default function VolunteerProfileForm({ 
  existingProfile,
  onProfileUpdate,
  onCancel 
}: VolunteerProfileFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  const [newCause, setNewCause] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [profile, setProfile] = useState<VolunteerProfile>({
    bio: '',
    skills: [],
    availability: [],
    preferred_hours_per_week: 0,
    preferred_total_hours: 0,
    causes_of_interest: [],
  });

  const availabilityOptions = [
    'morning',
    'afternoon',
    'evening',
    'weekend',
    'weekday',
  ];

  useEffect(() => {
    if (existingProfile) {
      setProfile(existingProfile);
    }
  }, [existingProfile]);

  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    let isValid = true;

    if (!profile.bio.trim()) {
      errors.bio = 'Please tell us about yourself';
      isValid = false;
    }

    if (profile.skills.length === 0) {
      errors.skills = 'Please add at least one skill';
      isValid = false;
    }

    if (profile.availability.length === 0) {
      errors.availability = 'Please select your availability';
      isValid = false;
    }

    if (profile.preferred_hours_per_week <= 0) {
      errors.preferred_hours_per_week = 'Please enter your preferred weekly hours';
      isValid = false;
    }

    setFormErrors(errors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFormErrors({});

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const updates = {
        ...profile,
        user_id: user?.id,
      };

      const { error } = await supabase
        .from('volunteer_profiles')
        .upsert(updates, { onConflict: 'user_id' });

      if (error) throw error;

      toast({
        title: existingProfile ? "Profile updated" : "Profile created",
        description: existingProfile 
          ? "Your volunteer profile has been updated successfully."
          : "Your volunteer profile has been created successfully.",
      });

      onProfileUpdate();

    } catch (error) {
      console.error('Error updating profile:', error);
      setError(error instanceof Error ? error.message : 'An error occurred');
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addSkill = () => {
    if (newSkill && !profile.skills.includes(newSkill)) {
      setProfile({ ...profile, skills: [...profile.skills, newSkill] });
      setNewSkill('');
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setProfile({
      ...profile,
      skills: profile.skills.filter((skill) => skill !== skillToRemove),
    });
  };

  const addCause = () => {
    if (newCause && !profile.causes_of_interest.includes(newCause)) {
      setProfile({
        ...profile,
        causes_of_interest: [...profile.causes_of_interest, newCause],
      });
      setNewCause('');
    }
  };

  const removeCause = (causeToRemove: string) => {
    setProfile({
      ...profile,
      causes_of_interest: profile.causes_of_interest.filter(
        (cause) => cause !== causeToRemove
      ),
    });
  };

  const handleAvailabilityChange = (timeSlot: string) => {
    const currentAvailability = new Set(profile.availability);
    if (currentAvailability.has(timeSlot)) {
      currentAvailability.delete(timeSlot);
    } else {
      currentAvailability.add(timeSlot);
    }
    setProfile({ ...profile, availability: Array.from(currentAvailability) });
  };

  const filteredSkills = VOLUNTEER_SKILLS.filter(skill =>
    skill.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Card className="w-full p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="bio" className="flex items-center gap-1">
            Bio
            <span className="text-red-500">*</span>
          </Label>
          <Textarea
            id="bio"
            value={profile.bio}
            onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
            placeholder="Tell us about yourself and your volunteering interests..."
            className={cn(
              "min-h-[100px]",
              formErrors.bio && "border-red-500 focus-visible:ring-red-500"
            )}
          />
          {formErrors.bio && (
            <p className="text-sm text-red-500">{formErrors.bio}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-1">
            Skills
            <span className="text-red-500">*</span>
          </Label>
          <Popover open={skillsOpen} onOpenChange={setSkillsOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={skillsOpen}
                className={cn(
                  "w-full justify-between",
                  !profile.skills.length && "text-muted-foreground",
                  formErrors.skills && "border-red-500 focus-visible:ring-red-500"
                )}
              >
                {profile.skills.length === 0
                  ? "Select skills..."
                  : `${profile.skills.length} selected`}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <div className="border-b px-3 py-2">
                <input
                  className="w-full bg-transparent focus:outline-none placeholder:text-muted-foreground"
                  placeholder="Search skills..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <ScrollArea className="h-72">
                <div className="p-2">
                  {filteredSkills.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      No skills found
                    </p>
                  ) : (
                    filteredSkills.map((skill) => (
                      <div
                        key={skill}
                        className="flex items-center space-x-2 p-2 hover:bg-accent rounded-sm cursor-pointer"
                        onClick={() => {
                          setProfile(prev => {
                            const skills = prev.skills.includes(skill)
                              ? prev.skills.filter(s => s !== skill)
                              : [...prev.skills, skill];
                            return { ...prev, skills };
                          });
                          setSkillsOpen(false);
                        }}
                      >
                        <Checkbox
                          checked={profile.skills.includes(skill)}
                          className="pointer-events-none"
                        />
                        <span>{skill}</span>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
          <div className="flex flex-wrap gap-2 mt-2">
            {profile.skills.map((skill) => (
              <div
                key={skill}
                className="flex items-center gap-1 bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-sm"
              >
                {skill}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 p-0"
                  onClick={() => removeSkill(skill)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
          {formErrors.skills && (
            <p className="text-sm text-red-500">{formErrors.skills}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-1">
            Availability
            <span className="text-red-500">*</span>
          </Label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {availabilityOptions.map((option) => (
              <div key={option} className="flex items-center space-x-2">
                <Checkbox
                  id={option}
                  checked={profile.availability.includes(option)}
                  onCheckedChange={() => handleAvailabilityChange(option)}
                />
                <Label htmlFor={option} className="capitalize">
                  {option}
                </Label>
              </div>
            ))}
          </div>
          {formErrors.availability && (
            <p className="text-sm text-red-500">{formErrors.availability}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="weekly-hours" className="flex items-center gap-1 mb-2">
              Weekly Hours
              <span className="text-red-500">*</span>
            </Label>
            <Input
              id="weekly-hours"
              type="number"
              min={0}
              value={profile.preferred_hours_per_week}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  preferred_hours_per_week: parseInt(e.target.value) || 0,
                })
              }
              className={cn(
                formErrors.preferred_hours_per_week && "border-red-500 focus-visible:ring-red-500"
              )}
            />
            {formErrors.preferred_hours_per_week && (
              <p className="text-sm text-red-500 mt-1">{formErrors.preferred_hours_per_week}</p>
            )}
          </div>

          <div>
            <Label htmlFor="total-hours" className="mb-2 block">Total Hours</Label>
            <Input
              id="total-hours"
              type="number"
              min={0}
              value={profile.preferred_total_hours}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  preferred_total_hours: parseInt(e.target.value) || 0,
                })
              }
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Causes of Interest</Label>
          <div className="flex gap-2">
            <Input
              value={newCause}
              onChange={(e) => setNewCause(e.target.value)}
              placeholder="Add a cause..."
              className="flex-1"
            />
            <Button 
              type="button"
              onClick={addCause}
              variant="secondary"
            >
              Add
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {profile.causes_of_interest.map((cause) => (
              <div
                key={cause}
                className="flex items-center gap-1 bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-sm"
              >
                {cause}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 p-0"
                  onClick={() => removeCause(cause)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="text-sm text-destructive">{error}</div>
        )}

        <div className="flex gap-4">
          {onCancel && (
            <Button 
              type="button" 
              variant="outline"
              onClick={onCancel}
            >
              Back
            </Button>
          )}
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save Profile'}
          </Button>
        </div>
      </form>
    </Card>
  );
} 