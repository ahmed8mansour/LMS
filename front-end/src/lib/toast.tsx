import { toast } from "sonner"
import { FaCheckCircle } from "react-icons/fa"
import { MdError } from "react-icons/md";

interface Toastmessage {
    head?: string
    body?: string
}

export const toastsuccess = (head: string, body: string) => {
    toast.success(head, {
        position: "top-right",
        description: body,
        icon: <FaCheckCircle className="h-5 w-5 text-green-500" />
    })
}

export const toasterror = (head: string, body: string) => {
    toast.error(head, {
        position: "top-right",
        description: body,
        icon: <MdError className="h-5 w-5 text-red-500" />
    })
}

export function handleAuthError(error: any, fallbackHead: string = 'Authentication Failed') {
    // Handle network errors
    if (!error.response) {
        toasterror('Network Error', "Can't connect to server")
        return
    }

    // Extract error message from response
    const message = error.response.data?.error || error.response.data?.detail || 'Something went wrong'
    const displayMessage = typeof message === 'string' ? message : Array.isArray(message) ? message.join('\n') : 'Something went wrong'
    
    toasterror(fallbackHead, displayMessage)
}