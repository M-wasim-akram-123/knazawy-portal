'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { messages } from '@knazawy/i18n';
import {
  can,
  type HotelRoomRecord,
  type RoomFloorRecord,
  type RoomTypeRecord,
} from '@knazawy/shared';
import { useEffect, useState } from 'react';

import { explainApiError } from '../../lib/explain';
import { api, readSessionUser } from '../../lib/session';
import { Field } from '../master/Field';

export function RoomsScreen() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [floors, setFloors] = useState<RoomFloorRecord[]>([]);
  const [types, setTypes] = useState<RoomTypeRecord[]>([]);
  const [rooms, setRooms] = useState<HotelRoomRecord[]>([]);
  const [floorName, setFloorName] = useState('');
  const [floorOrder, setFloorOrder] = useState('0');
  const [typeName, setTypeName] = useState('');
  const [chargeName, setChargeName] = useState<Record<string, string>>({});
  const [chargeAmount, setChargeAmount] = useState<Record<string, string>>({});
  const [roomFloorId, setRoomFloorId] = useState('');
  const [roomTypeId, setRoomTypeId] = useState('');
  const [roomName, setRoomName] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);

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
    const session = readSessionUser();
    setUser(session);
    setReady(true);
    if (!session) return;
    void reload().catch((caught: unknown) => setError(explainApiError(caught, setUser)));
  }, []);

  if (!ready) return <p>Loading</p>;
  if (!user) {
    return (
      <p>
        <a href="/login">{messages.en.common.signIn}</a> to set up rooms.
      </p>
    );
  }

  const canWrite = can(user.role, 'rooms', 'C');
  const canChange = can(user.role, 'rooms', 'U');
  const openFloors = floors.filter((floor) => floor.active);
  const openTypes = types.filter((roomType) => roomType.active);

  async function run(action: () => Promise<void>, message: string): Promise<void> {
    setBusy(true);
    setError('');
    setSaved('');
    try {
      await action();
      await reload();
      setSaved(message);
    } catch (caught: unknown) {
      setError(explainApiError(caught, setUser));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="kz-stack">
      <div className="kz-page-head">
        <h1>{messages.en.common.rooms}</h1>
        <p>
          Name the floors, the rooms on each floor, the room types, and every charge that makes up a
          night&apos;s price. Nothing here is fixed.
        </p>
        <p lang="ur" dir="rtl">
          {messages.ur.common.rooms}
        </p>
      </div>
      {error ? (
        <p className="kz-error" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? <p>{saved}</p> : null}
      <div className="kz-workspace">
        <form
          className="kz-panel kz-form"
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              await api.createRoomFloor({
                name: floorName.trim(),
                sortOrder: Number(floorOrder) || 0,
              });
              setFloorName('');
            }, 'Floor added.');
          }}
        >
          <h2>Floors</h2>
          {canWrite ? (
            <div className="kz-form-grid">
              <Field label="Floor name" hint="Any name you use, such as Ground or 2.">
                <input
                  value={floorName}
                  maxLength={80}
                  onChange={(event) => setFloorName(event.target.value)}
                  required
                />
              </Field>
              <Field label="Order" hint="Lower numbers are listed first.">
                <input
                  type="number"
                  min={0}
                  max={999}
                  value={floorOrder}
                  onChange={(event) => setFloorOrder(event.target.value)}
                />
              </Field>
            </div>
          ) : null}
          {canWrite ? (
            <button type="submit" className="kz-button" disabled={busy}>
              Add floor
            </button>
          ) : null}
          {floors.length === 0 ? <p className="kz-empty">No floors yet.</p> : null}
          <ul className="kz-stack">
            {floors.map((floor) => (
              <li key={floor.id}>
                {floor.name}
                {floor.active ? '' : ' (archived)'}
                <span className="kz-help"> · order {floor.sortOrder}</span>
                {canChange && floor.active ? (
                  <button
                    type="button"
                    className="kz-button-quiet"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () =>
                          api.updateRoomFloor(floor.id, { active: false }).then(() => undefined),
                        `${floor.name} is archived.`,
                      )
                    }
                  >
                    Archive
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </form>
        <div className="kz-panel kz-stack">
          <h2>Room types and charges</h2>
          <p className="kz-help">
            A night&apos;s price is the active charges added together. Add a charge for the room,
            for breakfast, or for anything else you bill per night.
          </p>
          {canWrite ? (
            <form
              className="kz-form"
              onSubmit={(event) => {
                event.preventDefault();
                void run(async () => {
                  await api.createRoomType({ name: typeName.trim() });
                  setTypeName('');
                }, 'Room type added.');
              }}
            >
              <Field label="Room type">
                <input
                  value={typeName}
                  maxLength={80}
                  onChange={(event) => setTypeName(event.target.value)}
                  required
                />
              </Field>
              <button type="submit" className="kz-button" disabled={busy}>
                Add room type
              </button>
            </form>
          ) : null}
          {types.length === 0 ? <p className="kz-empty">No room types yet.</p> : null}
          {types.map((roomType) => (
            <article key={roomType.id} className="kz-stack">
              <h3>
                {roomType.name}
                {roomType.active ? '' : ' (archived)'}
              </h3>
              <p>Per night {roomType.nightlyTotal} PKR</p>
              <ul>
                {roomType.charges.map((charge) => (
                  <li key={charge.id}>
                    {charge.name}: {charge.amountPerNight} PKR
                    {charge.active ? '' : ' (archived)'}
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
                            `${charge.name} is archived.`,
                          )
                        }
                      >
                        Archive
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
              {canWrite && roomType.active ? (
                <form
                  className="kz-form-grid"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void run(async () => {
                      await api.addRoomCharge(roomType.id, {
                        name: (chargeName[roomType.id] ?? '').trim(),
                        amountPerNight: (chargeAmount[roomType.id] ?? '').trim(),
                      });
                      setChargeName((current) => ({ ...current, [roomType.id]: '' }));
                      setChargeAmount((current) => ({ ...current, [roomType.id]: '' }));
                    }, 'Charge added.');
                  }}
                >
                  <Field label="Charge name">
                    <input
                      value={chargeName[roomType.id] ?? ''}
                      maxLength={80}
                      onChange={(event) =>
                        setChargeName((current) => ({
                          ...current,
                          [roomType.id]: event.target.value,
                        }))
                      }
                      required
                    />
                  </Field>
                  <Field label="Per night (PKR)">
                    <input
                      value={chargeAmount[roomType.id] ?? ''}
                      inputMode="decimal"
                      onChange={(event) =>
                        setChargeAmount((current) => ({
                          ...current,
                          [roomType.id]: event.target.value,
                        }))
                      }
                      required
                    />
                  </Field>
                  <button type="submit" className="kz-button" disabled={busy}>
                    Add charge
                  </button>
                </form>
              ) : null}
              {canChange && roomType.active ? (
                <button
                  type="button"
                  className="kz-button-quiet"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () =>
                        api.updateRoomType(roomType.id, { active: false }).then(() => undefined),
                      `${roomType.name} is archived.`,
                    )
                  }
                >
                  Archive type
                </button>
              ) : null}
            </article>
          ))}
        </div>
      </div>
      <form
        className="kz-panel kz-form"
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            await api.createHotelRoom({
              floorId: roomFloorId,
              roomTypeId: roomTypeId,
              name: roomName.trim(),
            });
            setRoomName('');
          }, 'Room added.');
        }}
      >
        <h2>Rooms by floor</h2>
        {canWrite ? (
          <div className="kz-form-grid">
            <Field label="Floor">
              <select
                value={roomFloorId}
                onChange={(event) => setRoomFloorId(event.target.value)}
                required
              >
                <option value="">Choose a floor</option>
                {openFloors.map((floor) => (
                  <option key={floor.id} value={floor.id}>
                    {floor.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Room type">
              <select
                value={roomTypeId}
                onChange={(event) => setRoomTypeId(event.target.value)}
                required
              >
                <option value="">Choose a type</option>
                {openTypes.map((roomType) => (
                  <option key={roomType.id} value={roomType.id}>
                    {roomType.name} · {roomType.nightlyTotal} PKR
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Room name" hint="Unique on this floor, such as 101.">
              <input
                value={roomName}
                maxLength={80}
                onChange={(event) => setRoomName(event.target.value)}
                required
              />
            </Field>
          </div>
        ) : null}
        {canWrite ? (
          <button type="submit" className="kz-button" disabled={busy}>
            Add room
          </button>
        ) : null}
        {rooms.length === 0 ? <p className="kz-empty">No rooms yet.</p> : null}
        {floors.map((floor) => {
          const onFloor = rooms.filter((room) => room.floorId === floor.id);
          if (onFloor.length === 0) return null;
          return (
            <div key={floor.id}>
              <h3>{floor.name}</h3>
              <ul>
                {onFloor.map((room) => (
                  <li key={room.id}>
                    {room.name} · {room.roomTypeName}
                    {room.active ? '' : ' (archived)'}
                    {canChange && room.active ? (
                      <button
                        type="button"
                        className="kz-button-quiet"
                        disabled={busy}
                        onClick={() =>
                          void run(
                            () =>
                              api.updateHotelRoom(room.id, { active: false }).then(() => undefined),
                            `${room.name} is archived.`,
                          )
                        }
                      >
                        Archive
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </form>
    </section>
  );
}
