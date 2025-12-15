export function buildSecArchiveUrl(cik10: string | number, accessionNumber: string, primaryDocument: string) {
    const cikPlain = String(Number(cik10));
    const accPlain = accessionNumber.replace(/-/g, "");
    return `https://www.sec.gov/Archives/edgar/data/${cikPlain}/${accPlain}/${primaryDocument}`;
}
