# Course Management - Data Model

This document describes all database entities owned by the Course Management feature.

---

## Entity Relationship Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           COURSE MANAGEMENT                                 │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐
│     Course       │
├──────────────────┤
│ id (PK)          │
│ instructor (FK)───┐
│ thumbnail        │ │
│ title            │ │
│ description      │ │
│ price            │ │
│ rating           │ │
│ subscribers_count│ │
│ reviews_count    │ │
│ is_published     │ │
│ last_updated     │ │
│ created_at       │ │
│ language         │ │
│ category         │ │
│ level            │ │
│ goals_list       │ │
└────────┬─────────┘ │
         │            │
         │ ForeignKey │
         │            │
    ┌────┴────┐       │
    │ Section │       │
    ├─────────┤       │
    │id (PK)  │       │
    │course───┼───────┘
    │title    │
    │order    │
    └────┬────┘
         │
         │ ForeignKey
         │
    ┌────┴────────┐
    │   Lecture   │
    ├─────────────┤
    │ id (PK)     │
    │ section     │
    │ title       │
    │ duration    │
    │ video_url   │
    │ order       │
    └─────────────┘

    ┌───────────────┐
    │     Quiz      │      ┌──────────┐     ┌──────────┐
    ├───────────────┤      │ Question │────▶│  Choice  │
    │ id (PK)       │      ├──────────┤     ├──────────┤
    │ section (1:1)─┼──────│ id (PK)  │     │ id (PK)  │
    │ title         │      │ quiz     │     │ question │
    │ questions_count│     │ text     │     │ text     │
    └───────────────┘      │ order    │     │is_correct│
                           └──────────┘     └──────────┘


RELATIONSHIPS TO OTHER FEATURES:

Course ────────────> Enrollment (enrollment)
Course ────────────> Order (purchases)

InstructorProfile ───> Course (created courses)
                     (via Authentication System)
```

---

## Entities Owned by Course Management

### 1. Course

Root entity representing a complete educational offering.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField | PK | Auto-generated primary key |
| instructor | ForeignKey | FK → InstructorProfile | Course creator |
| thumbnail | ImageField | upload_to='LMS/courses/thumbnail' | Cover image on Cloudinary |
| title | CharField | max_length=255 | Course name |
| description | CharField | max_length=255 | Short summary |
| price | DecimalField | decimal_places=2, max_digits=6 | Price in USD (max $9999.99) |
| rating | DecimalField | decimal_places=1, max_digits=6 | Average rating (1 decimal) |
| subscribers_count | IntegerField | | Total enrollments |
| reviews_count | IntegerField | | Number of reviews |
| is_published | BooleanField | | Visibility status |
| last_updated | DateTimeField | auto_now | Last modification timestamp |
| created_at | DateTimeField | auto_now_add, db_index | Creation timestamp |
| language | CharField | max_length=255, blank | Course language |
| category | CharField | max_length=255, choices | Content category |
| level | CharField | max_length=255, choices | Difficulty level |
| goals_list | JSONField | default=list, blank | Learning objectives array |

**Category Choices:**
- `development`
- `business`
- `design & UI/UX`
- `marketing`

**Level Choices:**
- `beginner`
- `intermediate`
- `advanced`

**Constraints:**
- Course title not unique (instructors can use same titles)
- Price limited to 4 digits before decimal
- Rating stored with 1 decimal precision

**Indexes:**
- `created_at`: Used for cursor pagination

**Relationships:**
- ForeignKey → InstructorProfile (many courses per instructor)
- ForeignKey (reverse) → Section (`section_set`)
- ForeignKey (reverse, other features) → Enrollment, Order

**Meta:**
```python
class Meta:
    ordering = ['-created_at', 'id']  # Newest first
```

---

### 2. Section

Course chapter or module containing lectures and optionally a quiz.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField | PK | Primary key |
| course | ForeignKey | FK → Course | Parent course |
| title | CharField | max_length=255 | Section name |
| order | IntegerField | | Position in course |

**Constraints:**
- Unique together: (course, order) - prevents duplicate ordering

**Relationships:**
- ForeignKey → Course
- ForeignKey (reverse) → Lecture (`lectures` related_name)
- OneToOne (reverse) → Quiz (`quiz` related_name)

**Meta:**
```python
class Meta:
    unique_together = ['course', 'order']
    ordering = ['order']  # Sequential display
