import {
  Compute,
  MachineConfig,
  StateNodeConfig,
  StatesConfig
} from './types.ts';

type SourceEvents<
  States extends StatesDefinition,
  Name extends keyof States
> = {
  [K in keyof States]: {
    [K2 in keyof States[K]['on']]: States[K]['on'][K2] extends Name
      ? K2
      : never;
  }[keyof States[K]['on']];
}[keyof States];

type ParseStates<TStates extends StatesDefinition, TEvent> = Compute<{
  [Name in keyof TStates]: {
    events: Extract<TEvent, { type: SourceEvents<TStates, Name> }>;
  };
}>;

type Conform<T, Base> = T extends Base ? T : Base;

type UnknownMachineConfig = MachineConfig<any, any, any, any, any>;

type ParsedState = {
  events: unknown;
};

type ParsedStates = Record<string | number | symbol, ParsedState>;

type StatesDefinition = Record<
  string | number | symbol,
  State<string | number | symbol, unknown>
>;

type State<Name, Event> = {
  on: Record<string, Name>;
  event?: Event;
  entry?: (event: Event) => any;
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
        Parsed[K]['events']
      > & { entry?: (event: Parsed[K]['events']) => any };
    };
  },
  implementations?: any
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
  return {} as TStates; //ParseStates<TStates, TConfig['context']['events']>;
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
        entry: () => {},
        on: {}
        //'doStuff' as const
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
