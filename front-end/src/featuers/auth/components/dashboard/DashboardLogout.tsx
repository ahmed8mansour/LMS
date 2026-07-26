"use client";
import {LogOut} from 'lucide-react';
import { useLogout } from '@/featuers/auth/hooks/useLogout';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
export function DashboardLogout({isCollapsed}: { isCollapsed: boolean }) {
    // const handleItemClick = (itemId: string) => {
    //     setActiveItem(itemId);
    //     if (window.innerWidth < 768) {
    //         setIsOpen(false);
    //     }
    // };
    const router = useRouter()
    const { mutate:DoLogout, isPending : isLogginout , isSuccess:LoggedOutSuccessfully , isError : LogingoutFailed  } = useLogout();
    
    const Logout = () => {
        DoLogout(undefined, {
            onSuccess: () => {
                router.replace('/login');
            },
        });
    }
    const queryClient = useQueryClient();
    const user = queryClient.getQueryData(['user', 'profile'])
    return (
        <div className="p-3 pt-0">
                <button
                disabled={isLogginout || LoggedOutSuccessfully}
                onClick={Logout}
                className={`
                    w-full flex items-center rounded-md text-left transition-all duration-200 group
                    text-red-500  hover:text-red-600
                    ${isCollapsed ? "justify-center p-2.5" : "space-x-2.5 px-3 py-2.5"}
                    ${isLogginout ? "opacity-50 cursor-not-allowed" : ""}
                `}
                title={isCollapsed ? "Logout" : undefined}
                >
                <div className="flex items-center justify-center min-w-6">
                    <LogOut className="h-4.5 w-4.5 shrink-0" />
                </div>

                {!isCollapsed && (
                    <span className="text-sm">Logout</span>
                )}

                {/* Tooltip for collapsed state */}
                {isCollapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-darktext text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                    Logout
                    <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1 w-1.5 h-1.5 bg-darktext rotate-45" />
                    </div>
                )}
                </button>

        </div>
    )
}
