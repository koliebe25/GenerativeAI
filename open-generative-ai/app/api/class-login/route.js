import { NextResponse } from 'next/server';
import {
    CLASS_COOKIE,
    CLASS_SESSION_SECONDS,
    classSessionToken,
    getClassConfig,
    isPasscodeCorrect,
} from '@/lib/classAccess';

function cookieOptions(request, maxAge) {
    return {
        httpOnly: true,
        secure: new URL(request.url).protocol === 'https:',
        sameSite: 'lax',
        path: '/',
        maxAge,
    };
}

// POST { passcode } -> sets the class session cookie.
export async function POST(request) {
    const config = getClassConfig();
    if (!config.gateEnabled) {
        return NextResponse.json({ ok: true, gate: false });
    }

    let passcode = '';
    try {
        const body = await request.json();
        passcode = typeof body?.passcode === 'string' ? body.passcode : '';
    } catch {
        // fall through with an empty passcode
    }

    if (!(await isPasscodeCorrect(passcode, config))) {
        // Slow down guessing a little.
        await new Promise((resolve) => setTimeout(resolve, 800));
        return NextResponse.json({ ok: false, error: 'wrong_passcode' }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(CLASS_COOKIE, await classSessionToken(config), cookieOptions(request, CLASS_SESSION_SECONDS));
    return response;
}

// DELETE -> leaves the class (clears the session cookie).
export async function DELETE(request) {
    const response = NextResponse.json({ ok: true });
    response.cookies.set(CLASS_COOKIE, '', cookieOptions(request, 0));
    return response;
}
