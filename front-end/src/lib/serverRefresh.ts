import axios from '@/lib/axios';
import { cookies } from 'next/headers';
export async function serverRefreshToken(): Promise<boolean> {
    try {
            const cookieStore = await cookies();
            const refreshToken = cookieStore.get('refresh_token');
            const all_cookies = cookieStore.toString()
            if (!refreshToken) {
                console.log('No refresh token found');
                return false;
            }

            try { 
                const response  = await axios.post("/auth/token/refresh/",{},{
                    headers:{
                        Cookie:all_cookies
                    },
                });
                console.log('✅ Token refreshed successfully');
                const res_cookies:any = response.headers['set-cookie']
                const access_token = res_cookies[0]
                console.log(access_token)
                // اعمل ريكست للروت هاندلر هنا 
                // const setCookies = await
                // const [nameValue , expires, ...rest] = access_token.split(';');
                // const [name, value] = nameValue.split('=');
                // const [expire, time] = expires.split('=');

                // const expiresintime = new Date(time)
                // console.log(expiresintime)

                // cookieStore.set(name.trim() , value.trim(),
                //     {
                //         path:'/',
                //         sameSite:'lax',
                //         httpOnly:true,
                //         expires:expiresintime
                //     }
                // )

                return true;

            }catch(error:any){
                console.log(error)
                console.log('❌ Refresh token failed:', error.response?.status);
                console.log('❌ Refresh token failed:', error.response?.data);
                return false;
            }
    } catch (error) {
        console.error('❌ Server refresh error:', error);
        return false;
    }
}