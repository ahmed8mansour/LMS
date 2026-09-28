"use client"   
import { useQuery } from "@tanstack/react-query";
import { UserProfile } from "../types/auth.types";
import { useMemo } from "react";
import { useProfile } from "./useProfile";

export function usePasswordManagement() {
    // useQuery creates a subscription to the ['user', 'profile'] key
    const { data: user, isLoading } = useProfile()

    const mode: 'CHANGE' | 'SET' | 'UNAVAILABLE' = useMemo(() => {
        if (isLoading || !user) return 'UNAVAILABLE';
        return user.has_usable_password ? 'CHANGE' : 'SET';
    }, [user, isLoading]);

    return {
        mode,
        user,
        isLoading
    };
}