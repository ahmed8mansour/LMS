# Course Management - Architecture Plan

## Architecture Overview

The Course Management system follows a **hierarchical content model** (Course → Section → Lecture/Quiz → Question → Choice) with **strict ownership-based access control**. The architecture prioritizes data integrity through database constraints and cascading relationships.

---

## Key Architectural Decisions

### 1. Hierarchical Content Structure

**Decision:** 5-level hierarchy: Course → Section → (Lecture | Quiz → Question → Choice)

**Rationale:**
- Mirrors how educational content is naturally organized
- Sequential learning progression (complete lectures, then quiz)
- Clear parent-child relationships for cascade operations

**Trade-offs:**
- Deep nesting makes some queries complex
- Deleting a course cascade-deletes everything (risky)
- Flattening for search/display requires serialization overhead

**Implementation:**
```python
# Course (root)
#   └── Section (ordered)
#         ├── Lecture (ordered)
#         └── Quiz (one per section)
#               └── Question (ordered)
#                     └── Choice (multiple)
```

### 2. Role-Based ViewSets

**Decision:** Separate ViewSets for Admin, Instructor, and Student roles

**Rationale:**
- Clear separation of concerns
- Different permissions and querysets for each role
- Student views optimized for reading with filtering

**Implementation Pattern:**
```python
# Pattern: {Role}{Entity}ViewSet
class InstructorCourseViewSet(ModelViewSet):
    def get_queryset(self):
        # Only own courses
        return Course.objects.filter(instructor=self.request.user.instructor_profile)
    
    def perform_create(self, serializer):
        # Auto-assign ownership
        serializer.save(instructor=self.request.user.instructor_profile)
```

**Benefits:**
- No `if/else` permission logic in views
- Clean queryset filtering
- Django Admin-style CRUD for instructors

### 3. Nested Serialization Strategy

**Decision:** Use `to_representation` for nested data instead of nested serializers

**Rationale:**
- Control exactly what gets serialized
- Can conditionally include/exclude fields
- Better performance for read-heavy operations

**Implementation:**
```python
class SectionSerializer(serializers.ModelSerializer):
    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['lectures'] = LectureSerializer(
            Lecture.objects.filter(section=instance), many=True
        ).data
        data['quiz'] = QuizSerializer(
            Quiz.objects.filter(section=instance).first()
        ).data
        return data
```

**Trade-offs:**
- N+1 query risk (use `prefetch_related` carefully)
- Harder to optimize than flat serializers
- Tight coupling between serializers

### 4. Cursor-Based Pagination

**Decision:** Cursor pagination for course listing instead of offset pagination

**Rationale:**
- Consistent performance with large datasets
- No duplicate/missed items during concurrent modifications
- Natural fit for "infinite scroll" UI

**Implementation:**
```python
class CourseCursorPagination(CursorPagination):
    page_size = 1  # Configurable via ?page_size=
    ordering = ('-created_at',)
```

**Limitations:**
- Cannot jump to arbitrary page
- Only works with single-field ordering
- Sorting limited to indexed fields

### 5. Flat URL Structure with Role Prefixes

**Decision:** `/courses/{role}/courses/` pattern for all CRUD

**Rationale:**
- RESTful resource naming
- Clear role separation in URL
- Same endpoint structure for all roles

**Examples:**
```
GET /courses/admin/courses/        # Admin: all courses
GET /courses/instructor/courses/   # Instructor: own courses
GET /courses/student/courses/      # Student: published courses
```

### 6. Image Upload to Cloudinary

**Decision:** Store media on Cloudinary via Django storage backend

**Rationale:**
- CDN for fast image delivery
- Automatic image transformations
- No local filesystem storage concerns

**Configuration:**
```python
DEFAULT_FILE_STORAGE = 'cloudinary_storage.storage.MediaCloudinaryStorage'
```

**Current Limitation:** Video upload via URL only (no direct upload)

---

## Data Flow Architecture

### Course Creation (Instructor)

```
Instructor
    │
    ├── 1. Create Course ────────────> POST /instructor/courses/
    │                                   Auto-assign instructor
    │                                   Set is_published=False
    │<────────── Return: Course ID ────│
    │
    ├── 2. Create Section ───────────> POST /instructor/sections/
    │                                   Validate course ownership
    │                                   Set order
    │<────────── Return: Section ID ────│
    │
    ├── 3. Upload Thumbnail ─────────> Cloudinary (external)
    │                                   Get URL
    │
    ├── 4. Add Lectures ─────────────> POST /instructor/lectures/
    │                                   Validate section ownership
    │                                   Provide video_url
    │                                   Set duration
    │
    └── 5. Add Quiz ─────────────────> POST /instructor/quizzes/
                                        Validate section ownership
                                        Add questions and choices
```

