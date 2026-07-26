from abc import ABC , abstractmethod
from .dto import RefundResult , PaymentRequest , PaymentAttempt , PaymentStatus , PaymentEvent
class PaymentGateway(ABC):

    @abstractmethod
    def initiate_payment(self , payment_request : PaymentRequest) -> PaymentAttempt:
        pass

    @abstractmethod
    def retrieve_attempt(self , reference : str) -> PaymentAttempt:
        """Re-fetch an in-progress attempt (e.g. a fresh client_secret) for payment retry / page-refresh recovery."""
        pass

    @abstractmethod
    def get_status(self , reference : str) -> PaymentStatus:
        pass


    @abstractmethod
    def refund(self , reference : str) -> RefundResult:
        pass


    @abstractmethod
    def parse_and_verify(self , payload : bytes , signature : str) -> PaymentEvent:
        pass