```

---

### 3. Lecture

Video content unit within a section.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField | PK | Primary key |
| section | ForeignKey | FK → Section, related_name='lectures' | Parent section |
| title | CharField | max_length=255 | Lecture name |
| duration | DecimalField | max_digits=6, decimal_places=2 | Length in minutes |
| video_url | CharField | max_length=255555 | Video URL (Cloudinary/external) |
| order | IntegerField | | Position in section |

**Constraints:**
- Unique together: (section, order)

**Relationships:**
- ForeignKey → Section
- ForeignKey (reverse, other features) → LectureProgress

**Meta:**
```python
class Meta:
    unique_together = ['section', 'order']
    ordering = ['order']
```

**Note:** The `video_url` field has an unusually large max_length (255555) to accommodate Cloudinary URLs with transformations.

---

### 4. Quiz

Assessment at the end of each section.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField | PK | Primary key |
| section | OneToOne | FK → Section, related_name='quiz' | Associated section |
| title | CharField | max_length=255 | Quiz name |
| questions_count | IntegerField | | Number of questions |

**Constraints:**
- One quiz per section maximum (OneToOne)

**Relationships:**
- OneToOne → Section
- ForeignKey (reverse) → Question (`question` related_name)
- ForeignKey (reverse, other features) → QuizAttempt

---

### 5. Question

Individual quiz question with multiple choices.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField | PK | Primary key |
| quiz | ForeignKey | FK → Quiz, related_name='question' | Parent quiz |
| text | TextField | blank | Question content |
| order | IntegerField | | Display order |

**Relationships:**
- ForeignKey → Quiz
- ForeignKey (reverse) → Choice (`choice` related_name)
- ForeignKey (reverse, other features) → QuizAttemptAnswer

---

### 6. Choice

Multiple choice answer option for a question.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField | PK | Primary key |
| question | ForeignKey | FK → Question, related_name='choice' | Parent question |
| text | TextField | blank | Answer text |
| is_correct | BooleanField | | Whether this choice is correct |

**Relationships:**
- ForeignKey → Question
- ForeignKey (reverse, other features) → QuizAttemptAnswer (as selected_choice)

**Note:** Only one choice per question should have `is_correct=True`, though this is not enforced at database level.

---

## Cascade Behavior

### Deletion Rules

```
Course.delete()
    └── CASCADE Section.delete()
          ├── CASCADE Lecture.delete()
          └── CASCADE Quiz.delete()
                └── CASCADE Question.delete()
                      └── CASCADE Choice.delete()
```

**Implication:** Deleting a course permanently removes ALL associated content. This is intentional for content management but risky.

**Recommendation for Production:**
Consider implementing soft delete:

```python
# Soft delete pattern (not currently implemented)
is_deleted = models.BooleanField(default=False)
deleted_at = models.DateTimeField(null=True, blank=True)

objects = ActiveCourseManager()  # Filters is_deleted=False
all_objects = models.Manager()   # Includes deleted
```

---

## Relationships to Other Features

### Authentication System
- **InstructorProfile → Course**: Instructor creates courses
- Instructor ownership enforced via `instructor` field

### Enrollment & Payments
- **Course → Order**: Orders reference courses
- **Course → Enrollment**: Enrollments link users to courses
- **Course.subscribers_count**: Denormalized count of enrollments

### Progress Tracking
- **Lecture → LectureProgress**: Progress tracked per lecture
- **Quiz → QuizAttempt**: Attempts tracked per quiz
- **Question/Choice → QuizAttemptAnswer**: Answers recorded

---

## Data Integrity Rules

### Ordering Constraints

1. **Section Order**: Must be unique within course
2. **Lecture Order**: Must be unique within section
3. **Question Order**: No unique constraint (recommend adding)

### Content Rules

1. **One Quiz Per Section**: Enforced by OneToOne relationship
2. **At Least One Choice**: Not enforced (recommend validation)
3. **Exactly One Correct Answer**: Not enforced (recommend validation)
4. **Published Visibility**: Only `is_published=True` shown to students

### Validation Recommendations

```python
# Quiz validation (serializer level)
def validate(self, data):
    questions = data.get('questions', [])
    if len(questions) == 0:
        raise ValidationError('Quiz must have at least one question')
    
    for question in questions:
        choices = question.get('choices', [])
        correct_count = sum(1 for c in choices if c.get('is_correct'))
        if correct_count != 1:
            raise ValidationError('Each question must have exactly one correct answer')
