# MY_EVENTS_PLAN.md
# Comprehensive Implementation Plan for "My Events" Viewer

## Executive Summary

This document outlines the implementation plan for creating "My Events" viewer functionality for both web and mobile platforms. Through comprehensive analysis of the existing ChurchLink system, **I discovered that the backend infrastructure is already 95% complete**. The implementation primarily requires frontend development to create user-friendly interfaces that leverage existing APIs.

## System Architecture Analysis

### Current Infrastructure ✅

**Backend (Complete)**
- **Route**: `GET /api/v1/event-people/my-events` 
- **Handler**: `UserHandler.list_my_events(uid, expand=True/False, person_id=None)`
- **Authentication**: Firebase ID token validation via `AuthProtectedRouter`
- **Data Model**: User documents contain `my_events` array with event references
- **Family Support**: Family member events via `person_id` parameter
- **RSVP Integration**: Automatic sync between event attendance and user records

**Key Existing Components:**
1. **Event-User Relationships**: Stored in user documents as `my_events` array
2. **Event Data Access**: Full event details via MongoDB aggregation pipeline  
3. **Authentication Flow**: Firebase JWT → User validation → Request processing
4. **Family Member Support**: Complete infrastructure for family event management
5. **RSVP System**: Bidirectional sync between events and user records

### Implementation Requirements

**What's Missing:**
- Web frontend "My Events" page
- Mobile frontend "My Events" page  
- User interface components for event management
- Navigation integration

**What's Already Built:**
- Complete backend API infrastructure
- Authentication and authorization
- Data models and relationships
- Family member event support
- Event RSVP functionality

## Implementation Strategy

### Phase 1: Backend API Optimization (Optional Enhancements)

The existing `GET /api/v1/event-people/my-events` endpoint is fully functional but could benefit from these optional enhancements:

#### 1.1 Enhanced Response Format
```python
# Current response structure (functional)
{
  "success": true,
  "events": [...]
}

# Suggested enhanced response (optional improvement)
{
  "success": true,
  "events": [...],
  "summary": {
    "total_events": 5,
    "upcoming_events": 3,
    "past_events": 2,
    "family_events": 2
  },
  "family_members": [...] // if include_family=true
}
```

#### 1.2 Query Parameters (Optional)
```python
@event_person_registration_router.get("/my-events", response_model=dict)
async def get_my_events(
    request: Request, 
    include_family: bool = True,
    include_past: bool = True,      # New: filter past events
    sort_by: str = "date",          # New: sort options
    sort_order: str = "asc"         # New: sort direction
):
```

#### 1.3 Pagination Support (Optional for Large Event Lists)
```python
async def get_my_events(
    request: Request,
    skip: int = 0,
    limit: int = 50,
    include_family: bool = True
):
```

### Phase 2: Web Frontend Implementation

#### 2.1 React Page Component
**Location**: `/frontend/web/churchlink/src/features/events/pages/MyEventsPage.tsx`

```typescript
// PSEUDO CODE: Main page component implementation guide
/* 
STEP 1: Interface Definitions (copy existing Event pattern from EventViewer.tsx)
- Create MyEvent interface matching API response structure from /api/v1/event-people/my-events
- Add person_id and display_name for family member support
- Include reason field to distinguish RSVP vs Watch events
*/

interface MyEvent {
  id: string;
  name: string;
  description: string;
  date: string;
  location: string;
  price: number;
  ministry: string[];
  person_id?: string;      // For family member events
  display_name?: string;   // For family member events
  reason: "rsvp" | "watch";
  // PSEUDO: Add other fields from existing Event model as needed
}

interface MyEventsResponse {
  success: boolean;
  events: MyEvent[];
  summary?: {
    total_events: number;
    upcoming_events: number;
    past_events: number;
    family_events: number;
  };
}

/* 
STEP 2: Main Component Structure (follow EventViewer.tsx pattern)
- Use useState for events, loading, filters
- Use useEffect for initial data load
- Follow existing error handling patterns
- Use motion components for animations (framer-motion already installed)
*/

// PSEUDO CODE: Component state management
function MyEventsPage() {
  // STATE: Follow EventViewer.tsx pattern
  const [events, setEvents] = useState<MyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // STATE: Filter controls
  const [showUpcoming, setShowUpcoming] = useState(true);
  const [showPast, setShowPast] = useState(true);
  const [showFamily, setShowFamily] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // EFFECT: Load events on component mount
  useEffect(() => {
    // PSEUDO: Call API using existing api.ts pattern
    loadMyEvents();
  }, []);

  // FUNCTION: Data loading (async/await pattern like EventViewer)
  const loadMyEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      // PSEUDO: Use api.get('/v1/event-people/my-events') 
      // Follow existing error handling from EventViewer.tsx
    } catch (err) {
      // PSEUDO: Set error state
    } finally {
      setLoading(false);
    }
  };

  // FUNCTION: Filter events based on state
  const filteredEvents = useMemo(() => {
    // PSEUDO: Filter logic for upcoming/past/family/search
    return events.filter(event => {
      // Date filtering
      // Family member filtering 
      // Search term filtering
    });
  }, [events, showUpcoming, showPast, showFamily, searchTerm]);

  // RENDER: Main component JSX
  return (
    <div className="container mx-auto px-4 py-6">
      {/* PSEUDO: Header section */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">My Events</h1>
        <p className="text-gray-600">Manage your event registrations</p>
      </div>

      {/* PSEUDO: Filter controls */}
      <div className="mb-6">
        {/* Toggle buttons for upcoming/past/family */}
        {/* Search input */}
      </div>

      {/* PSEUDO: Content area */}
      {loading && <div>Loading...</div>}
      {error && <div className="text-red-500">Error: {error}</div>}
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* PSEUDO: Map through filteredEvents */}
          {/* Use motion.div like EventViewer.tsx */}
          {/* Render MyEventCard components */}
        </div>
      )}
    </div>
  );
}
```

**Key Features:**
- Event list with cards/table view
- Filter: Upcoming vs Past events
- Filter: Personal vs Family member events
- Search within user's events
- Event details modal/drawer
- Quick actions: View details, Cancel RSVP
- Responsive design (mobile-friendly)

#### 2.2 Component Structure
```
/src/features/events/
├── pages/
│   ├── MyEventsPage.tsx          # Main page component
│   └── EventViewer.tsx           # Existing (for reference)
├── components/
│   ├── MyEventCard.tsx           # Event card component
│   ├── MyEventsList.tsx          # Events list container
│   ├── EventFilters.tsx          # Filter controls
│   └── EventDetailsModal.tsx     # Event details popup
├── hooks/
│   ├── useMyEvents.tsx           # API hook
│   └── useEventActions.tsx       # RSVP actions
└── types/
    └── myEvents.ts               # TypeScript interfaces
```

