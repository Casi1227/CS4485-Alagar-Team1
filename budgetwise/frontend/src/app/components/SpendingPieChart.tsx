import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

export type SpendingPieDatum = { name: string; value: number; color: string };

const defaultSpendingData: SpendingPieDatum[] = [
  { name: 'Rent', value: 420, color: '#6366F1' },
  { name: 'Groceries', value: 180, color: '#16A34A' },
  { name: 'Tuition', value: 250, color: '#A855F7' },
  { name: 'Transportation', value: 85, color: '#4ECDC4' },
  { name: 'Entertainment', value: 125, color: '#F97316' },
  { name: 'Utilities', value: 67.5, color: '#D97706' },
  { name: 'Health', value: 45, color: '#0891B2' },
  { name: 'Dining', value: 320, color: '#DC2626' },
  { name: 'Other', value: 40, color: '#95A5A6' },
];

type SpendingPieChartProps = {
  data?: SpendingPieDatum[] | null;
};

export function SpendingPieChart({ data }: SpendingPieChartProps) {
  const spendingData = (data && data.length > 0) ? data : defaultSpendingData;
  return (
    <ResponsiveContainer width="100%" height={350}>
      <PieChart>
        <Pie
          data={spendingData}
          cx="50%"
          cy="50%"
          outerRadius={100}
          fill="#8884d8"
          dataKey="value"
        >
          {spendingData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}