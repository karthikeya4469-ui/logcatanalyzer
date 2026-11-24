import { Activity } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const series = [
  ['JAVA_CRASH', '#fb7185'],
  ['ANR', '#fbbf24'],
  ['NATIVE_TOMBSTONE', '#c084fc'],
  ['SYSTEM_KERNEL_HW', '#38bdf8'],
  ['CUSTOM_APP_TAG', '#6ee7c0'],
]

export default function TimelineChart({ data }) {
  return (
    <section className="rounded-xl border border-line bg-panel p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Event timeline</h2>
          <p className="mt-1 text-xs text-muted">Detected events grouped by hour from log timestamps</p>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-2">
          {series.map(([key, color]) => (
            <span key={key} className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <i className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} /> {key.replaceAll('_', ' ').toLowerCase()}
            </span>
          ))}
        </div>
      </div>
      {data.length ? (
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="#202a38" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="time" tick={{ fill: '#8290a4', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis allowDecimals={false} tick={{ fill: '#8290a4', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#101722', border: '1px solid #293546', borderRadius: 8, color: '#e2e8f0', fontSize: 12 }}
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              />
              {series.map(([key, color]) => <Bar key={key} dataKey={key} stackId="events" fill={color} maxBarSize={28} />)}
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex h-56 flex-col items-center justify-center gap-2 text-center">
          <div className="rounded-full bg-slate-800 p-3 text-slate-500"><Activity className="h-5 w-5" /></div>
          <p className="text-sm text-slate-400">No timestamped events to chart</p>
          <p className="text-xs text-slate-600">Run a scan to populate the timeline</p>
        </div>
      )}
    </section>
  )
}
