import { ResolveTypegenMeta, TypegenDisabled } from './typegenTypes.ts';
import {
  ActorMap,
  Compute,
  InternalMachineImplementations,
  MachineConfig,
  ParameterizedObject,
  StateNodeConfig,
  StatesConfig
} from './types.ts';

// type NextStates<
//   States extends StatesConfig<any, any>,
//   Name extends keyof States
// > ={
//   [K in keyof States[Name]['on']]: States[Name]["on"][K] extends infer NextName extends keyof States
//     ? NextName | NextStates<States, NextName>
//     : never;
// }[keyof States[Name]["on"]];

// type StateNextEvents<States extends StatesConfig<any, any>> = Compute<{
//   [Name in keyof States]: NextStates<States, Name>;
// }>;

type SourceEvents<
  States extends StatesConfig<any, any>,
  Name extends keyof States
> = {
  [K in keyof States]: {
    [K2 in keyof States[K]['on']]: States[K]['on'][K2] extends Name
      ? K2
      : never;
  }[keyof States[K]['on']];
}[keyof States];

type ParseStates<TStates extends UnknownStatesConfig, TEvent> = Compute<{
  [Name in keyof TStates]: {
    events: Extract<TEvent, { type: SourceEvents<TStates, Name> }>;
  };
}>;

type ParseMachine<TConfig extends UnknownMachineConfig> = Compute<{
  states: ParseStates<TConfig['states'] & {}, TConfig['context']['events']>;
}>;

type Conform<T, Base> = T extends Base ? T : Base;

type UnknownStateConfig = StateNodeConfig<any, any>;

type UnknownStatesConfig = StatesConfig<any, any>;

type UnknownMachineConfig = MachineConfig<any, any, any, any, any>;

type ParsedState = {
  events: unknown;
};

type ParsedMachine = {
  states: Record<string | number | symbol, ParsedState>;
};

type ValidateStates<
  TStates extends UnknownStatesConfig,
  Parsed extends ParsedMachine
> = {
  [K in keyof TStates]: Conform<
    TStates[K],
    {
      [K2 in keyof TStates[K] as K2 extends 'entry'
        ? never
        : K2]: TStates[K][K2];
    }
  > & { entry?: (event: Parsed['states'][K]['events']) => void };
};

type ValidateMachine<
  TConfig extends UnknownMachineConfig,
  Parsed extends ParsedMachine
> = {
  [K in keyof TConfig]: K extends 'states'
    ? ValidateStates<TConfig[K] & {}, Parsed>
    : TConfig[K];
};

export function createMachine<TConfig extends UnknownMachineConfig>(
  config: ValidateMachine<TConfig, ParseMachine<TConfig>>,
  implementations?: InternalMachineImplementations<
    TConfig['context'],
    TConfig['context']['event'],
    ResolveTypegenMeta<
      TypegenDisabled,
      TConfig['context']['event'],
      ParameterizedObject,
      ActorMap
    >
  >
) {
  return {} as ParseMachine<TConfig>;
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
    initial: 'a' as const,
    states: {
      a: {
        on: {
          NEXT: 'b' as const
        }
      },
      b: {
        // inline aciton
        entry: (event) => {
          //     ^?
          event; // { type: 'NEXT'; payload: number }
        },
        on: {
          NEXT: 'c' as const
        }
      },
      c: {
        entry: () => {} //'doStuff' as const
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
