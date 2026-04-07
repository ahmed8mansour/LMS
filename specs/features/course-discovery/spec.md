# Feature: Course Discovery

## Overview

The Course Discovery feature provides the public-facing interface for students to browse, search, and filter courses. It includes the homepage, course listing page, and course detail views.

---

## What This Feature Does

1. **Homepage Display**: Show featured/popular courses by category
2. **Course Browsing**: Paginated course listings with filtering
3. **Search**: Full-text search across course titles and descriptions
4. **Filtering**: Filter by category, level, price range, rating
5. **Sorting**: Sort by newest, most popular, or system default
6. **Course Detail**: Display full course information with curriculum preview

---

## Frontend Pages

### Homepage (`/`)

**Purpose**: Landing page showcasing platform value proposition and featured courses.

**Components:**
- `Hero`: Value proposition and CTA
- `HomePageCoursesSection`: Filterable course carousel
- `ServicesSection`: Platform features/benefits

**Features:**
- Category filter tabs (All, Development, Business, Design, Marketing)
- Displays 3 featured courses per category
- "View all courses" link to course listing

### Course Listing Page (`/courses`)

**Purpose**: Browse all courses with advanced filtering.

**Layout:**
```
┌─────────────────────────────────────────────┐
│  Header: Explore Courses (120+ available)   │
├──────────────────┬──────────────────────────┤
│                  │                          │
│  Filters Sidebar │  Search & Sort Bar       │
│  - Category      │  ──────────────────────  │
│  - Level         │                          │
│  - Price Range   │  Course Cards Grid       │
│  - Rating        │  ┌────┐ ┌────┐ ┌────┐  │
│                  │  │Card│ │Card│ │Card│  │
│                  │  └────┘ └────┘ └────┘  │
│                  │                          │
│                  │  Load More...           │
│                  │                          │
└──────────────────┴──────────────────────────┘
```

**Filters Available:**
- **Category**: Development, Business, Design & UI/UX, Marketing
- **Level**: Beginner, Intermediate, Advanced
- **Price Range**: $0 - $1000+ slider
- **Rating**: 4.5+, 4.0+, 3.0+

**Sort Options:**
- Newest (default)
- Most Popular
- Price: Low to High
- Price: High to Low

### Course Detail Page (`/courses/[id]`)

**Purpose**: Display complete course information and enrollment CTA.

**Layout:**
```
┌─────────────────────────────────────────────┐
│  Course Thumbnail with Overlay              │
│  - Title, Rating, Student Count            │
│  - Category Badge                          │
├────────────────────────┬────────────────────┤
│                        │  Enrollment Card   │
│  Course Content        │  - Price          │
│  ──────────────────    │  - Enroll Button  │
│  Goals List            │  - Features List   │
│                        │                    │
│  Curriculum Sections   │  (Sticky)          │
│  - Expandable          │                    │
│  - Lecture Count       │                    │
│  - Duration            │                    │
│                        │                    │
│  Instructor Bio        │                    │
│  - Photo, Title        │                    │
│  - About               │                    │
│                        │                    │
│  Reviews Section       │                    │
│  - Rating Breakdown    │                    │
└────────────────────────┴────────────────────┘
```

**Conditional Display:**
- If enrolled: Show "Continue Learning" button linking to dashboard
- If not enrolled: Show "Enroll Now" with pricing

---

## Backend Endpoints

### Course Discovery Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/courses/student/homepage/` | GET | No | Featured courses for homepage |
| `/courses/student/courses/` | GET | No | List courses with filters/pagination |
| `/courses/student/courses/{id}/` | GET | Optional | Course detail with enrollment status |

### Query Parameters

#### List Endpoint (`/courses/student/courses/`)

| Param | Type | Multiple | Description | Example |
|-------|------|----------|-------------|---------|
| `category` | string | Yes | Filter by category | `?category=development&category=business` |
| `level` | string | No | Filter by level | `?level=beginner` |
| `min_price` | decimal | No | Minimum price | `?min_price=10` |
| `max_price` | decimal | No | Maximum price | `?max_price=100` |
| `rating` | decimal | No | Minimum rating | `?rating=4.0` |
| `search` | string | No | Search term | `?search=python` |
| `sort` | string | No | Sort order | `?sort=popular` |
| `cursor` | string | No | Pagination cursor | `?cursor=cD0y` |
| `page_size` | integer | No | Items per page | `?page_size=10` |

