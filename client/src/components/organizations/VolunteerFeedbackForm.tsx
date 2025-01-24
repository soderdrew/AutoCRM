import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Checkbox } from '../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useToast } from '../../hooks/use-toast';
import { supabase } from '../../supabaseClient';

interface VolunteerFeedbackFormProps {
  isOpen: boolean;
  onClose: () => void;
  ticketId: string;
  organizationId: string;
  volunteers: Array<{ id: string; name: string; }>;
  onFeedbackSubmitted?: () => void;
}

export function VolunteerFeedbackForm({
  isOpen,
  onClose,
  ticketId,
  organizationId,
  volunteers,
  onFeedbackSubmitted
}: VolunteerFeedbackFormProps) {
  const { toast } = useToast();
  const [selectedVolunteerId, setSelectedVolunteerId] = useState<string>('');
  const [rating, setRating] = useState<number>(0);
  const [feedback, setFeedback] = useState('');
  const [skillsDemonstrated, setSkillsDemonstrated] = useState<string[]>([]);
  const [areasOfImprovement, setAreasOfImprovement] = useState('');
  const [wouldWorkAgain, setWouldWorkAgain] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableVolunteers, setAvailableVolunteers] = useState<Array<{ id: string; name: string; }>>(volunteers);

  // Fetch existing feedback and filter volunteers
  useEffect(() => {
    async function fetchExistingFeedback() {
      try {
        const { data: existingFeedback, error } = await supabase
          .from('volunteer_feedback')
          .select('volunteer_id')
          .eq('ticket_id', ticketId);

        if (error) throw error;

        // Filter out volunteers who already have feedback
        const feedbackVolunteerIds = new Set(existingFeedback?.map(f => f.volunteer_id) || []);
        const filteredVolunteers = volunteers.filter(v => !feedbackVolunteerIds.has(v.id));
        setAvailableVolunteers(filteredVolunteers);

        // Reset selected volunteer if they now have feedback
        if (selectedVolunteerId && feedbackVolunteerIds.has(selectedVolunteerId)) {
          setSelectedVolunteerId('');
        }
      } catch (err) {
        console.error('Error fetching existing feedback:', err);
      }
    }

    if (isOpen) {
      fetchExistingFeedback();
    }
  }, [isOpen, ticketId, volunteers, selectedVolunteerId]);

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSelectedVolunteerId('');
      setRating(0);
      setFeedback('');
      setSkillsDemonstrated([]);
      setAreasOfImprovement('');
      setWouldWorkAgain(false);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!selectedVolunteerId) {
      toast({
        title: 'Volunteer Required',
        description: 'Please select a volunteer to provide feedback for.',
        variant: 'destructive',
      });
      return;
    }

    if (!rating) {
      toast({
        title: 'Rating Required',
        description: 'Please provide a rating before submitting feedback.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('volunteer_feedback').insert({
        ticket_id: ticketId,
        volunteer_id: selectedVolunteerId,
        organization_id: organizationId,
        rating,
        feedback,
        skills_demonstrated: skillsDemonstrated,
        areas_of_improvement: areasOfImprovement,
        would_work_again: wouldWorkAgain,
      });

      if (error) throw error;

      toast({
        title: 'Feedback Submitted',
        description: 'Thank you for providing feedback for this volunteer.',
      });
      
      if (onFeedbackSubmitted) {
        onFeedbackSubmitted();
      }
      
      onClose();
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit feedback. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const skillOptions = [
    'Communication',
    'Teamwork',
    'Problem Solving',
    'Leadership',
    'Time Management',
    'Adaptability',
    'Initiative',
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Provide Volunteer Feedback</DialogTitle>
        </DialogHeader>

        {availableVolunteers.length === 0 ? (
          <div className="py-4 text-center text-gray-500">
            All volunteers have received feedback for this opportunity.
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Volunteer Selector */}
            <div className="space-y-2">
              <Label>Select Volunteer</Label>
              <Select
                value={selectedVolunteerId}
                onValueChange={setSelectedVolunteerId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a volunteer to rate" />
                </SelectTrigger>
                <SelectContent>
                  {availableVolunteers.map((volunteer) => (
                    <SelectItem key={volunteer.id} value={volunteer.id}>
                      {volunteer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Rating */}
            <div className="space-y-2">
              <Label>Rating</Label>
              <RadioGroup
                value={rating.toString()}
                onValueChange={(value) => setRating(parseInt(value))}
                className="flex space-x-4"
              >
                {[1, 2, 3, 4, 5].map((value) => (
                  <div key={value} className="flex items-center space-x-2">
                    <RadioGroupItem value={value.toString()} id={`rating-${value}`} />
                    <Label htmlFor={`rating-${value}`}>{value}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* General Feedback */}
            <div className="space-y-2">
              <Label>General Feedback</Label>
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Share your experience working with this volunteer..."
                className="min-h-[100px]"
              />
            </div>

            {/* Skills Demonstrated */}
            <div className="space-y-2">
              <Label>Skills Demonstrated</Label>
              <div className="grid grid-cols-2 gap-2">
                {skillOptions.map((skill) => (
                  <div key={skill} className="flex items-center space-x-2">
                    <Checkbox
                      id={skill}
                      checked={skillsDemonstrated.includes(skill)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSkillsDemonstrated([...skillsDemonstrated, skill]);
                        } else {
                          setSkillsDemonstrated(
                            skillsDemonstrated.filter((s) => s !== skill)
                          );
                        }
                      }}
                    />
                    <Label htmlFor={skill}>{skill}</Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Areas of Improvement */}
            <div className="space-y-2">
              <Label>Areas for Improvement</Label>
              <Textarea
                value={areasOfImprovement}
                onChange={(e) => setAreasOfImprovement(e.target.value)}
                placeholder="Suggest areas where the volunteer could improve..."
                className="min-h-[100px]"
              />
            </div>

            {/* Would Work Again */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="would-work-again"
                checked={wouldWorkAgain}
                onCheckedChange={(checked) => setWouldWorkAgain(checked as boolean)}
              />
              <Label htmlFor="would-work-again">
                I would work with this volunteer again
              </Label>
            </div>
          </div>
        )}

        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {availableVolunteers.length > 0 && (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 