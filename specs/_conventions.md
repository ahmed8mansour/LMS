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

| Element | Convention | Example |
|---------|------------|---------|
| **Classes** | PascalCase, descriptive | `CustomUser`, `InstructorProfile`, `CourseSerializer` |
| **Model Classes** | PascalCase, singular noun | `Course`, `Section`, `Lecture` |
| **Serializer Classes** | PascalCase + "Serializer" suffix | `CourseSerializer`, `UserDataSerializer` |
| **View Classes** | PascalCase + "View" suffix | `UserLoginView`, `StudentCourseViewSet` |
| **Permission Classes** | PascalCase + descriptive | `isAdmin`, `isInstructor` |
| **Functions/Methods** | snake_case | `get_queryset()`, `create_otp()` |
| **Variables** | snake_case | `user_data`, `course_id` |
| **Fields (DB)** | snake_case | `profile_picture`, `subscribers_count` |
| **Files** | snake_case | `models.py`, `serializers.py` |
| **URL Names** | snake_case | `'user_login'`, `'create_intent'` |
| **Constants (settings)** | UPPER_CASE | `JWT_COOKIE_SETTINGS`, `OTP_EXPIRY_MINUTES` |

### Frontend (TypeScript/React)

| Element | Convention | Example |
|---------|------------|---------|
| **Components** | PascalCase | `LoginForm`, `CourseCard`, `UserAvatar` |
| **Component Files** | PascalCase for components | `LoginForm.tsx`, `CourseCard.tsx` |
| **Hook Files** | camelCase with "use" prefix | `useLogin.tsx`, `useCourse.tsx` |
| **Hook Functions** | camelCase with "use" prefix | `useLogin()`, `usePaginatedCourses()` |
| **Type/Interface** | PascalCase | `Course`, `UserData`, `LoginFormData` |
| **Variables** | camelCase | `userData`, `courseId`, `isLoading` |
| **Functions** | camelCase | `handleSubmit()`, `getCourses()` |
| **API Objects** | camelCase + "API" suffix | `authAPI`, `coursesAPI` |
| **Schema Objects** | PascalCase + "Schema" suffix | `registerSchema`, `LoginSchema` |
| **Store Files** | camelCase + ".store.ts" | `auth.store.ts` |
| **Store Hooks** | camelCase + "use" + Store | `useAuthStore` |

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

| Alias | Path |
|-------|------|
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
import axios from '@/lib/axios';
import { TypeName } from '../types/{feature}.types';

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
import { useMutation } from '@tanstack/react-query';
import { featureAPI } from '../api/feature.api';
import { toastsuccess, handleAuthError } from '@/lib/toast';

export function useAction() {
    return useMutation({
        mutationFn: featureAPI.apiFunction,
        onSuccess(data: any) {
            toastsuccess('Success Title', data.message);
        },
        onError(error: any) {
            handleAuthError(error, 'Action Failed');
        },
    });
}
```

#### Query Hook (GET with params)
```typescript
// features/{feature}/hooks/use{Resource}.tsx
import { useQuery } from '@tanstack/react-query';
import { featureAPI } from '../api/feature.api';

export function useResource(id: string) {
    return useQuery({
        queryKey: ['resource', id],
        queryFn: () => featureAPI.getResource(id),
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}
```

#### Infinite Query Hook (Pagination)
```typescript
// features/{feature}/hooks/usePaginated{Resource}.tsx
import { useInfiniteQuery } from '@tanstack/react-query';
import { featureAPI } from '../api/feature.api';
import { FilterParams } from '../types/feature.types';

export function usePaginatedResources(params: FilterParams) {
    return useInfiniteQuery({
        queryKey: ['resources', params],
        queryFn: ({ pageParam }) => featureAPI.getResources({ ...params, cursor: pageParam }),
        initialPageParam: '',
        getNextPageParam: (lastPage) => {
            if (!lastPage.next) return null;
            const cursor = new URL(lastPage.next).searchParams.get('cursor');
            return cursor;
        },
        staleTime: 5 * 60 * 1000,
    });
}
```

### Zod Schema Pattern

```typescript
// features/{feature}/schemas/{feature}.schma.ts
import { z } from 'zod';

export const schemaName = z.object({
    field: z.string().min(3, 'Error message'),
    email: z.string().email('Invalid email'),
    role: z.enum(['student', 'instructor']),
    confirm: z.string(),
}).refine((data) => data.password === data.confirm, {
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
                router.push("/next-page");
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
    }
);
```

---

## State Management

### Zustand Store Pattern

```typescript
// store/{feature}.store.ts
import { create } from 'zustand';

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
import { useAuthStore } from '@/store/auth.store';

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

| Level | Location | Responsibility | Examples |
|-------|----------|--------------|----------|
| **Atoms** | `components/atoms/` | Basic UI primitives | `button.tsx`, `input.tsx` |
| **Molecules** | `components/molecules/` | Composite components | `CourseCard.tsx`, `Filters.tsx` |
| **Organisms** | `components/organisms/` | Page sections | `NavBar.tsx`, `Hero.tsx` |

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
    --color-darktext: #0F172A;
    --color-graytext2: #64748B;
    --color-darkmint: #2B5869;
    --color-lightbg: #F8FAFC;
    --color-darkbg: #F1F5F9;
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
    queryKey: ['courses', filters],
    queryFn: ({ pageParam }) => api.getCourses({ ...filters, cursor: pageParam }),
    initialPageParam: '',
    getNextPageParam: (lastPage) => {
        if (!lastPage.next) return null;
        return new URL(lastPage.next).searchParams.get('cursor');
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
