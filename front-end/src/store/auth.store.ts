import {create} from 'zustand'

type User = {
    pending_email:string | null;
    can_verify_otp :boolean;

    setPendingEmail:(pending_email:string |null) => void;
    setCanVerifyOTP:(value : boolean) => void;
}


export const useAuthStore = create<User>((set) => ({
    pending_email : null,
    can_verify_otp : false,


    setPendingEmail: (pending_email) => {
        set({ pending_email , can_verify_otp : true })
    }
    ,
    setCanVerifyOTP: (value) => set({ can_verify_otp: value }),
}))