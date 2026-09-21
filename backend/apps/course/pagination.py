from rest_framework.pagination import CursorPagination , PageNumberPagination

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


class StudentRosterPagination(PageNumberPagination):
    """Page-number paging for the instructor student roster (spec 010).

    No `page_size_query_param`, unlike the two paginators below it: FR-021 fixes the page
    size on the server, so the client cannot widen it.
    """

    page_size = 20

    def get_page_number(self, request, paginator):
        # FR-024: a missing, malformed, or out-of-range page falls back to the FIRST page
        # with a 200. DRF's default hands the raw value to Django's Paginator, which
        # raises InvalidPage for anything it can't use, and DRF turns that into a 404.
        #
        # This has to be fixed here rather than by catching NotFound in paginate_queryset:
        # request.query_params is an immutable QueryDict, so once the exception is raised
        # there is no way to rewrite the page and retry.
        page_number = request.query_params.get(self.page_query_param, 1)

        if page_number in self.last_page_strings:
            # Must be the resolved page NUMBER, not the literal 'last': Paginator calls
            # int() on whatever it gets, so returning 'last' would raise PageNotAnInteger
            # and 404 the very request this branch exists to serve.
            return paginator.num_pages

        try:
            page_number = int(page_number)
        except (ValueError, TypeError):
            # Not a number at all ('abc', or '' from a bare `?page=`).
            return 1

        # num_pages is 1 even for an empty result (allow_empty_first_page), so an empty
        # roster resolves to page 1 instead of tripping the upper bound.
        if page_number < 1 or page_number > paginator.num_pages:
            return 1

        return page_number
