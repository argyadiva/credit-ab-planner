import {
  Area,
  CartesianGrid,
  ComposedChart,
  ErrorBar,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Plan } from './model';

const controlColor = '#526fa4';
const treatmentColor = '#247457';

export function forecastData(plan: Plan) {
  return plan.weeks.map((week) => ({
    day: week.day,
    control: week.expectedC ? plan.pC * 100 : null,
    treatment: week.expectedT ? plan.pT * 100 : null,
    controlInterval: week.expectedC?.map((value) => value * 100) ?? null,
    treatmentInterval: week.expectedT?.map((value) => value * 100) ?? null,
    controlError: week.expectedC
      ? [(plan.pC - week.expectedC[0]) * 100, (week.expectedC[1] - plan.pC) * 100]
      : null,
    treatmentError: week.expectedT
      ? [(plan.pT - week.expectedT[0]) * 100, (week.expectedT[1] - plan.pT) * 100]
      : null,
  }));
}

export default function ForecastChart({ plan }: { plan: Plan }) {
  const data = forecastData(plan);
  const singleControl = data.filter((row) => row.control !== null).length === 1;
  const singleTreatment = data.filter((row) => row.treatment !== null).length === 1;
  const bounds = data.flatMap((row) => [
    ...(row.controlInterval ?? []),
    ...(row.treatmentInterval ?? []),
  ]);
  const min = Math.min(...bounds);
  const max = Math.max(...bounds);
  const padding = Math.max((max - min) * 0.08, 0.1);
  return (
    <div
      className="forecast-plot"
      role="img"
      aria-label={`Projected control baseline ${(plan.pC * 100).toFixed(2)}% and treatment bad rate ${(plan.pT * 100).toFixed(2)}%, with ${plan.inputs.confidence}% confidence bands over ${plan.finalDay} ${plan.finalDay === 1 ? 'day' : 'days'}. Assumed rates stay constant while uncertainty narrows as usable samples grow. The weekly table provides the numeric values.`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 24, right: 18, left: 0, bottom: 8 }}>
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
            type="number"
            domain={[Math.max(0, min - padding), Math.min(100, max + padding)]}
            allowDataOverflow
            tickFormatter={(value) => `${Number(value).toFixed(1)}%`}
            tickLine={false}
            axisLine={false}
            width={62}
            tick={{ fontSize: 12, fill: '#64796d' }}
          />
          <Tooltip
            labelFormatter={(day) => `Day ${day} · week ${(Number(day) / 7).toFixed(1)}`}
            formatter={(value, name) => {
              const isControl = name === 'control' || name === 'controlInterval';
              const label = isControl ? 'Control baseline' : 'Expected treatment';
              return Array.isArray(value)
                ? [`${Number(value[0]).toFixed(2)}% to ${Number(value[1]).toFixed(2)}%`, `${label} · ${plan.inputs.confidence}% two-sided CI`]
                : [`${Number(value).toFixed(2)}%`, label];
            }}
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
          <Area
            dataKey="controlInterval"
            type="linear"
            stroke="none"
            fill={controlColor}
            fillOpacity={0.13}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Area
            dataKey="treatmentInterval"
            type="linear"
            stroke="none"
            fill={treatmentColor}
            fillOpacity={0.15}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            dataKey="control"
            type="linear"
            stroke={controlColor}
            strokeDasharray="6 4"
            strokeWidth={2.5}
            dot={singleControl ? { r: 4 } : false}
            activeDot={{ r: 4 }}
            connectNulls={false}
            isAnimationActive={false}
          >
            {singleControl && (
              <ErrorBar dataKey="controlError" direction="y" width={5} stroke={controlColor} strokeWidth={2} />
            )}
          </Line>
          <Line
            dataKey="treatment"
            type="linear"
            stroke={treatmentColor}
            strokeWidth={2.5}
            dot={singleTreatment ? { r: 4 } : false}
            activeDot={{ r: 4 }}
            connectNulls={false}
            isAnimationActive={false}
          >
            {singleTreatment && (
              <ErrorBar dataKey="treatmentError" direction="y" width={5} stroke={treatmentColor} strokeWidth={2} />
            )}
          </Line>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
