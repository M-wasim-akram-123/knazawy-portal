'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { roomsCopy } from '@knazawy/i18n';
import {
  can,
  type HotelRoomRecord,
  type RoomFloorRecord,
  type RoomTypeRecord,
} from '@knazawy/shared';
import { FormDialog, KaramLoader } from '@knazawy/ui-shell';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { explainApiError } from '../../lib/explain';
import { fill, useCopy, useCommon } from '../../lib/i18n';
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
  const [dialogOpen, setDialogOpen] = useState(false);
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
    const session = readSessionUser();
    setUser(session);
    setReady(true);
    if (!session) return;
    void reload().catch((caught: unknown) => setError(explainApiError(caught, setUser)));
  }, []);

  if (!ready) return <KaramLoader label={t.loading} fullPage />;
  if (!user) {
    return (
      <p>
        <Link href="/login">{common.signIn}</Link> {t.signInSuffix}
      </p>
    );
  }

  const canWrite = can(user.role, 'rooms', 'C');
  const canChange = can(user.role, 'rooms', 'U');
  const openFloors = floors.filter((floor) => floor.active);
  const openTypes = types.filter((roomType) => roomType.active);

  async function run(action: () => Promise<void>, message: string): Promise<boolean> {
    setBusy(true);
    setError('');
    setSaved('');
    try {
      await action();
      await reload();
      setSaved(message);
      return true;
    } catch (caught: unknown) {
      setError(explainApiError(caught, setUser));
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="kz-stack">
      <div className="kz-page-head kz-page-action-head">
        <div>
          <h1>{common.rooms}</h1>
          <p>{t.intro}</p>
        </div>
        {canWrite ? (
          <button
            className="kz-button kz-form-dialog-trigger"
            type="button"
            aria-haspopup="dialog"
            onClick={() => {
              setError('');
              setSaved('');
              setDialogOpen(true);
            }}
          >
            {t.addFloor}
          </button>
        ) : null}
      </div>
      {canWrite ? (
        <FormDialog
          buttonLabel={t.addFloor}
          title={t.addFloor}
          showTrigger={false}
          isOpen={dialogOpen}
          onOpenChange={setDialogOpen}
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
              {error ? (
                <p className="kz-error" role="alert">
                  {error}
                </p>
              ) : null}
              <button type="submit" className="kz-button" disabled={busy}>
                {t.addFloor}
              </button>
            </form>
          )}
        </FormDialog>
      ) : null}
      {error ? (
        <p className="kz-error" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? <p>{saved}</p> : null}
      <div className="kz-workspace kz-workspace-single">
        <div className="kz-panel kz-stack">
          <h2>{t.floors}</h2>
          {floors.length === 0 ? <p className="kz-empty">{t.noFloors}</p> : null}
          <ul className="kz-stack">
            {floors.map((floor) => (
              <li key={floor.id}>
                {floor.name}
                {floor.active ? '' : t.archivedSuffix}
                <span className="kz-help">{fill(t.orderValue, { order: floor.sortOrder })}</span>
                {canChange && floor.active ? (
                  <button
                    type="button"
                    className="kz-button-quiet"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () =>
                          api.updateRoomFloor(floor.id, { active: false }).then(() => undefined),
                        fill(t.isArchived, { name: floor.name }),
                      )
                    }
                  >
                    {common.archive}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
        <div className="kz-panel kz-stack">
          <h2>{t.typesAndCharges}</h2>
          <p className="kz-help">{t.typesHelp}</p>
          {canWrite ? (
            <form
              className="kz-form"
              onSubmit={(event) => {
                event.preventDefault();
                void run(async () => {
                  await api.createRoomType({ name: typeName.trim() });
                  setTypeName('');
                }, t.roomTypeAdded);
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
              <button type="submit" className="kz-button" disabled={busy}>
                {t.addRoomType}
              </button>
            </form>
          ) : null}
          {types.length === 0 ? <p className="kz-empty">{t.noRoomTypes}</p> : null}
          {types.map((roomType) => (
            <article key={roomType.id} className="kz-stack">
              <h3>
                {roomType.name}
                {roomType.active ? '' : t.archivedSuffix}
              </h3>
              <p>{fill(t.perNight, { amount: roomType.nightlyTotal })}</p>
              <ul>
                {roomType.charges.map((charge) => (
                  <li key={charge.id}>
                    {charge.name}: {charge.amountPerNight} SAR
                    {charge.active ? '' : t.archivedSuffix}
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
                    }, t.chargeAdded);
                  }}
                >
                  <Field label={t.chargeName}>
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
                  <Field label={t.perNightPkr}>
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
                    {t.addCharge}
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
                      fill(t.isArchived, { name: roomType.name }),
                    )
                  }
                >
                  {t.archiveType}
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
          }, t.roomAdded);
        }}
      >
        <h2>{t.roomsByFloor}</h2>
        {canWrite ? (
          <div className="kz-form-grid">
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
              <select
                value={roomTypeId}
                onChange={(event) => setRoomTypeId(event.target.value)}
                required
              >
                <option value="">{t.chooseType}</option>
                {openTypes.map((roomType) => (
                  <option key={roomType.id} value={roomType.id}>
                    {roomType.name} · {roomType.nightlyTotal} SAR
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t.roomName} hint={t.roomNameHint}>
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
            {t.addRoom}
          </button>
        ) : null}
        {rooms.length === 0 ? <p className="kz-empty">{t.noRooms}</p> : null}
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
                    {room.active ? '' : t.archivedSuffix}
                    {canChange && room.active ? (
                      <button
                        type="button"
                        className="kz-button-quiet"
                        disabled={busy}
                        onClick={() =>
                          void run(
                            () =>
                              api.updateHotelRoom(room.id, { active: false }).then(() => undefined),
                            fill(t.isArchived, { name: room.name }),
                          )
                        }
                      >
                        {common.archive}
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
