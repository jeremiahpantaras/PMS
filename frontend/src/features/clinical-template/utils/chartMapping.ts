import bodyChart from '@/assets/charts/body-chart.webp';
import headChart from '@/assets/charts/head-chart.webp';
import handChart from '@/assets/charts/hand-chart.webp';
import feetChart from '@/assets/charts/feet-chart.webp';
import type { ChartType } from '@/types/clinicalTemplate';

export const chartImageMap: Record<ChartType, string> = {
  body: bodyChart,
  head: headChart,
  hand: handChart,
  feet: feetChart,
};

export const chartLabel: Record<ChartType, string> = {
  body: 'Body Chart',
  head: 'Head Chart',
  hand: 'Hand Chart',
  feet: 'Feet Chart',
  spine: 'Spine Chart (deprecated)',
};
