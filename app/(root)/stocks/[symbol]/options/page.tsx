import OptionsAnalysisContent from "./OptionsAnalysisContent";

type OptionsAnalysisPageProps = {
    params: Promise<{
        symbol: string;
    }>;
};

export default async function OptionsAnalysisPage({ params }: OptionsAnalysisPageProps) {
    const { symbol } = await params;
    const symbolUpper = symbol.toUpperCase();

    return <OptionsAnalysisContent symbol={symbolUpper} />;
}
