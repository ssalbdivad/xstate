import {
  getPathFromEvents,
  getAdjacencyMap,
  joinPaths,
  AdjacencyValue
} from '@xstate/graph';
import type {
  SerializedEvent,
  SerializedState,
  SimpleBehavior,
  StatePath,
  Step,
  TraversalOptions
} from '@xstate/graph';
import { EventObject } from 'xstate';
import { isStateLike } from 'xstate/lib/utils';
import { deduplicatePaths } from './deduplicatePaths';
import {
  createShortestPathsGen,
  createShortestPathsToGen,
  createShortestPathsFromToGen,
  createSimplePathsGen,
  createSimplePathsToGen,
  createSimplePathsFromToGen
} from './pathGenerators';
import type {
  EventExecutor,
  PathGenerator,
  StatePredicate,
  TestModelOptions,
  TestParam,
  TestPath,
  TestPathResult,
  TestStepResult
} from './types';
import { formatPathTestResult, getDescription, simpleStringify } from './utils';

/**
 * Creates a test model that represents an abstract model of a
 * system under test (SUT).
 *
 * The test model is used to generate test paths, which are used to
 * verify that states in the model are reachable in the SUT.
 */
export class TestModel<TState, TEvent extends EventObject> {
  public options: TestModelOptions<TState, TEvent>;
  public defaultTraversalOptions?: TraversalOptions<TState, TEvent>;
  public getDefaultOptions(): TestModelOptions<TState, TEvent> {
    return {
      serializeState: (state) => simpleStringify(state) as SerializedState,
      serializeEvent: (event) => simpleStringify(event) as SerializedEvent,
      // For non-state-machine test models, we cannot identify
      // separate transitions, so just use event type
      serializeTransition: (state, event) =>
        `${simpleStringify(state)}|${event?.type ?? ''}`,
      getEvents: () => [],
      stateMatcher: (_, stateKey) => stateKey === '*',
      eventCases: {},
      execute: () => void 0,
      logger: {
        log: console.log.bind(console),
        error: console.error.bind(console)
      }
    };
  }

  constructor(
    public behavior: SimpleBehavior<TState, TEvent>,
    options?: Partial<TestModelOptions<TState, TEvent>>
  ) {
    this.options = {
      ...this.getDefaultOptions(),
      ...options
    };
  }

  public getPaths(
    pathGenerator: PathGenerator<TState, TEvent>,
    options?: Partial<TraversalOptions<TState, TEvent>>
  ): Array<TestPath<TState, TEvent>> {
    const paths = pathGenerator(this.behavior, this.resolveOptions(options));
    return deduplicatePaths(paths).map(this.toTestPath);
  }

  public getShortestPaths(
    options?: Partial<TraversalOptions<TState, TEvent>>
  ): Array<TestPath<TState, TEvent>> {
    return this.getPaths(createShortestPathsGen(), options);
  }

  public getShortestPathsTo(
    statePredicate: StatePredicate<TState>,
    options?: Partial<TraversalOptions<TState, TEvent>>
  ): Array<TestPath<TState, TEvent>> {
    return this.getPaths(createShortestPathsToGen(statePredicate), options);
  }

  public getShortestPathsFromTo(
    fromStatePredicate: StatePredicate<TState>,
    toStatePredicate: StatePredicate<TState>,
    options?: Partial<TraversalOptions<TState, TEvent>>
  ): Array<TestPath<TState, TEvent>> {
    return this.getPaths(
      createShortestPathsFromToGen(fromStatePredicate, toStatePredicate),
      options
    );
  }

  public getSimplePaths(
    options?: Partial<TraversalOptions<TState, TEvent>>
  ): Array<TestPath<TState, TEvent>> {
    return this.getPaths(createSimplePathsGen(), options);
  }

  public getSimplePathsTo(
    predicate: StatePredicate<TState>,
    options?: Partial<TraversalOptions<TState, TEvent>>
  ): Array<TestPath<TState, TEvent>> {
    return this.getPaths(createSimplePathsToGen(predicate), options);
  }

