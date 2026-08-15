import { REPEATER_STORE_KEY } from '../config';
import { normalizeRepeater } from './normalizeRepeater';
import { uid } from '../utils/uid';
import type { ExportedState, Repeater } from './types';

type Listener = () => void;

class RepeaterStore {
  private repeaters: Repeater[] = [];
  private listeners = new Set<Listener>();

  constructor() {
    this.load();
  }

  getAll(): Repeater[] {
    return this.repeaters;
  }

  getById(id: string): Repeater | undefined {
    return this.repeaters.find((r) => r.id === id);
  }

  add(data: Omit<Repeater, 'id'>): Repeater {
    const repeater: Repeater = { id: uid(), ...data };
    this.repeaters.push(repeater);
    this.persist();
    return repeater;
  }

  update(id: string, patch: Partial<Omit<Repeater, 'id'>>): void {
    const repeater = this.getById(id);
    if (!repeater) return;
    Object.assign(repeater, patch);
    this.persist();
  }

  remove(id: string): void {
    this.repeaters = this.repeaters.filter((r) => r.id !== id);
    this.persist();
  }

  replaceAll(repeaters: Repeater[]): void {
    this.repeaters = repeaters;
    this.persist();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private persist(): void {
    const payload: ExportedState = { schemaVersion: 1, repeaters: this.repeaters };
    localStorage.setItem(REPEATER_STORE_KEY, JSON.stringify(payload));
    this.notify();
  }

  private load(): void {
    const raw = localStorage.getItem(REPEATER_STORE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as ExportedState;
      if (parsed.schemaVersion === 1 && Array.isArray(parsed.repeaters)) {
        this.repeaters = parsed.repeaters.map(normalizeRepeater);
      }
    } catch {
      // Corrupt localStorage payload — start fresh rather than crash.
      this.repeaters = [];
    }
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}

export const repeaterStore = new RepeaterStore();