```

---

## Indexes Summary

| Entity | Field(s) | Type | Purpose |
|--------|----------|------|---------|
| Course | created_at | B-tree | Cursor pagination ordering |
| Section | (course, order) | Unique | Prevent duplicate ordering |
| Lecture | (section, order) | Unique | Prevent duplicate ordering |

### Recommended Additional Indexes

```python
# For filtering performance
class Course(models.Model):
    class Meta:
        indexes = [
            models.Index(fields=['category', 'is_published']),
            models.Index(fields=['level', 'is_published']),
            models.Index(fields=['price']),
            models.Index(fields=['rating']),
        ]
```

---

## TypeScript Interfaces

```typescript
// Course
interface Course {
    id: number;
    title: string;
    description: string;
    thumbnail: string;
    category: 'development' | 'business' | 'design & UI/UX' | 'marketing';
    level: 'beginner' | 'intermediate' | 'advanced';
    price: string;  // Decimal serialized as string
    language: string;
    rating: number;
    subscribers_count: number;
    reviews_count: number;
    is_published: boolean;
    last_updated: string;  // ISO date
    goals_list: string[];
    instructor_profile: InstructorProfile;
    sections: Section[];
    enrolled_status?: boolean;  // Only for authenticated
}

// Section
interface Section {
    id: number;
    title: string;
    order: number;
    course: number;  // FK
    lectures: Lecture[];
    quiz?: Quiz;
}

// Lecture
interface Lecture {
    id: number;
    title: string;
    duration: string;  // Decimal serialized
    video_url: string;
    order: number;
    section: number;  // FK
}

// Quiz
interface Quiz {
    id: number;
    title: string;
    questions_count: number;
    section: number;  // FK
    questions?: Question[];  // Populated when taking
}

// Question
interface Question {
    id: number;
    text: string;
    order: number;
    quiz: number;  // FK
    choices: Choice[];
}

// Choice
interface Choice {
    id: number;
    text: string;
    is_correct?: boolean;  // Only revealed after passing
}
```

---

## Media Storage

### Cloudinary Configuration

```python
# settings.py
CLOUDINARY_STORAGE = {
    'CLOUD_NAME': env('CLOUDINARY_CLOUD_NAME'),
    'API_KEY': env('CLOUDINARY_API_KEY'),
    'API_SECRET': env('CLOUDINARY_API_SECRET'),
}

DEFAULT_FILE_STORAGE = 'cloudinary_storage.storage.MediaCloudinaryStorage'
```

### Upload Paths

| Entity | Field | Upload Path | Example URL |
|--------|-------|-------------|-------------|
| Course | thumbnail | `LMS/courses/thumbnail` | `https://res.cloudinary.com/.../course_123.jpg` |

### Video URLs

- Currently stored as external URLs
- No direct upload to Cloudinary
- Recommend implementing direct upload for better UX

---

## Query Patterns

### Course Detail (with nesting)

```python
# Efficient query with prefetching
course = Course.objects.prefetch_related(
    'section_set__lectures',
    'section_set__quiz__question__choice'
).get(id=course_id)
```

### Course List with Filters

```python
# Filtered query
queryset = Course.objects.filter(
    is_published=True,
    category__in=['development', 'business'],
    price__gte=10,
    price__lte=100
).order_by('-created_at')
```

### Instructor's Courses

```python
# Ownership filtering
courses = Course.objects.filter(
    instructor=user.instructor_profile
).order_by('-created_at')
```

---

## Data Migration Considerations

### Safe Operations
- Add nullable fields
- Add new choice options to category/level
- Increase max_length

### Breaking Changes (Require Care)
- Remove fields (check serializers)
- Change field types
- Add non-nullable fields without default
- Remove choice options

### Sample Migration: Add Soft Delete

```python
# migrations/00XX_course_add_soft_delete.py
from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [...]
    
    operations = [
        migrations.AddField(
            model_name='course',
            name='is_deleted',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='course',
            name='deleted_at',
            field=models.DateTimeField(null=True, blank=True),
        ),
    ]
```
