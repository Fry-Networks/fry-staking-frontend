import { Icon } from '@iconify/react'
import { useWallet } from '@txnlab/use-wallet'
import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../../../hooks/useAuth'
import {
  fetchAllEvents,
  fetchEventById,
  fetchCommunityEvents,
  fetchCommunityEventById,
  activateEvent,
  endEvent,
  cancelEvent,
  deleteEvent,
  type FryEvent,
  type EventChallenge,
} from '../../../services/eventService'
import ChallengeList from './ChallengeList'
import ChallengeFormModal from './ChallengeFormModal'
import CommunityEventFormModal from './CommunityEventFormModal'
import CommunityEventPanel from './CommunityEventPanel'
import EventAdminPanel from './EventAdminPanel'
import EventCard from './EventCard'
import EventFormModal from './EventFormModal'
import Leaderboard from './Leaderboard'
import UserStats from './UserStats'

type ScopeKey = 'official' | 'community'
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

  // Scope tab
  const [eventScope, setEventScope] = useState<ScopeKey>('official')

  // Official events state
  const [events, setEvents] = useState<FryEvent[]>([])
  const [loading, setLoading] = useState(true)

  // Community events state
  const [communityEvents, setCommunityEvents] = useState<FryEvent[]>([])
  const [communityLoading, setCommunityLoading] = useState(false)

  // Shared state
  const [activeTab, setActiveTab] = useState<TabKey>('active')
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)

  // Admin modal state
  const [showEventForm, setShowEventForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState<FryEvent | null>(null)
  const [showChallengeForm, setShowChallengeForm] = useState(false)
  const [editingChallenge, setEditingChallenge] = useState<EventChallenge | null>(null)
  const [challengeEventId, setChallengeEventId] = useState('')

  // Community modal state
  const [showCommunityForm, setShowCommunityForm] = useState(false)

  // Load official events
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

  // Load community events
  const loadCommunityEvents = () => {
    setCommunityLoading(true)
    fetchCommunityEvents()
      .then(setCommunityEvents)
      .catch(() => {})
      .finally(() => setCommunityLoading(false))
  }

  useEffect(() => { loadEvents() }, [])

  useEffect(() => {
    if (eventScope === 'community') {
      loadCommunityEvents()
    }
  }, [eventScope])

  const refetchEvents = () => {
    if (eventScope === 'official') {
      fetchAllEvents()
        .then(data => {
          setEvents(data)
          if (selectedEventId && data.find(e => e._id === selectedEventId)) {
            fetchEventById(selectedEventId).then(full => {
              setEvents(prev => prev.map(e => e._id === full._id ? full : e))
            }).catch(() => {})
          }
        })
        .catch(() => {})
    } else {
      loadCommunityEvents()
      if (selectedEventId) {
        fetchCommunityEventById(selectedEventId).then(full => {
          setCommunityEvents(prev => prev.map(e => e._id === full._id ? full : e))
        }).catch(() => {})
      }
    }
  }

  const currentEvents = eventScope === 'official' ? events : communityEvents
  const currentLoading = eventScope === 'official' ? loading : communityLoading
  const filtered = filterEvents(currentEvents, activeTab)
  const selectedEvent = currentEvents.find(e => e._id === selectedEventId)

  const handleSelect = (id: string) => {
    if (selectedEventId === id) {
      setSelectedEventId(null)
    } else {
      setSelectedEventId(id)
      const fetcher = eventScope === 'official' ? fetchEventById : fetchCommunityEventById
      const setter = eventScope === 'official' ? setEvents : setCommunityEvents
      fetcher(id).then(full => {
        setter(prev => prev.map(e => e._id === full._id ? full : e))
      }).catch(() => {})
    }
  }

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

  const handleScopeChange = (scope: ScopeKey) => {
    setEventScope(scope)
    setSelectedEventId(null)
    setActiveTab('active')
  }

  return (
    <div className="max-xxxl:w-[95%] w-[80%] m-auto py-[40px] flex-1">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-[var(--text-heading)] font-apex font-bold text-3xl uppercase tracking-wide">
            Events
          </h1>
          <p className="text-text_clr mt-2">
            {eventScope === 'official'
              ? 'Compete in challenges, earn points, win FRY airdrops'
              : 'User-created events with custom reward tokens'}
          </p>
        </div>
        {eventScope === 'official' && isAdmin && (
          <button
            onClick={() => { setEditingEvent(null); setShowEventForm(true) }}
            className="px-5 py-2.5 rounded-[8px] bg-[#DE0308] text-white font-apex font-bold uppercase text-sm flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <Icon icon="mdi:plus" width={18} /> Create Event
          </button>
        )}
        {eventScope === 'community' && activeAddress && (
          <button
            onClick={async () => {
              try { await ensureAuth(); setShowCommunityForm(true) } catch {}
            }}
            className="px-5 py-2.5 rounded-[8px] bg-[#DE0308] text-white font-apex font-bold uppercase text-sm flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <Icon icon="mdi:plus" width={18} /> Create Event
          </button>
        )}
        {eventScope === 'official' && activeAddress && !isAuthenticated && (
          <button
            onClick={() => { ensureAuth().catch(() => {}) }}
            className="px-4 py-2 rounded-[8px] bg-[var(--bg-card)] text-text_clr font-apex text-sm flex items-center gap-2 hover:text-[var(--text-heading)] transition-colors"
          >
            <Icon icon="mdi:login" width={16} /> Sign In
          </button>
        )}
      </div>

      {/* Scope tabs (Official / Community) */}
      <div className="flex gap-6 mb-4 border-b border-[var(--border-color)]">
        {(['official', 'community'] as const).map(scope => (
          <button
            key={scope}
            onClick={() => handleScopeChange(scope)}
            className={`pb-3 font-apex font-bold uppercase text-sm transition-colors border-b-2 ${
              eventScope === scope
                ? 'text-[#DE0308] border-[#DE0308]'
                : 'text-text_clr border-transparent hover:text-[var(--text-heading)]'
            }`}
          >
            {scope === 'official' ? 'Official Events' : 'Community Events'}
          </button>
        ))}
      </div>

      {/* Community disclaimer */}
      {eventScope === 'community' && (
        <div className="bg-yellow-900/30 border border-yellow-600/50 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <Icon icon="mdi:alert-circle" className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
            <p className="text-yellow-200/70 text-xs">
              <span className="text-yellow-400 font-semibold">Disclaimer:</span>{' '}
              Community events are created by users and are not endorsed, verified, or guaranteed by Fry Networks.
              Reward tokens are held in platform escrow until distribution. Participate at your own risk.
            </p>
          </div>
        </div>
      )}

      {/* My Events panel (community tab, wallet connected) */}
      {eventScope === 'community' && activeAddress && (
        <CommunityEventPanel
          wallet={activeAddress}
          onRefresh={loadCommunityEvents}
          onSelect={handleSelect}
        />
      )}

      {/* Sub-tabs (Active / Upcoming / Ended) */}
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
      {currentLoading && (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-[#DE0308] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!currentLoading && filtered.length === 0 && (
        <div className="bg-[var(--bg-card)] rounded-[18px] p-12 text-center shadow-[0px_4px_24.2px_0px_var(--shadow-color)]">
          <p className="text-text_clr text-lg">
            {activeTab === 'active'
              ? eventScope === 'community'
                ? 'No active community events right now.'
                : 'No active events right now. Check back soon!'
              : activeTab === 'upcoming'
              ? eventScope === 'community'
                ? 'No upcoming community events.'
                : 'No upcoming events scheduled.'
              : eventScope === 'community'
                ? 'No past community events.'
                : 'No past events to display.'}
          </p>
        </div>
      )}

      {/* Event cards */}
      {!currentLoading && filtered.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          {filtered.map(event => (
            <EventCard
              key={event._id}
              event={event}
              onSelect={handleSelect}
              isSelected={selectedEventId === event._id}
              isAdmin={isAdmin && eventScope === 'official'}
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

          {/* Community event info */}
          {selectedEvent.eventType === 'community' && (
            <div className="mb-4">
              <div className="flex items-center gap-2 bg-yellow-900/20 border border-yellow-600/30 rounded-lg px-3 py-2 mb-4">
                <Icon icon="mdi:alert-circle" width={16} className="text-yellow-500 shrink-0" />
                <p className="text-yellow-200/60 text-xs">
                  This is a community-created event. Not endorsed by Fry Networks.
                </p>
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-text_clr mb-4">
                {selectedEvent.creatorWallet && (
                  <div className="flex items-center gap-1.5">
                    <Icon icon="mdi:account" width={16} />
                    <span>Created by: {selectedEvent.creatorWallet.slice(0, 6)}...{selectedEvent.creatorWallet.slice(-4)}</span>
                  </div>
                )}
                {(selectedEvent.rewardPool ?? 0) > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Icon icon="mdi:trophy" width={16} color="#DE0308" />
                    <span>
                      {(selectedEvent.rewardPool! / Math.pow(10, selectedEvent.rewardAsaDecimals || 6)).toLocaleString()}{' '}
                      {selectedEvent.rewardAsaName || `ASA #${selectedEvent.rewardAsaId}`}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Icon icon="mdi:safe" width={16} />
                  <span>Escrow: {selectedEvent.fundingStatus === 'funded' ? 'Funded' : selectedEvent.fundingStatus}</span>
                  {selectedEvent.fundingStatus === 'funded' && (
                    <Icon icon="mdi:check-circle" width={14} className="text-green" />
                  )}
                </div>
              </div>
            </div>
          )}

          {selectedEvent.description && (
            <p className="text-text_clr text-sm mb-6 whitespace-pre-wrap">{selectedEvent.description}</p>
          )}

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

      {/* Admin panel for selected official event */}
      {isAdmin && selectedEvent && eventScope === 'official' && (
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

      {/* Admin modals (official events) */}
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

      {/* Community event creation modal */}
      <CommunityEventFormModal
        visible={showCommunityForm}
        onClose={() => setShowCommunityForm(false)}
        onSuccess={() => {
          loadCommunityEvents()
          setShowCommunityForm(false)
        }}
      />
    </div>
  )
}

export default EventsPage