#### 2.3 API Integration
```typescript
// PSEUDO CODE: API service layer implementation guide
// /src/api/myEventsApi.ts

/* 
STEP 1: Create dedicated API service (follow existing api.ts patterns)
- Import existing api instance from @/api/api
- Use same authentication pattern (Bearer token automatically added)
- Follow async/await error handling patterns from EventViewer.tsx
*/

import api from '@/api/api';

export const myEventsApi = {
  // FUNCTION: Get user's events
  getMyEvents: async (params?: {
    include_family?: boolean;
    include_past?: boolean;
  }): Promise<MyEventsResponse> => {
    /* PSEUDO CODE IMPLEMENTATION:
    1. Use api.get() with existing authentication
    2. Pass params as query parameters  
    3. Handle response.data structure
    4. Return typed response
    5. Let errors bubble up to component
    */
    const response = await api.get('/v1/event-people/my-events', { params });
    return response.data;
  },

  // FUNCTION: Cancel RSVP (personal or family member)
  cancelRSVP: async (eventId: string, personId?: string) => {
    /* PSEUDO CODE IMPLEMENTATION:
    1. Determine endpoint based on personId presence
    2. Use api.delete() with existing authentication
    3. Handle success/error responses
    4. Return boolean or throw error
    */
    const endpoint = personId 
      ? `/v1/event-people/unregister/${eventId}/family-member/${personId}`
      : `/v1/event-people/unregister/${eventId}`;
    
    const response = await api.delete(endpoint);
    return response.data;
  },

  // FUNCTION: Get event details (reuse existing events API)
  getEventDetails: async (eventId: string) => {
    /* PSEUDO CODE IMPLEMENTATION:
    1. Use existing public event endpoint
    2. No authentication required for public event details
    3. Can be used for event detail modal
    */
    const response = await api.get(`/v1/events/${eventId}`);
    return response.data;
  }
};

/* 
STEP 2: Create React Hook for data management
/src/features/events/hooks/useMyEvents.tsx
- Follow React Query or SWR pattern if available
- Otherwise use custom hook with useState/useEffect
- Handle loading, error, and refetch states
- Cache data appropriately
*/

export const useMyEvents = (params?: {
  include_family?: boolean;
  include_past?: boolean;
}) => {
  const [data, setData] = useState<MyEventsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await myEventsApi.getMyEvents(params);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return {
    events: data?.events || [],
    summary: data?.summary,
    loading,
    error,
    refetch: fetchEvents
  };
};
```

#### 2.4 Router Integration
```typescript
// PSEUDO CODE: Router setup implementation guide
// /src/router/AppRouter.tsx

/* 
STEP 1: Import new page component
- Add import for MyEventsPage
- Ensure path follows existing routing patterns
- Check if authentication wrapper is needed
*/

import MyEventsPage from '@/features/events/pages/MyEventsPage';

/* 
STEP 2: Add route configuration
- Follow existing route structure pattern
- Add requiresAuth meta if using auth guards
- Consider page title and breadcrumb settings
*/

// PSEUDO: Add to routes array
{
  path: '/my-events',
  element: <MyEventsPage />,
  meta: { 
    requiresAuth: true,  // IMPORTANT: Requires authentication
    title: 'My Events',  // For page title/breadcrumbs
    showInNav: true      // If using auto-generated navigation
  }
}

/* 
STEP 3: Verify authentication guard
- Ensure auth protection is properly configured
- Test redirect behavior for unauthenticated users
- Verify Firebase token is passed to API calls
*/
```

#### 2.5 Navigation Integration
```typescript
// PSEUDO CODE: Navigation menu implementation guide

/* 
STEP 1: Identify navigation component location
- Look for main navigation menu component
- Could be in Header, Sidebar, or Navigation component
- Follow existing menu item patterns
*/

// PSEUDO: Add to navigation menu items array
{
  title: 'My Events',
  path: '/my-events',
  icon: <CalendarIcon />,       // Use existing icon library
  requiresAuth: true,           // Show only when authenticated
  order: 4                      // Position in menu
}

/* 
STEP 2: Add navigation logic
- Use existing routing/navigation patterns
- Ensure proper highlighting for active page
- Handle authentication state changes
*/

// PSEUDO: Navigation component update
const NavigationItem = ({ item }: { item: NavItem }) => {
  const { isAuthenticated } = useAuth(); // Use existing auth hook
  
  // Hide auth-required items when not logged in
  if (item.requiresAuth && !isAuthenticated) {
    return null;
  }
  
  return (
    <Link 
      to={item.path}
      className={cn(
        "nav-item", 
        location.pathname === item.path && "active"
      )}
    >
      {item.icon}
      {item.title}
    </Link>
  );
};

/* 
STEP 3: Mobile navigation support
- Ensure responsive navigation includes new item
- Test on mobile breakpoints
- Consider drawer/sidebar behavior
*/
```

### Phase 3: Mobile Frontend Implementation (Flutter)

#### 3.1 Page Component
**Location**: `/frontend/app/lib/pages/my_events_page.dart`

