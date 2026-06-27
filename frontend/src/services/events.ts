import { rpc, scValToNative } from '@stellar/stellar-sdk';
import { CONTRACT_ID, RPC_URL } from '../utils/constants';

const server = new rpc.Server(RPC_URL);

export type EventCallback = (event: { type: string; data: any; ledger: number }) => void;

export class EventPoller {
  private static intervalId: any = null;
  private static lastLedger: number = 0;
  private static listeners: Set<EventCallback> = new Set();

  public static subscribe(callback: EventCallback): () => void {
    this.listeners.add(callback);
    if (!this.intervalId) {
      this.startPolling();
    }
    return () => {
      this.listeners.delete(callback);
      if (this.listeners.size === 0 && this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
    };
  }

  private static async startPolling() {
    try {
      const latestLedgerRes = await server.getLatestLedger();
      this.lastLedger = Math.max(1, latestLedgerRes.sequence - 100);
    } catch {
      // Will retry on next interval
    }

    this.intervalId = setInterval(async () => {
      if (this.listeners.size === 0) return;
      try {
        const response = await server.getEvents({
          startLedger: this.lastLedger,
          filters: [
            {
              type: 'contract',
              contractIds: [CONTRACT_ID],
            },
          ],
          limit: 20,
        });

        if (response.events && response.events.length > 0) {
          for (const ev of response.events) {
            this.lastLedger = Math.max(this.lastLedger, ev.ledger + 1);

            let topicSymbol = 'unknown';
            if (ev.topic && ev.topic.length > 1) {
              try {
                topicSymbol = String(scValToNative(ev.topic[1] as any));
              } catch {
                topicSymbol = 'event';
              }
            }

            this.listeners.forEach((fn) => fn({
              type: topicSymbol,
              data: ev.value,
              ledger: ev.ledger,
            }));
          }
        }
      } catch {
        // Transient RPC errors are expected, will retry next interval
      }
    }, 4000);
  }
}
