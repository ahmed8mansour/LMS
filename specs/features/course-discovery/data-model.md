# Course Discovery - Data Model

## Overview

Course Discovery is a **read-only frontend feature** that consumes data from the Course Management system. This document describes the data structures used for displaying courses to students.

---

## Entity Relationship

```
┌────────────────────────────────────────────────────────────────┐
│                     COURSE DISCOVERY                           │
│                     (Read-Only Views)                          │
└────────────────────────────────────────────────────────────────┘

┌──────────────────┐
│     Course       │──────────┐
├──────────────────┤          │
│ id               │          │
│ title            │          │
│ description      │          │
│ thumbnail        │          │
│ price            │          │
│ rating           │          │
│ subscribers_count│          │
│ category         │          │
│ level            │          │
│ goals_list[]     │          │
│ last_updated     │          │
│ language         │          │
│ instructor       │──────────┼─────▶ InstructorProfile
│ sections[]       │──────────┘       - first_name
│   - title        │                  - profile_picture
│   - lectures[]   │                  - specific_data.title
│   - quiz         │                  - specific_data.about
│ enrolled_status  │
└──────────────────┘

(Fields shown are those used in discovery UI)
```

---

## Data Entities Consumed

Course Discovery consumes the following entities from Course Management:

### Primary Entity: Course (Discovery View)

Fields used for discovery and display:

| Field | Type | Used In | Description |
|-------|------|---------|-------------|
| id | integer | All views | Course identifier |
| title | string | Card, Detail | Course name |
| description | string | Card, Detail | Short summary |
| thumbnail | URL | Card, Detail | Cover image |
| price | decimal | Card, Detail, Filter | Price in USD |
| rating | decimal | Card, Detail | Average rating |
| subscribers_count | integer | Card, Detail | Enrollment count |
| category | enum | Card, Detail, Filter | Course category |
| level | enum | Detail, Filter | Difficulty level |
| goals_list | string[] | Detail | Learning objectives |
| language | string | Detail | Course language |
| last_updated | datetime | Detail | Modification date |
| instructor_profile | object | Card, Detail | Nested instructor data |
| sections | Section[] | Detail | Full curriculum |
| enrolled_status | boolean | Detail | User enrollment (if authenticated) |

### Related Entity: Section (Detail View)

| Field | Type | Used In | Description |
|-------|------|---------|-------------|
| id | integer | Detail | Section identifier |
| title | string | Detail | Section name |
| order | integer | Detail | Display order |
| lectures | Lecture[] | Detail | Lectures in section |
| quiz | Quiz | Detail | Section quiz (optional) |

### Related Entity: Lecture (Detail View)

| Field | Type | Used In | Description |
|-------|------|---------|-------------|
| id | integer | Detail | Lecture identifier |
| title | string | Detail | Lecture name |
| duration | decimal | Detail | Length in minutes |
| order | integer | Detail | Display order |

### Related Entity: Quiz (Detail View)

| Field | Type | Used In | Description |
|-------|------|---------|-------------|
| id | integer | Detail | Quiz identifier |
| title | string | Detail | Quiz name |
| questions_count | integer | Detail | Number of questions |

### Related Entity: InstructorProfile (Card & Detail)

| Field | Type | Used In | Description |
|-------|------|---------|-------------|
| id | integer | Card, Detail | Instructor ID |
| first_name | string | Card, Detail | Display name |
| profile_picture | URL | Card, Detail | Avatar image |
| specific_data | object | Card, Detail | Title, about |

---

## API Response Structures

### Course List Response

```typescript
interface CourseListResponse {
    next: string | null;           // URL for next page
    previous: string | null;       // URL for previous page
    results: CourseSummary[];      // Array of course summaries
}

interface CourseSummary {
    id: number;
    title: string;
    description: string;
    thumbnail: string;
    price: string;                 // "49.99"
    rating: number;               // 4.5
    subscribers_count: number;
    category: 'development' | 'business' | 'design & UI/UX' | 'marketing';
    level: 'beginner' | 'intermediate' | 'advanced';
    language: string;
    last_updated: string;         // ISO 8601 date
    instructor_profile: {
        id: number;
        first_name: string;
        profile_picture: string;
        specific_data: {
            title: string;
            about: string;
        };
    };
}
```

### Course Detail Response

```typescript
interface CourseDetailResponse extends CourseSummary {
    reviews_count: number;
    is_published: boolean;
    goals_list: string[];          // ["Master Python", "Build projects"]
    enrolled_status?: boolean;      // Only if authenticated
    sections: SectionDetail[];
}

interface SectionDetail {
    id: number;
    title: string;
    order: number;
    lectures: LectureDetail[];
    quiz: QuizDetail | null;
}

interface LectureDetail {
    id: number;
    title: string;
    duration: string;              // "10.50"
    order: number;
}

interface QuizDetail {
    id: number;
    title: string;
    questions_count: number;
}
```