```dart
// PSEUDO CODE: Flutter page implementation guide

/* 
STEP 1: Import required dependencies (follow eventspage.dart pattern)
- Material design components
- Existing API client
- Event models and services
- Existing widget patterns
*/

import 'package:flutter/material.dart';
import '../helpers/api_client.dart';
import '../models/my_event.dart';  // Create this model
import '../services/my_events_service.dart';  // Create this service
import '../widgets/my_event_card.dart';  // Create this widget

/* 
STEP 2: StatefulWidget class (follow EventsPage pattern)
- Use same naming conventions
- Follow existing state management patterns
- Include loading, error, and data states
*/

class MyEventsPage extends StatefulWidget {
  const MyEventsPage({super.key});

  @override
  State<MyEventsPage> createState() => _MyEventsPageState();
}

class _MyEventsPageState extends State<MyEventsPage> {
  // STATE VARIABLES: Follow eventspage.dart pattern
  List<MyEvent> _myEvents = [];
  bool _isLoading = true;
  String? _error;
  
  // FILTER STATE: Similar to existing event filters
  bool _includePast = true;
  bool _includeFamily = true;
  String _searchQuery = '';
  
  // CONTROLLERS: For filter inputs
  late TextEditingController _searchController;
  
  /* 
  STEP 3: Lifecycle methods (follow eventspage.dart pattern)
  - Initialize controllers in initState
  - Load data on mount
  - Dispose controllers properly
  */
  
  @override
  void initState() {
    super.initState();
    _searchController = TextEditingController();
    _loadMyEvents();
  }
  
  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }
  
  /* 
  STEP 4: Data loading method (async pattern)
  - Use try-catch error handling
  - Update loading state appropriately
  - Handle API errors gracefully
  */
  
  Future<void> _loadMyEvents() async {
    try {
      setState(() {
        _isLoading = true;
        _error = null;
      });
      
      // PSEUDO: Call MyEventsService
      final events = await MyEventsService.getMyEvents(
        includeFamily: _includeFamily,
        includePast: _includePast,
      );
      
      setState(() {
        _myEvents = events;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }
  
  /* 
  STEP 5: Filter methods
  - Filter events based on state
  - Support search functionality
  - Handle date comparisons for past/upcoming
  */
  
  List<MyEvent> get _filteredEvents {
    return _myEvents.where((event) {
      // PSEUDO: Date filtering logic
      final now = DateTime.now();
      final eventDate = event.date;
      final isUpcoming = eventDate.isAfter(now);
      
      if (!_includePast && !isUpcoming) return false;
      if (_includePast == false && !isUpcoming) return false;
      
      // PSEUDO: Family filtering logic
      if (!_includeFamily && event.personId != null) return false;
      
      // PSEUDO: Search filtering logic
      if (_searchQuery.isNotEmpty) {
        return event.name.toLowerCase().contains(_searchQuery.toLowerCase()) ||
               event.description.toLowerCase().contains(_searchQuery.toLowerCase());
      }
      
      return true;
    }).toList();
  }
  
  /* 
  STEP 6: UI Build method (follow Material Design patterns)
  - Use Scaffold structure
  - AppBar with title and actions
  - Body with filters and event list
  - Pull-to-refresh functionality
  */
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Events'),
        // PSEUDO: Add filter/search actions
      ),
      body: Column(
        children: [
          // PSEUDO: Filter controls section
          _buildFilterControls(),
          
          // PSEUDO: Main content area
          Expanded(
            child: _isLoading 
              ? const Center(child: CircularProgressIndicator())
              : _error != null
                ? _buildErrorWidget()
                : _buildEventsList(),
          ),
        ],
      ),
    );
  }
  
  /* 
  STEP 7: Helper widget methods
  - Build filter controls
  - Build events list
  - Build error states
  - Follow existing widget patterns
  */
  
  Widget _buildFilterControls() {
    // PSEUDO: Filter toggles and search
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        children: [
          // Search TextField
          TextField(
            controller: _searchController,
            decoration: const InputDecoration(
              hintText: 'Search events...',
              prefixIcon: Icon(Icons.search),
            ),
            onChanged: (value) {
              setState(() {
                _searchQuery = value;
              });
            },
          ),
          const SizedBox(height: 12),
          // Filter toggles
          Row(
            children: [
              FilterChip(
                label: const Text('Include Past'),
                selected: _includePast,
                onSelected: (selected) {
                  setState(() {
                    _includePast = selected;
                  });
                  _loadMyEvents();
                },
              ),
              const SizedBox(width: 8),
              FilterChip(
                label: const Text('Include Family'),
                selected: _includeFamily,
                onSelected: (selected) {
                  setState(() {
                    _includeFamily = selected;
                  });
                  _loadMyEvents();
                },
              ),
            ],
          ),
        ],
      ),
    );
  }
  
  Widget _buildEventsList() {
    final events = _filteredEvents;
    
    if (events.isEmpty) {
      return const Center(
        child: Text('No events found'),
      );
    }
    
    return RefreshIndicator(
      onRefresh: _loadMyEvents,
      child: ListView.builder(
        itemCount: events.length,
        itemBuilder: (context, index) {
          final event = events[index];
          return MyEventCard(
            event: event,
            onTap: () => _showEventDetails(event),
            onCancelRSVP: () => _cancelRSVP(event),
          );
        },
      ),
    );
  }
  
  Widget _buildErrorWidget() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.error, size: 64, color: Colors.red),
          const SizedBox(height: 16),
          Text('Error: $_error'),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: _loadMyEvents,
            child: const Text('Retry'),
          ),
        ],
      ),
    );
  }
  
  /* 
  STEP 8: Action methods
  - Handle event detail navigation
  - Handle RSVP cancellation
  - Show confirmation dialogs
  */
  
  void _showEventDetails(MyEvent event) {
    // PSEUDO: Navigate to event detail page or show modal
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => EventShowcase(eventId: event.id),
      ),
    );
  }
  
  Future<void> _cancelRSVP(MyEvent event) async {
    // PSEUDO: Show confirmation dialog
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cancel RSVP'),
        content: Text('Cancel registration for "${event.name}"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Keep'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Cancel RSVP'),
          ),
        ],
      ),
    );
    
    if (confirmed == true) {
      try {
        await MyEventsService.cancelRSVP(
          event.id, 
          personId: event.personId,
        );
        _loadMyEvents(); // Refresh list
        
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('RSVP cancelled')),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Error: $e')),
          );
        }
      }
    }
  }
}
```

#### 3.2 Data Models
**Location**: `/frontend/app/lib/models/my_event.dart`

```dart
// PSEUDO CODE: Data model implementation guide

/* 
STEP 1: Create MyEvent model (follow existing event.dart patterns)
- Use same field naming conventions
- Include JSON serialization methods
- Add family member specific fields
- Handle date parsing properly
*/

class MyEvent {
  final String id;
  final String name;
  final String description;
  final DateTime date;
  final String location;
  final double price;
  final List<String> ministry;
  final String? personId;        // For family member events
  final String? displayName;     // For family member events
  final String reason;           // "rsvp" | "watch"
  
  // PSEUDO: Additional fields from event model
  final String? imageUrl;
  final int minAge;
  final int maxAge;
  final String gender;
  final bool published;
  
  MyEvent({
    required this.id,
    required this.name,
    required this.description,
    required this.date,
    required this.location,
    required this.price,
    required this.ministry,
    this.personId,
    this.displayName,
    required this.reason,
    this.imageUrl,
    required this.minAge,
    required this.maxAge,
    required this.gender,
    required this.published,
  });
  
  /* 
  STEP 2: JSON Factory Constructor (follow existing patterns)
  - Handle nested event object from API response
  - Parse date strings to DateTime objects
  - Handle null/missing fields gracefully
  - Map API field names to Dart conventions
  */
  
  factory MyEvent.fromJson(Map<String, dynamic> json) {
    // PSEUDO: Handle nested structure from API
    // The API returns: { event: {...}, person_id: ..., reason: ... }
    final eventData = json['event'] ?? json; // Handle both structures
    
    return MyEvent(
      // PSEUDO: Map from API response structure
      id: eventData['id'] ?? eventData['_id']?.toString() ?? '',
      name: eventData['name'] ?? '',
      description: eventData['description'] ?? '',
      
      // PSEUDO: Date parsing (handle multiple formats)
      date: DateTime.parse(eventData['date'] ?? DateTime.now().toIso8601String()),
      
      location: eventData['location'] ?? '',
      price: (eventData['price'] ?? 0).toDouble(),
      
      // PSEUDO: Handle array fields
      ministry: List<String>.from(eventData['ministry'] ?? []),
      
      // PSEUDO: Family member fields from outer object
      personId: json['person_id']?.toString(),
      displayName: json['display_name'],
      reason: json['reason'] ?? 'rsvp',
      
      // PSEUDO: Optional fields with defaults
      imageUrl: eventData['image_url'],
      minAge: eventData['min_age'] ?? 0,
      maxAge: eventData['max_age'] ?? 100,
      gender: eventData['gender'] ?? 'all',
      published: eventData['published'] ?? true,
    );
  }
  
  /* 
  STEP 3: Convenience methods
  - Add helper methods for common operations
  - Date formatting and comparison
  - Family member identification
  */
  
  // PSEUDO: Check if event is upcoming
  bool get isUpcoming => date.isAfter(DateTime.now());
  
  // PSEUDO: Check if this is a family member event
  bool get isFamilyEvent => personId != null;
  
  // PSEUDO: Get display name for UI
  String get eventDisplayName => isFamilyEvent 
      ? '$name (for $displayName)' 
      : name;
  
  // PSEUDO: Format date for display
  String get formattedDate {
    // Use existing date formatting patterns from the app
    return DateFormat('MMM dd, yyyy').format(date);
  }
  
  // PSEUDO: Format time for display  
  String get formattedTime {
    return DateFormat('h:mm a').format(date);
  }
  
  /* 
  STEP 4: toJson method (if needed for caching)
  - Convert back to JSON for local storage
  - Handle DateTime serialization
  */
  
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'date': date.toIso8601String(),
      'location': location,
      'price': price,
      'ministry': ministry,
      'person_id': personId,
      'display_name': displayName,
      'reason': reason,
      'image_url': imageUrl,
      'min_age': minAge,
      'max_age': maxAge,
      'gender': gender,
      'published': published,
    };
  }
  
  /* 
  STEP 5: Equality and hashCode (for state management)
  - Override == operator
  - Override hashCode
  - Useful for widget rebuilds and caching
  */
  
  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is MyEvent && 
           other.id == id && 
           other.personId == personId &&
           other.reason == reason;
  }
  
  @override
  int get hashCode {
    return Object.hash(id, personId, reason);
  }
  
  @override
  String toString() {
    return 'MyEvent(id: $id, name: $name, isFamilyEvent: $isFamilyEvent)';
  }
}

/* 
STEP 6: Response wrapper model (optional)
- Model for API response structure
- Include summary data if backend provides it
*/

class MyEventsResponse {
  final bool success;
  final List<MyEvent> events;
  final MyEventsSummary? summary;
  
  MyEventsResponse({
    required this.success,
    required this.events,
    this.summary,
  });
  
  factory MyEventsResponse.fromJson(Map<String, dynamic> json) {
    return MyEventsResponse(
      success: json['success'] ?? false,
      events: (json['events'] as List<dynamic>?)
          ?.map((e) => MyEvent.fromJson(e))
          .toList() ?? [],
      summary: json['summary'] != null 
          ? MyEventsSummary.fromJson(json['summary'])
          : null,
    );
  }
}

class MyEventsSummary {
  final int totalEvents;
  final int upcomingEvents;
  final int pastEvents;
  final int familyEvents;
  
  MyEventsSummary({
    required this.totalEvents,
    required this.upcomingEvents,
    required this.pastEvents,
    required this.familyEvents,
  });
  
  factory MyEventsSummary.fromJson(Map<String, dynamic> json) {
    return MyEventsSummary(
      totalEvents: json['total_events'] ?? 0,
      upcomingEvents: json['upcoming_events'] ?? 0,
      pastEvents: json['past_events'] ?? 0,
      familyEvents: json['family_events'] ?? 0,
    );
  }
}
```

