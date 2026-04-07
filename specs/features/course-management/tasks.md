# Course Management - Tasks

## Status: BACKEND COMPLETE / FRONTEND PARTIAL

---

## Backend Tasks

### Models & Database
- [x] Course model with all metadata fields
- [x] Section model with ordering
- [x] Lecture model with video_url and duration
- [x] Quiz model (one per section)
- [x] Question model with ordering
- [x] Choice model with is_correct flag
- [x] Database migrations
- [x] Database constraints (unique_together for ordering)

### Admin APIs (Full CRUD)
- [x] Admin Course ViewSet (list, create, retrieve, update, delete)
- [x] Admin Section ViewSet
- [x] Admin Lecture ViewSet
- [x] Admin Quiz ViewSet
- [x] Permission checks (isAdmin)

### Instructor APIs (Own Content CRUD)
- [x] Instructor Course ViewSet with ownership filtering
- [x] Instructor Section ViewSet with course ownership check
- [x] Instructor Lecture ViewSet with section ownership check
- [x] Instructor Quiz ViewSet with section ownership check
- [x] Auto-assign instructor on create
- [x] ValidationError on unauthorized access

### Student APIs (Read-Only)
- [x] Student Course List with filters
- [x] Student Course Detail with enrollment status
- [x] Student Homepage endpoint (featured courses)
- [x] Student Section ViewSet
- [x] Student Lecture ViewSet
- [x] Student Quiz ViewSet

### Serializers
- [x] CourseSerializer with nested sections
- [x] SectionSerializer with nested lectures/quiz
- [x] LectureSerializer
- [x] QuizSerializer
- [x] Nested serialization via to_representation
- [x] Instructor profile serialization

### Filtering & Pagination
- [x] CourseCursorPagination implementation
- [x] Dynamic sorting (newest/popular/system)
- [x] Category filter (multiple values)
- [x] Level filter
- [x] Price range filter (min_price/max_price)
- [x] Rating filter
- [x] Search filter (title, description, instructor)

### Permissions
- [x] isAdmin permission class
- [x] isInstructor permission class
- [x] CookieJWTAuthentication on all endpoints
- [x] Ownership validation in perform_create
- [x] Ownership validation in get_queryset

---

## Frontend Tasks

### Discovery/Read Views (Complete)
- [x] CourseCard component
- [x] CourseCardSkeleton loading state
- [x] CoursesCards grid component
- [x] Course detail page layout
- [x] CourseHero component (header with metadata)
- [x] CourseGoals component (learning objectives)
- [x] CourseSections component (curriculum accordion)
- [x] CourseInstructor component (instructor bio)
- [x] CourseEnrollCard component (CTA card)
- [x] CourseFeedback component (ratings)
- [x] HomePageCoursesSection (homepage featured)
- [x] Course listing page with filters
- [x] Search and sort functionality
- [x] Filters sidebar component
- [x] Pagination with cursor

### Management/CRUD Views (Missing)
- [ ] Instructor dashboard page
- [ ] Course creation form
- [ ] Course edit form
- [ ] Section creation/editing UI
- [ ] Lecture upload interface
- [ ] Quiz creation interface
- [ ] Question/choice builder
- [ ] Course publish/unpublish toggle
- [ ] Thumbnail upload component
- [ ] Video URL input (temporary until upload)

### Hooks
- [x] usePaginatedCourses hook (infinite query)
- [x] useCourse hook (single course)
- [x] useCourseStats hook (duration calculations)
- [ ] useCreateCourse hook
- [ ] useUpdateCourse hook
- [ ] useDeleteCourse hook
- [ ] useCreateSection hook
- [ ] useUpdateSection hook
- [ ] useCreateLecture hook
- [ ] useCreateQuiz hook

### API Layer
- [x] coursesAPI.getCourses (paginated)
- [x] coursesAPI.getCourse (single)
- [ ] coursesAPI.createCourse
- [ ] coursesAPI.updateCourse
- [ ] coursesAPI.deleteCourse
- [ ] coursesAPI.createSection
- [ ] coursesAPI.updateSection
- [ ] coursesAPI.deleteSection
- [ ] coursesAPI.createLecture
- [ ] coursesAPI.updateLecture
- [ ] coursesAPI.deleteLecture
- [ ] coursesAPI.createQuiz
- [ ] coursesAPI.updateQuiz
- [ ] coursesAPI.deleteQuiz

### Types & Schemas
- [x] Course TypeScript interface
- [x] Section TypeScript interface
- [x] Lecture TypeScript interface
- [x] Quiz TypeScript interface
- [x] CourseFilterParams TypeScript interface
- [x] PaginatedResponse TypeScript interface
- [ ] CourseFormData schema (Zod)
- [ ] SectionFormData schema (Zod)
- [ ] LectureFormData schema (Zod)
- [ ] QuizFormData schema (Zod)

---

## Integration Tasks
- [x] Course discovery integration
- [x] Enrollment status check on course detail
- [x] Filter state management
- [x] URL sync with filter state (optional enhancement)
- [ ] Instructor dashboard integration
- [ ] Course creation flow
- [ ] Content editing flow

---

## Known Issues / Limitations

### Incomplete Items
- [ ] No instructor-facing UI (only APIs exist)
- [ ] No direct video upload (URLs only)
- [ ] No drag-and-drop reordering
- [ ] No rich text editor for descriptions
- [ ] No content preview before publish

### Technical Debt
- [ ] Console.log in CourseSections component
- [ ] Video URL field length very large (255555) - Cloudinary URLs not that long
- [ ] CourseSerializer returns all sections on list (could be heavy)
- [ ] No caching on course queries

---

## Testing Considerations
- [ ] Unit tests for model constraints
- [ ] Unit tests for serializer validation
- [ ] API tests for CRUD operations
- [ ] API tests for permission checks
- [ ] Frontend component tests
- [ ] E2E tests for course discovery
- [ ] E2E tests for instructor workflows

---

## Performance Notes

### Current Implementation
- List view: Cursor pagination with configurable page_size
- Detail view: Full nested serialization (all sections/lectures/quizzes)
- No selective field serialization
- No query optimization hints

### Potential Improvements
- [ ] Implement field-level serialization (only send needed fields)
- [ ] Add database indexes on frequently filtered fields (category, level)
- [ ] Cache course detail views
- [ ] Lazy load section content on scroll
- [ ] Image optimization via Cloudinary transformations

---

## Content Moderation Considerations

### Not Implemented
- [ ] Content approval workflow
- [ ] Automatic content scanning
- [ ] Instructor verification before publishing
- [ ] Report inappropriate content
- [ ] Admin review queue

### Current Approach
- Instructors can publish immediately
- Admins can unpublish via admin interface
- No content validation beyond required fields
