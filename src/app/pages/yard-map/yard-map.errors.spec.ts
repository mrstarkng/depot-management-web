import { HttpErrorResponse } from '@angular/common/http';
import { describeYardMapError } from './yard-map.errors';

describe('describeYardMapError', () => {
  const errOf = (status: number, message = 'x') => new HttpErrorResponse({
    status,
    statusText: 'ERR',
    error: { Message: message },
    url: '/api/yard-map',
  });

  it('401 → login action', () => {
    const d = describeYardMapError(errOf(401), 'Action');
    expect(d.action).toBe('login');
  });

  it('403 → warn severity', () => {
    const d = describeYardMapError(errOf(403), 'Action');
    expect(d.severity).toBe('warn');
  });

  it('404 → reload action', () => {
    const d = describeYardMapError(errOf(404), 'Action');
    expect(d.action).toBe('reload');
  });

  it('409 → reload action', () => {
    const d = describeYardMapError(errOf(409), 'Action');
    expect(d.action).toBe('reload');
  });

  it('422 → fieldError action', () => {
    const d = describeYardMapError(errOf(422), 'Action');
    expect(d.action).toBe('fieldError');
  });

  it('423 → refreshLock action', () => {
    const d = describeYardMapError(errOf(423), 'Action');
    expect(d.action).toBe('refreshLock');
  });

  it('generic Error → error severity with action name summary', () => {
    const d = describeYardMapError(new Error('boom'), 'MyAction');
    expect(d.severity).toBe('error');
    expect(d.summary).toContain('MyAction');
    expect(d.detail).toBe('boom');
  });
});