---

## Filtering & Sorting Parameters

### Query Parameters

| Parameter | Type | Used For | Example |
|-----------|------|----------|---------|
| category | string[] | Filter | `?category=development&category=business` |
| level | string | Filter | `?level=beginner` |
| min_price | decimal | Filter | `?min_price=10` |
| max_price | decimal | Filter | `?max_price=100` |
| rating | decimal | Filter | `?rating=4.0` |
| search | string | Search | `?search=python` |
| sort | enum | Sort | `?sort=popular` |
| cursor | string | Pagination | `?cursor=cD0y` |
| page_size | integer | Pagination | `?page_size=10` |

### Sort Options

| Value | Description | Backend Field |
|-------|-------------|-----------------|
| newest | Created date descending | `-created_at` |
| popular | Enrollment count descending | `-subscribers_count` |
| system | ID ascending | `id` |

---

## Derived Data (Frontend Calculations)

### Course Stats Calculation

```typescript
function calculateCourseStats(sections: Section[]): {
    totalDuration: string;
    totalLectures: number;
    totalSections: number;
} {
    let totalMinutes = 0;
    let lectureCount = 0;
    
    sections.forEach(section => {
        section.lectures.forEach(lecture => {
            totalMinutes += parseFloat(lecture.duration);
            lectureCount++;
        });
    });
    
    // Format: "12.5 hours" or "45 minutes"
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);
    const totalDuration = hours > 0 
        ? `${hours}.${Math.round(minutes/60*10)} hours` 
        : `${minutes} minutes`;
    
    return {
        totalDuration,
        totalLectures: lectureCount,
        totalSections: sections.length
    };
}
```

### Rating Display

```typescript
// Round rating to nearest integer for star display
const displayRating = Math.round(course.rating);

// Render stars
Array.from({ length: 5 }).map((_, i) => (
    <Star key={i} filled={i < displayRating} />
));
```

### Price Formatting

```typescript
const formatPrice = (price: string): string => {
    const num = parseFloat(price);
    return `$${num.toFixed(2)}`;
};

// "49.99" → "$49.99"
```

### Date Formatting

```typescript
const formatDate = (isoString: string): string => {
    const date = new Date(isoString);
    return `${date.getMonth() + 1}/${date.getFullYear()}`;
};

// "2025-03-15T10:30:00Z" → "3/2025"
```

---

## State Shapes (Frontend)

### React Query Cache Structure

```typescript
// Course list query
['courses', {
    category: ['development'],
    level: undefined,
    min_price: undefined,
    max_price: undefined,
    rating: undefined,
    search: '',
    sort: 'newest'
}]

// Result: InfiniteQueryData<CourseListResponse>
{
    pages: [
        { next: 'cursor1', previous: null, results: [CourseSummary, ...] },
        { next: 'cursor2', previous: 'cursor1', results: [CourseSummary, ...] }
    ],
    pageParams: ['', 'cursor1']
}

// Single course query
['course', '123']
// Result: CourseDetailResponse
```

### Component State

```typescript
// FilterSidebar state
interface FilterState {
    categories: string[];           // Selected categories
    level: string | undefined;      // Selected level
    minPrice: number | undefined;   // Min price
    maxPrice: number | undefined;   // Max price
    minRating: number | undefined;  // Min rating
}

// SearchAndSort state
interface SearchSortState {
    searchTerm: string;             // Debounced search
    sortBy: 'newest' | 'popular' | 'price_low' | 'price_high';
}

// Homepage state
interface HomepageState {
    selectedCategory: string;       // 'all Categories' | category name
}
```

---

## Data Transformations

### API to UI Mapping

```typescript
// Raw API response → Component props
const mapCourseToCardProps = (course: CourseSummary) => ({
    id: course.id,
    ImageUrl: course.thumbnail,
    Name: course.title,
    About: course.description,
    Price: parseInt(course.price),  // "$49.99" → 49
    AvaterUrl: course.instructor_profile.profile_picture,
    Instructor: course.instructor_profile.first_name,
    Rate: course.rating,
    Subscribers: course.subscribers_count,
    Tag: course.category
});
```

### Filter Serialization