#### Sort Values

- `newest` (default): Created date descending
- `popular`: Subscriber count descending
- `price_low`: Price ascending
- `price_high`: Price descending

---

## Frontend Components

### Discovery Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `Hero` | `components/organisms/Hero.tsx` | Homepage hero section |
| `HomePageCoursesSection` | `features/courses/components/HomePageCoursesSection.tsx` | Homepage course grid with filters |
| `HomeRadioGroup` | `components/molecules/HomeRadioGroup.tsx` | Category filter tabs |
| `Filters` | `components/molecules/Filters.tsx` | Sidebar filters on listing page |
| `SearchAndSort` | `components/molecules/SearchAndSort.tsx` | Search bar + sort dropdown |
| `CourseCard` | `components/molecules/CourseCard.tsx` | Course preview card |
| `CourseCardSkeleton` | `components/molecules/CourseCardSkeleton.tsx` | Loading placeholder |
| `CoursesCards` | `features/courses/components/courses/CoursesCards.tsx` | Grid container |
| `ServicesSection` | `components/organisms/ServicesSection.tsx` | Platform features |

### Detail Page Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `CourseDetailPage` | `features/courses/components/CourseDetailPage/courseid/CourseDetailPage.tsx` | Main detail layout |
| `CourseHero` | `features/courses/components/CourseDetailPage/courseid/CourseHero.tsx` | Header with metadata |
| `CourseGoals` | `features/courses/components/CourseDetailPage/courseid/CourseGoals.tsx` | Learning objectives list |
| `CourseSections` | `features/courses/components/CourseDetailPage/courseid/CourseSections.tsx` | Curriculum accordion |
| `CourseInstructor` | `features/courses/components/CourseDetailPage/courseid/CourseInstructor.tsx` | Instructor bio card |
| `CourseEnrollCard` | `features/courses/components/CourseDetailPage/courseid/CourseEnrollCard.tsx` | Enrollment CTA (sticky) |
| `CourseFeedback` | `features/courses/components/CourseDetailPage/courseid/CourseFeedback.tsx` | Rating/reviews display |

---

## Hooks

| Hook | Location | Purpose |
|------|----------|---------|
| `usePaginatedCourses` | `features/courses/hooks/usePaginatedCourses.tsx` | Infinite scroll course list |
| `useCourse` | `features/courses/hooks/useCourse.tsx` | Single course fetch |
| `useCourseStats` | `features/courses/hooks/useCourseStats.tsx` | Calculate duration/lecture counts |
| `useDebounce` | `hooks/useDebounce.tsx` | Debounce search input |

---

## Data Flow

### Homepage Flow

```
User                          Frontend                        Backend
  │                              │                               │
  │-- Visit Homepage ---------->│                               │
  │                              │-- GET /homepage -------------->│
  │                              │                               │
  │                              │<-- Return: Featured courses ---│
  │                              │                               │
  │<-- Render Hero + Courses ----│                               │
  │                              │                               │
  │-- Click Category Tab ------->│                               │
  │                              │-- Re-fetch with category ------>│
  │                              │                               │
  │<-- Update displayed courses -│                               │
```

### Course Listing Flow

```
User                          Frontend                        Backend
  │                              │                               │
  │-- Visit /courses ----------->│                               │
  │                              │-- GET /student/courses/ ------>│
  │                              │                               │
  │                              │<-- Return: Paginated list -----│
  │                              │                               │
  │-- Apply Filter ------------->│                               │
  │                              │-- GET with query params ------->│
  │                              │   ?category=development         │
  │                              │                               │
  │                              │<-- Return: Filtered results ---│
  │                              │                               │
  │-- Scroll to Bottom --------->│                               │
  │                              │-- GET with cursor -------------->│
  │                              │   ?cursor=cD0y                │
  │                              │                               │
  │                              │<-- Return: Next page ----------│
  │                              │                               │
  │<-- Append to list ----------│                               │
```

### Course Detail Flow

```
User                          Frontend                        Backend
  │                              │                               │
  │-- Click Course Card -------->│                               │
  │                              │-- Navigate to /courses/[id]    │
  │                              │                               │
  │                              │-- GET /student/courses/{id}/ --->│
  │                              │   (with auth if logged in)    │
  │                              │                               │
  │                              │<-- Return: Full course detail │
  │                              │   + enrolled_status           │
  │                              │                               │
  │<-- Render detail page ------│                               │
  │   (shows enroll or continue) │                               │
```