#### 3.3 Service Layer
**Location**: `/frontend/app/lib/services/my_events_service.dart`

```dart
// PSEUDO CODE: Service layer implementation guide

/* 
STEP 1: Import dependencies (follow existing patterns)
- Use existing ApiClient instance
- Import models and helpers
- Follow error handling patterns from existing services
*/

import '../helpers/api_client.dart';
import '../models/my_event.dart';
import '../helpers/backend_helper.dart';

class MyEventsService {
  // PSEUDO: Use existing API client instance pattern
  static final ApiClient _apiClient = BackendHelper.getApiClient();
  static const String _baseUrl = '/v1/event-people';
  
  /* 
  STEP 2: Get user events method (follow existing service patterns)
  - Use existing ApiClient.get method
  - Handle query parameters properly
  - Parse response to models
  - Handle errors gracefully
  */
  
  static Future<List<MyEvent>> getMyEvents({
    bool includeFamily = true,
    bool includePast = true,
  }) async {
    try {
      // PSEUDO: API call using existing pattern
      final response = await _apiClient.dio.get(
        '$_baseUrl/my-events',
        queryParameters: {
          'include_family': includeFamily,
          'include_past': includePast,
        },
      );
      
      // PSEUDO: Handle response structure
      if (response.data['success'] == true) {
        final eventsData = response.data['events'] as List<dynamic>;
        return eventsData
            .map((eventJson) => MyEvent.fromJson(eventJson))
            .toList();
      } else {
        throw Exception('API returned success: false');
      }
    } catch (e) {
      // PSEUDO: Error handling pattern
      if (e is DioException) {
        // Handle network/HTTP errors
        throw Exception('Network error: ${e.message}');
      } else {
        // Handle parsing/other errors
        throw Exception('Failed to load events: $e');
      }
    }
  }
  
  /* 
  STEP 3: Get events with summary (optional enhanced version)
  - Return both events and summary data
  - Use response wrapper model
  */
  
  static Future<MyEventsResponse> getMyEventsWithSummary({
    bool includeFamily = true,
    bool includePast = true,
  }) async {
    try {
      final response = await _apiClient.dio.get(
        '$_baseUrl/my-events',
        queryParameters: {
          'include_family': includeFamily,
          'include_past': includePast,
        },
      );
      
      return MyEventsResponse.fromJson(response.data);
    } catch (e) {
      // PSEUDO: Same error handling as above
      throw Exception('Failed to load events with summary: $e');
    }
  }
  
  /* 
  STEP 4: Cancel RSVP method
  - Handle both personal and family member cancellations
  - Use existing DELETE pattern
  - Return success/failure status
  */
  
  static Future<bool> cancelRSVP(String eventId, {String? personId}) async {
    try {
      // PSEUDO: Determine endpoint based on personId
      final endpoint = personId != null
          ? '$_baseUrl/unregister/$eventId/family-member/$personId'
          : '$_baseUrl/unregister/$eventId';
      
      // PSEUDO: API call using existing pattern
      final response = await _apiClient.dio.delete(endpoint);
      
      // PSEUDO: Check response success
      return response.data['success'] == true;
    } catch (e) {
      // PSEUDO: Error handling
      if (e is DioException) {
        // Handle specific HTTP errors
        if (e.response?.statusCode == 404) {
          throw Exception('Event or registration not found');
        } else if (e.response?.statusCode == 403) {
          throw Exception('Not authorized to cancel this registration');
        }
        throw Exception('Network error: ${e.message}');
      } else {
        throw Exception('Failed to cancel RSVP: $e');
      }
    }
  }
  
  /* 
  STEP 5: Get specific family member events (optional)
  - Filter events for specific family member
  - Useful for family management features
  */
  
  static Future<List<MyEvent>> getFamilyMemberEvents(String familyMemberId) async {
    try {
      final response = await _apiClient.dio.get(
        '$_baseUrl/family-member/$familyMemberId/events',
      );
      
      if (response.data['success'] == true) {
        final eventsData = response.data['events'] as List<dynamic>;
        return eventsData
            .map((eventJson) => MyEvent.fromJson(eventJson))
            .toList();
      } else {
        throw Exception('API returned success: false');
      }
    } catch (e) {
      throw Exception('Failed to load family member events: $e');
    }
  }
  
  /* 
  STEP 6: Register for event method (optional - for future use)
  - Add RSVP functionality from My Events page
  - Handle both personal and family registrations
  */
  
  static Future<bool> registerForEvent(String eventId, {String? personId}) async {
    try {
      final endpoint = personId != null
          ? '$_baseUrl/register/$eventId/family-member/$personId'
          : '$_baseUrl/register/$eventId';
      
      final response = await _apiClient.dio.post(endpoint);
      return response.data['success'] == true;
    } catch (e) {
      // PSEUDO: Handle registration errors
      if (e is DioException) {
        if (e.response?.statusCode == 400) {
          throw Exception('Event full or already registered');
        }
        throw Exception('Network error: ${e.message}');
      } else {
        throw Exception('Failed to register for event: $e');
      }
    }
  }
  
  /* 
  STEP 7: Refresh/sync method (optional)
  - Force refresh of user events
  - Clear any local cache
  - Useful for pull-to-refresh functionality
  */
  
  static Future<List<MyEvent>> refreshMyEvents({
    bool includeFamily = true,
    bool includePast = true,
  }) async {
    // PSEUDO: Same as getMyEvents but with cache busting
    // Could add timestamp or force parameter
    return getMyEvents(
      includeFamily: includeFamily,
      includePast: includePast,
    );
  }
}

/* 
STEP 8: Error handling helper (optional)
- Create consistent error handling
- Map API errors to user-friendly messages
*/

class MyEventsServiceException implements Exception {
  final String message;
  final String? code;
  
  const MyEventsServiceException(this.message, [this.code]);
  
  @override
  String toString() => 'MyEventsServiceException: $message';
  
  static MyEventsServiceException fromDioError(DioException error) {
    switch (error.response?.statusCode) {
      case 401:
        return const MyEventsServiceException(
          'Authentication required. Please log in again.',
          'AUTH_REQUIRED'
        );
      case 403:
        return const MyEventsServiceException(
          'Not authorized to access this resource.',
          'FORBIDDEN'
        );
      case 404:
        return const MyEventsServiceException(
          'Requested resource not found.',
          'NOT_FOUND'
        );
      case 500:
        return const MyEventsServiceException(
          'Server error. Please try again later.',
          'SERVER_ERROR'
        );
      default:
        return MyEventsServiceException(
          'Network error: ${error.message}',
          'NETWORK_ERROR'
        );
    }
  }
}
```

