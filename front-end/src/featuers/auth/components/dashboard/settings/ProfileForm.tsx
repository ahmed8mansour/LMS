'use client'

import {  Camera, Lock } from 'lucide-react'
import { Button } from '@/components/atoms/button'
import { Input } from '@/components/atoms/input'
import { Label } from '@/components/atoms/label'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/atoms/avatar'
import { useProfile } from '@/featuers/auth/hooks/useProfile'
import {useRouter} from 'next/navigation'
import BounceLoader from '@/components/atoms/bouncing-loader'
import { zodResolver } from "@hookform/resolvers/zod";
import { SubmitErrorHandler, useForm } from 'react-hook-form'
import { useUpdateProfile } from '@/featuers/auth/hooks/useUpdateProfile'
import { UserProfileSchema , UserProfileFormData } from '@/featuers/auth/schemas/auth.schma'
import ButtonLoading from "@/components/atoms/buttonloading";
import { useEffect, useRef, useState } from 'react'


export function ProfileForm() {
    
    const router = useRouter()


    // get user profile logic
    const { data: user, isLoading : isFetchingUserData, isError: FetchingUserDataFailed  } = useProfile();




    const {mutate:updateProfile , isPending: isUpdatingProfile  } = useUpdateProfile()
    const onSubmit = (data:UserProfileFormData) => {
        updateProfile(data, {onSuccess : () => {
            reset()
            setPreviewUrl(null)
        }})
    }



    


    const {register , handleSubmit  , setValue , reset, formState:{errors , isDirty} } = useForm<UserProfileFormData>({            
            resolver:zodResolver(UserProfileSchema) ,   
            mode:'onBlur',  
            values : {
                profile_picture : undefined,
                first_name : user?.first_name || '',
                last_name : user?.last_name || '',
                email : user?.email || '',
                date_joined : user?.date_joined ? user.date_joined.split('T')[0] : '',
            }
        })

    






    const fileInputRef               = useRef<HTMLInputElement>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        
        // Update RHF state (Zod will validate on submit)
        setValue('profile_picture', e.target.files!, { shouldDirty: true, shouldValidate: true })
        
        // Generate preview
        setPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev)
                return URL.createObjectURL(file)
        })
    }
    







    // cleanup preview URL on unmount or when a new file is selected
    useEffect(() => {
        return () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl)
        }
    }, [previewUrl])
    







    // guards 
    if(isFetchingUserData) return <div className="flex items-center justify-center py-10"><BounceLoader/></div>
    if (FetchingUserDataFailed || !user) router.replace('/login')
    



    return (
        <form className="space-y-6 md:space-y-8" onSubmit={handleSubmit(onSubmit)}>
            <div className="flex flex-col items-start gap-4">
            <Label className="text-sm font-bold text-foreground tracking-wide uppercase">Profile Picture</Label>
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}>
                <Avatar className="w-20 h-20 md:w-24 md:h-24 border-2 border-border p-1 bg-darkmint">
                <AvatarImage src={previewUrl || user?.profile_picture} alt="Profile Avatar" />
                <AvatarFallback>{user?.first_name?.[0]}{user?.last_name?.[0]}</AvatarFallback>
                </Avatar>
                <input 
                    ref={fileInputRef}
                    type="file" 
                    accept="image/*"
                    className="absolute  inset-0 w-full h-full hidden cursor-pointer"
                    onChange={handleFileChange}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="text-white text-2xl md:text-3xl" />
                </div>
            </div>
            {errors?.profile_picture && 
                <div className="text-sm text-red-400 mt-1">{errors.profile_picture.message}</div>
            }
            </div>




            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div className="space-y-2">
                <Label htmlFor="first_name" >First Name</Label>
                <Input id="first_name" type="text"  {...register('first_name')} />
                {errors?.first_name && 
                    <span className="text-sm text-red-400">{errors?.first_name.message}</span>
                }
            </div>
            <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input id="last_name" type="text"  {...register('last_name')} />
                {errors?.last_name && 
                    <span className="text-sm text-red-400">{errors?.last_name.message}</span>
                }
            </div>
            <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                    <Input id="email" type="email"  {...register('email')} disabled />
                    <Lock className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground opacity-50" />
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="date_joined">Date Joined</Label>
                <div className="relative">
                    <Input id="date_joined" type="text"  disabled  {...register('date_joined')}/>
                    <Lock className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground opacity-50" />
                </div>
            </div>

            {user?.specific_data?.about && 
            
            <div className="md:col-span-2 space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <textarea className="w-full px-4 py-2.5 rounded-lg border border-border bg-muted focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all resize-none" id="bio" placeholder="Write a short biography about yourself..." rows={4} defaultValue={user?.specific_data?.about}></textarea>
            </div>
            }


            </div>


            <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 pt-4 border-t border-border/20" >
            <Button variant="ghost" type="button" className="w-full sm:w-auto" onClick={() => {
                reset()
                setPreviewUrl(null)
                }}  disabled={isUpdatingProfile || !isDirty}>
                Cancel
            </Button>
            <Button variant="darkmint" type="submit" className="w-full sm:w-auto" disabled={isUpdatingProfile || !isDirty}>
                {isUpdatingProfile ? <ButtonLoading /> : 'Save Changes'}
            </Button>
            </div>
        </form>
    )
}
