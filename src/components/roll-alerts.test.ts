import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RollRow } from "@/lib/database.types";

const mocks = vi.hoisted(() => ({
  effect: undefined as undefined | (() => (() => void)),
  refresh: vi.fn(),
  setAuth: vi.fn(),
  on: vi.fn(),
  subscribe: vi.fn(),
  removeChannel: vi.fn(),
  toastRoll: vi.fn(),
  warning: vi.fn(),
  dismiss: vi.fn(),
}));

vi.mock("react", () => ({
  useEffect: (effect: () => (() => void)) => { mocks.effect = effect; },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("sonner", () => ({ toast: { warning: mocks.warning, dismiss: mocks.dismiss } }));
vi.mock("@/lib/roll-toast", () => ({ toastRoll: mocks.toastRoll }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    realtime: { setAuth: mocks.setAuth },
    channel: () => ({ on: mocks.on, subscribe: mocks.subscribe }),
    removeChannel: mocks.removeChannel,
  }),
}));

import { RollAlerts } from "./roll-alerts";

const publicRoll: RollRow = {
  id: "roll-1", roller_id: "other-player", roller_display_name: "Player",
  is_private: false, expression: "1d20", faces: [12], constant: 0,
  total: 12, created_at: "2026-09-17T14:00:00Z",
};

let insert: (payload: { new: RollRow }) => void;
let status: (status: string, error?: Error) => void;
let cleanup: (() => void) | undefined;
let documentMock: EventTarget & { visibilityState: string };
const channel = { on: mocks.on, subscribe: mocks.subscribe };

async function mount() {
  RollAlerts({ userId: "me" });
  cleanup = mocks.effect!();
  await Promise.resolve();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  documentMock = Object.assign(new EventTarget(), { visibilityState: "visible" });
  vi.stubGlobal("document", documentMock);
  mocks.setAuth.mockResolvedValue(undefined);
  mocks.on.mockImplementation((_event, _filter, callback) => {
    insert = callback;
    return channel;
  });
  mocks.subscribe.mockImplementation((callback) => {
    status = callback;
    return channel;
  });
});

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("live roll updates", () => {
  it("authenticates before subscribing to RLS-protected inserts", async () => {
    await mount();
    expect(mocks.setAuth).toHaveBeenCalledWith();
    expect(mocks.on).toHaveBeenCalledWith("postgres_changes", {
      event: "INSERT", schema: "public", table: "rolls",
    }, expect.any(Function));
    expect(mocks.setAuth.mock.invocationCallOrder[0]).toBeLessThan(mocks.on.mock.invocationCallOrder[0]);
  });

  it("alerts another player's roll and refreshes server-rendered history", async () => {
    await mount();
    insert({ new: publicRoll });
    expect(mocks.toastRoll).toHaveBeenCalledWith(publicRoll);
    vi.advanceTimersByTime(100);
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("also alerts same-account tabs and refreshes their history", async () => {
    await mount();
    const ownRoll = { ...publicRoll, roller_id: "me" };
    insert({ new: ownRoll });
    vi.advanceTimersByTime(100);
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(mocks.toastRoll).toHaveBeenCalledWith(ownRoll);
  });

  it("coalesces bursts into one refresh while keeping all alerts", async () => {
    await mount();
    insert({ new: publicRoll });
    insert({ new: { ...publicRoll, id: "roll-2" } });
    vi.advanceTimersByTime(100);
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(mocks.toastRoll).toHaveBeenCalledTimes(2);
  });

  it("catches up on initial subscription and reconnection without replaying toasts", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await mount();
    status("SUBSCRIBED");
    vi.advanceTimersByTime(100);
    status("CHANNEL_ERROR", new Error("offline"));
    expect(mocks.warning).toHaveBeenCalledOnce();
    status("SUBSCRIBED");
    vi.advanceTimersByTime(100);
    expect(mocks.refresh).toHaveBeenCalledTimes(2);
    expect(mocks.toastRoll).not.toHaveBeenCalled();
    expect(mocks.dismiss).toHaveBeenCalledWith("rolls-connection-me");
  });

  it("catches up when a backgrounded tab becomes visible", async () => {
    await mount();
    documentMock.visibilityState = "hidden";
    documentMock.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(100);
    expect(mocks.refresh).not.toHaveBeenCalled();
    documentMock.visibilityState = "visible";
    documentMock.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(100);
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("removes the channel, pending refresh, and listeners on unmount", async () => {
    await mount();
    insert({ new: publicRoll });
    cleanup!();
    cleanup = undefined;
    documentMock.dispatchEvent(new Event("visibilitychange"));
    status("SUBSCRIBED");
    insert({ new: publicRoll });
    vi.advanceTimersByTime(100);
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.removeChannel).toHaveBeenCalledWith(channel);
    expect(mocks.toastRoll).toHaveBeenCalledOnce();
  });

  it("does not open a channel if unmounted while auth is resolving", async () => {
    let resolveAuth!: () => void;
    mocks.setAuth.mockReturnValue(new Promise<void>((resolve) => { resolveAuth = resolve; }));
    await mount();
    expect(mocks.on).not.toHaveBeenCalled();
    cleanup!();
    cleanup = undefined;
    resolveAuth();
    await Promise.resolve();
    expect(mocks.on).not.toHaveBeenCalled();
  });
});
