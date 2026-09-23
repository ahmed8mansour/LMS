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
import { Resolver, useForm, useWatch } from 'react-hook-form'
import { useUpdateProfile } from '@/featuers/auth/hooks/useUpdateProfile'
import { UserProfileSchema , InstructorProfileSchema , ProfileFormData } from '@/featuers/auth/schemas/auth.schma'
import { getInstructorProfile } from '@/featuers/auth/types/auth.types'
import ButtonLoading from "@/components/atoms/buttonloading";
import { useEffect, useMemo, useRef, useState } from 'react'


const BIO_MAX_LENGTH = 1000


export function ProfileForm() {

    const router = useRouter()


    // get user profile logic
    const { data: user, isLoading : isFetchingUserData, isError: FetchingUserDataFailed  } = useProfile();

    // Only instructors have a public bio. It is keyed off the role, never off the
    // value: a brand-new instructor has an empty title/about and still needs the
    // fields rendered in order to fill them in for the first time.
    const isInstructor = user?.role === 'instructor'
    const instructorProfile = getInstructorProfile(user)




    const {mutate:updateProfile , isPending: isUpdatingProfile  } = useUpdateProfile()
    const onSubmit = (data:ProfileFormData) => {
        updateProfile(data, {onSuccess : () => {
            reset()
            setPreviewUrl(null)
        }})
    }



    // The instructor schema only adds two optional fields, so both resolvers speak
    // the same form shape; the cast keeps one `useForm` generic for both roles.
    const resolver = useMemo(
        () => zodResolver(isInstructor ? InstructorProfileSchema : UserProfileSchema) as Resolver<ProfileFormData>,
        [isInstructor],
    )


    const {register , handleSubmit  , setValue , reset, control, formState:{errors , isDirty} } = useForm<ProfileFormData>({
            resolver,
            mode:'onBlur',
            values : {
                profile_picture : undefined,
                first_name : user?.first_name || '',
                last_name : user?.last_name || '',
                email : user?.email || '',
                date_joined : user?.date_joined ? user.date_joined.split('T')[0] : '',
                ...(isInstructor && {
                    title : instructorProfile?.title || '',
                    about : instructorProfile?.about || '',
                }),
            }
        })

    // useWatch rather than watch(): the latter returns a fresh function each render,
    // which opts the whole component out of React Compiler memoization.
    const bioLength = useWatch({ control, name: 'about' })?.length ?? 0






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


    // Redirecting is a side effect, so it belongs in an effect rather than in the
    // render path, where it warned and then carried on rendering a user-less form.
    useEffect(() => {
        if (!isFetchingUserData && (FetchingUserDataFailed || !user)) router.replace('/login')
    }, [isFetchingUserData, FetchingUserDataFailed, user, router])






    // guards
    if(isFetchingUserData) return <div className="flex items-center justify-center py-10"><BounceLoader/></div>
    if (FetchingUserDataFailed || !user) return null




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

            {isInstructor && (
            <>
                <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="title">Headline</Label>
                    <Input id="title" type="text" placeholder="e.g. Senior Backend Engineer & Django Instructor" {...register('title')} />
                    <p className="text-xs text-graytext2">Shown under your name on every course page.</p>
                    {errors?.title &&
                        <span className="text-sm text-red-400">{errors?.title.message}</span>
                    }
                </div>

                <div className="md:col-span-2 space-y-2">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="bio">Bio</Label>
                        <span className={`text-xs ${bioLength > BIO_MAX_LENGTH ? 'text-red-400' : 'text-graytext2'}`}>
                            {bioLength}/{BIO_MAX_LENGTH}
                        </span>
                    </div>
                    <textarea className="w-full px-4 py-2.5 min-h-40 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all bg-lightbg text-darktext border border-graylighttext/40 placeholder:text-[#94A3B8]" id="bio" placeholder="Write a short biography about yourself..." {...register('about')}></textarea>
                    <p className="text-xs text-graytext2">Students read this on your course pages before they enroll.</p>
                    {errors?.about &&
                            <span className="text-sm text-red-400">{errors?.about.message}</span>
                    }
                </div>
            </>
            )}


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