### Course Discovery (Student)

```
Student
    │
    ├── Browse Courses ──────────────> GET /student/courses/
    │                                   [?category=X]&[?level=Y]
    │                                   [&search=keyword]
    │<────────── Return: Paginated ─────│
    │
    ├── View Course Detail ──────────> GET /student/courses/{id}/
    │                                   Include enrollment_status
    │                                   Nested: sections
    │                                     └─ lectures
    │                                     └─ quiz
    │<────────── Return: Full detail ──│
    │
    └── Homepage ────────────────────> GET /student/homepage/
                                        Return featured/popular
```

---

## Scalability Considerations

### Current Limitations

1. **Course Detail Serialization**: Returns ALL sections/lectures/quizzes
   - Course with 50 sections = massive JSON payload
   - No pagination of nested content

2. **Image Handling**: Original uploads, no automatic resizing
   - Thumbnails may be large files
   - No WebP conversion

3. **No Caching**: Every request hits database
   - Course lists don't change often
   - Calculated fields (subscribers_count) queried each time

4. **Search Performance**: Database text search only
   - No full-text search index
   - No stemming or fuzzy matching

### Future Improvements

1. **Lazy Loading for Course Content:**
   ```
   GET /student/courses/{id}/sections/  # Just section headers
   GET /student/sections/{id}/         # Section with lectures
   ```

2. **CDN Image Optimization:**
   ```html
   <!-- Use Cloudinary transformations -->
   <img src="https://.../w_300,h_200,c_scale/course.jpg" />
   ```

3. **Redis Caching:**
   ```python
   @cache_page(60 * 15)  # Cache for 15 minutes
   def list(self, request):
       # Course list
   ```

4. **Elasticsearch for Search:**
   - Full-text search with stemming
   - Faceted filtering
   - Typo tolerance

---

## Content Integrity

### Database Constraints

```python
# Prevent duplicate ordering
class Meta:
    unique_together = ['course', 'order']  # For Section
    unique_together = ['section', 'order']  # For Lecture

# One quiz per section
class Quiz:
    section = models.OneToOneField(Section, ...)
```

### Cascade Behavior

```
DELETE Course:
    └── CASCADE Section
          ├── CASCADE Lecture
          └── CASCADE Quiz
                └── CASCADE Question
                      └── CASCADE Choice
```

**Warning:** Deleting a course is PERMANENT. Consider soft delete:
```python
# Soft delete alternative
is_deleted = models.BooleanField(default=False)
```

### Validation Strategy

1. **Instructor Ownership**: Checked in `get_queryset()` and `perform_create()`
2. **Required Fields**: Enforced at model and serializer level
3. **Price Validation**: Decimal validation (max 9999.99)
4. **Order Uniqueness**: Database constraint + serializer validation

---

## API Design Patterns

### Nested Resource URLs

Following REST conventions:

```
/courses/student/courses/          # List all courses
/courses/student/courses/{id}/     # Get specific course
/courses/student/sections/         # List sections (if needed)
/courses/student/sections/{id}/    # Get specific section
```

### Serializer Depth Control

Current: Full nesting (Course → Section → Lecture → Quiz → Question)

Alternative for performance:

```python
# Shallow serialization for lists
class CourseListSerializer(serializers.ModelSerializer):
    class Meta:
        fields = ['id', 'title', 'thumbnail', 'price']  # No nesting

# Deep serialization for detail
class CourseDetailSerializer(serializers.ModelSerializer):
    sections = SectionSerializer(many=True)
```

### Filtering Strategy

Query params for flexible filtering:

```python
def get_queryset(self):
    queryset = Course.objects.all()
    
    # Multiple categories
    categories = self.request.query_params.getlist('category')
    if categories:
        queryset = queryset.filter(category__in=categories)
    
    # Range filters
    min_price = self.request.query_params.get('min_price')
    if min_price:
        queryset = queryset.filter(price__gte=min_price)
    
    # Search
    search = self.request.query_params.get('search')
    if search:
        queryset = queryset.filter(title__icontains=search)
    
    return queryset
```

