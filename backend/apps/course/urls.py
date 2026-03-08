from django.urls import path, include
from .views import CourseView , CourseViewSet
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register('' , CourseViewSet , basename='courses')

urlpatterns = [
    # path('<int:id>/' , CourseView.as_view() , name="test"),
    path('' , include(router.urls))
]






# urls already set by the viewset: 

# | Method | Endpoint | Function |
# | --- | --- | --- |
# | GET | /courses | list |
# | POST | /courses | create |
# | GET | /courses/1 | retrieve |
# | PUT | /courses/1 | update |
# | PATCH | /courses/1 | partial update |
# | DELETE | /courses/1 | delete |