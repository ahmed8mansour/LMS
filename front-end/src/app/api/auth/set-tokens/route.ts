import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
    const { access_token } = await req.json();
    const generalCookies = await cookies()
    generalCookies.set('access_token', access_token, {
        httpOnly: true,
        secure: true,
        path: '/',
        sameSite: 'lax',
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return NextResponse.json({ success: true });
}