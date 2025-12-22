export type SignUpFormData = {
    fullName: string;
    email: string;
    password: string;
    country?: string;
    investmentGoals?: string;
    riskTolerance?: string;
    preferredIndustry?: string;
};

export type SignInFormData = {
    email: string;
    password: string;
};
