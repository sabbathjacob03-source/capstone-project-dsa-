import { DomainError } from '../domain/errors.js';
import { systemClock } from '../lib/clock.js';
import { verifyTicketToken } from '../lib/ticketToken.js';

export async function checkIn(repository, code, clock = systemClock) {
  if (typeof code !== 'string' || code.trim() === '') {
    throw new DomainError('INVALID', 'Ticket code is invalid');
  }
  const ticket = verifyTicketToken(code.trim());
  if (!ticket) throw new DomainError('INVALID', 'Ticket code is invalid');
  const result = await repository.checkInBooking(ticket.reference, clock.now().toISOString());
  if (!result) throw new DomainError('INVALID', 'Ticket code is invalid');
  return result;
}
