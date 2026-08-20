from django.http import HttpResponse
from django.test import TestCase

from .models import CustomUser
from .utils import compute_routing_role, set_role_cookie, clear_jwt_cookies, set_jwt_cookies


class RoutingRoleCookieTests(TestCase):
    """Covers the non-sensitive `role` cookie contract used for edge routing."""

    def _user(self, *, role="student", is_superuser=False, is_staff=False):
        # Attribute-only instances are enough for the cookie helpers (no DB read).
        return CustomUser(
            email=f"{role}-{is_superuser}@example.com",
            role=role,
            is_superuser=is_superuser,
            is_staff=is_staff,
        )

    # --- compute_routing_role: the three-way branch (admin via is_superuser) ---

    def test_superuser_is_admin_even_if_role_differs(self):
        user = self._user(role="student", is_superuser=True, is_staff=True)
        self.assertEqual(compute_routing_role(user), "admin")

    def test_role_instructor_is_instructor(self):
        user = self._user(role="instructor", is_staff=True)
        self.assertEqual(compute_routing_role(user), "instructor")

    def test_plain_user_is_student(self):
        self.assertEqual(compute_routing_role(self._user(role="student")), "student")

    def test_non_superuser_staff_without_instructor_role_is_student(self):
        user = self._user(role="student", is_staff=True)
        self.assertEqual(compute_routing_role(user), "student")

    # --- set_role_cookie: value + non-sensitive flags ---

    def test_set_role_cookie_value_and_flags(self):
        response = HttpResponse()
        set_role_cookie(response, self._user(role="instructor", is_staff=True))

        self.assertIn("role", response.cookies)
        morsel = response.cookies["role"]
        self.assertEqual(morsel.value, "instructor")
        # Must be readable by edge middleware + client -> NOT HttpOnly.
        self.assertFalse(morsel["httponly"])
        self.assertEqual(morsel["path"], "/")
        self.assertEqual(morsel["samesite"], "Lax")

    def test_set_jwt_cookies_also_sets_role(self):
        # set_jwt_cookies issues a real JWT, so the user must be persisted.
        user = CustomUser.objects.create_user(
            email="student@example.com", password="pw12345678", username="student1", role="student"
        )
        response = HttpResponse()
        set_jwt_cookies(response, user)
        self.assertEqual(response.cookies["role"].value, "student")
        # JWT tokens remain HttpOnly; the role cookie does not.
        self.assertTrue(response.cookies["access_token"]["httponly"])
        self.assertFalse(response.cookies["role"]["httponly"])

    # --- clear_jwt_cookies: logout removes the role cookie ---

    def test_clear_jwt_cookies_deletes_role(self):
        response = HttpResponse()
        clear_jwt_cookies(response)
        self.assertIn("role", response.cookies)
        self.assertEqual(response.cookies["role"].value, "")
        self.assertEqual(response.cookies["role"]["max-age"], 0)