  public getSimplePathsFromTo(
    fromPredicate: StatePredicate<TState>,
    toPredicate: StatePredicate<TState>,
    options?: Partial<TraversalOptions<TState, TEvent>>
  ): Array<TestPath<TState, TEvent>> {
    return this.getPaths(
      createSimplePathsFromToGen(fromPredicate, toPredicate),
      options
    );
  }

  private toTestPath = (
    statePath: StatePath<TState, TEvent>
  ): TestPath<TState, TEvent> => {
    function formatEvent(event: EventObject): string {
      const { type, ...other } = event;

      const propertyString = Object.keys(other).length
        ? ` (${JSON.stringify(other)})`
        : '';

      return `${type}${propertyString}`;
    }

    const eventsString = statePath.steps
      .map((s) => formatEvent(s.event))
      .join(' → ');
    return {
      ...statePath,
      test: (params: TestParam<TState, TEvent>) =>
        this.testPath(statePath, params),
      testSync: (params: TestParam<TState, TEvent>) =>
        this.testPathSync(statePath, params),
      description: isStateLike(statePath.state)
        ? `Reaches ${getDescription(
            statePath.state as any
          ).trim()}: ${eventsString}`
        : JSON.stringify(statePath.state)
    };
  };

  public getPathFromEvents(
    events: TEvent[],
    statePredicate: StatePredicate<TState>
  ): TestPath<TState, TEvent> {
    const path = getPathFromEvents(this.behavior, events);

    if (!statePredicate(path.state)) {
      throw new Error(
        `The last state ${JSON.stringify(
          (path.state as any).value
        )} does not match the target}`
      );
    }

    return this.toTestPath(path);
  }

  public getAllStates(): TState[] {
    const adj = getAdjacencyMap(this.behavior, this.options);
    return Object.values(adj).map((x) => x.state);
  }

  public getAdjacencyList(): Array<{
    state: TState;
    event: TEvent;
    nextState: TState;
  }> {
    const adj = getAdjacencyMap(this.behavior, this.options);
    const adjList: Array<{
      state: TState;
      event: TEvent;
      nextState: TState;
    }> = [];

    for (const v of Object.values(adj)) {
      for (const t of Object.values(
        (v as AdjacencyValue<TState, TEvent>).transitions
      )) {
        adjList.push({
          state: (v as any).state,
          event: t.event,
          nextState: t.state
        });
      }
    }

    return adjList;
  }

  public testPathSync(
    path: StatePath<TState, TEvent>,
    params: TestParam<TState, TEvent>,
    options?: Partial<TestModelOptions<TState, TEvent>>
  ): TestPathResult {
    const testPathResult: TestPathResult = {
      steps: [],
      state: {
        error: null
      }
    };

    try {
      for (const step of path.steps) {
        const testStepResult: TestStepResult = {
          step,
          state: { error: null },
          event: { error: null }
        };

        testPathResult.steps.push(testStepResult);

        try {
          this.testStateSync(params, step.state, options);
        } catch (err) {
          testStepResult.state.error = err;

          throw err;
        }

        try {
          this.testTransitionSync(params, step);
        } catch (err) {
          testStepResult.event.error = err;

          throw err;
        }
      }

      try {
        this.testStateSync(params, path.state, options);
      } catch (err) {
        testPathResult.state.error = err.message;
        throw err;
      }
    } catch (err) {
      // TODO: make option
      err.message += formatPathTestResult(path, testPathResult, this.options);
      throw err;
    }

    return testPathResult;
  }

  public async testPath(
    path: StatePath<TState, TEvent>,
    params: TestParam<TState, TEvent>,
    options?: Partial<TestModelOptions<TState, TEvent>>
  ): Promise<TestPathResult> {
    const testPathResult: TestPathResult = {
      steps: [],
      state: {
        error: null
      }
    };

    try {
      for (const step of path.steps) {
        const testStepResult: TestStepResult = {
          step,
          state: { error: null },
          event: { error: null }
        };

        testPathResult.steps.push(testStepResult);

        try {
          await this.testState(params, step.state, options);
        } catch (err) {
          testStepResult.state.error = err;

          throw err;
        }

        try {
          await this.testTransition(params, step);
        } catch (err) {
          testStepResult.event.error = err;

          throw err;
        }
      }

      try {
        await this.testState(params, path.state, options);
      } catch (err) {
        testPathResult.state.error = err.message;
        throw err;
      }
    } catch (err) {
      // TODO: make option
      err.message += formatPathTestResult(path, testPathResult, this.options);
      throw err;
    }

    return testPathResult;
  }

