'use server';

import {auth} from "@/lib/better-auth/auth";
import {inngest} from "@/lib/inngest/client";
import {headers} from "next/headers";

export const signUpWithEmail = async ({email, password, fullName, country, investmentGoals, riskTolerance, preferredIndustry}: SignUpFormData) => {
    try {
        const response = await auth.api.signUpEmail({body: { email, password, name: fullName }})

        if (response) {
            await inngest.send({
                email,
                name: fullName,
                country,
                investmentGoals,
                riskTolerance,
                preferredIndustry

            })
        }

        return { success: true, data: response }
    } catch (e) {
        console.log('Sign Up Failed', e);
        return { success: false, error: 'Sign Up Failed' };
    }
}

export const signInWithEmail = async ({email, password }: SignInFormData) => {
    try {
        const response = await auth.api.signInEmail({body: { email, password }})

        return { success: true, data: response }
    } catch (e) {
        console.log('Sign In Failed', e);
        return { success: false, error: 'Sign In Failed' };
    }
}


export const signOut = async () => {
    try {
        await auth.api.signOut({ headers: await headers() });
    } catch (e) {
        console.log('Sign Out Failed', e);
        return { success: false, error: 'Sign Out Failed' };
    }
}