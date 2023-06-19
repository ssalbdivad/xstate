type Compute<A> = { [K in keyof A]: A[K] } & unknown;

// should create an object mapping the name of each state to another object
// mapping the names of the states it leads to to the event names that lead to
// those states.
type SourceEvents<States extends StatesDefinition> = Compute<
  {
    [K in keyof States]: {
      [EventType in keyof States[K]['on'] as States[K]['on'][EventType]]: EventType;
    };
  }[keyof States]
>;

type ExtractSourceEvents<States, TEvent, U> = Compute<{
  [K in keyof States]: U extends { [_ in K]: infer EventType }
    ? Extract<TEvent, { type: EventType }>
    : never;
}>;

type ExtractEventsByAction<
  States extends StatesDefinition,
  Extracted
> = Compute<
  {
    [K in keyof States]: States[K]['entry'] extends string
      ? { [_ in States[K]['entry']]: Extracted[K & keyof Extracted] }
      : never;
  }[keyof States]
>;

type ParseStates<TStates extends StatesDefinition, TEvent> = Compute<{
  events: ExtractSourceEvents<TStates, TEvent, SourceEvents<TStates>>;
  actions: ExtractEventsByAction<
    TStates,
    ExtractSourceEvents<TStates, TEvent, SourceEvents<TStates>>
  >;
}>;

type Conform<T, Base> = T extends Base ? T : Base;

type EventsByState = { [stateName: Key]: unknown };

type EventsByAction = { [actionName: Key]: unknown };

type ParsedStates = {
  events: EventsByState;
  actions: EventsByAction;
};

type Key = string | symbol | number;

type StatesDefinition = Record<Key, State<Key, unknown>>;

type State<Name, Event> = {
  on: Record<string, Name>;
  entry?: string | ((event: Event) => void);
};

type ValidateState<TState, Name, Event> = {
  [K in keyof TState]: K extends 'on' | 'entry'
    ? Conform<TState[K], State<Name, Event>[K]>
    : TState[K];
};

interface Machine<TEvent extends { type: string }> {
  // initial: string;
  context: {
    events: TEvent;
  };
  states: unknown;
}

function createMachine<
  TEvent extends { type: string },
  const TConfig,
  const TStates,
  /** @ts-expect-error nede to figure out how to constrain this without breaking inference */
  Parsed extends ParsedStates = ParseStates<TStates, TEvent>
>(
  config: TConfig & { types: { events: TEvent } } & {
    states: {
      [K in keyof TStates]: ValidateState<
        TStates[K],
        keyof TStates,
        Parsed['events'][K]
      >;
    };
  },
  implementations: {
    actions: {
      [K in keyof Parsed['actions']]: (event: Parsed['actions'][K]) => void;
    };
  }
) {
  return {} as Parsed;
}

const result = createMachine(
  //    ^?
  {
    types: {
      events: {} as
        | {
            type: 'NEXT';
            payload: number;
          }
        | {
            type: 'MOAR';
          }
    },
    initial: 'a',
    states: {
      a: {
        on: {
          NEXT: 'b',
          MOAR: 'c'
        }
        // states: {
        //   a1: {
        //     on: {
        //       NEXT: 'a2'
        //     }
        //   },
        //   a2: {}
        // }
      },
      b: {
        entry: (event) => {
          //     ^?
          event;
        },
        on: {
          NEXT: 'c'
        }
      },
      c: {
        initial: 'c1',
        entry: 'doStuff',
        on: {}
        // states: {
        //   c1: {
        //     entry: 'doInitialStuff'
        //   }
        // }
      }
    }
  },
  {
    actions: {
      doStuff: (event) => {
        //      ^?
        event; // { type: 'NEXT'; payload: number }
      }
    }
  }
);
