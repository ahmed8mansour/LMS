import Cookies from 'js-cookie';


/**
 * The non-sensitive routing role carried by the `role` cookie (set by the backend).
 * Used for role-aware redirects and shell decisions only — never as an authorization
 * check. The backend permission classes remain the real gate.
 */
export type RoutingRole = "student" | "instructor" | "admin";

/**
 * Read the routing role from the readable `role` cookie. Unknown/missing values
 * resolve to "student" (least-privilege default).
 */
export const readRoutingRole = (): RoutingRole => {
    const value = Cookies.get('role');
    return value === "instructor" || value === "admin" ? value : "student";
};

/** The path an authenticated user should land on for their routing role. */
export const roleHomePath = (role: RoutingRole = readRoutingRole()): string => {
    if (role === "instructor") return "/instructor";
    if (role === "admin") return "/admin-unavailable";
    return "/dashboard";
};


export const getCookies =  (TOKEN_KEY:string) =>  Cookies.get(TOKEN_KEY)


export const removeCookies  =  (TOKEN_KEY:string) => Cookies.remove(TOKEN_KEY)


export const setCookies =  (TOKEN_KEY:string, token:string) => {

    Cookies.set(TOKEN_KEY , token , {
        secure: true,
        sameSite: 'strict',
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 
    })

}


export  const setTokenCookies = async ({access_token , refresh_token } : { access_token : string , refresh_token : string}) => {
    await fetch('/api/auth/set-tokens', {
        method: 'POST',
        body: JSON.stringify({
            access_token: access_token,
            refresh_token: refresh_token,
        }),
    });
}

