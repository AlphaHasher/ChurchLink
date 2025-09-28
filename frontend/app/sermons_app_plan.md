# Sermons Mobile App Implementation Plan (Programmer Edition)

This document converts the verified backend + web sermons work into an actionable Flutter roadmap. Every instruction below has been cross-checked against the current repository so implementation can begin without guessing.

---

## 1. Verified baseline (current Flutter app)
- `lib/pages/sermons.dart` is a placeholder scaffold that renders "Sermons go here". No data fetching, filters, or favorites exist yet.
- There is **no** sermon data model, filter object, or services under `lib/models` or `lib/services` (confirmed by searching for "sermon").
- Networking is centralized in `lib/helpers/api_client.dart`; it points to `<BackendHelper.apiBase>/api` and already injects Firebase ID tokens, so new API calls should reuse `api` from that file.
- The Events feature demonstrates the expected architecture: `lib/models/event.dart`, `lib/services/event_registration_service.dart`, `lib/pages/eventspage.dart`, and `lib/widgets/enhanced_event_card.dart` provide reusable patterns for serialization, filtering, and UI cards.
- Bottom navigation in `lib/main.dart` already exposes a Sermons tab that routes to `SermonsPage`; we only need to replace the placeholder UI.
- Dashboard quick links (`lib/pages/dashboard.dart`) currently exclude sermons, but the shared `Tiles` widget is available for adding a new entry.

Keep these facts in mind while implementing to avoid over-engineering or duplicating existing infrastructure.

---

## 2. Backend surface to target
All sermon endpoints live under `/api/v1/sermons` (see `sermons_summary_backend.md`). The web frontend already consumes them, so we can mirror its contract:
- List/search/detail endpoints return `SermonOut` with fields such as `id`, `title`, `description`, `speaker`, `ministry`, `youtube_url`, `video_id`, `date_posted`, `published`, `roles`, optional `thumbnail_url`, `tags`, `summary`, localized `ru_*` strings, and the computed `is_favorited` flag when the user is authenticated.
- Favorites endpoints (`POST/DELETE /{id}/favorite`, `GET /favorites?expand=true`) follow the same shape as events favorites; the expanded variant returns nested sermon documents with stringified IDs.
- Admin CRUD/publish endpoints exist but are guarded by `sermon_editing`; the current Flutter app has no admin tooling, so treat these as future work.

---

## 3. Implementation roadmap

### Step 1 – Data & helpers
1. **Create `lib/models/sermon.dart`.**
   - Mirror backend field names (snake case from JSON) and expose idiomatic Dart getters.
   - Include: `id`, `title`, `description`, `speaker`, `List<String> ministry`, `String youtubeUrl`, `String? videoId`, `DateTime datePosted`, `bool published`, `List<String> roles`, `bool isFavorited`, plus optional `thumbnailUrl`, `tags`, `durationSeconds`, `summary`, `createdAt`, `updatedAt`, `ruTitle`, `ruDescription`, `ruSpeaker`.
   - Follow the pattern used in `Event.fromJson` for null safety and list coercion. Parse timestamps with `DateTime.tryParse` and default to `DateTime.now()` only when the API omits the value.
   - Add convenience getters similar to `Event.formattedDateTime` (use `intl` already in pubspec) for formatted date/time and a helper that chooses Russian text when requested.

2. **Create `lib/models/sermon_filter.dart`.**
   - Fields: `skip`, `limit`, `ministry`, `speaker`, `tags`, `DateTime? dateAfter`, `DateTime? dateBefore`, `bool? published`, `String? query`, `bool favoritesOnly`.
   - Provide a `toQueryParameters()` method returning `Map<String, String>` so services can forward filters directly to Dio.

3. **Create `lib/models/sermon_favorite.dart`.**
   - Model the favorites payload (`id`, `sermonId`, `reason`, `key`, `meta`, `addedOn`, `Sermon? sermon`). Use `MyEventsResponse` as a template for structuring expanded vs. non-expanded results.

### Step 2 – Networking layer
1. **Add `lib/services/sermons_service.dart`.**
   - Inject the shared `api` client.
   - Implement:
     - `Future<List<Sermon>> fetchSermons(SermonFilter filter)` → GET `/v1/sermons/`.
     - `Future<Sermon?> fetchSermonById(String id)` → GET `/v1/sermons/{id}`.
     - `Future<void> favorite(String id)` and `Future<void> unfavorite(String id)` → POST/DELETE favorite endpoints (treat non-2xx as exceptions).
     - Optional `Future<List<Sermon>> search(String query, {SermonFilter? filter})` if separate search UI is planned.
   - Map responses using the new `Sermon` model, coercing `date_posted` into `DateTime` just like the web `coerceDate` helper.

