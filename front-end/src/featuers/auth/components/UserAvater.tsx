"use client";
import Link from "next/link";
import { useProfile } from "../hooks/useProfile";
import { MdPestControl } from "react-icons/md";

import { Skeleton } from "@/components/atoms/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/atoms/avatar"
import { Button } from "@/components/atoms/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/atoms/dropdown-menu"
import {
  BadgeCheckIcon,
  BellIcon,
  CreditCardIcon,
  LogOutIcon,
} from "lucide-react"
import { useRouter } from "next/navigation";
import { useLogout } from "../hooks/useLogout";

export function UserAvater() {
    const { data: user, isLoading : isFetchingUserData, isError: FetchingUserDataFailed  } = useProfile();
    const { mutate:DoLogout, isPending : isLogginout , isSuccess:LoggedOutSuccessfully , isError : LogingoutFailed  } = useLogout();
    const router = useRouter()
    



    if (isFetchingUserData) return <Skeleton className="w-8 h-8 rounded-full bg-darkmint/40" />;
    
    if (FetchingUserDataFailed || !user) {
        return (
            <div className="flex gap-2">
                <Link href={"/login"}>
                    <Button className="text-darktext" variant={"ghost"}>
                        log in
                    </Button>
                </Link>
                <Link href={"/register"}>
                    <Button className="w-30 h-9" variant={"darkmint"}>
                        Join for Free
                    </Button>
                </Link>
            </div>
        );
    }

    const Logout = () => {
        DoLogout(undefined, {
            onSuccess: () => {
                router.push('/login');
            },
        });
    }


    return(
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-lg" className="rounded-full">
                <Avatar>
                    <AvatarImage src={user.profile_picture} alt="shadcn" />
                    <AvatarFallback>LR</AvatarFallback>
                </Avatar>
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                    
                        <DropdownMenuItem onClick={() => router.push('dashboard/profile')} >
                            <BadgeCheckIcon />
                            Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push('dashboard')}>
                            <MdPestControl />
                            Dashboard
                        </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={isLogginout} onClick={Logout} >
                    <LogOutIcon />
                    Sign Out
                </DropdownMenuItem>
            </DropdownMenuContent>

        </DropdownMenu>
    );
}


