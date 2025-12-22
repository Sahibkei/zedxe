'use client';

import { useCallback, useState } from "react";
import {useForm} from "react-hook-form";
import {Button} from "@/components/ui/button";
import InputField from "@/components/forms/InputField";
import SelectField from "@/components/forms/SelectField";
import {INVESTMENT_GOALS, PREFERRED_INDUSTRIES, RISK_TOLERANCE_OPTIONS} from "@/lib/constants";
import {CountrySelectField} from "@/components/forms/CountrySelectField";
import FooterLink from "@/components/forms/FooterLink";
import TurnstileWidget from "@/components/auth/TurnstileWidget";
import {signUpWithEmail} from "@/lib/actions/auth.actions";
import type { SignUpFormData } from "@/lib/types/auth";
import {useRouter, useSearchParams} from "next/navigation";
import { safeRedirect } from "@/lib/safeRedirect";
import {toast} from "sonner";

const SignUp = () => {
    const router = useRouter()
    const searchParams = useSearchParams();
    const redirectTo = safeRedirect(searchParams.get("redirect"), "/dashboard");
    const {
        register,
        handleSubmit,
        control,
        watch,
        formState: { errors, isSubmitting },
    } = useForm<SignUpFormData>({
        defaultValues: {
            fullName: '',
            email: '',
            password: '',
            country: 'US',
            investmentGoals: 'Growth',
            riskTolerance: 'Medium',
            preferredIndustry: 'Technology'
        },
        mode: 'onBlur',
        reValidateMode: 'onChange',
    }, );
    const [fullNameValue, emailValue, passwordValue] = watch(["fullName", "email", "password"]);
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
    const [turnstileMessage, setTurnstileMessage] = useState<string | null>(null);
    const [resetTurnstile, setResetTurnstile] = useState<(() => void) | null>(null);
    const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
    const turnstileRequired = turnstileEnabled;
    const formReady = Boolean(fullNameValue?.trim() && emailValue?.trim() && passwordValue?.trim());
    const handleTurnstileSuccess = useCallback((token: string) => {
        setTurnstileToken(token);
        setTurnstileMessage(null);
    }, []);
    const handleTurnstileExpire = useCallback(() => {
        setTurnstileToken(null);
        setTurnstileMessage("Verification expired. Please try again.");
    }, []);
    const handleTurnstileError = useCallback(() => {
        setTurnstileToken(null);
        setTurnstileMessage("Verification failed. Please retry.");
    }, []);
    const getErrorMessage = useCallback((error?: string) => {
        if (!error) return "Failed to create an account.";
        switch (error) {
            case "turnstile_missing":
                return "Please complete the human verification.";
            case "turnstile_invalid":
            case "turnstile_failed":
                return "Human verification failed. Please try again.";
            case "turnstile_misconfigured":
                return "Human verification is unavailable. Please try again later.";
            case "email_taken":
                return "An account with this email already exists.";
            default:
                return error;
        }
    }, []);
    const isProduction = process.env.NODE_ENV === "production";

    const onSubmit = async (data: SignUpFormData) => {
        try {
            if (!turnstileEnabled) {
                setTurnstileMessage("Human verification is not configured.");
                return;
            }
            if (turnstileRequired && !turnstileToken) {
                setTurnstileMessage("Please complete the human verification.");
                return;
            }
            const result = await signUpWithEmail({ ...data, turnstileToken });
            if(result.success) {
                router.push(redirectTo);
                return;
            }
            setTurnstileToken(null);
            resetTurnstile?.();
            if (typeof result.error === "string" && result.error.startsWith("turnstile")) {
                setTurnstileMessage(getErrorMessage(result.error));
            }
            const debugSuffix = !isProduction && result.error ? ` (${result.error})` : "";
            toast.error('Sign up failed', {
                description: `${getErrorMessage(result.error)}${debugSuffix}`,
            });
        } catch (e) {
            console.error(e);
            setTurnstileToken(null);
            resetTurnstile?.();
            toast.error('Sign up failed', {
                description: e instanceof Error ? e.message : 'Failed to create an account.'
            })
        }
    }

    return (
        <>
            <h1 className="form-title">Sign Up & Personalize</h1>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <InputField
                    name="fullName"
                    label="Full Name"
                    placeholder="John Doe"
                    register={register}
                    error={errors.fullName}
                    validation={{ required: 'Full name is required', minLength: 2 }}
                />

                <InputField
                    name="email"
                    label="Email"
                    placeholder="contact@jsmastery.com"
                    register={register}
                    error={errors.email}
                    validation={{ required: 'Email name is required', pattern: /^\w+@\w+\.\w+$/, message: 'Email address is required' }}
                />

                <InputField
                    name="password"
                    label="Password"
                    placeholder="Enter a strong password"
                    type="password"
                    register={register}
                    error={errors.password}
                    validation={{ required: 'Password is required', minLength: 8 }}
                />

                <CountrySelectField
                    name="country"
                    label="Country"
                    control={control}
                    error={errors.country}
                    required
                />

                <SelectField
                    name="investmentGoals"
                    label="Investment Goals"
                    placeholder="Select your investment goal"
                    options={INVESTMENT_GOALS}
                    control={control}
                    error={errors.investmentGoals}
                    required
                />

                <SelectField
                    name="riskTolerance"
                    label="Risk Tolerance"
                    placeholder="Select your risk level"
                    options={RISK_TOLERANCE_OPTIONS}
                    control={control}
                    error={errors.riskTolerance}
                    required
                />

                <SelectField
                    name="preferredIndustry"
                    label="Preferred Industry"
                    placeholder="Select your preferred industry"
                    options={PREFERRED_INDUSTRIES}
                    control={control}
                    error={errors.preferredIndustry}
                    required
                />

                <TurnstileWidget
                    onSuccess={handleTurnstileSuccess}
                    onExpire={handleTurnstileExpire}
                    onError={handleTurnstileError}
                    onResetRef={setResetTurnstile}
                />
                {!turnstileEnabled ? (
                    <p className="text-xs text-red-400">Human verification is not configured.</p>
                ) : null}
                {turnstileMessage ? (
                    <p className="text-xs text-red-400">{turnstileMessage}</p>
                ) : null}

                 <Button
                    type="submit"
                    disabled={isSubmitting || !formReady || !turnstileEnabled || (turnstileRequired && !turnstileToken)}
                    className="blue-btn w-full mt-5 text-white"
                >
                    {isSubmitting ? 'Creating Account' : 'Start Your Investing Journey'}
                </Button>

                <FooterLink text="Already have an account?" linkText="Sign in" href="/sign-in" />
            </form>
        </>
    )
}
export default SignUp;