#### 3.4 UI Components
```dart
// PSEUDO CODE: Widget components implementation guide
// /frontend/app/lib/widgets/my_event_card.dart

/* 
STEP 1: Import dependencies (follow existing widget patterns)
- Material design components
- Existing card patterns from enhanced_event_card.dart
- Date formatting utilities
- Navigation helpers
*/

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/my_event.dart';

/* 
STEP 2: MyEventCard widget (follow EnhancedEventCard patterns)
- Use Card widget for consistent styling
- Include event image, title, date, location
- Add family member indicator
- Include action buttons/menu
*/

class MyEventCard extends StatelessWidget {
  final MyEvent event;
  final VoidCallback? onTap;
  final VoidCallback? onCancelRSVP;
  final VoidCallback? onViewDetails;
  
  const MyEventCard({
    super.key,
    required this.event,
    this.onTap,
    this.onCancelRSVP,
    this.onViewDetails,
  });
  
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    
    return Card(
      elevation: 2,
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // PSEUDO: Header row with title and menu
              Row(
                children: [
                  Expanded(
                    child: Text(
                      event.name,
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  _buildActionMenu(context),
                ],
              ),
              
              const SizedBox(height: 8),
              
              // PSEUDO: Event details section
              _buildEventDetails(theme),
              
              const SizedBox(height: 12),
              
              // PSEUDO: Status indicators and badges
              _buildStatusRow(theme),
            ],
          ),
        ),
      ),
    );
  }
  
  /* 
  STEP 3: Event details section
  - Show date, time, location
  - Add icons for visual clarity
  - Handle long text with ellipsis
  */
  
  Widget _buildEventDetails(ThemeData theme) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Date and time
        Row(
          children: [
            Icon(
              Icons.schedule,
              size: 16,
              color: theme.colorScheme.secondary,
            ),
            const SizedBox(width: 8),
            Text(
              '${event.formattedDate} • ${event.formattedTime}',
              style: theme.textTheme.bodyMedium,
            ),
          ],
        ),
        const SizedBox(height: 4),
        
        // Location
        Row(
          children: [
            Icon(
              Icons.location_on,
              size: 16,
              color: theme.colorScheme.secondary,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                event.location,
                style: theme.textTheme.bodyMedium,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        
        // Ministry (if available)
        if (event.ministry.isNotEmpty) ...[
          const SizedBox(height: 4),
          Row(
            children: [
              Icon(
                Icons.group,
                size: 16,
                color: theme.colorScheme.secondary,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  event.ministry.join(', '),
                  style: theme.textTheme.bodySmall,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ],
        
        // Price (if not free)
        if (event.price > 0) ...[
          const SizedBox(height: 4),
          Row(
            children: [
              Icon(
                Icons.attach_money,
                size: 16,
                color: theme.colorScheme.secondary,
              ),
              const SizedBox(width: 8),
              Text(
                '\$${event.price.toStringAsFixed(2)}',
                style: theme.textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
  
  /* 
  STEP 4: Status indicators row
  - Show upcoming/past status
  - Family member indicator
  - RSVP type badge
  */
  
  Widget _buildStatusRow(ThemeData theme) {
    return Row(
      children: [
        // Family member indicator
        if (event.isFamilyEvent) ...[
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: theme.colorScheme.primaryContainer,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.family_restroom,
                  size: 12,
                  color: theme.colorScheme.onPrimaryContainer,
                ),
                const SizedBox(width: 4),
                Text(
                  event.displayName ?? 'Family',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onPrimaryContainer,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
        ],
        
        // Event status indicator
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: event.isUpcoming 
                ? Colors.green.withOpacity(0.1)
                : Colors.grey.withOpacity(0.1),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                event.isUpcoming ? Icons.upcoming : Icons.history,
                size: 12,
                color: event.isUpcoming ? Colors.green : Colors.grey,
              ),
              const SizedBox(width: 4),
              Text(
                event.isUpcoming ? 'Upcoming' : 'Past',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: event.isUpcoming ? Colors.green : Colors.grey,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
        
        const Spacer(),
        
        // RSVP type badge
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: theme.colorScheme.secondaryContainer,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(
            event.reason.toUpperCase(),
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSecondaryContainer,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      ],
    );
  }
  
  /* 
  STEP 5: Action menu
  - PopupMenuButton with actions
  - View details, cancel RSVP options
  - Conditional menu items based on event status
  */
  
  Widget _buildActionMenu(BuildContext context) {
    return PopupMenuButton<String>(
      icon: const Icon(Icons.more_vert),
      itemBuilder: (context) => [
        const PopupMenuItem(
          value: 'details',
          child: ListTile(
            leading: Icon(Icons.info_outline),
            title: Text('View Details'),
            dense: true,
          ),
        ),
        
        // Only show cancel option for upcoming events
        if (event.isUpcoming) ...[
          const PopupMenuItem(
            value: 'cancel',
            child: ListTile(
              leading: Icon(Icons.cancel_outlined, color: Colors.red),
              title: Text('Cancel RSVP', style: TextStyle(color: Colors.red)),
              dense: true,
            ),
          ),
        ],
        
        // Future: Add calendar export option
        const PopupMenuItem(
          value: 'calendar',
          child: ListTile(
            leading: Icon(Icons.calendar_today),
            title: Text('Add to Calendar'),
            dense: true,
          ),
        ),
      ],
      onSelected: (value) {
        switch (value) {
          case 'details':
            onViewDetails?.call() ?? onTap?.call();
            break;
          case 'cancel':
            _showCancelConfirmation(context);
            break;
          case 'calendar':
            _addToCalendar(context);
            break;
        }
      },
    );
  }
  
  /* 
  STEP 6: Action methods
  - Show confirmation dialogs
  - Handle calendar export
  - Provide user feedback
  */
  
  void _showCancelConfirmation(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cancel RSVP'),
        content: Text(
          event.isFamilyEvent
              ? 'Cancel registration for "${event.name}" for ${event.displayName}?'
              : 'Cancel your registration for "${event.name}"?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Keep Registration'),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              onCancelRSVP?.call();
            },
            style: TextButton.styleFrom(
              foregroundColor: Colors.red,
            ),
            child: const Text('Cancel RSVP'),
          ),
        ],
      ),
    );
  }
  
  void _addToCalendar(BuildContext context) {
    // PSEUDO: Implement calendar export
    // Could use add_2_calendar package or platform-specific APIs
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Calendar export feature coming soon!'),
      ),
    );
  }
}

/* 
STEP 7: Loading and error state widgets
- Consistent loading indicators
- Error state handling
- Empty state widget
*/

class MyEventCardSkeleton extends StatelessWidget {
  const MyEventCardSkeleton({super.key});
  
  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // PSEUDO: Shimmer loading effect
            Container(
              height: 20,
              width: double.infinity,
              decoration: BoxDecoration(
                color: Colors.grey[300],
                borderRadius: BorderRadius.circular(4),
              ),
            ),
            const SizedBox(height: 8),
            Container(
              height: 16,
              width: 200,
              decoration: BoxDecoration(
                color: Colors.grey[300],
                borderRadius: BorderRadius.circular(4),
              ),
            ),
            const SizedBox(height: 4),
            Container(
              height: 16,
              width: 150,
              decoration: BoxDecoration(
                color: Colors.grey[300],
                borderRadius: BorderRadius.circular(4),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class EmptyMyEventsWidget extends StatelessWidget {
  final String message;
  final VoidCallback? onRefresh;
  
  const EmptyMyEventsWidget({
    super.key,
    this.message = 'No events found',
    this.onRefresh,
  });
  
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.event_busy,
            size: 64,
            color: Colors.grey[400],
          ),
          const SizedBox(height: 16),
          Text(
            message,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: Colors.grey[600],
            ),
          ),
          if (onRefresh != null) ...[
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: onRefresh,
              child: const Text('Refresh'),
            ),
          ],
        ],
      ),
    );
  }
}
```

