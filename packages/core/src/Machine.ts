import { Compute, MachineConfig } from './types.ts';

type SourceEvents<States extends StatesDefinition> = {
  [K in keyof States]: {
    [K2 in keyof States[K]['on']]: States[K]['on'][K2] extends keyof States
      ? K2
      : never;
  }[keyof States[K]['on']];
}[keyof States];

type EventsByAction<States extends StatesDefinition> = {
  [K in keyof States]: States[K]['entry'] extends string
    ? { [_ in States[K]['entry']]: K }
    : never;
}[keyof States];

type ParseStates<TStates extends StatesDefinition, TEvent> = Compute<{
  states: Compute<{
    [Name in keyof TStates]: {
      events: Extract<TEvent, { type: SourceEvents<TStates> }>;
    };
  }>;
  actions: EventsByAction<TStates>;
}>;

type Conform<T, Base> = T extends Base ? T : Base;

type UnknownMachineConfig = MachineConfig<any, any, any, any, any>;

type ParsedState = {
  events: unknown;
};

type ParsedStates = {
  states: Record<string | number | symbol, ParsedState>;
  actions: unknown;
};

type StatesDefinition = Record<
  string | number | symbol,
  State<string | number | symbol, unknown>
>;

type State<Name, Event> = {
  on: Record<string, Name>;
  event?: Event;
  entry?: string | ((event: Event) => void);
};

type ValidateState<TState, Name, Event> = Conform<TState, State<Name, Event>>;

type Machine = Omit<UnknownMachineConfig, 'states'>;

export function createMachine<
  const TConfig extends Machine,
  const TStates,
  Parsed extends ParsedStates = ParseStates<
    TStates,
    TConfig['context']['events']
  >
>(
  config: TConfig & {
    states: {
      [K in keyof TStates]: ValidateState<
        TStates[K],
        keyof TStates,
        Parsed['states'][K]['events']
      > & { entry?: string | ((event: Parsed['states'][K]['events']) => void) };
    };
  },
  implementations?: {}
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

const result = createMachine(
  //    ^?
  {
    context: {
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
          NEXT: 'b'
        }
      },
      b: {
        // inline aciton
        entry: (event) => {
          //^?
          event; // { type: 'NEXT'; payload: number }
        },
        on: {
          NEXT: 'c'
          //^?
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
        event; // { type: 'NEXT'; payload: number }
      }
    }
  }
);

// targets:
// - #id - just any state that has this id
// - a - target a sibling state with a key
// - .foo - target a child state with foo key

const result2 = createMachine(
  {
    initial: 'a',
    states: {
      a: {
        initial: 'a1',
        states: {
          a1: {
            on: {
              NEXT: '#foo'
            }
          }
        }
      },
      b: {
        initial: 'b1',
        entry: 'doThing',
        states: {
          b1: {
            id: 'foo',
            always: 'b2'
          },
          b2: {
            entry: 'doSmthElse'
          }
        }
      }
    }
  },
  {
    actions: {
      doThing: (event) => {
        event; // { type: 'NEXT'; payload: number }
      },
      doSmthElse: (event) => {
        event; // { type: 'NEXT'; payload: number }
      }
    }
  }
);
