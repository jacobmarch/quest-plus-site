import { beforeEach, expect, it, vi } from "vitest";

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { toastRoll } from "./roll-toast";

beforeEach(() => vi.clearAllMocks());

it("uses the persisted roll ID to reconcile local and Realtime toasts", () => {
  const roll = {
    id: "roll-1", roller_display_name: "Player", is_private: false,
    expression: "1d20", faces: [12], constant: 0, total: 12,
  };
  toastRoll(roll);
  toastRoll({ ...roll });
  expect(toast).toHaveBeenNthCalledWith(1, "Player · Public · 1d20 → 12", {
    id: "roll-roll-1", description: "[12] = 12",
  });
  expect(toast.mock.calls[1]).toEqual(toast.mock.calls[0]);
  toastRoll({ ...roll, id: "roll-2" });
  expect(toast.mock.calls[2][1].id).not.toBe(toast.mock.calls[0][1].id);
});
