import { VariableContext } from 'lezer-feel';

export class EntriesContext extends VariableContext {
  constructor(value = { entries: {} }) {
    super(value);

    this.value.entries = this.value.entries || {};

    const context = this.value;

    for (const key in context.entries) {
      const entry = context.entries[key];

      if (entry instanceof EntriesContext) {
        continue;
      }

      context.entries[key] = this.constructor.of(context.entries[key]);
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
    return this.constructor.of(
      {
        ...this.value,
        entries: {
          ...this.value.entries,
          [key]: value
        }
      }
    );
  }

  static of(...contexts) {
    const unwrap = (context) => {

      if (
        this.isAtomic(context)
      ) {
        if (context instanceof this) {
          return context.value;
        }

        return {
          atomic: true,
          atomicValue: context
        };
      }

      return { ...context };
    };

    const merged = contexts.reduce((merged, context) => {

      const {
        entries = {},
        ...rest
      } = unwrap(context);

      return {
        ...merged,
        ...rest,
        entries: {
          ...merged.entries,
          ...entries
        }
      };
    }, {});

    return new this(merged);
  }
}