import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Stripe, StripeElements } from '@stripe/stripe-js';
import { toastsuccess, toasterror } from '@/lib/toast';
import { useRouter } from 'next/navigation';

interface ProceedPaymentParams {
    stripe: Stripe | null;
    elements: StripeElements | null;
}

export function useProceedPayment() {
    const queryClient = useQueryClient();
    const router = useRouter();

    const mutation = useMutation({
        mutationFn: async ({ stripe, elements }: ProceedPaymentParams) => {
            if (!stripe || !elements) {
                throw new Error('Payment system not initialized');
            }

            const { error: stripeError } = await stripe.confirmPayment({
                elements,
                confirmParams: {
                    return_url: `${window.location.origin}/dashboard`,
                },
                redirect: 'if_required',
            });

            if (stripeError) {
                throw new Error(stripeError.message || 'Payment failed');
            }

            return { success: true };
        },
        onSuccess: () => {
            queryClient.removeQueries({ queryKey: ['order'] });
            toastsuccess('Payment completed successfully! Redirecting...');
            router.push('/dashboard');
        },
        onError: (error: Error) => {
            const paymentError = getPaymentErrorMessage(error.message);
            toasterror('Payment Failed', paymentError);
        },
    });

    return {
        error: mutation.error,
        isPending: mutation.isPending,
        isSuccess: mutation.isSuccess,
        mutate: mutation.mutate,
    };
}

function getPaymentErrorMessage(message: string): string {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('declined')) {
        return 'Your card was declined. Please try a different card.';
    }
    if (lowerMessage.includes('insufficient funds')) {
        return 'Insufficient funds. Please try a different card.';
    }
    if (lowerMessage.includes('expired')) {
        return 'Your card has expired. Please check the expiry date.';
    }
    if (lowerMessage.includes('incorrect cvc')) {
        return 'Incorrect CVC code. Please check and try again.';
    }
    if (lowerMessage.includes('authentication required')) {
        return 'Payment requires authentication. Please complete the verification.';
    }
    if (lowerMessage.includes('processing error')) {
        return 'Payment processing error. Please try again.';
    }

    return message || 'Payment failed. Please try again.';
}
