from rest_framework.pagination import CursorPagination

class CourseCursorPagination(CursorPagination):
    page_size = 1
    page_size_query_param = 'page_size' # لو بدكك بتبعت ?page_size=3 بتحددله اكم عنصر 
    ordering = ('-created_at',) 

    def get_ordering(self, request, queryset, view):
        sort = request.query_params.get('sort', 'newest')

        allowed_orderings = {
            'newest':  ('-created_at',),
            'popular': ('-subscribers_count',),
            'system':  ('id',),
        }

        return allowed_orderings.get(sort, ('-created_at',))  