import Cookies from 'js-cookie';



export const getCookies =  (TOKEN_KEY:string) =>  Cookies.get(TOKEN_KEY)


export const removeCookies  =  (TOKEN_KEY:string) => Cookies.remove(TOKEN_KEY)


export const setCookies =  (TOKEN_KEY:string, token:string) => {

    console.log(TOKEN_KEY)
    console.log(token)
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

