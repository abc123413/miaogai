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
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { formatNumber, formatQuota } from '@/lib/format'
import { computeTimeRange } from '@/lib/time'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { getUserQuotaDates } from '@/features/dashboard/api'
import {
  buildQueryParams,
  calculateDashboardStats,
  getDefaultDays,
  safeDivide,
} from '@/features/dashboard/lib'
import type {
  QuotaDataItem,
  DashboardFilters,
} from '@/features/dashboard/types'

interface LogStatCardsProps {
  filters?: DashboardFilters
  onDataUpdate?: (data: QuotaDataItem[], loading: boolean) => void
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

function StatGroupCard({ group, loading }: { group: StatGroup; loading: boolean }) {
  return (
    <div className="bg-card overflow-hidden rounded-xl border shadow-xs">
      <div className={cn('px-4 py-2 text-xs font-semibold text-white', group.color)}>
        {group.title}
      </div>
      <div className="grid grid-cols-2 divide-x divide-border">
        {group.metrics.map((metric) => (
          <div key={metric.label} className="px-4 py-3">
            <div className="text-muted-foreground text-xs">{metric.label}</div>
            {loading ? (
              <Skeleton className="mt-1 h-5 w-16" />
            ) : (
              <div className="text-foreground mt-1 truncate text-base font-semibold tabular-nums" title={metric.value}>
                {metric.value}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function LogStatCards(props: LogStatCardsProps) {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const isAdmin = !!(user?.role && user.role >= 10)
  const [stats, setStats] = useState<{
    totalQuota: number
    totalCount: number
    totalTokens: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRangeMinutes, setTimeRangeMinutes] = useState(0)

  const { filters, onDataUpdate } = props

  useEffect(() => {
    const abortController = new AbortController()
    setLoading(true)
    onDataUpdate?.([], true)

    const timeRange = computeTimeRange(
      getDefaultDays(filters?.time_granularity),
      filters?.start_timestamp,
      filters?.end_timestamp
    )
    const timeDiff = (timeRange.end_timestamp - timeRange.start_timestamp) / 60
    setTimeRangeMinutes(timeDiff)

    getUserQuotaDates(buildQueryParams(timeRange, filters), isAdmin)
      .then((res) => {
        if (abortController.signal.aborted) return
        const data = res?.data || []
        setStats(calculateDashboardStats(data))
        onDataUpdate?.(data, false)
      })
      .catch(() => {
        if (abortController.signal.aborted) return
        setStats(null)
        onDataUpdate?.([], false)
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setLoading(false)
        }
      })

    return () => {
      abortController.abort()
    }
  }, [filters, isAdmin, onDataUpdate])

  const remainQuota = Number(user?.quota ?? 0)
  const usedQuota = Number(user?.used_quota ?? 0)
  const requestCount = Number(user?.request_count ?? 0)
  const totalCount = stats?.totalCount ?? 0
  const totalQuota = stats?.totalQuota ?? 0
  const totalTokens = stats?.totalTokens ?? 0
  const avgRpm = safeDivide(totalCount, timeRangeMinutes)
  const avgTpm = safeDivide(totalTokens, timeRangeMinutes)

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
        { label: t('Statistical count'), value: formatNumber(totalCount) },
      ],
    },
    {
      title: t('Resource Consumption'),
      color: 'bg-emerald-500',
      metrics: [
        { label: t('Statistical quota'), value: formatQuota(totalQuota) },
        { label: t('Statistical tokens'), value: formatNumber(totalTokens) },
      ],
    },
    {
      title: t('Performance'),
      color: 'bg-purple-500',
      metrics: [
        { label: t('Average RPM'), value: avgRpm.toFixed(3) },
        { label: t('Average TPM'), value: avgTpm.toFixed(3) },
      ],
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {statGroups.map((group) => (
        <StatGroupCard key={group.title} group={group} loading={loading} />
      ))}
    </div>
  )
}
