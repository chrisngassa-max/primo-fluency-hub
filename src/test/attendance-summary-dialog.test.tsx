import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AttendanceSummaryDialog from '../components/formateur/AttendanceSummaryDialog';
const fixture = vi.hoisted(() => ({ data: {
  sessions: [{ id: 's', date_seance: '2026-01-01T09:00:00Z', duree_minutes: 180, statut: 'terminee' }],
  presences: [], participants: [{ eleve_id: 'e', nom: 'Dupont', prenom: 'Anne' }], former: false,
}, isError: false, isFetching: false, refetch: vi.fn() }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => fixture }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/lib/attendanceSummaryPdf', () => ({ createAttendancePdf: vi.fn() }));
let root: Root;
let container: HTMLDivElement;
afterEach(async () => { await act(async () => root?.unmount()); container?.remove(); fixture.isError = false; fixture.isFetching = false; });
const button = (text: string) => [...document.querySelectorAll('button')].find(b => b.textContent === text)!;
const click = async (element: HTMLElement) => act(async () => element.click());
const change = async (element: HTMLInputElement, value: string) => act(async () => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
});
const open = async () => {
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(<AttendanceSummaryDialog group={{ id: 'g', nom: 'Groupe A' }} members={[]} />));
  await click(button('Exporter le bilan de présence'));
};
describe('export interface', () => {
  it('requires training title and acknowledgment, resets acknowledgment when period changes', async () => {
    await open();
    const exportButton = button('Exporter le PDF A4 paysage');
    expect(exportButton.disabled).toBe(true);
    await change(document.getElementById('training-g') as HTMLInputElement, 'TCF IRN');
    expect(exportButton.disabled).toBe(true);
    await click(document.querySelectorAll<HTMLInputElement>('input[type=checkbox]')[1]);
    expect(exportButton.disabled).toBe(false);
    await click(document.querySelectorAll<HTMLInputElement>('input[type=checkbox]')[0]);
    expect(exportButton.disabled).toBe(true);
    await change(document.getElementById('start-g') as HTMLInputElement, '2026-01-02');
    await change(document.getElementById('end-g') as HTMLInputElement, '2026-01-01');
    expect(document.body.textContent).toContain('Choisissez une période valide');
    expect(exportButton.disabled).toBe(true);
  });
  it('blocks export on loading errors', async () => {
    fixture.isError = true;
    await open();
    expect(button('Exporter le PDF A4 paysage').disabled).toBe(true);
    await click(button('Réessayer'));
    expect(fixture.refetch).toHaveBeenCalled();
  });
});
