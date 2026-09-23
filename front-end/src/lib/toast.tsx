import { toast } from "sonner"
import { FaCheckCircle } from "react-icons/fa"
import { MdError } from "react-icons/md";

interface Toastmessage {
    head?: string
    body?: string
}

export const toastsuccess = (head: string, body?: string) => {
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

// create a toastinfo function as same as the functions above but with a blue info icon

export const toastinfo = (head: string, body: string) => {
    toast.info(head, {
        position: "top-right",
        description: body,
        icon: <MdError className="h-5 w-5 text-blue-500" />
    })
}

export function handleAuthError(error: any, fallbackHead: string = 'Authentication Failed') {
    // Not every failure reaching a mutation's onError is an Axios error: a
    // pre-flight step (e.g. the Cloudinary avatar upload) throws a plain Error.
    // Reporting those as "can't connect to server" hides the real reason.
    if (!error?.isAxiosError) {
        toasterror(fallbackHead, error?.message || 'Something went wrong')
        return
    }
    if (!error.response) {
        toasterror('Network Error', "Can't connect to server")
        return
    }
    if (error.response.status == "401") {
        toasterror(fallbackHead, "please sign in first ")
        return
    }
    // Our API returns either { error: "message" } or DRF field errors
    // { field: ["message"] } -- both shapes must reach the user.
    const data = error.response.data
    const message = data?.error || data?.detail || extractFieldErrors(data) || 'Something went wrong'
    const displayMessage = typeof message === 'string' ? message : Array.isArray(message) ? message.join('\n') : 'Something went wrong'
    toasterror(fallbackHead, displayMessage)
}

/** Flatten DRF field errors ({ about: ["Too long"] }) into readable lines. */
function extractFieldErrors(data: unknown): string | null {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null
    const lines = Object.entries(data as Record<string, unknown>)
        .map(([field, messages]) => {
            const text = Array.isArray(messages) ? messages.join(' ') : typeof messages === 'string' ? messages : ''
            return text ? `${field.replace(/_/g, ' ')}: ${text}` : ''
        })
        .filter(Boolean)
    return lines.length ? lines.join('\n') : null
}