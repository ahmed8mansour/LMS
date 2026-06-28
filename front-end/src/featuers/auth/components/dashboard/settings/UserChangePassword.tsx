"use client"
import { Button } from '@/components/atoms/button'
import { Input } from '@/components/atoms/input'
import { Label } from '@/components/atoms/label'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { UserChangePasswordSchema } from '@/featuers/auth/schemas/auth.schma'
import { UserChangePasswordRequest  } from '@/featuers/auth/types/auth.types'
import { useUserChangePassword } from '@/featuers/auth/hooks/useChangePassword'
import ButtonLoading from '@/components/atoms/buttonloading'
import { useQueryClient } from '@tanstack/react-query'

export function UserChangePassword() {


    const {register , handleSubmit , reset , formState:{errors } } = useForm<UserChangePasswordRequest>({            
            resolver:zodResolver(UserChangePasswordSchema) ,   
        })
        
    const {mutate: MutatechangePassword , isPending : isChangingpassword , isError} = useUserChangePassword()

    function ChangePassword(data :UserChangePasswordRequest ){
        MutatechangePassword(data , {
            onSuccess(data, variables, onMutateResult, context) {
                reset()
            }
        })
    }
        
    
    return (
        <form className="bg-muted border border-border rounded-xl overflow-hidden shadow-sm "  onSubmit={handleSubmit(ChangePassword)}>
            <div className="p-4 md:p-6">
            <div className="mb-4 md:mb-6">
                <h3 className="text-xl font-bold text-foreground">Change Password</h3>
                <p className="text-sm text-muted-foreground">Manage your security by regularly updating your password.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 md:gap-x-8 gap-y-4 md:gap-y-6">
                <div className="col-span-1 sm:col-span-2 flex flex-col gap-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Current Password</Label>
                <Input placeholder="Current Password" type="password" {...register('old_password')} />
                {errors?.old_password && 
                    <span className="text-sm text-red-400">{errors?.old_password.message}</span>
                }
                </div>
                <div className="flex flex-col gap-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">New Password</Label>
                <Input placeholder="New Password" type="password" {...register('new_password')} />
                {errors?.new_password && 
                    <span className="text-sm text-red-400">{errors?.new_password.message}</span>
                }
                </div>
                <div className="flex flex-col gap-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Confirm New Password</Label>
                <Input placeholder="Confirm New Password" type="password" {...register('new_password_confirm')} />
                {errors?.new_password_confirm && 
                    <span className="text-sm text-red-400">{errors?.new_password_confirm.message}</span>
                }
                </div>
                <div className="col-span-1 sm:col-span-2 flex flex-col sm:flex-row items-start sm:items-center justify-between pt-4 border-t border-border gap-4">
                <Button variant="darkmint" type='submit' className="w-full sm:w-auto" disabled={isChangingpassword}>
                    {isChangingpassword  ? <ButtonLoading/> : "Update Password" }
                </Button>
                </div>
            </div>
            </div>
        </form>
    )
}
