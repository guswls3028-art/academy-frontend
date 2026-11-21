import type { RosterStudent } from "./ClassRosterModal";

export const digits = (value?: string) => (value ?? "").replace(/\D/g, "");
const normalize = (value: string) => value.normalize("NFKC").replace(/\s+/g, "").toLowerCase();

export function filterRoster(students: RosterStudent[], search: string, grade: string) {
  const term = normalize(search).slice(0,100);
  const number = /^[\d()+.-]+$/.test(term) && digits(term);
  return students.filter(student => (!grade || String(student.grade) === grade)
    && (normalize(student.name).includes(term) || normalize(student.school || "").includes(term)
      || (number && [student.phone, student.parent_phone].some(phone => digits(phone).includes(number)))));
}


export function updateRosterSelection(selected: Map<number, RosterStudent>, students: RosterStudent[], remove: boolean) {
  const next = new Map(selected);
  for (const student of students) {
    if (remove) next.delete(student.id);
    else next.set(student.id, student);
  }
  return next.size <= 200 ? next : null;
}
