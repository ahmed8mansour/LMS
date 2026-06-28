"use client";
import { UserSetPassword } from './UserSetPassword';
import { UserChangePassword } from './UserChangePassword';
import { usePasswordManagement } from '@/featuers/auth/hooks/usePasswordManagment';
import BounceLoader from '@/components/atoms/bouncing-loader';

export const PasswordManager = () => {
    const { mode, isLoading } = usePasswordManagement();

    if (isLoading) return <div className="flex justify-center items-center h-full "><BounceLoader /></div>;
    if (mode === 'UNAVAILABLE') return null;
    return (
        <>
        {mode === 'CHANGE' ?  <UserChangePassword /> :  <UserSetPassword /> }
        </>
    );
};