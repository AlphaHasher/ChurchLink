import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Separator } from "@/shared/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/components/ui/collapsible";
import { toast } from "react-toastify";
import { 
  Calendar, 
  Users, 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Clock,
  MapPin,
  Eye,
  Download,
  ChevronRight,
  ChevronDown,
  Mail,
  Phone,
  CreditCard
} from "lucide-react";
import { formatRecurrenceType } from "@/helpers/RecurringEventHelper";
import api from "@/api/api";

interface Attendee {
  key: string;
  display_name: string;
  user_email?: string;
  phone?: string;
  addedOn: string;
  payment_status: string;
  payment_type?: string; // e.g., "card", "paypal", "cash", "free"
  transaction_id?: string;
  payment_required: boolean;
}

interface EventOccurrence {
  id: string;
  name: string;
  date: string;
  location: string;
  price: number;
  spots: number;
  attendees_count: number;
  revenue: number;
  status: "completed" | "cancelled" | "ongoing";
  attendance_rate: number; // percentage
  attendees?: Attendee[]; // List of actual attendees
}

interface EventHistoryStats {
  total_occurrences: number;
  total_attendees: number;
  total_revenue: number;
  average_attendance: number;
  average_revenue: number;
  best_attendance: {
    count: number;
    date: string;
  };
  trend: "increasing" | "decreasing" | "stable";
}

interface EventHistoryProps {
  eventId: string;
  eventName: string;
  recurrenceType: string;
}

// Separate component for individual event occurrence
interface EventOccurrenceCardProps {
  occurrence: EventOccurrence;
  index: number;
  onView: (occurrence: EventOccurrence) => void;
  onDownload: (occurrence: EventOccurrence) => void;
}

