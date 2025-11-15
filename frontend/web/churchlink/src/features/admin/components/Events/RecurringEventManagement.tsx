import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Separator } from "@/shared/components/ui/separator";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { 
  CalendarPlus, 
  RefreshCw, 
  Clock, 
  Info,
  ChevronRight,
  AlertTriangle
} from "lucide-react";
import {
  calculateNextOccurrence,
  calculateFutureOccurrences,
  isEventPast,
  formatRecurrenceType,
  getNextOccurrenceDescription,
  prepareEventUpdateForNextOccurrence,
  type RecurrenceType
} from "@/helpers/RecurringEventHelper";
import api from "@/api/api";

interface RecurringEventManagementProps {
  event: {
    id: string;
    name: string;
    date: string;
    recurring: string;
    [key: string]: any;
  };
  onEventCreated?: () => void;
}

export const RecurringEventManagement: React.FC<RecurringEventManagementProps> = ({
  event,
  onEventCreated
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAutoCreate, setShowAutoCreate] = useState(false);

  // Don't render if not a recurring event
  if (!event.recurring || event.recurring === "never") {
    return null;
  }

  const recurrence = event.recurring as RecurrenceType;
  const isPastEvent = isEventPast(event.date);
  const nextOccurrence = calculateNextOccurrence(event.date, recurrence);
  const futureOccurrences = calculateFutureOccurrences(event.date, recurrence, 3);

  // Auto-show update suggestion when event has passed
  React.useEffect(() => {
    if (isPastEvent && nextOccurrence) {
      setShowAutoCreate(true);
    }
  }, [isPastEvent, nextOccurrence]);

  const handleCreateNextEvent = async () => {
    if (!nextOccurrence) return;

    setIsCreating(true);
    setError(null);
    setSuccess(null);

    try {
      // First, fetch the complete event data with all required fields
      console.log('🔄 Fetching complete event data for:', event.id);
      const eventResponse = await api.get(`/v1/events/${event.id}`);
      const completeEvent = eventResponse.data;
      
      console.log('🔄 Complete event data:', completeEvent);
      
      // Now prepare the update data with the complete event object
      const updateData = prepareEventUpdateForNextOccurrence(completeEvent, nextOccurrence);
      
      console.log('🔄 Updating event with data:', updateData);
      console.log('🔄 Event ID:', event.id);
      console.log('🔄 API endpoint:', `/v1/events/${event.id}`);
      
      const response = await api.put(`/v1/events/${event.id}`, updateData);
      
      if (response.status === 200) {
        setSuccess(`Event updated to next ${formatRecurrenceType(recurrence).toLowerCase()} occurrence!`);
        setShowAutoCreate(false); // Hide the auto-create alert
        onEventCreated?.(); // Refresh the event details
      }
    } catch (err: any) {
      console.error("❌ Failed to create next event:", err);
      
      // Log detailed error information for debugging
      if (err.response) {
        console.error('❌ Response status:', err.response.status);
        console.error('❌ Response data:', err.response.data);
        console.error('❌ Response headers:', err.response.headers);
        
        // Show specific validation errors if available
        if (err.response.data && err.response.data.detail) {
          if (Array.isArray(err.response.data.detail)) {
            const validationErrors = err.response.data.detail.map((error: any) => {
              const location = error.loc ? error.loc.join('.') : 'unknown field';
              return `${location}: ${error.msg} (input: ${JSON.stringify(error.input)})`;
            }).join('\n');
            console.error('❌ Validation errors:', validationErrors);
            setError(`Validation errors:\n${validationErrors}`);
          } else {
            console.error('❌ Error detail:', err.response.data.detail);
            setError(err.response.data.detail);
          }
        } else {
          setError("Failed to create next event - unknown error");
        }
      } else {
        console.error('❌ Network or other error:', err.message);
        setError(err.message || "Failed to create next event");
      }
    } finally {
      setIsCreating(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatShortDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center">
          <RefreshCw className="h-5 w-5 mr-2" />
          Recurring Event Management
        </CardTitle>
        <CardDescription>
          This is a {formatRecurrenceType(recurrence).toLowerCase()} recurring event
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Event Status */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Current Event</p>
            <p className="text-sm">{new Date(event.date).toLocaleDateString()}</p>
          </div>
          <Badge variant={isPastEvent ? "secondary" : "default"}>
            {isPastEvent ? "Past Event" : "Upcoming"}
          </Badge>
        </div>

        {/* Auto-Update Alert for Past Events */}
        {isPastEvent && showAutoCreate && nextOccurrence && (
          <Alert className="border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-700">
              <div className="space-y-2">
                <p className="font-medium">This recurring event has ended!</p>
                <p className="text-sm">
                  Update this event to the next {formatRecurrenceType(recurrence).toLowerCase()} occurrence on{" "}
                  <span className="font-medium">{formatDate(nextOccurrence)}</span>
                </p>
                <p className="text-xs text-orange-600 mt-1">
                  📋 All previous attendees and revenue will be preserved as history
                </p>
                <div className="flex gap-2 mt-3">
                  <Button 
                    size="sm"
                    onClick={handleCreateNextEvent}
                    disabled={isCreating}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    {isCreating ? (
                      <>
                        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <CalendarPlus className="h-3 w-3 mr-1" />
                        Update to Next Date
                      </>
                    )}
                  </Button>
                  <Button 
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAutoCreate(false)}
                    className="text-orange-600 border-orange-300 hover:bg-orange-50"
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Separator />

        {/* Next Occurrence */}
        {nextOccurrence && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Next Occurrence</p>
                <p className="text-sm font-medium">{formatDate(nextOccurrence)}</p>
                <p className="text-xs text-gray-400 flex items-center mt-1">
                  <Clock className="h-3 w-3 mr-1" />
                  {getNextOccurrenceDescription(event.date, recurrence)}
                </p>
              </div>
              <Button 
                onClick={handleCreateNextEvent}
                disabled={isCreating}
                className="shrink-0"
              >
                {isCreating ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <CalendarPlus className="h-4 w-4 mr-2" />
                    Update to Next Date
                  </>
                )}
              </Button>
            </div>

            {/* Success/Error Messages */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert>
                <AlertDescription className="text-green-600">{success}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Future Occurrences Preview */}
        {futureOccurrences.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="text-sm font-medium text-gray-500 mb-2">
                Upcoming Occurrences Preview
              </p>
              <div className="space-y-2">
                {futureOccurrences.slice(0, 3).map((date, index) => (
                  <div key={index} className="flex items-center text-sm text-gray-600">
                    <ChevronRight className="h-3 w-3 mr-2" />
                    {formatShortDate(date)}
                    {index === 0 && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        Next
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Info Section */}
        <div className="bg-blue-50 p-3 rounded-lg">
          <div className="flex items-start">
            <Info className="h-4 w-4 text-blue-500 mr-2 mt-0.5 shrink-0" />
            <div className="text-sm text-blue-700">
              <p className="font-medium mb-1">How Recurring Event Updates Work:</p>
              <ul className="text-xs space-y-1 list-disc list-inside">
                <li>Updates the same event to the next occurrence date</li>
                <li>Previous attendees and revenue become historical data</li>
                <li>Event starts as draft for review before publishing</li>
                <li>Preserves event identity and accumulated history</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};