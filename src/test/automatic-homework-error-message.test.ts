import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { automaticHomeworkErrorMessage as message } from '@/lib/automaticHomeworkErrorMessage';

const fallback = 'Le devoir n’a pas pu être envoyé. Aucun contenu n’a été créé. Réessayez ou actualisez la page.';
const codes = [
  'homework_request_conflict', 'homework_request_required', 'homework_group_forbidden',
  'homework_session_forbidden', 'homework_student_forbidden', 'homework_inexecutable',
  'homework_invalid_entries', 'homework_invalid_entry', 'homework_empty_batch',
  'homework_original_audio_use_manual', 'homework_exercise_busy', 'homework_invalid_deadline',
  'homework_forbidden', 'homework_isolation_unsupported',
];
describe('P0.5 closed error boundary', () => {
  it('inventories every business code in the unchanged migration', () => {
    const sql = readFileSync('supabase/migrations/20261001074826_safe_automatic_homework.sql', 'utf8');
    const found = [...new Set(sql.match(/homework_(?:request_conflict|request_required|group_forbidden|session_forbidden|student_forbidden|inexecutable|invalid_entries|invalid_entry|empty_batch|original_audio_use_manual|exercise_busy|invalid_deadline|forbidden|isolation_unsupported)/g))];
    const raised = [...sql.matchAll(/(?:RAISE EXCEPTION|DETAIL=)\s*'(homework_[a-z_]+)'/g)].map(m => m[1]);
    expect([...new Set(raised)].sort()).toEqual([...codes].sort());
    expect(found.sort()).toEqual([...codes].sort());
  });
  it.each(codes)('handles %s from each documented field', code => {
    for (const field of ['message', 'details', 'hint', 'code']) {
      const result = message({ [field]: code });
      expect(result).not.toMatch(/homework_|SQLSTATE|public\./);
      if (code !== 'homework_isolation_unsupported') expect(result).not.toBe(fallback);
    }
  });
  it.each([null, undefined, 42, 'homework_inexecutable', [], {message: {}}, {message:'SELECT public.receipts; stack at send_automatic_homework'}, {message:'prefix homework_inexecutable suffix'}, {message:'toString'}, {message:'__proto__'}])('unknown input stays opaque (%j)', error => {
    expect(message(error)).toBe(fallback);
  });
  it('does not execute string coercion or propagate hostile getters', () => {
    expect(message({ get message() { throw new Error('private'); }, details: {toString() { throw new Error('private'); }} })).toBe(fallback);
  });
  it('prefers the precise recipient reason over permission SQLSTATE', () => {
    expect(message({code:'42501', message:'homework_group_forbidden'})).toBe('Vous ne pouvez pas envoyer ce devoir au groupe ou à l’élève sélectionné. Vérifiez le destinataire.');
  });
  it.each(['PGRST301', 'PGRST302', 'PGRST303', 'session_expired', 'refresh_token_not_found', 'refresh_token_already_used'])('expired auth %s', code => {
    expect(message({code})).toBe('Votre session a expiré. Reconnectez-vous avant d’envoyer le devoir.');
  });
  it('uses fixed deadline, permission and busy messages', () => {
    expect(message({message:'homework_invalid_deadline'})).toBe('Choisissez une date limite valide située dans le futur.');
    expect(message({code:'42501'})).toBe('Vous n’avez pas l’autorisation d’effectuer cet envoi.');
    expect(message({code:'55P03'})).toBe('Cet exercice est en cours de modification ou d’attribution. Réessayez dans un instant.');
  });
});
