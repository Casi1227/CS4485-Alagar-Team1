import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line } from 'recharts';

const progressData = [
  { day: 'Feb 1', spent: 0, budget: 0 },
  { day: 'Feb 4', spent: 125, budget: 160 },
  { day: 'Feb 7', spent: 280, budget: 320 },
  { day: 'Feb 10', spent: 420, budget: 480 },
  { day: 'Feb 13', spent: 580, budget: 640 },
  { day: 'Feb 16', spent: 715, budget: 800 },
  { day: 'Feb 19', spent: 847.50, budget: 950 },
  { day: 'Feb 22', spent: 847.50, budget: 1100 },
  { day: 'Feb 28', spent: 847.50, budget: 1200 },
];

export function BudgetProgressChart() {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <AreaChart data={progressData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="day" />
        <YAxis />
        <Tooltip formatter={(value) => `$${value}`} />
        <Area 
          type="monotone" 
          dataKey="budget" 
          stroke="#82ca9d" 
          fill="#82ca9d" 
          fillOpacity={0.3}
          name="Expected Budget"
        />
        <Area 
          type="monotone" 
          dataKey="spent" 
          stroke="#8884d8" 
          fill="#8884d8" 
          fillOpacity={0.6}
          name="Actual Spending"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
