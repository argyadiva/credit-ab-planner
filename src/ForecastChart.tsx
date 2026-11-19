import {
  Area,
  CartesianGrid,
  ComposedChart,
  ErrorBar,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Plan } from './model';

export default function ForecastChart({ plan }: { plan: Plan }) {
  const data = plan.weeks.map((week) => ({
    day: week.day,
    reduction: week.expectedDifference ? plan.delta * 100 : null,
    interval: week.expectedDifference?.map((value) => value * 100) ?? null,
    error: week.expectedDifference
      ? [
          (plan.delta - week.expectedDifference[0]) * 100,
          (week.expectedDifference[1] - plan.delta) * 100,
        ]
      : null,
  }));
  const singleEstimate = data.filter((row) => row.reduction !== null).length === 1;
  return (
    <div
      className="forecast-plot"
      role="img"
      aria-label={`Projected ${plan.inputs.confidence}% confidence interval for the bad-rate reduction over ${plan.finalDay} ${plan.finalDay === 1 ? 'day' : 'days'}. Positive reduction means fewer bad loans. The weekly table provides the numeric values.`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 24, right: 18, left: 0, bottom: 8 }}>
          <defs>
            <linearGradient id="forecast-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#40947a" stopOpacity={0.26} />
              <stop offset="100%" stopColor="#40947a" stopOpacity={0.08} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#e5ece8" strokeDasharray="3 5" />
          <XAxis
            dataKey="day"
            type="number"
            domain={[0, plan.finalDay]}
            tickFormatter={(day) => `${Math.round(day / 7)}w`}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: '#64796d' }}
            minTickGap={30}
          />
          <YAxis
            tickFormatter={(value) => Number(value).toFixed(1)}
            tickLine={false}
            axisLine={false}
            width={46}
            tick={{ fontSize: 12, fill: '#64796d' }}
          />
          <Tooltip
            labelFormatter={(day) => `Day ${day} · week ${(Number(day) / 7).toFixed(1)}`}
            formatter={(value, name) =>
              name === 'interval'
                ? [
                    Array.isArray(value)
                      ? `${Number(value[0]).toFixed(2)} to ${Number(value[1]).toFixed(2)} pp`
                      : value,
                    `${plan.inputs.confidence}% interval`,
                  ]
                : [`${Number(value).toFixed(2)} pp`, 'Assumed reduction']
            }
            contentStyle={{ borderRadius: 10, border: '1px solid #dbe5df', fontSize: 14 }}
          />
          {plan.lagDays > 0 && (
            <ReferenceArea
              x1={0}
              x2={plan.lagDays}
              fill="#eef2f0"
              fillOpacity={0.55}
              label={{ value: 'Label delay', position: 'insideTop', fill: '#778c7f', fontSize: 12 }}
            />
          )}
          <ReferenceLine y={0} stroke="#9baea1" strokeDasharray="5 4" />
          <Area
            dataKey="interval"
            type="linear"
            stroke="none"
            fill="url(#forecast-fill)"
            isAnimationActive={false}
          />
          <Line
            dataKey="reduction"
            type="linear"
            stroke="#247457"
            strokeWidth={2.5}
            dot={singleEstimate ? { r: 4 } : false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          >
            {singleEstimate && (
              <ErrorBar dataKey="error" direction="y" width={5} stroke="#247457" strokeWidth={2} />
            )}
          </Line>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
