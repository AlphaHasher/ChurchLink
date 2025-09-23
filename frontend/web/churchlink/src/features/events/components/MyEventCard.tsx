import { format } from 'date-fns';
import { 
  Calendar, 
  MapPin, 
  Users, 
  DollarSign,
  UserCheck
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
} from '@/shared/components/ui/card';
import { GroupedEvent } from '../types/myEvents';

interface MyEventCardProps {
  groupedEvent: GroupedEvent;
  onClick: () => void;
}

export function MyEventCard({ groupedEvent, onClick }: MyEventCardProps) {
  const event = groupedEvent.event;
  if (!event) return null; // Don't render if no event details

  const eventDate = new Date(event.date);
  const isUpcoming = eventDate > new Date();
  
  // Get all registrants (user + family members)
  const userRegistrant = groupedEvent.registrants.user;
  const familyRegistrants = groupedEvent.registrants.family;
  const allRegistrants = [
    ...(userRegistrant ? [userRegistrant] : []),
    ...familyRegistrants
  ];
  const totalRegistrants = allRegistrants.length;
  const hasUserRegistration = Boolean(userRegistrant);

  return (
    <Card 
      className="hover:shadow-lg transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className="font-semibold text-lg line-clamp-2">{event.name}</h3>
            
            {/* Show registrant summary */}
            <div className="flex items-center gap-1 text-sm text-blue-600 mt-1">
              <Users className="h-3 w-3" />
              <span>
                {totalRegistrants === 1 
                  ? hasUserRegistration 
                    ? 'You are registered'
                    : `${familyRegistrants[0].display_name} is registered`
                  : `${totalRegistrants} family members registered`
                }
              </span>
            </div>
          </div>
        </div>
        
        {/* Event Status Badge */}
        <div className="flex items-center gap-2 mt-2">
          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
            isUpcoming ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
          }`}>
            {isUpcoming ? 'Upcoming' : 'Past'}
          </div>
          
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">
            <UserCheck className="h-3 w-3" />
            Registered
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Ministry Tags - Moved to top for uniformity */}
        {event.ministry && event.ministry.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {event.ministry.slice(0, 3).map((ministry: string, index: number) => (
              <span 
                key={index}
                className="inline-block px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded-full font-medium"
              >
                {ministry}
              </span>
            ))}
            {event.ministry.length > 3 && (
              <span className="inline-block px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded-full font-medium">
                +{event.ministry.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Date & Time */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Calendar className="h-4 w-4" />
          <span>{format(eventDate, 'MMM dd, yyyy • h:mm a')}</span>
        </div>

        {/* Location */}
        {event.location && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MapPin className="h-4 w-4" />
            <span className="line-clamp-1">{event.location}</span>
          </div>
        )}

        {/* Capacity */}
        {event.spots > 0 && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Users className="h-4 w-4" />
            <span>{event.seats_taken || 0} registered</span>
          </div>
        )}

        {/* Price */}
        {event.price > 0 && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <DollarSign className="h-4 w-4" />
            <span>${event.price}</span>
          </div>
        )}

        {/* Description Preview */}
        {event.description && (
          <p className="text-sm text-gray-600 line-clamp-2 mt-2">
            {event.description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}