```typescript
// UI state → API params
const serializeFilters = (filters: FilterState): URLSearchParams => {
    const params = new URLSearchParams();
    
    filters.categories.forEach(cat => {
        params.append('category', cat);
    });
    
    if (filters.level) {
        params.set('level', filters.level);
    }
    
    if (filters.minPrice) {
        params.set('min_price', filters.minPrice.toString());
    }
    
    if (filters.maxPrice) {
        params.set('max_price', filters.maxPrice.toString());
    }
    
    if (filters.minRating) {
        params.set('rating', filters.minRating.toString());
    }
    
    return params;
};
```

---

## Caching Strategy

### Cache Keys

```typescript
// Course list with specific filters
['courses', { category: ['development'], sort: 'popular' }]

// Different filters = different cache entries
['courses', { category: ['business'], sort: 'popular' }]

// Single course
['course', '123']

// Homepage featured
['homepage', 'popular', 'development']
```

### Stale Time

```typescript
const STALE_TIME = 5 * 60 * 1000; // 5 minutes

// Rationale: Course data doesn't change frequently
// Trade-off: May show stale data briefly
```

### Cache Invalidation Scenarios

1. **After Enrollment:** Invalidate single course
   ```typescript
   queryClient.invalidateQueries(['course', courseId]);
   ```

2. **Filter Change:** Automatic (different query key)

3. **Window Focus:** Optional refetch (configurable)

---

## Data Integrity

### Frontend Validation

Before displaying data:

```typescript
// Validate course has required fields
const isValidCourse = (course: any): course is CourseSummary => {
    return (
        typeof course.id === 'number' &&
        typeof course.title === 'string' &&
        typeof course.price === 'string' &&
        course.instructor_profile !== undefined
    );
};

// Fallback for missing data
const getSafeCourse = (course: any): CourseSummary => ({
    ...course,
    thumbnail: course.thumbnail || '/placeholder-course.jpg',
    rating: course.rating || 0,
    subscribers_count: course.subscribers_count || 0
});
```

### Error Handling

```typescript
// API error → User-friendly message
const getErrorMessage = (error: any): string => {
    if (!error.response) {
        return "Can't connect to server";
    }
    if (error.response.status === 404) {
        return "Course not found";
    }
    return "Something went wrong";
};
```

---

## Performance Considerations

### Payload Sizes

| Endpoint | Typical Size | Notes |
|----------|--------------|-------|
| List (10 courses) | ~20KB | Summaries only |
| Detail (full course) | ~50-100KB | Includes all sections/lectures |
| Homepage (3 courses) | ~8KB | Minimal data |

### Optimization Strategies

1. **Pagination:** Limit 10-20 courses per request
2. **Image Optimization:** Cloudinary transforms
3. **Selective Fields:** Request only needed fields (future)
4. **Compression:** Gzip on API responses

---

## TypeScript Interfaces

```typescript
// Complete type definitions for Course Discovery

export interface CourseSummary {
    id: number;
    title: string;
    description: string;
    thumbnail: string;
    price: string;
    rating: number;
    subscribers_count: number;
    category: CourseCategory;
    level: CourseLevel;
    language: string;
    last_updated: string;
    instructor_profile: InstructorSummary;
}

export interface CourseDetail extends CourseSummary {
    reviews_count: number;
    is_published: boolean;
    goals_list: string[];
    enrolled_status?: boolean;
    sections: SectionDetail[];
}

export interface SectionDetail {
    id: number;
    title: string;
    order: number;
    lectures: LectureDetail[];
    quiz: QuizDetail | null;
}

export interface LectureDetail {
    id: number;
    title: string;
    duration: string;
    order: number;
}

export interface QuizDetail {
    id: number;
    title: string;
    questions_count: number;
}

export interface InstructorSummary {
    id: number;
    first_name: string;
    profile_picture: string;
    specific_data: {
        title: string;
        about: string;
    };
}

export type CourseCategory = 
    | 'development' 
    | 'business' 
    | 'design & UI/UX' 
    | 'marketing';

export type CourseLevel = 
    | 'beginner' 
    | 'intermediate' 
    | 'advanced';

export interface PaginatedResponse<T> {
    next: string | null;
    previous: string | null;
    results: T[];
}

export interface CourseFilterParams {
    search?: string;
    category?: string[];
    level?: string;
    min_price?: number;
    max_price?: number;
    rating?: number;
    sort?: 'newest' | 'popular' | 'system';
    cursor?: string;
    page_size?: string;
}
```

---

## Dependencies

### Data Sources
- Course Management API (`/courses/student/*` endpoints)
- Authentication API (for `enrolled_status`)

### Client Libraries
- `@tanstack/react-query` - Server state management
- `axios` - HTTP client

### No Direct Database Access
Course Discovery does not have its own database tables - it's purely a presentation layer consuming Course Management data.