---

## Filtering Architecture

### State Management

Filters are managed via React Query's queryKey:

```typescript
// Query key includes all filter state
queryKey: ['courses', {
    category: ['development'],
    level: 'beginner',
    min_price: 10,
    max_price: 100,
    search: 'python',
    sort: 'popular'
}]
```

When filters change, new query is triggered automatically.

### URL Sync (Optional Enhancement)

Current implementation: Filters are in component state only.

Recommended enhancement: Sync with URL query params:

```typescript
// Use Next.js router to sync
const router = useRouter();
const filters = router.query; // ?category=development&level=beginner

// Update URL on filter change
router.push({
    pathname: '/courses',
    query: { category: selectedCategory }
}, undefined, { shallow: true });
```

### Debounced Search

Search input is debounced to prevent excessive API calls:

```typescript
const [searchTerm, setSearchTerm] = useState('');
const debouncedSearch = useDebounce(searchTerm, 500); // 500ms delay

// Use debouncedSearch in query
```

---

## Edge Cases Handled

### Empty States

1. **No Courses Match Filters:**
   - Display "No courses match these filters" message
   - Suggest clearing filters

2. **Empty Search Results:**
   - Display "No courses found for 'search term'"
   - Suggest alternative search terms

3. **API Error:**
   - Display "Something went wrong, try later"
   - Retry button

### Loading States

1. **Initial Load:**
   - Show skeleton cards (CourseCardSkeleton)
   - 3 skeletons matching grid layout

2. **Filter Change:**
   - Show loading indicator
   - Keep previous results until new ones load (React Query)

3. **Infinite Scroll:**
   - Show loading spinner at bottom
   - Disable "Load More" while fetching

### Pagination Edge Cases

1. **No More Pages:**
   - Hide "Load More" when `next` is null
   - Show "You've reached the end" message

2. **Cursor Expiration:**
   - If cursor expires, reset to first page
   - Toast notification: "Showing first page"

3. **Concurrent Filter + Pagination:**
   - Cancel in-flight requests
   - Reset to page 1 on filter change

### Image Handling

1. **Thumbnail Load Error:**
   - Fallback to placeholder
   - Show gray background with initials

2. **Instructor Avatar Error:**
   - Show fallback avatar

---

## Known Limitations / TODOs

1. **No URL Sync**: Filters not reflected in URL (can't share filtered views)

2. **Limited Sorting**: Only 3 sort options (newest, popular, system)
   - Missing: Price sorting (backend supports, frontend doesn't)

3. **No Search Suggestions**: Basic text search without autocomplete

4. **No Filter Persistence**: Filters reset on page refresh

5. **No Course Comparison**: Can't compare multiple courses side-by-side

6. **No Wishlist**: Can't save courses for later (button exists but non-functional)

7. **No Recently Viewed**: No history of browsed courses

8. **No Related Courses**: No "You might also like" recommendations

9. **Search Performance**: Database-level search, no full-text indexing

10. **Mobile Filter Experience**: Sidebar filters not optimized for mobile

---

## Responsive Design

### Breakpoints

| Breakpoint | Layout |
|------------|--------|
| Mobile (<640px) | Single column cards, filters as sheet/modal |
| Tablet (640-1024px) | 2-column cards, filters sidebar collapsible |
| Desktop (>1024px) | 3-column cards, filters sidebar visible |

### Responsive Patterns

```css
/* Course cards grid */
grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8

/* Detail page layout */
flex-col lg:flex-row

/* Filter sidebar */
w-full md:basis-5/13 xl:basis-3/13  /* Desktop */
w-full /* Mobile (stacked) */
```

---

## Performance Considerations

### Current Optimizations

1. **Cursor Pagination**: Consistent performance regardless of dataset size
2. **React Query Caching**: 5-minute stale time for course lists
3. **Skeleton Loading**: Immediate visual feedback
4. **Image Optimization**: Cloudinary CDN with caching

### Potential Improvements

1. **Virtual Scrolling**: For very long lists (react-window)
2. **Prefetching**: Hover over course card prefetchs detail
3. **Service Worker**: Cache course data offline
4. **Image Lazy Loading**: Load below-fold images lazily

---

## Dependencies

### Frontend
- `@tanstack/react-query` - Server state management
- `axios` - HTTP client
- `lucide-react` - Icons
- Tailwind CSS - Responsive styling
