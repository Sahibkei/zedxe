/**
 * Route entry for the Options Analysis shell. Reads the symbol from params and renders the shell UI.
 */
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