#### 3.5 Navigation Integration
```dart
// PSEUDO CODE: Navigation integration implementation guide

/* 
STEP 1: Bottom Navigation Integration (if using bottom nav)
- Locate main navigation widget (likely in main.dart or navigation file)
- Add My Events tab to bottom navigation
- Follow existing navigation patterns
*/

// /frontend/app/lib/main.dart or navigation widget

// PSEUDO: Add to BottomNavigationBar items
BottomNavigationBarItem(
  icon: Icon(Icons.event_note),
  label: 'My Events',
),

// PSEUDO: Add to navigation page list
const MyEventsPage(),

// PSEUDO: Handle navigation in onTap
void _onItemTapped(int index) {
  setState(() {
    _selectedIndex = index;
  });
  
  // PSEUDO: Update page controller or navigation logic
  _pageController.animateToPage(
    index,
    duration: const Duration(milliseconds: 300),
    curve: Curves.ease,
  );
}

/* 
STEP 2: Drawer Navigation Integration (alternative)
- If using drawer navigation instead of bottom nav
- Add to navigation drawer menu
*/

// PSEUDO: Add to Drawer widget
ListTile(
  leading: const Icon(Icons.event_note),
  title: const Text('My Events'),
  onTap: () {
    Navigator.pop(context); // Close drawer
    Navigator.pushNamed(context, '/my-events');
  },
),

/* 
STEP 3: Route Configuration
- Add named route for My Events page
- Configure route handling
*/

// /frontend/app/lib/main.dart - MaterialApp routes
routes: {
  '/': (context) => const HomePage(),
  '/events': (context) => const EventsPage(),
  '/my-events': (context) => const MyEventsPage(),  // ADD THIS
  '/event-showcase': (context) => const EventShowcase(),
  // ... other routes
},

/* 
STEP 4: Deep Linking Support (optional)
- Handle route parameters for direct navigation
- Support for event-specific deep links
*/

// PSEUDO: Enhanced route handling
'/my-events': (context) {
  final args = ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
  return MyEventsPage(
    initialFilter: args?['filter'],
    highlightEventId: args?['eventId'],
  );
},

/* 
STEP 5: Navigation Helper Methods
- Create utility methods for consistent navigation
- Handle authentication checks
*/

class NavigationHelper {
  static void navigateToMyEvents(BuildContext context, {
    String? filter,
    String? highlightEventId,
  }) {
    // PSEUDO: Check authentication first
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      // Navigate to login or show auth dialog
      NavigationHelper.navigateToLogin(context);
      return;
    }
    
    Navigator.pushNamed(
      context,
      '/my-events',
      arguments: {
        if (filter != null) 'filter': filter,
        if (highlightEventId != null) 'eventId': highlightEventId,
      },
    );
  }
  
  static void navigateToEventDetails(BuildContext context, String eventId) {
    Navigator.pushNamed(
      context,
      '/event-showcase',
      arguments: {'eventId': eventId},
    );
  }
}

/* 
STEP 6: Update Main App Navigation Structure
- Modify main app to include My Events in primary navigation
- Ensure consistent navigation experience
*/

class MainApp extends StatefulWidget {
  @override
  State<MainApp> createState() => _MainAppState();
}

class _MainAppState extends State<MainApp> {
  int _selectedIndex = 0;
  late PageController _pageController;
  
  // PSEUDO: Updated page list including My Events
  final List<Widget> _pages = [
    const HomePage(),           // Index 0
    const EventsPage(),         // Index 1  
    const MyEventsPage(),       // Index 2 - NEW
    const ContactPage(),        // Index 3
    const DashboardPage(),      // Index 4
  ];
  
  // PSEUDO: Updated navigation items
  final List<BottomNavigationBarItem> _navItems = [
    BottomNavigationBarItem(
      icon: Icon(Icons.home),
      label: 'Home',
    ),
    BottomNavigationBarItem(
      icon: Icon(Icons.event),
      label: 'Events',
    ),
    BottomNavigationBarItem(
      icon: Icon(Icons.event_note),
      label: 'My Events',        // NEW ITEM
    ),
    BottomNavigationBarItem(
      icon: Icon(Icons.contact_page),
      label: 'Contact',
    ),
    BottomNavigationBarItem(
      icon: Icon(Icons.dashboard),
      label: 'Dashboard',
    ),
  ];
  
  @override
  void initState() {
    super.initState();
    _pageController = PageController();
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: PageView(
        controller: _pageController,
        children: _pages,
        onPageChanged: (index) {
          setState(() {
            _selectedIndex = index;
          });
        },
      ),
      bottomNavigationBar: BottomNavigationBar(
        type: BottomNavigationBarType.fixed, // Show all tabs
        currentIndex: _selectedIndex,
        items: _navItems,
        onTap: (index) {
          // PSEUDO: Handle My Events authentication check
          if (index == 2) { // My Events index
            final user = FirebaseAuth.instance.currentUser;
            if (user == null) {
              // Show authentication dialog or navigate to login
              _showAuthenticationRequired(context);
              return;
            }
          }
          
          setState(() {
            _selectedIndex = index;
          });
          _pageController.animateToPage(
            index,
            duration: const Duration(milliseconds: 300),
            curve: Curves.ease,
          );
        },
      ),
    );
  }
  
  void _showAuthenticationRequired(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Authentication Required'),
        content: const Text('Please log in to view your events.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              // Navigate to login page
              Navigator.pushNamed(context, '/login');
            },
            child: const Text('Log In'),
          ),
        ],
      ),
    );
  }
}

/* 
STEP 7: Integration Testing
- Test navigation flow from main navigation
- Verify authentication requirements
- Test deep linking functionality
*/

// PSEUDO: Test navigation integration
void testMyEventsNavigation() {
  // Test unauthenticated navigation
  // Test authenticated navigation  
  // Test deep link handling
  // Test back navigation behavior
}
```

## Technical Implementation Details

### API Response Optimization

The existing API can be enhanced to provide better data structure:

