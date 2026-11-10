import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useTerminal, type Page } from './terminal'

const pages: Record<Page, string> = {
  Markets: 'Markets',
  Watchlist: 'Watchlist',
  Portfolio: 'Portfolio',
  Activity: 'Activity',
}
const sessionFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  weekday: 'short',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
})

export const useShell = defineStore('shell', () => {
  const store = useTerminal()
  const picker = ref(false)
  const mobileNav = ref(false)
  const collapsed = ref(false)
  const profile = ref(false)
  const title = computed(() => pages[store.page])
  const session = computed(() => {
    if (store.status.mode === 'demo') return 'Simulated session'
    const parts = sessionFormat.formatToParts(store.now)
    const part = (type: Intl.DateTimeFormatPartTypes): string =>
      parts.find((item) => item.type === type)?.value ?? ''
    const minutes = Number(part('hour')) * 60 + Number(part('minute'))
    return !['Sat', 'Sun'].includes(part('weekday')) &&
      minutes >= 570 &&
      minutes < 960
      ? 'Regular hours*'
      : 'Outside regular hours*'
  })
  const dismissOverlays = (): void => {
    store.notificationsOpen = false
    profile.value = false
    mobileNav.value = false
  }
  const navigate = (page: Page): void => {
    store.page = page
    dismissOverlays()
  }
  const toggleNotifications = (): void => {
    store.notificationsOpen = !store.notificationsOpen
    profile.value = false
  }
  const toggleProfile = (): void => {
    profile.value = !profile.value
    store.notificationsOpen = false
  }
  const dismissNotifications = (): void => {
    store.notice = ''
    store.notificationsOpen = false
  }
  const shortcut = (event: KeyboardEvent): void => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault()
      picker.value = !picker.value
    }
    if (event.key === 'Escape') dismissOverlays()
  }
  return {
    picker,
    mobileNav,
    collapsed,
    profile,
    title,
    session,
    navigate,
    toggleNotifications,
    toggleProfile,
    dismissNotifications,
    shortcut,
  }
})
