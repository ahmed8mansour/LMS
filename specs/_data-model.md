# LMS Data Model

## Entity Relationship Diagram

```
┌─────────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│   CustomUser    │────▶│   StudentProfile    │────▶│ Enrollment      │
└─────────────────┘     └─────────────────────┘     ├─────────────────┤
         │                                            │ course (FK)     │
         │                                            │ user (FK)       │
         ▼                                            │ order (FK)      │
┌─────────────────┐                                   │ is_active       │
│InstructorProfile│                                   │ enrolled_at     │
├─────────────────┤                                   └─────────────────┘
│ title           │                                            │
│ about           │                                            │
│ students_count  │                                            ▼
└─────────────────┘                                   ┌─────────────────┐
         │                                            │     Order       │
         │                                            ├─────────────────┤
         │                                            │ course (FK)     │
         ▼                                            │ user (FK)       │
┌─────────────────┐     ┌─────────────────┐           │ status          │
│     Course      │◀────│     Section     │           │ amount          │
├─────────────────┤     ├─────────────────┤           │ currency        │
│ instructor (FK) │     │ course (FK)     │           │ stripe_pi_id    │
│ thumbnail       │     │ title           │           └─────────────────┘
│ title           │     │ order           │                    │
│ description     │     └─────────────────┘                    │
│ price           │            │                              ▼
│ rating          │            ▼                     ┌─────────────────┐
│ subscribers_cnt │     ┌─────────────────┐         │   Transaction   │
│ category        │     │    Lecture      │         ├─────────────────┤
│ level           │     ├─────────────────┤         │ order (FK)      │
│ language        │     │ section (FK)    │         │ status          │
│ goals_list      │     │ title           │         │ amount          │
└─────────────────┘     │ duration        │         │ currency        │
         │              │ video_url       │         │ stripe_pi_id    │
         │              │ order           │         │ stripe_charge   │
         │              └─────────────────┘         │ stripe_receipt  │
         │                                             └─────────────────┘
         │
         │                              ┌─────────────────┐
         │                              │  LectureProgress│
         │                              ├─────────────────┤
         │                              │ user (FK)       │
         │                              │ lecture (FK)    │
         │                              │ is_completed    │
         │                              │ completed_at    │
         │                              └─────────────────┘
         │
         │                    ┌─────────────────┐
         │                    │      Quiz       │
         │                    ├─────────────────┤
         │                    │ section (1:1)   │
         │                    │ title           │
         │                    │ questions_count │
         │                    └─────────────────┘
         │                             │
         │                             ▼
         │                    ┌─────────────────┐
         │                    │    Question     │
         │                    ├─────────────────┤
         │                    │ quiz (FK)       │
         │                    │ text            │
         │                    │ order           │
         │                    └─────────────────┘
         │                             │
         │                             ▼
         │                    ┌─────────────────┐     ┌─────────────────┐
         │                    │     Choice      │     │   QuizAttempt   │
         │                    ├─────────────────┤     ├─────────────────┤
         │                    │ question (FK)   │     │ user (FK)       │
         │                    │ text            │     │ quiz (FK)       │
         │                    │ is_correct      │     │ score           │
         │                    └─────────────────┘     │ passed          │
         │                                            │ attempted_at    │
         │                                            └─────────────────┘
         │                                                   │
         │                                                   ▼
         │                                            ┌─────────────────┐
         │                                            │QuizAttemptAnswer│
         │                                            ├─────────────────┤
         │                                            │ attempt (FK)    │
         │                                            │ question (FK)   │
         │                                            │ selected_choice │
         │                                            │ is_correct      │
         │                                            └─────────────────┘

Additional Entities:
┌─────────────────────┐
│   PasswordResetToken│
├─────────────────────┤
│ user (FK)           │
│ token               │
│ created_at          │
│ expires_at          │
│ is_used             │
│ used_at             │
└─────────────────────┘

┌─────────────────────┐
│      EmailOTP       │
├─────────────────────┤
│ user (FK)           │
│ code                │
│ purpose             │
│ is_used             │
│ created_at          │
│ expires_at          │
└─────────────────────┘
```

---

## Entity Definitions

### Authentication Domain

#### CustomUser
Central user entity with role-based polymorphic profiles.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField | PK | Auto-generated primary key |
| password | CharField | max_length=128 | Django auth password hash |
| last_login | DateTime | nullable | Last successful login |
| profile_picture | ImageField | upload_to='LMS/PFP/' | Cloudinary stored avatar |
| username | CharField | unique, max_length=255 | Display name |
| first_name | CharField | max_length=255, blank | First name |
| last_name | CharField | max_length=255, blank | Last name |
| email | EmailField | unique | Login identifier (USERNAME_FIELD) |
| role | CharField | choices: student/instructor/admin | User role |
| is_active | BooleanField | default=False | Account active status |
| is_staff | BooleanField | default=False | Django admin access |
| is_superuser | BooleanField | default=False | Superuser status |
| is_email_verified | BooleanField | default=False | Email verification status |
| date_joined | DateTimeField | auto_now_add | Registration timestamp |

