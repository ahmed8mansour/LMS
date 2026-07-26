from rest_framework.pagination import PageNumberPagination

# الباجنيشين المناسب 
# cause offset/limit is slow
# cursor isn't appropirated for this feature

class BillingPageNumberPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
