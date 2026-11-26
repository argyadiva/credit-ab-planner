import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Plan, Week } from './model';

const count = new Intl.NumberFormat('en');
const powerColor = '#7761a8';

export default function PowerChart({ plan }: { plan: Plan }) {
  const singleEstimate = plan.weeks.filter((week) => week.projectedPower !== null).length === 1;
  return (
    <div
      className="forecast-plot"
      role="img"
      aria-label={`Projected power of a ${plan.inputs.testType} test at ${plan.inputs.alpha}% alpha to detect the assumed reduction from ${(plan.pC * 100).toFixed(2)}% to ${(plan.pT * 100).toFixed(2)}% bad rate. Target power is ${plan.inputs.power}%. Planned final analysis is day ${plan.finalDay}. No power estimate is available until both arms have usable outcomes. The weekly table provides power and mature sample counts.`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={plan.weeks} margin={{ top: 24, right: 18, left: 0, bottom: 8 }}>
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
            domain={[0, 1]}
            ticks={[0, 0.2, 0.4, 0.6, 0.8, 1]}
            tickFormatter={(value) => `${Math.round(Number(value) * 100)}%`}
            tickLine={false}
            axisLine={false}
            width={62}
            tick={{ fontSize: 12, fill: '#64796d' }}
          />
          <Tooltip
            content={({ active, payload }) => {
              const week = payload?.[0]?.payload as Week | undefined;
              if (!active || !week || week.projectedPower === null) return null;
              return (
                <div className="power-tooltip">
                  <strong>Day {week.day} · week {week.week.toFixed(1)}</strong>
                  {week.date && <span>{week.date}</span>}
                  <span>Projected power: <b>{(week.projectedPower * 100).toFixed(2)}%</b></span>
                  <span>Usable control: <b>{count.format(week.matureC)}</b></span>
                  <span>Usable treatment: <b>{count.format(week.matureT)}</b></span>
                </div>
              );
            }}
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
          <ReferenceLine
            y={plan.inputs.power / 100}
            stroke="#879589"
            strokeDasharray="5 4"
          />
          <Line
            dataKey="projectedPower"
            type="linear"
            stroke={powerColor}
            strokeWidth={2.5}
            connectNulls={false}
            dot={singleEstimate ? { r: 4 } : false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
