# LMS Code Conventions

This document catalogs the patterns, naming conventions, file structures, and approaches used throughout this codebase. Follow these conventions when adding new code.

---

## Table of Contents

1. [Naming Conventions](#naming-conventions)
2. [File Structure](#file-structure)
3. [Backend API Structure](#backend-api-structure)
4. [Frontend API Structure](#frontend-api-structure)
5. [Error Handling](#error-handling)
6. [State Management](#state-management)
7. [Component Patterns](#component-patterns)
8. [Styling Conventions](#styling-conventions)

---

## Naming Conventions

### Backend (Python/Django)

| Element                  | Convention                       | Example                                               |
| ------------------------ | -------------------------------- | ----------------------------------------------------- |
| **Classes**              | PascalCase, descriptive          | `CustomUser`, `InstructorProfile`, `CourseSerializer` |
| **Model Classes**        | PascalCase, singular noun        | `Course`, `Section`, `Lecture`                        |
| **Serializer Classes**   | PascalCase + "Serializer" suffix | `CourseSerializer`, `UserDataSerializer`              |
| **View Classes**         | PascalCase + "View" suffix       | `UserLoginView`, `StudentCourseViewSet`               |
| **Permission Classes**   | PascalCase + descriptive         | `isAdmin`, `isInstructor`                             |
| **Functions/Methods**    | snake_case                       | `get_queryset()`, `create_otp()`                      |
| **Variables**            | snake_case                       | `user_data`, `course_id`                              |
| **Fields (DB)**          | snake_case                       | `profile_picture`, `subscribers_count`                |
| **Files**                | snake_case                       | `models.py`, `serializers.py`                         |
| **URL Names**            | snake_case                       | `'user_login'`, `'create_intent'`                     |
| **Constants (settings)** | UPPER_CASE                       | `JWT_COOKIE_SETTINGS`, `OTP_EXPIRY_MINUTES`           |

### Frontend (TypeScript/React)

| Element             | Convention                   | Example                                 |
| ------------------- | ---------------------------- | --------------------------------------- |
| **Components**      | PascalCase                   | `LoginForm`, `CourseCard`, `UserAvatar` |
| **Component Files** | PascalCase for components    | `LoginForm.tsx`, `CourseCard.tsx`       |
| **Hook Files**      | camelCase with "use" prefix  | `useLogin.tsx`, `useCourse.tsx`         |
| **Hook Functions**  | camelCase with "use" prefix  | `useLogin()`, `usePaginatedCourses()`   |
| **Type/Interface**  | PascalCase                   | `Course`, `UserData`, `LoginFormData`   |
| **Variables**       | camelCase                    | `userData`, `courseId`, `isLoading`     |
| **Functions**       | camelCase                    | `handleSubmit()`, `getCourses()`        |
| **API Objects**     | camelCase + "API" suffix     | `authAPI`, `coursesAPI`                 |
| **Schema Objects**  | PascalCase + "Schema" suffix | `registerSchema`, `LoginSchema`         |
| **Store Files**     | camelCase + ".store.ts"      | `auth.store.ts`                         |
| **Store Hooks**     | camelCase + "use" + Store    | `useAuthStore`                          |

### File Naming Exceptions

- **shadcn/ui components** (in `atoms/`): Match component name exactly (lowercase): `button.tsx`, `input.tsx`, `avatar.tsx`
- **Feature index files**: Named `index.ts` (exports public API)
- **Page files**: Named `page.tsx` (Next.js App Router convention)
- **Layout files**: Named `layout.tsx`
- **Loading files**: Named `loading.tsx`

---

## File Structure

### Backend Structure

```
backend/apps/
├── {app_name}/              # e.g., authentication, course, enrollment, progress
│   ├── models.py            # All models for the app
│   ├── serializers.py       # DRF serializers
│   ├── views.py             # API views (APIView, ViewSet)
│   ├── urls.py              # URL routing
│   ├── permissions.py       # Custom DRF permissions (if needed)
│   ├── pagination.py        # Custom pagination (if needed)
│   ├── utils.py             # Helper functions
│   ├── signals.py           # Django signals (if needed)
│   ├── admin.py             # Django admin registration
│   ├── tests.py             # Unit tests
│   └── apps.py              # App config
```

### Frontend Structure

```
front-end/src/
├── app/                      # Next.js App Router
│   ├── layout.tsx           # Root layout with providers
│   ├── (main)/              # Route group with NavBar/Footer
│   │   ├── page.tsx         # Home page
│   │   ├── layout.tsx       # Main layout
│   │   └── courses/         # Courses routes
│   │       ├── page.tsx     # Courses list
│   │       └── [id]/        # Dynamic course detail
│   │           └── page.tsx
│   └── (auth)/              # Route group without NavBar
│       ├── (main)/          # Auth pages with shared layout
│       │   ├── login/
│       │   ├── register/
│       │   └── forget-password/
│       └── verifyotp/
│
├── components/
│   ├── atoms/               # Basic UI primitives
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   └── avatar.tsx
│   ├── molecules/           # Composite components
│   │   ├── CourseCard.tsx
│   │   ├── Filters.tsx
│   │   └── SearchAndSort.tsx
│   └── organisms/           # Complex sections
│       ├── NavBar.tsx
│       ├── Footer.tsx
│       └── Hero.tsx
│
├── featuers/               # Feature-based modules
│   ├── auth/
│   │   ├── api/
│   │   │   └── auth.api.ts       # API functions
│   │   ├── components/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── RegisterForm.tsx
│   │   │   └── froget-password/  # Nested components
│   │   ├── hooks/
│   │   │   ├── useLogin.tsx
│   │   │   ├── useRegister.tsx
│   │   │   └── forget-password/  # Nested hooks
│   │   ├── schemas/
│   │   │   └── auth.schma.ts     # Zod schemas
│   │   ├── types/
│   │   │   └── auth.types.ts     # TypeScript types
│   │   └── index.ts              # Public exports
│   └── courses/
│       └── ... (same structure)
│
├── lib/                    # Utilities
│   ├── axios.ts           # Axios instance + interceptors
│   ├── toast.tsx          # Toast utilities
│   └── queryProvider.tsx  # React Query setup
│
└── store/                  # Zustand stores
    └── auth.store.ts
```

### Import Path Aliases

| Alias | Path    |
| ----- | ------- |
| `@/*` | `src/*` |

---

## Backend API Structure

### View Patterns

The backend uses **three view patterns** based on use case:

#### 1. ModelViewSet (CRUD Resources)

For role-based CRUD operations on entities.

```python
# Pattern: {Role}{Entity}ViewSet
class AdminCourseViewSet(ModelViewSet):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    permission_classes = [IsAuthenticated, isAdmin]
    authentication_classes = [CookieJWTAuthentication]

class InstructorCourseViewSet(ModelViewSet):
    serializer_class = CourseSerializer
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, isInstructor]

    def get_queryset(self):
        # Filter to user's own resources
        return Course.objects.filter(instructor=self.request.user.instructor_profile)

    def perform_create(self, serializer):
        # Auto-assign ownership
        serializer.save(instructor=self.request.user.instructor_profile)
```

#### 2. ReadOnlyModelViewSet (Public/Student Views)

For read-only access with filtering.

```python
class StudentCourseViewSet(ReadOnlyModelViewSet):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['title', 'description', 'instructor__title']
    pagination_class = CourseCursorPagination
    authentication_classes = [CookieJWTAuthentication]

    def get_queryset(self):
        # Manual filtering
        queryset = Course.objects.all()
        categories = self.request.query_params.getlist('category')
        if categories:
            queryset = queryset.filter(category__in=categories)
        return queryset
```

#### 3. APIView (Custom Endpoints)

For complex operations, actions, or workflows.

```python
class CreatePaymentIntentView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CreatePaymentSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        # ... business logic
        return Response({'client_secret': intent.client_secret}, status=status.HTTP_200_OK)
```

### URL Patterns

```python
# apps/{app}/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register('admin/courses', AdminCourseViewSet, basename='admin_courses')
router.register('instructor/courses', InstructorCourseViewSet, basename='instructor_courses')
router.register('student/courses', StudentCourseViewSet, basename='student_courses')

urlpatterns = [
    path('', include(router.urls)),
    path('custom/endpoint/', CustomAPIView.as_view(), name='custom_name'),
]
```

### Serializer Patterns

#### ModelSerializer (Standard)

```python
class QuizSerializer(serializers.ModelSerializer):
    class Meta:
        model = Quiz
        fields = '__all__'
```

#### Nested Serialization with `to_representation`

```python
class SectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Section
        fields = '__all__'

    def to_representation(self, instance):
        # Add nested data
        lectures = Lecture.objects.filter(section=instance).order_by('order')
        quiz = Quiz.objects.filter(section=instance).first()

        section_data = super().to_representation(instance)
        section_data['lectures'] = LectureSerializer(lectures, many=True).data
        section_data['quiz'] = QuizSerializer(quiz).data if quiz else None
        return section_data
```

#### SerializerMethodField for Computed Data

```python
class CourseSerializer(serializers.ModelSerializer):
    instructor_profile = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = [..., 'instructor_profile']

    def get_instructor_profile(self, obj):
        try:
            instructor = obj.instructor.user
            return UserDataSerializer(instructor).data
        except CustomUser.DoesNotExist:
            return None
```

#### Validation in Serializers

```python
class UserResnedOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate(self, data):
        email = data.get('email')
        try:
            user = CustomUser.objects.get(email=email)
        except CustomUser.DoesNotExist:
            raise serializers.ValidationError({'error': 'User Not Found'})
        # ... more validation
        return data
```

### Permission Pattern

```python
from rest_framework.permissions import BasePermission

class isAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_superuser

class isInstructor(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_staff
```

### Authentication Pattern

Always use custom CookieJWTAuthentication for JWT in HttpOnly cookies:

```python
from apps.authentication.utils import CookieJWTAuthentication

class MyView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]
```

---

## Frontend API Structure

### API Layer Pattern

```typescript
// features/{feature}/api/{feature}.api.ts
import axios from "@/lib/axios";
import { TypeName } from "../types/{feature}.types";

async function functionName(requestBody: RequestType): Promise<ResponseType> {
  const { data } = await axios.post("/endpoint/path/", requestBody);
  return data;
}

async function functionWithParams(id: string): Promise<ResponseType> {
  const { data } = await axios.get(`endpoint/path/${id}/`);
  return data;
}

// Export as object
export const featureAPI = {
  functionName,
  functionWithParams,
  // ...
};
```

### React Query Hook Patterns

#### Mutation Hook (POST/PUT/DELETE)

```typescript
// features/{feature}/hooks/use{Action}.tsx
import { useMutation } from "@tanstack/react-query";
import { featureAPI } from "../api/feature.api";
import { toastsuccess, handleAuthError } from "@/lib/toast";

export function useAction() {
  return useMutation({
    mutationFn: featureAPI.apiFunction,
    onSuccess(data: any) {
      toastsuccess("Success Title", data.message);
    },
    onError(error: any) {
      handleAuthError(error, "Action Failed");
    },
  });
}
```

#### Query Hook (GET with params)

```typescript
// features/{feature}/hooks/use{Resource}.tsx
import { useQuery } from "@tanstack/react-query";
import { featureAPI } from "../api/feature.api";

export function useResource(id: string) {
  return useQuery({
    queryKey: ["resource", id],
    queryFn: () => featureAPI.getResource(id),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

#### Infinite Query Hook (Pagination)

```typescript
// features/{feature}/hooks/usePaginated{Resource}.tsx
import { useInfiniteQuery } from "@tanstack/react-query";
import { featureAPI } from "../api/feature.api";
import { FilterParams } from "../types/feature.types";

export function usePaginatedResources(params: FilterParams) {
  return useInfiniteQuery({
    queryKey: ["resources", params],
    queryFn: ({ pageParam }) =>
      featureAPI.getResources({ ...params, cursor: pageParam }),
    initialPageParam: "",
    getNextPageParam: (lastPage) => {
      if (!lastPage.next) return null;
      const cursor = new URL(lastPage.next).searchParams.get("cursor");
      return cursor;
    },
    staleTime: 5 * 60 * 1000,
  });
}
```

### Zod Schema Pattern

```typescript
// features/{feature}/schemas/{feature}.schma.ts
import { z } from "zod";

export const schemaName = z
  .object({
    field: z.string().min(3, "Error message"),
    email: z.string().email("Invalid email"),
    role: z.enum(["student", "instructor"]),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  });

// Export inferred type
export type SchemaFormData = z.infer<typeof schemaName>;
```

### Form Pattern with React Hook Form

```typescript
// In component
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SchemaName, SchemaFormData } from "../schemas/feature.schma";
import { useAction } from "../hooks/useAction";

export function FormComponent() {
    const { register, handleSubmit, formState: { errors } } =
        useForm<SchemaFormData>({ resolver: zodResolver(SchemaName) });

    const { mutate: actionName, isPending } = useAction();

    const onSubmit: SubmitHandler<SchemaFormData> = (data) => {
        actionName(data, {
            onSuccess() {
                router.replace("/next-page");
            },
            onError(error) {
                // Handle specific error
            },
        });
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)}>
            <input {...register('field')} />
            {errors.field && <span>{errors.field.message}</span>}
        </form>
    );
}
```

---

## Error Handling

### Backend Error Pattern

```python
from rest_framework import status
from rest_framework.response import Response

class MyView(APIView):
    def post(self, request):
        serializer = MySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                # ... database operations
                pass
        except SpecificException as e:
            return Response(
                {'error': 'Specific error message'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'error': 'Something went wrong'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response({'message': 'Success'}, status=status.HTTP_200_OK)
```

Error response format:

```json
{
  "error": "Error message string"
}
// OR for serializer errors:
{
  "field_name": ["Error message"]
}
```

### Frontend Error Pattern

#### Toast Utility

```typescript
// lib/toast.tsx
import { toast } from "sonner";

export const toastsuccess = (head: string, body: string) => {
    toast.success(head, {
        position: "top-right",
        description: body,
        icon: <FaCheckCircle className="h-5 w-5 text-green-500" />
    });
};

export const toasterror = (head: string, body: string) => {
    toast.error(head, {
        position: "top-right",
        description: body,
        icon: <MdError className="h-5 w-5 text-red-500" />
    });
};

export function handleAuthError(error: any, fallbackHead: string = 'Authentication Failed') {
    if (!error.response) {
        toasterror('Network Error', "Can't connect to server");
        return;
    }

    const message = error.response.data?.error || error.response.data?.detail || 'Something went wrong';
    const displayMessage = typeof message === 'string'
        ? message
        : Array.isArray(message)
            ? message.join('\n')
            : 'Something went wrong';

    toasterror(fallbackHead, displayMessage);
}
```

#### Axios Interceptor Pattern

```typescript
// lib/axios.ts
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (!error.response) return Promise.reject(error);
    if (error.response.status !== 401) return Promise.reject(error);

    // Prevent infinite loops
    if (originalRequest.url.includes("/auth/token/refresh/")) {
      return Promise.reject(error);
    }
    if (originalRequest._retry) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    // Token refresh logic with queue
    if (isRefreshing) {
      return new Promise((resolve) => {
        subscribeTokenRefresh(() => {
          resolve(axiosInstance(originalRequest));
        });
      });
    }

    isRefreshing = true;
    try {
      await axiosInstance.post("/auth/token/refresh/");
      isRefreshing = false;
      onRefreshed();
      return axiosInstance(originalRequest);
    } catch (refreshError) {
      isRefreshing = false;
      return Promise.reject(refreshError);
    }
  },
);
```

---

## State Management

### Zustand Store Pattern

```typescript
// store/{feature}.store.ts
import { create } from "zustand";

type StoreState = {
  // State
  fieldName: string | null;
  booleanFlag: boolean;

  // Actions
  setFieldName: (value: string | null) => void;
  setBooleanFlag: (value: boolean) => void;
};

export const useFeatureStore = create<StoreState>((set) => ({
  fieldName: null,
  booleanFlag: false,

  setFieldName: (fieldName) => {
    set({ fieldName, booleanFlag: true });
  },
  setBooleanFlag: (value) => set({ booleanFlag: value }),
}));
```

### Store Usage Pattern

```typescript
// In component
import { useAuthStore } from "@/store/auth.store";

export function Component() {
  const setPendingEmail = useAuthStore((store) => store.setPendingEmail);
  const pendingEmail = useAuthStore((store) => store.pendingEmail);

  // Or get all at once
  const { pendingEmail, setPendingEmail } = useAuthStore();
}
```

---

## Component Patterns

### Atomic Design Structure

| Level         | Location                | Responsibility       | Examples                        |
| ------------- | ----------------------- | -------------------- | ------------------------------- |
| **Atoms**     | `components/atoms/`     | Basic UI primitives  | `button.tsx`, `input.tsx`       |
| **Molecules** | `components/molecules/` | Composite components | `CourseCard.tsx`, `Filters.tsx` |
| **Organisms** | `components/organisms/` | Page sections        | `NavBar.tsx`, `Hero.tsx`        |

### Component File Pattern

```typescript
"use client"; // For client components

import { useState } from "react";
import { Component } from "@/components/atoms/component";

// Named export
export function ComponentName({ prop1, prop2 }: PropsType) {
    const { mutate, isPending } = useHook();

    return (
        <div className="tailwind-classes">
            {/* JSX */}
        </div>
    );
}
```

### Feature Component Pattern

```typescript
// features/{feature}/components/{Feature}{Component}.tsx
"use client";

import { useHook } from "../hooks/useHook";

interface ComponentProps {
    id: string;
}

export function FeatureComponent({ id }: ComponentProps) {
    const { data, isLoading } = useHook(id);

    if (isLoading) return <Skeleton />;

    return <div>{/* render */}</div>;
}
```

### Loading Pattern

```typescript
// Use loading.tsx for route-level loading
export default function Loading() {
    return (
        <div className="flex items-center justify-center flex-1">
            <BounceLoader />
        </div>
    );
}
```

---

## Styling Conventions

### Tailwind CSS Patterns

#### Custom Colors (via CSS Variables)

```css
/* globals.css */
@theme inline {
  --color-darktext: #0f172a;
  --color-graytext2: #64748b;
  --color-darkmint: #2b5869;
  --color-lightbg: #f8fafc;
  --color-darkbg: #f1f5f9;
}
```

#### Component Usage

```tsx
// Use custom colors via class names
<div className="text-darktext bg-lightbg">
  <button className="bg-darkmint text-white hover:bg-darkmint/90">
    Click me
  </button>
</div>
```

#### Responsive Pattern

```tsx
// Mobile-first approach
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
    {/* Content */}
</div>

<div className="w-full md:basis-5/13 xl:basis-3/13">
    {/* Responsive widths */}
</div>
```

#### Spacing Scale

Use Tailwind's default spacing (4px base):

- `gap-2` = 8px
- `gap-4` = 16px
- `gap-6` = 24px
- `gap-8` = 32px
- `p-6` = 24px padding
- `py-8` = 32px vertical padding

---

## Pagination Pattern (Cursor-Based)

### Backend

```python
class CourseCursorPagination(CursorPagination):
    page_size = 1
    page_size_query_param = 'page_size'
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

### Frontend

```typescript
const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
  queryKey: ["courses", filters],
  queryFn: ({ pageParam }) => api.getCourses({ ...filters, cursor: pageParam }),
  initialPageParam: "",
  getNextPageParam: (lastPage) => {
    if (!lastPage.next) return null;
    return new URL(lastPage.next).searchParams.get("cursor");
  },
});
```

---

## Summary Cheat Sheet

### When Adding a New Feature

1. **Backend**:
   - Add model to `apps/{feature}/models.py`
   - Create serializer in `serializers.py`
   - Create ViewSet in `views.py`
   - Register URLs in `urls.py`
   - Use `CookieJWTAuthentication` for protected routes

2. **Frontend**:
   - Add types to `features/{feature}/types/{feature}.types.ts`
   - Add Zod schemas to `schemas/{feature}.schma.ts`
   - Create API functions in `api/{feature}.api.ts`
   - Create hooks in `hooks/use{Action}.tsx`
   - Create components in `components/`
   - Export public API from `index.ts`

3. **Naming**:
   - Backend: `snake_case` for functions/variables, `PascalCase` for classes
   - Frontend: `camelCase` for functions/variables, `PascalCase` for components
   - Files: Match export name (or use `index.ts` for barrels)

4. **Error Handling**:
   - Backend: Return `{error: message}` with appropriate status codes
   - Frontend: Use `handleAuthError()` from toast utilities

---

## Role-Aware Routing & the Instructor Shell (spec 003)

Patterns introduced by `003-instructor-foundation` that later instructor specs (004–013) build on:

- **Routing role cookie**: on every authenticated response the backend `set_jwt_cookies()`
  (`backend/apps/authentication/utils.py`) also sets a **non-HttpOnly, non-sensitive** `role` cookie
  (`admin` if `is_superuser`, else `instructor` if `role == 'instructor'`, else `student`) via
  `set_role_cookie()`. `clear_jwt_cookies()` deletes it. The JWT stays HttpOnly; the `role` cookie is a
  UI hint only — **backend permissions remain the real gate**.
- **Client helpers**: `readRoutingRole()` and `roleHomePath()` in `front-end/src/lib/cookies.ts`.
  Use these for role-aware redirects; never as an authorization check.
- **Edge guard**: `front-end/src/proxy.ts` enforces the three-way branch (student / instructor / admin),
  allow-listing `/dashboard/learn` for instructors. See
  `specs/003-instructor-foundation/contracts/routing-contract.md`.
- **Instructor shell**: lives at `front-end/src/app/instructor/` (real segment, own `layout.tsx` +
  `components/organisms/InstructorSidebar.tsx`) — a sibling of the student `SideBar.tsx`, not a role
  branch. New instructor pages go under `app/instructor/<section>/page.tsx`.
- **Placeholders**: `components/molecules/ComingSoon.tsx` is the shared empty-state for not-yet-built
  instructor destinations. Replace a section's `ComingSoon` with its real UI when that spec lands.

---

## Course Publishing (spec 007)

Patterns introduced by `007-course-publishing` that later specs should reuse rather than reinvent:

- **Domain logic in a subpackage, views stay thin**: `backend/apps/course/publishing/` follows the same shape
  as `video/` and `enrollment/payments/` — `dto.py` (frozen dataclasses), `states.py`, `readiness.py`,
  `service.py`, and an `__init__.py` that is the only import surface. Views resolve, delegate, serialize.
- **Lifecycle state is derived, never stored**: `get_course_state(course)` maps `Course.is_published` to a
  `DraftState` / `PublishedState` object on every use. Never add a second field that restates the boolean.
  States own transitions only; the rules they consult (readiness) are passed in.
- **Computed verdicts, not stored flags**: readiness is recomputed from current content on every read. A
  stored "ready" flag goes stale the moment a video is removed.
- **Ownership through `@action`**: for an operation on one row a `ModelViewSet` already scopes, prefer
  `@action(detail=True, ...)` and `self.get_object()` over a standalone `APIView`. `get_object()` resolves
  inside `get_queryset()`, so another owner's id is a 404 before your code runs and the check cannot be
  forgotten. Keep `APIView` for endpoints with no owning row (webhooks) or cross-resource workflows
  (checkout). Note the route is generated by the router, so it will not appear in `urls.py`.
- **Per-action throttles**: `throttle_scope` cannot be passed to `@action` (it is not an `APIView`
  attribute) and must not be set at class level on a viewset (it would throttle every CRUD route). Branch
  in `get_throttles()` on `self.action` and fall through to `super().get_throttles()`.
- **Prefetch what a computed field reads**: a serializer field that walks relations must read them through
  the instance (`course.section_set.all()`), and the viewset's `get_queryset()` must prefetch those exact
  paths (share the tuple — `READINESS_PREFETCH`). A `Model.objects.filter(...)` inside a per-row computation
  bypasses the prefetch and turns a list endpoint into an N+1.
- **Refusals carry their reasons**: a refused state change returns `400 {"error": "...", "<detail>": [...]}`
  — the required `error` message plus an additive, machine-readable list with stable `code`s and target
  ids. Clients switch on `code`, never parse `message`.
- **Nest dependent queries under their parent key**: TanStack Query invalidates by prefix, so a query that
  must refresh whenever a course changes belongs under `['instructor', 'course', id, ...]` (as
  `useCourseReadiness` does). Existing mutations then refresh it for free.
- **Exhaustive code maps on the client**: when mapping a backend enum/code union to UI (routes, labels),
  use a string-literal union and a `switch` whose `default` assigns to `never`, so a new backend code
  without a client mapping is a `tsc` error rather than a silent gap (see `readinessHref`).
- **Running tests**: pass module labels — `manage.py test apps.course.tests_publishing` — not `apps.course`.
  `backend/apps/` has no `__init__.py`, so unittest discovery cannot resolve the package label.

---

## Instructor Dashboard (spec 008)

Patterns introduced by `008-instructor-dashboard` that later read-heavy specs (009 analytics, 010 roster,
013 earnings) should reuse:

- **Snapshot endpoints are all-or-nothing**: build the complete DTO first, then serialize inside the same
  `try` as the build. On any failure return one `500 {"error": ...}` and never a partial response
  (`InstructorDashboardView`).
- **Cross-course reads use an `APIView` that takes no ids**: when there is no single owning row, scope every
  query to `request.user.instructor_profile` inside a service that accepts only the profile. A missing
  profile is `403 {"error", "code": "no_instructor_profile"}`, not 401 (the caller is authenticated).
- **Denormalized counters count enrollments, not people**: `InstructorProfile.students_count` and
  `Course.subscribers_count` go up once per enrollment. For people, use
  `Enrollment ... Count('user', distinct=True)` with `is_active=True`.
- **One reverse-relation `Count` per query**: a second annotation joins another table and multiplies both.
  Split extra aggregates into their own `.aggregate()` queries.
- **Roll-ups reuse readiness blocker codes**: to find courses with failed videos, read the
  `lecture_video_failed` blockers on the 007 `ReadinessReport` rather than re-querying lectures. Readiness
  stays the one definition.
- **Pin the query count**: a service that loops over courses gets a test asserting the same query count for
  1 and 10 courses (`CaptureQueriesContext`).
- **Pages that depend on many mutations don't use invalidation**: use
  `staleTime: 0, gcTime: 0, refetchOnMount: 'always'` so each visit fetches fresh data, instead of adding the
  page's key to every mutation hook.
- **Parse snapshot responses with Zod in the API function**: a malformed payload throws and becomes the
  error state, rather than rendering missing numbers as `0` or an empty list as "all caught up". Infer the TS
  types from the schema.
- **Money on the wire is a 2-decimal string** (`"8940.00"`) plus a currency code; format it on the client
  with `Intl.NumberFormat`, in full, never compact.

---

## Instructor Analytics (spec 009)

Patterns introduced by `009-instructor-analytics` for period-parameterised reads:

- **Definitions live in pure modules**: `backend/apps/course/analytics/periods.py` and `metrics.py` import no
  ORM. `service.py` turns rows into plain shapes (`CourseShape`, `StudentCourseProgress`) and hands them
  over, so every rule gets a fast, database-free test. Rules that changed during clarification belong here,
  never inline in a view or a queryset.
- **One computation, two scopes**: `CourseAnalyticsService.build(courses, period, scope)` takes a *list* of
  courses. The per-course endpoint passes `[course]`, the aggregate passes every owned course. Pooling is
  then just summing, and the two views can't drift apart.
- **The cohort is a (student, course) pair**, not a student: a student who enrolled in one course this month
  and another last year contributes only the first to a 30-day period. Grouped rows are matched back to
  pairs in Python.
- **Join StudentProfile-keyed progress to CustomUser-keyed enrollments with `user__user_id`**:
  `Enrollment.user` is a `CustomUser` while `LectureProgress`/`QuizAttempt` point at `StudentProfile`. One
  lookup path, no per-student queries.
- **Group progress per section, not per lecture**: rows stay bounded by students × sections, and
  `unique_together (user, lecture)` makes `Count('id')` an exact completed-lecture count. Quiz attempts group
  per (student, quiz), so retakes collapse in the database.
- **Analytics completion is stricter than review eligibility**: every current lecture **and** every current
  quiz. Section completion reuses the student-side unlock rule, and a test asserts the two agree with
  `apps.progress.utils.is_section_unlocked`.
- **Strict API, forgiving UI**: an unknown `?days=` is `400 {"error", "code": "invalid_period"}`; the page
  silently falls back to 30 days. A typo can never look like real data.
- **Windows and buckets are UTC and day-aligned**: "Last 30 days" is the 30 UTC days ending today, so the
  chart has 30 comparable points and every viewer sees the same buckets.
- **The selected period lives in the page address** (`?days=`), set with `router.replace(..., { scroll: false })`
  so three clicks don't leave three history entries while refresh, Back and shared links keep it.
- **Charts are Recharts, confined to one module**: colours come from the Tailwind tokens via
  `var(--color-darkmint)` / `var(--color-graytext2)` (never a raw hex), every chart sits in a
  `ResponsiveContainer` with `accessibilityLayer`, and drop-off uses horizontal bars so long titles get a
  row each. A clickable bar always has a keyboard-reachable link beside it.
- **Percentages are computed on the client from the counts**, never from the rounded rate on the wire, so
  "71% · 36 of 51" can't disagree with itself. A rate with no denominator is `null` on the wire and a worded
  empty state in the UI — never `0%`.
