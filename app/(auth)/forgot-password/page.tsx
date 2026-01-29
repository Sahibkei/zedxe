'use client';

import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import InputField from '@/components/forms/InputField';
import FooterLink from '@/components/forms/FooterLink';
import TurnstileWidget from '@/components/auth/TurnstileWidget';
import { toast } from 'sonner';

type ForgotPasswordFormData = {
    email: string;
};

const ForgotPasswordPage = () => {
    const {
        register,
        handleSubmit,
        watch,
        formState: { errors, isSubmitting },
    } = useForm<ForgotPasswordFormData>({
        defaultValues: {
            email: '',
        },
        mode: 'onBlur',
        reValidateMode: 'onChange',
    });
    const [emailValue] = watch(['email']);
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
    const [turnstileMessage, setTurnstileMessage] = useState<string | null>(null);
    const [resetTurnstile, setResetTurnstile] = useState<(() => void) | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [requestId, setRequestId] = useState<string | null>(null);
    const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
    const turnstileRequired = turnstileEnabled;
    const formReady = Boolean(emailValue?.trim());
    const isProduction = process.env.NODE_ENV === 'production';

    const handleTurnstileSuccess = useCallback((token: string) => {
        setTurnstileToken(token);
        setTurnstileMessage(null);
    }, []);

    const handleTurnstileExpire = useCallback(() => {
        setTurnstileToken(null);
        setTurnstileMessage('Verification expired. Please try again.');
    }, []);

    const handleTurnstileError = useCallback(() => {
        setTurnstileToken(null);
        setTurnstileMessage('Verification failed. Please retry.');
    }, []);

    const getErrorMessage = useCallback((error?: string) => {
        if (!error) return 'Failed to request password reset.';
        switch (error) {
            case 'turnstile_missing':
                return 'Please complete the human verification.';
            case 'turnstile_failed':
            case 'turnstile_invalid':
                return 'Human verification failed. Please try again.';
            case 'turnstile_misconfigured':
                return 'Human verification is unavailable. Please try again later.';
            case 'invalid_json':
                return 'Please enter a valid email address.';
            default:
                return error;
        }
    }, []);

    const onSubmit = async (data: ForgotPasswordFormData) => {
        setSuccessMessage(null);
        setRequestId(null);
        try {
            if (!turnstileEnabled) {
                setTurnstileMessage('Human verification is not configured.');
                return;
            }
            if (turnstileRequired && !turnstileToken) {
                setTurnstileMessage('Please complete the human verification.');
                return;
            }

            const response = await fetch('/api/auth/request-password-reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: data.email,
                    redirectTo: `${window.location.origin}/reset-password`,
                    turnstileToken,
                }),
            });

            const contentType = response.headers.get('content-type') ?? '';
            const payload = contentType.includes('application/json') ? await response.json() : null;

            if (response.ok) {
                setSuccessMessage(
                    payload?.message ?? 'If an account exists, we sent a reset link.',
                );
                setTurnstileMessage(null);
                setRequestId(payload?.requestId ?? null);
                return;
            }

            const errorCode = payload?.code ?? payload?.error;
            const responseRequestId = payload?.requestId ?? null;
            setTurnstileToken(null);
            resetTurnstile?.();

            if (typeof errorCode === 'string' && errorCode.startsWith('turnstile')) {
                setTurnstileMessage(getErrorMessage(errorCode));
            }

            if (response.status >= 500) {
                setRequestId(responseRequestId);
                toast.error('Request failed', {
                    description: 'We couldn’t send the email right now. Please try again later.',
                });
                return;
            }

            const debugSuffix = !isProduction && errorCode ? ` (${errorCode})` : '';
            toast.error('Request failed', {
                description: `${getErrorMessage(errorCode)}${debugSuffix}`,
            });
        } catch (error) {
            console.error(error);
            setTurnstileToken(null);
            resetTurnstile?.();
            toast.error('Request failed', {
                description: error instanceof Error ? error.message : 'Failed to request reset.',
            });
        }
    };

    return (
        <>
            <h1 className="form-title">Forgot your password?</h1>
            <p className="text-sm text-gray-400 mb-6">
                Enter your email and we will send a reset link if an account exists. Check your spam or promotions folders if you do not see it.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <InputField
                    name="email"
                    label="Email"
                    placeholder="contact@jsmastery.com"
                    register={register}
                    error={errors.email}
                    validation={{ required: 'Email is required', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ }}
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
                {turnstileMessage ? <p className="text-xs text-red-400">{turnstileMessage}</p> : null}
                {successMessage ? (
                    <div className="text-xs text-emerald-400 space-y-1">
                        <p>{successMessage}</p>
                        <p className="text-gray-400">Remember to check spam or promotions folders.</p>
                        {requestId ? (
                            <p className="text-[11px] text-gray-500">Request ID: {requestId}</p>
                        ) : null}
                    </div>
                ) : null}
                {!successMessage && requestId ? (
                    <p className="text-[11px] text-gray-500">Request ID: {requestId}</p>
                ) : null}

                <Button
                    type="submit"
                    disabled={isSubmitting || !formReady || !turnstileEnabled || (turnstileRequired && !turnstileToken)}
                    className="blue-btn w-full mt-5 text-white"
                >
                    {isSubmitting ? 'Sending' : 'Send reset link'}
                </Button>

                <FooterLink text="Remembered your password?" linkText="Back to sign in" href="/sign-in" />
            </form>
        </>
    );
};

export default ForgotPasswordPage;