  public async testState(
    params: TestParam<TState, TEvent>,
    state: TState,
    options?: Partial<TestModelOptions<TState, TEvent>>
  ): Promise<void> {
    const resolvedOptions = this.resolveOptions(options);

    const stateTestKeys = this.getStateTestKeys(params, state, resolvedOptions);

    for (const stateTestKey of stateTestKeys) {
      await params.states?.[stateTestKey](state);
    }

    this.afterTestState(state, resolvedOptions);
  }

  private getStateTestKeys(
    params: TestParam<TState, TEvent>,
    state: TState,
    resolvedOptions: TestModelOptions<TState, TEvent>
  ) {
    const states = params.states || {};
    const stateTestKeys = Object.keys(states).filter((stateKey) => {
      return resolvedOptions.stateMatcher(state, stateKey);
    });

    // Fallthrough state tests
    if (!stateTestKeys.length && '*' in states) {
      stateTestKeys.push('*');
    }

    return stateTestKeys;
  }

  private afterTestState(
    state: TState,
    resolvedOptions: TestModelOptions<TState, TEvent>
  ) {
    resolvedOptions.execute(state);
  }

  public testStateSync(
    params: TestParam<TState, TEvent>,
    state: TState,
    options?: Partial<TestModelOptions<TState, TEvent>>
  ): void {
    const resolvedOptions = this.resolveOptions(options);

    const stateTestKeys = this.getStateTestKeys(params, state, resolvedOptions);

    for (const stateTestKey of stateTestKeys) {
      errorIfPromise(
        params.states?.[stateTestKey](state),
        `The test for '${stateTestKey}' returned a promise - did you mean to use the sync method?`
      );
    }

    this.afterTestState(state, resolvedOptions);
  }

  private getEventExec(
    params: TestParam<TState, TEvent>,
    step: Step<TState, TEvent>
  ) {
    const eventExec =
      params.events?.[(step.event as any).type as TEvent['type']];

    return eventExec;
  }

  public async testTransition(
    params: TestParam<TState, TEvent>,
    step: Step<TState, TEvent>
  ): Promise<void> {
    const eventExec = this.getEventExec(params, step);
    await (eventExec as EventExecutor<TState, TEvent>)?.(step);
  }

  public testTransitionSync(
    params: TestParam<TState, TEvent>,
    step: Step<TState, TEvent>
  ): void {
    const eventExec = this.getEventExec(params, step);

    errorIfPromise(
      (eventExec as EventExecutor<TState, TEvent>)?.(step),
      `The event '${step.event.type}' returned a promise - did you mean to use the sync method?`
    );
  }

  public resolveOptions(
    options?: Partial<TestModelOptions<TState, TEvent>>
  ): TestModelOptions<TState, TEvent> {
    return { ...this.defaultTraversalOptions, ...this.options, ...options };
  }

  public getShortestPathsFrom(
    paths: Array<TestPath<TState, TEvent>>,
    options?: Partial<TraversalOptions<TState, any>>
  ): Array<TestPath<TState, TEvent>> {
    const resultPaths: any[] = [];

    for (const path of paths) {
      const shortestPaths = this.getShortestPaths({
        ...options,
        fromState: path.state
      });
      for (const shortestPath of shortestPaths) {
        resultPaths.push(joinPaths(path, shortestPath));
      }
    }

    return resultPaths;
  }
}

const errorIfPromise = (result: unknown, err: string) => {
  if (typeof result === 'object' && result && 'then' in result) {
    throw new Error(err);
  }
};
