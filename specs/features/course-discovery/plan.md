# Course Discovery - Architecture Plan

## Architecture Overview

Course Discovery is a **read-heavy frontend feature** built on top of Course Management APIs. It prioritizes fast initial load, smooth filtering, and infinite scroll pagination for an optimal browsing experience.

---

## Key Architectural Decisions

### 1. Infinite Scroll with Cursor Pagination

**Decision:** Use React Query's `useInfiniteQuery` with cursor-based pagination instead of traditional page numbers.

**Rationale:**
- Natural mobile experience (scroll to load more)
- No "page number" UI complexity
- Consistent performance with large datasets
- No duplicate items during concurrent edits

**Implementation:**
```typescript
useInfiniteQuery({
    queryKey: ['courses', filters],
    queryFn: ({ pageParam }) => getCourses({ ...filters, cursor: pageParam }),
    initialPageParam: '',
    getNextPageParam: (lastPage) => {
        if (!lastPage.next) return null;
        return new URL(lastPage.next).searchParams.get('cursor');
    },
});
```

**Trade-offs:**
- Can't jump to arbitrary page
- Harder to implement "back to position"

### 2. Client-Side Filter State

**Decision:** Manage filter state in React Query's queryKey, not URL.

**Current Implementation:**
```typescript
const [filters, setFilters] = useState({
    category: [],
    level: undefined,
    search: ''
});

// Triggers new query when filters change
queryKey: ['courses', filters]
```

**Alternative Considered (Not Implemented):**
```typescript
// URL-synced filters
const router = useRouter();
const filters = router.query;
```

**Why URL Sync Was Deferred:**
- Adds complexity
- SEO benefit minimal (content is behind auth)
- Can be added later without breaking changes

### 3. Skeleton Loading Pattern

**Decision:** Show skeleton cards immediately while data loads.

**Implementation:**
```typescript
if (isPending) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map(i => <CourseCardSkeleton key={i} />)}
        </div>
    );
}
```

**Benefits:**
- Prevents layout shift
- Immediate visual feedback
- Matches grid layout (3 skeletons = 1 row)

### 4. Sticky Enrollment Card

**Decision:** Course detail has sticky enrollment CTA on desktop.

**Implementation:**
```css
/* Sidebar */
.sticky { position: sticky; top: 2rem; }

/* Responsive: Unstick on mobile */
@media (max-width: 1024px) {
    .sticky { position: static; }
}
```

**Rationale:**
- CTA always visible while scrolling content
- Common e-commerce pattern (Amazon, Udemy)
- Non-intrusive on mobile

### 5. Nested Data Fetching

**Decision:** Single endpoint returns course with all nested content.

**Current:**
```typescript
GET /courses/{id}/
// Returns: Course + Sections + Lectures + Quiz
```

**Alternative Considered:**
```typescript
GET /courses/{id}/
GET /courses/{id}/sections/
GET /sections/{id}/lectures/
```

**Why Single Endpoint:**
- Simpler frontend code
- Atomic course "document"
- Easier caching
- No waterfall requests

**Trade-off:** Larger payload for courses with many sections.

---

## Data Flow Architecture

### Filter Application Flow

```
User Action                    State Change                    API Request
───────────                    ────────────                    ───────────
Click Category                 filters.category = ['dev']      Cancel pending
Filter                                                         request
                                                                  ↓
Debounce 300ms                                                 New request:
                                                                  GET /courses/
                                                                  ?category=dev
                                                                  &cursor=
                                                                  ↓
Query Key Change                                               Response:
['courses', {                                                  {next, results}
    category: ['dev']
}]
                                                                  ↓
React Query                                                    Update UI:
Cache Miss                                                        - Clear previous
                                                                  - Show skeletons
                                                                  - Render new cards
```

### Infinite Scroll Flow

```
User Scroll                    React Query                     API Response
───────────                    ───────────                     ────────────
Scroll to                      hasNextPage ?                   Return:
bottom                         fetchNextPage()                 {
                                                                  results: [...],
                                                                  next: "cursor123"
                                                               }
                                                                  ↓
                               Append to                         Render new
                               previous pages:                   cards
                               [...prev, newResults]
```

---

## Component Architecture

### Component Hierarchy

```
HomePage
├── Hero
└── HomePageCoursesSection
    ├── HomeRadioGroup (category filter)
    └── CourseCard[] (3 cards)

CoursesPage
├── Header (title + subtitle)
├── Filters (sidebar)
│   ├── CategoryFilter
│   ├── LevelFilter
│   ├── PriceFilter
│   └── RatingFilter
├── SearchAndSort (top bar)
│   ├── SearchInput
│   └── SortDropdown
└── CoursesCards
    └── CourseCard[] (infinite grid)

CourseDetailPage
├── CourseHero
│   └── CourseMetadata (rating, students, etc.)
├── CourseGoals
├── CourseSections (accordion)
│   └── Section[]
│       └── Lecture[]
├── CourseInstructor
├── CourseFeedback
└── CourseEnrollCard (sticky sidebar)
```