const EventOccurrenceCard: React.FC<EventOccurrenceCardProps> = ({ 
  occurrence, 
  index, 
  onView, 
  onDownload 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getStatusBadge = (status: EventOccurrence['status']) => {
    const variants = {
      completed: "default",
      cancelled: "destructive", 
      ongoing: "secondary"
    } as const;
    
    return <Badge variant={variants[status]}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
  };

  const exportAttendeesToCSV = () => {
    if (!occurrence.attendees || occurrence.attendees.length === 0) {
      toast.error('No attendees data available to export');
      return;
    }

    try {
      const csvData = [
        // Header
        ['Name', 'Email', 'Phone', 'Registration Date', 'Payment Status', 'Payment Type', 'Transaction ID'],
        // Attendees data
        ...occurrence.attendees.map(attendee => [
          attendee.display_name,
          attendee.user_email || '',
          attendee.phone || '',
          formatDate(attendee.addedOn),
          attendee.payment_status,
          attendee.payment_type || 'N/A',
          attendee.transaction_id || 'N/A'
        ])
      ];

      const csvContent = csvData.map(row => 
        row.map(field => `"${field}"`).join(',')
      ).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${occurrence.name}_${formatDate(occurrence.date).replace(/[^a-zA-Z0-9]/g, '_')}_Attendees.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(`Attendees list exported successfully!`);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export attendees list');
    }
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className="border rounded-lg p-4 hover:bg-muted/30 transition-colors">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h4 className="font-medium">{formatDate(occurrence.date)}</h4>
              {getStatusBadge(occurrence.status)}
              {index === 0 && (
                <Badge variant="outline" className="text-xs">Latest</Badge>
              )}
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>{occurrence.attendees_count}/{occurrence.spots} attendees</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span>{occurrence.attendance_rate}% capacity</span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span>{formatCurrency(occurrence.revenue)}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{occurrence.location}</span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2 ml-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => onView(occurrence)}
              title="View event details"
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => onDownload(occurrence)}
              title="Download occurrence data"
            >
              <Download className="h-4 w-4" />
            </Button>
            {occurrence.attendees && occurrence.attendees.length > 0 && (
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" title="View attendees">
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            )}
          </div>
        </div>

        {/* Expandable Attendees Section */}
        <CollapsibleContent className="mt-4">
          <Separator className="mb-4" />
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h5 className="font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Attendees ({occurrence.attendees?.length || 0})
              </h5>
              <Button 
                variant="outline" 
                size="sm"
                onClick={exportAttendeesToCSV}
              >
                <Download className="h-4 w-4 mr-2" />
                Export Attendees
              </Button>
            </div>
            
            {occurrence.attendees && occurrence.attendees.length > 0 ? (
              <div className="bg-muted/30 rounded-lg p-3">
                <div className="grid gap-2 max-h-60 overflow-y-auto">
                  {occurrence.attendees.map((attendee) => (
                    <div key={attendee.key} className="flex justify-between items-center p-3 bg-background rounded border">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{attendee.display_name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-4">
                          {attendee.user_email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {attendee.user_email}
                            </span>
                          )}
                          {attendee.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {attendee.phone}
                            </span>
                          )}
                        </div>
                        {/* Payment details for paid events */}
                        {attendee.payment_required && (
                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-4">
                            {attendee.payment_type && (
                              <span className="flex items-center gap-1 text-blue-600">
                                <CreditCard className="h-3 w-3" />
                                {attendee.payment_type.charAt(0).toUpperCase() + attendee.payment_type.slice(1)}
                              </span>
                            )}
                            {attendee.transaction_id && (
                              <span className="flex items-center gap-1 text-green-600 font-mono">
                                ID: {attendee.transaction_id}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={(attendee.payment_status === "completed" || attendee.payment_status === "paid") ? "default" : "secondary"}
                          className="text-xs"
                        >
                          <CreditCard className="h-3 w-3 mr-1" />
                          {attendee.payment_status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2" />
                <p>No attendees data available</p>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

export const EventHistory: React.FC<EventHistoryProps> = ({
  eventId,
  eventName,
  recurrenceType
}) => {
  const navigate = useNavigate();
  const [occurrences, setOccurrences] = useState<EventOccurrence[]>([]);
  const [stats, setStats] = useState<EventHistoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEventHistory();
  }, [eventId]);

  const fetchEventHistory = async () => {
    try {
      setLoading(true);
      
      // Fetch historical occurrences (this would be a new API endpoint)
      const historyResponse = await api.get(`/v1/events/${eventId}/history`);
      setOccurrences(historyResponse.data.occurrences || []);
      setStats(historyResponse.data.stats || null);
      
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch event history:", err);
      setError("Failed to load event history");
      
      // For demo purposes, provide mock data if API fails
      setOccurrences(generateMockOccurrences());
      setStats(generateMockStats());
    } finally {
      setLoading(false);
    }
  };

  // Mock data generator for demonstration
  const generateMockOccurrences = (): EventOccurrence[] => {
    const now = new Date();
    const occurrences: EventOccurrence[] = [];
    
    // Mock attendee names for variety
    const mockNames = [
      "John Smith", "Sarah Johnson", "Michael Brown", "Emily Davis", "David Wilson",
      "Lisa Anderson", "Robert Taylor", "Jennifer Miller", "Christopher Moore", "Amanda Jackson",
      "Matthew White", "Jessica Harris", "Daniel Martin", "Ashley Thompson", "James Garcia",
      "Melissa Rodriguez", "William Lewis", "Stephanie Lee", "Joseph Walker", "Nicole Hall"
    ];
    
    for (let i = 0; i < 6; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - (i + 1) * 7); // Weekly occurrences going back
      
      const attendeesCount = Math.floor(Math.random() * 25) + 15;
      
      // Generate mock attendees for this occurrence
      const attendees: Attendee[] = [];
      for (let j = 0; j < attendeesCount; j++) {
        const name = mockNames[j % mockNames.length];
        const registrationDate = new Date(date);
        registrationDate.setDate(registrationDate.getDate() - Math.floor(Math.random() * 14)); // Registered 0-14 days before event
        
        const paymentCompleted = Math.random() > 0.2; // 80% completed payments
        const paymentTypes = ["card", "paypal", "cash", "bank_transfer", "free"];
        const selectedPaymentType = paymentTypes[Math.floor(Math.random() * paymentTypes.length)];
        
        attendees.push({
          key: `attendee-${i}-${j}`,
          display_name: `${name} ${j > mockNames.length - 1 ? (j + 1) : ''}`.trim(),
          user_email: `${name.toLowerCase().replace(' ', '.')}${j > mockNames.length - 1 ? j + 1 : ''}@example.com`,
          phone: `(555) ${String(Math.floor(Math.random() * 900) + 100)}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
          addedOn: registrationDate.toISOString(),
          payment_status: paymentCompleted ? "completed" : "pending",
          payment_type: selectedPaymentType,
          transaction_id: paymentCompleted && selectedPaymentType !== "free" ? 
            `${selectedPaymentType === "paypal" ? "PP" : selectedPaymentType === "card" ? "CH" : "BT"}_${Math.random().toString(36).substr(2, 9).toUpperCase()}` : 
            undefined,
          payment_required: selectedPaymentType !== "free"
        });
      }
      
      occurrences.push({
        id: `mock-${i}`,
        name: eventName,
        date: date.toISOString(),
        location: "Church Main Hall",
        price: 25,
        spots: 30,
        attendees_count: attendeesCount,
        revenue: attendeesCount * 25,
        status: "completed",
        attendance_rate: Math.floor((attendeesCount / 30) * 100),
        attendees: attendees
      });
    }
    
    return occurrences;
  };

  const generateMockStats = (): EventHistoryStats => {
    return {
      total_occurrences: 6,
      total_attendees: 126,
      total_revenue: 3150,
      average_attendance: 21,
      average_revenue: 525,
      best_attendance: {
        count: 28,
        date: "2025-09-15"
      },
      trend: "increasing"
    };
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getTrendIcon = (trend: EventHistoryStats['trend']) => {
    switch (trend) {
      case "increasing":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "decreasing":
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  // CSV Export functionality
  const exportOccurrenceToCSV = (occurrence: EventOccurrence) => {
    try {
      const csvData = [
        ['Field', 'Value'],
        ['Event Name', occurrence.name],
        ['Date', formatDate(occurrence.date)],
        ['Location', occurrence.location],
        ['Price', `$${occurrence.price.toFixed(2)}`],
        ['Total Spots', occurrence.spots.toString()],
        ['Attendees', occurrence.attendees_count.toString()],
        ['Attendance Rate', `${occurrence.attendance_rate}%`],
        ['Revenue', formatCurrency(occurrence.revenue)],
        ['Status', occurrence.status]
      ];

      const csvContent = csvData.map(row => 
        row.map(field => `"${field}"`).join(',')
      ).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${occurrence.name}_${formatDate(occurrence.date).replace(/[^a-zA-Z0-9]/g, '_')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(`Event data exported successfully!`);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export event data');
    }
  };

  const exportAllHistoryToCSV = () => {
    if (!stats || occurrences.length === 0) {
      toast.error('No historical data available to export');
      return;
    }

    try {
      const csvData = [
        // Header
        ['Date', 'Attendees', 'Capacity', 'Attendance Rate (%)', 'Revenue', 'Status'],
        // Data rows
        ...occurrences.map(occ => [
          formatDate(occ.date),
          occ.attendees_count.toString(),
          occ.spots.toString(),
          occ.attendance_rate.toString(),
          occ.revenue.toString(),
          occ.status
        ]),
        // Summary row
        ['', '', '', '', '', ''],
        ['SUMMARY', '', '', '', '', ''],
        ['Total Occurrences', stats.total_occurrences.toString(), '', '', '', ''],
        ['Total Attendees', stats.total_attendees.toString(), '', '', '', ''],
        ['Total Revenue', stats.total_revenue.toString(), '', '', '', ''],
        ['Average Attendance', stats.average_attendance.toString(), '', '', '', ''],
        ['Trend', stats.trend, '', '', '', '']
      ];

      const csvContent = csvData.map(row => 
        row.map(field => `"${field}"`).join(',')
      ).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${eventName}_History_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(`Complete event history exported successfully!`);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export event history');
    }
  };

  // View occurrence details - navigate to event details if it's a real event
  const viewOccurrenceDetails = (occurrence: EventOccurrence) => {
    if (occurrence.id.startsWith('mock-')) {
      // For mock data, show an alert with details
      alert(`Event Details:\n\nName: ${occurrence.name}\nDate: ${formatDate(occurrence.date)}\nAttendees: ${occurrence.attendees_count}/${occurrence.spots}\nRevenue: ${formatCurrency(occurrence.revenue)}\nStatus: ${occurrence.status}\n\nNote: This is mock historical data. In a real implementation, this would navigate to the actual event details.`);
    } else {
      // Navigate to the actual event details page
      navigate(`/admin/events/${occurrence.id}`);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Event History</CardTitle>
          <CardDescription>Loading historical data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Event History</CardTitle>
          <CardDescription>Historical data for {formatRecurrenceType(recurrenceType as any)} occurrences</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center p-8">
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchEventHistory} variant="outline">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Statistics */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Event History Overview
              {getTrendIcon(stats.trend)}
            </CardTitle>
            <CardDescription>
              Performance summary for {formatRecurrenceType(recurrenceType as any)} occurrences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-primary">{stats.total_occurrences}</div>
                <div className="text-sm text-muted-foreground">Total Events</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{stats.total_attendees}</div>
                <div className="text-sm text-muted-foreground">Total Attendees</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{formatCurrency(stats.total_revenue)}</div>
                <div className="text-sm text-muted-foreground">Total Revenue</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{Math.round(stats.average_attendance)}</div>
                <div className="text-sm text-muted-foreground">Avg Attendance</div>
              </div>
            </div>
            
            <Separator className="my-4" />
            
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">Best attendance</p>
                <p className="font-medium">{stats.best_attendance.count} attendees on {formatDate(stats.best_attendance.date)}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Trend:</span>
                  <Badge variant={stats.trend === "increasing" ? "default" : stats.trend === "decreasing" ? "destructive" : "secondary"}>
                    {stats.trend}
                  </Badge>
                </div>
                <Button 
                  onClick={exportAllHistoryToCSV}
                  variant="outline"
                  size="sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export All
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historical Occurrences */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Past Occurrences</CardTitle>
              <CardDescription>
                Historical data for previous {formatRecurrenceType(recurrenceType as any)} events
              </CardDescription>
            </div>
            {occurrences.length > 0 && (
              <Button 
                onClick={exportAllHistoryToCSV}
                variant="outline"
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Export List
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {occurrences.length === 0 ? (
            <div className="text-center p-8">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No historical data available</p>
              <p className="text-sm text-muted-foreground mt-2">
                History will appear after the first occurrence of this recurring event
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {occurrences.map((occurrence, index) => (
                <EventOccurrenceCard 
                  key={occurrence.id} 
                  occurrence={occurrence} 
                  index={index}
                  onView={viewOccurrenceDetails}
                  onDownload={exportOccurrenceToCSV}
                />
              ))}
              
              {occurrences.length > 5 && (
                <div className="text-center pt-4">
                  <Button variant="outline" onClick={() => console.log('Load more occurrences')}>
                    Load More Occurrences
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};