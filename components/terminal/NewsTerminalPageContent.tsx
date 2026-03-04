import NewsTerminalClient from '@/app/(root)/news/_components/NewsTerminalClient';
import { loadTerminalNewsItems } from '@/lib/news/terminal-items';

const NewsTerminalPageContent = async () => {
    const items = await loadTerminalNewsItems();
    return <NewsTerminalClient items={items} generatedAt={new Date().toISOString()} />;
};

export default NewsTerminalPageContent;
