# Course Discovery - Tasks

## Status: COMPLETE (Frontend)

---

## Frontend Tasks

### Pages
- [x] Homepage (`/`)
- [x] Course Listing Page (`/courses`)
- [x] Course Detail Page (`/courses/[id]`)

### Homepage Components
- [x] Hero section
- [x] HomePageCoursesSection component
- [x] HomeRadioGroup category filter
- [x] CourseCard display
- [x] CourseCardSkeleton loading state
- [x] "View all courses" link
- [x] ServicesSection platform features

### Course Listing Components
- [x] Filters sidebar component
  - [x] Category filter checkboxes
  - [x] Level filter
  - [x] Price range display (UI only, no slider)
  - [x] Rating filter
- [x] SearchAndSort component
  - [x] Search input
  - [x] Sort dropdown (newest/popular)
- [x] CoursesCards grid layout
- [x] Responsive layout (sidebar + grid)
- [x] Empty state handling
- [x] Error state handling

### Course Detail Components
- [x] CourseDetailPage layout
- [x] CourseHero component
  - [x] Thumbnail with overlay
  - [x] Title display
  - [x] Rating stars
  - [x] Student count
  - [x] Category badge
- [x] CourseGoals component
  - [x] Learning objectives list
- [x] CourseSections component
  - [x] Accordion for sections
  - [x] Lecture count display
  - [x] Total duration calculation
  - [x] Expandable curriculum
- [x] CourseInstructor component
  - [x] Avatar display
  - [x] Name and title
  - [x] Bio text
- [x] CourseEnrollCard component
  - [x] Price display
  - [x] "Enroll Now" button
  - [x] "Add to Cart" button (UI only)
  - [x] Features list (video access, certificate, etc.)
  - [x] Sticky positioning
- [x] CourseFeedback component
  - [x] Rating breakdown (placeholder)
  - [x] Reviews display (placeholder)
- [x] Conditional enrollment status
  - [x] Show "Enroll Now" if not enrolled
  - [x] Show "See in Dashboard" if enrolled

### Hooks
- [x] usePaginatedCourses hook
  - [x] Infinite scroll with cursor pagination
  - [x] Filter support
  - [x] Sort support
  - [x] Stale time configuration (5 minutes)
- [x] useCourse hook
  - [x] Single course fetch by ID
  - [x] Error handling
- [x] useCourseStats hook
  - [x] Total duration calculation
  - [x] Total lectures count
- [x] useDebounce hook
  - [x] Search input debouncing

### API Integration
- [x] coursesAPI.getCourses (with pagination)
- [x] coursesAPI.getCourse (single)
- [x] Query param serialization for filters
- [x] Cursor extraction for pagination

### State Management
- [x] Filter state management
- [x] Category selection state
- [x] Sort selection state
- [x] Search term state (debounced)

### Loading States
- [x] CourseCardSkeleton for initial load
- [x] Loading spinner for infinite scroll
- [x] BounceLoader for detail page

### Error Handling
- [x] Error boundary for course list
- [x] Error message display
- [x] Retry functionality
- [x] not-found.tsx for invalid course IDs

---

## Backend Tasks (Consumed from Course Management)

### Endpoints Used
- [x] GET /courses/student/homepage/
- [x] GET /courses/student/courses/
- [x] GET /courses/student/courses/{id}/

### Features Used
- [x] Cursor pagination
- [x] Category filtering
- [x] Level filtering
- [x] Price range filtering
- [x] Rating filtering
- [x] Search filtering
- [x] Sorting (newest, popular)
- [x] Nested serialization (sections/lectures)
- [x] Enrollment status check

---

## Known Issues / Limitations

### Incomplete Features
- [ ] URL sync with filters (can't share filtered views)
- [ ] Price sorting in frontend (backend supports)
- [ ] Price range slider (UI shows range, not interactive)
- [ ] "Add to Cart" functionality (button is placeholder)
- [ ] Reviews are placeholder data (not real reviews)

### Technical Debt
- [ ] Console.log in CourseSections component
- [ ] Hardcoded "40% Off" in CourseEnrollCard
- [ ] Hardcoded "Last updated" format
- [ ] Fake data in CourseFeedback (rating breakdown)

---

## Enhancements Not Implemented

### Search
- [ ] Search suggestions/autocomplete
- [ ] Recent searches
- [ ] Search history

### Filtering
- [ ] URL sync for filter state
- [ ] Filter persistence across sessions
- [ ] "Clear all filters" button
- [ ] Active filter pills/tags

### User Experience
- [ ] Course comparison feature
- [ ] Wishlist/save for later
- [ ] Recently viewed courses
- [ ] Related courses recommendations
- [ ] Course preview video

### Performance
- [ ] Prefetch on card hover
- [ ] Image lazy loading
- [ ] Virtual scrolling for long lists
- [ ] Service worker caching

### Mobile
- [ ] Mobile-optimized filter drawer
- [ ] Swipe gestures for carousel
- [ ] Touch-friendly accordion

---

## Testing Considerations

### Unit Tests
- [ ] CourseCard rendering
- [ ] Filter logic
- [ ] useCourseStats calculations
- [ ] Debounce hook

### Integration Tests
- [ ] Course list fetching
- [ ] Filter application
- [ ] Pagination behavior
- [ ] Search functionality

### E2E Tests
- [ ] Browse courses flow
- [ ] Filter and sort flow
- [ ] Course detail navigation
- [ ] Enroll button flow

---

## Analytics Opportunities

### Events to Track
- [ ] Course viewed
- [ ] Filter applied
- [ ] Search performed
- [ ] Category clicked
- [ ] Course card clicked
- [ ] Enroll button clicked
- [ ] Page scrolled (pagination depth)

### Metrics to Measure
- [ ] Time to first course view
- [ ] Filter usage rate
- [ ] Search success rate
- [ ] Conversion rate (view to enroll)
- [ ] Popular categories
- [ ] Popular sort options
