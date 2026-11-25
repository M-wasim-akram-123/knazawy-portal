'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { roomsCopy } from '@knazawy/i18n';
import {
  can,
  DEFAULT_ROOM_CAPACITY,
  MAX_ROOM_CAPACITY,
  type HotelRoomRecord,
  type RoomFloorRecord,
  type RoomTypeRecord,
} from '@knazawy/shared';
import { FormDialog, KaramLoader } from '@knazawy/ui-shell';
import { useEffect, useState } from 'react';

import { explainApiError } from '../../lib/explain';
import { fill, useCopy, useCommon } from '../../lib/i18n';
import { api } from '../../lib/session';
import { Field } from '../master/Field';

import { typeColour } from './boardView';
import { Pips } from './Pips';

interface RoomSetupPanelProps {
  user: SessionUser;
  onUserChange: (user: SessionUser | null) => void;
  /** Called after any change, so the board and calendar can refresh. */
  onChanged: () => void;
}

type DialogName = 'floor' | 'type' | 'room' | 'bulk' | null;

/** Most rooms one "add several" can make, so a typo cannot fill the building. */
const MOST_BULK_ROOMS = 60;

export function RoomSetupPanel({ user, onUserChange, onChanged }: RoomSetupPanelProps) {
  const setUser = onUserChange;
  const [loaded, setLoaded] = useState(false);
  const [floors, setFloors] = useState<RoomFloorRecord[]>([]);
  const [types, setTypes] = useState<RoomTypeRecord[]>([]);
  const [rooms, setRooms] = useState<HotelRoomRecord[]>([]);
  const [dialog, setDialog] = useState<DialogName>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const [chargeFormFor, setChargeFormFor] = useState<string | null>(null);

  const [floorName, setFloorName] = useState('');
  const [floorOrder, setFloorOrder] = useState('0');
  const [typeName, setTypeName] = useState('');
  const [chargeName, setChargeName] = useState('');
  const [chargeAmount, setChargeAmount] = useState('');
  const [roomFloorId, setRoomFloorId] = useState('');
  const [roomTypeId, setRoomTypeId] = useState('');
  const [roomName, setRoomName] = useState('');
  const [roomCapacity, setRoomCapacity] = useState(String(DEFAULT_ROOM_CAPACITY));
  const [bulkStart, setBulkStart] = useState('');
  const [bulkCount, setBulkCount] = useState('6');

  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const t = useCopy(roomsCopy);
  const common = useCommon();

  async function reload(): Promise<void> {
    const [nextFloors, nextTypes, nextRooms] = await Promise.all([
      api.listRoomFloors(),
      api.listRoomTypes(),
      api.listHotelRooms(),
    ]);
    setFloors(nextFloors);
    setTypes(nextTypes);
    setRooms(nextRooms);
  }

  useEffect(() => {
    void reload()
      .then(() => setLoaded(true))
      .catch((caught: unknown) => setError(explainApiError(caught, setUser)));
  }, []);

  if (!loaded && !error) return <KaramLoader label={t.loading} />;

  const canWrite = can(user.role, 'rooms', 'C');
  const canChange = can(user.role, 'rooms', 'U');
  const openFloors = floors.filter((floor) => floor.active);
  const openTypes = types.filter((roomType) => roomType.active);
  const liveRooms = rooms.filter((room) => room.active);
  const shownFloors = floors.filter((floor) => showArchived || floor.active);
  const shownTypes = types.filter((roomType) => showArchived || roomType.active);
  const roomsOnFloor = (floorId: string) => rooms.filter((room) => room.floorId === floorId);

  function open(name: DialogName): void {
    setError('');
    setSaved('');
    setDialog(name);
  }

  async function run(action: () => Promise<void>, message: string): Promise<boolean> {
    setBusy(true);
    setError('');
    setSaved('');
    try {
      await action();
      await reload();
      onChanged();
      setSaved(message);
      return true;
    } catch (caught: unknown) {
      setError(explainApiError(caught, setUser));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addSeveral(close: () => void): Promise<void> {
    const start = Number(bulkStart);
    const count = Number(bulkCount);
    if (!/^\d{1,6}$/.test(bulkStart.trim()) || !Number.isInteger(start)) {
      setError(t.bulkNeedsNumber);
      return;
    }
    if (!Number.isInteger(count) || count < 1 || count > MOST_BULK_ROOMS) {
      setError(t.bulkCountError);
      return;
    }
    setBusy(true);
    setError('');
    setSaved('');
    let added = 0;
    try {
      for (let index = 0; index < count; index += 1) {
        await api.createHotelRoom({
          floorId: roomFloorId,
          roomTypeId,
          name: String(start + index),
          capacity: Number(roomCapacity) || DEFAULT_ROOM_CAPACITY,
        });
        added += 1;
      }
      await reload();
      onChanged();
      setSaved(fill(t.bulkAdded, { count: added }));
      close();
    } catch (caught: unknown) {
      await reload().catch(() => undefined);
      onChanged();
      const reason = explainApiError(caught, setUser);
      setError(added > 0 ? fill(t.bulkPartial, { count: added, error: reason }) : reason);
    } finally {
      setBusy(false);
    }
  }

  function setCapacity(room: HotelRoomRecord, next: number): void {
    void run(
      () => api.updateHotelRoom(room.id, { capacity: next }).then(() => undefined),
      fill(t.capacityChanged, { name: room.name, count: next }),
    );
  }

  const bulkStartNumber = Number(bulkStart);
  const bulkCountNumber = Number(bulkCount);
  const bulkReady =
    /^\d{1,6}$/.test(bulkStart.trim()) &&
    Number.isInteger(bulkCountNumber) &&
    bulkCountNumber >= 1 &&
    bulkCountNumber <= MOST_BULK_ROOMS;

  const tiles = [
    { label: t.summaryFloors, value: openFloors.length },
    { label: t.summaryTypes, value: openTypes.length },
    { label: t.summaryRooms, value: liveRooms.length },
    { label: t.summaryPlaces, value: liveRooms.reduce((sum, room) => sum + room.capacity, 0) },
  ];

  const roomPicker = (
    <>
      <Field label={t.floor}>
        <select
          value={roomFloorId}
          onChange={(event) => setRoomFloorId(event.target.value)}
          required
        >
          <option value="">{t.chooseFloor}</option>
          {openFloors.map((floor) => (
            <option key={floor.id} value={floor.id}>
              {floor.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t.roomType}>
        <select value={roomTypeId} onChange={(event) => setRoomTypeId(event.target.value)} required>
          <option value="">{t.chooseType}</option>
          {openTypes.map((roomType) => (
            <option key={roomType.id} value={roomType.id}>
              {roomType.name} · {roomType.nightlyTotal} SAR
            </option>
          ))}
        </select>
      </Field>
    </>
  );

  const capacityField = (
    <Field label={t.capacity} hint={t.capacityHint}>
      <input
        type="number"
        min={1}
        max={MAX_ROOM_CAPACITY}
        value={roomCapacity}
        onChange={(event) => setRoomCapacity(event.target.value)}
        required
      />
    </Field>
  );

  const errorLine = error ? (
    <p className="kz-error" role="alert">
      {error}
    </p>
  ) : null;

  return (
    <section className="kz-stack kz-rb kz-setup">
      <div className="kz-setup-head">
        <div>
          <h2>{common.rooms}</h2>
          <p className="kz-help">{t.intro}</p>
        </div>
        <label className="kz-setup-toggle">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
          />
          {t.showArchived}
        </label>
      </div>

      <div className="kz-rb-tiles">
        {tiles.map((tile) => (
          <div key={tile.label} className="kz-rb-tile kz-rb-tile-plain">
            <strong>{tile.value}</strong>
            <span>{tile.label}</span>
          </div>
        ))}
      </div>

      {error && dialog === null ? errorLine : null}
      {saved ? (
        <p className="kz-order-saved" role="status">
          {saved}
        </p>
      ) : null}

      <section className="kz-panel kz-setup-section">
        <div className="kz-setup-section-head">
          <div>
            <h3>{t.floors}</h3>
            <p className="kz-help">{t.floorsSectionHelp}</p>
          </div>
          {canWrite ? (
            <button type="button" className="kz-button" onClick={() => open('floor')}>
              {t.addFloor}
            </button>
          ) : null}
        </div>
        {shownFloors.length === 0 ? <p className="kz-empty">{t.noFloors}</p> : null}
        <div className="kz-setup-floors">
          {shownFloors.map((floor) => {
            const here = roomsOnFloor(floor.id).filter((room) => room.active);
            return (
              <article
                key={floor.id}
                className={`kz-setup-floor${floor.active ? '' : ' kz-setup-archived'}`}
              >
                <strong>
                  {floor.name}
                  {floor.active ? null : <span className="kz-setup-tag">{t.archivedTag}</span>}
                </strong>
                <small>{fill(t.floorRooms, { count: here.length })}</small>
                <small>
                  {fill(t.sleepsCount, {
                    count: here.reduce((sum, room) => sum + room.capacity, 0),
                  })}
                  {fill(t.orderValue, { order: floor.sortOrder })}
                </small>
                {canChange ? (
                  <div className="kz-setup-floor-actions">
                    <button
                      type="button"
                      className="kz-button-quiet"
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () =>
                            api
                              .updateRoomFloor(floor.id, { active: !floor.active })
                              .then(() => undefined),
                          fill(floor.active ? t.isArchived : t.isRestored, { name: floor.name }),
                        )
                      }
                    >
                      {floor.active ? common.archive : t.restore}
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <section className="kz-panel kz-setup-section">
        <div className="kz-setup-section-head">
          <div>
            <h3>{t.typesAndCharges}</h3>
            <p className="kz-help">{t.typesHelp}</p>
          </div>
          {canWrite ? (
            <button type="button" className="kz-button" onClick={() => open('type')}>
              {t.addRoomType}
            </button>
          ) : null}
        </div>
        {shownTypes.length === 0 ? <p className="kz-empty">{t.noRoomTypes}</p> : null}
        <div className="kz-setup-types">
          {shownTypes.map((roomType) => {
            const charges = roomType.charges.filter((charge) => showArchived || charge.active);
            const count = liveRooms.filter((room) => room.roomTypeId === roomType.id).length;
            return (
              <article
                key={roomType.id}
                className={`kz-setup-type${roomType.active ? '' : ' kz-setup-archived'}`}
                style={{ ['--kz-rb-type' as string]: typeColour(roomType.name) }}
              >
                <div className="kz-setup-type-head">
                  <h4>
                    {roomType.name}
                    {roomType.active ? null : <span className="kz-setup-tag">{t.archivedTag}</span>}
                  </h4>
                  <div className="kz-setup-price">
                    <strong>{roomType.nightlyTotal}</strong>
                    <small>SAR · {t.perNightShort}</small>
                  </div>
                </div>

                <p className="kz-setup-subtitle">{t.priceBreakdown}</p>
                {charges.length === 0 ? <p className="kz-setup-note">{t.noCharges}</p> : null}
                <ul className="kz-setup-charges">
                  {charges.map((charge) => (
                    <li key={charge.id} className={charge.active ? '' : 'kz-setup-archived'}>
                      <span>
                        {charge.name}
                        {charge.active ? null : (
                          <span className="kz-setup-tag">{t.archivedTag}</span>
                        )}
                      </span>
                      <b>{charge.amountPerNight} SAR</b>
                      {canChange && charge.active ? (
                        <button
                          type="button"
                          className="kz-button-quiet"
                          disabled={busy}
                          onClick={() =>
                            void run(
                              () =>
                                api
                                  .updateRoomCharge(roomType.id, charge.id, { active: false })
                                  .then(() => undefined),
                              fill(t.isArchived, { name: charge.name }),
                            )
                          }
                        >
                          {common.archive}
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>

                {canWrite && roomType.active ? (
                  chargeFormFor === roomType.id ? (
                    <form
                      className="kz-setup-charge-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void run(async () => {
                          await api.addRoomCharge(roomType.id, {
                            name: chargeName.trim(),
                            amountPerNight: chargeAmount.trim(),
                          });
                          setChargeName('');
                          setChargeAmount('');
                          setChargeFormFor(null);
                        }, t.chargeAdded);
                      }}
                    >
                      <Field label={t.chargeName}>
                        <input
                          value={chargeName}
                          maxLength={80}
                          onChange={(event) => setChargeName(event.target.value)}
                          required
                        />
                      </Field>
                      <Field label={t.perNightPkr}>
                        <input
                          value={chargeAmount}
                          inputMode="decimal"
                          onChange={(event) => setChargeAmount(event.target.value)}
                          required
                        />
                      </Field>
                      <button type="submit" className="kz-button" disabled={busy}>
                        {t.addCharge}
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      className="kz-button kz-button-outline"
                      onClick={() => {
                        setChargeName('');
                        setChargeAmount('');
                        setChargeFormFor(roomType.id);
                      }}
                    >
                      + {t.addCharge}
                    </button>
                  )
                ) : null}

                <div className="kz-setup-type-foot">
                  <span>{fill(t.roomsOfType, { count })}</span>
                  {canChange ? (
                    <button
                      type="button"
                      className="kz-button-quiet"
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () =>
                            api
                              .updateRoomType(roomType.id, { active: !roomType.active })
                              .then(() => undefined),
                          fill(roomType.active ? t.isArchived : t.isRestored, {
                            name: roomType.name,
                          }),
                        )
                      }
                    >
                      {roomType.active ? t.archiveType : t.restore}
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="kz-panel kz-setup-section">
        <div className="kz-setup-section-head">
          <div>
            <h3>{t.roomsByFloor}</h3>
            <p className="kz-help">{t.roomsSectionHelp}</p>
          </div>
          <div className="kz-setup-actions">
            <label className="kz-rb-filter">
              <span>{t.typeFilter}</span>
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="">{t.allTypes}</option>
                {types.map((roomType) => (
                  <option key={roomType.id} value={roomType.id}>
                    {roomType.name}
                  </option>
                ))}
              </select>
            </label>
            {canWrite ? (
              <>
                <button
                  type="button"
                  className="kz-button kz-button-outline"
                  onClick={() => open('bulk')}
                >
                  {t.addSeveral}
                </button>
                <button type="button" className="kz-button" onClick={() => open('room')}>
                  {t.addRoom}
                </button>
              </>
            ) : null}
          </div>
        </div>
        {rooms.length === 0 ? <p className="kz-empty">{t.noRooms}</p> : null}
        {shownFloors.map((floor) => {
          const here = roomsOnFloor(floor.id).filter(
            (room) =>
              (showArchived || room.active) && (!typeFilter || room.roomTypeId === typeFilter),
          );
          if (rooms.length > 0 && here.length === 0 && typeFilter) return null;
          const places = here
            .filter((room) => room.active)
            .reduce((sum, room) => sum + room.capacity, 0);
          return (
            <div key={floor.id} className="kz-setup-group">
              <div className="kz-setup-group-title">
                <h4>{floor.name}</h4>
                <small>
                  {fill(t.floorRooms, { count: here.filter((room) => room.active).length })} ·{' '}
                  {fill(t.sleepsCount, { count: places })}
                </small>
              </div>
              {here.length === 0 ? <p className="kz-setup-note">{t.floorEmpty}</p> : null}
              <div className="kz-setup-rooms">
                {here.map((room) => (
                  <article
                    key={room.id}
                    className={`kz-setup-room${room.active ? '' : ' kz-setup-archived'}`}
                    style={{ ['--kz-rb-type' as string]: typeColour(room.roomTypeName) }}
                  >
                    <div className="kz-setup-room-head">
                      <b>{room.name}</b>
                      {room.active ? null : <span className="kz-setup-tag">{t.archivedTag}</span>}
                    </div>
                    <span className="kz-setup-room-type">{room.roomTypeName}</span>
                    {canChange && room.active ? (
                      <div className="kz-setup-stepper">
                        <button
                          type="button"
                          aria-label={`${t.fewerGuests}: ${room.name}`}
                          disabled={busy || room.capacity <= 1}
                          onClick={() => setCapacity(room, room.capacity - 1)}
                        >
                          −
                        </button>
                        <Pips capacity={room.capacity} filled={room.capacity} />
                        <output aria-label={`${t.capacity} ${room.name}`}>{room.capacity}</output>
                        <button
                          type="button"
                          aria-label={`${t.moreGuests}: ${room.name}`}
                          disabled={busy || room.capacity >= MAX_ROOM_CAPACITY}
                          onClick={() => setCapacity(room, room.capacity + 1)}
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <div className="kz-setup-stepper">
                        <Pips capacity={room.capacity} filled={room.capacity} />
                        <output>{fill(t.sleepsCount, { count: room.capacity })}</output>
                      </div>
                    )}
                    {canChange ? (
                      <div className="kz-setup-room-actions">
                        <button
                          type="button"
                          className="kz-button-quiet"
                          disabled={busy}
                          onClick={() =>
                            void run(
                              () =>
                                api
                                  .updateHotelRoom(room.id, { active: !room.active })
                                  .then(() => undefined),
                              fill(room.active ? t.isArchived : t.isRestored, { name: room.name }),
                            )
                          }
                        >
                          {room.active ? common.archive : t.restore}
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {canWrite ? (
        <>
          <FormDialog
            buttonLabel={t.addFloor}
            title={t.addFloor}
            showTrigger={false}
            isOpen={dialog === 'floor'}
            onOpenChange={(isOpen) => setDialog(isOpen ? 'floor' : null)}
          >
            {({ close }) => (
              <form
                className="kz-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(async () => {
                    await api.createRoomFloor({
                      name: floorName.trim(),
                      sortOrder: Number(floorOrder) || 0,
                    });
                    setFloorName('');
                  }, t.floorAdded).then((succeeded) => {
                    if (succeeded) close();
                  });
                }}
              >
                <Field label={t.floorName} hint={t.floorNameHint}>
                  <input
                    value={floorName}
                    maxLength={80}
                    onChange={(event) => setFloorName(event.target.value)}
                    required
                  />
                </Field>
                <Field label={t.order} hint={t.orderHint}>
                  <input
                    type="number"
                    min={0}
                    max={999}
                    value={floorOrder}
                    onChange={(event) => setFloorOrder(event.target.value)}
                  />
                </Field>
                {errorLine}
                <button type="submit" className="kz-button" disabled={busy}>
                  {t.addFloor}
                </button>
              </form>
            )}
          </FormDialog>

          <FormDialog
            buttonLabel={t.addRoomType}
            title={t.addRoomType}
            showTrigger={false}
            isOpen={dialog === 'type'}
            onOpenChange={(isOpen) => setDialog(isOpen ? 'type' : null)}
          >
            {({ close }) => (
              <form
                className="kz-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(async () => {
                    await api.createRoomType({ name: typeName.trim() });
                    setTypeName('');
                  }, t.roomTypeAdded).then((succeeded) => {
                    if (succeeded) close();
                  });
                }}
              >
                <Field label={t.roomType}>
                  <input
                    value={typeName}
                    maxLength={80}
                    onChange={(event) => setTypeName(event.target.value)}
                    required
                  />
                </Field>
                {errorLine}
                <button type="submit" className="kz-button" disabled={busy}>
                  {t.addRoomType}
                </button>
              </form>
            )}
          </FormDialog>

          <FormDialog
            buttonLabel={t.addRoom}
            title={t.addRoom}
            showTrigger={false}
            isOpen={dialog === 'room'}
            onOpenChange={(isOpen) => setDialog(isOpen ? 'room' : null)}
          >
            {({ close }) => (
              <form
                className="kz-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(async () => {
                    await api.createHotelRoom({
                      floorId: roomFloorId,
                      roomTypeId,
                      name: roomName.trim(),
                      capacity: Number(roomCapacity) || DEFAULT_ROOM_CAPACITY,
                    });
                    setRoomName('');
                  }, t.roomAdded).then((succeeded) => {
                    if (succeeded) close();
                  });
                }}
              >
                {roomPicker}
                <Field label={t.roomName} hint={t.roomNameHint}>
                  <input
                    value={roomName}
                    maxLength={80}
                    onChange={(event) => setRoomName(event.target.value)}
                    required
                  />
                </Field>
                {capacityField}
                {errorLine}
                <button type="submit" className="kz-button" disabled={busy}>
                  {t.addRoom}
                </button>
              </form>
            )}
          </FormDialog>

          <FormDialog
            buttonLabel={t.addSeveral}
            title={t.addSeveral}
            description={t.bulkIntro}
            showTrigger={false}
            isOpen={dialog === 'bulk'}
            onOpenChange={(isOpen) => setDialog(isOpen ? 'bulk' : null)}
          >
            {({ close }) => (
              <form
                className="kz-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void addSeveral(close);
                }}
              >
                {roomPicker}
                <Field label={t.bulkStart} hint={t.bulkStartHint}>
                  <input
                    inputMode="numeric"
                    value={bulkStart}
                    maxLength={6}
                    onChange={(event) => setBulkStart(event.target.value)}
                    required
                  />
                </Field>
                <Field label={t.bulkCount} hint={t.bulkCountHint}>
                  <input
                    type="number"
                    min={1}
                    max={MOST_BULK_ROOMS}
                    value={bulkCount}
                    onChange={(event) => setBulkCount(event.target.value)}
                    required
                  />
                </Field>
                {capacityField}
                {bulkReady ? (
                  <p className="kz-help">
                    {fill(t.bulkPreview, {
                      first: bulkStartNumber,
                      last: bulkStartNumber + bulkCountNumber - 1,
                    })}
                  </p>
                ) : null}
                {errorLine}
                <button type="submit" className="kz-button" disabled={busy || !bulkReady}>
                  {t.addSeveral}
                </button>
              </form>
            )}
          </FormDialog>
        </>
      ) : null}
    </section>
  );
}
