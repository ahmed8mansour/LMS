# Frontend Implementation Guide: HttpOnly Cookies

## Quick Start

### Key Requirement
Always use `credentials: 'include'` in fetch requests to automatically send cookies.

---

## JavaScript / Fetch API

### Login Example
```javascript
async function login(email, password) {
  const response = await fetch('http://localhost:8000/api/auth/user/login/', {
    method: 'POST',
    credentials: 'include',  // ✅ IMPORTANT: Include cookies
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password })
  });

  if (response.ok) {
    const data = await response.json();
    console.log('Logged in as:', data.user_data);
    // Cookies are automatically managed by the browser!
    return data.user_data;
  } else {
    const error = await response.json();
    console.error('Login failed:', error);
  }
}
```

### Protected Request Example
```javascript
async function getUserProfile() {
  const response = await fetch('http://localhost:8000/api/auth/user/profile/', {
    method: 'GET',
    credentials: 'include',  // ✅ Cookies sent automatically
    headers: {
      'Content-Type': 'application/json',
    }
  });

  if (response.ok) {
    const profile = await response.json();
    return profile;
  }
}
```

### Logout Example
```javascript
async function logout() {
  const response = await fetch('http://localhost:8000/api/auth/user/logout/', {
    method: 'POST',
    credentials: 'include',  // ✅ Send refresh token if available
  });

  if (response.ok) {
    console.log('Logged out successfully');
    // Cookies automatically cleared by server
  }
}
```

---

## React with Fetch

### Create API Service
```javascript
// api.js
const API_BASE_URL = 'http://localhost:8000/api';

const apiCall = async (endpoint, method = 'GET', body = null) => {
  const options = {
    method,
    credentials: 'include',  // ✅ Always include credentials
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
  
  if (!response.ok) {
    if (response.status === 401) {
      // Token expired, backend will reject
      // Frontend can redirect to login
      throw new Error('Unauthorized');
    }
    throw new Error(`API Error: ${response.status}`);
  }

  return response.json();
};

export async function login(email, password) {
  return apiCall('/auth/user/login/', 'POST', { email, password });
}

export async function getUserProfile() {
  return apiCall('/auth/user/profile/');
}

export async function logout() {
  return apiCall('/auth/user/logout/', 'POST');
}

export default apiCall;
```

### Use in React Component
```javascript
// App.js or AuthContext.js
import { useState, useEffect } from 'react';
import { login, logout, getUserProfile } from './api';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if user is logged in on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const profile = await getUserProfile();
        setUser(profile);
      } catch (error) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleLogin = async (email, password) => {
    try {
      const userData = await login(email, password);
      setUser(userData.user_data);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {user ? (
        <>
          <p>Welcome, {user.first_name}!</p>
          <button onClick={handleLogout}>Logout</button>
        </>
      ) : (
        <LoginForm onLogin={handleLogin} />
      )}
    </div>
  );
}
```

---

## React with Axios

### Setup Axios
```javascript
// api.js
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  withCredentials: true,  // ✅ Include cookies automatically
});

export default api;
```

### API Calls
```javascript
// auth.js
import api from './api';

export async function login(email, password) {
  const response = await api.post('/auth/user/login/', { email, password });
  return response.data;
}

export async function getUserProfile() {
  const response = await api.get('/auth/user/profile/');
  return response.data;
}

export async function logout() {
  const response = await api.post('/auth/user/logout/');
  return response.data;
}
```

### In Component
```javascript
import { useState } from 'react';
import { login, logout, getUserProfile } from './auth';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const data = await login(email, password);
      console.log('Logged in:', data.user_data);
      // Redirect to dashboard
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <form onSubmit={handleLogin}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />
      <button type="submit">Login</button>
    </form>
  );
}
```

---

## Angular

### Setup HTTP Interceptor
```typescript
// auth.interceptor.ts
import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
} from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  intercept(
    req: HttpRequest<any>,
    next: HttpHandler,
  ): Observable<HttpEvent<any>> {
    // Credentials are already included with withCredentials
    return next.handle(req);
  }
}
```

### Configure in App Module
```typescript
// app.module.ts
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { AuthInterceptor } from './auth.interceptor';

@NgModule({
  imports: [HttpClientModule],
  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true,
    },
  ],
})
export class AppModule {}
```

