import BaseContext from 'lezer-feel'

export class EntriesContext extends BaseContext {
    constructor(value = { entries: {} }) {
      super(value);
  
      this.value.entries = this.value.entries || {};
      for (const key in this.value.entries) {
        const entry = this.value.entries[key];
  
        if (
          this.isAtomic(entry)
        ) {
          continue;
        }
  
        this.value.entries[key] = new EntriesContext(this.value.entries[key]);
      }
    }
  
    getKeys() {
      return Object.keys(this.value.entries);
    }
  
    get(key) {
      return this.value.entries[key];
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
        if (!context?.value) {
          return merged;
        }
  
        return {
          ...merged,
          ...context.value,
          entries: {
            ...merged.entries,
            ...context.value?.entries
          }
        };
      }, {});
  
      return new EntriesContext(merged);
    }
  }