import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Separator } from "@/shared/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { ArrowLeft, Users, DollarSign, Calendar, MapPin, Download, RefreshCw, History } from "lucide-react";
import { RecurringEventManagement } from "@/features/admin/components/Events/RecurringEventManagement";
import { EventHistory } from "../components/Events/EventHistory";
import api from "@/api/api";

interface EventDetails {
  event: {
    id: string;
    name: string;
    description: string;
    date: string;
    location: string;
    price: number;
    spots: number;
    rsvp: boolean;
    recurring: string;
    ministry: string[];
    min_age: number;
    max_age: number;
    gender: string;
    image_url?: string;
    published: boolean;
    payment_options: string[]; // Available payment methods: ['PayPal', 'Door']
    refund_policy?: string;
    requires_payment: boolean;
    is_free_event: boolean;
  };
  statistics: {
    total_spots: number | string;
    spots_taken: number;
    available_spots: number | string;
    total_registrations: number;
    total_revenue: number;
    pending_payments: number;
    completed_payments: number;
  };
  attendees: Array<{
    key: string;
    kind: string;
    user_uid: string;
    person_id?: string;
    display_name: string;
    addedOn: string;
    payment_status: string; // Legacy field
    computed_payment_status?: string; // NEW: From centralized system
    transaction_id?: string;
    payment_required: boolean;
    user_email?: string;
    phone?: string;
    transaction_details?: {
      transaction_id: string;
      amount: number;
      status: string;
      payment_method: string;
      created_on: string;
    }; // NEW: Enriched transaction data
  }>;
  payment_summary: {
    total_registrations: number;
    paid_count: number;
    pending_count: number;
    by_status: Record<string, { count: number; attendees: any[] }>;
  };
  transactions: Array<{
    transaction_id: string;
    user_email: string;
    amount: number;
    status: string;
    payment_method: string;
    created_on: string;
    event_name?: string;
    registration_key?: string;
  }>;
}

