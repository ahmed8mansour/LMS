
import { useRouter } from "next/navigation";
import { useProfile } from "@/featuers/auth/hooks/useProfile";
import { Skeleton } from "@/components/atoms/skeleton";
import { useLogout } from "@/featuers/auth/hooks/useLogout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/atoms/avatar"

export  function DashboardAvater({isCollapsed}: { isCollapsed: boolean }) {
    const { data: user, isLoading : isFetchingUserData, isError: FetchingUserDataFailed  } = useProfile();
    const router = useRouter()

    if (isFetchingUserData) {
        if (isCollapsed) {
            return <Skeleton className="w-9 h-9 rounded-full bg-white/40 m-auto my-3" />;
        } else {
            return (
                <div className="flex items-center px-6 py-5 rounded-md ">
                    <Skeleton className="w-8 h-8 rounded-full bg-white/40" />
                    <div className="flex-1 min-w-0 ml-2.5">
                        <Skeleton className="h-4 w-20 mb-1 bg-white/40" />
                        <Skeleton className="h-3 w-24 bg-white/40" />
                    </div>
                    <Skeleton className="w-2 h-2 rounded-full ml-2" />
                </div>
            );
        }
    }
    if (FetchingUserDataFailed || !user) router.replace('/login')
    
    
    return (
        <div className={`  ${isCollapsed ? 'py-3 px-2' : 'p-3'}`}>
            {!isCollapsed ? (
            <div className="flex items-center px-3 py-2 rounded-md  transition-colors duration-200">
                <div className="w-8 h-8 bg-graytext/20 rounded-full flex items-center justify-center">
                <Avatar className="bg-darkmint">
                    <AvatarImage src={user?.profile_picture} alt="shadcn" />
                    <AvatarFallback>{user?.first_name?.[0]}{user?.last_name?.[0]}</AvatarFallback>
                </Avatar>
                </div>
                <div className="flex-1 min-w-0 ml-2.5">
                <p className="text-sm font-semibold font-medium text-white truncate">{user?.first_name || user?.username}</p>
                <p className="text-xs text-white/70 truncate">Premium {user?.role}</p>
                </div>
                <div className="w-2 h-2 bg-green-500 rounded-full ml-2" title="Online" />
            </div>
            ) : (
            <div className="flex justify-center">
                <div className="relative">
                <div className="w-9 h-9 bg-darkmint/80 rounded-full flex items-center justify-center">
                <Avatar className="bg-darkmint">
                    <AvatarImage src={user?.profile_picture} alt="shadcn" />
                    <AvatarFallback>{user?.first_name?.[0]}{user?.last_name?.[0]}</AvatarFallback>
                </Avatar>
                </div>
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-darkmint rounded-full border-2 border-white" />
                </div>
            </div>
            )}
        </div>

    )
}