**Relationships:**
- `student_profile` → OneToOne → StudentProfile
- `instructor_profile` → OneToOne → InstructorProfile
- `admin_profile` → OneToOne → AdminProfile
- `password_reset_tokens` → ForeignKey → PasswordResetToken (reverse)
- `otp_codes` → ForeignKey → EmailOTP (reverse)

---

#### StudentProfile
Extended data for student users.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField | PK | Primary key |
| user | OneToOne | FK → CustomUser | Linked user account |

**Relationships:**
- `lectureprogress_set` → ForeignKey → LectureProgress (reverse)
- `quizattempt_set` → ForeignKey → QuizAttempt (reverse)

---

#### InstructorProfile
Extended data for instructor users.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField | PK | Primary key |
| user | OneToOne | FK → CustomUser | Linked user account |
| title | CharField | max_length=255, blank | Professional title |
| about | TextField | blank | Bio/description |
| students_count | IntegerField | default=0 | Total enrolled students |

**Relationships:**
- `course_set` → ForeignKey → Course (reverse)

---

#### AdminProfile
Extended data for admin users.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField | PK | Primary key |
| user | OneToOne | FK → CustomUser | Linked user account |

---

#### PasswordResetToken
Token for password reset flow via secure cookie.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField | PK | Primary key |
| user | ForeignKey | FK → CustomUser | User requesting reset |
| token | CharField | unique, max_length=64, db_index | Secure token |
| created_at | DateTimeField | auto_now_add | Creation timestamp |
| expires_at | DateTimeField | | Token expiration |
| is_used | BooleanField | default=False | Usage status |
| used_at | DateTimeField | nullable | When used |

**Constraints:**
- Auto-generated token via `secrets.token_urlsafe(32)`
- Auto-expires after PASSWORD_RESET_TOKEN_EXPIRY_MINUTES
- Multiple tokens for same user auto-invalidated

---

#### EmailOTP
6-digit OTP for email verification flows.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField | PK | Primary key |
| user | ForeignKey | FK → CustomUser | Recipient |
| code | CharField | max_length=6 | 6-digit numeric code |
| purpose | CharField | choices: registration/password_reset/forget_password/google_set_password | Flow context |
| is_used | BooleanField | default=False | Usage status |
| created_at | DateTimeField | auto_now_add | Creation timestamp |
| expires_at | DateTimeField | | Expiration timestamp |

**Constraints:**
- Auto-generated code via `random.choices(string.digits, k=6)`
- Auto-expires after OTP_EXPIRY_MINUTES
- Multiple OTPs for same user+purpose auto-invalidated

---

### Course Domain

#### Course
Core learning content container.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField | PK | Primary key |
| instructor | ForeignKey | FK → InstructorProfile | Course creator |
| thumbnail | ImageField | upload_to='LMS/courses/thumbnail' | Course cover image |
| title | CharField | max_length=255 | Course name |
| description | CharField | max_length=255 | Short summary |
| price | DecimalField | decimal_places=2, max_digits=6 | Price in USD |
| rating | DecimalField | decimal_places=1, max_digits=6 | Average rating |
| subscribers_count | IntegerField | | Total enrollments |
| reviews_count | IntegerField | | Number of reviews |
| is_published | BooleanField | | Visibility status |
| last_updated | DateTimeField | auto_now | Last modification |
| created_at | DateTimeField | auto_now_add, db_index | Creation timestamp |
| language | CharField | max_length=255, blank | Course language |
| category | CharField | choices: development/business/design & UI/UX/marketing | Content category |
| level | CharField | choices: beginner/intermediate/advanced | Difficulty |
| goals_list | JSONField | default=list, blank | Learning objectives |

**Relationships:**
- `section_set` → ForeignKey → Section (reverse, ordered by 'order')

**Meta:**
- Ordering: ['-created_at', 'id']

---

#### Section
Course chapter/module container.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField | PK | Primary key |
| course | ForeignKey | FK → Course | Parent course |
| title | CharField | max_length=255 | Section name |
| order | IntegerField | | Position in course |

**Constraints:**
- Unique together: (course, order)

**Relationships:**
- `lectures` → ForeignKey → Lecture (reverse, ordered by 'order')
- `quiz` → OneToOne → Quiz (reverse)

**Meta:**
- Ordering: ['order']

---