### Reusable Components

**CourseCard:**
```typescript
interface CourseCardProps {
    id: number;
    ImageUrl: string;
    Name: string;
    About: string;
    Price: number;
    AvaterUrl: string;
    Instructor: string;
    Rate: number;
    Subscribers: number;
    Tag: string;
}
```

Used in:
- HomePageCoursesSection
- CoursesCards grid
- (Future) Related courses

---

## Caching Strategy

### React Query Configuration

```typescript
useInfiniteQuery({
    queryKey: ['courses', filters],
    queryFn: fetchCourses,
    staleTime: 5 * 60 * 1000,  // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes (garbage collection)
});

useQuery({
    queryKey: ['course', id],
    queryFn: fetchCourse,
    staleTime: 5 * 60 * 1000,
});
```

### Cache Invalidation

**Automatic:**
- Cache expires after staleTime
- Refetch on window focus (configurable)

**Manual (not implemented):**
```typescript
// After enrollment
queryClient.invalidateQueries(['course', id]);

// After new course created (if admin view)
queryClient.invalidateQueries(['courses']);
```

---

## Responsive Design Strategy

### Breakpoint System

| Name | Min Width | Max Width | Usage |
|------|-----------|-----------|-------|
| Mobile | 0 | 639px | Single column, stacked filters |
| Tablet | 640px | 1023px | 2-column grid |
| Desktop | 1024px | ∞ | 3-column, sidebar filters |

### Layout Patterns

**Course Listing:**
```
Mobile:     [Filters Button]
            [Search/Sort]
            [Card]
            [Card]

Tablet:     [Search/Sort]
            [Card] [Card]
            [Card] [Card]

Desktop:    [Sidebar Filters] [Search/Sort]
            [Card] [Card] [Card]
            [Card] [Card] [Card]
```

**Course Detail:**
```
Mobile:     [Hero]
            [Enroll Card]
            [Goals]
            [Sections]
            [Instructor]

Desktop:    [Hero]
            [Content]        [Enroll Card (sticky)]
            [Goals]
            [Sections]
            [Instructor]
```

---

## Performance Optimizations

### Implemented

1. **React Query Caching**: 5-minute stale time prevents redundant fetches
2. **Cursor Pagination**: Consistent performance regardless of data size
3. **Skeleton Loading**: Prevents layout shift, immediate feedback
4. **Debounced Search**: 500ms delay prevents excessive API calls
5. **Image Optimization**: Cloudinary CDN with responsive sizing

### Future Opportunities

1. **Prefetch on Hover:**
```typescript
const prefetchCourse = usePrefetchCourse();

<CourseCard
    onMouseEnter={() => prefetchCourse(course.id)}
/>
```

2. **Virtual Scrolling:**
```typescript
import { VirtualList } from 'react-window';

<VirtualList
    items={courses}
    renderItem={CourseCard}
/>
```

3. **Service Worker Caching:**
```typescript
// workbox
workbox.routing.registerRoute(
    '/api/courses',
    new workbox.strategies.StaleWhileRevalidate()
);
```

---

## State Management

### Server State (React Query)

```typescript
// Course list with filters
const coursesQuery = useInfiniteQuery({
    queryKey: ['courses', filters],
    queryFn: fetchCourses,
});

// Single course
const courseQuery = useQuery({
    queryKey: ['course', id],
    queryFn: fetchCourse,
});
```

### Client State (useState)

```typescript
// Filter UI state
const [selectedCategory, setSelectedCategory] = useState('all Categories');

// Search input (before debounce)
const [searchTerm, setSearchTerm] = useState('');
```

### No Global State Needed

Course Discovery doesn't use:
- Redux
- Zustand
- Context API for data

All data is server-managed via React Query.

---

## Error Handling

### Error Types

1. **Network Error:**
   - Display: "Can't connect to server"
   - Action: Retry button

2. **Not Found (404):**
   - Display: 404 page with helpful message
   - Action: Link to courses list

3. **Server Error (500):**
   - Display: "Something went wrong"
   - Action: Retry, contact support

4. **Empty Results:**
   - Display: "No courses match filters"
   - Action: Clear filters button

### Error Boundary

```typescript
// Not implemented, but recommended
class CourseErrorBoundary extends React.Component {
    componentDidCatch(error) {
        if (error.response?.status === 404) {
            return <NotFoundPage />;
        }
        return <ErrorPage />;
    }
}
```

---

## Accessibility Considerations

### Implemented

1. **Semantic HTML:**
   - `<nav>` for filters
   - `<main>` for content
   - `<article>` for course cards
   - `<button>` for actions

2. **Loading States:**
   - `aria-busy` on loading regions
   - Skeletons have `aria-hidden`

3. **Focus Management:**
   - Visible focus indicators
   - Logical tab order

### Not Implemented

1. **Screen Reader Announcements:**
```typescript
// Filter changes
announce(`Showing ${count} courses in ${category}`);

// New results loaded
announce(`Loaded ${newCount} more courses`);
```