2. **Add `lib/services/my_sermons_service.dart`.**
   - Provide `Future<List<SermonFavorite>> fetchFavorites({bool expand = true})` hitting `/v1/sermons/favorites` and parsing nested sermons when present.
   - Provide `Future<bool> removeFavorite(String sermonId)` that calls DELETE `/v1/sermons/{id}/favorite` and returns `true` on success.

### Step 3 – State management
1. **Create `lib/providers/sermons_provider.dart`.**
   - Extend `ChangeNotifier`.
   - Hold `List<Sermon> items`, `bool loading`, `String? error`, `SermonFilter activeFilter`, and `Sermon? selected` for detail views.
   - Methods to implement:
     - `Future<void> loadInitial()` → call `sermonsService.fetchSermons` with a sensible default filter (e.g., `published=true`, `limit=50`).
     - `Future<void> applyFilter(SermonFilter filter)`.
     - `Future<void> toggleFavorite(Sermon sermon)` → optimistic update `isFavorited` then call service; revert on failure.
     - `Future<void> refreshFavorites()` (optional) → repopulate favorite cache for user profile screens.
   - Hook errors into `error` so the UI can render retry banners.

2. **Register the provider.**
   - In `lib/main.dart`, add `ChangeNotifierProvider(create: (_) => SermonsProvider())` to the existing `MultiProvider` list before launching `MyApp`.

### Step 4 – UI composition
1. **Revamp `lib/pages/sermons.dart`.**
   - Replace hard-coded text with a `Consumer<SermonsProvider>` that drives the screen.
   - Provide `RefreshIndicator` + `ListView.builder` similar to `EventsPage`, but sourcing data from the provider instead of hitting the API directly.
   - Include a filter button in the AppBar that opens a bottom sheet.

2. **Add UI building blocks.**
   - `lib/widgets/sermon_card.dart`: a stateless card showing title, speaker, formatted date, optional summary, and a star icon bound to `sermon.isFavorited`. Reference `EnhancedEventCard` for styling and consistent padding.
   - `lib/widgets/sermon_filter_sheet.dart`: bottom sheet with ministry dropdown, speaker text field, date pickers, and favorites toggle. Use the filter controllers from `EventsPage` as a starting point; keep initial scope small (ministry, query, date range, favorites).
   - `lib/widgets/sermon_detail_sheet.dart` (or a full page): display full description, YouTube link button (use `url_launcher` which is already imported in `main.dart`), ministry chips, and a favorite toggle button. Defer embedded video until after MVP.

3. **Navigation tweaks.**
   - Update `lib/pages/dashboard.dart` to add a new `Tiles` entry that pushes `SermonsPage`, matching the pattern used for events.
   - Ensure `Navigator.push` uses `CupertinoPageRoute` or `MaterialPageRoute` consistent with the rest of the dashboard tiles.

4. **My Sermons (favorites) surface.**
   - Add `lib/pages/user/my_sermons_page.dart` that mirrors `MyEventsService` usage: fetch favorites on load, display cards, allow unfavoriting from the list, and show empty state messaging.
   - Link this page from `lib/pages/user/user_settings.dart` or whichever profile menu is appropriate.

### Step 5 – Optional follow-ups (after MVP)
- Admin CRUD/publish actions: only pursue once mobile admins are required. These would reuse the same services but need permission discovery endpoints (not currently consumed anywhere in the app).
- Localization toggles: if Russian content must be surfaced, reuse the `useRussian` logic present in the `Event` model helpers.
- Offline caching: persist the last sermons payload with `SharedPreferences` if startup latency becomes an issue.

---

## 4. Testing & quality gates
- Flutter tests currently have no sermon coverage. Create new tests under `test/sermons/`:
  - `sermon_model_test.dart` for JSON serialization.
  - `sermons_service_test.dart` mocking Dio with sample payloads.
  - `sermons_provider_test.dart` verifying optimistic favorite toggles and error handling.
- Widget tests: snapshot the list page in loading, error, empty, and populated states. Use the provider with fake data to avoid network calls.
- Run `flutter analyze` (configured via `analysis_options.yaml`) before committing to ensure new files respect lint rules.

---

## 5. Deliverable checklist
- [ ] `lib/models/sermon.dart` implemented with tests.
- [ ] `lib/models/sermon_filter.dart` + query conversion.
- [ ] `lib/services/sermons_service.dart` and `lib/services/my_sermons_service.dart` hitting the correct endpoints.
- [ ] `lib/providers/sermons_provider.dart` registered in `main.dart`.
- [ ] Updated `lib/pages/sermons.dart` backed by provider + new widgets (`sermon_card`, `sermon_filter_sheet`, detail view).
- [ ] Dashboard tile wired to the new page; optional favorites page linked from user settings.
- [ ] Test suite extended for models/services/provider + widget smoke tests.
- [ ] Manual QA script covering list load, filtering, favoriting/unfavoriting, and navigation from dashboard and profile menus.

Follow this plan sequentially and you’ll end up with a sermon experience aligned with the verified backend contracts and the existing Flutter architecture.
