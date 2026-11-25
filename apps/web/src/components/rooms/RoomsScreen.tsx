'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { roomBoardCopy } from '@knazawy/i18n';
import {
  addDays,
  canViewRoomBoard,
  DEFAULT_BOARD_DAYS,
  formatKarachiDateTime,
  type RoomBoardRecord,
} from '@knazawy/shared';
import { KaramLoader } from '@knazawy/ui-shell';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { explainApiError } from '../../lib/explain';
import { fill, useCommon, useCopy } from '../../lib/i18n';
import { api, readSessionUser } from '../../lib/session';

import './room-board.css';
import { RoomBoardOverview } from './RoomBoardOverview';
import { RoomCalendar } from './RoomCalendar';
import { RoomDetail } from './RoomDetail';
import { RoomSetupPanel } from './RoomSetupPanel';

type Tab = 'overview' | 'calendar' | 'setup';

/** How often the board looks for changes while it is open. */
const REFRESH_MS = 60_000;

export function RoomsScreen() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');
  const [board, setBoard] = useState<RoomBoardRecord | null>(null);
  const [from, setFrom] = useState<string | undefined>(undefined);
  const [days, setDays] = useState<number>(DEFAULT_BOARD_DAYS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const t = useCopy(roomBoardCopy);
  const common = useCommon();

  const showBoard = user ? canViewRoomBoard(user.role) : false;

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      setBoard(await api.roomBoard({ from, days }));
      setError('');
    } catch (caught: unknown) {
      setError(explainApiError(caught, setUser));
    } finally {
      setLoading(false);
    }
  }, [from, days]);

  useEffect(() => {
    const session = readSessionUser();
    setUser(session);
    setReady(true);
    if (session && !canViewRoomBoard(session.role)) setTab('setup');
  }, []);

  useEffect(() => {
    if (!showBoard) return;
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [showBoard, load]);

  if (!ready) return <KaramLoader label={t.loading} fullPage />;
  if (!user) {
    return (
      <p>
        <Link href="/login">{common.signIn}</Link>
      </p>
    );
  }

  const selectedRoom = board
    ? (board.floors.flatMap((floor) => floor.rooms).find((room) => room.id === selectedId) ?? null)
    : null;

  function shift(delta: number): void {
    const base = from ?? board?.from ?? board?.today;
    if (!base) return;
    setFrom(addDays(base, delta));
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    ...(showBoard
      ? ([
          { id: 'overview', label: t.tabOverview },
          { id: 'calendar', label: t.tabCalendar },
        ] as Array<{ id: Tab; label: string }>)
      : []),
    { id: 'setup', label: t.tabSetup },
  ];

  return (
    <section className="kz-stack">
      <div className="kz-page-head kz-page-action-head">
        <div>
          <h1>{common.rooms}</h1>
          {board ? (
            <p>
              {fill(t.branchLabel, { name: board.branchName })} ·{' '}
              {fill(t.updatedAt, { time: formatKarachiDateTime(new Date(board.now)) })}
            </p>
          ) : null}
        </div>
        {showBoard ? (
          <button
            type="button"
            className="kz-button kz-button-secondary"
            disabled={loading}
            onClick={() => void load()}
          >
            {t.refresh}
          </button>
        ) : null}
      </div>

      <div className="kz-rb-tabs" role="tablist">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? 'kz-rb-tab-on' : ''}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="kz-error" role="alert">
          {error}
        </p>
      ) : null}

      {tab !== 'setup' && !board && !error ? <KaramLoader label={t.loading} /> : null}

      {tab === 'overview' && board ? (
        <RoomBoardOverview board={board} t={t} selectedId={selectedId} onSelect={setSelectedId} />
      ) : null}
      {tab === 'calendar' && board ? (
        <RoomCalendar
          board={board}
          t={t}
          days={days}
          onDays={setDays}
          onShift={shift}
          onToday={() => setFrom(undefined)}
          onSelect={setSelectedId}
        />
      ) : null}
      {tab === 'setup' ? (
        <RoomSetupPanel
          user={user}
          onUserChange={setUser}
          onChanged={() => (showBoard ? void load() : undefined)}
        />
      ) : null}

      {selectedRoom && tab !== 'setup' ? (
        <RoomDetail room={selectedRoom} t={t} onClose={() => setSelectedId(null)} />
      ) : null}
    </section>
  );
}
