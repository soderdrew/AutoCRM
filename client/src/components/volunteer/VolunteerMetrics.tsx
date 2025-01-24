import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { supabase } from "../../supabaseClient";
import {
  BarChart,
  CalendarDays,
  Clock,
  HandHeart,
  History,
  Medal,
  Target,
  Users,
  MapPin,
  Building2
} from "lucide-react";

interface ServiceStats {
  totalHours: number;
  completedOpportunities: number;
  activeOpportunities: number;
  organizationsServed: number;
  averageHoursPerMonth: number;
  currentStreak: number;
  serviceTypes: { [key: string]: number };
  serviceHistory: Array<{
    id: string;
    title: string;
    organization: string;
    date: Date;
    duration: number;
    location: string;
  }>;
}

export function VolunteerMetrics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ServiceStats>({
    totalHours: 0,
    completedOpportunities: 0,
    activeOpportunities: 0,
    organizationsServed: 0,
    averageHoursPerMonth: 0,
    currentStreak: 0,
    serviceTypes: {},
    serviceHistory: []
  });

  useEffect(() => {
    async function fetchServiceStats() {
      try {
        setLoading(true);
        setError(null);

        // Get the current user's ID
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError('Please log in to view metrics');
          return;
        }
        console.log('Current user ID:', user.id);

        // Fetch all assignments for the current user
        const { data: assignments, error: assignmentsError } = await supabase
          .from('ticket_assignments')
          .select('*')  // Select all fields to see full assignment data
          .eq('agent_id', user.id)
          .eq('active', true);  // Only get active assignments

        if (assignmentsError) throw assignmentsError;

        console.log('Raw assignments data:', assignments);

        if (!assignments || assignments.length === 0) {
          console.log('No assignments found for user');
          setStats({
            totalHours: 0,
            completedOpportunities: 0,
            activeOpportunities: 0,
            organizationsServed: 0,
            averageHoursPerMonth: 0,
            currentStreak: 0,
            serviceTypes: {},
            serviceHistory: []
          });
          return;
        }

        const assignedTicketIds = assignments.map(a => a.ticket_id);
        console.log('Found assignments:', assignments.length);
        console.log('Assigned ticket IDs:', assignedTicketIds);

        // Fetch all assigned tickets with their details
        const { data: tickets, error: ticketsError } = await supabase
          .from('tickets')
          .select(`
            id,
            title,
            status,
            duration,
            customer_id,
            event_date,
            created_at,
            tags,
            location
          `)
          .in('id', assignedTicketIds)
          .order('event_date', { ascending: false });

        if (ticketsError) {
          console.error('Error fetching tickets:', ticketsError);
          throw ticketsError;
        }

        if (!tickets) {
          console.log('No tickets found for IDs:', assignedTicketIds);
          throw new Error('No tickets found');
        }

        // Fetch organization names for all customer_ids
        const uniqueCustomerIds = [...new Set(tickets.map(t => t.customer_id))];
        const { data: orgNames, error: orgError } = await supabase
          .from('user_roles')
          .select('user_id, first_name')
          .in('user_id', uniqueCustomerIds)
          .eq('role', 'customer');

        if (orgError) {
          console.error('Error fetching organization names:', orgError);
          throw orgError;
        }

        // Create a map of customer_id to organization name
        const orgNameMap = new Map(
          orgNames?.map(org => [org.user_id, org.first_name]) || []
        );

        console.log('Organization names map:', Object.fromEntries(orgNameMap));

        console.log('Found tickets:', tickets.length);
        console.log('Full ticket data:', tickets);

        // Get unique organizations served
        const uniqueOrganizations = new Set(tickets.map(t => t.customer_id));

        // Calculate completed opportunities
        const completedTickets = tickets.filter(ticket => 
          ['completed', 'closed', 'resolved'].includes(ticket.status.toLowerCase())
        );
        
        // Calculate active opportunities (not resolved/closed)
        const activeTickets = tickets.filter(ticket => 
          !['completed', 'closed', 'resolved'].includes(ticket.status.toLowerCase()) &&
          assignments.some(a => a.ticket_id === ticket.id && a.active)
        );

        console.log('Active tickets:', activeTickets.map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
          hasActiveAssignment: assignments.some(a => a.ticket_id === t.id && a.active)
        })));

        // Calculate total service hours
        const totalHours = completedTickets.reduce((sum, ticket) => 
          sum + ((ticket.duration || 0) / 60), 0
        );

        // Calculate hours this month
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const hoursThisMonth = completedTickets
          .filter(ticket => new Date(ticket.event_date) >= startOfMonth)
          .reduce((sum, ticket) => sum + ((ticket.duration || 0) / 60), 0);

        // Calculate current streak (consecutive weeks with completed service)
        let weekStreak = 0;
        const weekInMillis = 7 * 24 * 60 * 60 * 1000; // One week in milliseconds
        const sortedDates = completedTickets
          .map(t => new Date(t.event_date))
          .sort((a, b) => b.getTime() - a.getTime());

        if (sortedDates.length > 0) {
          let currentDate = new Date(sortedDates[0]);
          for (const date of sortedDates) {
            if (currentDate.getTime() - date.getTime() <= weekInMillis) { // Within a week
              weekStreak++;
              currentDate = date;
            } else {
              break;
            }
          }
        }

        // Calculate service types
        const serviceTypes = completedTickets.reduce((types, ticket) => {
          const tags = ticket.tags || [];
          tags.forEach((tag: string) => {
            types[tag] = (types[tag] || 0) + 1;
          });
          return types;
        }, {} as { [key: string]: number });

        // Create service history from completed tickets
        const serviceHistory = completedTickets
          .map(ticket => ({
            id: ticket.id,
            title: ticket.title,
            organization: orgNameMap.get(ticket.customer_id) || 'Unknown Organization',
            date: new Date(ticket.event_date),
            duration: (ticket.duration || 0) / 60,
            location: ticket.location || 'No location specified'
          }))
          .sort((a, b) => b.date.getTime() - a.date.getTime());

        setStats({
          totalHours: Number(totalHours.toFixed(1)),
          completedOpportunities: completedTickets.length,
          activeOpportunities: activeTickets.length,
          organizationsServed: uniqueOrganizations.size,
          averageHoursPerMonth: Number(hoursThisMonth.toFixed(1)),
          currentStreak: weekStreak,
          serviceTypes,
          serviceHistory
        });

      } catch (err) {
        console.error('Error fetching service stats:', err);
        setError(err instanceof Error ? err.message : 'Failed to load service statistics');
      } finally {
        setLoading(false);
      }
    }

    fetchServiceStats();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Service Metrics</h2>
        <p className="text-sm text-muted-foreground">
          Track your volunteer impact and service history
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="animate-pulse h-7 w-16 bg-gray-200 rounded" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats.totalHours}</div>
                <p className="text-xs text-muted-foreground">
                  Hours of service completed
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Opportunities</CardTitle>
            <HandHeart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="animate-pulse h-7 w-16 bg-gray-200 rounded" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats.completedOpportunities}</div>
                <p className="text-xs text-muted-foreground">
                  Completed opportunities
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Organizations</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="animate-pulse h-7 w-16 bg-gray-200 rounded" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats.organizationsServed}</div>
                <p className="text-xs text-muted-foreground">
                  Different organizations served
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Streak</CardTitle>
            <Medal className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="animate-pulse h-7 w-16 bg-gray-200 rounded" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats.currentStreak}</div>
                <p className="text-xs text-muted-foreground">
                  Consecutive weeks of service
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          <p className="font-medium">Error loading metrics</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Detailed Metrics */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="history">Service History</TabsTrigger>
          <TabsTrigger value="impact">Impact</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Monthly Hours</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="animate-pulse h-7 w-16 bg-gray-200 rounded" />
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      {stats.averageHoursPerMonth.toFixed(1)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Hours served this month
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Active Opportunities</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="animate-pulse h-7 w-16 bg-gray-200 rounded" />
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      {stats.activeOpportunities}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Currently signed up for
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Event Tags</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse h-4 bg-gray-200 rounded" />
                    ))}
                  </div>
                ) : Object.keys(stats.serviceTypes).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(stats.serviceTypes).map(([type, count]) => (
                      <div key={type} className="flex justify-between text-sm">
                        <span>{type}</span>
                        <span className="font-medium">{count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No event categories yet</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Service History</CardTitle>
              <p className="text-sm text-muted-foreground">
                Your completed volunteer opportunities
              </p>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse space-y-2">
                      <div className="h-5 w-3/4 bg-gray-200 rounded" />
                      <div className="h-4 w-1/2 bg-gray-100 rounded" />
                    </div>
                  ))}
                </div>
              ) : stats.serviceHistory.length > 0 ? (
                <div className="space-y-6">
                  {stats.serviceHistory.map((service) => (
                    <div key={service.id} className="border-b pb-4 last:border-0">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-medium">{service.title}</h4>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <Building2 className="h-4 w-4" />
                            <span>{service.organization}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <MapPin className="h-4 w-4" />
                            <span>{service.location}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{service.duration.toFixed(1)} hours</p>
                          <p className="text-sm text-muted-foreground">
                            {service.date.toLocaleDateString(undefined, {
                              weekday: 'short',
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">No completed services yet</p>
                  <p className="text-sm">
                    Your service history will appear here once you complete volunteer opportunities.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="impact" className="space-y-4">
          {/* Impact Metrics Content */}
          <Card>
            <CardHeader>
              <CardTitle>Your Impact</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Coming soon: Visualization of your service impact
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 