2. **Keyboard Navigation:**
   - Arrow key navigation in grids
   - Escape to close filters

3. **Reduced Motion:**
```css
@media (prefers-reduced-motion: reduce) {
    .skeleton-pulse { animation: none; }
}
```

---

## SEO Considerations

### Current Limitations

1. **Client-Side Rendering:** Next.js App Router with "use client" on discovery components
2. **No SSR:** Courses not in initial HTML
3. **Meta Tags:** Static titles only

### Recommendations

1. **Server Components for List:**
```typescript
// page.tsx (Server Component)
export default async function CoursesPage({ searchParams }) {
    const courses = await fetchCourses(searchParams);
    return <CourseList initialData={courses} />;
}
```

2. **Dynamic Metadata:**
```typescript
export async function generateMetadata({ params }) {
    const course = await getCourse(params.id);
    return {
        title: course.title,
        description: course.description,
        openGraph: { images: [course.thumbnail] }
    };
}
```

3. **Structured Data:**
```json
{
    "@type": "Course",
    "name": "Python Bootcamp",
    "description": "...",
    "provider": { "@type": "Organization", "name": "LMS" }
}
```

---

## Files Organization

```
src/
├── app/
│   ├── (main)/
│   │   ├── page.tsx                    # Homepage
│   │   ├── courses/
│   │   │   ├── page.tsx               # Course listing
│   │   │   └── [id]/
│   │   │       └── page.tsx           # Course detail
│   │   └── layout.tsx                 # Main layout with NavBar
├── components/
│   ├── molecules/
│   │   ├── CourseCard.tsx             # Reusable course card
│   │   ├── CourseCardSkeleton.tsx     # Loading skeleton
│   │   ├── Filters.tsx                # Filter sidebar
│   │   ├── HomeRadioGroup.tsx         # Category tabs
│   │   └── SearchAndSort.tsx          # Search + sort bar
│   └── organisms/
│       ├── Hero.tsx                   # Homepage hero
│       ├── NavBar.tsx                 # Navigation
│       ├── Footer.tsx                 # Footer
│       └── ServicesSection.tsx        # Platform features
└── featuers/courses/
    ├── components/
    │   ├── courses/
    │   │   └── CoursesCards.tsx       # Course grid
    │   ├── CourseDetailPage/
    │   │   └── courseid/
    │   │       ├── CourseDetailPage.tsx
    │   │       ├── CourseHero.tsx
    │   │       ├── CourseGoals.tsx
    │   │       ├── CourseSections.tsx
    │   │       ├── CourseInstructor.tsx
    │   │       ├── CourseEnrollCard.tsx
    │   │       └── CourseFeedback.tsx
    │   └── HomePageCoursesSection.tsx
    ├── hooks/
    │   ├── usePaginatedCourses.tsx
    │   ├── useCourse.tsx
    │   └── useCourseStats.tsx
    └── types/
        └── course.types.ts
```

---

## Testing Strategy

### Unit Tests

```typescript
// CourseCard.test.tsx
describe('CourseCard', () => {
    it('renders course information', () => {
        render(<CourseCard {...mockCourse} />);
        expect(screen.getByText('Python Bootcamp')).toBeVisible();
    });
});

// useCourseStats.test.tsx
describe('useCourseStats', () => {
    it('calculates total duration', () => {
        const { result } = renderHook(() => useCourseStats(sections));
        expect(result.current.totalDuration).toBe('12h 30m');
    });
});
```

### Integration Tests

```typescript
// CoursesPage.test.tsx
describe('CoursesPage', () => {
    it('fetches and displays courses', async () => {
        render(<CoursesPage />);
        await waitFor(() => {
            expect(screen.getAllByTestId('course-card')).toHaveLength(3);
        });
    });
    
    it('applies filters', async () => {
        render(<CoursesPage />);
        fireEvent.click(screen.getByLabelText('Development'));
        await waitFor(() => {
            expect(mockedAxios.get).toHaveBeenCalledWith(
                expect.stringContaining('category=development')
            );
        });
    });
});
```

### E2E Tests (Playwright)

```typescript
// courses.spec.ts
test('user can browse and view course', async ({ page }) => {
    await page.goto('/courses');
    await expect(page.getByText('Explore Courses')).toBeVisible();
    
    // Apply filter
    await page.click('text=Development');
    await expect(page.locator('.course-card')).toHaveCount(3);
    
    // Navigate to detail
    await page.click('.course-card:first-child');
    await expect(page.url()).toContain('/courses/');
});
```

---

## Future Enhancements

1. **Real-time Updates:**
   - WebSocket for course updates
   - "New course added" toast

2. **Personalization:**
   - Recommended courses based on history
   - "Continue where you left off"

3. **Advanced Search:**
   - Elasticsearch integration
   - Faceted search
   - Autocomplete

4. **Social Features:**
   - Course reviews
   - Instructor following
   - Learning paths
