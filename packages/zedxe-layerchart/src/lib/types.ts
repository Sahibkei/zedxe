export type HistogramDatum = {
  label: string;
  value: number;
};

export type GeoDatum = {
  region: string;
  value: number;
};

export type SankeyLink = {
  source: string;
  target: string;
  value: number;
};

export type ParsedResult<T> = {
  values: T[];
  error?: string;
};
