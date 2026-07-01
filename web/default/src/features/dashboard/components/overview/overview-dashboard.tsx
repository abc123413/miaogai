/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { formatQuota, formatNumber } from '@/lib/format'
import { computeTimeRange } from '@/lib/time'
import { cn } from '@/lib/utils'
import { getUserQuotaDates } from '@/features/dashboard/api'
import type { QuotaDataItem } from '@/features/dashboard/types'
import { useDashboardContentVisibility } from '../../hooks/use-status-data'
import { AnnouncementsPanel } from './announcements-panel'

const TIME_RANGE_OPTIONS = [
  { key: 'today', label: 'Today', days: 0 },
  { key: '7d', label: '7 Days', days: 7 },
  { key: '30d', label: '30 Days', days: 30 },
] as const

type TimeRangeKey = (typeof TIME_RANGE_OPTIONS)[number]['key']

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 6) return 'Good night'
  if (hour < 12) return 'Good morning'
  if (hour < 14) return 'Good afternoon'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

interface MetricPair {
  label: string
  value: string
}

interface StatGroup {
  title: string
  color: string
  metrics: [MetricPair, MetricPair]
}

function StatGroupCard({ group }: { group: StatGroup }) {
  return (
    <div className="bg-card overflow-hidden rounded-xl border shadow-xs">
      <div className={cn('px-4 py-2 text-xs font-semibold text-white', group.color)}>
        {group.title}
      </div>
      <div className="grid grid-cols-2 divide-x divide-border">
        {group.metrics.map((metric) => (
          <div key={metric.label} className="px-4 py-3">
            <div className="text-muted-foreground text-xs">{metric.label}</div>
            <div className="text-foreground mt-1 text-base font-semibold tabular-nums">
              {metric.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function buildChartData(
  data: QuotaDataItem[],
  days: number
): { date: string; quota: number }[] {
  if (!data.length) return []

  const bucketMap = new Map<string, number>()

  for (const item of data) {
    const ts = Number(item.created_at) * 1000
    if (!ts) continue
    const d = new Date(ts)
    const key =
      days <= 1
        ? `${d.getHours().toString().padStart(2, '0')}:00`
        : `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`
    bucketMap.set(key, (bucketMap.get(key) ?? 0) + (Number(item.quota) || 0))
  }

  return Array.from(bucketMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, quota]) => ({ date, quota }))
}

export function OverviewDashboard() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const { announcements: showAnnouncements } = useDashboardContentVisibility()
  const [timeRange, setTimeRange] = useState<TimeRangeKey>('7d')

  const selectedOption = TIME_RANGE_OPTIONS.find((o) => o.key === timeRange)!
  const range = useMemo(
    () => computeTimeRange(selectedOption.days || 1),
    [selectedOption.days]
  )

  const quotaQuery = useQuery({
    queryKey: [
      'dashboard',
      'overview',
      'chart-data',
      range.start_timestamp,
      range.end_timestamp,
    ],
    queryFn: () =>
      getUserQuotaDates({
        start_timestamp: range.start_timestamp,
        end_timestamp: range.end_timestamp,
        default_time: selectedOption.days <= 1 ? 'hour' : 'day',
      }),
    staleTime: 60 * 1000,
  })

  const stats = useMemo(() => {
    const items = quotaQuery.data?.data ?? []
    const totalQuota = items.reduce((s, i) => s + (Number(i.quota) || 0), 0)
    const totalTokens = items.reduce((s, i) => s + (Number(i.token_used) || 0), 0)
    const totalCount = items.reduce((s, i) => s + (Number(i.count) || 0), 0)
    const timeRangeMinutes = Math.max(
      1,
      (range.end_timestamp - range.start_timestamp) / 60
    )
    const avgRpm = totalCount / timeRangeMinutes
    const avgTpm = totalTokens / timeRangeMinutes
    return { totalQuota, totalTokens, totalCount, avgRpm, avgTpm }
  }, [quotaQuery.data?.data, range.end_timestamp, range.start_timestamp])

  const chartData = useMemo(
    () => buildChartData(quotaQuery.data?.data ?? [], selectedOption.days),
    [quotaQuery.data?.data, selectedOption.days]
  )

  const remainQuota = Number(user?.quota ?? 0)
  const usedQuota = Number(user?.used_quota ?? 0)
  const requestCount = Number(user?.request_count ?? 0)

  const statGroups: StatGroup[] = [
    {
      title: t('Account'),
      color: 'bg-orange-500',
      metrics: [
        { label: t('Current Balance'), value: formatQuota(remainQuota) },
        { label: t('Historical Usage'), value: formatQuota(usedQuota) },
      ],
    },
    {
      title: t('Usage Statistics'),
      color: 'bg-blue-500',
      metrics: [
        { label: t('Request Count'), value: formatNumber(requestCount) },
        { label: t('Statistical count'), value: formatNumber(stats.totalCount) },
      ],
    },
    {
      title: t('Resource Consumption'),
      color: 'bg-emerald-500',
      metrics: [
        { label: t('Statistical quota'), value: formatQuota(stats.totalQuota) },
        { label: t('Statistical tokens'), value: formatNumber(stats.totalTokens) },
      ],
    },
    {
      title: t('Performance'),
      color: 'bg-purple-500',
      metrics: [
        { label: t('Average RPM'), value: stats.avgRpm.toFixed(3) },
        { label: t('Average TPM'), value: stats.avgTpm.toFixed(3) },
      ],
    },
  ]

  const greeting = getGreeting()
  const displayName = user?.display_name || user?.username || ''

  return (
    <div className="flex flex-col gap-4">
      {/* Greeting */}
      <h2 className="text-xl font-semibold">
        {t(greeting)}, {displayName}
      </h2>

      {/* Stat Group Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statGroups.map((group) => (
          <StatGroupCard key={group.title} group={group} />
        ))}
      </div>

      {/* Chart + Right Panel */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Bar Chart */}
        <div className="bg-card rounded-xl border p-4 shadow-xs">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{t('Consumption Statistics')}</h3>
            <div className="flex gap-1">
              {TIME_RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setTimeRange(opt.key)}
                  className={cn(
                    'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                    timeRange === opt.key
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted'
                  )}
                >
                  {t(opt.label)}
                </button>
              ))}
            </div>
          </div>
          <div className="h-64">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    className="fill-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    className="fill-muted-foreground"
                    tickFormatter={(v: number) => {
                      if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`
                      if (v >= 1000) return `${(v / 1000).toFixed(0)}K`
                      return String(v)
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--card)',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => [formatQuota(value), t('Quota')]}
                  />
                  <Bar
                    dataKey="quota"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                {quotaQuery.isLoading ? t('Loading') : t('No data')}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Reserved */}
        <div className="bg-card flex items-center justify-center rounded-xl border p-4 shadow-xs">
          <span className="text-muted-foreground text-sm">{t('Coming soon')}</span>
        </div>
      </div>

      {/* Announcements */}
      {showAnnouncements && <AnnouncementsPanel />}
    </div>
  )
}
