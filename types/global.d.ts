declare global {
    type SignInFormData = {
        email: string;
        password: string;
        turnstileToken?: string | null;
    };

    type SignUpFormData = {
        fullName: string;
        email: string;
        password: string;
        country: string;
        investmentGoals: string;
        riskTolerance: string;
        preferredIndustry: string;
        turnstileToken?: string | null;
    };

    type CountrySelectProps = {
        name: string;
        label: string;
        control: Control;
        error?: FieldError;
        required?: boolean;
    };

    type FormInputProps = {
        name: string;
        label: string;
        placeholder: string;
        type?: string;
        register: UseFormRegister;
        error?: FieldError;
        validation?: RegisterOptions;
        disabled?: boolean;
        value?: string;
    };

    type Option = {
        value: string;
        label: string;
    };

    type SelectFieldProps = {
        name: string;
        label: string;
        placeholder: string;
        options: readonly Option[];
        control: Control;
        error?: FieldError;
        required?: boolean;
    };

    type FooterLinkProps = {
        text: string;
        linkText: string;
        href: string;
    };

    type SearchCommandProps = {
        renderAs?: 'button' | 'text';
        label?: string;
        initialStocks: StockWithWatchlistStatus[];
    };

    type WelcomeEmailData = {
        email: string;
        name: string;
        intro: string;
    };

    type User = {
        id: string;
        name: string;
        email: string;
    };

    type Stock = {
        symbol: string;
        name: string;
        exchange: string;
        type: string;
    };

    type StockWithWatchlistStatus = Stock & {
        isInWatchlist: boolean;
    };

    type AlertCondition = 'greater_than' | 'less_than' | 'crosses_above' | 'crosses_below';

    type AlertFrequency = 'once' | 'once_per_day' | 'once_per_hour';

    type FinnhubSearchResult = {
        symbol: string;
        description: string;
        displaySymbol?: string;
        type: string;
    };

    type FinnhubSearchResponse = {
        count: number;
        result: FinnhubSearchResult[];
    };

    type StockDetailsPageProps = {
        params: Promise<{
            symbol: string;
        }>;
    };

    type WatchlistButtonProps = {
        symbol: string;
        company: string;
        isInWatchlist: boolean;
        showTrashIcon?: boolean;
        type?: 'button' | 'icon';
        onWatchlistChange?: (symbol: string, isAdded: boolean) => void;
    };

    type QuoteData = {
        c?: number;
        dp?: number;
    };

    type ProfileData = {
        name?: string;
        marketCapitalization?: number;
    };

    type FinancialsData = {
        metric?: { [key: string]: number };
    };

    type SelectedStock = {
        symbol: string;
        company: string;
        currentPrice?: number;
    };

    type WatchlistEntryWithData = {
        symbol: string;
        company: string;
        currentPrice?: number;
        priceFormatted?: string;
        changeFormatted?: string;
        changePercent?: number;
        marketCap?: number;
        peRatio?: number;
    };

    type AlertsListProps = {
        alertData: AlertDisplay[] | undefined;
    };

    type MarketNewsArticle = {
        id: number;
        headline: string;
        summary: string;
        source: string;
        url: string;
        datetime: number;
        category: string;
        related: string;
        image?: string;
    };

    type WatchlistNewsProps = {
        news?: MarketNewsArticle[];
    };

    type AlertFormState = {
        alertId?: string;
        symbol: string;
        company: string;
        alertName: string;
        condition: AlertCondition;
        thresholdValue: number | '';
        frequency: AlertFrequency;
        isActive?: boolean;
    };

    type AlertModalProps = {
        open: boolean;
        onClose: () => void;
        initialState: AlertFormState;
        onSave?: (alert: AlertDisplay) => void;
    };

    type RawNewsArticle = {
        id: number;
        headline?: string;
        summary?: string;
        source?: string;
        url?: string;
        datetime?: number;
        image?: string;
        category?: string;
        related?: string;
    };

    type AlertDisplay = {
        id: string;
        userId: string;
        symbol: string;
        company: string;
        alertName: string;
        condition: AlertCondition;
        thresholdValue: number;
        frequency: AlertFrequency;
        isActive: boolean;
        createdAt: Date | string;
        lastTriggeredAt?: Date | string | null;
        lastPrice?: number | null;
    };

    type UserForNewsEmail = {
        id: string;
        email: string;
        name?: string;
    };
}

export {};
