import { useEffect, useState, useCallback } from "react";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { List, LayoutGrid, Search, SlidersHorizontal } from "lucide-react";
import { VolunteerTicketCard } from "./VolunteerTicketCard";
import { supabase } from "../../../supabaseClient";
import type { Database } from "../../../types/supabase";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../ui/popover";
import { ScrollArea } from "../../ui/scroll-area";

type ViewMode = 'list' | 'grid';
type SortOption = 'posted-date-asc' | 'posted-date-desc' | 'event-date-asc' | 'event-date-desc' | 'priority' | 'people-needed-asc' | 'people-needed-desc';
type FilterStatus = 'all' | 'available' | 'my-opportunities' | 'full';
type DurationFilter = 'all' | '30min' | '1hour' | '2hours' | '3hours' | '4plus';
type TimeOfDayFilter = 'all' | 'morning' | 'afternoon' | 'evening' | 'weekend';

type Ticket = Database['public']['Tables']['tickets']['Row'] & {
  customer: {
    first_name: string;
    last_name: string;
    company: string | null;
  } | null;
  event_date: string;
  duration: number;
  location: string;
  current_volunteers: number;
  max_volunteers: number;
};

// Add duration filter helper
const getDurationRange = (filter: DurationFilter): { min: number; max: number } => {
  switch (filter) {
    case '30min':
      return { min: 0, max: 30 };
    case '1hour':
      return { min: 31, max: 60 };
    case '2hours':
      return { min: 61, max: 120 };
    case '3hours':
      return { min: 121, max: 180 };
    case '4plus':
      return { min: 181, max: Infinity };
    default:
      return { min: 0, max: Infinity };
  }
};

