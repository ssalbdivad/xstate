type Compute<A extends any> = { [K in keyof A]: A[K] } & unknown;

// should create an object mapping the name of each state to the names of the events of that state
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
      },
      b: {
        on: {
          NEXT: 'c'
        }
      },
      c: {
        entry: 'doStuff',
        on: {}
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

type ExtractEventsByState<TStates extends StatesDefinition, TEvent> = Compute<{
  [Name in keyof TStates]: Extract<
    TEvent,
    { type: SourceEvents<TStates>[Name] }
  >;
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
  extracted: ExtractSourceEvents<TStates, TEvent, SourceEvents<TStates>>;
  sources: SourceEvents<TStates>;
  actions: ExtractEventsByAction<
    TStates,
    ExtractSourceEvents<TStates, TEvent, SourceEvents<TStates>>
  >;
  events: ExtractEventsByState<TStates, TEvent>;
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
  event?: Event;
  entry?: string | ((event: Event) => void);
};

type ValidateState<TState, Name, Event> = {
  [K in keyof TState]: TState[K] extends (...args: unknown[]) => any
    ? (event: Event) => void
    : Conform<TState[K], State<Name, Event>[K]>;
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
  //  InternalMachineImplementations<
  //   TConfig['context'],
  //   TConfig['context']['event'],
  //   ResolveTypegenMeta<
  //     TypegenDisabled,
  //     TConfig['context']['event'],
  //     ParameterizedObject,
  //     ActorMap
  //   >
  // >
) {
  return {} as Parsed;
  // return new StateMachine<any, any, any, any, any>(
  //   config,
  //   implementations as any
  // );
}