---

## Security Considerations

### Content Access Control

| Role | List | Retrieve | Create | Update | Delete |
|------|------|----------|--------|--------|--------|
| Student | Published only | Published only | ❌ | ❌ | ❌ |
| Instructor | Own courses | Own courses | Own courses | Own courses | Own courses |
| Admin | All | All | All | All | All |

### Validation Points

1. **Instructor Assignment**: Auto-assigned on create
2. **Ownership Check**: `if course.instructor != request.user.instructor_profile`
3. **Section Ownership**: Check course.instructor on section create
4. **Lecture Ownership**: Check section.course.instructor on lecture create

### Media Security

- Cloudinary URLs are signed (tamper-proof)
- No direct file upload to Django
- Video URLs validated as URLs (not local paths)

---

## Frontend Integration

### Component Architecture

```
CourseDetailPage
├── CourseHero (header with thumbnail/title)
├── CourseGoals (learning objectives)
├── CourseSections (curriculum accordion)
│     └── For each Section:
│           ├── LectureList
│           └── QuizCard
├── CourseInstructor (instructor bio)
└── CourseEnrollCard (sticky CTA)
```

### Data Fetching Pattern

```typescript
// List with infinite scroll
const { data, fetchNextPage } = useInfiniteQuery({
    queryKey: ['courses', filters],
    queryFn: ({ pageParam }) => getCourses({ ...filters, cursor: pageParam }),
    getNextPageParam: (last) => last.next ? extractCursor(last.next) : null,
});

// Detail with enrollment status
const { data: course } = useQuery({
    queryKey: ['course', id],
    queryFn: () => getCourse(id),  // Includes enrolled_status
});
```

---

## Deployment Considerations

### Media Storage

**Production Requirements:**
- Cloudinary account with appropriate plan
- Environment variables:
  ```bash
  CLOUDINARY_CLOUD_NAME=
  CLOUDINARY_API_KEY=
  CLOUDINARY_API_SECRET=
  ```

**Backup Strategy:**
- Cloudinary provides backups
- Consider local backup of critical course content

### Database Indexes

Add indexes for performance:

```python
class Course(models.Model):
    class Meta:
        indexes = [
            models.Index(fields=['category', 'is_published']),
            models.Index(fields=['level', 'is_published']),
            models.Index(fields=['created_at']),  # For cursor pagination
        ]
```

---

## Files Organization

### Backend
```
apps/course/
├── models.py          # All 6 models
├── serializers.py     # Nested serializers
├── views.py           # 12 ViewSets (4 roles × 3 entities)
├── urls.py            # Router registration
├── permissions.py     # isAdmin, isInstructor
├── pagination.py      # CourseCursorPagination
└── admin.py           # Admin configuration
```

### Frontend
```
featuers/courses/
├── api/
│   └── course.api.ts        # Read-only APIs
├── components/
│   ├── CourseDetailPage/
│   │   └── courseid/
│   │       ├── CourseDetailPage.tsx
│   │       ├── CourseHero.tsx
│   │       ├── CourseGoals.tsx
│   │       ├── CourseSections.tsx
│   │       ├── CourseInstructor.tsx
│   │       ├── CourseEnrollCard.tsx
│   │       └── CourseFeedback.tsx
│   ├── courses/
│   │   └── CoursesCards.tsx
│   └── HomePageCoursesSection.tsx
├── hooks/
│   ├── usePaginatedCourses.tsx
│   ├── useCourse.tsx
│   └── useCourseStats.tsx
├── types/
│   └── course.types.ts
└── index.ts
```

---

## Alternative Approaches Considered

### 1. Separate Instructor Dashboard App
**Rejected:** Increases complexity, current monolithic approach sufficient

### 2. Soft Delete for Content
**Rejected:** Not implemented yet, but recommended for production

### 3. GraphQL Instead of REST
**Rejected:** REST sufficient, GraphQL adds complexity

### 4. Separate Read/Write Models
**Rejected:** CQRS overkill for current scale

---

## Maintenance Notes

### Regular Tasks
- Monitor Cloudinary bandwidth usage
- Clean up orphaned media (if any)
- Review and optimize slow queries
- Update course popularity metrics

### Migration Considerations
- Adding new fields is safe
- Removing fields requires care (check serializers)
- Splitting models requires data migration