### Create Auth Service
```typescript
// auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = 'http://localhost:8000/api/auth';

  constructor(private http: HttpClient) {}

  login(email: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/user/login/`, 
      { email, password },
      { withCredentials: true }  // ✅ Include cookies
    );
  }

  logout(): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/user/logout/`,
      {},
      { withCredentials: true }
    );
  }

  getProfile(): Observable<any> {
    return this.http.get(`${this.apiUrl}/user/profile/`, {
      withCredentials: true,
    });
  }
}
```

### Use in Component
```typescript
// login.component.ts
import { Component } from '@angular/core';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
})
export class LoginComponent {
  email = '';
  password = '';
  error = '';

  constructor(private authService: AuthService) {}

  login() {
    this.authService.login(this.email, this.password).subscribe(
      (response) => {
        console.log('Logged in:', response.user_data);
        // Navigate to dashboard
      },
      (error) => {
        this.error = 'Login failed';
      },
    );
  }

  logout() {
    this.authService.logout().subscribe(
      () => {
        console.log('Logged out');
        // Navigate to login
      },
      (error) => {
        console.error('Logout failed:', error);
      },
    );
  }
}
```

---

## Vue.js

### Setup Axios Instance
```javascript
// api.js
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  withCredentials: true,  // ✅ Include cookies
});

export default api;
```

### Create Composable
```javascript
// useAuth.js
import { ref } from 'vue';
import api from './api';

export const useAuth = () => {
  const user = ref(null);
  const loading = ref(false);

  const login = async (email, password) => {
    loading.value = true;
    try {
      const { data } = await api.post('/auth/user/login/', {
        email,
        password,
      });
      user.value = data.user_data;
      return data;
    } finally {
      loading.value = false;
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/user/logout/');
      user.value = null;
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const getProfile = async () => {
    try {
      const { data } = await api.get('/auth/user/profile/');
      user.value = data;
      return data;
    } catch (error) {
      user.value = null;
      throw error;
    }
  };

  return {
    user,
    loading,
    login,
    logout,
    getProfile,
  };
};
```

### Use in Component
```vue
<!-- LoginPage.vue -->
<template>
  <div>
    <input v-model="email" type="email" placeholder="Email" />
    <input v-model="password" type="password" placeholder="Password" />
    <button @click="handleLogin" :disabled="loading">Login</button>
    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useAuth } from './useAuth';

const { login, loading } = useAuth();
const email = ref('');
const password = ref('');
const error = ref('');

const handleLogin = async () => {
  try {
    await login(email.value, password.value);
    // Redirect to dashboard
  } catch (err) {
    error.value = 'Login failed';
  }
};
</script>
```

---

## Common Issues & Solutions

### 🔴 CORS Error
```
Access to XMLHttpRequest blocked by CORS policy
```

**Solution:**
- Ensure `credentials: 'include'` is set in fetch
- Backend must have `CORS_ALLOW_CREDENTIALS = True`
- Backend `CORS_ALLOWED_ORIGINS` must include your frontend URL

### 🔴 Cookies Not Being Set
**Solution:**
- Check browser DevTools → Application → Cookies
- Ensure response includes `Set-Cookie` headers
- Check for CORS errors in console

### 🔴 401 Unauthorized on Protected Routes
**Solution:**
- Verify `credentials: 'include'` is set
- Check if refresh token expired (clear cookies, login again)
- Verify backend is receiving cookies

### 🔴 "Invalid or expired token"
**Solution:**
- Refresh token (POST `/auth/token/refresh/`)
- If refresh fails, user needs to login again
- Clear cookies and start fresh

---

## Token Refresh Handling

If you need to handle token expiration automatically:

```javascript
// With axios-retry or similar
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Try to refresh token
        await fetch('http://localhost:8000/api/auth/token/refresh/', {
          method: 'POST',
          credentials: 'include',
        });

        // Retry original request
        return axios(originalRequest);
      } catch (refreshError) {
        // Redirect to login
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);
```

---

## Development vs Production

### Development
```javascript
const API_URL = 'http://localhost:8000/api';
// CORS_ALLOW_ALL_ORIGINS = True
```

### Production
```javascript
const API_URL = 'https://api.yourdomain.com/api';
// CORS_ALLOWED_ORIGINS = ["https://yourdomain.com"]
// Cookies use secure flag (HTTPS only)
```

---

## Summary

| Requirement | Fetch | Axios | Angular |
|-------------|-------|-------|---------|
| Credentials | `credentials: 'include'` | `withCredentials: true` | `withCredentials: true` |
| Manual Token | ❌ None | ❌ None | ❌ None |
| Automatic Cookies | ✅ Yes | ✅ Yes | ✅ Yes |
| Safe from XSS | ✅ Yes | ✅ Yes | ✅ Yes |
