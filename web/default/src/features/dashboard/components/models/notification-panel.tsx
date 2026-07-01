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
import { useState } from 'react'
import { Bell, Megaphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { getNotice } from '@/lib/api'
import { getAnnouncementColorClass } from '@/lib/colors'
import { formatDateTimeObject } from '@/lib/time'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { RichContent } from '@/components/rich-content'
import { useAnnouncements } from '@/features/dashboard/hooks/use-status-data'
import type { AnnouncementItem } from '@/features/dashboard/types'
import { AnnouncementDetailModal } from '../overview/announcement-detail-dialog'

export function NotificationPanel() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<'notice' | 'announcements'>(
    'notice'
  )
  const [selectedAnnouncement, setSelectedAnnouncement] =
    useState<AnnouncementItem | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const { data: noticeResponse, isLoading: noticeLoading } = useQuery({
    queryKey: ['notice'],
    queryFn: getNotice,
    staleTime: 1000 * 60 * 5,
  })

  const { items: announcements, loading: announcementsLoading } =
    useAnnouncements()

  const noticeContent = noticeResponse?.success
    ? (noticeResponse.data || '').trim()
    : ''

  const loading = activeTab === 'notice' ? noticeLoading : announcementsLoading

  return (
    <div className='overflow-hidden rounded-lg border'>
      <div className='flex w-full flex-col gap-1.5 border-b px-3 py-2 sm:gap-3 sm:px-5 sm:py-3 lg:flex-row lg:items-center lg:justify-between'>
        <div className='flex items-center gap-2'>
          <Bell className='text-muted-foreground/60 size-4' />
          <div className='text-sm font-semibold'>
            {t('System Announcements')}
          </div>
        </div>

        <div className='bg-muted/60 inline-flex h-7 overflow-x-auto rounded-lg border p-0.5 sm:h-8'>
          <button
            type='button'
            onClick={() => setActiveTab('notice')}
            className={`shrink-0 rounded-md px-3 text-xs font-medium transition-colors ${
              activeTab === 'notice'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className='flex items-center gap-1.5'>
              <Bell className='size-3.5' />
              {t('Notice')}
            </span>
          </button>
          <button
            type='button'
            onClick={() => setActiveTab('announcements')}
            className={`shrink-0 rounded-md px-3 text-xs font-medium transition-colors ${
              activeTab === 'announcements'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className='flex items-center gap-1.5'>
              <Megaphone className='size-3.5' />
              {t('Timeline')}
            </span>
          </button>
        </div>
      </div>

      <div className='h-[200px] sm:h-[240px]'>
        {loading ? (
          <div className='text-muted-foreground flex h-full items-center justify-center text-sm'>
            {t('Loading...')}
          </div>
        ) : activeTab === 'notice' ? (
          noticeContent ? (
            <ScrollArea className='h-full px-3 py-3 sm:px-5'>
              <RichContent breaks content={noticeContent} />
            </ScrollArea>
          ) : (
            <div className='text-muted-foreground flex h-full flex-col items-center justify-center gap-2'>
              <Bell className='size-8 opacity-30' />
              <span className='text-sm'>
                {t('No announcements at this time')}
              </span>
            </div>
          )
        ) : announcements.length > 0 ? (
          <ScrollArea className='h-full'>
            <div>
              {announcements.map((item, idx) => {
                const key = item.id ?? `announcement-${idx}`
                return (
                  <button
                    key={key}
                    type='button'
                    onClick={() => {
                      setSelectedAnnouncement(item)
                      setIsDialogOpen(true)
                    }}
                    className={cn(
                      'group hover:bg-muted/40 w-full px-3 py-3 text-left transition-colors sm:px-5',
                      idx < announcements.length - 1 &&
                        'border-border/60 border-b'
                    )}
                  >
                    <div className='flex items-start gap-2.5'>
                      <span
                        className={cn(
                          'mt-1.5 inline-block size-2 shrink-0 rounded-full',
                          getAnnouncementColorClass(item.type)
                        )}
                      />
                      <div className='flex min-w-0 flex-1 flex-col gap-1'>
                        <p className='line-clamp-1 text-sm font-medium'>
                          {item.content}
                        </p>
                        <div className='flex items-center justify-between'>
                          {item.publishDate && (
                            <time className='text-muted-foreground/60 text-xs'>
                              {formatDateTimeObject(
                                new Date(item.publishDate)
                              )}
                            </time>
                          )}
                          <span className='text-muted-foreground/40 text-xs opacity-0 transition-opacity group-hover:opacity-100'>
                            {t('Click for details')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        ) : (
          <div className='text-muted-foreground flex h-full flex-col items-center justify-center gap-2'>
            <Megaphone className='size-8 opacity-30' />
            <span className='text-sm'>{t('No system announcements')}</span>
          </div>
        )}
      </div>

      <AnnouncementDetailModal
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        announcement={selectedAnnouncement}
      />
    </div>
  )
}