#### Lecture
Video content unit.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField | PK | Primary key |
| section | ForeignKey | FK → Section, related_name='lectures' | Parent section |
| title | CharField | max_length=255 | Lecture name |
| duration | DecimalField | max_digits=6, decimal_places=2 | Length in minutes |
| video_url | CharField | max_length=255555 | Video URL (Cloudinary) |
| order | IntegerField | | Position in section |

**Constraints:**
- Unique together: (section, order)

**Relationships:**
- `lectureprogress_set` → ForeignKey → LectureProgress (reverse)

**Meta:**
- Ordering: ['order']

---

#### Quiz
Assessment at end of each section.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField | PK | Primary key |
| section | OneToOne | FK → Section, related_name='quiz' | Associated section |
| title | CharField | max_length=255 | Quiz name |
| questions_count | IntegerField | | Number of questions |

**Relationships:**
- `question` → ForeignKey → Question (reverse)
- `quizattempt` → ForeignKey → QuizAttempt (reverse)

---

#### Question
Individual quiz question.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField | PK | Primary key |
| quiz | ForeignKey | FK → Quiz, related_name='question' | Parent quiz |
| text | TextField | blank | Question content |
| order | IntegerField | | Display order |

**Relationships:**
- `choice` → ForeignKey → Choice (reverse)

---

#### Choice
Multiple choice answer option.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField | PK | Primary key |
| question | ForeignKey | FK → Question, related_name='choice' | Parent question |
| text | TextField | blank | Answer text |
| is_correct | BooleanField | | Correctness flag |

---

### Enrollment Domain

#### Order
Purchase record for course enrollment.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField | PK | Primary key |
| course | ForeignKey | FK → Course | Purchased course |
| user | ForeignKey | FK → CustomUser | Purchasing user |
| status | CharField | choices: pending/failed/paid/refunded | Payment status |
| amount | DecimalField | max_digits=6, decimal_places=2 | Purchase amount |
| currency | CharField | choices: USD | Currency code |
| stripe_payment_intent_id | TextField | non-null | Stripe PaymentIntent ID |

**Relationships:**
- `transaction_set` → ForeignKey → Transaction (reverse)
- One-to-One with Enrollment (via order FK)

---

#### Transaction
Stripe payment record.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField | PK | Primary key |
| order | ForeignKey | FK → Order | Associated order |
| status | CharField | choices: pending/failed/paid/refunded | Transaction status |
| amount | DecimalField | max_digits=6, decimal_places=2 | Transaction amount |
| currency | CharField | choices: usd/USD | Currency |
| stripe_payment_intent_id | TextField | non-null | Stripe PI ID |
| stripe_charge_id | TextField | non-null | Stripe Charge ID |
| stripe_receipt_id | TextField | non-null | Stripe Receipt ID |

---

#### Enrollment
Student-course access grant.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField | PK | Primary key |
| course | ForeignKey | FK → Course | Enrolled course |
| user | ForeignKey | FK → CustomUser | Student |
| order | ForeignKey | FK → Order | Purchase record |
| is_active | BooleanField | | Enrollment status |
| enrolled_at | DateTimeField | auto_now_add | Enrollment timestamp |

---

### Progress Domain

#### LectureProgress
Tracks lecture completion status.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField | PK | Primary key |
| user | ForeignKey | FK → StudentProfile | Student |
| lecture | ForeignKey | FK → Lecture | Completed lecture |
| is_completed | BooleanField | default=False | Completion status |
| completed_at | DateTimeField | auto_now_add, nullable | Completion timestamp |

**Constraints:**
- Unique together: (user, lecture)

---

#### QuizAttempt
Records quiz submission and scoring.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField | PK | Primary key |
| user | ForeignKey | FK → StudentProfile | Student |
| quiz | ForeignKey | FK → Quiz, related_name='quizattempt' | Attempted quiz |
| score | DecimalField | max_digits=5, decimal_places=2 | Percentage score |
| passed | BooleanField | default=False | Pass/fail status |
| attempted_at | DateTimeField | auto_now_add | Attempt timestamp |

**Relationships:**
- `quizattemptanswer` → ForeignKey → QuizAttemptAnswer (reverse)

---

#### QuizAttemptAnswer
Individual question response.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField | PK | Primary key |
| attempt | ForeignKey | FK → QuizAttempt, related_name='quizattemptanswer' | Parent attempt |
| question | ForeignKey | FK → Question | Question answered |
| selected_choice | ForeignKey | FK → Choice | Student's answer |
| is_correct | BooleanField | | Grading result |

---

## TypeScript Interface Schemas

### Frontend TypeScript Interfaces

