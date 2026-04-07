# Feature: Course Management

## Overview

The Course Management system provides full CRUD operations for courses, sections, lectures, and quizzes with role-based access control. Instructors manage their own content while admins have full oversight.

---

## What This Feature Does

1. **Course CRUD**: Create, read, update, delete courses with metadata (title, description, price, category, etc.)
2. **Section Management**: Organize courses into ordered sections (chapters/modules)
3. **Lecture Management**: Add video lectures with duration and ordering within sections
4. **Quiz Management**: Create assessments with multiple-choice questions at the end of sections
5. **Role-Based Access**: Students (read), Instructors (CRUD own), Admins (CRUD all)

---

## Backend Endpoints

### Admin Endpoints (Full CRUD)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/courses/admin/courses/` | GET | Admin | List all courses |
| `/courses/admin/courses/` | POST | Admin | Create course for any instructor |
| `/courses/admin/courses/{id}/` | GET | Admin | Retrieve any course |
| `/courses/admin/courses/{id}/` | PUT/PATCH | Admin | Update any course |
| `/courses/admin/courses/{id}/` | DELETE | Admin | Delete any course |
| `/courses/admin/sections/` | * | Admin | CRUD all sections |
| `/courses/admin/lectures/` | * | Admin | CRUD all lectures |
| `/courses/admin/quizzes/` | * | Admin | CRUD all quizzes |

### Instructor Endpoints (Own Content Only)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/courses/instructor/courses/` | GET | Instructor | List own courses |
| `/courses/instructor/courses/` | POST | Instructor | Create course (auto-assigned) |
| `/courses/instructor/courses/{id}/` | GET | Instructor | Retrieve own course |
| `/courses/instructor/courses/{id}/` | PUT/PATCH | Instructor | Update own course |
| `/courses/instructor/courses/{id}/` | DELETE | Instructor | Delete own course |
| `/courses/instructor/sections/` | * | Instructor | CRUD sections for own courses |
| `/courses/instructor/lectures/` | * | Instructor | CRUD lectures for own sections |
| `/courses/instructor/quizzes/` | * | Instructor | CRUD quizzes for own sections |

**Security Note:** Instructor endpoints verify ownership via `perform_create` and `get_queryset` overrides:
```python
def get_queryset(self):
    return Course.objects.filter(instructor=self.request.user.instructor_profile)

def perform_create(self, serializer):
    serializer.save(instructor=self.request.user.instructor_profile)
```

### Student Endpoints (Read-Only)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/courses/student/courses/` | GET | Student/Public | List courses with filters |
| `/courses/student/courses/{id}/` | GET | Student/Public | Retrieve course with enrollment status |
| `/courses/student/homepage/` | GET | Public | Homepage featured courses |
| `/courses/student/sections/{id}/` | GET | Student | View section (if enrolled) |
| `/courses/student/lectures/{id}/` | GET | Student | View lecture (if enrolled) |
| `/courses/student/quizzes/{id}/` | GET | Student | View quiz (if enrolled) |

---

## Data Models

### Course

| Field | Type | Description |
|-------|------|-------------|
| id | AutoField | Primary key |
| instructor | FK → InstructorProfile | Course creator |
| thumbnail | ImageField | Course cover (Cloudinary) |
| title | CharField(255) | Course name |
| description | CharField(255) | Short summary |
| price | Decimal(6,2) | Price in USD |
| rating | Decimal(6,1) | Average rating |
| subscribers_count | IntegerField | Enrollment count |
| reviews_count | IntegerField | Review count |
| is_published | BooleanField | Visibility status |
| last_updated | DateTimeField(auto_now) | Modification timestamp |
| created_at | DateTimeField(auto_now_add) | Creation timestamp |
| language | CharField(255) | Course language |
| category | CharField(choices) | development/business/design & UI/UX/marketing |
| level | CharField(choices) | beginner/intermediate/advanced |
| goals_list | JSONField | Learning objectives array |

**Categories:** development, business, design & UI/UX, marketing
**Levels:** beginner, intermediate, advanced

### Section

| Field | Type | Description |
|-------|------|-------------|
| id | AutoField | Primary key |
| course | FK → Course | Parent course |
| title | CharField(255) | Section name |
| order | IntegerField | Position in course |

**Constraints:** Unique together: (course, order)

### Lecture

| Field | Type | Description |
|-------|------|-------------|
| id | AutoField | Primary key |
| section | FK → Section | Parent section |
| title | CharField(255) | Lecture name |
| duration | Decimal(6,2) | Length in minutes |
| video_url | CharField(255555) | Video URL (Cloudinary) |
| order | IntegerField | Position in section |

**Constraints:** Unique together: (section, order)

### Quiz

