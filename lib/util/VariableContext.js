import { BaseContext } from 'lezer-feel';

export class EntriesContext extends BaseContext {
  constructor(value = { entries: {} }) {
    super(value);

    this.value.entries = this.value.entries || {};

    const context = this.value;

    if (
      this.isAtomic(value) &&
      !(value instanceof EntriesContext)
    ) {
      context.atomic = true;
      context.atomicValue = value;
    }

    for (const key in context.entries) {
      const entry = context.entries[key];

      if (entry instanceof EntriesContext) {
        continue;
      }

      context.entries[key] = new EntriesContext(context.entries[key]);
    }
  }

  getKeys() {
    return Object.keys(this.value.entries);
  }

  get(key) {
    const value = this.value.entries[key];

    if (!value) {
      return value;
    }

    if (value.atomic) {
      return value.atomicValue;
    }

    return value;
  }

  set(key, value) {
    return new EntriesContext(
      {
        ...this.value,
        entries: {
          ...this.value.entries,
          [key]: value
        }
      }
    );
  }

  static merge(...contexts) {
    const merged = contexts.reduce((merged, context) => {
      if (!(context && context.value)) {
        return merged;
      }

      return {
        ...merged,
        ...context.value,
        entries: {
          ...merged.entries,
          ...context.value.entries
        }
      };
    }, {});

    return new EntriesContext(merged);
  }
}