```typescript
// User & Profile Types
interface CustomUser {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  role: 'student' | 'instructor' | 'admin';
  profile_picture: string;
  is_email_verified: boolean;
  is_active: boolean;
}

interface InstructorProfile extends CustomUser {
  specific_data: {
    title: string;
    about: string;
  };
}

// Course Types
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
  enrolled_status?: boolean;  // Only for authenticated users
}

interface Section {
  id: number;
  title: string;
  order: number;
  course: number;  // FK
  lectures: Lecture[];
  quiz?: Quiz;
}

interface Lecture {
  id: number;
  title: string;
  duration: string;  // Decimal serialized
  video_url: string;
  order: number;
  section: number;  // FK
}

interface Quiz {
  id: number;
  title: string;
  questions_count: number;
  section: number;  // FK
  questions?: Question[];  // Populated when taking quiz
}

interface Question {
  id: number;
  text: string;
  order: number;
  quiz: number;  // FK
  choices: Choice[];
}

interface Choice {
  id: number;
  text: string;
  is_correct?: boolean;  // Only revealed after passing
}

// Pagination & Filters
interface PaginatedResponse<T> {
  next: string | null;
  previous: string | null;
  results: T[];
}

interface CourseFilterParams {
  search?: string;
  category?: string[];
  level?: string;
  min_price?: number;
  max_price?: number;
  rating?: number;
  sort?: 'popular' | 'newest' | 'price_low' | 'price_high';
  cursor?: string;
  page_size?: string;
}
```

---

## Key Constraints & Business Rules

### Uniqueness Constraints
| Entity | Unique Fields | Purpose |
|--------|---------------|---------|
| CustomUser | email, username | Login identifiers |
| PasswordResetToken | token | Token lookup |
| Section | (course, order) | Ordered sections |
| Lecture | (section, order) | Ordered lectures |
| LectureProgress | (user, lecture) | One completion per lecture |

### Ordering
| Entity | Ordering Field(s) | Direction |
|--------|-------------------|-------------|
| Course | created_at, id | Descending, Ascending |
| Section | order | Ascending |
| Lecture | order | Ascending |
| PasswordResetToken | created_at | Descending |
| EmailOTP | created_at | Descending |

### Business Logic Rules

1. **Sequential Learning**
   - Students must complete all lectures in a section before taking the quiz
   - Sections may be unlocked sequentially or independently (depends on UI)

2. **Quiz Rules**
   - Pass threshold: 50% (configurable in settings.QUIZ_PASS_THRESHOLD)
   - Cannot retake after passing
   - Can view correct answers after passing
   - Must answer all questions

3. **Payment Flow**
   - Order created with "pending" status
   - Stripe webhook updates to "paid" on success
   - Enrollment created automatically on payment success

4. **Progress Tracking**
   - LectureProgress marks individual lecture completion
   - Course progress % = completed_lectures / total_lectures

5. **Role-Based Access**
   - Instructors can only CRUD their own courses/sections/lectures/quizzes
   - Admins can CRUD everything
   - Students read-only on published content

---

## Database Indexes

| Entity | Field | Type | Purpose |
|--------|-------|------|---------|
| Course | created_at | db_index | Cursor pagination |
| CustomUser | email | unique index | Login lookups |
| CustomUser | username | unique index | Display name uniqueness |
| PasswordResetToken | token | db_index, unique | Fast token validation |

---

## Media Storage

| Entity | Field | Storage | URL Pattern |
|--------|-------|---------|---------------|
| CustomUser | profile_picture | Cloudinary | `LMS/PFP/` |
| Course | thumbnail | Cloudinary | `LMS/courses/thumbnail` |
| Lecture | video_url | External (stored as URL) | Full URL in field |

---

## Cascade Behavior

| Parent | Child | Behavior |
|--------|-------|----------|
| CustomUser | StudentProfile | CASCADE |
| CustomUser | InstructorProfile | CASCADE |
| CustomUser | AdminProfile | CASCADE |
| CustomUser | PasswordResetToken | CASCADE |
| CustomUser | EmailOTP | CASCADE |
| CustomUser | Order | CASCADE |
| CustomUser | Enrollment | CASCADE |
| Course | Section | CASCADE |
| Course | Order | CASCADE |
| Section | Lecture | CASCADE |
| Section | Quiz | CASCADE |
| Quiz | Question | CASCADE |
| Question | Choice | CASCADE |
| Order | Transaction | CASCADE |
| Order | Enrollment | PROTECTED (via Order FK) |
| StudentProfile | LectureProgress | CASCADE |
| StudentProfile | QuizAttempt | CASCADE |
| Lecture | LectureProgress | CASCADE |
| Quiz | QuizAttempt | CASCADE |
| Question | QuizAttemptAnswer | CASCADE |
| Choice | QuizAttemptAnswer | CASCADE |