| Field | Type | Description |
|-------|------|-------------|
| id | AutoField | Primary key |
| section | OneToOne → Section | Associated section |
| title | CharField(255) | Quiz name |
| questions_count | IntegerField | Number of questions |

**Note:** One quiz per section maximum.

### Question

| Field | Type | Description |
|-------|------|-------------|
| id | AutoField | Primary key |
| quiz | FK → Quiz | Parent quiz |
| text | TextField | Question content |
| order | IntegerField | Display order |

### Choice

| Field | Type | Description |
|-------|------|-------------|
| id | AutoField | Primary key |
| question | FK → Question | Parent question |
| text | TextField | Answer text |
| is_correct | BooleanField | Correctness flag |

---

## Frontend Components

### Course Discovery (Read-Only Views)

| Component | Location | Purpose |
|-----------|----------|---------|
| `CourseCard` | `components/molecules/CourseCard.tsx` | Card displaying course summary |
| `CourseSectionItem` | `components/molecules/CourseSectionItem.tsx` | Section preview in course detail |
| `CourseDetailPage` | `features/courses/components/.../CourseDetailPage.tsx` | Full course detail view |
| `CourseHero` | `features/courses/components/.../CourseHero.tsx` | Course header with metadata |
| `CourseGoals` | `features/courses/components/.../CourseGoals.tsx` | Learning objectives display |
| `CourseSections` | `features/courses/components/.../CourseSections.tsx` | Curriculum accordion |
| `CourseInstructor` | `features/courses/components/.../CourseInstructor.tsx` | Instructor bio card |
| `CourseEnrollCard` | `features/courses/components/.../CourseEnrollCard.tsx` | Enrollment CTA card |
| `CourseFeedback` | `features/courses/components/.../CourseFeedback.tsx` | Rating/reviews section |
| `CoursesCards` | `features/courses/components/courses/CoursesCards.tsx` | Grid of course cards |
| `HomePageCoursesSection` | `features/courses/components/HomePageCoursesSection.tsx` | Homepage featured courses |

### Hooks

| Hook | Purpose |
|------|---------|
| `usePaginatedCourses` | Fetch courses with filters/pagination |
| `useCourse` | Fetch single course by ID |
| `useCourseStats` | Calculate total duration/lecture count |

---

## Data Flow

### Course Creation (Instructor)

```
Instructor                    Backend
   |                              |
   |-- POST /instructor/courses/ ->|
   |   {title, description,     |
   |    price, category, etc.}    |
   |                              |
   |                          Auto-assign instructor
   |                              |
   |<-- Return: Course data ------|
   |                              |

   |-- POST /instructor/sections/ ->|
   |   {course_id, title, order}|
   |                              |
   |<-- Return: Section data ------|
   |                              |

   |-- POST /instructor/lectures/ ->|
   |   {section_id, title,      |
   |    video_url, duration,      |
   |    order}                    |
   |                              |
   |<-- Return: Lecture data -----|
   |                              |

   |-- POST /instructor/quizzes/ -->|
   |   {section_id, title,       |
   |    questions_count}         |
   |                              |
   |<-- Return: Quiz data --------|
```

### Course Retrieval (Student)

```
Student                       Backend
   |                              |
   |-- GET /student/courses/ ---->|
   |   [?category=development]   |
   |   [&level=beginner]         |
   |   [&search=python]          |
   |                              |
   |<-- Return: Paginated list ---|
   |   {next, previous,          |
   |    results: [Course]}        |
   |                              |

   |-- GET /student/courses/{id}/ ->|
   |                              |
   |<-- Return: Course detail ----|
   |   {id, title, sections: [  |
   |     {title, lectures: [],    |
   |      quiz: {...}}],          |
   |    enrolled_status: bool}   |
```

### Nested Serialization

Courses return fully nested data:

```json
{
  "id": 1,
  "title": "Complete Python Bootcamp",
  "instructor_profile": { ... },
  "sections": [
    {
      "id": 1,
      "title": "Introduction",
      "order": 1,
      "lectures": [
        {"id": 1, "title": "Welcome", "duration": "10.50", "order": 1}
      ],
      "quiz": {
        "id": 1,
        "title": "Introduction Quiz",
        "questions_count": 5
      }
    }
  ]
}
```

---

## Edge Cases Handled

### Ordering Constraints

1. **Section Order**: Must be unique per course
   - Validation at database level (unique_together)
   - Frontend handles reordering

2. **Lecture Order**: Must be unique per section
   - Same constraint pattern as sections

### Ownership Validation

1. **Instructor Create**: Auto-assigns `instructor=self.request.user.instructor_profile`
2. **Instructor Update**: Validates course belongs to current instructor
   ```python
   if course.instructor != self.request.user.instructor_profile:
       raise ValidationError("You don't have access to this Course")
   ```
3. **Instructor Delete**: Same ownership check

