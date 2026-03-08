import { Icon } from '@iconify/react'
import { useWallet } from '@txnlab/use-wallet'
import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../../../hooks/useAuth'
import {
  fetchAllEvents,
  fetchEventById,
  activateEvent,
  endEvent,
  cancelEvent,
  deleteEvent,
  type FryEvent,
  type EventChallenge,
} from '../../../services/eventService'
import ChallengeList from './ChallengeList'
import ChallengeFormModal from './ChallengeFormModal'
import EventAdminPanel from './EventAdminPanel'
import EventCard from './EventCard'
import EventFormModal from './EventFormModal'
import Leaderboard from './Leaderboard'
import UserStats from './UserStats'

type TabKey = 'active' | 'upcoming' | 'ended'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'ended', label: 'Ended' },
]

function filterEvents(events: FryEvent[], tab: TabKey): FryEvent[] {
  switch (tab) {
    case 'active':
      return events.filter(e => e.status === 'active')
    case 'upcoming':
      return events.filter(e => e.status === 'scheduled' || e.status === 'draft')
    case 'ended':
      return events.filter(e => e.status === 'ended' || e.status === 'cancelled')
  }
}

const EventsPage: React.FC = () => {
  const { activeAddress } = useWallet()
  const { isAdmin, isAuthenticated, ensureAuth } = useAuth()
  const [events, setEvents] = useState<FryEvent[]>([])
  const [activeTab, setActiveTab] = useState<TabKey>('active')
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Admin modal state
  const [showEventForm, setShowEventForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState<FryEvent | null>(null)
  const [showChallengeForm, setShowChallengeForm] = useState(false)
  const [editingChallenge, setEditingChallenge] = useState<EventChallenge | null>(null)
  const [challengeEventId, setChallengeEventId] = useState('')

  const loadEvents = () => {
    fetchAllEvents()
      .then(data => {
        setEvents(data)
        if (selectedEventId && !data.find(e => e._id === selectedEventId)) {
          setSelectedEventId(null)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadEvents() }, [])

  const refetchEvents = () => {
    fetchAllEvents()
      .then(data => {
        setEvents(data)
        if (selectedEventId && !data.find(e => e._id === selectedEventId)) {
          setSelectedEventId(null)
        }
        // Refresh selected event's challenges
        if (selectedEventId && data.find(e => e._id === selectedEventId)) {
          fetchEventById(selectedEventId).then(full => {
            setEvents(prev => prev.map(e => e._id === full._id ? full : e))
          }).catch(() => {})
        }
      })
      .catch(() => {})
  }

  const filtered = filterEvents(events, activeTab)
  const selectedEvent = events.find(e => e._id === selectedEventId)

  const handleSelect = (id: string) => {
    if (selectedEventId === id) {
      setSelectedEventId(null)
    } else {
      setSelectedEventId(id)
      // Fetch full event with challenges
      fetchEventById(id).then(full => {
        setEvents(prev => prev.map(e => e._id === full._id ? full : e))
      }).catch(() => {})
    }
  }

  // Admin action handlers for EventCard
  const handleCardAction = async (action: (id: string) => Promise<any>, event: FryEvent, msg: string) => {
    try {
      await ensureAuth()
      await action(event._id)
      toast.success(msg)
      refetchEvents()
    } catch (err: any) {
      if (!err.message?.includes('cancelled') && !err.message?.includes('CANCELLED')) {
        toast.error(err.response?.data?.message || 'Action failed')
      }
    }
  }

  return (
    <div className="max-xxxl:w-[95%] w-[80%] m-auto py-[40px] flex-1">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-[var(--text-heading)] font-apex font-bold text-3xl uppercase tracking-wide">
            Events
          </h1>
          <p className="text-text_clr mt-2">
            Compete in challenges, earn points, win FRY airdrops
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setEditingEvent(null); setShowEventForm(true) }}
            className="px-5 py-2.5 rounded-[8px] bg-[#DE0308] text-white font-apex font-bold uppercase text-sm flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <Icon icon="mdi:plus" width={18} /> Create Event
          </button>
        )}
        {activeAddress && !isAuthenticated && (
          <button
            onClick={() => { ensureAuth().catch(() => {}) }}
            className="px-4 py-2 rounded-[8px] bg-[var(--bg-card)] text-text_clr font-apex text-sm flex items-center gap-2 hover:text-[var(--text-heading)] transition-colors"
          >
            <Icon icon="mdi:login" width={16} /> Sign In
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setSelectedEventId(null) }}
            className={`px-5 py-2 rounded-[8px] font-apex font-bold uppercase text-sm transition-colors ${
              activeTab === tab.key
                ? 'bg-[#DE0308] text-white'
                : 'bg-[var(--bg-card)] text-text_clr hover:text-[var(--text-heading)]'
            }`}
          >
            {tab.label}
            {activeTab === tab.key && ` (${filtered.length})`}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-[#DE0308] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="bg-[var(--bg-card)] rounded-[18px] p-12 text-center shadow-[0px_4px_24.2px_0px_var(--shadow-color)]">
          <p className="text-text_clr text-lg">
            {activeTab === 'active'
              ? 'No active events right now. Check back soon!'
              : activeTab === 'upcoming'
              ? 'No upcoming events scheduled.'
              : 'No past events to display.'}
          </p>
        </div>
      )}

      {/* Event cards */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          {filtered.map(event => (
            <EventCard
              key={event._id}
              event={event}
              onSelect={handleSelect}
              isSelected={selectedEventId === event._id}
              isAdmin={isAdmin}
              onEdit={e => { setEditingEvent(e); setShowEventForm(true) }}
              onActivate={e => handleCardAction(activateEvent, e, 'Event activated')}
              onEnd={e => handleCardAction(endEvent, e, 'Event ended, airdrop triggered')}
              onCancel={e => handleCardAction(cancelEvent, e, 'Event cancelled')}
              onDelete={e => handleCardAction(deleteEvent, e, 'Event deleted')}
            />
          ))}
        </div>
      )}

      {/* Selected event detail */}
      {selectedEvent && (
        <div className="bg-[var(--bg-card)] rounded-[18px] overflow-hidden shadow-[0px_4px_24.2px_0px_var(--shadow-color)]">
          {selectedEvent.bannerImage && (
            <img
              src={selectedEvent.bannerImage}
              alt=""
              className="w-full h-[240px] object-cover"
            />
          )}
          <div className="p-6">
          <h2 className="text-[var(--text-heading)] font-apex font-bold text-2xl uppercase mb-6">
            {selectedEvent.name}
          </h2>

          {selectedEvent.challenges && selectedEvent.challenges.length > 0 && (
            <ChallengeList challenges={selectedEvent.challenges} />
          )}

          <Leaderboard eventId={selectedEvent._id} activeWallet={activeAddress || undefined} />

          {activeAddress ? (
            <UserStats eventId={selectedEvent._id} wallet={activeAddress} />
          ) : (
            <div className="bg-[var(--bg-secondary)] rounded-[12px] p-6 text-center">
              <p className="text-text_clr">Connect your wallet to see your stats</p>
            </div>
          )}
          </div>
        </div>
      )}

      {/* Admin panel for selected event */}
      {isAdmin && selectedEvent && (
        <EventAdminPanel
          event={selectedEvent}
          onRefresh={refetchEvents}
          onEditEvent={e => { setEditingEvent(e); setShowEventForm(true) }}
          onEditChallenge={c => {
            setEditingChallenge(c)
            setChallengeEventId(selectedEvent._id)
            setShowChallengeForm(true)
          }}
          onAddChallenge={() => {
            setEditingChallenge(null)
            setChallengeEventId(selectedEvent._id)
            setShowChallengeForm(true)
          }}
        />
      )}

      {/* Admin modals */}
      {isAdmin && (
        <>
          <EventFormModal
            open={showEventForm}
            onClose={() => { setShowEventForm(false); setEditingEvent(null) }}
            onSuccess={refetchEvents}
            event={editingEvent}
          />
          <ChallengeFormModal
            open={showChallengeForm}
            onClose={() => { setShowChallengeForm(false); setEditingChallenge(null) }}
            onSuccess={refetchEvents}
            eventId={challengeEventId}
            challenge={editingChallenge}
          />
        </>
      )}
    </div>
  )
}

export default EventsPage
