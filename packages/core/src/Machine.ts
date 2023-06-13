import { Compute, MachineConfig } from './types.ts';

type SourceEvents<States extends StatesDefinition> = {
  [K in keyof States]: {
    [K2 in keyof States[K]['on']]: States[K]['on'][K2] extends keyof States
      ? K2
      : never;
  }[keyof States[K]['on']];
}[keyof States];

type ExtractEventsByState<TStates extends StatesDefinition, TEvent> = Compute<{
  [Name in keyof TStates]: Extract<TEvent, { type: SourceEvents<TStates> }>;
}>;

type ExtractEventsByAction<
  States extends StatesDefinition,
  ByState extends EventsByState
> = Compute<
  {
    [K in keyof States]: States[K]['entry'] extends string
      ? { [_ in States[K]['entry']]: ByState[K] }
      : never;
  }[keyof States]
>;

type ParseStates<TStates extends StatesDefinition, TEvent> = Compute<{
  events: ExtractEventsByState<TStates, TEvent>;
  actions: ExtractEventsByAction<
    TStates,
    ExtractEventsByState<TStates, TEvent>
  >;
}>;

type Conform<T, Base> = T extends Base ? T : Base;

type UnknownMachineConfig = MachineConfig<any, any, any, any, any>;

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
  [K in keyof TState]: TState[K] extends (...args: any[]) => any
    ? (event: Event) => void
    : Conform<TState[K], State<Name, Event>[K]>;
};

type Machine = Omit<UnknownMachineConfig, 'states'> & { states: unknown };

export function createMachine<
  const TConfig extends Machine,
  Parsed extends ParsedStates = ParseStates<
    TConfig['states'],
    TConfig['context']['events']
  >
>(
  config: {
    [k in keyof TConfig]: k extends 'states'
      ? {
          [k2 in keyof TConfig[k]]: ValidateState<
            TConfig[k][k2],
            keyof TConfig[k],
            Parsed['events'][k2]
          >;
        }
      : TConfig[k];
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
  return {} as Parsed['actions'];
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
          NEXT: 'b',
          MOAR: 'c'
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