### Permission Cascade

Instructor permissions cascade through content hierarchy:
- Can CRUD own courses
- Can CRUD sections only for own courses
- Can CRUD lectures only for own sections
- Can CRUD quizzes only for own sections

### Content Visibility

1. **Unpublished Courses**: `is_published=False` courses not returned in student views
2. **Enrollment Status**: Student detail view includes `enrolled_status` boolean
3. **Access Control**: Students cannot access lectures/quizzes unless enrolled (enforced in Progress API)

### Media Handling

1. **Cloudinary Storage**: Thumbnails and videos stored on Cloudinary
2. **URL Persistence**: `video_url` stored as full URL
3. **Image Upload**: Handled via Django's ImageField with Cloudinary backend

---

## Pagination & Filtering

### Cursor-Based Pagination

```python
class CourseCursorPagination(CursorPagination):
    page_size = 1  # Configurable via query param
    ordering = ('-created_at',)
    
    def get_ordering(self, request, queryset, view):
        sort = request.query_params.get('sort', 'newest')
        allowed_orderings = {
            'newest': ('-created_at',),
            'popular': ('-subscribers_count',),
            'system': ('id',),
        }
        return allowed_orderings.get(sort, ('-created_at',))
```

### Available Filters

| Filter | Param | Type | Example |
|--------|-------|------|---------|
| Category | `category` | Multiple | `?category=development&category=business` |
| Level | `level` | Single | `?level=beginner` |
| Min Price | `min_price` | Decimal | `?min_price=10.00` |
| Max Price | `max_price` | Decimal | `?max_price=100.00` |
| Rating | `rating` | Decimal | `?rating=4.0` |
| Search | `search` | String | `?search=python` |
| Sort | `sort` | Enum | `?sort=popular` |

### Sorting Options

- `newest` (default): By `created_at` descending
- `popular`: By `subscribers_count` descending
- `system`: By `id` ascending

---

## Known Limitations / TODOs

1. **No Frontend for Instructors**: CRUD operations only available via API/admin
   - Missing: Course creation UI
   - Missing: Section/lecture/quiz editor
   - Missing: Content upload interface

2. **No Video Upload**: Currently stores external URLs only
   - No direct Cloudinary upload from frontend
   - Instructors must upload separately

3. **No Content Versioning**: Editing overwrites existing content
   - No draft/published states for individual items
   - No revision history

4. **No Prerequisite System**: Sections are sequential but no formal prerequisite chain

5. **No Content Scheduling**: `is_published` is binary, no publish_on date

6. **Limited Quiz Types**: Only multiple choice, no:
   - Multiple correct answers
   - Free text responses
   - Code execution

---

## Data Integrity

### Cascading Deletes

Deleting a course cascade deletes:
- All sections
- All lectures (via section)
- All quizzes (via section)
- All questions (via quiz)
- All choices (via question)

**Warning:** This is irreversible. Consider soft delete for production.

### Orphan Prevention

- Sections cannot exist without course
- Lectures cannot exist without section
- Quizzes cannot exist without section
- Questions cannot exist without quiz
- Choices cannot exist without question

---

## API Response Examples

### Course List Response

```json
{
  "next": "http://localhost:8000/courses/student/courses/?cursor=cD0y",
  "previous": null,
  "results": [
    {
      "id": 1,
      "title": "Python Bootcamp",
      "thumbnail": "https://...",
      "price": "49.99",
      "rating": 4.5,
      "subscribers_count": 1250,
      "category": "development",
      "level": "beginner",
      "instructor_profile": {
        "first_name": "John",
        "specific_data": {"title": "Senior Developer"}
      }
    }
  ]
}
```

### Course Detail Response

```json
{
  "id": 1,
  "title": "Python Bootcamp",
  "description": "Learn Python from scratch",
  "price": "49.99",
  "rating": 4.5,
  "subscribers_count": 1250,
  "reviews_count": 89,
  "is_published": true,
  "last_updated": "2025-03-15T10:30:00Z",
  "goals_list": ["Master Python basics", "Build real projects"],
  "instructor_profile": { /* full user data */ },
  "sections": [
    {
      "id": 1,
      "title": "Getting Started",
      "order": 1,
      "lectures": [
        {
          "id": 1,
          "title": "Course Introduction",
          "duration": "10.50",
          "video_url": "https://...",
          "order": 1
        }
      ],
      "quiz": {
        "id": 1,
        "title": "Getting Started Quiz",
        "questions_count": 5
      }
    }
  ],
  "enrolled_status": false
}
```

---

## Dependencies

### Backend
- `djangorestframework` - API framework
- `django-filter` - Filtering support
- `cloudinary` - Media storage

### Frontend
- `@tanstack/react-query` - Data fetching
- `axios` - HTTP client
- Tailwind CSS - Styling
