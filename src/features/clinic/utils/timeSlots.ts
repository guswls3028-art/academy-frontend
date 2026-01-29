export function buildTimeSlots(
  start = 9,
  end = 22,
  stepMinutes = 60
) {
  const slots: string[] = [];
  for (let h = start; h < end; h++) {
    const hh = String(h).padStart(2, "0");
    slots.push(`${hh}:00`);
  }
  return slots;
}
