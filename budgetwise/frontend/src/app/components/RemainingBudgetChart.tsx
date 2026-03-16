import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export type RemainingBudgetDatum = {
  category: string;
  allocated: number;
  spent: number;
  remaining: number;
};

const defaultRemainingData: RemainingBudgetDatum[] = [
  { category: 'Food & Dining', allocated: 400, spent: 320, remaining: 80 },
  { category: 'Transportation', allocated: 100, spent: 85, remaining: 15 },
  { category: 'Books & Supplies', allocated: 200, spent: 150, remaining: 50 },
  { category: 'Entertainment', allocated: 150, spent: 125, remaining: 25 },
  { category: 'Housing', allocated: 0, spent: 0, remaining: 0 },
  { category: 'Utilities', allocated: 100, spent: 67.5, remaining: 32.5 },
  { category: 'Personal Care', allocated: 100, spent: 60, remaining: 40 },
  { category: 'Other', allocated: 150, spent: 40, remaining: 110 },
];

type RemainingBudgetChartProps = {
  data?: RemainingBudgetDatum[] | null;
};

export function RemainingBudgetChart({ data }: RemainingBudgetChartProps) {
  const remainingData = (data && data.length > 0) ? data : defaultRemainingData;
  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={remainingData} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" tickFormatter={(v) => `$${v}`} />
        <YAxis
          dataKey="category"
          type="category"
          width={0}
          tick={false}
          axisLine={false}
        />
        <Tooltip
          formatter={(value: number) => [`$${value.toFixed(2)}`, undefined]}
          contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
        />
        <Legend />
        <Bar dataKey="spent" fill="#8884d8" name="Spent" />
        <Bar dataKey="remaining" name="Remaining" fill="#82ca9d" />
      </BarChart>
    </ResponsiveContainer>
  );
}