```python
async def get_my_events_enhanced(request: Request, include_family: bool = True):
    """Enhanced version with better response structure"""
    try:
        uid = request.state.uid
        
        # Get events with full details (expand=True)
        events = await UserHandler.list_my_events(uid, expand=True)
        
        if events is None:
            events = []
        
        # Categorize events
        now = datetime.now()
        upcoming_events = []
        past_events = []
        family_events = []
        personal_events = []
        
        for event in events:
            event_date = event.get('event', {}).get('date')
            if event_date:
                event_datetime = event_date if isinstance(event_date, datetime) else datetime.fromisoformat(str(event_date))
                if event_datetime > now:
                    upcoming_events.append(event)
                else:
                    past_events.append(event)
            
            if event.get('person_id'):
                family_events.append(event)
            else:
                personal_events.append(event)
        
        events_serialized = serialize_objectid(events)
        
        return {
            "success": True,
            "events": events_serialized,
            "summary": {
                "total_events": len(events),
                "upcoming_events": len(upcoming_events),
                "past_events": len(past_events),
                "family_events": len(family_events),
                "personal_events": len(personal_events)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching events: {str(e)}")
```

### User Experience Features

#### 3.1 Event Status Indicators
- **Upcoming**: Green indicator, countdown timer
- **Past**: Gray indicator, "Attended" badge
- **Family**: Family icon, member name
- **Personal**: User icon

#### 3.2 Quick Actions
- **View Details**: Navigate to event detail page
- **Cancel RSVP**: One-click cancellation with confirmation
- **Share Event**: Share event details
- **Add to Calendar**: Export to device calendar

#### 3.3 Filtering & Sorting
- **Time Filter**: All, Upcoming, Past
- **Type Filter**: Personal, Family, All
- **Ministry Filter**: Filter by ministry
- **Sort Options**: Date (asc/desc), Name (A-Z), Ministry

### Error Handling Strategy

#### 3.1 API Error Handling
```typescript
// Web Frontend
export const useMyEvents = () => {
  const [events, setEvents] = useState<MyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const loadEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await myEventsApi.getMyEvents();
      setEvents(response.events);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };
  
  return { events, loading, error, refetch: loadEvents };
};
```

#### 3.2 Offline Support (Mobile)
```dart
// Flutter implementation with caching
class MyEventsService {
  static const String _cacheKey = 'cached_my_events';
  
  Future<List<MyEvent>> getMyEvents({bool forceRefresh = false}) async {
    try {
      // Try network request
      final events = await _fetchFromNetwork();
      await _cacheEvents(events);
      return events;
    } catch (e) {
      // Fallback to cache
      return await _getCachedEvents();
    }
  }
}
```

## Testing Strategy

### Backend Testing (Optional - Already Functional)
The existing API is already tested and functional. Additional tests could include:
```python
# Optional test enhancements
async def test_my_events_with_family_members():
    # Test family member events are properly included
    pass

async def test_my_events_pagination():
    # Test pagination for users with many events
    pass
```

### Frontend Testing

#### Web Frontend Tests
```typescript
// MyEventsPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import MyEventsPage from './MyEventsPage';

describe('MyEventsPage', () => {
  test('displays loading state initially', () => {
    render(<MyEventsPage />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
  
  test('displays events after loading', async () => {
    // Mock API response
    jest.mocked(myEventsApi.getMyEvents).mockResolvedValue({
      success: true,
      events: [mockEvent1, mockEvent2]
    });
    
    render(<MyEventsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Event')).toBeInTheDocument();
    });
  });
});
```

#### Mobile Testing
```dart
// test/pages/my_events_page_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';

void main() {
  group('MyEventsPage', () {
    testWidgets('displays loading indicator initially', (tester) async {
      await tester.pumpWidget(MyEventsPage());
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });
    
    testWidgets('displays events after loading', (tester) async {
      // Mock service response
      when(mockMyEventsService.getMyEvents())
          .thenAnswer((_) async => [mockEvent]);
      
      await tester.pumpWidget(MyEventsPage());
      await tester.pump(); // Allow async operations
      
      expect(find.text('Test Event'), findsOneWidget);
    });
  });
}
```

## Security Considerations

### Authentication
- ✅ **Already Implemented**: Firebase JWT validation
- ✅ **Already Implemented**: User existence validation in MongoDB
- ✅ **Already Implemented**: Request state management with `request.state.uid`

### Authorization
- ✅ **Already Implemented**: Users can only access their own events
- ✅ **Already Implemented**: Family member validation before event access
- ✅ **Already Implemented**: RSVP cancellation limited to user's own registrations

### Data Privacy
- ✅ **Already Implemented**: No exposure of other users' event data
- ✅ **Already Implemented**: Family member events require ownership validation

## Performance Considerations

### Backend Optimization
The existing MongoDB aggregation pipeline is already optimized:
```python
# Existing efficient aggregation
pipeline = [
    {"$match": {"uid": uid}},
    {"$unwind": {"path": "$my_events", "preserveNullAndEmptyArrays": False}},
    {"$lookup": {
        "from": "events",
        "localField": "my_events.event_id", 
        "foreignField": "_id",
        "as": "event"
    }},
    {"$unwind": "$event"},
    # ... rest of pipeline
]
```

### Frontend Optimization
#### Web Optimization
- **Virtual Scrolling**: For users with many events
- **Memoization**: React.memo for event cards
- **Lazy Loading**: Load event details on demand
- **Image Optimization**: Lazy load event images

#### Mobile Optimization
- **ListView.builder**: Efficient list rendering
- **Image Caching**: Cache event images
- **Pagination**: Load events in chunks
- **Pull-to-refresh**: Standard mobile pattern

## Deployment Strategy

### Phase 1: Backend (Already Complete ✅)
The backend is already deployed and functional. No changes required.

### Phase 2: Web Frontend Deployment
1. **Development**: Create feature branch
2. **Implementation**: Build React components
3. **Testing**: Unit and integration tests  
4. **Review**: Code review process
5. **Staging**: Deploy to staging environment
6. **Production**: Deploy to production

### Phase 3: Mobile Frontend Deployment
1. **Development**: Create feature branch
2. **Implementation**: Build Flutter widgets
3. **Testing**: Widget and integration tests
4. **Review**: Code review process
5. **Beta Testing**: Internal testing group
6. **App Store**: Submit updates to app stores

## Success Metrics

### User Experience Metrics
- **Page Load Time**: < 2 seconds for My Events page
- **API Response Time**: < 500ms for events retrieval
- **User Engagement**: Time spent on My Events page
- **Feature Adoption**: % of users accessing My Events

### Technical Metrics
- **API Success Rate**: > 99.5%
- **Error Rate**: < 0.5%
- **Cache Hit Rate**: > 80% (mobile)
- **Performance Score**: > 90 (Lighthouse)

## Risk Mitigation

### Technical Risks
1. **API Changes**: Backend API is stable and won't need changes
2. **Authentication Issues**: Existing auth system is proven
3. **Data Consistency**: Existing sync mechanisms handle this
4. **Performance**: MongoDB aggregation is already optimized

### User Experience Risks
1. **Complex UI**: Start with simple design, iterate based on feedback
2. **Information Overload**: Use progressive disclosure and filtering
3. **Mobile Performance**: Implement efficient list rendering
4. **Offline Access**: Implement caching for mobile

## Implementation Timeline

