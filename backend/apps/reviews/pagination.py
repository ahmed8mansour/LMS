from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

# الباجنيشين المناسب 
# cause offset/limit is slow
# cursor isn't appropirated for this feature

class ReviewPageNumberPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'


class InstructorReviewsPagination(PageNumberPagination):
    """Paging for the instructor reviews feed (spec 012).

    A second paginator rather than a change to ReviewPageNumberPagination above, which
    backs the PUBLIC course-reviews endpoint and must keep its behaviour. Three
    differences, all required here:

    - no `page_size_query_param` — FR-028 fixes the size on the server, so the client
      cannot widen the page;
    - `stats` in the response envelope;
    - an out-of-range `?page=` resolves to page 1 instead of 404.

    page_size is 10, not 010's 20: a review is a tall card with a comment, not a table
    row.
    """

    page_size = 10

    def get_paginated_response(self, data):
        # The envelope is built HERE rather than by hand in the view, because this is
        # the one place DRF already assembles these four keys — a view that
        # reconstructs them drifts the moment DRF changes one.
        #
        # The array is `results`, not `reviews`, to keep this a standard DRF page object
        # per CLAUDE.md (owner answer P3). Renaming it is a one-line change on the line
        # below.
        #
        # `stats` is set by the view before it paginates. getattr's default keeps this
        # paginator usable by any future caller that does not set it.
        return Response({
            'stats': getattr(self, 'stats', None),
            'count': self.page.paginator.count,
            'next': self.get_next_link(),
            'previous': self.get_previous_link(),
            'results': data
        })


    def get_page_number(self, request, paginator):
        # FR-031: a missing, malformed, or out-of-range page falls back to the FIRST
        # page with a 200. DRF's default hands the raw value to Django's Paginator,
        # which raises InvalidPage for anything it can't use, and DRF turns that into a
        # 404.
        #
        # This has to be fixed here rather than by catching NotFound in
        # paginate_queryset: request.query_params is an immutable QueryDict, so once the
        # exception is raised there is no way to rewrite the page and retry.
        page_number = request.query_params.get(self.page_query_param, 1)

        if page_number in self.last_page_strings:
            # Must be the resolved page NUMBER, not the literal 'last': Paginator calls
            # int() on whatever it gets, so returning 'last' would raise
            # PageNotAnInteger and 404 the very request this branch exists to serve.
            return paginator.num_pages

        try:
            page_number = int(page_number)
        except (ValueError, TypeError):
            return 1

        # num_pages is 1 even for an empty result (allow_empty_first_page), so an empty
        # feed resolves to page 1 instead of tripping the upper bound.
        if page_number < 1 or page_number > paginator.num_pages:
            return 1

        return page_number