const EventDetails = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [eventDetails, setEventDetails] = useState<EventDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper functions for payment options
  const hasPayPalOption = (event: EventDetails['event']) => {
    return event.payment_options?.includes('PayPal') || event.payment_options?.includes('paypal');
  };

  const requiresPayment = (event: EventDetails['event']) => {
    return event.requires_payment; // Use the backend-calculated value
  };

  const fetchEventDetails = async () => {
    if (!eventId) return;
    
    try {
      setLoading(true);
      const response = await api.get(`/v1/events/${eventId}/admin-details`);
      setEventDetails(response.data);
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch event details:", err);
      setError(err.response?.data?.detail || "Failed to load event details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEventDetails();
  }, [eventId]);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return "Invalid Date";
      }
      return date.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (error) {
      return "Invalid Date";
    }
  };

  const formatSimpleDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return "Invalid Date";
      }
      return date.toLocaleDateString();
    } catch (error) {
      return "Invalid Date";
    }
  };

  const formatSimpleTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return "Invalid Time";
      }
      return date.toLocaleTimeString();
    } catch (error) {
      return "Invalid Time";
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      completed: { variant: "default", label: "Paid" },
      pending: { variant: "outline", label: "Pending" },
      failed: { variant: "destructive", label: "Failed" },
      refund_requested: { variant: "outline", label: "Refund Requested" },
      refunded: { variant: "secondary", label: "Refunded" },
      not_required: { variant: "secondary", label: "Free" },
    };
    
    const config = variants[status] || { variant: "outline", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const exportAttendees = () => {
    if (!eventDetails) return;
    
    const csvContent = [
      ["Name", "Email", "Phone", "Registration Date", "Payment Status", "Payment Required", "Transaction ID"].join(","),
      ...eventDetails.attendees.map(attendee => [
        `"${attendee.display_name}"`,
        `"${attendee.user_email || ""}"`,
        `"${attendee.phone || ""}"`,
        `"${formatSimpleDate(attendee.addedOn)}"`,
        `"${attendee.computed_payment_status || attendee.payment_status || 'unknown'}"`,
        `"${attendee.payment_required ? "Yes" : "No"}"`,
        `"${attendee.transaction_id || ""}"`
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${eventDetails.event.name}-attendees.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading event details...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center mb-4">
          <Button variant="ghost" onClick={() => navigate("/admin/events")} className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Events
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Error Loading Event</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
            <Button onClick={fetchEventDetails} className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!eventDetails) {
    return (
      <div className="p-6">
        <div className="flex items-center mb-4">
          <Button variant="ghost" onClick={() => navigate("/admin/events")} className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Events
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Event Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p>The requested event could not be found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { event, statistics, attendees, transactions } = eventDetails;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Button variant="ghost" onClick={() => navigate("/admin/events")} className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Events
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{event.name}</h1>
            <p className="text-gray-600">Event Details & Attendee Management</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button onClick={fetchEventDetails} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={exportAttendees}>
            <Download className="h-4 w-4 mr-2" />
            Export Attendees
          </Button>
        </div>
      </div>

      {/* Tabbed Content */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="attendees">Attendees ({attendees.length})</TabsTrigger>
          <TabsTrigger value="history" disabled={!event.recurring || event.recurring === "never"}>
            <History className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Event Information */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calendar className="h-5 w-5 mr-2" />
                  Event Information
                </CardTitle>
              </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Date & Time</p>
                <p className="text-sm">{formatDate(event.date)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Location</p>
                <p className="text-sm flex items-center">
                  <MapPin className="h-4 w-4 mr-1" />
                  {event.location || "Not specified"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Price</p>
                <p className="text-sm flex items-center">
                  <DollarSign className="h-4 w-4 mr-1" />
                  {event.price === 0 ? "Free" : `$${event.price.toFixed(2)}`}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Capacity</p>
                <p className="text-sm">{statistics.total_spots} spots</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Ministry</p>
                <div className="flex flex-wrap gap-1">
                  {event.ministry.map((m, index) => (
                    <Badge key={index} variant="secondary">{m}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Age Range</p>
                <p className="text-sm">{event.min_age} - {event.max_age} years</p>
              </div>
            </div>
            
            {event.description && (
              <div>
                <p className="text-sm font-medium text-gray-500">Description</p>
                <p className="text-sm">{event.description}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Badge variant={event.published ? "default" : "secondary"}>
                {event.published ? "Published" : "Draft"}
              </Badge>
              {hasPayPalOption(event) && (
                <Badge variant="outline">PayPal Available</Badge>
              )}
              {requiresPayment(event) && (
                <Badge variant="outline">Payment Required</Badge>
              )}
              {event.rsvp && (
                <Badge variant="outline">RSVP Required</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Registrations</p>
              <p className="text-2xl font-bold">{statistics.total_registrations}</p>
              <p className="text-xs text-gray-500">
                {statistics.spots_taken} of {statistics.total_spots} spots taken
              </p>
            </div>
            
            <Separator />
            
            <div>
              <p className="text-sm font-medium text-gray-500">Available Spots</p>
              <p className="text-xl font-semibold text-green-600">{statistics.available_spots}</p>
            </div>

            {event.requires_payment && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-medium text-gray-500">Revenue</p>
                  <p className="text-2xl font-bold text-green-600">
                    ${statistics.total_revenue.toFixed(2)}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Paid:</span>
                    <span className="text-sm font-medium">{statistics.completed_payments}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Pending:</span>
                    <span className="text-sm font-medium">{statistics.pending_payments}</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recurring Event Management */}
      <RecurringEventManagement 
        event={event} 
        onEventCreated={fetchEventDetails}
      />
    </TabsContent>

    <TabsContent value="attendees" className="space-y-6">
      {/* Attendees List */}
      <Card>
        <CardHeader>
          <CardTitle>Attendees ({attendees.length})</CardTitle>
          <CardDescription>
            Registered participants for this event
          </CardDescription>
        </CardHeader>
        <CardContent>
          {attendees.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">No attendees registered yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Name</th>
                    <th className="text-left p-2">Email</th>
                    <th className="text-left p-2">Registration Date</th>
                    <th className="text-left p-2">Payment Status</th>
                    <th className="text-left p-2">Transaction ID</th>
                  </tr>
                </thead>
                <tbody>
                  {attendees.map((attendee, index) => (
                    <tr key={attendee.key} className={index % 2 === 0 ? "bg-gray-50" : ""}>
                      <td className="p-2">
                        <div>
                          <p className="font-medium">{attendee.display_name}</p>
                          {attendee.kind !== "rsvp" && (
                            <p className="text-xs text-gray-500">Type: {attendee.kind}</p>
                          )}
                        </div>
                      </td>
                      <td className="p-2">
                        <div>
                          <p className="text-sm">{attendee.user_email || "N/A"}</p>
                          {attendee.phone && (
                            <p className="text-xs text-gray-500">{attendee.phone}</p>
                          )}
                        </div>
                      </td>
                      <td className="p-2">
                        <p className="text-sm">
                          {formatSimpleDate(attendee.addedOn)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatSimpleTime(attendee.addedOn)}
                        </p>
                      </td>
                      <td className="p-2">
                        {getPaymentStatusBadge(attendee.computed_payment_status || attendee.payment_status)}
                      </td>
                      <td className="p-2">
                        <p className="text-sm font-mono">
                          {attendee.transaction_id || "N/A"}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transactions */}
      {transactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payment Transactions ({transactions.length})</CardTitle>
            <CardDescription>
              Payment history for this event
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Transaction ID</th>
                    <th className="text-left p-2">Email</th>
                    <th className="text-left p-2">Amount</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction, index) => (
                    <tr key={transaction.transaction_id} className={index % 2 === 0 ? "bg-gray-50" : ""}>
                      <td className="p-2">
                        <p className="text-sm font-mono">{transaction.transaction_id}</p>
                      </td>
                      <td className="p-2">
                        <p className="text-sm">{transaction.user_email}</p>
                      </td>
                      <td className="p-2">
                        <p className="text-sm font-semibold">${transaction.amount.toFixed(2)}</p>
                      </td>
                      <td className="p-2">
                        <Badge variant={transaction.status === "completed" ? "default" : "outline"}>
                          {transaction.status}
                        </Badge>
                      </td>
                      <td className="p-2">
                        <p className="text-sm">
                          {formatSimpleDate(transaction.created_on)}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </TabsContent>

    <TabsContent value="history" className="space-y-6">
      <EventHistory 
        eventId={event.id}
        eventName={event.name}
        recurrenceType={event.recurring}
      />
    </TabsContent>
  </Tabs>
    </div>
  );
};

export default EventDetails;