### Sprint 1 (1 week): Web Frontend Foundation
```typescript
// PSEUDO CODE: Week 1 implementation checklist

/* 
DAY 1-2: Project Setup and API Integration
*/
- [ ] Create MyEventsPage.tsx component structure
  // PSEUDO: Copy EventViewer.tsx as template
  // Update imports, interfaces, and basic structure
  
- [ ] Implement API integration hooks
  // PSEUDO: Create /src/api/myEventsApi.ts
  // Test API endpoint /v1/event-people/my-events
  // Create useMyEvents hook with loading/error states
  
- [ ] Basic event list display
  // PSEUDO: Simple card layout showing event names and dates
  // Use existing motion components from EventViewer
  // Handle loading and error states

/* 
DAY 3-4: Core Functionality
*/
- [ ] Basic filtering (upcoming/past)
  // PSEUDO: Add state for filter toggles
  // Implement date comparison logic
  // Add filter UI controls (toggle buttons)
  
- [ ] Event card components
  // PSEUDO: Create MyEventCard component
  // Display event details, location, price
  // Add basic styling following existing patterns

/* 
DAY 5: Testing and Polish
*/
- [ ] Component testing
  // PSEUDO: Write basic Jest tests for components
  // Test API integration and error handling
  // Test filter functionality
  
- [ ] Code review and refinement
  // PSEUDO: Review code quality and patterns
  // Ensure TypeScript types are correct
  // Test responsive design basics
```

### Sprint 2 (1 week): Web Frontend Enhancement  
```typescript
// PSEUDO CODE: Week 2 implementation checklist

/* 
DAY 1-2: Advanced UI Components
*/
- [ ] Event cards with rich details
  // PSEUDO: Enhance MyEventCard with images, ministry info
  // Add proper date/time formatting
  // Include price and age range information
  
- [ ] Family member event indicators
  // PSEUDO: Add badges/indicators for family events
  // Show family member names
  // Different styling for personal vs family events

/* 
DAY 3-4: Search and Advanced Filtering
*/
- [ ] Search within user's events
  // PSEUDO: Add search input component
  // Implement client-side search functionality
  // Search by name, description, ministry
  
- [ ] Advanced filtering options
  // PSEUDO: Filter by ministry, past/upcoming, family
  // Add filter chips or dropdown selectors
  // Persist filter state in URL or localStorage

/* 
DAY 5: Actions and Integration
*/
- [ ] RSVP cancellation functionality
  // PSEUDO: Add cancel RSVP action to event cards
  // Implement confirmation dialogs
  // Handle API calls and update UI state
  
- [ ] Event details modal/navigation
  // PSEUDO: Link to existing event detail pages
  // Or create modal overlay for quick details
  // Ensure proper navigation flow
```

### Sprint 3 (1 week): Mobile Frontend Foundation
```dart
// PSEUDO CODE: Week 3 implementation checklist

/* 
DAY 1-2: Flutter Project Setup
*/
- [ ] Create MyEventsPage widget
  // PSEUDO: Copy structure from EventsPage
  // Set up StatefulWidget with proper lifecycle
  // Import required dependencies and models
  
- [ ] Implement service layer
  // PSEUDO: Create MyEventsService class
  // Use existing ApiClient patterns
  // Handle authentication and error cases
  
- [ ] Create MyEvent model
  // PSEUDO: Create data model with fromJson/toJson
  // Handle API response structure properly
  // Add convenience methods for UI

/* 
DAY 3-4: Basic UI Implementation
*/
- [ ] Basic event list display
  // PSEUDO: ListView.builder with basic event cards
  // Show loading indicator and error states
  // Implement pull-to-refresh functionality
  
- [ ] Pull-to-refresh functionality
  // PSEUDO: Wrap ListView in RefreshIndicator
  // Handle refresh action and update state
  // Provide user feedback during refresh

/* 
DAY 5: Testing and Integration
*/
- [ ] Widget testing
  // PSEUDO: Write Flutter widget tests
  // Test service layer functionality
  // Test error handling and edge cases
  
- [ ] Navigation integration
  // PSEUDO: Add to bottom navigation or drawer
  // Test authentication requirements
  // Ensure proper page transitions
```

### Sprint 4 (1 week): Mobile Frontend Enhancement
```dart
// PSEUDO CODE: Week 4 implementation checklist

/* 
DAY 1-2: Enhanced UI Components
*/
- [ ] Event cards with rich details
  // PSEUDO: Create detailed MyEventCard widget
  // Include event images, ministry, location details
  // Add proper Material Design styling
  
- [ ] Family member event indicators  
  // PSEUDO: Add family member badges and indicators
  // Show different styling for family vs personal events
  // Include family member names in card

/* 
DAY 3-4: Search and Filtering
*/
- [ ] Search and filtering
  // PSEUDO: Add search TextField to page header
  // Implement filter chips for upcoming/past/family
  // Add client-side filtering logic
  
- [ ] Advanced filter controls
  // PSEUDO: Create filter bottom sheet or drawer
  // Add ministry filter options
  // Persist filter preferences

/* 
DAY 5: Actions and Polish
*/
- [ ] RSVP cancellation functionality
  // PSEUDO: Add PopupMenuButton to event cards
  // Implement confirmation dialogs
  // Handle API calls and state updates
  
- [ ] Navigation to event details
  // PSEUDO: Link to existing EventShowcase page
  // Pass event ID for navigation
  // Ensure proper back navigation
```

### Sprint 5 (1 week): Polish & Testing
```typescript
// PSEUDO CODE: Week 5 final implementation checklist

/* 
DAY 1-2: UI/UX Refinements
*/
- [ ] Responsive design improvements
  // PSEUDO: Test on mobile/tablet/desktop breakpoints
  // Adjust card layouts and spacing
  // Ensure touch targets are appropriate size
  
- [ ] Accessibility improvements
  // PSEUDO: Add proper ARIA labels and roles
  // Test with screen readers
  // Ensure keyboard navigation works
  
- [ ] Loading and error state polish
  // PSEUDO: Add skeleton loading states
  // Improve error messages and retry functionality
  // Add empty state illustrations

/* 
DAY 3-4: Performance Optimizations
*/
- [ ] Web performance optimization
  // PSEUDO: Implement React.memo for cards
  // Add virtual scrolling for large lists
  // Optimize bundle size and loading
  
- [ ] Mobile performance optimization
  // PSEUDO: Optimize ListView.builder performance
  // Add image caching for event images
  // Test scroll performance with many events

/* 
DAY 5: Final Testing and Documentation
*/
- [ ] Comprehensive testing
  // PSEUDO: End-to-end testing scenarios
  // Cross-browser testing (web)
  // Cross-device testing (mobile)
  
- [ ] Documentation updates
  // PSEUDO: Update API documentation
  // Create user guide for My Events feature
  // Document deployment and maintenance procedures
```

## Conclusion

The "My Events" viewer implementation is surprisingly straightforward because **the backend infrastructure is already complete and robust**. The existing API endpoint `/api/v1/event-people/my-events` provides everything needed:

✅ **Comprehensive Data**: Full event details with user relationships  
✅ **Family Support**: Complete family member event management  
✅ **Authentication**: Secure Firebase-based user validation  
✅ **Performance**: Optimized MongoDB aggregation pipeline  
✅ **Error Handling**: Robust error handling and logging  

**The implementation focuses entirely on frontend development** to create intuitive user interfaces that leverage the existing, powerful backend infrastructure. This approach ensures:

- **Rapid Development**: No backend changes required
- **Proven Reliability**: Built on tested, production-ready APIs  
- **Consistent Experience**: Same data and behavior across platforms
- **Future-Proof**: Extensible design for additional features

The proposed solution is **elegant, simple, and robust** - exactly what was requested. By leveraging existing infrastructure and focusing on user experience, we can deliver high-quality "My Events" functionality efficiently and reliably.