export function VolunteerTicketList() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Set<string>>(new Set());
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [sortBy, setSortBy] = useState<SortOption>('posted-date-desc');
  const [dateFilter, setDateFilter] = useState<string>('all'); // all, upcoming, past
  const [durationFilter, setDurationFilter] = useState<DurationFilter>('all');
  const [timeOfDayFilter, setTimeOfDayFilter] = useState<TimeOfDayFilter>('all');

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setCurrentUserId(session.user.id);
      }
    };
    checkAuth();
  }, []);

  const fetchTickets = useCallback(async () => {
    try {
      setError(null);
      console.log('Fetching opportunities...');
      
      // First fetch tickets
      const { data: ticketsData, error: ticketsError } = await supabase
        .from('tickets')
        .select(`
          id,
          title,
          description,
          status,
          priority,
          tags,
          custom_fields,
          customer_id,
          team_id,
          created_at,
          updated_at,
          resolved_at,
          closed_at,
          event_date,
          duration,
          location,
          max_volunteers,
          current_volunteers
        `)
        .not('status', 'eq', 'closed')
        .not('status', 'eq', 'resolved')
        .order('created_at', { ascending: false });

      if (ticketsError) {
        console.error('Supabase error:', ticketsError);
        throw ticketsError;
      }

      // Fetch current user's assignments
      if (currentUserId) {
        const { data: assignmentData, error: assignmentError } = await supabase
          .from('ticket_assignments')
          .select('ticket_id')
          .eq('agent_id', currentUserId)
          .eq('active', true);

        if (assignmentError) {
          console.error('Error fetching assignments:', assignmentError);
        } else {
          setAssignments(new Set(assignmentData.map(a => a.ticket_id)));
        }
      }

      // Then fetch user roles for all customers
      const customerIds = ticketsData?.map(t => t.customer_id) || [];
      const { data: userRolesData, error: userRolesError } = await supabase
        .from('user_roles')
        .select('user_id, first_name, last_name, company')
        .in('user_id', customerIds)
        .eq('role', 'customer');

      if (userRolesError) {
        console.error('Error fetching user roles:', userRolesError);
        throw userRolesError;
      }

      // Create a map of user_id to user role data
      const userRolesMap = new Map(
        userRolesData?.map(role => [
          role.user_id, 
          {
            first_name: role.first_name || '',
            last_name: role.last_name || '',
            company: role.company || role.first_name || null
          }
        ]) || []
      );

      // Combine tickets with their customer data
      const transformedTickets = (ticketsData || []).map(ticket => ({
        ...ticket,
        customer: userRolesMap.get(ticket.customer_id) || null,
        event_date: ticket.event_date || new Date().toISOString() // Fallback for existing tickets without event_date
      }));

      setTickets(transformedTickets);
    } catch (err) {
      console.error('Error fetching opportunities:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch opportunities');
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (currentUserId) {
      fetchTickets();
    }
  }, [currentUserId, fetchTickets]);

  // Add useEffect for real-time updates
  useEffect(() => {
    if (!currentUserId) return;

    // Set up real-time subscription
    const subscription = supabase
      .channel('tickets-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets'
        },
        () => {
          console.log('Tickets table changed, refreshing...');
          fetchTickets();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [currentUserId, fetchTickets]);

  // Also subscribe to ticket_assignments changes
  useEffect(() => {
    if (!currentUserId) return;

    // Set up real-time subscription for assignments
    const subscription = supabase
      .channel('assignments-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ticket_assignments'
        },
        () => {
          console.log('Assignments changed, refreshing...');
          fetchTickets();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [currentUserId, fetchTickets]);

  useEffect(() => {
    // Apply filters and sorting to tickets
    let filtered = [...tickets];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(ticket => 
        ticket.title.toLowerCase().includes(query) ||
        ticket.description.toLowerCase().includes(query)
      );
    }

    // Apply priority filter
    if (selectedPriority !== 'all') {
      filtered = filtered.filter(ticket => ticket.priority === selectedPriority);
    }

    // Apply status filter
    if (filterStatus === 'my-opportunities') {
      filtered = filtered.filter(ticket => assignments.has(ticket.id));
    } else if (filterStatus === 'available') {
      filtered = filtered.filter(ticket => !assignments.has(ticket.id) && ticket.current_volunteers < ticket.max_volunteers);
    } else if (filterStatus === 'full') {
      filtered = filtered.filter(ticket => ticket.current_volunteers >= ticket.max_volunteers);
    }

    // Apply date filter
    const now = new Date();
    if (dateFilter === 'upcoming') {
      filtered = filtered.filter(ticket => {
        const eventDate = new Date(ticket.event_date);
        return eventDate >= now;
      });
    } else if (dateFilter === 'past') {
      filtered = filtered.filter(ticket => {
        const eventDate = new Date(ticket.event_date);
        return eventDate < now;
      });
    }

    // Apply duration filter
    if (durationFilter !== 'all') {
      const { min, max } = getDurationRange(durationFilter);
      filtered = filtered.filter(ticket => {
        const duration = ticket.duration || 0;
        return duration > min && duration <= max;
      });
    }

    // Apply time of day filter
    if (timeOfDayFilter !== 'all') {
      filtered = filtered.filter(ticket => {
        const eventDate = new Date(ticket.event_date);
        return getTimeOfDay(eventDate) === timeOfDayFilter;
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'posted-date-asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'posted-date-desc':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'event-date-asc':
          return new Date(a.event_date).getTime() - new Date(b.event_date).getTime();
        case 'event-date-desc':
          return new Date(b.event_date).getTime() - new Date(a.event_date).getTime();
        case 'people-needed-asc':
          return (a.max_volunteers - a.current_volunteers) - (b.max_volunteers - b.current_volunteers);
        case 'people-needed-desc':
          return (b.max_volunteers - b.current_volunteers) - (a.max_volunteers - a.current_volunteers);
        case 'priority': {
          const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        default:
          return 0;
      }
    });

    setFilteredTickets(filtered);
  }, [tickets, searchQuery, selectedPriority, filterStatus, sortBy, dateFilter, durationFilter, timeOfDayFilter, assignments]);

  // Helper function to determine time of day
  const getTimeOfDay = (date: Date): TimeOfDayFilter => {
    const day = date.getDay();
    const hour = date.getHours();

    if (day === 0 || day === 6) return 'weekend';
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    return 'evening';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
        <p className="font-medium">Error loading opportunities</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Available Opportunities</h2>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search opportunities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                Filters
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <ScrollArea className="h-[370px] pr-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Priority</label>
                  <Select
                    value={selectedPriority}
                    onValueChange={setSelectedPriority}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by priority" />
                    </SelectTrigger>
                      <SelectContent className="max-h-[200px]">
                        <ScrollArea className="h-full">
                      <SelectItem value="all">All Priorities</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                        </ScrollArea>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Duration</label>
                  <Select
                    value={durationFilter}
                    onValueChange={(value: DurationFilter) => setDurationFilter(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by duration" />
                    </SelectTrigger>
                      <SelectContent className="max-h-[200px]">
                        <ScrollArea className="h-full">
                      <SelectItem value="all">Any Duration</SelectItem>
                      <SelectItem value="30min">30 Minutes or Less</SelectItem>
                      <SelectItem value="1hour">31-60 Minutes</SelectItem>
                      <SelectItem value="2hours">1-2 Hours</SelectItem>
                      <SelectItem value="3hours">2-3 Hours</SelectItem>
                      <SelectItem value="4plus">More than 3 Hours</SelectItem>
                        </ScrollArea>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Date</label>
                  <Select
                    value={dateFilter}
                    onValueChange={setDateFilter}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by date" />
                    </SelectTrigger>
                      <SelectContent className="max-h-[200px]">
                        <ScrollArea className="h-full">
                      <SelectItem value="all">All Dates</SelectItem>
                      <SelectItem value="upcoming">Upcoming</SelectItem>
                      <SelectItem value="past">Past</SelectItem>
                        </ScrollArea>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select
                    value={filterStatus}
                    onValueChange={(value: FilterStatus) => setFilterStatus(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                      <SelectContent className="max-h-[200px]">
                        <ScrollArea className="h-full">
                      <SelectItem value="all">All Opportunities</SelectItem>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="full">Full</SelectItem>
                      <SelectItem value="my-opportunities">My Opportunities</SelectItem>
                        </ScrollArea>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Time of Day</label>
                  <Select
                    value={timeOfDayFilter}
                    onValueChange={(value: TimeOfDayFilter) => setTimeOfDayFilter(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by time of day" />
                    </SelectTrigger>
                      <SelectContent className="max-h-[200px]">
                        <ScrollArea className="h-full">
                      <SelectItem value="all">Any Time</SelectItem>
                      <SelectItem value="morning">Morning (5AM-12PM)</SelectItem>
                      <SelectItem value="afternoon">Afternoon (12PM-5PM)</SelectItem>
                      <SelectItem value="evening">Evening (5PM-Late)</SelectItem>
                      <SelectItem value="weekend">Weekend</SelectItem>
                        </ScrollArea>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Sort By</label>
                  <Select
                    value={sortBy}
                    onValueChange={(value: SortOption) => setSortBy(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                      <SelectContent className="max-h-[200px]">
                        <ScrollArea className="h-full">
                      <SelectItem value="posted-date-desc">Posted Date (Newest First)</SelectItem>
                      <SelectItem value="posted-date-asc">Posted Date (Oldest First)</SelectItem>
                      <SelectItem value="event-date-asc">Event Date (Soonest First)</SelectItem>
                      <SelectItem value="event-date-desc">Event Date (Latest First)</SelectItem>
                          <SelectItem value="priority">Priority (High to Low)</SelectItem>
                          <SelectItem value="people-needed-desc">People Needed (Most First)</SelectItem>
                          <SelectItem value="people-needed-asc">People Needed (Least First)</SelectItem>
                        </ScrollArea>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Results */}
      <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-4'}>
        {filteredTickets.map((ticket) => (
          <VolunteerTicketCard
            key={ticket.id}
            ticket={{
              id: ticket.id,
              title: ticket.title,
              customer: ticket.customer ? 
                ticket.customer.company || ticket.customer.first_name : 
                'Unknown Organization',
              status: ticket.status,
              priority: ticket.priority,
              createdAt: new Date(ticket.created_at).toLocaleString(),
              eventDate: ticket.event_date ? new Date(ticket.event_date) : null,
              duration: ticket.duration || 0,
              location: ticket.location || 'Location not specified',
              currentVolunteers: ticket.current_volunteers || 0,
              maxVolunteers: ticket.max_volunteers || 0
            }}
            isAssigned={assignments.has(ticket.id)}
          />
        ))}
        {filteredTickets.length === 0 && (
          <div className="col-span-full text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-600">No opportunities found</p>
          </div>
        )}
      </div>
    </div>
  );
} 