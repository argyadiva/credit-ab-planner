import { simulate } from './simulation';
import type { Plan } from './model';

self.onmessage = (event: MessageEvent<Plan>) => {
  try {
    self.postMessage({ ok: true, result: simulate(event.data) });
  } catch (error) {
    self.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : 'Simulation could not finish. Try again.',
    });
  }
};
