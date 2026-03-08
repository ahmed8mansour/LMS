import { useQuery } from '@tanstack/react-query';
import { authAPI } from '../api/auth.api';

export  function useProfile() {
    return useQuery({
        queryKey:['user' , 'profile'],
        queryFn:authAPI.userProfile,
        staleTime:Infinity,
        retry:false
    })
}




